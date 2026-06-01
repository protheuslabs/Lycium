from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.course_generation_workflow import run_course_generation_workflow
from app.course_quality_evals import run_course_quality_evals
from app.course_taxonomy import COURSE_TAXONOMY


def _taxonomy_pair() -> tuple[str, str]:
    category = sorted(COURSE_TAXONOMY)[0]
    department = sorted(COURSE_TAXONOMY[category])[0]
    return category, department


def _questions(topic: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"question-{index}",
            "question": f"Which option best demonstrates {topic} with evidence and constraints?",
            "options": [
                f"Apply {topic} with evidence, practice, and mastery checks {index}",
                "Skip the source evidence",
                "Use an unrelated shortcut",
                "Avoid checking the result",
            ],
            "answers": [0],
        }
        for index in range(1, 11)
    ]


def _lesson_text(topic: str) -> str:
    return (
        f"This learn section introduces {topic} as part of a foundation-to-advanced progression. "
        "Learners begin with prerequisite vocabulary, then connect the concept to a realistic constraint, "
        "tradeoff, and source-backed decision. The explanation shows how a practitioner identifies the claim, "
        "checks the evidence, compares an alternative, and records what would change the conclusion. "
        "The example uses a compact scenario where the learner must name assumptions, describe the reasoning path, "
        "and explain why one option is more defensible than another. The practice task asks the learner to apply "
        f"{topic}, write a short justification, and identify the mastery evidence that would prove they can use it "
        "again in a new context. This keeps the section teachable, assessable, and connected to vertical understanding."
    )


def _primitive_course() -> dict[str, Any]:
    category, department = _taxonomy_pair()
    source_records = [
        {"id": "source-primitive-text", "type": "textbook", "title": "Primitive Open Text", "url": "https://example.edu/text"},
        {"id": "source-primitive-video", "type": "video", "title": "Primitive Open Video", "url": "https://example.edu/video"},
        {"id": "source-primitive-practice", "type": "practice", "title": "Primitive Practice Set", "url": "https://example.edu/practice"},
    ]
    topics = ["foundation concept", "applied practice", "mastery evidence"]
    modules = []

    for index, topic in enumerate(topics, start=1):
        section_id = f"primitive-learn-{index}"
        modules.append(
            {
                "id": f"primitive-module-{index}",
                "title": f"Module {index}: {topic.title()}",
                "sourceIds": [source["id"] for source in source_records],
                "sections": [
                    {
                        "id": section_id,
                        "title": topic.title(),
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["source-primitive-text"],
                        "content": [
                            {"type": "text", "heading": "Explanation", "value": _lesson_text(topic), "sourceIds": ["source-primitive-text"]},
                            {"type": "text", "heading": "Example", "value": f"Example: compare two source-backed choices for {topic} and justify the stronger one.", "sourceIds": ["source-primitive-text"]},
                            {"type": "text", "heading": "Practice", "value": f"Practice: apply {topic}, name the key constraint, and state the mastery evidence.", "sourceIds": ["source-primitive-practice"]},
                            {"type": "video", "title": f"{topic.title()} video", "url": "https://example.edu/video", "sourceIds": ["source-primitive-video"]},
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "sourceIds": ["source-primitive-text"],
                                "concepts": [
                                    {"name": topic.title(), "description": f"A source-backed concept used to practice {topic}.", "sourceSectionId": section_id},
                                    {"name": "Mastery evidence", "description": "Observable work that proves the learner can apply a concept under constraints.", "sourceSectionId": section_id},
                                ],
                            },
                        ],
                    },
                    {
                        "id": f"primitive-quiz-{index}",
                        "title": f"Quiz: {topic.title()}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": ["source-primitive-text"],
                        "content": [{"type": "quiz", "questions": _questions(topic), "sourceIds": ["source-primitive-text"]}],
                    },
                    {
                        "id": f"primitive-summary-{index}",
                        "title": f"Module {index} Summary",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["source-primitive-text"],
                        "content": [
                            {
                                "type": "conceptCards",
                                "title": "Module concepts",
                                "sourceIds": ["source-primitive-text"],
                                "concepts": [
                                    {"name": topic.title(), "description": f"Review definition for {topic}.", "sourceSectionId": section_id},
                                    {"name": "Mastery evidence", "description": "Review signal that connects practice to capability.", "sourceSectionId": section_id},
                                ],
                            }
                        ],
                    },
                ],
            }
        )

    return {
        "title": "Primitive Generated Course",
        "shortDescription": "A generic source-backed course fixture for generator quality gates.",
        "difficultyLevel": "undergrad",
        "category": category,
        "department": department,
        "tags": ["primitive", "source-backed", "mastery"],
        "sourceIds": [source["id"] for source in source_records],
        "sourceRecords": source_records,
        "prerequisites": [{"type": "course", "courseId": "primitive-prerequisite", "title": "Primitive prerequisite"}],
        "metadata": {
            "pacingLabel": "Module",
            "scope": {
                "audience": "Learners entering a structured source-backed course.",
                "level": "undergrad",
                "duration": "Three modules",
                "outcome": "Apply source-backed concepts with practice and mastery evidence.",
            },
            "sourceCorpusSynthesis": {
                "metrics": {"submittedSourceCount": 3, "includedSourceCount": 3, "excludedSourceCount": 0},
                "includedSources": [source["id"] for source in source_records],
            },
            "curriculumBenchmarks": [{"id": "primitive-benchmark", "title": "Primitive benchmark", "extractedRequirements": topics}],
            "requirementOrigins": [
                {"requirementId": f"req-{index}", "title": topic, "originType": "expert_review", "evidenceRefs": ["source-primitive-text"]}
                for index, topic in enumerate(topics, start=1)
            ],
            "courseParityProfile": {"commonRequiredTopics": topics, "optionalTopics": [], "coveragePercent": 1, "parityStatus": "strong"},
            "sourceSlots": [
                {
                    "requiredConceptId": f"req-{index}",
                    "primarySourceId": "source-primitive-text",
                    "fallbackSourceIds": ["source-primitive-practice", "source-primitive-video"],
                    "replacementPolicy": "review_required",
                }
                for index, _topic in enumerate(topics, start=1)
            ]
            + [
                {
                    "requiredConceptId": "mastery-evidence",
                    "title": "Mastery evidence",
                    "primarySourceId": "source-primitive-text",
                    "fallbackSourceIds": ["source-primitive-practice", "source-primitive-video"],
                    "replacementPolicy": "review_required",
                }
            ],
        },
        "modules": modules,
    }


def test_primitive_generated_course_passes_generic_workflow_gates() -> None:
    report = run_course_generation_workflow(_primitive_course()).model_dump()

    assert report["status"] == "passed"
    assert report["metrics"]["failedGateCount"] == 0
    assert {gate["gate"] for gate in report["gates"]} >= {
        "source_corpus_preflight",
        "benchmark_intake",
        "assessment",
        "quality_eval",
        "review_publish",
    }


def test_primitive_quality_evals_are_subject_agnostic_and_detect_prompt_prose() -> None:
    course = _primitive_course()
    passed = run_course_quality_evals(course)
    assert passed["status"] == "passed"

    broken = deepcopy(course)
    broken["modules"][0]["sections"][0]["content"][0]["value"] = (
        "Students should connect this lesson to the module objective before the model generates instructional content."
    )
    failed = run_course_quality_evals(broken)
    specificity = next(dimension for dimension in failed["dimensions"] if dimension["key"] == "specificity")

    assert failed["status"] == "failed"
    assert specificity["status"] == "failed"
