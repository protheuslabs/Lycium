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


def _all_section_titles(outline: dict) -> list[str]:
    return [
        str(section.get("title") or "")
        for module in outline.get("modules", [])
        if isinstance(module, dict)
        for section in module.get("sections", [])
        if isinstance(section, dict)
    ]


def test_chem_105_coverage_checklist_includes_required_intro_chemistry_topics() -> None:
    checklist = build_course_coverage_checklist(
        prompt="Create a CHEM 105 general chemistry course for first-year college students.",
        level="undergrad",
    )
    required_items = checklist["requiredItems"]
    required_ids = {item["id"] for item in required_items}
    must_teach = {
        concept.lower()
        for item in required_items
        for concept in item["mustTeach"]
    }

    assert checklist["contractVersion"] == COURSE_COVERAGE_CHECKLIST_CONTRACT
    assert checklist["courseKind"] == "intro_college_chemistry"
    assert {
        "measurement-scientific-method",
        "stoichiometry",
        "bonding-lewis-geometry-hybridization",
        "kinetics-equilibrium-acids-bases-redox",
    }.issubset(required_ids)
    assert {"scientific method", "stoichiometry", "hybridization", "acid", "base"}.issubset(must_teach)
    assert all(item["sectionPlans"] for item in required_items)


def test_coverage_outline_assigns_required_items_to_modules_and_sections() -> None:
    outline = build_outline_from_coverage_checklist(
        prompt="Create a CHEM 105 general chemistry course.",
        desired_module_count=12,
        level="undergrad",
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
    assert len(outline["modules"]) == 12
    assert any("stoichiometry" in module["title"].lower() for module in outline["modules"])
    assert any("Lewis structures" in title for title in section_titles)
    assert all("Orientation and vocabulary" not in title for title in section_titles)
    assert all("Essential concepts" not in title for title in section_titles)


def test_generation_outline_fallback_uses_coverage_checklist_for_chemistry() -> None:
    with db.SessionLocal() as session:
        outline = build_outline(
            session,
            prompt="Create a CHEM 105 general chemistry course with college-level essentials.",
            desired_module_count=12,
            free_only=False,
            trust_min=0,
            level="undergrad",
            learning_goals=[],
        )

    all_keywords = {
        keyword.lower()
        for module in outline["modules"]
        for section in module["sections"]
        for keyword in section.get("concept_keywords", [])
    }

    assert outline["provenance"]["mode"] == "coverage-checklist-fallback"
    assert outline["coverageChecklist"]["courseKind"] == "intro_college_chemistry"
    assert outline["coverageAllocationReport"]["status"] == "passed"
    assert {"stoichiometry", "hybridization", "acid", "base"}.issubset(all_keywords)


def test_needs_sources_course_preserves_coverage_handoff_metadata() -> None:
    with db.SessionLocal() as session:
        snapshot = create_needs_sources_course_snapshot(
            session,
            prompt="Create a CHEM 105 general chemistry course.",
            learner_id=None,
            level="undergrad",
            language="en",
            source_policy="free-only",
            desired_module_count=12,
            expected_duration_minutes=180,
            source_urls=[],
            category="natural-sciences-mathematics",
            department="chemistry",
        )
        structure = snapshot.structure

    metadata = structure["metadata"]
    sections = [section for module in structure["modules"] for section in module["sections"]]
    stoich_sections = [section for section in sections if section.get("coverageItemId") == "stoichiometry"]

    assert metadata["courseCoverageChecklist"]["courseKind"] == "intro_college_chemistry"
    assert metadata["courseCoverageAllocationReport"]["status"] == "passed"
    assert metadata["generationPlan"]["coverageAllocationStatus"] == "passed"
    assert len(structure["modules"]) == 12
    assert stoich_sections
    assert all(section["content"] == [] for section in sections)
    assert all(section["metadata"]["generationOutline"]["assignedCoverageItemIds"] for section in sections)
    assert all(section["metadata"]["generationOutline"]["coverageMustTeach"] for section in sections)
    assert any(
        "stoichiometry" in section["metadata"]["generationOutline"]["coverageMustTeach"]
        for section in stoich_sections
    )


def test_section_fill_uses_coverage_handoff_for_real_chemistry_content() -> None:
    outline = build_outline_from_coverage_checklist(
        prompt="Create a CHEM 105 general chemistry course.",
        desired_module_count=12,
        level="undergrad",
    )
    stoich_module = next(
        module
        for module in outline["modules"]
        if "stoichiometry" in module["assignedCoverageItemIds"]
    )
    plan_result = run_module_section_plan_workflow(stoich_module)
    section_plan, planned_section = next(
        (plan, section)
        for plan, section in zip(
            plan_result["artifacts"]["sectionPlans"],
            plan_result["artifacts"]["plannedSections"],
            strict=True,
        )
        if "stoichiometric" in plan["title"].lower()
    )

    result = run_section_fill_workflow(
        section_plan,
        planned_section=planned_section,
        module_outline=plan_result["artifacts"]["plannedModule"],
    )
    section = result["artifacts"]["section"]
    lesson_text = " ".join(str(block.get("value") or "") for block in section["content"])

    assert result["status"] == "passed"
    assert section["metadata"]["generationOutline"]["coverageItemId"] == "stoichiometry"
    assert "Stoichiometry uses balanced equations and mole ratios" in lesson_text
    assert "2 H2 + O2 -> 2 H2O" in lesson_text
    assert "limiting" in lesson_text.lower()
    assert any(block.get("type") == "conceptCard" and block.get("title") == "Stoichiometry" for block in section["content"])
