from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from app.contract_validation import validate_course_schema
from app.course_agent_contract import validate_course_contract
from app.course_quality import assess_course_quality


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / "packages" / "contracts" / "fixtures"


def read_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_backend_accepts_shared_valid_course_fixture() -> None:
    course = read_fixture("valid-course.json")

    assert validate_course_schema(course) == []
    assert validate_course_contract(course) == []
    report = assess_course_quality(course, gate="publish")
    assert report["passed"] is True
    assert report["score"] >= 0.85


def test_backend_rejects_shared_invalid_course_fixture() -> None:
    course = read_fixture("invalid-course-mixed-quiz-content.json")

    errors = validate_course_contract(course)

    assert any("mixes quiz blocks with non-quiz content" in error for error in errors)


def test_quality_gate_rejects_prompt_like_placeholder_lessons() -> None:
    course = deepcopy(read_fixture("valid-course.json"))
    for module in course["modules"]:
        for section in module["sections"]:
            if section.get("pageType") != "learn" or section.get("sectionType") == "summary":
                continue
            section["content"] = [
                {
                    "type": "text",
                    "heading": "Working model",
                    "value": (
                        "Working model studies working model for this topic. "
                        "Learners define the important terms and students should connect them "
                        "to the module objective before the model generates instructional content."
                    ),
                },
                {
                    "type": "conceptCards",
                    "title": "Concepts introduced",
                    "concepts": [{"name": "Placeholder concept", "description": "A placeholder concept."}],
                },
            ]

    report = assess_course_quality(course, gate="publish")

    assert report["passed"] is False
    assert report["metrics"]["qualityEvalFailedDimensionCount"] >= 1
