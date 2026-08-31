from __future__ import annotations

from app import db
from app.course_coverage_checklists import (
    COURSE_COVERAGE_ALLOCATION_REPORT_CONTRACT,
    COURSE_COVERAGE_CHECKLIST_CONTRACT,
    COURSE_COVERAGE_OUTLINE_CONTRACT,
    build_course_coverage_checklist,
    build_outline_from_coverage_checklist,
)
from app.course_generation_stage_workflows import run_module_section_plan_workflow, run_section_fill_workflow
from app.course_source_gaps import create_needs_sources_course_snapshot
from app.generation_outline import build_outline

MACROECONOMICS_PROMPT = (
    "Create an undergraduate macroeconomics course covering gross domestic product and national income accounting, "
    "inflation and price indexes, unemployment and labor markets, aggregate demand and aggregate supply, fiscal policy, "
    "money banking and monetary policy, economic growth and productivity, international trade and exchange rates."
)
MACROECONOMICS_GOALS = [
    "gross domestic product and national income accounting",
    "inflation and price indexes",
    "unemployment and labor markets",
    "aggregate demand and aggregate supply",
    "fiscal policy",
    "money banking and monetary policy",
    "economic growth and productivity",
    "international trade and exchange rates",
]


def _all_section_titles(outline: dict) -> list[str]:
    return [
        str(section.get("title") or "")
        for module in outline.get("modules", [])
        if isinstance(module, dict)
        for section in module.get("sections", [])
        if isinstance(section, dict)
    ]


def test_prompt_goal_coverage_checklist_includes_macro_example_topics() -> None:
    checklist = build_course_coverage_checklist(
        prompt="Create an undergraduate macroeconomics course.",
        level="undergrad",
        goals=MACROECONOMICS_GOALS,
    )
    required_items = checklist["requiredItems"]
    required_ids = {item["id"] for item in required_items}
    must_teach = {
        concept.lower()
        for item in required_items
        for concept in item["mustTeach"]
    }

    assert checklist["contractVersion"] == COURSE_COVERAGE_CHECKLIST_CONTRACT
    assert checklist["courseKind"] == "prompt_inferred"
    assert checklist["source"] == "prompt_goals"
    assert {
        "gross-domestic-product-and-national-income-accounting",
        "inflation-and-price-indexes",
        "aggregate-demand-and-aggregate-supply",
        "money-banking-and-monetary-policy",
    }.issubset(required_ids)
    assert {
        "gross domestic product and national income accounting",
        "inflation and price indexes",
        "aggregate demand and aggregate supply",
        "money banking and monetary policy",
    }.issubset(must_teach)
    assert not {"stoichiometry", "chemistry"}.intersection(must_teach)
    assert all(item["sectionPlans"] for item in required_items)


def test_prompt_phrase_cleanup_removes_leading_conjunctions() -> None:
    checklist = build_course_coverage_checklist(
        prompt="Create an introductory statistics course covering descriptive statistics, probability, and data visualization.",
        level="undergrad",
    )
    titles = {item["title"] for item in checklist["requiredItems"]}

    assert "Data Visualization" in titles
    assert "And Data Visualization" not in titles
    assert all(not title.startswith("And ") for title in titles)


def test_attachment_prompt_uses_focus_clause_for_coverage_not_file_reference() -> None:
    checklist = build_course_coverage_checklist(
        prompt=(
            "Create an undergraduate course based on the attached Machine Learning Systems PDF. "
            "Focus on architecture, data, training, evaluation, deployment, scaling, monitoring, "
            "and operational tradeoffs of production machine learning systems."
        ),
        level="undergrad",
    )
    titles = {item["title"] for item in checklist["requiredItems"]}
    title_blob = " ".join(titles).lower()

    assert checklist["source"] == "prompt_phrases"
    assert {"Architecture", "Data", "Training", "Evaluation", "Deployment"}.issubset(titles)
    assert "attached" not in title_blob
    assert "pdf" not in title_blob


def test_coverage_outline_assigns_required_items_to_modules_and_sections() -> None:
    outline = build_outline_from_coverage_checklist(
        prompt="Create an undergraduate macroeconomics course.",
        desired_module_count=8,
        level="undergrad",
        goals=MACROECONOMICS_GOALS,
    )
    report = outline["coverageAllocationReport"]
    section_titles = _all_section_titles(outline)
    assigned_section_ids = {
        coverage_id
        for module in outline["modules"]
        for section in module["sections"]
        for coverage_id in section["assignedCoverageItemIds"]
    }
    required_ids = {item["id"] for item in outline["coverageChecklist"]["requiredItems"]}

    assert outline["contractVersion"] == COURSE_COVERAGE_OUTLINE_CONTRACT
    assert report["contractVersion"] == COURSE_COVERAGE_ALLOCATION_REPORT_CONTRACT
    assert report["status"] == "passed"
    assert report["unassignedModuleItemIds"] == []
    assert report["unassignedSectionItemIds"] == []
    assert report["duplicateModuleAssignmentIds"] == []
    assert assigned_section_ids == required_ids
    assert len(outline["modules"]) == 8
    assert any("inflation" in module["title"].lower() for module in outline["modules"])
    assert any("Aggregate Demand And Aggregate Supply" in title for title in section_titles)
    assert all("Orientation and vocabulary" not in title for title in section_titles)
    assert all("Essential concepts" not in title for title in section_titles)
    assert all(not title.startswith("Define ") for title in section_titles)


def test_generation_outline_fallback_uses_prompt_goals_for_macro_example() -> None:
    with db.SessionLocal() as session:
        outline = build_outline(
            session,
            prompt="Create an undergraduate macroeconomics course.",
            desired_module_count=8,
            free_only=False,
            trust_min=0,
            level="undergrad",
            learning_goals=MACROECONOMICS_GOALS,
        )

    all_keywords = {
        keyword.lower()
        for module in outline["modules"]
        for section in module["sections"]
        for keyword in section.get("concept_keywords", [])
    }

    assert outline["provenance"]["mode"] == "coverage-checklist-fallback"
    assert outline["coverageChecklist"]["courseKind"] == "prompt_inferred"
    assert outline["coverageChecklist"]["source"] == "prompt_goals"
    assert outline["coverageAllocationReport"]["status"] == "passed"
    assert {
        "inflation and price indexes",
        "aggregate demand and aggregate supply",
        "money banking and monetary policy",
    }.issubset(all_keywords)
    assert "stoichiometry" not in all_keywords


def test_section_planning_uses_lesson_titles_when_module_concepts_are_missing() -> None:
    report = run_module_section_plan_workflow(
        {
            "id": "module-1",
            "title": "Module 1: Choice, Scarcity, and Market Coordination",
            "lessonTitles": [
                "Opportunity Cost and Marginal Thinking",
                "Demand, Supply, and Market Equilibrium",
            ],
        },
        fallback_source_ids=[],
        module_number=1,
    )

    plans = report["artifacts"]["sectionPlans"]

    assert plans[0]["conceptKeywords"] == ["Opportunity Cost", "Marginal Thinking"]
    assert plans[1]["conceptKeywords"] == ["Demand", "Supply", "Market Equilibrium"]
    assert all("Choice, Scarcity, and Market Coordination" not in plan["conceptKeywords"] for plan in plans)


def test_needs_sources_course_preserves_coverage_handoff_metadata() -> None:
    with db.SessionLocal() as session:
        snapshot = create_needs_sources_course_snapshot(
            session,
            prompt=MACROECONOMICS_PROMPT,
            learner_id=None,
            level="undergrad",
            language="en",
            source_policy="free-only",
            desired_module_count=8,
            expected_duration_minutes=180,
            source_urls=[],
            category="business-management",
            department="economics",
        )
        structure = snapshot.structure

    metadata = structure["metadata"]
    sections = [section for module in structure["modules"] for section in module["sections"]]
    inflation_sections = [section for section in sections if section.get("coverageItemId") == "inflation-and-price-indexes"]

    assert metadata["courseCoverageChecklist"]["courseKind"] == "prompt_inferred"
    assert metadata["courseCoverageChecklist"]["source"] == "prompt_phrases"
    assert metadata["courseCoverageAllocationReport"]["status"] == "passed"
    assert metadata["generationPlan"]["coverageAllocationStatus"] == "passed"
    assert len(structure["modules"]) == 8
    assert inflation_sections
    assert all(section["content"] == [] for section in sections)
    assert all(section["metadata"]["generationOutline"]["assignedCoverageItemIds"] for section in sections)
    assert all(section["metadata"]["generationOutline"]["coverageMustTeach"] for section in sections)
    assert any(
        "inflation and price indexes" in section["metadata"]["generationOutline"]["coverageMustTeach"]
        for section in inflation_sections
    )


def test_section_fill_uses_coverage_handoff_for_prompt_inferred_content() -> None:
    outline = build_outline_from_coverage_checklist(
        prompt="Create an undergraduate macroeconomics course.",
        desired_module_count=8,
        level="undergrad",
        goals=MACROECONOMICS_GOALS,
    )
    inflation_module = next(
        module
        for module in outline["modules"]
        if "inflation-and-price-indexes" in module["assignedCoverageItemIds"]
    )
    plan_result = run_module_section_plan_workflow(inflation_module)
    section_plan, planned_section = next(
        (plan, section)
        for plan, section in zip(
            plan_result["artifacts"]["sectionPlans"],
            plan_result["artifacts"]["plannedSections"],
            strict=True,
        )
        if "applied" in plan["title"].lower()
    )

    result = run_section_fill_workflow(
        section_plan,
        planned_section=planned_section,
        module_outline=plan_result["artifacts"]["plannedModule"],
    )
    section = result["artifacts"]["section"]
    lesson_text = " ".join(str(block.get("value") or "") for block in section["content"])

    assert result["status"] == "passed"
    assert section["metadata"]["generationOutline"]["coverageItemId"] == "inflation-and-price-indexes"
    assert "Inflation And Price Indexes" in lesson_text
    assert "realistic case" in lesson_text
    assert "evidence" in lesson_text.lower()
    assert "stoichiometry" not in lesson_text.lower()
    assert any(
        block.get("type") == "conceptCard" and block.get("title") == "Inflation And Price Indexes"
        for block in section["content"]
    )
