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


def test_agent_response_reports_unexpected_provider_shape_with_safe_trace() -> None:
    try:
        extract_message_content({"model": "kimi-k2.6:cloud", "done": True}, "ollama-chat")
    except CourseAgentError as exc:
        assert "usable text content" in str(exc)
        assert exc.trace["adapter"] == "ollama-chat"
        assert exc.trace["response_keys"] == ["done", "model"]
        assert "kimi-k2.6:cloud" in exc.trace["response_preview"]
    else:
        raise AssertionError("Expected CourseAgentError")


def test_agent_response_reports_provider_error_with_safe_trace() -> None:
    try:
        extract_message_content({"error": {"message": "model unavailable"}}, "openai-chat-completions")
    except CourseAgentError as exc:
        assert "error response" in str(exc)
        assert exc.trace["adapter"] == "openai-chat-completions"
        assert exc.trace["response_keys"] == ["error"]
        assert "model unavailable" in exc.trace["error_preview"]
    else:
        raise AssertionError("Expected CourseAgentError")


def test_stage_source_context_selects_relevant_bounded_excerpts() -> None:
    source_records = [
        {
            "id": "input-source-1",
            "title": "Fairness Source",
            "url": "artifact://fairness-book",
        }
    ]
    source_documents = [
        {
            "url": "artifact://fairness-book",
            "title": "Fairness Book",
            "text": "optimization gradients loss " * 200
            + " demographic parity equalized odds calibration fairness " * 80
            + " deployment monitoring logging " * 200,
            "inputArtifactId": "input-artifact-1-fairness-book",
        }
    ]

    source_context_index = build_source_context_index(
        source_documents=source_documents,
        source_records=source_records,
    )
    source_context = compact_source_context_for_stage(
        source_context_index=source_context_index,
        source_ids=["input-source-1"],
        query_values=["equalized odds and demographic parity"],
        total_char_budget=1_600,
        per_source_char_budget=900,
    )

    assert source_context is not None
    assert source_context["contractVersion"] == "course-generation-source-context-v1"
    assert source_context["sources"][0]["sourceId"] == "input-source-1"
    assert len(source_context["sources"][0]["excerpt"]) <= 900
    assert "equalized odds" in source_context["sources"][0]["excerpt"]
    assert "demographic" in source_context["sources"][0]["matchedTerms"]
