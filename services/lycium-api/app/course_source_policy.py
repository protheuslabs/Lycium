from __future__ import annotations

from typing import Any


SOURCE_COVERAGE_POLICY: dict[str, Any] = {
    "minimumCourseSources": 3,
    "minimumSourcesPerModule": 1,
    "minimumRequiredConceptCoveragePercent": 70,
    "minimumSourceStrengthScore": 65,
    "requireBenchmarkEvidence": False,
    "requireAssessmentCoverage": True,
}
