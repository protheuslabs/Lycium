from __future__ import annotations

from typing import Any

from app.course_agent_staged import generate_course_with_agent_staged
from app.file_input_reader import read_generation_input_files


def _quiz_questions() -> list[dict[str, Any]]:
    return [
        {
            "id": f"q{index}",
            "question": f"Which file-backed chemistry concept is used in this course? {index}",
            "options": ["Stoichiometry", "Typography", "Routing", "Caching"],
            "answers": [0],
        }
        for index in range(1, 11)
    ]


def test_staged_generation_produces_valid_course_from_file_artifacts(monkeypatch) -> None:
    reader_result = read_generation_input_files(
        [
            {
                "filename": "stoichiometry-notes.txt",
                "mimeType": "text/plain",
                "text": (
                    "Stoichiometry uses mole ratios, limiting reagents, balanced equations, "
                    "and quantitative chemistry reasoning."
                ),
            },
            {
                "filename": "equilibrium-notes.md",
                "mimeType": "text/markdown",
                "text": (
                    "Equilibrium constants, Le Chatelier reasoning, concentration, and "
                    "reaction quotient comparisons are general chemistry concepts."
                ),
            },
            {
                "filename": "titration-lab.txt",
                "mimeType": "text/plain",
                "text": (
                    "Titration labs use concentration, calibration, indicators, endpoint "
                    "evidence, and uncertainty analysis."
                ),
            },
        ]
    )
    captured_source_context_indexes: list[dict[str, Any]] = []

    def fail_plan_call(*_args: Any, **_kwargs: Any) -> tuple[dict[str, Any], dict[str, Any]]:
        raise AssertionError("file-backed source-corpus outline should avoid the plan LLM stage")

    def fake_module_bundle(**kwargs: Any) -> dict[str, Any]:
        source_ids = kwargs["source_ids"]
        captured_source_context_indexes.append(kwargs["source_context_index"])
        primary_source_id = source_ids[0]
        return {
            "module": {
                "id": "module-file-backed-chemistry",
                "title": "Module 1: File-backed chemistry",
                "sourceIds": source_ids,
                "sections": [
                    {
                        "id": "file-backed-stoichiometry",
                        "title": "Stoichiometry from uploaded notes",
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": [primary_source_id],
                        "content": [
                            {
                                "type": "text",
                                "heading": "Explanation",
                                "value": (
                                    "Uploaded source files ground stoichiometry in mole ratios, "
                                    "limiting reagents, and balanced chemical equations."
                                ),
                                "sourceIds": [primary_source_id],
                            },
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "sourceIds": [primary_source_id],
                                "concepts": [
                                    {
                                        "name": "Stoichiometry",
                                        "description": (
                                            "Quantitative chemistry reasoning that relates substances "
                                            "through balanced equation mole ratios."
                                        ),
                                        "sourceSectionId": "file-backed-stoichiometry",
                                    }
                                ],
                            },
                        ],
                    },
                    {
                        "id": "quiz-file-backed-chemistry",
                        "title": "Quiz: File-backed chemistry",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": [primary_source_id],
                        "content": [
                            {
                                "type": "quiz",
                                "sourceIds": [primary_source_id],
                                "questions": _quiz_questions(),
                            }
                        ],
                    },
                    {
                        "id": "summary-file-backed-chemistry",
                        "title": "Module Summary: File-backed chemistry",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": [primary_source_id],
                        "content": [
                            {
                                "type": "conceptCards",
                                "title": "Module concepts",
                                "sourceIds": [primary_source_id],
                                "concepts": [
                                    {
                                        "name": "Stoichiometry",
                                        "description": (
                                            "Quantitative chemistry reasoning that relates substances "
                                            "through balanced equation mole ratios."
                                        ),
                                        "sourceSectionId": "file-backed-stoichiometry",
                                    }
                                ],
                            }
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
    monkeypatch.setattr("app.course_agent_staged._model_json", fail_plan_call)
    monkeypatch.setattr("app.course_agent_staged._generate_module_bundle", fake_module_bundle)

    result = generate_course_with_agent_staged(
        prompt=(
            "Create a general chemistry course about stoichiometry, mole ratios, limiting reagents, "
            "equilibrium constants, titration, concentration, calibration, and uncertainty analysis."
        ),
        api_key="test",
        provider_id="test",
        level="undergrad",
        language="English",
        source_policy="source-backed",
        desired_module_count=1,
        expected_duration_minutes=180,
        input_artifacts=reader_result["artifacts"],
        category="natural-sciences-mathematics",
        department="chemistry",
        enforce_contract=True,
    )

    course = result.course
    assert result.trace["validation"] == {"status": "passed", "errors": []}
    assert result.trace["module_planning"]["source"] == "source_corpus_outline"
    assert result.trace["source_context"]["sourceCount"] == 3
    assert len(captured_source_context_indexes) == 1
    assert set(captured_source_context_indexes[0]) == {"input-source-1", "input-source-2", "input-source-3"}
    assert course["metadata"]["inputArtifacts"][0]["filename"] == "stoichiometry-notes.txt"
    assert course["metadata"]["sourceCorpusSynthesis"]["metrics"]["includedInputArtifactCount"] == 3
    assert course["sourceRecords"][0]["url"].startswith("artifact://")
    assert course["modules"][0]["sections"][0]["content"][0]["sourceIds"] == ["input-source-1"]
    assert course["modules"][0]["sections"][1]["content"][0]["questions"][0]["answers"] == [0]
