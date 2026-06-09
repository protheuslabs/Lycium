from __future__ import annotations

from typing import Any

from app.course_source_gaps import SOURCE_COVERAGE_POLICY


def _quality_from_synthesis(synthesis: dict[str, Any]) -> dict[str, Any]:
    source_packet = synthesis.get("sourcePacket")
    if not isinstance(source_packet, dict):
        return {}
    quality = source_packet.get("quality")
    return quality if isinstance(quality, dict) else {}


def _issue(message: str) -> dict[str, str]:
    return {"severity": "error", "message": message}


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


def source_packet_quality_gate(source_corpus_synthesis: dict[str, Any]) -> dict[str, Any] | None:
    quality = _quality_from_synthesis(source_corpus_synthesis)
    if not quality:
        return None
    if "conceptCoverageRatio" not in quality:
        return None
    threshold = float(SOURCE_COVERAGE_POLICY["minimumRequiredConceptCoveragePercent"]) / 100
    ratio = float(quality.get("conceptCoverageRatio") or 0)
    if ratio >= threshold:
        return None
    uncovered = quality.get("uncoveredConceptCandidates")
    uncovered_concepts = uncovered if isinstance(uncovered, list) else []
    return {
        "gate": "source_packet_quality",
        "status": "failed",
        "issues": [
            _issue(
                "Source packet concept coverage is below policy; add sources that cover the uncovered concept candidates."
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
        },
    }
