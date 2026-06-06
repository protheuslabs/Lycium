from __future__ import annotations

from typing import Any

from app.course_generation_scenario_specs import PROGRAM_SCENARIOS
from app.course_generation_scenarios import _check, _finding, _items, _keyword_present, _scenario_report, _text


def _program_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("program") if isinstance(payload.get("program"), dict) else payload


def _program_text_and_metrics(payload: dict[str, Any]) -> dict[str, Any]:
    program = _program_from_payload(payload)
    groups = _items(program.get("requirementGroups"))
    requirements: list[dict[str, Any]] = []

    def visit(requirement: dict[str, Any]) -> None:
        requirements.append(requirement)
        if requirement.get("type") == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested)

    for group in groups:
        for requirement in _items(group.get("requirements")):
            visit(requirement)

    dependency_edges = _items((program.get("dependencyGraph") or {}).get("edges") if isinstance(program.get("dependencyGraph"), dict) else [])
    text_parts = [_text(program.get(key)) for key in ("title", "description", "field", "targetOutcome")]
    for group in groups:
        text_parts.extend(_text(group.get(key)) for key in ("title", "displayName", "description", "purpose", "groupKind"))
    for requirement in requirements:
        text_parts.extend(_text(requirement.get(key)) for key in ("title", "description", "type", "courseId", "assessmentId", "projectId"))
        course_ids = requirement.get("courseIds")
        if isinstance(course_ids, list):
            text_parts.extend(str(course_id) for course_id in course_ids)

    quality_report = payload.get("qualityReport") if isinstance(payload.get("qualityReport"), dict) else {}
    generation_trace = payload.get("generationTrace") if isinstance(payload.get("generationTrace"), dict) else {}
    benchmark_context = (
        generation_trace.get("curriculumBenchmarkContext")
        if isinstance(generation_trace.get("curriculumBenchmarkContext"), dict)
        else {}
    )
    synthesis = generation_trace.get("programSynthesis") if isinstance(generation_trace.get("programSynthesis"), dict) else {}
    source_slots = _items(benchmark_context.get("sourceSlots"))
    covered_source_slots = sum(1 for slot in source_slots if slot.get("primarySourceId") or slot.get("primarySourceRef"))
    gate_metrics = quality_report.get("gateMetrics") if isinstance(quality_report.get("gateMetrics"), dict) else {}
    report_metrics = quality_report.get("metrics") if isinstance(quality_report.get("metrics"), dict) else {}
    source_coverage = gate_metrics.get("source_coverage") or gate_metrics.get("sourceCoverage") or report_metrics
    course_requirement_coverage = 0.0
    if isinstance(source_coverage, dict):
        value = source_coverage.get("coverageRatio") or source_coverage.get("courseRequirementCoverageRatio")
        if isinstance(value, (int, float)):
            course_requirement_coverage = float(value)

    return {
        "groupCount": len(groups),
        "courseRequirementCount": sum(1 for requirement in requirements if requirement.get("type") in {"complete_course", "complete_n_of_courses"}),
        "assessmentRequirementCount": sum(1 for requirement in requirements if requirement.get("type") == "pass_assessment"),
        "projectRequirementCount": sum(1 for requirement in requirements if requirement.get("type") == "submit_project"),
        "dependencyEdgeCount": len(dependency_edges),
        "qualityPassed": bool(quality_report.get("passed")),
        "qualityScore": quality_report.get("score"),
        "benchmarkCount": len(_items(benchmark_context.get("curriculumBenchmarks"))),
        "requirementOriginCount": len(_items(benchmark_context.get("requirementOrigins"))),
        "sourceSlotCount": len(source_slots),
        "sourceSlotPrimaryCoverageRatio": covered_source_slots / len(source_slots) if source_slots else 0,
        "courseRequirementCoverageRatio": course_requirement_coverage,
        "generationMode": synthesis.get("mode"),
        "textBlob": "\n".join(text_parts),
    }

def evaluate_program_generation_scenario(program_payload: dict[str, Any], scenario_id: str) -> dict[str, Any]:
    if scenario_id not in PROGRAM_SCENARIOS:
        raise ValueError(f"Unknown program generation scenario '{scenario_id}'")
    spec = PROGRAM_SCENARIOS[scenario_id]
    metrics = _program_text_and_metrics(program_payload)
    text_blob = metrics["textBlob"]
    covered_groups = [keyword for keyword in spec["requiredGroupKeywords"] if _keyword_present(text_blob, keyword)]
    covered_requirements = [keyword for keyword in spec["requiredRequirementKeywords"] if _keyword_present(text_blob, keyword)]
    requirement_coverage = len(covered_requirements) / len(spec["requiredRequirementKeywords"])

    checks = [
        _check(
            key="requirement_group_shape",
            label="Requirement-group shape",
            score=min(1.0, metrics["groupCount"] / spec["minRequirementGroups"]) * 0.45
            + min(1.0, len(covered_groups) / len(spec["requiredGroupKeywords"])) * 0.55,
            findings=[
                *([] if metrics["groupCount"] >= spec["minRequirementGroups"] else [_finding("error", f"Expected at least {spec['minRequirementGroups']} requirement groups.")]),
                *([] if len(covered_groups) / len(spec["requiredGroupKeywords"]) >= 0.7 else [_finding("error", "Program groups do not cover the expected scenario domains.")]),
            ],
            metrics={"groupCount": metrics["groupCount"], "coveredGroupKeywordCount": len(covered_groups)},
        ),
        _check(
            key="requirement_coverage",
            label="Requirement coverage",
            score=requirement_coverage,
            findings=[
                *([] if metrics["courseRequirementCount"] >= spec["minCourseRequirements"] else [_finding("error", f"Expected at least {spec['minCourseRequirements']} course requirements.")]),
                *([] if requirement_coverage >= spec["minRequiredKeywordCoverage"] else [_finding("error", "Program course requirements miss expected scenario topics.")]),
            ],
            metrics={"courseRequirementCount": metrics["courseRequirementCount"], "coveredRequirementKeywordCount": len(covered_requirements), "coverage": round(requirement_coverage, 2)},
        ),
        _check(
            key="evidence_and_assessment",
            label="Assessment and portfolio evidence",
            score=min(1.0, metrics["assessmentRequirementCount"] / spec["minAssessmentRequirements"]) * 0.45
            + min(1.0, metrics["projectRequirementCount"] / spec["minProjectRequirements"]) * 0.55,
            findings=[
                *([] if metrics["assessmentRequirementCount"] >= spec["minAssessmentRequirements"] else [_finding("error", "Program needs more assessment requirements.")]),
                *([] if metrics["projectRequirementCount"] >= spec["minProjectRequirements"] else [_finding("error", "Program needs a project/capstone requirement.")]),
            ],
            metrics={key: metrics[key] for key in ("assessmentRequirementCount", "projectRequirementCount")},
        ),
        _check(
            key="dependency_graph",
            label="Prerequisite dependency graph",
            score=min(1.0, metrics["dependencyEdgeCount"] / spec["minDependencyEdges"]),
            findings=[] if metrics["dependencyEdgeCount"] >= spec["minDependencyEdges"] else [_finding("error", "Program dependency graph is too thin.")],
            metrics={"dependencyEdgeCount": metrics["dependencyEdgeCount"]},
        ),
    ]

    if spec.get("requiresQualityReport"):
        checks.append(
            _check(
                key="program_quality_report",
                label="Program quality report",
                score=1.0 if metrics["qualityPassed"] else 0.0,
                findings=[] if metrics["qualityPassed"] else [_finding("error", "Program quality report did not pass.")],
                metrics={"qualityPassed": metrics["qualityPassed"], "qualityScore": metrics["qualityScore"]},
            )
        )

    if spec.get("requiresBenchmarkEvidence"):
        minimum_benchmarks = int(spec.get("minBenchmarkCount") or 1)
        minimum_origins = int(spec.get("minRequirementOriginCount") or 1)
        minimum_source_slots = int(spec.get("minSourceSlotCount") or 1)
        source_slot_target = float(spec.get("minSourceSlotPrimaryCoverageRatio") or 0.0)
        course_coverage_target = float(spec.get("minCourseRequirementCoverageRatio") or 0.0)
        checks.append(
            _check(
                key="benchmark_evidence",
                label="Benchmark and source evidence",
                score=(
                    min(1.0, metrics["benchmarkCount"] / minimum_benchmarks) * 0.25
                    + min(1.0, metrics["requirementOriginCount"] / minimum_origins) * 0.25
                    + min(1.0, metrics["sourceSlotCount"] / minimum_source_slots) * 0.2
                    + min(1.0, metrics["sourceSlotPrimaryCoverageRatio"] / max(source_slot_target, 0.01)) * 0.15
                    + min(1.0, metrics["courseRequirementCoverageRatio"] / max(course_coverage_target, 0.01)) * 0.15
                ),
                findings=[
                    *([] if metrics["benchmarkCount"] >= minimum_benchmarks else [_finding("error", f"Expected at least {minimum_benchmarks} curriculum benchmarks.")]),
                    *([] if metrics["requirementOriginCount"] >= minimum_origins else [_finding("error", f"Expected at least {minimum_origins} requirement origins.")]),
                    *([] if metrics["sourceSlotCount"] >= minimum_source_slots else [_finding("error", f"Expected at least {minimum_source_slots} source slots.")]),
                    *([] if metrics["sourceSlotPrimaryCoverageRatio"] >= source_slot_target else [_finding("error", f"Expected source slot primary coverage >= {source_slot_target:.2f}.")]),
                    *([] if metrics["courseRequirementCoverageRatio"] >= course_coverage_target else [_finding("error", f"Expected course requirement source coverage >= {course_coverage_target:.2f}.")]),
                ],
                metrics={
                    "benchmarkCount": metrics["benchmarkCount"],
                    "requirementOriginCount": metrics["requirementOriginCount"],
                    "sourceSlotCount": metrics["sourceSlotCount"],
                    "sourceSlotPrimaryCoverageRatio": round(metrics["sourceSlotPrimaryCoverageRatio"], 2),
                    "courseRequirementCoverageRatio": round(metrics["courseRequirementCoverageRatio"], 2),
                },
            )
        )

    required_generation_mode = spec.get("requiredGenerationMode")
    if isinstance(required_generation_mode, str):
        checks.append(
            _check(
                key="generation_mode",
                label="Generation mode",
                score=1.0 if metrics["generationMode"] == required_generation_mode else 0.0,
                findings=[] if metrics["generationMode"] == required_generation_mode else [_finding("error", f"Expected generation mode {required_generation_mode}.")],
                metrics={"generationMode": metrics["generationMode"]},
            )
        )
    return _scenario_report(scenario_id=scenario_id, label=spec["label"], kind="program", checks=checks)


