from __future__ import annotations

from typing import Any

from app.course_generation_scenarios import evaluate_module_section_plan_generation_scenario
from app.course_generation_scenario_specs import GOLDEN_COURSE_TEMPLATES
from app.course_generation_stage_workflows import (
    run_course_module_outline_workflow,
    run_course_template_workflow,
    run_module_section_plan_workflow,
)


def _scenario_prompt(spec: dict[str, Any]) -> str:
    required_keywords = ", ".join(str(keyword) for keyword in spec.get("requiredKeywords", []))
    return f"Create a {spec['label']} course covering {required_keywords}."


def _scenario_source_packet(scenario_id: str, spec: dict[str, Any]) -> dict[str, Any]:
    keywords = [str(keyword) for keyword in spec.get("requiredKeywords", [])]
    source_blueprint = spec.get("sourceBlueprint") if isinstance(spec.get("sourceBlueprint"), dict) else {}
    source_records = source_blueprint.get("freeSourceRecords") if isinstance(source_blueprint.get("freeSourceRecords"), list) else []
    if not source_records:
        source_records = [
            {
                "id": f"source-{scenario_id}-{index}",
                "title": f"{spec['label']} reference {index}",
                "description": ", ".join(keywords[index - 1 :: 3]),
            }
            for index in range(1, 4)
        ]
    return {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1.0,
            "uncoveredConceptCandidates": [],
        },
        "sources": [
            {
                "id": source.get("id") or f"source-{scenario_id}-{index}",
                "title": source.get("title") or f"{spec['label']} source {index}",
                "description": source.get("description") or source.get("title") or ", ".join(keywords),
                "url": source.get("url"),
            }
            for index, source in enumerate(source_records, start=1)
            if isinstance(source, dict)
        ],
    }


def _course_template_for_scenario(scenario_id: str, spec: dict[str, Any]) -> dict[str, Any]:
    template_result = run_course_template_workflow(
        prompt=_scenario_prompt(spec),
        level="undergrad",
        target_audience="college learners",
        desired_module_count=int(spec.get("minModules") or 10),
        expected_duration_minutes=int(spec.get("minModules") or 10) * 90,
        source_policy="balanced",
        source_packet=_scenario_source_packet(scenario_id, spec),
        category=spec["expectedCategory"],
        department=spec["expectedDepartment"],
    )
    return template_result["artifacts"]["courseTemplate"]


def _module_section_plan_payload_for_scenario(scenario_id: str, spec: dict[str, Any]) -> dict[str, Any]:
    template = _course_template_for_scenario(scenario_id, spec)
    outline_result = run_course_module_outline_workflow(
        prompt=_scenario_prompt(spec),
        source_packet=_scenario_source_packet(scenario_id, spec),
        desired_module_count=int(spec.get("minModules") or 10),
        sections_per_module=3,
        course_template=template,
    )
    outline = outline_result["artifacts"]["outline"]
    reports = [
        run_module_section_plan_workflow(module, module_number=index)
        for index, module in enumerate(outline["modules"], start=1)
    ]
    return {
        "courseCoverageChecklist": template["courseCoverageChecklist"],
        "outline": outline,
        "moduleSectionPlanReports": reports,
    }


def test_golden_module_section_plan_workflow_scenarios_pass() -> None:
    for scenario_id, spec in GOLDEN_COURSE_TEMPLATES.items():
        payload = _module_section_plan_payload_for_scenario(scenario_id, spec)

        report = evaluate_module_section_plan_generation_scenario(payload, scenario_id)
        required_ids = {
            item["id"]
            for item in payload["courseCoverageChecklist"]["requiredItems"]
        }
        planned_sections = [
            section
            for workflow_report in payload["moduleSectionPlanReports"]
            for section in workflow_report["artifacts"]["plannedSections"]
        ]
        assigned_ids = {
            item_id
            for section in planned_sections
            for item_id in section["metadata"]["generationOutline"]["assignedCoverageItemIds"]
        }

        assert report["status"] == "passed", (scenario_id, report["recommendations"], report["checks"])
        assert len(planned_sections) >= int(spec["minModules"]) * 2
        assert required_ids <= assigned_ids
        assert all(section["content"] == [] for section in planned_sections)
        assert all(section["sourceIds"] == [] for section in planned_sections)
        assert all(
            section["metadata"]["generationOutline"]["contentStatus"] == "planned_empty"
            for section in planned_sections
        )
        assert all(
            section["metadata"]["generationOutline"]["nextWorkflow"] == "section_fill"
            for section in planned_sections
        )


def test_module_section_plan_scenario_rejects_early_learner_content() -> None:
    scenario_id = "macroeconomics-principles"
    spec = GOLDEN_COURSE_TEMPLATES[scenario_id]
    payload = _module_section_plan_payload_for_scenario(scenario_id, spec)
    payload["moduleSectionPlanReports"][0]["artifacts"]["plannedSections"][0]["content"] = [
        {"type": "text", "value": "This content belongs to the section-fill workflow."}
    ]

    report = evaluate_module_section_plan_generation_scenario(payload, scenario_id)

    assert report["status"] == "failed"
    assert any(
        "Planned section shells must keep content empty until section fill" in finding["message"]
        for check in report["checks"]
        for finding in check["findings"]
    )


def test_module_section_plan_scenario_rejects_lost_coverage_handoff() -> None:
    scenario_id = "macroeconomics-principles"
    spec = GOLDEN_COURSE_TEMPLATES[scenario_id]
    payload = _module_section_plan_payload_for_scenario(scenario_id, spec)
    target_id = payload["courseCoverageChecklist"]["requiredItems"][0]["id"]

    for workflow_report in payload["moduleSectionPlanReports"]:
        artifacts = workflow_report["artifacts"]
        for section_plan in artifacts["sectionPlans"]:
            section_plan["assignedCoverageItemIds"] = [
                item_id for item_id in section_plan["assignedCoverageItemIds"] if item_id != target_id
            ]
            if section_plan.get("coverageItemId") == target_id:
                section_plan["coverageItemId"] = ""
        for section in artifacts["plannedSections"]:
            section["assignedCoverageItemIds"] = [
                item_id for item_id in section["assignedCoverageItemIds"] if item_id != target_id
            ]
            if section.get("coverageItemId") == target_id:
                section["coverageItemId"] = ""
            generation_outline = section["metadata"]["generationOutline"]
            generation_outline["assignedCoverageItemIds"] = [
                item_id for item_id in generation_outline["assignedCoverageItemIds"] if item_id != target_id
            ]
            if generation_outline.get("coverageItemId") == target_id:
                generation_outline["coverageItemId"] = ""

    report = evaluate_module_section_plan_generation_scenario(payload, scenario_id)

    assert report["status"] == "failed"
    assert any(
        "Coverage items were not assigned to planned sections" in finding["message"]
        for check in report["checks"]
        for finding in check["findings"]
    )
