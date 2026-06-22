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


def test_course_quality_evals_compare_generated_sections_to_outline_concepts() -> None:
    course = {
        "title": "Outline Coverage Course",
        "sourceRecords": [{"id": "input-source-1", "title": "Open notes", "url": "https://example.edu"}],
        "sourceIds": ["input-source-1"],
        "modules": [
            {
                "id": "module-1",
                "title": "Module 1",
                "sourceIds": ["input-source-1"],
                "sections": [
                    {
                        "id": "section-1",
                        "title": "Stoichiometry",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["input-source-1"],
                        "metadata": {
                            "generationOutline": {
                                "plannedConceptKeywords": ["stoichiometry", "mole ratio", "foundations"],
                                "plannedSourceIds": ["input-source-1"],
                            }
                        },
                        "content": [
                            {
                                "type": "text",
                                "heading": "Explanation",
                                "value": "Stoichiometry uses a mole ratio to connect balanced reactions to quantities.",
                            },
                            {"type": "heading", "title": "Concepts introduced"},
                            {
                                "type": "conceptCard",
                                "title": "Stoichiometry",
                                "description": "Using reaction coefficients to relate amounts of substances.",
                                "sourceIds": ["input-source-1"],
                            },
                        ],
                    },
                    {
                        "id": "quiz-1",
                        "title": "Quiz",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": ["input-source-1"],
                        "content": [{"type": "quiz", "questions": []}],
                    },
                    {
                        "id": "summary-1",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["input-source-1"],
                        "content": [{"type": "heading", "title": "Module concepts"}],
                    },
                ],
            }
        ],
    }

    passed = run_course_quality_evals(course)
    passed_outline = next(dimension for dimension in passed["dimensions"] if dimension["key"] == "generation_outline_coverage")
    course["modules"][0]["sections"][0]["content"][0]["value"] = "This lesson discusses unrelated laboratory safety habits."
    course["modules"][0]["sections"][0]["content"][2]["title"] = "Laboratory safety"
    failed = run_course_quality_evals(course)
    failed_outline = next(dimension for dimension in failed["dimensions"] if dimension["key"] == "generation_outline_coverage")

    assert passed_outline["status"] == "passed"
    assert passed_outline["metrics"]["coverageRatio"] == 1
    assert failed_outline["status"] == "failed"
    assert "stoichiometry" in failed_outline["findings"][0]["message"]


def test_course_quality_evals_require_persisted_outline_for_source_packet_planning() -> None:
    course = {
        "title": "Outline Persistence Course",
        "sourceRecords": [{"id": "input-source-1", "title": "Open notes", "url": "https://example.edu"}],
        "sourceIds": ["input-source-1"],
        "metadata": {
            "generationPlan": {
                "planningSource": "source_packet_outline",
            }
        },
        "modules": [
            {
                "id": "module-1",
                "title": "Module 1",
                "sections": [
                    {
                        "id": "section-1",
                        "title": "Stoichiometry",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["input-source-1"],
                        "metadata": {
                            "generationOutline": {
                                "plannedConceptKeywords": ["stoichiometry"],
                                "plannedSourceIds": ["input-source-1"],
                            }
                        },
                        "content": [{"type": "text", "value": "Stoichiometry connects reactions to quantities."}],
                    },
                    {
                        "id": "summary-1",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["input-source-1"],
                        "content": [{"type": "heading", "title": "Module concepts"}],
                    },
                ],
            }
        ],
    }

    failed = run_course_quality_evals(course)
    failed_outline = next(dimension for dimension in failed["dimensions"] if dimension["key"] == "generation_outline_coverage")
    course["metadata"]["courseBuildOutline"] = {
        "contractVersion": "course-outline-from-source-packet-v1",
        "modules": [{"title": "Module 1", "sections": [{"title": "Stoichiometry"}]}],
    }
    passed = run_course_quality_evals(course)
    passed_outline = next(dimension for dimension in passed["dimensions"] if dimension["key"] == "generation_outline_coverage")

    assert failed_outline["status"] == "failed"
    assert failed_outline["metrics"]["hasCourseBuildOutline"] == 0
    assert "metadata.courseBuildOutline" in failed_outline["findings"][0]["message"]
    assert passed_outline["metrics"]["hasCourseBuildOutline"] == 1
    assert not any("metadata.courseBuildOutline" in finding["message"] for finding in passed_outline["findings"])


def test_course_quality_evals_require_source_packet_quality_for_source_packet_planning() -> None:
    course = {
        "title": "Source Quality Persistence Course",
        "sourceRecords": [{"id": "input-source-1", "title": "Open notes", "url": "https://example.edu"}],
        "sourceIds": ["input-source-1"],
        "metadata": {
            "generationPlan": {"planningSource": "source_packet_outline"},
            "courseBuildOutline": {
                "contractVersion": "course-outline-from-source-packet-v1",
                "modules": [{"title": "Module 1", "sections": [{"title": "Stoichiometry"}]}],
            },
        },
        "modules": [
            {
                "id": "module-1",
                "title": "Module 1",
                "sections": [
                    {
                        "id": "section-1",
                        "title": "Stoichiometry",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["input-source-1"],
                        "metadata": {"generationOutline": {"plannedConceptKeywords": ["stoichiometry"]}},
                        "content": [{"type": "text", "value": "Stoichiometry connects reactions to quantities."}],
                    },
                    {
                        "id": "summary-1",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["input-source-1"],
                        "content": [{"type": "heading", "title": "Module concepts"}],
                    },
                ],
            }
        ],
    }

    failed = run_course_quality_evals(course)
    failed_sources = next(dimension for dimension in failed["dimensions"] if dimension["key"] == "source_grounding")
    course["metadata"]["sourceCorpusSynthesis"] = {
        "sourcePacket": {
            "quality": {
                "status": "usable",
                "conceptCoverageRatio": 1,
                "conceptCandidateCount": 1,
                "coveredConceptCandidateCount": 1,
                "uncoveredConceptCandidates": [],
            }
        }
    }
    passed = run_course_quality_evals(course)
    passed_sources = next(dimension for dimension in passed["dimensions"] if dimension["key"] == "source_grounding")

    assert failed_sources["status"] == "failed"
    assert any("source-packet quality evidence" in finding["message"] for finding in failed_sources["findings"])
    assert not any("source-packet quality evidence" in finding["message"] for finding in passed_sources["findings"])


def test_course_quality_evals_accept_source_corpus_outline_without_packet_quality() -> None:
    course = {
        "title": "Source Corpus Outline Course",
        "sourceRecords": [{"id": "input-source-1", "title": "Open notes", "url": "https://example.edu"}],
        "sourceIds": ["input-source-1"],
        "metadata": {
            "generationPlan": {"planningSource": "source_corpus_outline"},
            "sourceCorpusSynthesis": {"workflowGate": "source_corpus_preflight"},
            "courseBuildOutline": {
                "contractVersion": "course-outline-from-source-packet-v1",
                "modules": [{"title": "Module 1", "sections": [{"title": "Stoichiometry", "sourceIds": ["input-source-1"]}]}],
            },
        },
        "modules": [
            {
                "id": "module-1",
                "title": "Module 1",
                "sections": [
                    {
                        "id": "section-1",
                        "title": "Stoichiometry",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["input-source-1"],
                        "metadata": {
                            "generationOutline": {
                                "plannedConceptKeywords": ["stoichiometry"],
                                "plannedSourceIds": ["input-source-1"],
                            }
                        },
                        "content": [{"type": "text", "value": "Stoichiometry connects reactions to quantities."}],
                    },
                    {
                        "id": "summary-1",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["input-source-1"],
                        "content": [{"type": "heading", "title": "Module concepts"}],
                    },
                ],
            }
        ],
    }

    report = run_course_quality_evals(course)
    outline = next(dimension for dimension in report["dimensions"] if dimension["key"] == "generation_outline_coverage")
    sources = next(dimension for dimension in report["dimensions"] if dimension["key"] == "source_grounding")

    assert outline["metrics"]["hasCourseBuildOutline"] == 1
    assert outline["metrics"]["sourceAlignmentRatio"] == 1
    assert not any("source-packet quality evidence" in finding["message"] for finding in sources["findings"])


def test_course_quality_evals_require_outline_source_ids_to_be_declared() -> None:
    course = {
        "title": "Outline Source Integrity Course",
        "sourceRecords": [{"id": "input-source-1", "title": "Open notes", "url": "https://example.edu"}],
        "sourceIds": ["input-source-1"],
        "metadata": {
            "generationPlan": {"planningSource": "source_packet_outline"},
            "sourceCorpusSynthesis": {"sourcePacket": {"quality": {"status": "usable", "conceptCoverageRatio": 1}}},
            "courseBuildOutline": {
                "contractVersion": "course-outline-from-source-packet-v1",
                "modules": [
                    {
                        "title": "Module 1",
                        "sourceIds": ["input-source-2"],
                        "sections": [{"title": "Stoichiometry", "sourceIds": ["input-source-2"]}],
                    }
                ],
            },
        },
        "modules": [
            {
                "id": "module-1",
                "title": "Module 1",
                "sections": [
                    {
                        "id": "section-1",
                        "title": "Stoichiometry",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["input-source-1"],
                        "metadata": {"generationOutline": {"plannedConceptKeywords": ["stoichiometry"]}},
                        "content": [{"type": "text", "value": "Stoichiometry connects reactions to quantities."}],
                    },
                    {
                        "id": "summary-1",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["input-source-1"],
                        "content": [{"type": "heading", "title": "Module concepts"}],
                    },
                ],
            }
        ],
    }

    failed = run_course_quality_evals(course)
    failed_outline = next(dimension for dimension in failed["dimensions"] if dimension["key"] == "generation_outline_coverage")
    course["sourceRecords"].append({"id": "input-source-2", "title": "More notes", "url": "https://example.edu/more"})
    passed = run_course_quality_evals(course)
    passed_outline = next(dimension for dimension in passed["dimensions"] if dimension["key"] == "generation_outline_coverage")

    assert failed_outline["status"] == "failed"
    assert failed_outline["metrics"]["missingOutlineSourceIdCount"] == 1
    assert "input-source-2" in failed_outline["findings"][0]["message"]
    assert passed_outline["metrics"]["missingOutlineSourceIdCount"] == 0


def test_course_quality_evals_require_sections_to_keep_planned_source_ids() -> None:
    course = {
        "title": "Section Source Alignment Course",
        "sourceRecords": [
            {"id": "input-source-1", "title": "Open notes", "url": "https://example.edu"},
            {"id": "input-source-2", "title": "Focused notes", "url": "https://example.edu/focused"},
        ],
        "sourceIds": ["input-source-1", "input-source-2"],
        "metadata": {
            "generationPlan": {"planningSource": "source_packet_outline"},
            "sourceCorpusSynthesis": {"sourcePacket": {"quality": {"status": "usable", "conceptCoverageRatio": 1}}},
            "courseBuildOutline": {
                "contractVersion": "course-outline-from-source-packet-v1",
                "modules": [{"title": "Module 1", "sections": [{"title": "Stoichiometry", "sourceIds": ["input-source-2"]}]}],
            },
        },
        "modules": [
            {
                "id": "module-1",
                "title": "Module 1",
                "sections": [
                    {
                        "id": "section-1",
                        "title": "Stoichiometry",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["input-source-1"],
                        "metadata": {
                            "generationOutline": {
                                "plannedConceptKeywords": ["stoichiometry"],
                                "plannedSourceIds": ["input-source-2"],
                            }
                        },
                        "content": [{"type": "text", "value": "Stoichiometry connects reactions to quantities."}],
                    },
                    {
                        "id": "summary-1",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["input-source-1"],
                        "content": [{"type": "heading", "title": "Module concepts"}],
                    },
                ],
            }
        ],
    }

    failed = run_course_quality_evals(course)
    failed_outline = next(dimension for dimension in failed["dimensions"] if dimension["key"] == "generation_outline_coverage")
    course["modules"][0]["sections"][0]["sourceIds"] = ["input-source-2"]
    passed = run_course_quality_evals(course)
    passed_outline = next(dimension for dimension in passed["dimensions"] if dimension["key"] == "generation_outline_coverage")

    assert failed_outline["status"] == "failed"
    assert failed_outline["metrics"]["sourceAlignmentRatio"] == 0
    assert "input-source-2" in failed_outline["findings"][0]["message"]
    assert passed_outline["metrics"]["sourceAlignmentRatio"] == 1


def test_course_quality_evals_fail_inline_citations_without_local_source_support() -> None:
    course = {
        "title": "Inline Citation Source Course",
        "sourceRecords": [{"id": "source-1"}, {"id": "source-2"}],
        "sourceIds": ["source-1", "source-2"],
        "modules": [{"sections": [{"sourceIds": ["source-1"], "content": [{"type": "text", "value": "Stoichiometry uses mole ratios [2].", "sourceIds": ["source-1"]}]}]}],
    }

    report = run_course_quality_evals(course)
    sources = next(dimension for dimension in report["dimensions"] if dimension["key"] == "source_grounding")

    assert sources["status"] == "failed"
    assert sources["metrics"]["inlineCitationIssueCount"] == 1
    assert any("Inline citation markers" in finding["message"] for finding in sources["findings"])


def test_course_quality_evals_fail_sources_not_mapped_to_section_concepts() -> None:
    course = {
        "title": "Mapped Section Source Course",
        "sourceRecords": [{"id": "source-1"}, {"id": "source-2"}],
        "sourceIds": ["source-1", "source-2"],
        "metadata": {"sourceSlots": [{"requiredConceptId": "stoichiometry", "primarySourceId": "source-1"}]},
        "modules": [
            {
                "sections": [
                    {
                        "id": "stoichiometry-section",
                        "title": "Stoichiometry",
                        "sourceIds": ["source-2"],
                        "content": [
                            {"type": "text", "value": "Stoichiometry uses balanced equations.", "sourceIds": ["source-2"]},
                            {"type": "conceptCard", "title": "Stoichiometry", "description": "Mole-ratio reasoning.", "sourceIds": ["source-1"]},
                        ],
                    }
                ]
            }
        ],
    }

    report = run_course_quality_evals(course)
    sources = next(dimension for dimension in report["dimensions"] if dimension["key"] == "source_grounding")

    assert sources["status"] == "failed"
    assert any("not mapped to its concepts" in finding["message"] for finding in sources["findings"])


def test_agent_response_accepts_local_provider_response_fallback_text() -> None:
    content = extract_message_content(
        {"model": "kimi-k2.6:cloud", "response": '{"title":"Generated Course"}', "done": True},
        "ollama-chat",
    )

    assert content == '{"title":"Generated Course"}'
