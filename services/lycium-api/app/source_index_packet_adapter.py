from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"


@dataclass(frozen=True)
class SourcePacketGenerationHandoff:
    synthesis: dict[str, Any]
    source_urls: list[str]
    source_documents: list[dict[str, Any]]
    input_artifacts: list[dict[str, Any]] = field(default_factory=list)


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _source_public_id(source: dict[str, Any]) -> str | None:
    return str(source.get("source_public_id") or source.get("public_id") or source.get("id") or "").strip() or None


def _canonical_url_from_locators(locators: list[dict[str, Any]]) -> str | None:
    canonical = next(
        (
            str(locator.get("value") or "").strip()
            for locator in locators
            if str(locator.get("locator_type") or locator.get("locatorType") or "").lower() == "url"
            and locator.get("canonical") is True
            and str(locator.get("value") or "").strip()
        ),
        None,
    )
    if canonical:
        return canonical
    return next(
        (
            str(locator.get("value") or "").strip()
            for locator in locators
            if str(locator.get("locator_type") or locator.get("locatorType") or "").lower() == "url"
            and str(locator.get("value") or "").strip()
        ),
        None,
    )


def _source_url(source: dict[str, Any]) -> str | None:
    return (
        str(source.get("canonical_url") or "").strip()
        or _canonical_url_from_locators(_items(source.get("locators")))
        or None
    )


def _packet_receipt(packet: dict[str, Any], *, evidence_refs: list[str]) -> dict[str, Any]:
    return {
        "contractVersion": str(packet.get("contract_version") or SOURCE_PACKET_CONTRACT_VERSION),
        "packetId": packet.get("packet_id"),
        "contextId": packet.get("context_id"),
        "producer": packet.get("producer") if isinstance(packet.get("producer"), dict) else {},
        "generatedAt": packet.get("generated_at"),
        "sourceCount": len(_items(packet.get("sources"))),
        "evidenceCount": len(_items(packet.get("evidence"))),
        "sourceDocumentCount": len(_items(packet.get("source_documents"))),
        "evidenceRefs": evidence_refs,
        "warnings": packet.get("warnings") if isinstance(packet.get("warnings"), list) else [],
    }


def _legacy_packet_to_handoff(packet: dict[str, Any]) -> SourcePacketGenerationHandoff:
    source_documents = [
        document
        for document in _items(packet.get("source_documents"))
        if str(document.get("url") or "").strip()
    ]
    source_urls = [str(document.get("url")) for document in source_documents]
    if not source_urls:
        source_urls = [
            url
            for source in _items(packet.get("sources"))
            for url in [_source_url(source.get("source") if isinstance(source.get("source"), dict) else source)]
            if url
        ]
    input_artifacts = [
        {
            "id": str(document.get("inputArtifactId")),
            "kind": str(document.get("inputArtifactKind") or "document"),
            "title": str(document.get("title") or document.get("inputArtifactId") or "Input artifact"),
            "filename": "",
            "mimeType": str(document.get("contentType") or document.get("content_type") or ""),
            "sourceUrl": "",
            "sourceDocumentUrl": str(document.get("url") or ""),
            "extractionStatus": "extracted",
            "textLength": len(str(document.get("text") or document.get("rawText") or document.get("content") or "")),
        }
        for document in source_documents
        if document.get("inputArtifactId")
    ]
    evidence_refs = [
        ref
        for source in _items(packet.get("sources"))
        for ref in _strings(source.get("evidence_refs"))
    ]
    synthesis = packet.get("synthesis") if isinstance(packet.get("synthesis"), dict) else {}
    synthesis = dict(synthesis)
    synthesis["sourcePacket"] = {
        **_packet_receipt(packet, evidence_refs=evidence_refs),
        "sourceDocumentCount": len(source_documents),
        "quality": packet.get("quality") if isinstance(packet.get("quality"), dict) else {},
    }
    if input_artifacts:
        synthesis["inputArtifacts"] = input_artifacts
    return SourcePacketGenerationHandoff(
        synthesis=synthesis,
        source_urls=source_urls,
        source_documents=source_documents,
        input_artifacts=input_artifacts,
    )


def _source_by_public_id(packet: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        source_public_id: source
        for source in _items(packet.get("sources"))
        for source_public_id in [_source_public_id(source)]
        if source_public_id
    }


def _source_for_evidence(evidence: dict[str, Any], source_index: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return source_index.get(str(evidence.get("source_public_id") or "")) or {}


def _evidence_url(evidence: dict[str, Any], source: dict[str, Any]) -> str:
    citation = evidence.get("citation") if isinstance(evidence.get("citation"), dict) else {}
    locator = evidence.get("locator") if isinstance(evidence.get("locator"), dict) else {}
    return (
        str(citation.get("url") or "").strip()
        or _canonical_url_from_locators([locator])
        or _source_url(source)
        or f"source-index://{evidence.get('source_public_id') or evidence.get('evidence_id') or 'evidence'}"
    )


def _evidence_text(evidence: dict[str, Any], source: dict[str, Any]) -> str:
    excerpt = str(evidence.get("excerpt") or "").strip()
    if excerpt:
        return excerpt
    citation = evidence.get("citation") if isinstance(evidence.get("citation"), dict) else {}
    relevance = evidence.get("relevance") if isinstance(evidence.get("relevance"), dict) else {}
    compliance = evidence.get("compliance") if isinstance(evidence.get("compliance"), dict) else {}
    concepts = _strings(evidence.get("concepts")) or _strings(source.get("concepts"))
    parts = [
        f"Source Index metadata evidence for {citation.get('title') or source.get('title') or evidence.get('heading') or 'source'}.",
        f"Provider: {source.get('provider')}." if source.get("provider") else "",
        f"Source type: {source.get('source_type')}." if source.get("source_type") else "",
        f"Concepts: {', '.join(concepts)}." if concepts else "",
        f"Evidence heading: {evidence.get('heading')}." if evidence.get("heading") else "",
        f"Relevance: {relevance.get('reason')}." if relevance.get("reason") else "",
        "Packet text is withheld; use this as citation and planning metadata only."
        if compliance.get("packet_text_allowed") is False
        else "",
    ]
    return " ".join(part for part in parts if part).strip()


def _source_type_mix(sources: list[dict[str, Any]]) -> dict[str, int]:
    mix: dict[str, int] = {}
    for source in sources:
        source_type = str(source.get("source_type") or source.get("sourceType") or "unknown")
        mix[source_type] = mix.get(source_type, 0) + 1
    return mix


def _external_quality(packet: dict[str, Any], source_documents: list[dict[str, Any]]) -> dict[str, Any]:
    quality = packet.get("quality") if isinstance(packet.get("quality"), dict) else {}
    coverage = packet.get("coverage") if isinstance(packet.get("coverage"), dict) else {}
    sources = _items(packet.get("sources"))
    evidence = _items(packet.get("evidence"))
    requested_concepts = _strings(coverage.get("requested_concepts") or coverage.get("requestedConcepts"))
    covered_concepts = _strings(coverage.get("covered_concepts") or coverage.get("coveredConcepts"))
    uncovered_concepts = _strings(coverage.get("uncovered_concepts") or coverage.get("uncoveredConcepts"))
    source_count = int(quality.get("included_source_count") or quality.get("includedSourceCount") or len(sources))
    evidence_count = int(quality.get("included_evidence_count") or quality.get("includedEvidenceCount") or len(evidence))
    coverage_ratio = _float(
        coverage.get("coverage_score") or coverage.get("coverageScore"),
        len(covered_concepts) / max(1, len(requested_concepts)) if requested_concepts else 1.0 if evidence else 0.0,
    )
    return {
        "status": str(quality.get("status") or "empty"),
        "score": _float(quality.get("score")),
        "includedSourceCount": source_count,
        "sourceDocumentCount": len(source_documents),
        "includedEvidenceCount": evidence_count,
        "duplicateSourceCount": 0,
        "brokenUrlCount": 0,
        "snapshotCoverageRatio": len([document for document in source_documents if document.get("snapshotId")]) / max(1, source_count),
        "documentCoverageRatio": len(source_documents) / max(1, source_count),
        "evidenceCoverageRatio": evidence_count / max(1, source_count),
        "sourceTypeMix": _source_type_mix(sources),
        "freshnessKnownRatio": 0.0,
        "staleVerificationCount": 0,
        "benchmarkSourceCount": len(
            [
                source
                for source in sources
                if {"curriculum_benchmark", "syllabus", "open_courseware"}.intersection(_strings(source.get("source_roles")))
            ]
        ),
        "benchmarkUsefulnessRatio": 1.0 if sources else 0.0,
        "conceptCandidateCount": len(requested_concepts),
        "coveredConceptCandidateCount": len(covered_concepts),
        "conceptCoverageRatio": coverage_ratio,
        "uncoveredConceptCandidates": uncovered_concepts,
        "qualityWarnings": _strings(quality.get("warnings")),
        "warningCount": len(_strings(quality.get("warnings"))),
        "sourceIndexQuality": quality,
    }


def _external_packet_to_handoff(packet: dict[str, Any]) -> SourcePacketGenerationHandoff:
    source_index = _source_by_public_id(packet)
    source_documents: list[dict[str, Any]] = []
    included_sources: list[dict[str, Any]] = []
    evidence_refs: list[str] = []
    for index, evidence in enumerate(_items(packet.get("evidence")), start=1):
        source = _source_for_evidence(evidence, source_index)
        citation = evidence.get("citation") if isinstance(evidence.get("citation"), dict) else {}
        relevance = evidence.get("relevance") if isinstance(evidence.get("relevance"), dict) else {}
        compliance = evidence.get("compliance") if isinstance(evidence.get("compliance"), dict) else {}
        source_public_id = str(evidence.get("source_public_id") or _source_public_id(source) or f"source-{index}")
        evidence_ref = str(evidence.get("evidence_ref") or evidence.get("evidence_id") or source_public_id)
        evidence_refs.append(evidence_ref)
        document = {
            "url": _evidence_url(evidence, source),
            "contentType": "text/plain",
            "text": _evidence_text(evidence, source),
            "sourceId": source_public_id,
            "snapshotId": evidence.get("snapshot_public_id"),
            "chunkId": evidence.get("chunk_public_id"),
            "evidenceId": evidence.get("evidence_id"),
            "evidenceRef": evidence_ref,
            "title": citation.get("title") or source.get("title") or evidence.get("heading"),
            "concepts": _strings(evidence.get("concepts")) or _strings(source.get("concepts")),
            "sourceType": source.get("source_type"),
            "sourceIndexRef": {
                "service": "protheus-source-index",
                "packetId": packet.get("packet_id"),
                "contextId": packet.get("context_id"),
                "sourcePublicId": source_public_id,
                "snapshotPublicId": evidence.get("snapshot_public_id"),
                "chunkPublicId": evidence.get("chunk_public_id"),
                "evidenceId": evidence.get("evidence_id"),
                "evidenceRef": evidence_ref,
                "complianceLevel": compliance.get("level"),
                "packetTextAllowed": compliance.get("packet_text_allowed"),
            },
        }
        source_documents.append(document)
        included_sources.append(
            {
                "url": document["url"],
                "sourceId": source_public_id,
                "title": document.get("title"),
                "sourceType": source.get("source_type"),
                "relevanceScore": _float(relevance.get("score")),
                "matchedTerms": _strings(relevance.get("matched_terms") or relevance.get("matchedTerms")),
                "matchedConcepts": _strings(relevance.get("matched_concepts") or relevance.get("matchedConcepts")),
                "evidenceRef": evidence_ref,
                "reason": relevance.get("reason"),
                "decision": "included",
            }
        )
    source_urls = []
    seen_urls: set[str] = set()
    for document in source_documents:
        url = str(document.get("url") or "").strip()
        if url and url not in seen_urls:
            seen_urls.add(url)
            source_urls.append(url)
    converted_quality = _external_quality(packet, source_documents)
    synthesis = {
        "workflowGate": "source_corpus_preflight",
        "includedSources": included_sources,
        "excludedSources": [],
        "commonThemes": [
            {"term": concept, "sourceCount": converted_quality["includedSourceCount"]}
            for concept in _strings((packet.get("coverage") or {}).get("covered_concepts") if isinstance(packet.get("coverage"), dict) else [])
        ][:16],
        "metrics": {
            "submittedSourceCount": len(source_urls),
            "includedSourceCount": converted_quality["includedSourceCount"],
            "excludedSourceCount": 0,
            "fetchedSourceCount": 0,
            "failedFetchCount": 0,
        },
        "sourcePacket": {
            **_packet_receipt(packet, evidence_refs=evidence_refs),
            "sourceDocumentCount": len(source_documents),
            "quality": converted_quality,
            "coverage": packet.get("coverage") if isinstance(packet.get("coverage"), dict) else {},
            "target": packet.get("target") if isinstance(packet.get("target"), dict) else {},
            "trace": packet.get("trace") if isinstance(packet.get("trace"), dict) else {},
        },
        "sourceDocuments": source_documents,
    }
    return SourcePacketGenerationHandoff(
        synthesis=synthesis,
        source_urls=source_urls,
        source_documents=source_documents,
    )


def source_packet_generation_handoff(packet: dict[str, Any]) -> SourcePacketGenerationHandoff:
    if _items(packet.get("source_documents")):
        return _legacy_packet_to_handoff(packet)
    return _external_packet_to_handoff(packet)
