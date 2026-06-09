from __future__ import annotations

import math
import re
from typing import Any

from app.models import CourseSnapshot


STOP_TERMS = {
    "and",
    "the",
    "for",
    "with",
    "course",
    "concept",
    "concepts",
    "module",
    "section",
    "lesson",
    "intro",
    "introduction",
    "foundations",
}


def _normalize(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _concept_tokens(concept: Any) -> list[str]:
    return [token for token in _normalize(concept).split() if len(token) > 2 and token not in STOP_TERMS]


def _source_text(source_urls: list[str] | None) -> str:
    return f" {_normalize(' '.join(str(url) for url in source_urls or []))} "


def source_urls_from_source_packet(source_packet: dict[str, Any] | None) -> list[str]:
    if not isinstance(source_packet, dict):
        return []
    urls: list[str] = []
    packet_urls = source_packet.get("source_urls")
    if isinstance(packet_urls, list):
        urls.extend(str(url) for url in packet_urls if str(url).strip())
    for document in source_packet.get("source_documents") or []:
        if isinstance(document, dict) and document.get("url"):
            urls.append(str(document["url"]))
    return list(dict.fromkeys(urls))


def _source_packet_text(source_packet: dict[str, Any] | None) -> str:
    if not isinstance(source_packet, dict):
        return ""
    values: list[str] = []
    for key in ("prompt", "source_urls"):
        value = source_packet.get(key)
        values.extend(str(item) for item in value) if isinstance(value, list) else values.append(str(value or ""))
    for document in source_packet.get("source_documents") or []:
        if isinstance(document, dict):
            values.extend(str(document.get(key) or "") for key in ("title", "url", "text", "text_digest"))
    for source_row in source_packet.get("sources") or []:
        if not isinstance(source_row, dict):
            continue
        source = source_row.get("source") if isinstance(source_row.get("source"), dict) else {}
        decision = source_row.get("decision") if isinstance(source_row.get("decision"), dict) else {}
        source_document = source_row.get("source_document") if isinstance(source_row.get("source_document"), dict) else {}
        values.extend(str(source.get(key) or "") for key in ("title", "canonical_url", "source_type"))
        values.extend(str(term) for term in decision.get("matched_terms", []) if str(term).strip()) if isinstance(decision.get("matched_terms"), list) else None
        values.extend(str(source_document.get(key) or "") for key in ("title", "url", "text", "text_digest"))
        for snapshot in source_row.get("snapshots") or []:
            if isinstance(snapshot, dict):
                values.extend(str(snapshot.get(key) or "") for key in ("title", "text_digest", "extracted_text"))
    return f" {_normalize(' '.join(values))} "


def _concept_is_covered(concept: Any, source_urls: list[str] | None, source_packet: dict[str, Any] | None = None) -> bool:
    tokens = _concept_tokens(concept)
    if not tokens:
        return False
    haystack = _source_text(source_urls) + _source_packet_text(source_packet)
    matches = sum(1 for token in tokens if f" {token} " in haystack)
    return matches >= max(1, math.ceil(len(tokens) * 0.5))


def summarize_concept_source_need_coverage(
    needs: Any,
    source_urls: list[str] | None,
    source_packet: dict[str, Any] | None = None,
) -> dict[str, Any]:
    need_rows = [need for need in needs if isinstance(need, dict)] if isinstance(needs, list) else []
    covered: list[str] = []
    uncovered: list[str] = []
    for need in need_rows:
        concept = str(need.get("concept") or "").strip()
        if not concept:
            continue
        if _concept_is_covered(concept, source_urls, source_packet):
            covered.append(concept)
        else:
            uncovered.append(concept)
    total = len(covered) + len(uncovered)
    coverage = round((len(covered) / total) * 100, 2) if total else 100.0
    return {
        "requiredConceptCount": total,
        "coveredConceptCount": len(covered),
        "coveragePercent": coverage,
        "coveredConcepts": covered,
        "uncoveredConcepts": uncovered,
    }


def _first_source_gap(snapshot: CourseSnapshot) -> dict[str, Any]:
    structure = snapshot.structure if isinstance(snapshot.structure, dict) else {}
    metadata = structure.get("metadata") if isinstance(structure.get("metadata"), dict) else {}
    gaps = metadata.get("sourceGaps")
    if not isinstance(gaps, list) or not gaps or not isinstance(gaps[0], dict):
        return {}
    return gaps[0]


def source_gate_from_needs_sources_snapshot(snapshot: CourseSnapshot) -> dict[str, Any] | None:
    coverage_gate = _first_source_gap(snapshot).get("coverageGate")
    if not isinstance(coverage_gate, dict):
        return None
    issues = coverage_gate.get("issues") if isinstance(coverage_gate.get("issues"), list) else []
    return {
        "gate": coverage_gate.get("gate") or "source_analysis",
        "status": coverage_gate.get("status") or "failed",
        "issues": [{"message": str(issue)} for issue in issues if str(issue).strip()],
        "artifacts": coverage_gate.get("metrics") if isinstance(coverage_gate.get("metrics"), dict) else {},
    }


def concept_source_needs_meet_resume_policy(
    snapshot: CourseSnapshot,
    source_urls: list[str] | None,
    *,
    minimum_coverage_percent: int,
    source_packet: dict[str, Any] | None = None,
) -> bool:
    needs = _first_source_gap(snapshot).get("conceptSourceNeeds")
    if not isinstance(needs, list) or not needs:
        return True
    summary = summarize_concept_source_need_coverage(needs, source_urls, source_packet)
    return float(summary["coveragePercent"]) >= float(minimum_coverage_percent)
