from __future__ import annotations

from typing import Any

from app.course_source_policy import SOURCE_COVERAGE_POLICY
from app.source_input_artifacts import usable_input_artifact_count
from app.source_packet_quality_gate import source_packet_quality_gate
from app.source_strength import calculate_source_strength


def _unique_source_urls(source_urls: list[str] | None) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for source_url in source_urls or []:
        clean_url = str(source_url).strip()
        if clean_url and clean_url not in seen:
            seen.add(clean_url)
            urls.append(clean_url)
    return urls


def _packet_synthesis(source_packet: dict[str, Any] | None, synthesis: dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(synthesis, dict) and synthesis:
        return synthesis
    if not isinstance(source_packet, dict):
        return {}
    return {
        "sourcePacket": {
            "quality": source_packet.get("quality") if isinstance(source_packet.get("quality"), dict) else {},
            "sourceDocumentCount": len(source_packet.get("source_documents") or []) if isinstance(source_packet.get("source_documents"), list) else 0,
            "sourceCount": len(source_packet.get("sources") or []) if isinstance(source_packet.get("sources"), list) else 0,
        }
    }


def _source_packet_quality(synthesis: dict[str, Any]) -> dict[str, Any]:
    packet = synthesis.get("sourcePacket") if isinstance(synthesis.get("sourcePacket"), dict) else {}
    quality = packet.get("quality") if isinstance(packet.get("quality"), dict) else {}
    return quality


def _quality_artifacts(quality: dict[str, Any]) -> dict[str, Any]:
    if "conceptCoverageRatio" not in quality:
        return {}
    return {
        "conceptCoverageRatio": quality.get("conceptCoverageRatio"),
        "minimumConceptCoverageRatio": float(SOURCE_COVERAGE_POLICY["minimumRequiredConceptCoveragePercent"]) / 100,
        "conceptCandidateCount": quality.get("conceptCandidateCount"),
        "coveredConceptCandidateCount": quality.get("coveredConceptCandidateCount"),
        "uncoveredConceptCandidates": quality.get("uncoveredConceptCandidates", []),
        "conceptCoverage": quality.get("conceptCoverage", []),
        "sourcePacketQuality": quality,
    }


def build_generation_readiness_report(
    *,
    source_urls: list[str] | None,
    input_artifacts: list[dict[str, Any]] | None = None,
    source_packet: dict[str, Any] | None = None,
    source_corpus_synthesis: dict[str, Any] | None = None,
    source_documents: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    urls = _unique_source_urls(source_urls)
    usable_artifact_count = usable_input_artifact_count(input_artifacts)
    artifact_url_count = len([url for url in urls if url.startswith(("artifact://", "input-artifact://"))])
    evidence_count = len(urls) + max(0, usable_artifact_count - artifact_url_count)
    minimum_sources = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    synthesis = _packet_synthesis(source_packet, source_corpus_synthesis)
    source_strength = calculate_source_strength(
        synthesis,
        source_documents=source_documents,
        input_artifacts=input_artifacts,
        source_urls=urls,
    )
    source_gate = source_packet_quality_gate(
        synthesis,
        require_source_strength=True,
        source_documents=source_documents,
        input_artifacts=input_artifacts,
        source_urls=urls,
    )
    artifacts = source_gate.get("artifacts") if isinstance(source_gate, dict) else {}
    concept_artifacts = artifacts if isinstance(artifacts, dict) and artifacts else _quality_artifacts(_source_packet_quality(synthesis))
    missing_concepts = [
        str(concept)
        for concept in concept_artifacts.get("uncoveredConceptCandidates", [])
        if str(concept).strip()
    ] if isinstance(concept_artifacts.get("uncoveredConceptCandidates"), list) else []
    issues = []
    if source_gate:
        for issue in source_gate.get("issues", []):
            message = str(issue.get("message") or "") if isinstance(issue, dict) else str(issue)
            if message.strip():
                issues.append({"code": str(source_gate.get("gate") or "source_packet_quality"), "message": message})
    ready = not issues
    return {
        "contractVersion": "course-generation-readiness-v1",
        "status": "ready" if ready else "needs_sources",
        "ready": ready,
        "sourceEvidence": {
            "sourceUrlCount": len(urls),
            "usableInputArtifactCount": usable_artifact_count,
            "submittedEvidenceCount": evidence_count,
            "minimumCourseSources": minimum_sources,
            "minimumSourceStrengthScore": source_strength["minimumScore"],
        },
        "conceptCoverage": {
            "status": "ready" if not source_gate else "needs_sources",
            "coverageRatio": concept_artifacts.get("conceptCoverageRatio") or source_strength["conceptCoverage"].get("coverageRatio"),
            "minimumCoverageRatio": concept_artifacts.get("minimumConceptCoverageRatio") or source_strength["conceptCoverage"].get("minimumCoverageRatio"),
            "requiredConceptCount": concept_artifacts.get("conceptCandidateCount") or source_strength["conceptCoverage"].get("requiredConceptCount"),
            "coveredConceptCount": concept_artifacts.get("coveredConceptCandidateCount") or source_strength["conceptCoverage"].get("coveredConceptCount"),
            "uncoveredConcepts": missing_concepts or source_strength["conceptCoverage"].get("uncoveredConcepts", []),
            "coverageRows": concept_artifacts.get("conceptCoverage", []) or source_strength["conceptCoverage"].get("coverageRows", []),
        },
        "sourceStrength": source_strength,
        "sourceGate": source_gate,
        "issues": issues,
    }
