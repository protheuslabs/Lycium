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


def test_staged_agent_labels_outline_source_by_available_evidence_quality() -> None:
    source_corpus_without_packet_quality = SourceCorpusPreflight(
        synthesis={"workflowGate": "source_corpus_preflight"},
        source_urls=["https://example.edu/open-chemistry"],
        source_documents=[{"url": "https://example.edu/open-chemistry", "text": "Stoichiometry and mole ratios."}],
    )
    source_corpus_with_packet_quality = SourceCorpusPreflight(
        synthesis={"sourcePacket": {"quality": {"status": "usable", "conceptCoverageRatio": 1}}},
        source_urls=["https://example.edu/open-chemistry"],
        source_documents=[{"url": "https://example.edu/open-chemistry", "text": "Stoichiometry and mole ratios."}],
    )

    assert _outline_planning_source(None, source_corpus_without_packet_quality) == "source_corpus_outline"
    assert _outline_planning_source(None, source_corpus_with_packet_quality) == "source_packet_outline"
    assert _outline_planning_source({"contract_version": "source-packet-v1"}, source_corpus_without_packet_quality) == "source_packet_outline"


def test_outline_section_constraints_drive_lesson_generation_inputs() -> None:
    module_outline = {
        "id": "module-1",
        "title": "Module 1",
        "sourceIds": ["input-source-1", "input-source-2"],
        "sections": [
            {
                "id": "section-1",
                "title": "Evidence-scoped lesson",
                "concept_keywords": ["stoichiometry", "mole ratio"],
                "sourceIds": ["input-source-2"],
            },
            {"id": "quiz-1", "title": "Quiz: Module 1", "sectionType": "assessment"},
        ],
    }

    lesson_outlines = _module_lesson_outlines(module_outline)
    section = _coerce_generated_section(
        {
            "id": "model-section",
            "title": "Model section",
            "sourceIds": ["bad-source", "input-source-2"],
            "content": [],
        },
        fallback_id="fallback",
        fallback_title="Fallback",
        page_type="learn",
        section_type="lesson",
        source_ids=["input-source-2"],
    )

    assert lesson_outlines == [module_outline["sections"][0]]
    assert section["sourceIds"] == ["input-source-2"]


def test_generated_sections_record_outline_metadata_for_review() -> None:
    section = _with_generation_outline_metadata(
        {"id": "section-1", "title": "Generated section", "metadata": {"existing": True}},
        module_outline={
            "id": "module-1",
            "title": "Module 1",
            "planningSource": "source_packet",
        },
        section_outline={
            "id": "outline-section-1",
            "title": "Outline section",
            "concept_keywords": ["stoichiometry", "mole ratio"],
            "learning_objectives": ["Balance simple chemical equations."],
            "planningSource": "source_packet",
        },
        source_ids=["input-source-2"],
        role="lesson",
    )
    metadata = section["metadata"]["generationOutline"]

    assert section["metadata"]["existing"] is True
    assert metadata["contractVersion"] == "section-generation-outline-v1"
    assert metadata["planningSource"] == "source_packet"
    assert metadata["moduleOutlineId"] == "module-1"
    assert metadata["sectionOutlineId"] == "outline-section-1"
    assert metadata["plannedConceptKeywords"] == ["stoichiometry", "mole ratio"]
    assert metadata["plannedLearningObjectives"] == ["Balance simple chemical equations."]
    assert metadata["plannedSourceIds"] == ["input-source-2"]


def test_source_packet_outline_uses_real_source_concept_phrases() -> None:
    outline = build_outline_from_source_packet(
        prompt="Create a biology foundations course",
        desired_module_count=2,
        sections_per_module=2,
        source_packet={
            "contract_version": "source-packet-v1",
            "source_documents": [
                {
                    "title": "Open Biology Notes",
                    "url": "https://example.edu/biology",
                    "text": "Cell structure, membrane transport, protein synthesis, and enzyme kinetics are core biology concepts.",
                }
            ],
        },
    )

    keywords = [
        keyword
        for module in outline["modules"]
        for section in module["sections"]
        for keyword in section["concept_keywords"]
    ]

    assert "cell structure" in keywords
    assert "membrane transport" in keywords
    assert "protein synthesis" in keywords
    assert "enzyme kinetics" in keywords
    assert all(keyword != "foundations" for keyword in keywords)
    assert outline["provenance"]["conceptCandidateCount"] >= 4


def test_source_packet_outline_filters_book_front_matter_noise() -> None:
    outline = build_outline_from_source_packet(
        prompt="Create a machine learning systems course",
        desired_module_count=2,
        sections_per_module=2,
        source_packet={
            "contract_version": "source-packet-v1",
            "source_documents": [
                {
                    "title": "Machine Learning Systems",
                    "url": "artifact://machine-learning-systems",
                    "text": (
                        "Table of contents. Self check answers. Summary. Purpose. Pitfalls. "
                        "Machine learning systems connect data pipelines, model training, deployment monitoring, "
                        "reliability engineering, feature stores, and production inference."
                    ),
                }
            ],
        },
    )

    keywords = [
        keyword
        for module in outline["modules"]
        for section in module["sections"]
        for keyword in section["concept_keywords"]
    ]
    keyword_blob = " ".join(keywords)

    assert "self check answers" not in keyword_blob
    assert "table contents" not in keyword_blob
    assert "model training" in keywords
    assert any(keyword in keywords for keyword in ("deployment monitoring", "reliability engineering", "feature stores"))


def test_source_packet_outline_prefers_document_title_for_attachment_prompt() -> None:
    outline = build_outline_from_source_packet(
        prompt=(
            "Create an undergraduate course based on the attached Machine Learning Systems PDF. "
            "Focus on architecture, data, training, evaluation, deployment, scaling, monitoring, "
            "and operational tradeoffs of production machine learning systems."
        ),
        desired_module_count=3,
        sections_per_module=2,
        source_packet={
            "contract_version": "source-packet-v1",
            "source_documents": [
                {
                    "title": "Machine Learning Systems.pdf",
                    "filename": "Machine Learning Systems.pdf",
                    "url": "artifact://machine-learning-systems",
                    "text": (
                        "Machine learning systems cover data pipelines, model training, evaluation, "
                        "deployment, monitoring, scaling, reliability engineering, and production inference."
                    ),
                }
            ],
        },
    )

    assert outline["title"] == "Machine Learning Systems"
    assert outline["shortDescription"] == "Draft outline derived from source packet evidence for Machine Learning Systems."
    assert "attached" not in outline["title"].lower()
    assert "pdf" not in outline["title"].lower()

