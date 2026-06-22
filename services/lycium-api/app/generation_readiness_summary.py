from __future__ import annotations

from typing import Any


def generation_readiness_summary(trace: dict[str, Any]) -> dict[str, Any]:
    readiness = trace.get("generation_readiness") or trace.get("generationReadiness")
    if not isinstance(readiness, dict):
        return {}
    source_evidence = readiness.get("sourceEvidence") if isinstance(readiness.get("sourceEvidence"), dict) else {}
    concept_coverage = readiness.get("conceptCoverage") if isinstance(readiness.get("conceptCoverage"), dict) else {}
    issues = readiness.get("issues") if isinstance(readiness.get("issues"), list) else []
    return {
        "contractVersion": readiness.get("contractVersion"),
        "status": readiness.get("status"),
        "ready": readiness.get("ready"),
        "sourceEvidence": {
            "sourceUrlCount": source_evidence.get("sourceUrlCount"),
            "usableInputArtifactCount": source_evidence.get("usableInputArtifactCount"),
            "submittedEvidenceCount": source_evidence.get("submittedEvidenceCount"),
            "minimumCourseSources": source_evidence.get("minimumCourseSources"),
        },
        "conceptCoverage": {
            "status": concept_coverage.get("status"),
            "coverageRatio": concept_coverage.get("coverageRatio"),
            "minimumCoverageRatio": concept_coverage.get("minimumCoverageRatio"),
            "requiredConceptCount": concept_coverage.get("requiredConceptCount"),
            "coveredConceptCount": concept_coverage.get("coveredConceptCount"),
            "uncoveredConcepts": concept_coverage.get("uncoveredConcepts") if isinstance(concept_coverage.get("uncoveredConcepts"), list) else [],
        },
        "issueCount": len(issues),
        "issues": [
            {"code": str(issue.get("code") or ""), "message": str(issue.get("message") or "")}
            for issue in issues[:8]
            if isinstance(issue, dict) and str(issue.get("message") or "").strip()
        ],
    }
