from __future__ import annotations

from typing import Any

from app.course_generation_flagships import CHEM_105_FLAGSHIP_BLUEPRINT, chem_105_source_slots
from app.course_generation_scenarios import (
    evaluate_course_generation_scenario,
    evaluate_program_generation_scenario,
    list_generation_eval_scenarios,
)


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
        "category": "college-of-sciences",
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
