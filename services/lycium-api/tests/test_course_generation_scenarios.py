from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.course_generation_scenarios import (
    evaluate_course_generation_scenario,
    evaluate_program_generation_scenario,
    list_generation_eval_scenarios,
)
from app.course_generation_scenario_specs import GOLDEN_COURSE_TEMPLATES
from app.course_quality import assess_course_quality


REPO_ROOT = Path(__file__).resolve().parents[3]


def _questions(topic: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"q{index}",
            "question": f"Which answer best applies {topic} in a college course setting?",
            "options": [f"{topic} correct use {index}", "Unrelated distractor", "Unsafe shortcut", "Placeholder response"],
            "answers": [0],
        }
        for index in range(1, 11)
    ]




from tests.course_generation_fixture_builders import (
    golden_course_from_scenario,
    source_backed_course_from_scenario,
    under_sourced_course_draft_from_scenario,
)

def _course_for_scenario() -> dict[str, Any]:
    return golden_course_from_scenario("macroeconomics-principles")


def _teachable_publish_ready_course() -> dict[str, Any]:
    source_records = [
        {"id": "source-openstax-macro", "type": "textbook", "title": "OpenStax Principles of Macroeconomics 3e", "url": "https://openstax.org/details/books/principles-macroeconomics-3e"},
        {"id": "source-bea-gdp", "type": "government-data", "title": "BEA GDP data", "url": "https://www.bea.gov/data/gdp/gross-domestic-product"},
        {"id": "source-bls-cpi", "type": "government-data", "title": "BLS Consumer Price Index", "url": "https://www.bls.gov/cpi/"},
    ]
    modules = []
    topics = ["gross domestic product", "inflation and price indexes", "aggregate demand and supply"]
    for index, topic in enumerate(topics, start=1):
        section_id = f"macro-publish-{index}"
        explanation = (
            f"This lesson builds a foundation for {topic} by connecting prerequisite vocabulary, worked examples, "
            "data interpretation, and mastery evidence. Learners start from economic indicators, translate the "
            "observations into model-based claims, and then use those claims to make justified predictions. "
            "The advanced value of the lesson is not memorizing isolated facts; it is learning how definitions, "
            "measurement choices, and model assumptions shape the explanation. "
            "A project-style practice task asks learners to document assumptions, compare alternatives, and explain "
            "what evidence would change their conclusion. Mastery is assessed through quiz questions, a short rubric, "
            "and a source-backed explanation that shows why the reasoning is valid."
        )
        modules.append(
            {
                "id": f"module-{index}",
                "title": f"Week {index}: {topic.title()}",
                "sourceIds": [source["id"] for source in source_records],
                "sections": [
                    {
                        "id": section_id,
                        "title": topic.title(),
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": [source["id"] for source in source_records],
                        "content": [
                            {"type": "text", "heading": "Explanation", "value": explanation, "sourceIds": ["source-openstax-macro"]},
                            {"type": "text", "heading": "Example", "value": f"Example: use {topic} to compare two economic claims and state the evidence for each claim.", "sourceIds": ["source-openstax-macro"]},
                            {"type": "text", "heading": "Practice", "value": f"Practice: analyze a {topic} case, then write one sentence naming the assumption that matters most.", "sourceIds": ["source-bea-gdp"]},
                            {"type": "video", "title": f"{topic.title()} video", "url": "https://example.edu/macroeconomics-video", "sourceIds": ["source-bls-cpi"]},
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "sourceIds": ["source-openstax-macro"],
                                "concepts": [
                                    {"name": topic.title(), "description": f"The core representation and reasoning pattern for {topic}.", "sourceSectionId": section_id},
                                    {"name": "Mastery evidence", "description": "Observable work showing that a learner can apply a concept under constraints.", "sourceSectionId": section_id},
                                ],
                            },
                        ],
                    },
                    {
                        "id": f"{section_id}-quiz",
                        "title": f"Quiz: {topic.title()}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": ["source-openstax-macro"],
                        "content": [{"type": "quiz", "questions": _questions(topic), "sourceIds": ["source-openstax-macro"]}],
                    },
                    {
                        "id": f"{section_id}-summary",
                        "title": f"Week {index} Summary",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": [source["id"] for source in source_records],
                        "content": [
                            {
                                "type": "conceptCards",
                                "title": "Week concepts",
                                "sourceIds": ["source-openstax-macro"],
                                "concepts": [
                                    {"name": topic.title(), "description": f"Review definition for {topic}.", "sourceSectionId": section_id},
                                    {"name": "Mastery evidence", "description": "Review signal for source-backed capability.", "sourceSectionId": section_id},
                                ],
                            }
                        ],
                    },
                ],
            }
        )
    return {
        "title": "Macroeconomics Principles Publish-Ready Mini Course",
        "shortDescription": "A source-backed macroeconomics course slice with teachable lessons, quizzes, and concept summaries.",
        "difficultyLevel": "undergrad",
        "category": "business-management",
        "department": "economics",
        "tags": ["macroeconomics", "mastery", "economic data"],
        "sourceIds": [source["id"] for source in source_records],
        "sourceRecords": source_records,
        "metadata": {
            "pacingLabel": "Week",
            "requirementOrigins": [
                {"requirementId": "req-gdp", "originType": "common_academic_requirement", "evidenceRefs": ["source-openstax-macro"]},
                {"requirementId": "req-inflation", "originType": "common_academic_requirement", "evidenceRefs": ["source-openstax-macro"]},
            ],
            "sourceSlots": [
                {
                    "requiredConceptId": f"macro-{topic.replace(' ', '-')}",
                    "title": topic.title(),
                    "primarySourceId": "source-openstax-macro",
                    "fallbackSourceIds": ["source-bea-gdp", "source-bls-cpi"],
                    "replacementPolicy": "review_required",
                }
                for topic in topics
            ]
            + [
                {
                    "requiredConceptId": "mastery-evidence",
                    "title": "Mastery evidence",
                    "primarySourceId": "source-openstax-macro",
                    "fallbackSourceIds": ["source-bea-gdp", "source-bls-cpi"],
                    "replacementPolicy": "review_required",
                }
            ],
        },
        "prerequisites": [{"type": "course", "courseId": "intro-economics", "title": "Introductory Economics"}],
        "modules": modules,
    }


def _full_stack_program() -> dict[str, Any]:
    groups = [
        ("foundations", ["Computer basics", "Command line", "Git and GitHub"]),
        ("programming", ["JavaScript fundamentals", "TypeScript fundamentals", "Algorithms and data structures"]),
        ("frontend", ["HTML", "CSS", "React", "Frontend testing"]),
        ("backend", ["HTTP APIs", "Authentication", "API security", "Server runtime"]),
        ("data", ["SQL", "Database design", "PostgreSQL"]),
        ("deployment", ["Docker", "CI/CD", "Cloud deployment"]),
        ("professional", ["Code review", "Technical communication"]),
        ("capstone", []),
    ]
    requirement_groups = []
    for group_index, (name, courses) in enumerate(groups, start=1):
        requirements = [
            {"id": f"req-{name}-{course_index}", "type": "complete_course", "title": course, "courseId": course.lower().replace(" ", "-")}
            for course_index, course in enumerate(courses, start=1)
        ]
        if name == "programming":
            requirements.append({"id": "req-programming-assessment", "type": "pass_assessment", "title": "Programming assessment", "assessmentId": "programming-assessment"})
        if name == "capstone":
            requirements.extend(
                [
                    {"id": "req-capstone-project", "type": "submit_project", "title": "Full-stack capstone", "projectId": "full-stack-capstone"},
                    {"id": "req-portfolio-review", "type": "pass_assessment", "title": "Portfolio review", "assessmentId": "portfolio-review"},
                ]
            )
        requirement_groups.append(
            {
                "id": f"group-{name}",
                "displayName": name.title(),
                "groupKind": "capstone" if name == "capstone" else "cluster",
                "requirements": requirements,
                "completionRule": {"type": "complete_all"},
            }
        )
    return {
        "program": {
            "id": "full-stack-software-engineer",
            "title": "Full-Stack Software Engineer Program",
            "description": "A complete program from foundations through capstone evidence.",
            "field": "Software Engineering",
            "targetOutcome": "Prepare learners for junior full-stack software engineering work.",
            "requirementGroups": requirement_groups,
            "dependencyGraph": {
                "edges": [
                    {"fromNodeId": "group-foundations", "toNodeId": "group-programming", "type": "required"},
                    {"fromNodeId": "group-programming", "toNodeId": "group-frontend", "type": "required"},
                    {"fromNodeId": "group-programming", "toNodeId": "group-backend", "type": "required"},
                    {"fromNodeId": "group-backend", "toNodeId": "group-data", "type": "required"},
                    {"fromNodeId": "group-data", "toNodeId": "group-deployment", "type": "required"},
                    {"fromNodeId": "group-deployment", "toNodeId": "group-capstone", "type": "required"},
                ]
            },
        }
    }


def test_lists_fixed_course_and_program_scenarios() -> None:
    scenarios = list_generation_eval_scenarios()

    assert "macroeconomics-principles" in {scenario["id"] for scenario in scenarios["courses"]}
    assert "academic-writing-research-composition" in {scenario["id"] for scenario in scenarios["courses"]}
    assert "under-sourced-course-prompt" in {scenario["id"] for scenario in scenarios["courses"]}
    assert "full-stack-software-engineer-program" in {scenario["id"] for scenario in scenarios["programs"]}


def test_macroeconomics_scenario_accepts_complete_college_course_shape() -> None:
    report = evaluate_course_generation_scenario(_course_for_scenario(), "macroeconomics-principles")

    assert report["status"] == "passed"
    assert report["score"] >= 0.9
    coverage = next(check for check in report["checks"] if check["key"] == "required_topic_coverage")
    assert coverage["metrics"]["coveredRequiredKeywordCount"] >= 14




def test_intro_programming_scenario_accepts_source_backed_course_shape() -> None:
    report = evaluate_course_generation_scenario(
        source_backed_course_from_scenario("intro-programming-foundations"),
        "intro-programming-foundations",
    )

    assert report["status"] == "passed"
    assert report["metrics"]["failedCheckCount"] == 0


def test_software_engineering_scenario_accepts_source_backed_course_shape() -> None:
    report = evaluate_course_generation_scenario(
        source_backed_course_from_scenario("software-engineering-methods"),
        "software-engineering-methods",
    )

    assert report["status"] == "passed"
    assert report["metrics"]["failedCheckCount"] == 0


def test_academic_writing_scenario_accepts_source_backed_course_shape() -> None:
    report = evaluate_course_generation_scenario(
        source_backed_course_from_scenario("academic-writing-research-composition"),
        "academic-writing-research-composition",
    )

    assert report["status"] == "passed"
    assert report["metrics"]["failedCheckCount"] == 0


def test_multi_source_noisy_corpus_fixture_excludes_irrelevant_material() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["metadata"]["sourceCorpusSynthesis"] = {
        "includedSources": ["source-primary", "source-video"],
        "excludedSources": ["source-unrelated-recipe"],
        "commonThemes": ["variables", "functions", "testing"],
    }
    rendered_text = json.dumps(course).lower()

    report = evaluate_course_generation_scenario(course, "intro-programming-foundations")

    assert report["status"] == "passed"
    assert "source-unrelated-recipe" in course["metadata"]["sourceCorpusSynthesis"]["excludedSources"]
    assert "tomato sauce" not in rendered_text


def test_intro_programming_scenario_rejects_inherited_only_concept_source_mappings() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    for module in course["modules"]:
        for section in module["sections"]:
            for block in section["content"]:
                if block.get("type") == "conceptCard":
                    block.pop("sourceIds", None)

    report = evaluate_course_generation_scenario(course, "intro-programming-foundations")

    source_mapping = next(check for check in report["checks"] if check["key"] == "source_mapping")
    assert report["status"] == "failed"
    assert source_mapping["metrics"]["directConceptSourceCoverage"] < 1
    assert any("Concept cards should carry direct source mappings" in finding["message"] for finding in source_mapping["findings"])


def test_course_generation_scenario_rejects_prompt_like_filler() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["modules"][0]["sections"][0]["content"][0]["value"] = (
        "Students should connect this lesson to the module objective. The agent should generate content here."
    )

    report = evaluate_course_generation_scenario(course, "intro-programming-foundations")

    assert report["status"] == "failed"
    assert any("Prompt-like" in recommendation for recommendation in report["recommendations"])


def test_course_generation_scenario_rejects_ready_claim_with_low_concept_coverage() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["metadata"]["generationReadiness"] = {
        "contractVersion": "course-generation-readiness-v1",
        "status": "ready",
        "ready": True,
        "sourceEvidence": {"submittedEvidenceCount": 4, "minimumCourseSources": 3},
        "conceptCoverage": {
            "status": "needs_sources",
            "coverageRatio": 0.33,
            "minimumCoverageRatio": 0.7,
            "requiredConceptCount": 3,
            "coveredConceptCount": 1,
            "uncoveredConcepts": ["control flow", "functions"],
        },
    }

    report = evaluate_course_generation_scenario(course, "intro-programming-foundations")

    readiness = next(check for check in report["checks"] if check["key"] == "generation_readiness")
    assert report["status"] == "failed"
    assert readiness["status"] == "failed"
    assert any("concept coverage is below policy" in finding["message"] for finding in readiness["findings"])


def test_course_generation_scenario_requires_positive_readiness_for_full_courses() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["metadata"].pop("generationReadiness", None)

    report = evaluate_course_generation_scenario(course, "intro-programming-foundations")

    readiness = next(check for check in report["checks"] if check["key"] == "generation_readiness")
    assert report["status"] == "failed"
    assert readiness["status"] == "failed"
    assert any("must include metadata.generationReadiness" in finding["message"] for finding in readiness["findings"])


def test_under_sourced_prompt_scenario_accepts_needs_sources_draft() -> None:
    report = evaluate_course_generation_scenario(
        under_sourced_course_draft_from_scenario(),
        "under-sourced-course-prompt",
    )

    assert report["status"] == "passed"
    assert report["metrics"]["failedCheckCount"] == 0
    lifecycle = next(check for check in report["checks"] if check["key"] == "source_gap_lifecycle")
    assert lifecycle["metrics"]["sourceGapCount"] == 1


def test_under_sourced_prompt_scenario_rejects_hollow_course() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["status"] = "draft"
    course["sourceRecords"] = []
    course["metadata"]["sourceGaps"] = []
    course["metadata"]["status"] = "draft"

    report = evaluate_course_generation_scenario(course, "under-sourced-course-prompt")

    assert report["status"] == "failed"
    assert any("Expected course status needs_sources" in recommendation for recommendation in report["recommendations"])
    assert any("metadata.sourceGaps" in recommendation for recommendation in report["recommendations"])

def test_golden_course_dataset_has_broad_data_only_examples() -> None:
    assert len(GOLDEN_COURSE_TEMPLATES) == 10
    assert {
        "macroeconomics-principles",
        "general-biology-foundations",
        "introductory-statistics",
        "environmental-science-foundations",
        "financial-accounting-principles",
    }.issubset(GOLDEN_COURSE_TEMPLATES)

    macro_template = GOLDEN_COURSE_TEMPLATES["macroeconomics-principles"]
    source_blueprint = macro_template["sourceBlueprint"]
    assert len(macro_template["requiredKeywords"]) == 14
    assert len(source_blueprint["benchmarkSources"]) >= 3
    assert len(source_blueprint["freeSourceRecords"]) >= 6


def test_macroeconomics_scenario_rejects_wrong_department_and_thin_assessment() -> None:
    course = _course_for_scenario()
    course["department"] = "computer-science"
    course["modules"][0]["sections"][1]["content"][0]["questions"] = _questions("inflation")[:4]

    report = evaluate_course_generation_scenario(course, "macroeconomics-principles")

    assert report["status"] == "failed"
    assert any("Expected department economics" in recommendation for recommendation in report["recommendations"])
    assert any("at least 10 questions" in recommendation for recommendation in report["recommendations"])


def test_macroeconomics_scenario_rejects_blanket_sources_without_block_grounding() -> None:
    course = _course_for_scenario()
    course["metadata"]["sourceSlots"] = []
    for module in course["modules"]:
        for section in module["sections"]:
            section["sourceIds"] = []
            for block in section["content"]:
                block.pop("sourceIds", None)

    report = evaluate_course_generation_scenario(course, "macroeconomics-principles")

    assert report["status"] == "failed"
    assert any("source slots" in recommendation for recommendation in report["recommendations"])
    assert any("blocks should carry sourceIds" in recommendation for recommendation in report["recommendations"])


def test_full_stack_program_scenario_accepts_requirement_based_path() -> None:
    report = evaluate_program_generation_scenario(_full_stack_program(), "full-stack-software-engineer-program")

    assert report["status"] == "passed"
    assert report["metrics"]["failedCheckCount"] == 0
    coverage = next(check for check in report["checks"] if check["key"] == "requirement_coverage")
    assert coverage["metrics"]["coveredRequirementKeywordCount"] >= 9


def test_flagship_full_stack_fixture_passes_program_generation_scenario() -> None:
    fixture = json.loads((REPO_ROOT / "packages/contracts/fixtures/full-stack-engineer-program.json").read_text())
    report = evaluate_program_generation_scenario(fixture, "full-stack-software-engineer-program")

    assert report["status"] == "passed"
    assert report["metrics"]["failedCheckCount"] == 0
    assert report["score"] >= 0.9


def test_publish_gate_accepts_teachable_source_backed_course() -> None:
    report = assess_course_quality(_teachable_publish_ready_course(), gate="publish")

    assert report["passed"] is True
    assert report["score"] >= 0.85
    assert report["metrics"]["quizSectionCount"] == 3
    assert report["metrics"]["qualityEvalFailedDimensionCount"] == 0


def test_publish_gate_blocks_placeholder_or_prompt_like_course() -> None:
    course = _teachable_publish_ready_course()
    course["modules"][0]["sections"][0]["content"][0]["value"] = "The model should generate instructional content here."
    course["modules"][0]["sections"] = course["modules"][0]["sections"][:-1]

    report = assess_course_quality(course, gate="publish")

    assert report["passed"] is False
    assert any("placeholder" in item.lower() or "prompt-like" in item.lower() for item in [*report["errors"], *report["warnings"]])
    assert any("summary" in item.lower() for item in [*report["errors"], *report["warnings"]])
