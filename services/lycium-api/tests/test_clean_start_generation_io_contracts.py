from __future__ import annotations

import base64
from typing import Any

from fastapi.testclient import TestClient

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


def test_file_input_reader_extracts_multiple_browser_file_payloads() -> None:
    markdown_bytes = b"# Chemistry lab notes\n\nStoichiometry, titration, and equilibrium are connected."
    result = read_generation_input_files(
        [
            {
                "filename": "chemistry-notes.md",
                "mimeType": "text/markdown",
                "base64": base64.b64encode(markdown_bytes).decode("ascii"),
            },
            {
                "filename": "lab-outline.txt",
                "mimeType": "text/plain",
                "text": "Spectroscopy, concentration, calibration curves, and uncertainty analysis.",
            },
            {
                "filename": "archive.bin",
                "mimeType": "application/octet-stream",
                "base64": base64.b64encode(b"not readable course text").decode("ascii"),
            },
        ]
    )

    artifacts = result["artifacts"]

    assert result["contractVersion"] == "lycium-file-reader-v1"
    assert result["replaceableBy"] == "infring-os-file-reader"
    assert result["artifactCount"] == 3
    assert result["extractedArtifactCount"] == 2
    assert artifacts[0]["kind"] == "markdown"
    assert artifacts[0]["extractionStatus"] == "extracted"
    assert artifacts[0]["sourceDocumentUrl"].startswith("artifact://")
    assert "Stoichiometry" in artifacts[0]["extractedText"]
    assert artifacts[1]["kind"] == "text"
    assert artifacts[1]["contentHash"]
    assert artifacts[2]["extractionStatus"] == "unsupported"
    assert artifacts[2]["extractionWarnings"] == ["unsupported_file_kind:unknown"]


def test_input_artifacts_read_endpoint_returns_generation_ready_artifacts(client: TestClient) -> None:
    response = client.post(
        "/v1/input-artifacts/read",
        json={
            "files": [
                {
                    "filename": "uploaded-chemistry-notes.txt",
                    "mimeType": "text/plain",
                    "base64": base64.b64encode(
                        b"General chemistry notes covering stoichiometry, titration, and equilibrium."
                    ).decode("ascii"),
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    artifact = payload["artifacts"][0]

    assert payload["contractVersion"] == "lycium-file-reader-v1"
    assert payload["artifactCount"] == 1
    assert payload["extractedArtifactCount"] == 1
    assert artifact["extractionStatus"] == "extracted"
    assert artifact["sourceDocumentUrl"].startswith("artifact://")
    assert artifact["reader"]["adapter"] == "lycium-local"
    assert "stoichiometry" in artifact["extractedText"].lower()


def test_file_input_artifacts_enter_source_corpus_as_generation_evidence() -> None:
    reader_result = read_generation_input_files(
        [
            {
                "filename": "stoichiometry-notes.txt",
                "mimeType": "text/plain",
                "text": (
                    "Stoichiometry uses mole ratios, limiting reagents, and balanced equations "
                    "to connect chemistry quantities in general chemistry problem solving."
                ),
            },
            {
                "filename": "equilibrium-lab.md",
                "mimeType": "text/markdown",
                "text": (
                    "Equilibrium constants, titration curves, spectroscopy, concentration, "
                    "and calibration are chemistry lab concepts."
                ),
            },
        ]
    )

    corpus = compile_generation_source_corpus(
        prompt=(
            "Create a chemistry course about stoichiometry, mole ratios, limiting reagents, "
            "balanced equations, equilibrium constants, titration curves, spectroscopy, "
            "concentration, and calibration."
        ),
        source_urls=[],
        fetch_sources=False,
        input_artifacts=reader_result["artifacts"],
    )

    assert corpus.synthesis["metrics"]["submittedInputArtifactCount"] == 2
    assert corpus.synthesis["metrics"]["usableInputArtifactCount"] == 2
    assert corpus.synthesis["metrics"]["includedInputArtifactCount"] == 2
    assert corpus.source_urls == [
        reader_result["artifacts"][0]["sourceDocumentUrl"],
        reader_result["artifacts"][1]["sourceDocumentUrl"],
    ]
    assert len(corpus.source_documents) == 2
    assert all(document["fetchStatus"] == "provided" for document in corpus.source_documents)
    assert all(document["inputArtifactId"] for document in corpus.source_documents)


def test_file_backed_source_corpus_can_seed_stage_source_context() -> None:
    reader_result = read_generation_input_files(
        [
            {
                "filename": "biology-module.txt",
                "mimeType": "text/plain",
                "text": (
                    "Cell structure includes membranes, organelles, ribosomes, protein synthesis, "
                    "enzyme kinetics, and membrane transport."
                ),
            }
        ]
    )
    corpus = compile_generation_source_corpus(
        prompt="Create a biology course about cell structure and membrane transport.",
        source_urls=[],
        fetch_sources=False,
        input_artifacts=reader_result["artifacts"],
    )
    source_records = [
        {"id": source["sourceId"], "title": "Input artifact", "url": source["url"]}
        for source in corpus.synthesis["includedSources"]
    ]
    source_context_index = build_source_context_index(
        source_documents=corpus.source_documents,
        source_records=source_records,
    )
    source_context = compact_source_context_for_stage(
        source_context_index=source_context_index,
        source_ids=["input-source-1"],
        query_values=["membrane transport and protein synthesis"],
        total_char_budget=900,
        per_source_char_budget=700,
    )

    assert source_context is not None
    assert source_context["sources"][0]["inputArtifactId"] == reader_result["artifacts"][0]["id"]
    assert source_context["sources"][0]["inputArtifactKind"] == "text"
    assert "membrane transport" in source_context["sources"][0]["excerpt"]
