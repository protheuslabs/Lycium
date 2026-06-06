from __future__ import annotations

from typing import Any

from app.course_generation_scenarios import evaluate_program_generation_scenario
from app.course_generation_scenario_specs import PROGRAM_SCENARIOS
from app.curriculum_benchmarks import compile_curriculum_benchmark_context
from app.program_contract_builder import build_program_contract
from app.program_quality import assess_program_quality
from app.program_validation import validate_program_contract


BENCHMARK_FIRST_PROGRAM_SCENARIOS = (
    "chemistry-foundations-program",
    "data-science-analytics-program",
    "public-health-foundations-program",
)


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _flatten_requirements(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flattened: list[dict[str, Any]] = []
    for requirement in requirements:
        flattened.append(requirement)
        if requirement.get("type") == "requirement_set":
            flattened.extend(_flatten_requirements(_items(requirement.get("requirements"))))
    return flattened


def _course_requirements(program: dict[str, Any]) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    for group in _items(program.get("requirementGroups")):
        requirements.extend(_flatten_requirements(_items(group.get("requirements"))))
    return [requirement for requirement in requirements if requirement.get("type") == "complete_course"]


def _generated_program_from_scenario(scenario_id: str) -> dict[str, Any]:
    spec = PROGRAM_SCENARIOS[scenario_id]
    source_documents = _items(spec.get("sourceDocuments"))
    benchmark_context = compile_curriculum_benchmark_context(
        prompt=spec["generationGoal"],
        source_urls=[str(document["url"]) for document in source_documents if isinstance(document.get("url"), str)],
        source_documents=source_documents,
    )
    program, course_requirements, synthesis = build_program_contract(
        spec["generationGoal"],
        spec.get("level"),
        int(spec.get("desiredCourseCount") or 12),
        benchmark_context=benchmark_context,
    )
    known_requirements = _course_requirements(program)
    if not course_requirements:
        course_requirements = known_requirements
    course_packets = [
        {
            "courseId": str(requirement.get("courseId") or ""),
            "requirementId": str(requirement.get("id") or ""),
            "title": str(requirement.get("title") or ""),
            "learningPacket": {
                "object_ids": [f"object-{requirement.get('courseId') or requirement.get('id')}"]
            },
        }
        for requirement in known_requirements
    ]
    envelope = {
        "contractVersion": "0.1.0",
        "program": program,
        "generationTrace": {
            "goal": spec["generationGoal"],
            "curriculumBenchmarkContext": benchmark_context,
            "programSynthesis": synthesis,
            "coursePackets": course_packets,
        },
    }
    validation_errors = validate_program_contract(program)
    envelope["contractValidation"] = {"passed": not validation_errors, "errors": validation_errors}
    envelope["qualityReport"] = assess_program_quality(envelope)
    return envelope


def test_benchmark_first_program_generation_scenarios_pass_contract_quality_and_eval() -> None:
    for scenario_id in BENCHMARK_FIRST_PROGRAM_SCENARIOS:
        generated = _generated_program_from_scenario(scenario_id)

        assert generated["contractValidation"]["passed"], scenario_id
        assert generated["qualityReport"]["passed"], scenario_id
        report = evaluate_program_generation_scenario(generated, scenario_id)
        assert report["status"] == "passed", (scenario_id, report["recommendations"])
        assert report["metrics"]["failedCheckCount"] == 0


def test_program_builder_falls_back_to_valid_generic_contract_without_benchmarks() -> None:
    program, course_requirements, synthesis = build_program_contract(
        "creative writing portfolio pathway",
        "undergraduate",
        6,
        benchmark_context={},
    )

    assert validate_program_contract(program) == []
    assert synthesis["mode"] == "goal_token_fallback"
    assert len(course_requirements) >= 6
