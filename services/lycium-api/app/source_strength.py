from __future__ import annotations

from typing import Any

from app.course_source_policy import SOURCE_COVERAGE_POLICY


SOURCE_STRENGTH_CONTRACT_VERSION = "source-strength-v1"


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def _source_packet(synthesis: dict[str, Any]) -> dict[str, Any]:
    packet = synthesis.get("sourcePacket")
    return packet if isinstance(packet, dict) else {}


def _quality(synthesis: dict[str, Any]) -> dict[str, Any]:
    quality = _source_packet(synthesis).get("quality")
    return quality if isinstance(quality, dict) else {}


def _text_length(row: dict[str, Any]) -> int:
    for key in ("textLength", "text_length"):
        value = row.get(key)
        if isinstance(value, int | float):
            return max(0, int(value))
    text = row.get("text") or row.get("rawText") or row.get("content") or row.get("extractedText")
    return len(str(text or ""))


def _included_sources(synthesis: dict[str, Any]) -> list[dict[str, Any]]:
    sources = _items(synthesis.get("includedSources"))
    if sources:
        return sources
    packet = _source_packet(synthesis)
    source_count = int(packet.get("sourceCount") or _quality(synthesis).get("includedSourceCount") or 0)
    return [{"sourceId": f"source-{index}"} for index in range(1, source_count + 1)]


def _source_documents(
    synthesis: dict[str, Any],
    source_documents: list[dict[str, Any]] | None,
    input_artifacts: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    documents = [*_items(source_documents), *_items(synthesis.get("sourceDocuments"))]
    packet = _source_packet(synthesis)
    for index in range(int(packet.get("sourceDocumentCount") or _quality(synthesis).get("sourceDocumentCount") or 0)):
        documents.append({"sourceDocumentIndex": index + 1})

    accepted_artifact_ids = {
        str(source.get("inputArtifactId"))
        for source in _items(synthesis.get("includedSources"))
        if source.get("inputArtifactId")
    }
    artifacts = _items(input_artifacts) or _items(synthesis.get("inputArtifacts"))
    documents.extend(
        artifact
        for artifact in artifacts
        if _text_length(artifact) > 0
        and (not accepted_artifact_ids or str(artifact.get("id") or "") in accepted_artifact_ids)
    )

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, document in enumerate(documents):
        key = str(
            document.get("url")
            or document.get("sourceDocumentUrl")
            or document.get("inputArtifactId")
            or document.get("id")
            or f"document-{index}"
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(document)
    return deduped


def _source_urls(synthesis: dict[str, Any], source_urls: list[str] | None) -> list[str]:
    urls = [str(url).strip() for url in source_urls or [] if str(url).strip()]
    urls.extend(str(row.get("url") or "").strip() for row in _items(synthesis.get("includedSources")))
    return sorted({url for url in urls if url})


def _concept_rows(uncovered: list[str]) -> list[dict[str, str]]:
    return [
        {"concept": concept, "location": "source packet", "sectionId": "source-packet", "status": "missing"}
        for concept in uncovered
    ]


def _concept_coverage(quality: dict[str, Any], has_evidence: bool) -> dict[str, Any]:
    threshold = float(SOURCE_COVERAGE_POLICY["minimumRequiredConceptCoveragePercent"]) / 100
    has_ratio = "conceptCoverageRatio" in quality
    ratio = _clamp(_float(quality.get("conceptCoverageRatio"), 1.0 if has_evidence else 0.0)) if has_ratio else (0.7 if has_evidence else 0.0)
    uncovered = _strings(quality.get("uncoveredConceptCandidates"))
    if uncovered:
        ratio = min(ratio, max(0.0, threshold - 0.01))
    return {
        "status": "ready" if ratio >= threshold and not uncovered else "needs_sources",
        "coverageRatio": round(ratio, 3),
        "minimumCoverageRatio": threshold,
        "requiredConceptCount": quality.get("conceptCandidateCount"),
        "coveredConceptCount": quality.get("coveredConceptCandidateCount"),
        "uncoveredConcepts": uncovered,
        "coverageRows": _concept_rows(uncovered),
    }


def _depth_dimension(documents: list[dict[str, Any]], source_count: int) -> float:
    lengths = [_text_length(document) for document in documents]
    total_length = sum(lengths)
    longest = max(lengths or [0])
    if longest >= 120_000 or total_length >= 180_000:
        return 1.0
    if longest >= 60_000 or total_length >= 90_000:
        return 0.9
    if longest >= 25_000 or total_length >= 45_000:
        return 0.75
    if longest >= 8_000 or total_length >= 16_000:
        return 0.55
    if len(documents) >= 2:
        return 0.6
    if documents:
        return 0.55
    return 0.4 if source_count >= 3 else 0.2 if source_count else 0.0


def _relevance_dimension(synthesis: dict[str, Any], quality: dict[str, Any], has_evidence: bool) -> float:
    scores = [_float(row.get("relevanceScore")) for row in _items(synthesis.get("includedSources")) if "relevanceScore" in row]
    if scores:
        return max(0.55, _clamp(sum(scores) / len(scores)))
    status = str(quality.get("status") or "").lower()
    if status == "usable":
        return 0.85
    if status == "needs_review":
        return 0.55
    return 0.5 if has_evidence else 0.0


def _authority_dimension(
    synthesis: dict[str, Any],
    quality: dict[str, Any],
    urls: list[str],
    documents: list[dict[str, Any]],
) -> float:
    trust = _float(quality.get("averageTrustScore"), -1)
    if trust >= 0:
        return _clamp(trust)
    packet = _source_packet(synthesis)
    mix = quality.get("sourceTypeMix") if isinstance(quality.get("sourceTypeMix"), dict) else {}
    text = " ".join(str(value).lower() for value in [*mix.keys(), *urls, packet.get("contextId")])
    if any(term in text for term in ("open_textbook", "textbook", "syllabus", "catalog", "standard", "open_courseware", ".edu")):
        return 0.75
    if any(term in text for term in (".org", "documentation", "docs")):
        return 0.65
    if any(url.startswith(("artifact://", "input-artifact://")) for url in urls):
        return 0.65
    if any(isinstance(document.get("sourceIndexRef"), dict) for document in documents):
        return 0.55
    return 0.45 if urls or packet else 0.0


def _extractability_dimension(quality: dict[str, Any], documents: list[dict[str, Any]], source_count: int) -> float:
    if "documentCoverageRatio" in quality:
        return _clamp(_float(quality.get("documentCoverageRatio")))
    if not source_count:
        return 0.0
    return _clamp(len(documents) / max(1, source_count)) if documents else 0.25


def _diversity_dimension(source_count: int, quality: dict[str, Any]) -> float:
    if source_count <= 0:
        return 0.0
    type_mix = quality.get("sourceTypeMix")
    type_count = len(type_mix) if isinstance(type_mix, dict) else 0
    return max(_clamp(source_count / 4), _clamp(type_count / 3))


def calculate_source_strength(
    source_corpus_synthesis: dict[str, Any] | None,
    *,
    source_documents: list[dict[str, Any]] | None = None,
    input_artifacts: list[dict[str, Any]] | None = None,
    source_urls: list[str] | None = None,
) -> dict[str, Any]:
    synthesis = source_corpus_synthesis if isinstance(source_corpus_synthesis, dict) else {}
    quality = _quality(synthesis)
    included = _included_sources(synthesis)
    urls = _source_urls(synthesis, source_urls)
    documents = _source_documents(synthesis, source_documents, input_artifacts)
    source_count = max(len(included), len(urls), int(quality.get("includedSourceCount") or 0))
    has_evidence = source_count > 0 or bool(documents)
    concept_coverage = _concept_coverage(quality, has_evidence)
    coverage = _clamp(_float(concept_coverage.get("coverageRatio")))
    depth = _depth_dimension(documents, source_count)
    relevance = _relevance_dimension(synthesis, quality, has_evidence)
    authority = _authority_dimension(synthesis, quality, urls, documents)
    extractability = _extractability_dimension(quality, documents, source_count)
    diversity = _diversity_dimension(source_count, quality)
    score = round((coverage * 0.35 + depth * 0.25 + relevance * 0.2 + authority * 0.1 + extractability * 0.08 + diversity * 0.02) * 100)
    minimum_score = int(SOURCE_COVERAGE_POLICY.get("minimumSourceStrengthScore") or 65)
    gaps: list[dict[str, str]] = []
    if not has_evidence:
        gaps.append({"code": "no_source_evidence", "message": "Add at least one relevant source, source packet, or extracted file."})
    if concept_coverage["status"] != "ready":
        gaps.append({"code": "concept_coverage", "message": "Accepted sources do not yet cover the required concept candidates."})
    if score < minimum_score:
        gaps.append({"code": "source_strength", "message": "Accepted source evidence is not strong enough for review-ready source grounding or publication."})
    status = "blocked" if not has_evidence else "weak" if score < minimum_score else "adequate" if score < 80 else "strong"
    ready = status in {"adequate", "strong"} and concept_coverage["status"] == "ready"
    return {
        "contractVersion": SOURCE_STRENGTH_CONTRACT_VERSION,
        "status": status,
        "ready": ready,
        "score": score,
        "minimumScore": minimum_score,
        "dimensions": {
            "conceptCoverage": round(coverage, 3),
            "depth": round(depth, 3),
            "relevance": round(relevance, 3),
            "authority": round(authority, 3),
            "extractability": round(extractability, 3),
            "diversity": round(diversity, 3),
        },
        "sourceEvidence": {
            "sourceCount": source_count,
            "sourceUrlCount": len(urls),
            "sourceDocumentCount": len(documents),
            "usableInputArtifactCount": len([artifact for artifact in _items(input_artifacts) if _text_length(artifact) > 0]),
            "totalTextLength": sum(_text_length(document) for document in documents),
            "minimumSourceStrengthScore": minimum_score,
        },
        "conceptCoverage": concept_coverage,
        "sourcePacketQuality": quality,
        "gaps": gaps,
        "recommendations": [
            "Add benchmark, syllabus, open textbook, lecture, lab, assignment, or source-packet evidence for uncovered concepts."
        ]
        if gaps
        else [],
    }
