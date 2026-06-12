from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from app.contract_validation import validate_course_schema
from app.course_agent_contract import validate_course_contract
from app.course_generation_workflow import run_course_generation_workflow
from app.course_health import summarize_course_health
from app.course_source_integrity import assess_course_source_integrity
from app.course_quality import assess_course_quality
from app.course_quality_evals import run_course_quality_evals
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


def test_source_integrity_counts_legacy_concept_card_block_source_ids_as_direct_coverage() -> None:
    course = {
        "title": "Source Coverage Test",
        "sourceIds": ["source-openstax"],
        "sourceRecords": [{"id": "source-openstax", "type": "textbook", "url": "https://example.edu/source"}],
        "modules": [
            {
                "title": "Module 1",
                "sourceIds": ["source-openstax"],
                "sections": [
                    {
                        "id": "section-stoichiometry",
                        "title": "Stoichiometry",
                        "sourceIds": ["source-openstax"],
                        "content": [
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "sourceIds": ["source-openstax"],
                                "concepts": [
                                    {"name": "Stoichiometry", "description": "Quantitative relationships in chemical reactions."},
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    }

    integrity = assess_course_source_integrity(course)

    assert integrity["metrics"]["conceptCount"] == 1
    assert integrity["metrics"]["directlyCoveredConceptCount"] == 1
    assert integrity["metrics"]["directConceptSourceCoveragePercent"] == 100
    assert integrity["conceptCoverage"][0]["status"] == "direct"
    assert integrity["conceptCoverage"][0]["directSourceIds"] == ["source-openstax"]
    assert integrity["metrics"]["sourceBearingBlockCount"] == 1
    assert integrity["metrics"]["directlySourcedBlockCount"] == 1
    assert integrity["blockCoverage"][0]["status"] == "direct"


def test_source_integrity_can_require_direct_concept_source_mappings() -> None:
    course = {
        "title": "Inherited Source Coverage Test",
        "sourceIds": ["source-openstax"],
        "sourceRecords": [{"id": "source-openstax", "type": "textbook", "url": "https://example.edu/source"}],
        "metadata": {"sourceCoveragePolicy": {"requireDirectConceptSourceMappings": True, "requireDirectBlockSourceMappings": True}},
        "modules": [
            {
                "title": "Module 1",
                "sourceIds": ["source-openstax"],
                "sections": [
                    {
                        "id": "section-stoichiometry",
                        "title": "Stoichiometry",
                        "sourceIds": ["source-openstax"],
                        "content": [
                            {
                                "type": "conceptCard",
                                "title": "Stoichiometry",
                                "description": "Quantitative relationships in chemical reactions.",
                            },
                        ],
                    },
                ],
            },
        ],
    }

    integrity = assess_course_source_integrity(course)

    assert integrity["metrics"]["conceptCount"] == 1
    assert integrity["metrics"]["directlyCoveredConceptCount"] == 0
    assert integrity["conceptCoverage"][0]["status"] == "inherited"
    assert integrity["conceptCoverage"][0]["sourceIds"] == ["source-openstax"]
    assert integrity["blockCoverage"][0]["status"] == "inherited"
    assert any("direct concept/block source mappings" in issue["message"] for issue in integrity["issues"])
    assert any("direct block sourceIds" in issue["message"] for issue in integrity["issues"])


def test_source_analysis_gate_exposes_concept_coverage_artifacts() -> None:
    course = read_fixture("valid-course.json")

    report = run_course_generation_workflow(course).model_dump()
    source_gate = next(gate for gate in report["gates"] if gate["gate"] == "source_analysis")

    assert source_gate["artifacts"]["conceptCoverage"]
    assert source_gate["artifacts"]["blockCoverage"]
    assert source_gate["artifacts"]["conceptCount"] >= len(source_gate["artifacts"]["conceptCoverage"])
    assert {"concept", "status", "sourceIds", "directSourceIds"} <= set(source_gate["artifacts"]["conceptCoverage"][0])
    assert {"block", "blockType", "status", "sourceIds", "directSourceIds"} <= set(source_gate["artifacts"]["blockCoverage"][0])


def test_source_grounding_eval_scores_direct_concept_and_block_coverage() -> None:
    course = {
        "title": "Inherited Source Coverage Test",
        "sourceIds": ["source-openstax"],
        "sourceRecords": [{"id": "source-openstax", "type": "textbook", "url": "https://example.edu/source"}],
        "modules": [
            {
                "title": "Module 1",
                "sourceIds": ["source-openstax"],
                "sections": [
                    {
                        "id": "section-stoichiometry",
                        "title": "Stoichiometry",
                        "sourceIds": ["source-openstax"],
                        "content": [
                            {"type": "text", "heading": "Explanation", "value": "A sourced explanation inherited from the section."},
                            {
                                "type": "conceptCard",
                                "title": "Stoichiometry",
                                "description": "Quantitative relationships in chemical reactions.",
                            },
                        ],
                    },
                ],
            },
        ],
    }

    evals = run_course_quality_evals(course)
    source_dimension = next(dimension for dimension in evals["dimensions"] if dimension["key"] == "source_grounding")

    assert source_dimension["metrics"]["directConceptSourceCoveragePercent"] == 0
    assert source_dimension["metrics"]["directBlockSourceCoveragePercent"] == 0
    assert any("inherited section/module sources" in finding["message"] for finding in source_dimension["findings"])
    assert any("direct sourceIds" in finding["message"] for finding in source_dimension["findings"])


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


def test_publish_readiness_requires_critical_gates_to_pass() -> None:
    course = deepcopy(read_fixture("valid-course.json"))
    first_quiz = next(
        block
        for module in course["modules"]
        for section in module["sections"]
        for block in section.get("content", [])
        if isinstance(block, dict) and block.get("type") == "quiz"
    )
    first_quiz["questions"] = first_quiz["questions"][:3]

    report = run_course_generation_workflow(course).model_dump()
    publish_gate = next(gate for gate in report["gates"] if gate["gate"] == "review_publish")

    assert publish_gate["status"] == "failed"
    assert publish_gate["artifacts"]["criticalGateBlockerCount"] >= 1
    assert any("Publish-critical gates must pass" in issue["message"] for issue in publish_gate["issues"])


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


def test_course_health_summary_combines_quality_sources_and_feedback() -> None:
    course = deepcopy(read_fixture("valid-course.json"))
    metadata = dict(course.get("metadata") or {})
    metadata["sourceGaps"] = [{"id": "missing-source", "severity": "blocking"}]
    course["metadata"] = metadata
    quality_report = assess_course_quality(course, gate="publish")
    feedback = {
        "course_title": course["title"],
        "rating": "down",
        "rating_events": [{"rating": "down"}],
        "feedback_notes": [{"rating": "down", "feedback_magnitude": 3, "text": "The source coverage is weak."}],
        "source_suggestions": [{"url": "https://example.edu/replacement"}],
        "updated_at": "2026-06-09T00:00:00+00:00",
    }

    health = summarize_course_health(
        course_key="test-course",
        course_title=course["title"],
        feedback=feedback,
        course=course,
        quality_report=quality_report,
        lifecycle_status="needs_revision",
    )

    assert health["contract_version"] == "course-health-v1"
    assert health["status"] == "needs_review"
    assert health["source_suggestion_count"] == 1
    assert health["feedback_note_count"] == 1
    assert health["artifact_metrics"]["source_gap_count"] == 1
    assert health["artifact_metrics"]["quality_score"] == quality_report["score"]
    assert any("source gap" in signal for signal in health["signals"])
