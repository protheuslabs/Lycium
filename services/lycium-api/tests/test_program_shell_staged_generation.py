from __future__ import annotations

from typing import Any

from app.course_agent_staged import generate_course_with_agent_staged
from app.course_build_task_resume import apply_course_build_resume_inputs
from app.course_quality_evals import run_course_quality_evals


def _source_document(index: int, title: str, body: str) -> dict[str, str]:
    return {
        "courseSourceId": f"input-source-{index}",
        "title": title,
        "url": f"https://example.edu/pre-med/{index}-{title.lower().replace(' ', '-')}",
        "contentType": "text/plain",
        "text": f"""
Course Description
This pre-medical biology source teaches foundations, progression, practice, mastery evidence, and laboratory reasoning.

Learning Outcomes
- Explain {body}
- Apply {body} to a laboratory or clinical preparation problem.
- Assess mastery of {body} with quiz evidence and source-backed reasoning.

Required Topics
- {body}
- Foundation relationships before advanced biology study.
- Practice exercise and mastery evidence for pre-medical preparation.

Assessment
Quiz, lab explanation, source-backed practice, and portfolio evidence.
""",
    }


def _lesson_text(topic: str) -> str:
    return (
        f"{topic} is a foundation for pre-medical biology because it gives learners a stable way to connect "
        "cell structure, molecular process, laboratory evidence, and later clinical reasoning. Before learners "
        "move into deeper systems, they need to identify what the structure does, what constraint it creates, "
        "and how evidence supports the explanation. In this section, the example follows a student comparing a "
        "normal biological process with a disrupted one, then explaining which source-backed observation would "
        "support the claim. The practice loop asks learners to apply the concept, name the prerequisite idea it "
        "builds on, and describe what would count as mastery evidence. This matters because advanced courses "
        "depend on more than memorized terms: learners must use foundations to reason through tradeoffs, lab "
        "results, and biological mechanisms. A good answer explains the mechanism, identifies the evidence, and "
        "states how the evidence would change a next decision in study or laboratory practice."
    )


def _questions(topic: str) -> list[dict[str, Any]]:
    return [
        {
            "question": f"Which statement best connects {topic} to source-backed pre-medical reasoning?",
            "options": [
                f"{topic} should be explained with mechanism, evidence, and mastery criteria.",
                f"{topic} only needs to be memorized as a vocabulary term.",
                f"{topic} is unrelated to later laboratory interpretation.",
                f"{topic} should replace prerequisite biology foundations.",
            ],
            "answers": [0],
            "conceptIds": [topic],
        }
        for _index in range(10)
    ]


def test_staged_agent_uses_resumed_program_course_shell_outline_before_llm(monkeypatch) -> None:
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
            _source_document(1, "Cell Structure", "cell structure and membrane transport"),
            _source_document(2, "Protein Synthesis", "protein synthesis and enzyme kinetics"),
            _source_document(3, "Laboratory Evidence", "laboratory evidence and assessment practice"),
        ],
    }
    shell = {
        "title": "Program Biology Shell",
        "shortDescription": "A program-generated course shell waiting for source evidence.",
        "difficultyLevel": "undergrad",
        "category": "natural-sciences-mathematics",
        "department": "biology",
        "metadata": {
            "pacingLabel": "Module",
            "courseBuildTask": {
                "contractVersion": "course-build-task-v1",
                "courseId": "program-biology-shell",
                "title": "Program Biology Shell",
                "status": "source_gathering",
                "currentStage": "source_gathering",
                "nextAction": "attach_source_packet",
                "requiredInputs": ["source_packet", "concept_source_coverage"],
            },
        },
    }
    resume_course = apply_course_build_resume_inputs(
        shell,
        prompt="Create a pre-medical biology foundations course",
        source_packet=source_packet,
        desired_module_count=2,
    )

    def fail_plan_call(*_args: Any, **_kwargs: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        raise AssertionError("resumed program shells with courseBuildOutline should not call the plan LLM stage")

    def fake_module_bundle(**kwargs: Any) -> dict[str, Any]:
        module_outline = kwargs["module_outline"]
        module_number = int(kwargs["module_number"])
        source_ids = kwargs["source_ids"]
        lesson_outline = module_outline["sections"][0]
        planned_keywords = lesson_outline.get("concept_keywords", [lesson_outline["title"]])
        topic = str(planned_keywords[0])
        lesson_source_ids = lesson_outline.get("sourceIds") or [source_ids[(module_number - 1) % len(source_ids)]]
        summary_source_ids = list(dict.fromkeys(lesson_source_ids))
        assert kwargs["source_context_index"]
        return {
            "module": {
                "id": module_outline["id"],
                "title": module_outline["title"],
                "sourceIds": summary_source_ids,
                "sections": [
                    {
                        "id": f"{module_outline['id']}-lesson",
                        "title": lesson_outline["title"],
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": lesson_source_ids,
                        "metadata": {
                            "generationOutline": {
                                "plannedConceptKeywords": planned_keywords,
                                "plannedSourceIds": lesson_source_ids,
                            }
                        },
                        "content": [
                            {
                                "type": "text",
                                "heading": "Example and practice",
                                "value": f"{_lesson_text(topic)} Planned source-backed concepts: {', '.join(planned_keywords)}.",
                                "sourceIds": lesson_source_ids,
                            },
                            {"type": "heading", "title": "Concepts introduced", "sourceIds": lesson_source_ids},
                            {
                                "type": "conceptCard",
                                "title": topic,
                                "description": f"{topic.title()} is a source-backed concept used to build pre-medical biology mastery.",
                                "sourceIds": lesson_source_ids,
                            },
                            {
                                "type": "conceptCard",
                                "title": "Mastery evidence",
                                "description": "A visible quiz, lab, or explanation artifact that demonstrates the learner can apply the concept.",
                                "sourceIds": lesson_source_ids,
                            },
                        ],
                    },
                    {
                        "id": f"{module_outline['id']}-quiz",
                        "title": f"{topic.title()} quiz",
                        "pageType": "apply",
                        "sectionType": "quiz",
                        "content": [{"type": "quiz", "questions": _questions(topic)}],
                    },
                    {
                        "id": f"{module_outline['id']}-summary",
                        "title": f"Module {module_number} concept review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": summary_source_ids,
                        "content": [
                            {"type": "heading", "title": "Module concepts", "sourceIds": summary_source_ids},
                            {
                                "type": "conceptCard",
                                "title": topic,
                                "description": f"{topic.title()} is the core concept introduced by this module.",
                                "sourceSectionId": f"{module_outline['id']}-lesson",
                                "sourceIds": lesson_source_ids,
                            },
                            {
                                "type": "conceptCard",
                                "title": "Foundation relationship",
                                "description": "A prerequisite connection that shows what learners should understand before deeper study.",
                                "sourceSectionId": f"{module_outline['id']}-lesson",
                                "sourceIds": lesson_source_ids,
                            },
                            {
                                "type": "conceptCard",
                                "title": "Practice loop",
                                "description": "An exercise cycle that asks learners to apply, explain, and assess the concept.",
                                "sourceSectionId": f"{module_outline['id']}-lesson",
                                "sourceIds": lesson_source_ids,
                            },
                            {
                                "type": "conceptCard",
                                "title": "Mastery evidence",
                                "description": "Observable quiz or laboratory evidence that the learner can use the concept.",
                                "sourceSectionId": f"{module_outline['id']}-lesson",
                                "sourceIds": lesson_source_ids,
                            },
                        ],
                    },
                ],
            },
            "usage": [],
            "stages": [{"stage": f"module_{kwargs['module_number']}", "status": "passed"}],
            "media_logs": [],
        }

    monkeypatch.setattr("app.course_agent_staged.get_agent_provider", lambda _provider_id: {"id": "test", "defaultModel": "test"})
    monkeypatch.setattr("app.course_agent_staged.assess_agent_model_capability", lambda _provider, _model: {"status": "ok"})
    monkeypatch.setattr("app.course_agent_staged._model_json", fail_plan_call)
    monkeypatch.setattr("app.course_agent_staged._generate_module_bundle", fake_module_bundle)

    result = generate_course_with_agent_staged(
        prompt="Create a pre-medical biology foundations course",
        api_key="test",
        provider_id="test",
        level="undergrad",
        language="English",
        source_policy="source-backed",
        desired_module_count=2,
        expected_duration_minutes=120,
        source_packet=source_packet,
        category="natural-sciences-mathematics",
        department="biology",
        resume_course=resume_course,
        enforce_contract=False,
    )

    assert resume_course["metadata"]["courseBuildTask"]["status"] == "section_generation_ready"
    assert result.trace["stages"][0] == {"stage": "course_plan", "status": "resumed_from_course_build_outline"}
    assert result.trace["module_planning"]["source"] == "course_build_outline"
    assert result.trace["source_context"]["sourceCount"] == 3
    assert result.trace["generation_readiness"]["ready"] is True
    assert result.trace["quality_evals"]["metrics"]["failedDimensionCount"] == 0
    assert result.course["metadata"]["generationReadiness"] == result.trace["generation_readiness"]
    assert result.course["metadata"]["generationPlan"]["planningSource"] == "course_build_outline"
    assert result.course["metadata"]["courseBuildOutline"]["contractVersion"] == "course-outline-from-source-packet-v1"
    assert len(result.course["modules"]) == 2
    quality = run_course_quality_evals(result.course)
    failed_dimensions = [dimension for dimension in quality["dimensions"] if dimension["status"] == "failed"]
    assert failed_dimensions == []
    assert {dimension["key"] for dimension in quality["dimensions"] if dimension["status"] == "failed"} == set()
