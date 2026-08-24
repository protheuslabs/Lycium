from __future__ import annotations

from typing import Any

from app.course_generation_scenarios import evaluate_course_template_generation_scenario
from app.course_generation_scenario_specs import GOLDEN_COURSE_TEMPLATES
from app.course_generation_stage_workflows import run_course_template_workflow


def _scenario_prompt(spec: dict[str, Any]) -> str:
    required_keywords = ", ".join(str(keyword) for keyword in spec.get("requiredKeywords", []))
    return f"Create a {spec['label']} course covering {required_keywords}."


def _scenario_source_packet(scenario_id: str, spec: dict[str, Any]) -> dict[str, Any]:
    source_blueprint = spec.get("sourceBlueprint") if isinstance(spec.get("sourceBlueprint"), dict) else {}
    source_records = source_blueprint.get("freeSourceRecords") if isinstance(source_blueprint.get("freeSourceRecords"), list) else []
    if not source_records:
        keywords = [str(keyword) for keyword in spec.get("requiredKeywords", [])]
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
                "description": source.get("description") or source.get("title") or spec["label"],
                "url": source.get("url"),
            }
            for index, source in enumerate(source_records, start=1)
            if isinstance(source, dict)
        ],
    }


def test_golden_course_template_workflow_scenarios_pass() -> None:
    for scenario_id, spec in GOLDEN_COURSE_TEMPLATES.items():
        result = run_course_template_workflow(
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

        report = evaluate_course_template_generation_scenario(result, scenario_id)
        template = result["artifacts"]["courseTemplate"]

        assert report["status"] == "passed", (scenario_id, report["recommendations"], report["checks"])
        assert template["handoff"]["requiredCoverageItemIds"] == [
            item["id"] for item in template["courseCoverageChecklist"]["requiredItems"]
        ]
        assert "modules" not in template
        assert "sections" not in template
        assert "content" not in template


def test_course_template_scenario_rejects_materialized_payloads() -> None:
    scenario_id = "macroeconomics-principles"
    spec = GOLDEN_COURSE_TEMPLATES[scenario_id]
    result = run_course_template_workflow(
        prompt=_scenario_prompt(spec),
        level="undergrad",
        desired_module_count=10,
        source_packet=_scenario_source_packet(scenario_id, spec),
        category=spec["expectedCategory"],
        department=spec["expectedDepartment"],
    )
    result["artifacts"]["courseTemplate"]["modules"] = []

    report = evaluate_course_template_generation_scenario(result, scenario_id)

    assert report["status"] == "failed"
    assert any(
        finding["message"] == "Template workflow must not materialize modules, sections, build tasks, or content."
        for check in report["checks"]
        for finding in check["findings"]
    )


def test_course_template_scenario_rejects_workflow_facing_catalog_description() -> None:
    scenario_id = "macroeconomics-principles"
    spec = GOLDEN_COURSE_TEMPLATES[scenario_id]
    result = run_course_template_workflow(
        prompt=_scenario_prompt(spec),
        level="undergrad",
        desired_module_count=10,
        source_packet=_scenario_source_packet(scenario_id, spec),
        category=spec["expectedCategory"],
        department=spec["expectedDepartment"],
    )
    result["artifacts"]["courseTemplate"][
        "shortDescription"
    ] = "A structured course template for staged module and section planning."

    report = evaluate_course_template_generation_scenario(result, scenario_id)

    assert report["status"] == "failed"
    assert any(
        finding["message"] == "Catalog description should describe the course, not the workflow artifact."
        for check in report["checks"]
        for finding in check["findings"]
    )
