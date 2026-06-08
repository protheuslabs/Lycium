from __future__ import annotations

from typing import Any


PRE_MEDICAL_PREPARATION_PROGRAM_SCENARIO: dict[str, Any] = {
    "label": "Pre-Medical Preparation Program",
    "kind": "program",
    "generationGoal": "Full pre-medical preparation program for medical school applicants",
    "level": "undergraduate",
    "desiredCourseCount": 30,
    "minRequirementGroups": 6,
    "minCourseRequirements": 16,
    "minAssessmentRequirements": 2,
    "minProjectRequirements": 1,
    "minDependencyEdges": 5,
    "minRequiredKeywordCoverage": 0.74,
    "requiresBenchmarkEvidence": True,
    "requiresQualityReport": True,
    "requiredGenerationMode": "benchmark_first",
    "minBenchmarkCount": 3,
    "minRequirementOriginCount": 14,
    "minSourceSlotCount": 12,
    "minSourceSlotPrimaryCoverageRatio": 0.8,
    "minCourseRequirementCoverageRatio": 0.8,
    "requiredGroupKeywords": ["biological", "chemical", "quantitative", "behavioral", "clinical", "capstone"],
    "requiredRequirementKeywords": [
        "general biology",
        "cell biology",
        "genetics",
        "general chemistry",
        "organic chemistry",
        "biochemistry",
        "physics",
        "calculus",
        "statistics",
        "psychology",
        "sociology",
        "mcat",
        "clinical exposure",
        "service learning",
        "medical ethics",
        "application portfolio",
        "capstone",
    ],
    "sourceDocuments": [
        {
            "url": "https://example.edu/catalog/pre-med-advising-core",
            "contentType": "text/html",
            "text": """Course Description
Pre-medical prerequisite sequence for students preparing for medical school application.
Learning Outcomes
- Complete general biology with laboratory.
- Complete cell biology and genetics foundations.
- Complete general chemistry with laboratory.
- Complete organic chemistry with laboratory.
- Complete biochemistry.
- Complete physics with laboratory.
- Complete calculus and statistics.
- Complete psychology and sociology for behavioral science foundations.
Required Topics
- general biology
- cell biology
- genetics
- general chemistry
- organic chemistry
- biochemistry
- physics
- calculus
- statistics
- psychology
- sociology
- laboratory safety
Assessment
- exam
- lab practical
- advising portfolio
""",
        },
        {
            "url": "https://example.edu/syllabi/mcat-science-foundations",
            "contentType": "text/html",
            "text": """Course Description
MCAT-aligned science integration for pre-medical students.
Learning Outcomes
- Integrate biological and biochemical foundations for MCAT reasoning.
- Apply chemical and physical foundations to biological systems.
- Interpret psychological, social, and biological foundations of behavior.
- Practice critical analysis and reasoning skills.
Required Topics
- MCAT biology
- MCAT biochemistry
- MCAT chemistry and physics
- MCAT psychology and sociology
- critical analysis and reasoning
- experimental design
Assignments
- practice exam
- passage review
- cumulative assessment
""",
        },
        {
            "url": "https://example.edu/syllabi/pre-health-readiness-seminar",
            "contentType": "text/html",
            "text": """Course Description
Pre-health professional readiness seminar connecting prerequisite science courses to clinical exposure, service, ethics, and application evidence.
Learning Outcomes
- Build clinical exposure reflection and service evidence.
- Apply medical ethics to patient-centered scenarios.
- Prepare application materials and interview communication.
- Create a capstone application portfolio.
Required Topics
- clinical exposure
- service learning
- medical ethics
- patient communication
- application portfolio
- interview preparation
- capstone portfolio
Assignments
- reflective journal
- service log
- mock interview
- capstone portfolio
""",
        },
    ],
}
