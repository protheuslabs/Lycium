from __future__ import annotations

from typing import Any

from app.course_agent_assembly import _coerce_generated_section, _module_lesson_outlines
from app.course_agent_response import extract_message_content
from app.course_agent_types import CourseAgentError
from app.course_build_tasks import (
    transition_course_build_task_from_outline,
    transition_course_build_task_from_quality_report,
)
from app.course_build_task_resume import apply_course_build_resume_inputs
from app.course_agent_staged import (
    _course_build_outline_plan_from_resume_course,
    _course_build_outline_plan_from_source_packet,
    _outline_planning_source,
    _source_packet_for_outline,
    generate_course_with_agent_staged,
)
from app.course_agent_staged_support import _with_generation_outline_metadata
from app.course_agent_source_context import build_source_context_index, compact_source_context_for_stage
from app.file_input_reader import read_generation_input_files
from app.course_outline_from_source_packet import build_outline_from_source_packet
from app.course_source_gaps import _attach_source_index_suggestions
from app.course_agent_contract import validate_course_contract
from app.course_quality import assess_course_quality
from app.course_quality_evals import run_course_quality_evals
from app.source_packet_quality_gate import source_packet_quality_gate
from app.source_corpus import SourceCorpusPreflight, compile_generation_source_corpus
from tests.course_generation_fixture_builders import (
    source_backed_course_from_scenario,
    under_sourced_course_draft_from_scenario,
)


EDITOR_NATIVE_BLOCK_TYPES = {"text", "heading", "conceptCard", "video", "iframe", "quiz"}


def _content_blocks(course: dict[str, Any]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    for module in course.get("modules", []):
        if not isinstance(module, dict):
            continue
        for section in module.get("sections", []):
            if not isinstance(section, dict):
                continue
            blocks.extend(block for block in section.get("content", []) if isinstance(block, dict))
    return blocks


def _without_source_refs(value: Any) -> Any:
    if isinstance(value, list):
        return [_without_source_refs(item) for item in value]
    if isinstance(value, dict):
        return {
            key: _without_source_refs(item)
            for key, item in value.items()
            if key not in {"sourceIds", "sourceRecords"}
        }
    return value


def test_strict_source_packet_gate_blocks_publishable_full_course_claims_without_packet() -> None:
    gate = source_packet_quality_gate({}, require_source_packet=True)

    assert gate is not None
    assert gate["status"] == "failed"
    assert gate["gate"] == "source_packet_quality"
    assert "source packet is required" in gate["issues"][0]["message"].lower()


def test_source_packet_gate_reports_uncovered_concepts_for_targeted_source_gaps() -> None:
    gate = source_packet_quality_gate(
        {
            "sourcePacket": {
                "quality": {
                    "conceptCoverageRatio": 0.25,
                    "conceptCandidateCount": 4,
                    "coveredConceptCandidateCount": 1,
                    "uncoveredConceptCandidates": ["inflation", "monetary policy", "aggregate demand"],
                }
            }
        }
    )

    assert gate is not None
    assert gate["status"] == "failed"
    assert gate["artifacts"]["conceptCoverageRatio"] == 0.25
    assert gate["artifacts"]["uncoveredConceptCandidates"] == [
        "inflation",
        "monetary policy",
        "aggregate demand",
    ]
    assert {row["concept"] for row in gate["artifacts"]["conceptCoverage"]} == {
        "inflation",
        "monetary policy",
        "aggregate demand",
    }


def test_source_gap_suggestions_query_source_index_for_missing_concepts(monkeypatch) -> None:
    calls: list[dict[str, Any]] = []

    def fake_search(session: object, *, query: str, filters: dict[str, Any] | None = None, limit: int = 12) -> dict[str, Any]:
        calls.append({"query": query, "filters": filters, "limit": limit})
        return {
            "results": [
                {
                    "source": {
                        "public_id": "source-open-inflation",
                        "canonical_url": "https://example.edu/economics/inflation",
                        "title": "Open Inflation Notes",
                        "source_type": "open_courseware",
                    },
                    "score": 0.93,
                    "matched_terms": ["inflation", "macroeconomics"],
                    "evidence_refs": ["source-open-inflation"],
                    "summary": "Inflation lecture notes and examples.",
                }
            ]
        }

    monkeypatch.setattr("app.course_source_gaps.search_index_response", fake_search)
    gap = {
        "conceptSourceNeeds": [
            {
                "concept": "inflation",
                "location": "Module 2",
                "sectionId": "lesson-inflation",
                "suggestedQueries": ["macroeconomics inflation open textbook"],
            }
        ]
    }

    suggestions = _attach_source_index_suggestions(object(), title="Macroeconomics Principles", gap=gap)
    need = gap["conceptSourceNeeds"][0]

    assert calls[0]["query"] == "macroeconomics inflation open textbook"
    assert calls[0]["filters"] == {"free_only": True, "topics": ["inflation"]}
    assert suggestions[0]["concept"] == "inflation"
    assert need["sourceIndexSearchStatus"] == "searched"
    assert need["sourceIndexCandidates"][0]["url"] == "https://example.edu/economics/inflation"
    assert need["sourceIndexCandidates"][0]["sourceId"] == "source-open-inflation"


def test_under_sourced_generation_fixture_stays_as_review_marked_best_effort_draft() -> None:
    draft = under_sourced_course_draft_from_scenario()

    assert draft["status"] == "needs_sources"
    assert draft["metadata"]["status"] == "needs_sources"
    assert draft["metadata"]["sourceGaps"][0]["severity"] == "blocking"
    assert draft["modules"][0]["sections"][0]["sectionType"] == "lesson"
    assert all(block.get("type") != "quiz" for block in _content_blocks(draft))


def test_needs_sources_generation_save_allows_complete_zero_source_course() -> None:
    course = _without_source_refs(source_backed_course_from_scenario("intro-programming-foundations"))
    course["sourceIds"] = []
    course["sourceRecords"] = []
    course["status"] = "needs_sources"
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    course["metadata"] = {
        **metadata,
        "status": "needs_sources",
        "generationReadiness": {"status": "needs_sources", "ready": False},
    }

    validation_errors = validate_course_contract(course)
    generation_quality = assess_course_quality(course, gate="generation")
    publish_quality = assess_course_quality(course, gate="publish")

    assert not validation_errors
    assert generation_quality["passed"] is True
    assert publish_quality["passed"] is False


def test_generated_course_fixture_uses_editor_native_blocks_only() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    block_types = {str(block.get("type")) for block in _content_blocks(course)}

    assert block_types <= EDITOR_NATIVE_BLOCK_TYPES
    assert "conceptCards" not in block_types


def test_publishable_source_backed_policy_requires_packet_quality_evidence() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["metadata"]["sourceCoveragePolicy"] = {"requireSourcePacketForPublishableCourses": True}
    failed = run_course_quality_evals(course)
    source_dimension = next(dimension for dimension in failed["dimensions"] if dimension["key"] == "source_grounding")

    assert failed["status"] == "failed"
    assert source_dimension["status"] == "failed"
    assert any("source-packet evidence" in finding["message"] for finding in source_dimension["findings"])

    course["metadata"]["sourceCorpusSynthesis"]["sourcePacket"] = {
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1,
            "conceptCandidateCount": 6,
            "coveredConceptCandidateCount": 6,
            "uncoveredConceptCandidates": [],
        }
    }
    passed = run_course_quality_evals(course)
    passed_source_dimension = next(dimension for dimension in passed["dimensions"] if dimension["key"] == "source_grounding")

    assert passed_source_dimension["status"] != "failed"


def test_outline_ready_task_advances_to_section_generation_ready_with_valid_outline() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "intro-course",
        "title": "Intro Course",
        "status": "outline_ready",
        "currentStage": "outline_ready",
        "nextAction": "generate_course_outline",
        "requiredInputs": ["course_outline"],
    }
    outline = {
        "modules": [
            {
                "title": "Module 1: Foundations",
                "sections": [
                    {
                        "title": "Core idea",
                        "learning_objectives": ["Explain the core idea."],
                        "concept_keywords": ["core idea"],
                    },
                    {
                        "title": "Applied practice",
                        "learning_objectives": ["Apply the core idea."],
                        "concept_keywords": ["practice"],
                    },
                ],
            }
        ]
    }

    transitioned = transition_course_build_task_from_outline(task, outline=outline)

    assert transitioned["status"] == "section_generation_ready"
    assert transitioned["nextAction"] == "generate_course_sections"
    assert transitioned["transitionStatus"] == "advanced"
    assert transitioned["outlineReadiness"]["passed"] is True


def test_outline_ready_task_stays_blocked_when_outline_is_too_thin() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "thin-course",
        "title": "Thin Course",
        "status": "outline_ready",
        "currentStage": "outline_ready",
    }
    outline = {
        "modules": [
            {
                "title": "Module 1",
                "sections": [{"title": "Only title"}],
            }
        ]
    }

    transitioned = transition_course_build_task_from_outline(task, outline=outline)

    assert transitioned["status"] == "outline_ready"
    assert transitioned["nextAction"] == "revise_course_outline"
    assert transitioned["transitionStatus"] == "blocked"
    assert transitioned["outlineReadiness"]["passed"] is False
    assert transitioned["outlineReadiness"]["issues"]


def test_section_generation_ready_task_advances_to_ready_for_review_with_passing_quality_report() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "generated-course",
        "title": "Generated Course",
        "status": "section_generation_ready",
        "currentStage": "section_generation_ready",
    }
    quality_report = {
        "passed": True,
        "score": 0.92,
        "errors": [],
        "gates": [
            {"gate": "source_analysis", "status": "passed"},
            {"gate": "quality_eval", "status": "passed"},
            {"gate": "review_publish", "status": "passed"},
        ],
        "evals": {
            "dimensions": [
                {"key": "source_grounding", "status": "passed"},
                {"key": "specificity", "status": "passed"},
            ]
        },
    }

    transitioned = transition_course_build_task_from_quality_report(task, quality_report=quality_report)

    assert transitioned["status"] == "ready_for_review"
    assert transitioned["nextAction"] == "review_and_publish"
    assert transitioned["transitionStatus"] == "advanced"
    assert transitioned["reviewReadiness"]["passed"] is True


def test_section_generation_ready_task_stays_blocked_when_quality_gates_fail() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "generated-course",
        "title": "Generated Course",
        "status": "section_generation_ready",
        "currentStage": "section_generation_ready",
    }
    quality_report = {
        "passed": False,
        "score": 0.48,
        "errors": ["Inline citations are missing local source support."],
        "gates": [{"gate": "source_analysis", "status": "failed"}],
        "evals": {"dimensions": [{"key": "source_grounding", "status": "failed"}]},
    }

    transitioned = transition_course_build_task_from_quality_report(task, quality_report=quality_report)

    assert transitioned["status"] == "section_generation_ready"
    assert transitioned["nextAction"] == "repair_generated_sections"
    assert transitioned["transitionStatus"] == "blocked"
    assert transitioned["reviewReadiness"]["passed"] is False
    assert transitioned["reviewReadiness"]["metrics"]["failedGateCount"] == 2
