from __future__ import annotations

from typing import Any

from app.course_generation_scenarios import evaluate_course_module_outline_generation_scenario
from app.course_generation_scenario_specs import GOLDEN_COURSE_TEMPLATES
from app.course_generation_stage_workflows import run_course_module_outline_workflow, run_course_template_workflow


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


def test_golden_course_module_outline_workflow_scenarios_pass() -> None:
    for scenario_id, spec in GOLDEN_COURSE_TEMPLATES.items():
        template = _course_template_for_scenario(scenario_id, spec)
        result = run_course_module_outline_workflow(
            prompt=_scenario_prompt(spec),
            source_packet=_scenario_source_packet(scenario_id, spec),
            desired_module_count=int(spec.get("minModules") or 10),
            sections_per_module=3,
            course_template=template,
        )

        report = evaluate_course_module_outline_generation_scenario(result, scenario_id)
        outline = result["artifacts"]["outline"]
        quality = result["artifacts"]["outlineQualityReport"]

        assert report["status"] == "passed", (scenario_id, report["recommendations"], report["checks"])
        assert len(outline["modules"]) >= int(spec["minModules"])
        assert all("sections" not in module for module in outline["modules"])
        assert all(module["assignedCoverageItemIds"] for module in outline["modules"])
        assert quality["metrics"]["requiredCoverageItemCount"] == len(template["courseCoverageChecklist"]["requiredItems"])
        assert quality["metrics"]["unassignedCoverageItemCount"] == 0


def test_course_module_outline_scenario_rejects_unassigned_coverage() -> None:
    scenario_id = "macroeconomics-principles"
    spec = GOLDEN_COURSE_TEMPLATES[scenario_id]
    template = _course_template_for_scenario(scenario_id, spec)
    result = run_course_module_outline_workflow(
        prompt=_scenario_prompt(spec),
        source_packet=_scenario_source_packet(scenario_id, spec),
        desired_module_count=int(spec.get("minModules") or 10),
        sections_per_module=3,
        course_template=template,
    )
    result["artifacts"]["outline"]["modules"][0]["assignedCoverageItemIds"] = []

    report = evaluate_course_module_outline_generation_scenario(result, scenario_id)

    assert report["status"] == "failed"
    assert any(
        "Coverage items were not assigned to modules" in finding["message"]
        for check in report["checks"]
        for finding in check["findings"]
    )


def test_course_module_outline_scenario_rejects_section_plans_or_content() -> None:
    scenario_id = "macroeconomics-principles"
    spec = GOLDEN_COURSE_TEMPLATES[scenario_id]
    template = _course_template_for_scenario(scenario_id, spec)
    result = run_course_module_outline_workflow(
        prompt=_scenario_prompt(spec),
        source_packet=_scenario_source_packet(scenario_id, spec),
        desired_module_count=int(spec.get("minModules") or 10),
        sections_per_module=3,
        course_template=template,
    )
    result["artifacts"]["outline"]["modules"][0]["sections"] = [
        {
            "id": "too-early-section",
            "title": "This belongs to the section-planning workflow",
            "content": [],
        }
    ]

    report = evaluate_course_module_outline_generation_scenario(result, scenario_id)

    assert report["status"] == "failed"
    assert any(
        finding["message"] == "Module outline workflow must not create section plans, sections, or learner-facing content."
        for check in report["checks"]
        for finding in check["findings"]
    )
