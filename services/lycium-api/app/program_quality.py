from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.program_validation import validate_program_contract


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


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
    packet_count = len(_items(trace.get("coursePackets")))

    gates = [
        _gate("program_intake", bool(program.get("title") and program.get("targetOutcome")), []),
        _gate("requirement_group_structure", len(groups) >= 3 and len(requirements) >= 4, [] if len(groups) >= 3 else ["Program should contain multiple requirement groups."]),
        _gate("completion_rule_feasibility", not validation_errors, validation_errors),
        _gate("dependency_graph_validity", bool(dependency_edges), [] if dependency_edges else ["Program should include dependency graph edges."]),
        _gate("source_coverage", packet_count > 0, [] if packet_count else ["Program generation trace should include learning packets or source coverage."], {"coursePacketCount": packet_count}),
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
        },
        "checkedAt": _now(),
    }
