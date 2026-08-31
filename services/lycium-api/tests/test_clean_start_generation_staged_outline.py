from __future__ import annotations

from typing import Any

from app.course_agent_assembly import _module_lesson_outlines
from app.course_build_task_resume import apply_course_build_resume_inputs
from app.course_agent_staged import (
    _course_build_outline_plan_from_resume_course,
    _course_build_outline_plan_from_source_packet,
    _outline_planning_source,
    _source_packet_for_outline,
    generate_course_with_agent_staged,
)
from app.file_input_reader import read_generation_input_files
from app.source_corpus import SourceCorpusPreflight, compile_generation_source_corpus


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


def test_course_shell_resume_inputs_advance_through_build_task_chain() -> None:
    structure = {
        "title": "Generated Shell",
        "metadata": {
            "courseBuildTask": {
                "contractVersion": "course-build-task-v1",
                "courseId": "generated-shell",
                "title": "Generated Shell",
                "status": "source_gathering",
                "currentStage": "source_gathering",
                "nextAction": "attach_source_packet",
                "requiredInputs": ["source_packet", "concept_source_coverage"],
            }
        },
    }
    source_packet = {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1,
            "conceptCandidateCount": 2,
            "coveredConceptCandidateCount": 2,
            "uncoveredConceptCandidates": [],
        },
    }
    outline = {
        "modules": [
            {
                "title": "Module 1: Foundations",
                "sections": [
                    {
                        "title": "Concept one",
                        "learning_objectives": ["Explain concept one."],
                        "concept_keywords": ["concept one"],
                    },
                    {
                        "title": "Concept two",
                        "learning_objectives": ["Apply concept two."],
                        "concept_keywords": ["concept two"],
                    },
                ],
            }
        ]
    }
    quality_report = {
        "passed": True,
        "score": 0.91,
        "errors": [],
        "gates": [{"gate": "quality_eval", "status": "passed"}],
        "evals": {"dimensions": [{"key": "source_grounding", "status": "passed"}]},
    }

    resumed = apply_course_build_resume_inputs(
        structure,
        source_packet=source_packet,
        outline=outline,
        quality_report=quality_report,
    )
    task = resumed["metadata"]["courseBuildTask"]
    trace = resumed["metadata"]["courseBuildResumeTrace"]
    report = resumed["metadata"]["courseBuildResumeReport"]

    assert task["status"] == "ready_for_review"
    assert task["nextAction"] == "review_and_publish"
    assert [row["inputType"] for row in trace] == ["source_packet", "outline", "quality_report"]
    assert [row["toStatus"] for row in trace] == [
        "outline_ready",
        "section_generation_ready",
        "ready_for_review",
    ]
    assert report["contractVersion"] == "course-build-resume-report-v1"
    assert report["status"] == "ready_for_review"
    assert report["advancedTransitionCount"] == 3
    assert report["blockedTransitionCount"] == 0
    assert [row["contractVersion"] for row in report["transitionReports"]] == [
        "source-packet-transition-report-v1",
        "outline-transition-report-v1",
        "review-transition-report-v1",
    ]


def test_course_shell_resume_derives_outline_from_usable_source_packet() -> None:
    structure = {
        "title": "Source Packet Shell",
        "metadata": {
            "courseBuildTask": {
                "contractVersion": "course-build-task-v1",
                "courseId": "source-packet-shell",
                "title": "Source Packet Shell",
                "status": "source_gathering",
                "currentStage": "source_gathering",
            }
        },
    }
    source_packet = {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1,
            "conceptCandidateCount": 4,
            "coveredConceptCandidateCount": 4,
            "uncoveredConceptCandidates": [],
        },
        "source_documents": [
            {
                "title": "Open course notes",
                "url": "https://example.edu/course-notes",
                "text": "Cell structure, membrane transport, protein synthesis, and enzyme kinetics.",
            }
        ],
    }

    resumed = apply_course_build_resume_inputs(
        structure,
        prompt="Create a biology foundations course",
        source_packet=source_packet,
        desired_module_count=3,
    )
    task = resumed["metadata"]["courseBuildTask"]
    outline = resumed["metadata"]["courseBuildOutline"]
    trace = resumed["metadata"]["courseBuildResumeTrace"]
    report = resumed["metadata"]["courseBuildResumeReport"]

    assert task["status"] == "section_generation_ready"
    assert outline["contractVersion"] == "course-outline-from-source-packet-v1"
    assert len(outline["modules"]) == 3
    assert outline["modules"][0]["sourceIds"] == ["input-source-1"]
    assert outline["modules"][0]["sections"][0]["sourceIds"] == ["input-source-1"]
    assert all(len(module["sections"]) >= 2 for module in outline["modules"])
    assert [row["inputType"] for row in trace] == ["source_packet", "outline"]
    assert report["status"] == "section_generation_ready"
    assert report["transitionCount"] == 2
    assert report["latestInputType"] == "outline"


def test_staged_agent_can_use_course_build_outline_as_plan() -> None:
    resume_course = {
        "title": "Chemistry 105 shell",
        "shortDescription": "A source-backed draft shell.",
        "metadata": {
            "pacingLabel": "Module",
            "courseBuildOutline": {
                "contractVersion": "course-outline-from-source-packet-v1",
                "title": "Chemistry 105",
                "learningObjectives": ["Use stoichiometry to connect formulas and reactions."],
                "modules": [
                    {
                        "id": "module-1",
                        "title": "Atomic structure",
                        "objective": "Explain atoms, isotopes, and periodic patterns.",
                        "sections": [
                            {
                                "id": "section-1-1",
                                "title": "Atomic models",
                                "concept_keywords": ["atom", "isotope", "periodic trend"],
                                "sourceIds": ["source-1"],
                            }
                        ],
                    }
                ],
            },
        },
    }

    plan = _course_build_outline_plan_from_resume_course(resume_course)

    assert plan is not None
    assert plan["planningSource"] == "course_build_outline"
    assert plan["sourceOutlineContract"] == "course-outline-from-source-packet-v1"
    assert plan["title"] == "Chemistry 105"
    assert plan["pacingLabel"] == "Module"
    assert plan["modules"][0]["sections"][0]["concept_keywords"] == ["atom", "isotope", "periodic trend"]


def test_staged_agent_derives_initial_plan_from_source_packet_before_llm(monkeypatch) -> None:
    source_packet = {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1,
            "conceptCandidateCount": 4,
            "coveredConceptCandidateCount": 4,
            "uncoveredConceptCandidates": [],
        },
        "source_documents": [
            {
                "title": "Open chemistry notes",
                "url": "https://example.edu/chemistry",
                "text": "Stoichiometry, mole ratios, atomic structure, and periodic trends.",
            }
        ],
    }

    plan = _course_build_outline_plan_from_source_packet(
        prompt="Create Chemistry 105",
        source_packet=source_packet,
        desired_module_count=1,
    )

    assert plan is not None
    assert plan["planningSource"] == "source_packet_outline"

    def fail_plan_call(*args: Any, **kwargs: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        raise AssertionError("source-packet-backed generation should not call the plan LLM stage")

    def fake_module_bundle(**kwargs: Any) -> dict[str, Any]:
        module_outline = kwargs["module_outline"]
        source_ids = kwargs["source_ids"]
        lesson_outline = _module_lesson_outlines(module_outline)[0]
        return {
            "module": {
                "id": "module-1",
                "title": module_outline["title"],
                "sections": [
                    {
                        "id": "section-1",
                        "title": lesson_outline["title"],
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": source_ids[:1],
                        "content": [
                            {"type": "text", "value": "Source-backed lesson draft."},
                            {
                                "type": "conceptCard",
                                "title": "Stoichiometry",
                                "description": "Using source evidence to connect amounts and reactions.",
                                "sourceIds": source_ids[:1],
                            },
                        ],
                    },
                    {
                        "id": "section-quiz",
                        "title": "Quiz: source-backed chemistry",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "content": [
                            {
                                "type": "quiz",
                                "questions": [
                                    {
                                        "id": f"q{index}",
                                        "question": f"How should learners apply Stoichiometry in source-backed chemistry case {index}?",
                                        "options": [
                                            "Use ratios and evidence to connect amounts and reactions.",
                                            "Choose coefficients without comparing particle amounts.",
                                            "Use the product mass as the only ratio in the reaction.",
                                            "Replace the mole ratio with the count of element symbols.",
                                        ],
                                        "answers": [0],
                                        "conceptIds": ["Stoichiometry"],
                                    }
                                    for index in range(1, 11)
                                ],
                            }
                        ],
                    },
                    {
                        "id": "section-summary",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": source_ids[:1],
                        "content": [
                            {"type": "heading", "title": "Module concepts"},
                            {
                                "type": "conceptCard",
                                "title": "Stoichiometry",
                                "description": "Using source evidence to connect amounts and reactions.",
                                "sourceSectionId": "section-1",
                                "sourceIds": source_ids[:1],
                            },
                        ],
                    }
                ],
            },
            "usage": [],
            "stages": [{"stage": "module_1", "status": "passed"}],
            "media_logs": [],
        }

    monkeypatch.setattr("app.course_agent_staged.get_agent_provider", lambda _provider_id: {"id": "test", "defaultModel": "test"})
    monkeypatch.setattr("app.course_agent_staged.assess_agent_model_capability", lambda _provider, _model: {"status": "ok"})
    monkeypatch.setattr("app.course_agent_staged._model_json", fail_plan_call)
    monkeypatch.setattr("app.course_agent_staged._generate_module_bundle", fake_module_bundle)
    checkpoints: list[dict[str, Any]] = []

    result = generate_course_with_agent_staged(
        prompt="Create Chemistry 105",
        api_key="test",
        provider_id="test",
        level="undergrad",
        language="English",
        source_policy="source-backed",
        desired_module_count=1,
        expected_duration_minutes=60,
        source_packet=source_packet,
        enforce_contract=False,
        on_checkpoint=checkpoints.append,
    )

    checkpoint_course = checkpoints[0]["partial_course"]
    assert checkpoint_course["metadata"]["generationPlan"]["planningSource"] == "source_packet_outline"
    assert checkpoint_course["metadata"]["sourceCorpusSynthesis"]["sourcePacket"]["quality"]["conceptCoverageRatio"] == 1
    assert checkpoint_course["metadata"]["courseBuildOutline"]["contractVersion"] == "course-outline-from-source-packet-v1"
    assert result.trace["course_build_outline"]["source"] == "source_packet_outline"
    assert result.trace["stages"][0] == {
        "stage": "course_plan",
        "status": "derived_from_source_packet_outline",
    }
    assert result.trace["module_planning"]["source"] == "source_packet_outline"
    stage_workflow_stages = [stage["stage"] for stage in result.trace["stage_workflows"]]
    assert stage_workflow_stages == [
        "course_template_generation",
        "course_module_outline_generation",
        "module_section_plan_generation",
        "section_fill_generation",
        "module_assessment_planning",
        "module_apply_section_generation",
        "module_summary_section_generation",
        "module_assembly",
    ]
    assert all(stage["status"] == "passed" for stage in result.trace["stage_workflows"])
    assert result.course["metadata"]["generationPlan"]["planningSource"] == "source_packet_outline"
    assert result.course["metadata"]["courseTemplate"]["handoff"]["nextWorkflow"] == "course-module-outline-workflow-v1"
    assert result.course["metadata"]["courseTemplate"]["sourcePacketHandoff"]["qualityStatus"] == "usable"
    assert result.course["metadata"]["sourceCorpusSynthesis"]["sourcePacket"]["quality"]["conceptCoverageRatio"] == 1
    assert result.course["metadata"]["courseBuildOutline"]["contractVersion"] == "course-outline-from-source-packet-v1"
    assert result.course["metadata"]["courseBuildOutline"]["modules"][0]["planningSource"] == "source_packet"


def test_staged_agent_generates_with_zero_sources(monkeypatch) -> None:
    def fake_plan_call(*args: Any, **kwargs: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        return (
            {
                "title": "Introductory Macroeconomics",
                "shortDescription": "A draft course that teaches core macroeconomics without source claims.",
                "difficultyLevel": "undergrad",
                "modules": [
                    {
                        "title": "GDP and National Income",
                        "objective": "Explain GDP, its components, and common measurement limits.",
                        "sections": [
                            {
                                "title": "GDP foundations",
                                "learning_objectives": ["Define GDP and distinguish nominal from real GDP."],
                                "concept_keywords": ["GDP", "nominal GDP", "real GDP"],
                            }
                        ],
                    }
                ],
            },
            {"usage": {}},
        )

    def fake_module_bundle(**kwargs: Any) -> dict[str, Any]:
        module_outline = kwargs["module_outline"]
        return {
            "module": {
                "id": "module-1",
                "title": module_outline["title"],
                "sections": [
                    {
                        "id": "section-1",
                        "title": "GDP foundations",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": [],
                        "content": [
                            {"type": "text", "value": "Gross domestic product measures the market value of final goods and services produced within an economy during a period."},
                            {"type": "heading", "title": "Concepts introduced"},
                            {
                                "type": "conceptCard",
                                "title": "GDP",
                                "description": "GDP is a production measure, so it excludes most intermediate goods and nonmarket work.",
                                "items": ["Final goods and services", "Produced within a country", "Measured over time"],
                            },
                        ],
                    },
                    {
                        "id": "section-quiz",
                        "title": "Quiz: GDP",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "content": [
                            {
                                "type": "quiz",
                                "questions": [
                                    {
                                        "id": f"q{index}",
                                        "question": f"Which choice best applies GDP measurement rule {index}?",
                                        "options": [
                                            "Count only final production during the period.",
                                            "Count every intermediate sale separately.",
                                            "Count only financial asset trades.",
                                            "Ignore market production.",
                                        ],
                                        "answers": [0],
                                        "conceptIds": ["GDP"],
                                    }
                                    for index in range(1, 11)
                                ],
                            }
                        ],
                    },
                    {
                        "id": "section-summary",
                        "title": "Module 1 Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": [],
                        "content": [
                            {"type": "heading", "title": "Module concepts"},
                            {
                                "type": "conceptCard",
                                "title": "GDP",
                                "description": "GDP summarizes final production, not every valuable activity.",
                                "sourceSectionId": "section-1",
                            },
                        ],
                    },
                ],
            },
            "usage": [],
            "stages": [{"stage": "module_1", "status": "passed"}],
            "media_logs": [],
        }

    monkeypatch.setattr("app.course_agent_staged.get_agent_provider", lambda _provider_id: {"id": "test", "defaultModel": "test"})
    monkeypatch.setattr("app.course_agent_staged.assess_agent_model_capability", lambda _provider, _model: {"status": "ok"})
    monkeypatch.setattr("app.course_agent_staged._model_json", fake_plan_call)
    monkeypatch.setattr("app.course_agent_staged._generate_module_bundle", fake_module_bundle)

    result = generate_course_with_agent_staged(
        prompt="Create an introductory macroeconomics course",
        api_key="test",
        provider_id="test",
        level="undergrad",
        language="English",
        source_policy="balanced",
        desired_module_count=1,
        expected_duration_minutes=60,
        source_urls=[],
        category="business-management",
        department="economics",
    )

    assert result.trace["stages"][0] == {"stage": "course_plan", "status": "passed"}
    assert result.trace["generation_readiness"]["status"] == "needs_sources"
    assert result.trace["generation_readiness"]["ready"] is False
    assert result.course["sourceRecords"] == []
    assert result.course["status"] == "needs_sources"
    assert result.course["metadata"]["status"] == "needs_sources"
    assert result.course["metadata"]["courseTemplate"]["title"] == "Introductory Macroeconomics Course"
    assert result.course["metadata"]["courseTemplate"]["scope"]["evidenceMode"] == "prompt_inferred"
    assert result.course["modules"][0]["sections"][0]["content"]


def test_staged_agent_can_build_outline_packet_from_compiled_source_corpus() -> None:
    source_corpus = SourceCorpusPreflight(
        synthesis={
            "sourcePacket": {
                "contractVersion": "source-packet-v1",
                "contextId": "packet-1",
                "quality": {"status": "usable", "conceptCoverageRatio": 1},
            }
        },
        source_urls=["https://example.edu/open-chemistry"],
        source_documents=[
            {
                "url": "https://example.edu/open-chemistry",
                "text": "Stoichiometry, mole ratios, atomic structure, and periodic trends.",
            }
        ],
    )

    packet = _source_packet_for_outline(source_packet=None, source_corpus=source_corpus)
    plan = _course_build_outline_plan_from_source_packet(
        prompt="Create Chemistry 105",
        source_packet=packet,
        desired_module_count=2,
    )

    assert packet is not None
    assert packet["context_id"] == "packet-1"
    assert packet["source_documents"] == source_corpus.source_documents
    assert plan is not None
    assert plan["planningSource"] == "source_packet_outline"
    assert len(plan["modules"]) == 2


def test_generation_source_corpus_accepts_file_derived_input_artifacts() -> None:
    source_corpus = compile_generation_source_corpus(
        prompt="Create Chemistry 105 covering stoichiometry and mole ratios",
        source_urls=[],
        fetch_sources=False,
        input_artifacts=[
            {
                "id": "chem-notes",
                "kind": "pdf",
                "filename": "chemistry-105-notes.pdf",
                "mimeType": "application/pdf",
                "extractedText": "Stoichiometry, mole ratios, atomic structure, and periodic trends.",
            }
        ],
    )
    packet = _source_packet_for_outline(source_packet=None, source_corpus=source_corpus)
    plan = _course_build_outline_plan_from_source_packet(
        prompt="Create Chemistry 105",
        source_packet=packet,
        desired_module_count=2,
    )

    assert source_corpus.source_urls == ["artifact://chem-notes"]
    assert source_corpus.source_documents[0]["inputArtifactId"] == "chem-notes"
    assert source_corpus.synthesis["inputArtifacts"][0]["filename"] == "chemistry-105-notes.pdf"
    assert source_corpus.synthesis["metrics"]["usableInputArtifactCount"] == 1
    assert source_corpus.synthesis["metrics"]["includedInputArtifactCount"] == 1
    assert plan is not None
    assert plan["modules"][0]["sourceIds"] == ["input-source-1"]


def test_source_corpus_outline_plans_file_and_web_documents_the_same(monkeypatch) -> None:
    monkeypatch.setattr("app.source_corpus.source_index_client_configured", lambda: False)
    prompt = (
        "Create a machine learning systems course covering data pipelines, model training, "
        "evaluation, deployment monitoring, feature stores, and production inference."
    )
    evidence = (
        "Data pipelines, model training, evaluation, deployment monitoring, feature stores, "
        "and production inference are core machine learning systems concepts."
    )

    web_corpus = compile_generation_source_corpus(
        prompt=prompt,
        source_urls=["https://example.edu/source"],
        fetch_sources=False,
        source_documents=[
            {
                "url": "https://example.edu/source",
                "title": "Machine Learning Systems",
                "text": evidence,
                "fetchStatus": "fetched",
            }
        ],
    )
    file_corpus = compile_generation_source_corpus(
        prompt=prompt,
        source_urls=[],
        fetch_sources=False,
        input_artifacts=[
            {
                "id": "ml-systems",
                "kind": "pdf",
                "filename": "machine-learning-systems.pdf",
                "title": "Machine Learning Systems",
                "mimeType": "application/pdf",
                "extractedText": evidence,
            }
        ],
    )

    web_plan = _source_corpus_outline_plan(prompt=prompt, source_corpus=web_corpus)
    file_plan = _source_corpus_outline_plan(prompt=prompt, source_corpus=file_corpus)

    assert _outline_planning_source(None, web_corpus) == "source_corpus_outline"
    assert _outline_planning_source(None, file_corpus) == "source_corpus_outline"
    assert web_plan["planningSource"] == "source_corpus_outline"
    assert file_plan["planningSource"] == "source_corpus_outline"
    assert web_corpus.synthesis["metrics"]["includedSourceCount"] == 1
    assert file_corpus.synthesis["metrics"]["includedSourceCount"] == 1
    assert file_corpus.synthesis["metrics"]["includedInputArtifactCount"] == 1
    assert [module["title"] for module in web_plan["modules"]] == [module["title"] for module in file_plan["modules"]]
    assert [module["concept_keywords"] for module in web_plan["modules"]] == [
        module["concept_keywords"] for module in file_plan["modules"]
    ]
    assert all(module["sourceIds"] == ["input-source-1"] for module in web_plan["modules"])
    assert all(module["sourceIds"] == ["input-source-1"] for module in file_plan["modules"])


def _source_corpus_outline_plan(*, prompt: str, source_corpus: SourceCorpusPreflight) -> dict[str, Any]:
    packet = _source_packet_for_outline(source_packet=None, source_corpus=source_corpus)
    plan = _course_build_outline_plan_from_source_packet(
        prompt=prompt,
        source_packet=packet,
        desired_module_count=3,
    )
    assert plan is not None
    if plan.get("planningSource") == "source_packet_outline":
        plan["planningSource"] = _outline_planning_source(None, source_corpus)
    return plan


def test_file_reader_primitive_returns_generation_input_artifacts() -> None:
    result = read_generation_input_files(
        [
            {
                "filename": "chemistry-notes.md",
                "mimeType": "text/markdown",
                "content": "Stoichiometry uses mole ratios to connect balanced reactions to quantities.",
            }
        ]
    )
    artifact = result["artifacts"][0]

    assert result["contractVersion"] == "lycium-file-reader-v1"
    assert result["replaceableBy"] == "external-source-extractor"
    assert result["extractedArtifactCount"] == 1
    assert artifact["kind"] == "markdown"
    assert artifact["extractionStatus"] == "extracted"
    assert artifact["normalizedDocument"]["contractVersion"] == "normalized-document-v1"
    assert artifact["sourceDocumentUrl"].startswith("artifact://")
    assert "Stoichiometry" in artifact["extractedText"]
