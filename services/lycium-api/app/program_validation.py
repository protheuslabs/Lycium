from __future__ import annotations

from typing import Any


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _has_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _requirement_ids(requirement: dict[str, Any]) -> list[str]:
    ids = [str(requirement["id"])] if _has_text(requirement.get("id")) else []
    if requirement.get("type") == "requirement_set":
        for nested in _items(requirement.get("requirements")):
            ids.extend(_requirement_ids(nested))
    return ids


def _requirement_hours(requirement: dict[str, Any]) -> float:
    if isinstance(requirement.get("estimatedHours"), int | float):
        return float(requirement["estimatedHours"])
    if requirement.get("type") == "earn_hours" and isinstance(requirement.get("minimumHours"), int | float):
        return float(requirement["minimumHours"])
    if requirement.get("type") == "requirement_set":
        return sum(_requirement_hours(nested) for nested in _items(requirement.get("requirements")))
    return 0.0


def _has_assessment(requirement: dict[str, Any], assessment_id: str) -> bool:
    if requirement.get("type") == "pass_assessment":
        return requirement.get("assessmentId") == assessment_id
    return requirement.get("type") == "requirement_set" and any(_has_assessment(nested, assessment_id) for nested in _items(requirement.get("requirements")))


def _has_project(requirement: dict[str, Any], project_id: str) -> bool:
    if requirement.get("type") == "submit_project":
        return requirement.get("projectId") == project_id
    return requirement.get("type") == "requirement_set" and any(_has_project(nested, project_id) for nested in _items(requirement.get("requirements")))


def _validate_requirement(requirement: dict[str, Any], label: str) -> list[str]:
    errors: list[str] = []
    requirement_type = requirement.get("type")
    if not _has_text(requirement.get("id")):
        errors.append(f"{label}.id is required.")
    if requirement_type == "complete_course" and not _has_text(requirement.get("courseId")):
        errors.append(f"{label}.courseId is required.")
    if requirement_type == "complete_n_of_courses":
        course_ids = requirement.get("courseIds")
        count = requirement.get("count")
        if not isinstance(count, int | float) or count < 1:
            errors.append(f"{label}.count must be at least 1.")
        if not isinstance(course_ids, list) or not course_ids:
            errors.append(f"{label}.courseIds must include at least one course.")
        elif isinstance(count, int | float) and count > len(course_ids):
            errors.append(f"{label}.count cannot exceed available courseIds.")
    if requirement_type == "pass_assessment" and not _has_text(requirement.get("assessmentId")):
        errors.append(f"{label}.assessmentId is required.")
    if requirement_type == "submit_project" and not _has_text(requirement.get("projectId")):
        errors.append(f"{label}.projectId is required.")
    if requirement_type == "demonstrate_competency" and not _has_text(requirement.get("competencyId")):
        errors.append(f"{label}.competencyId is required.")
    if requirement_type == "earn_hours" and (not isinstance(requirement.get("minimumHours"), int | float) or requirement["minimumHours"] <= 0):
        errors.append(f"{label}.minimumHours must be greater than 0.")
    if requirement_type == "requirement_set":
        nested = _items(requirement.get("requirements"))
        if not nested:
            errors.append(f"{label}.requirements must include at least one nested requirement.")
        if requirement.get("operator") == "n_of" and (not isinstance(requirement.get("count"), int | float) or requirement["count"] < 1):
            errors.append(f"{label}.count must be at least 1 when operator is n_of.")
        if requirement.get("operator") == "n_of" and isinstance(requirement.get("count"), int | float) and requirement["count"] > len(nested):
            errors.append(f"{label}.count cannot exceed nested requirements length.")
        for index, nested_requirement in enumerate(nested):
            errors.extend(_validate_requirement(nested_requirement, f"{label}.requirements[{index}]"))
    return errors


def _validate_completion_rule(group: dict[str, Any], label: str) -> list[str]:
    errors: list[str] = []
    rule = group.get("completionRule") if isinstance(group.get("completionRule"), dict) else {}
    requirements = _items(group.get("requirements"))
    rule_type = rule.get("type")
    if not _has_text(rule_type):
        return [f"{label}.completionRule.type is required."]
    if rule_type == "complete_n_of" and rule.get("count", 0) > len([req for req in requirements if req.get("required") is not False]):
        errors.append(f"{label}.completionRule.count cannot exceed required requirement count.")
    if rule_type == "earn_minimum_hours" and rule.get("hours", 0) > sum(_requirement_hours(req) for req in requirements):
        errors.append(f"{label}.completionRule.hours cannot exceed available estimated requirement hours.")
    if rule_type == "pass_assessment" and not any(_has_assessment(req, str(rule.get("assessmentId") or "")) for req in requirements):
        errors.append(f"{label}.completionRule.assessmentId must reference an assessment requirement in the group.")
    if rule_type == "submit_project" and not any(_has_project(req, str(rule.get("projectId") or "")) for req in requirements):
        errors.append(f"{label}.completionRule.projectId must reference a project requirement in the group.")
    return errors


def _cycle_errors(edges: list[dict[str, Any]]) -> list[str]:
    graph: dict[str, list[str]] = {}
    for edge in edges:
        graph.setdefault(str(edge.get("fromNodeId") or ""), []).append(str(edge.get("toNodeId") or ""))
    visiting: set[str] = set()
    visited: set[str] = set()
    errors: list[str] = []

    def visit(node: str, path: list[str]) -> None:
        if node in visiting:
            errors.append(f"program.dependencyGraph contains a cycle: {' -> '.join([*path, node])}.")
            return
        if node in visited:
            return
        visiting.add(node)
        for next_node in graph.get(node, []):
            visit(next_node, [*path, node])
        visiting.remove(node)
        visited.add(node)

    for node in graph:
        visit(node, [])
    return errors


def validate_program_contract(program: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for key in ("id", "title", "description", "programType", "field", "level", "targetOutcome", "version", "reviewStatus"):
        if not _has_text(program.get(key)):
            errors.append(f"program.{key} is required.")
    if not isinstance(program.get("estimatedHours"), int | float) or program["estimatedHours"] <= 0:
        errors.append("program.estimatedHours must be greater than 0.")
    groups = _items(program.get("requirementGroups"))
    if not groups:
        errors.append("program.requirementGroups must include at least one group.")

    node_ids: set[str] = {str(program.get("id") or "")}
    group_ids: set[str] = set()
    requirement_ids: set[str] = set()
    has_capstone = False

    for group_index, group in enumerate(groups):
        label = f"program.requirementGroups[{group_index}]"
        group_id = str(group.get("id") or "")
        if not _has_text(group_id):
            errors.append(f"{label}.id is required.")
        elif group_id in group_ids:
            errors.append(f"{label}.id is duplicated: {group_id}.")
        group_ids.add(group_id)
        node_ids.add(group_id)
        if group.get("groupKind") == "capstone":
            has_capstone = True
        errors.extend(_validate_completion_rule(group, label))
        for requirement_index, requirement in enumerate(_items(group.get("requirements"))):
            errors.extend(_validate_requirement(requirement, f"{label}.requirements[{requirement_index}]"))
            if requirement.get("type") == "submit_project":
                has_capstone = True
            for requirement_id in _requirement_ids(requirement):
                if requirement_id in requirement_ids:
                    errors.append(f"{label}.requirements[{requirement_index}].id is duplicated: {requirement_id}.")
                requirement_ids.add(requirement_id)
                node_ids.add(requirement_id)

    mastery_policy = program.get("masteryPolicy") if isinstance(program.get("masteryPolicy"), dict) else {}
    if program.get("programType") in {"career_path", "degree_equivalent"} or mastery_policy.get("requiresCapstone"):
        if not has_capstone:
            errors.append("program requires a capstone group or project requirement.")

    edges = _items((program.get("dependencyGraph") or {}).get("edges") if isinstance(program.get("dependencyGraph"), dict) else [])
    for index, edge in enumerate(edges):
        if edge.get("fromNodeId") not in node_ids:
            errors.append(f"program.dependencyGraph.edges[{index}].fromNodeId is not a known node: {edge.get('fromNodeId')}.")
        if edge.get("toNodeId") not in node_ids:
            errors.append(f"program.dependencyGraph.edges[{index}].toNodeId is not a known node: {edge.get('toNodeId')}.")
    errors.extend(_cycle_errors(edges))
    return errors
