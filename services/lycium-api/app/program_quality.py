from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.program_validation import validate_program_contract


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _packet_has_evidence(packet: dict[str, Any]) -> bool:
    learning_packet = packet.get("learningPacket") if isinstance(packet.get("learningPacket"), dict) else {}
    object_ids = learning_packet.get("object_ids")
    return isinstance(object_ids, list) and bool(object_ids)


def _course_source_coverage(requirements: list[dict[str, Any]], course_packets: list[dict[str, Any]]) -> dict[str, Any]:
    packet_requirement_ids = {str(packet.get("requirementId")) for packet in course_packets if _packet_has_evidence(packet)}
    packet_course_ids = {str(packet.get("courseId")) for packet in course_packets if _packet_has_evidence(packet)}
    required_items = 0
    covered_items = 0
    missing: list[str] = []

    def visit(requirement: dict[str, Any], label: str) -> None:
        nonlocal required_items, covered_items
        requirement_type = requirement.get("type")
        requirement_id = str(requirement.get("id") or label)
        if requirement_type == "complete_course":
            required_items += 1
            course_id = str(requirement.get("courseId") or "")
            if requirement_id in packet_requirement_ids or course_id in packet_course_ids:
                covered_items += 1
            else:
                missing.append(requirement_id)
        elif requirement_type == "complete_n_of_courses":
            required_items += 1
            course_ids = [str(course_id) for course_id in requirement.get("courseIds", []) if isinstance(course_id, str)]
            count = int(requirement.get("count") or 1)
            covered_choices = sum(1 for course_id in course_ids if course_id in packet_course_ids)
            if covered_choices >= min(count, len(course_ids)):
                covered_items += 1
            else:
                missing.append(requirement_id)
        elif requirement_type == "requirement_set":
            for index, nested in enumerate(_items(requirement.get("requirements"))):
                visit(nested, f"{requirement_id}.requirements[{index}]")

    for index, requirement in enumerate(requirements):
        visit(requirement, f"requirement[{index}]")

    coverage_ratio = covered_items / required_items if required_items else 1.0
    return {
        "requiredCourseRequirementCount": required_items,
        "coveredCourseRequirementCount": covered_items,
        "courseRequirementCoverageRatio": round(coverage_ratio, 4),
        "missingCourseRequirementIds": missing[:10],
    }


def _program_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("program") if isinstance(payload.get("program"), dict) else payload


def _gate(name: str, passed: bool, issues: list[str], metrics: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "gate": name,
        "status": "passed" if passed else "failed",
        "issues": [{"severity": "error", "message": issue} for issue in issues],
        "metrics": metrics or {},
    }


def assess_program_quality(payload: dict[str, Any]) -> dict[str, Any]:
    program = _program_from_payload(payload)
    groups = _items(program.get("requirementGroups"))
    requirements = [requirement for group in groups for requirement in _items(group.get("requirements"))]
    validation_errors = validate_program_contract(program)
    capstone_groups = [group for group in groups if group.get("groupKind") == "capstone"]
    assessment_count = sum(1 for requirement in requirements if requirement.get("type") == "pass_assessment")
    project_count = sum(1 for requirement in requirements if requirement.get("type") == "submit_project")
    dependency_edges = _items((program.get("dependencyGraph") or {}).get("edges") if isinstance(program.get("dependencyGraph"), dict) else [])
    trace = payload.get("generationTrace") if isinstance(payload.get("generationTrace"), dict) else {}
    course_packets = _items(trace.get("coursePackets"))
    packet_count = len(course_packets)
    source_coverage = _course_source_coverage(requirements, course_packets)
    source_coverage_passed = (
        packet_count > 0
        and source_coverage["requiredCourseRequirementCount"] > 0
        and source_coverage["courseRequirementCoverageRatio"] >= 0.8
    )

    gates = [
        _gate("program_intake", bool(program.get("title") and program.get("targetOutcome")), []),
        _gate("requirement_group_structure", len(groups) >= 3 and len(requirements) >= 4, [] if len(groups) >= 3 else ["Program should contain multiple requirement groups."]),
        _gate("completion_rule_feasibility", not validation_errors, validation_errors),
        _gate("dependency_graph_validity", bool(dependency_edges), [] if dependency_edges else ["Program should include dependency graph edges."]),
        _gate(
            "source_coverage",
            source_coverage_passed,
            []
            if source_coverage_passed
            else ["Program generation trace should cover at least 80% of course-bearing requirements with source-backed packets."],
            {"coursePacketCount": packet_count, **source_coverage},
        ),
        _gate("assessment_coverage", assessment_count > 0, [] if assessment_count else ["Program should include at least one assessment requirement."]),
        _gate("capstone_coverage", bool(capstone_groups and project_count), [] if capstone_groups and project_count else ["Program should include a capstone group with a project requirement."]),
        _gate("credential_policy", isinstance(program.get("credentialPolicy"), dict), [] if isinstance(program.get("credentialPolicy"), dict) else ["Program should include a credential policy."]),
        _gate("progress_rollup", bool(requirements), [] if requirements else ["Program progress cannot roll up without requirements."]),
    ]
    failed = [gate for gate in gates if gate["status"] == "failed"]
    gates.append(_gate("publish_readiness", not failed, [f"Failed gates must be resolved before publish: {', '.join(gate['gate'] for gate in failed)}."] if failed else []))
    score = round(max(0.0, 1 - len(failed) * 0.12), 2)
    return {
        "workflowVersion": "program-quality-workflow-v1",
        "passed": not failed,
        "score": score,
        "gates": gates,
        "metrics": {
            "groupCount": len(groups),
            "requirementCount": len(requirements),
            "assessmentRequirementCount": assessment_count,
            "projectRequirementCount": project_count,
            "dependencyEdgeCount": len(dependency_edges),
            "failedGateCount": len(failed),
            **source_coverage,
        },
        "checkedAt": _now(),
    }
