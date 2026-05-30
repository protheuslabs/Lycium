from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from app.contract_validation import validate_course_schema
from app.course_agent_contract import validate_course_contract
from app.course_quality import assess_course_quality
from app.program_quality import assess_program_quality
from app.program_validation import validate_program_contract


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


def _program_course_packets(program: dict) -> list[dict]:
    packets: list[dict] = []
    for group in program.get("requirementGroups", []):
        for requirement in group.get("requirements", []):
            if requirement.get("type") == "complete_course":
                packets.append(
                    {
                        "requirementId": requirement["id"],
                        "courseId": requirement["courseId"],
                        "learningPacket": {"object_ids": [len(packets) + 1]},
                    }
                )
            if requirement.get("type") == "complete_n_of_courses":
                for course_id in requirement.get("courseIds", []):
                    packets.append(
                        {
                            "requirementId": f"{requirement['id']}:{course_id}",
                            "courseId": course_id,
                            "learningPacket": {"object_ids": [len(packets) + 1]},
                        }
                    )
    return packets


def test_program_quality_requires_requirement_level_source_coverage() -> None:
    program = read_fixture("full-stack-engineer-program.json")

    assert validate_program_contract(program) == []
    uncovered_report = assess_program_quality({"program": program, "generationTrace": {"coursePackets": []}})
    covered_report = assess_program_quality({"program": program, "generationTrace": {"coursePackets": _program_course_packets(program)}})

    source_gate = next(gate for gate in uncovered_report["gates"] if gate["gate"] == "source_coverage")
    assert source_gate["status"] == "failed"
    assert source_gate["metrics"]["courseRequirementCoverageRatio"] == 0

    covered_source_gate = next(gate for gate in covered_report["gates"] if gate["gate"] == "source_coverage")
    assert covered_source_gate["status"] == "passed"
    assert covered_source_gate["metrics"]["courseRequirementCoverageRatio"] >= 0.8
    assert "benchmarkCount" in covered_source_gate["metrics"]
    assert "sourceSlotPrimaryCoverageRatio" in covered_report["metrics"]


def test_course_quality_reports_vertical_understanding_dimension() -> None:
    course = read_fixture("valid-course.json")
    course["prerequisites"] = ["Basic computer literacy"]
    metadata = dict(course.get("metadata") or {})
    metadata["requirementOrigins"] = [
        {
            "requirementId": "req-http",
            "title": "HTTP",
            "importance": "required",
            "originType": "common_academic_requirement",
            "evidenceRefs": ["source-mdn-http"],
            "benchmarkIds": ["benchmark-web101"],
            "frequency": 1,
        }
    ]
    metadata["sourceSlots"] = [
        {
            "requiredConceptId": "req-http",
            "primarySourceId": "source-mdn-http",
            "fallbackSourceIds": ["source-web-dev"],
            "replacementPolicy": "review_required",
        }
    ]
    course["metadata"] = metadata
    first_learn = course["modules"][0]["sections"][0]["content"][0]
    first_learn["value"] = (
        f"{first_learn['value']} This foundation builds on prerequisites before moving to deeper tradeoff reasoning. "
        "Learners practice with an exercise, assess mastery with a quiz, and produce portfolio evidence."
    )

    report = assess_course_quality(course, gate="publish")
    vertical = next(dimension for dimension in report["evals"]["dimensions"] if dimension["key"] == "vertical_understanding")

    assert vertical["status"] == "passed"
    assert vertical["metrics"]["hasPrerequisiteSignal"] == 1
    assert vertical["metrics"]["requirementOriginCount"] == 1
    assert vertical["metrics"]["sourceSlotCount"] == 1
