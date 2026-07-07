from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.source_url_utils import canonicalize_url
from app.models import Snapshot, Source, SourceCorpusRun
from app.source_corpus import compile_source_corpus_preflight
from app.source_identity import stable_snapshot_public_id, stable_source_public_id
from app.source_index_client import SourceIndexClient, source_index_client_configured
from app.source_index import (
    corpus_run_payload,
    persist_source_corpus_run,
    source_decision_payload,
    source_documents_from_index_snapshots,
    source_payload,
    upsert_indexed_source,
)

SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
SOURCE_IMPORT_BATCH_CONTRACT_VERSION = "source-import-batch-v1"
SOURCE_PACKET_SCHEMA_ID = "https://protheuslabs.github.io/Lycium/schemas/lycium-source-packet.schema.json"
BENCHMARK_SOURCE_TYPES = {
    "catalog",
    "certification",
    "curriculum",
    "employer_profile",
    "open_courseware",
    "program",
    "standard",
    "syllabus",
}
BROKEN_LINK_HEALTH_VALUES = {"broken", "dead", "failed", "unreachable"}
STALE_VERIFICATION_DAYS = 365
PACKET_CONCEPT_STOP_TERMS = {
    "and",
    "the",
    "for",
    "with",
    "course",
    "source",
    "sources",
    "learn",
    "learning",
    "open",
    "intro",
    "introduction",
    "foundations",
}


def _as_source_record(packet_source: dict[str, Any]) -> dict[str, Any]:
    source = packet_source.get("source")
    return source if isinstance(source, dict) else {}


def _float_values(values: list[Any]) -> list[float]:
    result: list[float] = []
    for value in values:
        if isinstance(value, int | float):
            result.append(float(value))
    return result


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _normalized_terms(value: Any) -> list[str]:
    normalized = re.sub(r"[^a-z0-9+#/]+", " ", str(value or "").lower()).strip()
    return [term for term in normalized.split() if len(term) > 2 and not term.isdigit() and term not in PACKET_CONCEPT_STOP_TERMS]


def _candidate_concepts(prompt: str, synthesis: dict[str, Any], packet_sources: list[dict[str, Any]]) -> list[str]:
    candidates: list[str] = []
    for key in ("commonThemes", "common_themes", "requiredConcepts", "required_concepts"):
        value = synthesis.get(key)
        if isinstance(value, list):
            candidates.extend(" ".join(_normalized_terms(item)) for item in value)
    for packet_source in packet_sources:
        decision = packet_source.get("decision") if isinstance(packet_source.get("decision"), dict) else {}
        matched_terms = decision.get("matched_terms")
        if isinstance(matched_terms, list):
            candidates.extend(" ".join(_normalized_terms(term)) for term in matched_terms)
    if not candidates:
        candidates.extend(_normalized_terms(prompt))
    return sorted({candidate for candidate in candidates if candidate})[:40]


def _packet_evidence_text(packet_sources: list[dict[str, Any]], packet_documents: list[dict[str, Any]]) -> str:
    values: list[str] = []
    for document in packet_documents:
        values.extend(str(document.get(key) or "") for key in ("title", "url", "text", "text_digest"))
    for packet_source in packet_sources:
        source = packet_source.get("source") if isinstance(packet_source.get("source"), dict) else {}
        source_document = packet_source.get("source_document") if isinstance(packet_source.get("source_document"), dict) else {}
        values.extend(str(source.get(key) or "") for key in ("title", "canonical_url", "source_type"))
        values.extend(str(source_document.get(key) or "") for key in ("title", "url", "text", "text_digest"))
        for snapshot in packet_source.get("snapshots") or []:
            if isinstance(snapshot, dict):
                values.extend(str(snapshot.get(key) or "") for key in ("title", "text_digest", "extracted_text"))
    return f" {' '.join(_normalized_terms(' '.join(values)))} "


def _concept_coverage(prompt: str, synthesis: dict[str, Any], packet_sources: list[dict[str, Any]], packet_documents: list[dict[str, Any]]) -> dict[str, Any]:
    candidates = _candidate_concepts(prompt, synthesis, packet_sources)
    evidence = _packet_evidence_text(packet_sources, packet_documents)
    covered = [candidate for candidate in candidates if all(f" {term} " in evidence for term in candidate.split())]
    coverage = len(covered) / len(candidates) if candidates else (1 if packet_documents else 0)
    return {
        "conceptCandidateCount": len(candidates),
        "coveredConceptCandidateCount": len(covered),
        "conceptCoverageRatio": round(coverage, 3),
        "uncoveredConceptCandidates": [candidate for candidate in candidates if candidate not in covered][:12],
    }


def _packet_quality(
    packet_sources: list[dict[str, Any]],
    packet_documents: list[dict[str, Any]],
    warnings: list[str],
    *,
    prompt: str = "",
    synthesis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    source_count = len(packet_sources)
    document_count = len(packet_documents)
    snapshot_count = sum(1 for source in packet_sources if source.get("snapshots"))
    evidence_count = sum(1 for source in packet_sources if source.get("evidence_refs"))
    source_records = [_as_source_record(source) for source in packet_sources]
    canonical_urls = [str(source.get("canonical_url") or "") for source in source_records if str(source.get("canonical_url") or "")]
    source_types = [str(source.get("source_type") or "unknown") for source in source_records]
    source_type_mix = {source_type: source_types.count(source_type) for source_type in sorted(set(source_types))}
    trust_scores = _float_values([source.get("trust_baseline") for source in source_records])
    verification_dates = [
        parsed
        for parsed in (_parse_datetime(source.get("last_verified_at") or source.get("updated_at")) for source in source_records)
        if parsed is not None
    ]
    now = datetime.now(UTC)
    duplicate_source_count = max(0, len(canonical_urls) - len(set(canonical_urls)))
    broken_url_count = len(
        [
            source
            for source in source_records
            if str(source.get("link_health") or "").lower() in BROKEN_LINK_HEALTH_VALUES
        ]
    )
    benchmark_source_count = len([source_type for source_type in source_types if source_type in BENCHMARK_SOURCE_TYPES])
    stale_verification_count = len(
        [
            verified_at
            for verified_at in verification_dates
            if now - (verified_at if verified_at.tzinfo else verified_at.replace(tzinfo=UTC)) > timedelta(days=STALE_VERIFICATION_DAYS)
        ]
    )
    document_coverage = document_count / source_count if source_count else 0
    snapshot_coverage = snapshot_count / source_count if source_count else 0
    evidence_coverage = evidence_count / source_count if source_count else 0
    benchmark_usefulness = benchmark_source_count / source_count if source_count else 0
    freshness_known = len(verification_dates) / source_count if source_count else 0
    average_trust = sum(trust_scores) / len(trust_scores) if trust_scores else 0
    concept_coverage = _concept_coverage(prompt, synthesis or {}, packet_sources, packet_documents)
    quality_warnings = []
    if duplicate_source_count:
        quality_warnings.append("Packet contains duplicate canonical source URLs.")
    if broken_url_count:
        quality_warnings.append("Packet contains sources marked with broken link health.")
    if source_count and not benchmark_source_count:
        quality_warnings.append("Packet has no curriculum benchmark-oriented source types.")
    if source_count and freshness_known < 0.5:
        quality_warnings.append("Most packet sources have no verification timestamp.")
    if stale_verification_count:
        quality_warnings.append("Packet contains sources that have not been verified recently.")
    if concept_coverage["conceptCandidateCount"] and concept_coverage["conceptCoverageRatio"] < 0.7:
        quality_warnings.append("Packet documents cover too few prompt or source-decision concept signals.")
    if not source_count:
        status = "empty"
    elif document_coverage >= 1 and evidence_coverage >= 1 and not broken_url_count:
        status = "usable"
    else:
        status = "needs_review"
    return {
        "status": status,
        "includedSourceCount": source_count,
        "sourceDocumentCount": document_count,
        "duplicateSourceCount": duplicate_source_count,
        "brokenUrlCount": broken_url_count,
        "snapshotCoverageRatio": round(snapshot_coverage, 3),
        "documentCoverageRatio": round(document_coverage, 3),
        "evidenceCoverageRatio": round(evidence_coverage, 3),
        "sourceTypeMix": source_type_mix,
        "averageTrustScore": round(average_trust, 3),
        "freshnessKnownRatio": round(freshness_known, 3),
        "staleVerificationCount": stale_verification_count,
        "benchmarkSourceCount": benchmark_source_count,
        "benchmarkUsefulnessRatio": round(benchmark_usefulness, 3),
        **concept_coverage,
        "qualityWarnings": quality_warnings,
        "warningCount": len(warnings) + len(quality_warnings),
    }
