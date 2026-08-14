from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.course_generation_premed_specs import PRE_MEDICAL_PREPARATION_PROGRAM_SCENARIO


GOLDEN_DATASET_VERSION = "course-generation-golden-dataset-v1"
DEFAULT_GOLDEN_DATASET_PATH = Path(__file__).with_name("course_generation_golden_dataset.json")


def load_course_generation_golden_dataset(path: str | Path | None = None) -> dict[str, Any]:
    dataset_path = Path(path) if path is not None else DEFAULT_GOLDEN_DATASET_PATH
    payload = json.loads(dataset_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Course generation golden dataset must be a JSON object.")
    if payload.get("contractVersion") != GOLDEN_DATASET_VERSION:
        raise ValueError(f"Course generation golden dataset must use {GOLDEN_DATASET_VERSION}.")
    course_templates = payload.get("courseTemplates")
    if not isinstance(course_templates, list) or len(course_templates) < 10:
        raise ValueError("Course generation golden dataset must include at least 10 course templates.")
    return payload


def _scenario_map(rows: Any) -> dict[str, dict[str, Any]]:
    scenarios: dict[str, dict[str, Any]] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        scenario_id = str(row.get("id") or "")
        if not scenario_id:
            raise ValueError("Course generation scenario is missing id.")
        scenarios[scenario_id] = dict(row)
    return scenarios


GOLDEN_DATASET = load_course_generation_golden_dataset()
GOLDEN_COURSE_TEMPLATES: dict[str, dict[str, Any]] = _scenario_map(GOLDEN_DATASET.get("courseTemplates"))
COURSE_SCENARIOS: dict[str, dict[str, Any]] = {
    **GOLDEN_COURSE_TEMPLATES,
    **_scenario_map(GOLDEN_DATASET.get("workflowScenarios")),
}

PROGRAM_SCENARIOS: dict[str, dict[str, Any]] = {
    "full-stack-software-engineer-program": {
        "label": "Full-Stack Software Engineer Program",
        "kind": "program",
        "minRequirementGroups": 6,
        "minCourseRequirements": 18,
        "minAssessmentRequirements": 2,
        "minProjectRequirements": 1,
        "minDependencyEdges": 5,
        "minRequiredKeywordCoverage": 0.7,
        "requiredGroupKeywords": [
            "foundations",
            "programming",
            "frontend",
            "backend",
            "data",
            "deployment",
            "professional",
            "capstone",
        ],
        "requiredRequirementKeywords": [
            "html",
            "css",
            "javascript",
            "typescript",
            "react",
            "api",
            "database",
            "authentication",
            "testing",
            "docker",
            "ci/cd",
            "capstone",
        ],
    },
    "chemistry-foundations-program": {
        "label": "Chemistry Foundations Program",
        "kind": "program",
        "generationGoal": "General chemistry foundations for college science majors",
        "level": "undergraduate",
        "desiredCourseCount": 24,
        "minRequirementGroups": 5,
        "minCourseRequirements": 10,
        "minAssessmentRequirements": 2,
        "minProjectRequirements": 1,
        "minDependencyEdges": 4,
        "minRequiredKeywordCoverage": 0.72,
        "requiresBenchmarkEvidence": True,
        "requiresQualityReport": True,
        "requiredGenerationMode": "benchmark_first",
        "minBenchmarkCount": 2,
        "minRequirementOriginCount": 10,
        "minSourceSlotCount": 8,
        "minSourceSlotPrimaryCoverageRatio": 0.8,
        "minCourseRequirementCoverageRatio": 0.8,
        "requiredGroupKeywords": ["foundations", "analysis", "practice", "laboratory", "capstone"],
        "requiredRequirementKeywords": [
            "matter",
            "measurement",
            "atomic structure",
            "periodic trends",
            "stoichiometry",
            "chemical reactions",
            "thermochemistry",
            "bonding",
            "equilibrium",
            "acids",
            "laboratory safety",
            "capstone",
        ],
        "sourceDocuments": [
            {
                "url": "https://example.edu/catalog/general-chemistry-foundations",
                "contentType": "text/html",
                "text": """Course Description
General Chemistry I for science majors.
Learning Outcomes
- Define matter and measurement in chemical systems.
- Explain atomic structure and periodic trends.
- Solve stoichiometry problems.
- Interpret chemical reactions.
- Calculate thermochemistry quantities.
- Model chemical bonding.
Required Topics
- matter and measurement
- atomic structure
- periodic trends
- stoichiometry
- chemical reactions
- thermochemistry
Assessment
- quiz
- exam
- lab
""",
            },
            {
                "url": "https://example.edu/syllabi/chemistry-foundations-lab",
                "contentType": "text/html",
                "text": """Course Description
General Chemistry laboratory and concept sequence.
Learning Outcomes
- Apply laboratory safety procedures.
- Use measurement uncertainty in laboratory reasoning.
- Analyze chemical reactions in solution.
- Model equilibrium reasoning.
- Explain acids and bases titration.
- Create a final evidence portfolio.
Required Topics
- laboratory safety
- measurement uncertainty
- chemical reactions
- stoichiometry in solution
- equilibrium
- acids and bases
Assignments
- lab notebook
- quiz
- capstone portfolio
""",
            },
        ],
    },
    "data-science-analytics-program": {
        "label": "Data Science Analytics Program",
        "kind": "program",
        "generationGoal": "Data science and analytics professional foundations",
        "level": "professional",
        "desiredCourseCount": 24,
        "minRequirementGroups": 5,
        "minCourseRequirements": 10,
        "minAssessmentRequirements": 2,
        "minProjectRequirements": 1,
        "minDependencyEdges": 4,
        "minRequiredKeywordCoverage": 0.72,
        "requiresBenchmarkEvidence": True,
        "requiresQualityReport": True,
        "requiredGenerationMode": "benchmark_first",
        "minBenchmarkCount": 2,
        "minRequirementOriginCount": 10,
        "minSourceSlotCount": 8,
        "minSourceSlotPrimaryCoverageRatio": 0.8,
        "minCourseRequirementCoverageRatio": 0.8,
        "requiredGroupKeywords": ["programming", "data", "analysis", "professional", "capstone"],
        "requiredRequirementKeywords": [
            "statistics",
            "python",
            "sql",
            "data cleaning",
            "visualization",
            "machine learning",
            "ethics",
            "communication",
            "capstone",
        ],
        "sourceDocuments": [
            {
                "url": "https://example.edu/catalog/data-analytics-certificate",
                "contentType": "text/html",
                "text": """Course Description
Data science and analytics certificate core.
Learning Outcomes
- Apply statistics for data analysis.
- Implement Python programming workflows.
- Use SQL and relational data.
- Perform data cleaning and transformation.
- Create exploratory visualization.
- Explain machine learning foundations.
Required Topics
- statistics
- Python programming
- SQL
- data cleaning
- visualization
- machine learning
Assessment
- quiz
- project
- presentation
""",
            },
            {
                "url": "https://example.edu/syllabi/data-science-methods",
                "contentType": "text/html",
                "text": """Course Description
Applied data science methods and portfolio practice.
Learning Outcomes
- Interpret probability and statistical inference.
- Build Python notebooks.
- Use SQL joins and aggregation.
- Develop reproducible data cleaning.
- Design dashboard visualization.
- Evaluate supervised machine learning.
- Apply data ethics review.
- Communicate findings in writing.
- Submit a portfolio capstone.
Required Topics
- probability
- statistical inference
- Python notebooks
- SQL joins
- dashboard visualization
- data ethics
Assignments
- project
- capstone
""",
            },
        ],
    },
    "public-health-foundations-program": {
        "label": "Public Health Foundations Program",
        "kind": "program",
        "generationGoal": "Public health foundations for community health practice",
        "level": "undergraduate",
        "desiredCourseCount": 24,
        "minRequirementGroups": 5,
        "minCourseRequirements": 10,
        "minAssessmentRequirements": 2,
        "minProjectRequirements": 1,
        "minDependencyEdges": 4,
        "minRequiredKeywordCoverage": 0.72,
        "requiresBenchmarkEvidence": True,
        "requiresQualityReport": True,
        "requiredGenerationMode": "benchmark_first",
        "minBenchmarkCount": 2,
        "minRequirementOriginCount": 10,
        "minSourceSlotCount": 8,
        "minSourceSlotPrimaryCoverageRatio": 0.8,
        "minCourseRequirementCoverageRatio": 0.8,
        "requiredGroupKeywords": ["foundations", "public", "policy", "practice", "capstone"],
        "requiredRequirementKeywords": [
            "epidemiology",
            "biostatistics",
            "health policy",
            "community health",
            "environmental health",
            "health equity",
            "program evaluation",
            "intervention",
            "communication",
            "capstone",
        ],
        "sourceDocuments": [
            {
                "url": "https://example.edu/catalog/public-health-core",
                "contentType": "text/html",
                "text": """Course Description
Public health foundations core.
Learning Outcomes
- Interpret epidemiology evidence.
- Use biostatistics for population health.
- Compare health policy choices.
- Conduct community health assessment.
- Explain environmental health risks.
- Analyze social determinants of health.
Required Topics
- epidemiology
- biostatistics
- health policy
- community health
- environmental health
- health equity
Assessment
- quiz
- exam
- report
""",
            },
            {
                "url": "https://example.edu/syllabi/community-health-practice",
                "contentType": "text/html",
                "text": """Course Description
Community health practice and program evaluation.
Learning Outcomes
- Design community health interventions.
- Evaluate public health programs.
- Communicate with stakeholders.
- Apply health equity frameworks.
- Create a capstone needs assessment.
Required Topics
- intervention planning
- program evaluation
- stakeholder communication
- health equity
- capstone needs assessment
Assignments
- project
- presentation
- capstone
""",
            },
        ],
    },
    "pre-medical-preparation-program": PRE_MEDICAL_PREPARATION_PROGRAM_SCENARIO,
}
