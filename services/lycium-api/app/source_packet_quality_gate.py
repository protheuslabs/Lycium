from __future__ import annotations

from typing import Any

from app.course_source_policy import SOURCE_COVERAGE_POLICY
from app.source_strength import calculate_source_strength


def _quality_from_synthesis(synthesis: dict[str, Any]) -> dict[str, Any]:
    source_packet = synthesis.get("sourcePacket")
    if not isinstance(source_packet, dict):
        return {}
    quality = source_packet.get("quality")
    return quality if isinstance(quality, dict) else {}


def _issue(message: str) -> dict[str, str]:
    return {"severity": "error", "message": message}


def source_packet_gate_message(gate: dict[str, Any], fallback: str) -> str:
    issues = gate.get("issues")
    if isinstance(issues, list):
        for issue in issues:
            message = issue.get("message") if isinstance(issue, dict) else issue
            if str(message or "").strip():
                return str(message).strip()
    return fallback


def _concept_rows(uncovered: list[Any]) -> list[dict[str, str]]:
    return [
        {
            "concept": str(concept),
            "location": "source packet",
            "sectionId": "source-packet",
            "status": "missing",
        }
        for concept in uncovered
        if str(concept).strip()
    ]


def source_packet_quality_gate(
    source_corpus_synthesis: dict[str, Any],
    *,
    require_source_packet: bool = False,
    require_source_strength: bool = False,
    source_documents: list[dict[str, Any]] | None = None,
    input_artifacts: list[dict[str, Any]] | None = None,
    source_urls: list[str] | None = None,
) -> dict[str, Any] | None:
    source_strength = calculate_source_strength(
        source_corpus_synthesis,
        source_documents=source_documents,
        input_artifacts=input_artifacts,
        source_urls=source_urls,
    )
    quality = _quality_from_synthesis(source_corpus_synthesis)
    if not quality:
        if require_source_packet:
            return {
                "gate": "source_packet_quality",
                "status": "failed",
                "issues": [
                    _issue(
                        "A source packet is required before this generated course can claim source-backed completeness."
                    )
                ],
                "artifacts": {
                    "conceptCoverageRatio": 0,
                    "minimumConceptCoverageRatio": float(SOURCE_COVERAGE_POLICY["minimumRequiredConceptCoveragePercent"]) / 100,
                    "conceptCandidateCount": 0,
                    "coveredConceptCandidateCount": 0,
                    "uncoveredConceptCandidates": [],
                    "conceptCoverage": [],
                    "sourcePacketQuality": {},
                    "sourceStrength": source_strength,
                },
            }
        if require_source_strength and not source_strength["ready"]:
            return {
                "gate": "source_strength",
                "status": "failed",
                "issues": [
                    _issue("Source strength is below policy; add stronger or more relevant evidence before generation.")
                ],
                "artifacts": {
                    "conceptCoverageRatio": source_strength["conceptCoverage"]["coverageRatio"],
                    "minimumConceptCoverageRatio": source_strength["conceptCoverage"]["minimumCoverageRatio"],
                    "conceptCandidateCount": source_strength["conceptCoverage"].get("requiredConceptCount") or 0,
                    "coveredConceptCandidateCount": source_strength["conceptCoverage"].get("coveredConceptCount") or 0,
                    "uncoveredConceptCandidates": source_strength["conceptCoverage"].get("uncoveredConcepts", []),
                    "conceptCoverage": source_strength["conceptCoverage"].get("coverageRows", []),
                    "sourcePacketQuality": {},
                    "sourceStrength": source_strength,
                },
            }
        return None
    if "conceptCoverageRatio" not in quality:
        return None
    threshold = float(SOURCE_COVERAGE_POLICY["minimumRequiredConceptCoveragePercent"]) / 100
    ratio = float(quality.get("conceptCoverageRatio") or 0)
    concept_coverage_ready = ratio >= threshold
    source_strength_ready = not require_source_strength or source_strength["ready"]
    if concept_coverage_ready and source_strength_ready:
        return None
    uncovered = quality.get("uncoveredConceptCandidates")
    uncovered_concepts = uncovered if isinstance(uncovered, list) else []
    gate_name = "source_packet_quality" if not concept_coverage_ready else "source_strength"
    return {
        "gate": gate_name,
        "status": "failed",
        "issues": [
            _issue(
                "Source strength is below policy; add sources that cover the uncovered concept candidates."
                if gate_name == "source_strength"
                else "Source packet concept coverage is below policy; add sources that cover the uncovered concept candidates."
            )
        ],
        "artifacts": {
            "conceptCoverageRatio": ratio,
            "minimumConceptCoverageRatio": threshold,
            "conceptCandidateCount": int(quality.get("conceptCandidateCount") or 0),
            "coveredConceptCandidateCount": int(quality.get("coveredConceptCandidateCount") or 0),
            "uncoveredConceptCandidates": [str(concept) for concept in uncovered_concepts],
            "conceptCoverage": _concept_rows(uncovered_concepts),
            "sourcePacketQuality": quality,
            "sourceStrength": source_strength,
        },
    }
