from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.course_generation_flagships import CHEM_105_FLAGSHIP_BLUEPRINT, chem_105_source_slots
from app.course_generation_scenarios import (
    evaluate_course_generation_scenario,
    evaluate_program_generation_scenario,
    list_generation_eval_scenarios,
)
from app.course_generation_scenario_specs import COURSE_SCENARIOS
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




from tests.course_generation_fixture_builders import source_backed_course_from_scenario

def _course_for_scenario() -> dict[str, Any]:
    topics = [
        "matter and measurement",
        "atomic structure",
        "periodic trends",
        "chemical formulas and nomenclature",
        "stoichiometry",
        "chemical reactions",
        "aqueous solutions",
        "thermochemistry",
        "chemical bonding",
        "molecular geometry",
        "intermolecular forces",
        "gases",
        "solutions",
        "kinetics",
        "equilibrium",
        "acid-base chemistry",
        "laboratory safety",
    ]
    modules = []
    primary_source_id = CHEM_105_FLAGSHIP_BLUEPRINT["freeSourceRecords"][0]["id"]
    for index, topic in enumerate(topics, start=1):
        section_id = f"chem-105-{index}"
        modules.append(
            {
                "id": f"module-{index}",
                "title": f"Week {index}: {topic.title()}",
                "sourceIds": [primary_source_id],
                "sections": [
                    {
                        "id": section_id,
                        "title": topic.title(),
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": [primary_source_id],
                        "content": [
                            {
                                "type": "text",
                                "heading": "Explanation",
                                "value": (
                                    f"This CHEM 105 lesson teaches {topic}, laboratory safety, equilibrium, "
                                    "and evidence-based chemical reasoning through worked examples and practice."
                                ),
                            },
                            {"type": "video", "title": f"{topic.title()} lecture", "url": "https://example.edu/video"},
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "concepts": [{"name": topic.title(), "description": f"Core CHEM 105 concept: {topic}.", "sourceSectionId": section_id}],
                            },
                        ],
                    },
                    {
                        "id": f"{section_id}-quiz",
                        "title": f"Quiz: {topic.title()}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": [primary_source_id],
                        "content": [{"type": "quiz", "questions": _questions(topic), "sourceIds": [primary_source_id]}],
                    },
                    {
                        "id": f"{section_id}-summary",
                        "title": f"Week {index} Summary",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": [primary_source_id],
                        "content": [
                            {
                                "type": "conceptCards",
                                "title": "Week concepts",
                                "concepts": [{"name": topic.title(), "description": f"Review concept for {topic}.", "sourceSectionId": section_id}],
                            }
                        ],
                    },
                ],
            }
        )
    return {
        "title": "CHEM 105 General Chemistry I",
        "shortDescription": "A first-semester general chemistry course aligned to college CHEM 105 expectations.",
        "difficultyLevel": "undergrad",
        "category": "natural-sciences-mathematics",
        "department": "chemistry",
        "tags": ["chemistry", "stoichiometry", "thermochemistry", "equilibrium"],
        "sourceIds": [source["id"] for source in CHEM_105_FLAGSHIP_BLUEPRINT["freeSourceRecords"]],
        "sourceRecords": [
            {
                "id": source["id"],
                "type": source["type"],
                "title": source["title"],
                "url": source["url"],
            }
            for source in CHEM_105_FLAGSHIP_BLUEPRINT["freeSourceRecords"]
        ],
        "metadata": {
            "pacingLabel": "Week",
            "curriculumBenchmarks": CHEM_105_FLAGSHIP_BLUEPRINT["benchmarkSources"],
            "requirementOrigins": [{"requirementId": f"req-{index}", "title": topic.title()} for index, topic in enumerate(topics, start=1)],
            "sourceSlots": chem_105_source_slots(),
        },
        "modules": modules,
    }


def _teachable_publish_ready_course() -> dict[str, Any]:
    source_records = [
        {"id": "source-openstax-chemistry-2e", "type": "textbook", "title": "OpenStax Chemistry 2e", "url": "https://openstax.org/details/books/chemistry-2e"},
        {"id": "source-chemcollective", "type": "virtual-lab", "title": "ChemCollective virtual labs", "url": "https://chemcollective.org/"},
        {"id": "source-phet-chemistry", "type": "simulation", "title": "PhET chemistry simulations", "url": "https://phet.colorado.edu/en/simulations/filter?subjects=chemistry&type=html"},
    ]
    modules = []
    topics = ["measurement and matter", "stoichiometry", "bonding and molecular shape"]
    for index, topic in enumerate(topics, start=1):
        section_id = f"chem-publish-{index}"
        explanation = (
            f"This lesson builds a foundation for {topic} by connecting prerequisite vocabulary, worked examples, "
            "laboratory practice, and mastery evidence. Learners start from observable chemical systems, translate "
            "the observations into quantitative or structural representations, and then use those representations to "
            "make justified predictions. The advanced value of the lesson is not memorizing isolated facts; it is "
            "learning how chemical constraints, measurement limits, and model assumptions shape the explanation. "
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
                            {"type": "text", "heading": "Explanation", "value": explanation, "sourceIds": ["source-openstax-chemistry-2e"]},
                            {"type": "text", "heading": "Example", "value": f"Example: use {topic} to compare two chemical claims and state the evidence for each claim.", "sourceIds": ["source-openstax-chemistry-2e"]},
                            {"type": "text", "heading": "Practice", "value": f"Practice: solve a {topic} problem, then write one sentence naming the assumption that matters most.", "sourceIds": ["source-chemcollective"]},
                            {"type": "video", "title": f"{topic.title()} video", "url": "https://example.edu/chemistry-video", "sourceIds": ["source-phet-chemistry"]},
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "sourceIds": ["source-openstax-chemistry-2e"],
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
                        "sourceIds": ["source-openstax-chemistry-2e"],
                        "content": [{"type": "quiz", "questions": _questions(topic), "sourceIds": ["source-openstax-chemistry-2e"]}],
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
                                "sourceIds": ["source-openstax-chemistry-2e"],
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
        "title": "CHEM 105 Publish-Ready Mini Course",
        "shortDescription": "A source-backed chemistry course slice with teachable lessons, quizzes, and concept summaries.",
        "difficultyLevel": "undergrad",
        "category": "natural-sciences-mathematics",
        "department": "chemistry",
        "tags": ["chemistry", "mastery", "laboratory practice"],
        "sourceIds": [source["id"] for source in source_records],
        "sourceRecords": source_records,
        "metadata": {
            "pacingLabel": "Week",
            "requirementOrigins": [
                {"requirementId": "req-measurement", "originType": "common_academic_requirement", "evidenceRefs": ["source-openstax-chemistry-2e"]},
                {"requirementId": "req-stoichiometry", "originType": "common_academic_requirement", "evidenceRefs": ["source-openstax-chemistry-2e"]},
            ],
            "sourceSlots": [
                {
                    "requiredConceptId": f"chem-{topic.replace(' ', '-')}",
                    "title": topic.title(),
                    "primarySourceId": "source-openstax-chemistry-2e",
                    "fallbackSourceIds": ["source-chemcollective", "source-phet-chemistry"],
                    "replacementPolicy": "review_required",
                }
                for topic in topics
            ]
            + [
                {
                    "requiredConceptId": "mastery-evidence",
                    "title": "Mastery evidence",
                    "primarySourceId": "source-openstax-chemistry-2e",
                    "fallbackSourceIds": ["source-chemcollective", "source-phet-chemistry"],
                    "replacementPolicy": "review_required",
                }
            ],
        },
        "prerequisites": [{"type": "course", "courseId": "high-school-chemistry", "title": "High School Chemistry"}],
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

    assert "chem-105-general-chemistry" in {scenario["id"] for scenario in scenarios["courses"]}
    assert "full-stack-software-engineer-program" in {scenario["id"] for scenario in scenarios["programs"]}


def test_chem_105_scenario_accepts_complete_college_course_shape() -> None:
    report = evaluate_course_generation_scenario(_course_for_scenario(), "chem-105-general-chemistry")

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


def test_course_generation_scenario_rejects_prompt_like_filler() -> None:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["modules"][0]["sections"][0]["content"][0]["value"] = (
        "Students should connect this lesson to the module objective. The agent should generate content here."
    )

    report = evaluate_course_generation_scenario(course, "intro-programming-foundations")

    assert report["status"] == "failed"
    assert any("Prompt-like" in recommendation for recommendation in report["recommendations"])

def test_chem_105_flagship_blueprint_has_real_benchmarks_sources_and_slots() -> None:
    assert len(CHEM_105_FLAGSHIP_BLUEPRINT["benchmarkSources"]) >= 3
    assert len(CHEM_105_FLAGSHIP_BLUEPRINT["freeSourceRecords"]) >= 6
    assert len(CHEM_105_FLAGSHIP_BLUEPRINT["weekPlan"]) == 14

    source_ids = {source["id"] for source in CHEM_105_FLAGSHIP_BLUEPRINT["freeSourceRecords"]}
    for slot in chem_105_source_slots():
        assert slot["primarySourceId"] in source_ids
        assert slot["replacementPolicy"] == "review_required"


def test_chem_105_scenario_rejects_wrong_department_and_thin_assessment() -> None:
    course = _course_for_scenario()
    course["department"] = "computer-science"
    course["modules"][0]["sections"][1]["content"][0]["questions"] = _questions("stoichiometry")[:4]

    report = evaluate_course_generation_scenario(course, "chem-105-general-chemistry")

    assert report["status"] == "failed"
    assert any("Expected department chemistry" in recommendation for recommendation in report["recommendations"])
    assert any("at least 10 questions" in recommendation for recommendation in report["recommendations"])


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
