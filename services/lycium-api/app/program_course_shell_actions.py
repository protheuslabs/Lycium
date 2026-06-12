from __future__ import annotations

from typing import Any

from app.course_build_task_reports import summarize_course_build_task


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _values(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _priority_for(summary: dict[str, Any]) -> int:
    if summary.get("blocked"):
        return 10
    if "source_packet" in _values(summary.get("requiredInputs")):
        return 20
    stage = summary.get("currentStage")
    if stage == "outline_ready":
        return 30
    if stage == "section_generation_ready":
        return 40
    if summary.get("status") == "linked_existing_course":
        return 50
    if stage == "ready_for_review":
        return 60
    return 90


def _action_kind(summary: dict[str, Any]) -> str:
    if summary.get("blocked"):
        return "inspect_blocked_transition"
    if "source_packet" in _values(summary.get("requiredInputs")):
        return "attach_source_packet"
    next_action = str(summary.get("nextAction") or "")
    if next_action:
        return next_action
    stage = str(summary.get("currentStage") or "")
    if stage == "outline_ready":
        return "generate_course_outline"
    if stage == "section_generation_ready":
        return "generate_course_sections"
    if stage == "ready_for_review":
        return "review_and_publish"
    return "inspect_course_shell"


def _rationale(summary: dict[str, Any]) -> str:
    action = _action_kind(summary)
    if action == "attach_source_packet":
        return "Course shell needs a usable source packet before outline generation."
    if action == "generate_course_outline":
        return "Course shell has enough source evidence to create a structured outline."
    if action == "generate_course_sections":
        return "Course shell has an outline and can generate editor-native sections."
    if action == "review_and_publish":
        return "Course shell is ready for human review before publishing."
    if action == "review_existing_course_fit":
        return "Existing course should be checked against the generated requirement."
    if action == "inspect_blocked_transition":
        return "A transition report blocked progress and needs repair."
    return "Course shell needs inspection before the next generation step."


def _missing_task_action(course: dict[str, Any]) -> dict[str, Any]:
    course_id = str(course.get("courseId") or "")
    return {
        "contractVersion": "program-course-shell-action-v1",
        "priority": 0,
        "action": "repair_course_build_task",
        "status": "invalid",
        "courseId": course_id,
        "title": str(course.get("title") or course_id),
        "clusterId": str(course.get("clusterId") or ""),
        "requirementId": str(course.get("requirementId") or ""),
        "currentStage": "unknown",
        "nextAction": "repair_course_build_task",
        "requiredInputs": ["course_build_task"],
        "rationale": "Course shell is missing its course-build task ledger.",
    }


def _course_action(course: dict[str, Any]) -> dict[str, Any]:
    summary = summarize_course_build_task(course)
    action = _action_kind(summary)
    row = {
        "contractVersion": "program-course-shell-action-v1",
        "priority": _priority_for(summary),
        "action": action,
        "status": str(summary.get("status") or "unknown"),
        "courseId": summary["courseId"],
        "title": summary["title"],
        "clusterId": str(course.get("clusterId") or ""),
        "requirementId": str(course.get("requirementId") or ""),
        "currentStage": summary["currentStage"],
        "nextAction": action,
        "requiredInputs": summary["requiredInputs"],
        "prerequisiteCourseIds": summary["prerequisiteCourseIds"],
        "rationale": _rationale(summary),
    }
    source_request = course.get("sourceRequest")
    if isinstance(source_request, dict) and action == "attach_source_packet":
        row["sourceRequest"] = source_request
    return row


def _count_by_key(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = str(row.get(key) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


def build_program_course_shell_action_plan(
    *,
    clusters: list[dict[str, Any]],
    courses: list[dict[str, Any]],
) -> dict[str, Any]:
    cluster_rows = _items(clusters)
    course_rows = _items(courses)
    actions = [
        _course_action(course) if isinstance(course.get("courseBuildTask"), dict) else _missing_task_action(course)
        for course in course_rows
    ]
    actions.sort(key=lambda action: (int(action.get("priority") or 99), str(action.get("clusterId") or ""), str(action.get("title") or "")))
    source_request_count = sum(1 for action in actions if isinstance(action.get("sourceRequest"), dict))
    if any(action["status"] == "invalid" for action in actions):
        status = "invalid"
    elif any(action["action"] == "inspect_blocked_transition" for action in actions):
        status = "blocked"
    elif any(action["action"] == "attach_source_packet" for action in actions):
        status = "needs_sources"
    elif any(action["action"] in {"generate_course_outline", "generate_course_sections"} for action in actions):
        status = "generation_ready"
    elif actions and all(action["action"] in {"review_and_publish", "review_existing_course_fit"} for action in actions):
        status = "ready_for_review"
    else:
        status = "in_progress" if actions else "empty"
    return {
        "contractVersion": "program-course-shell-action-plan-v1",
        "status": status,
        "clusterCount": len(cluster_rows),
        "courseCount": len(course_rows),
        "actionCount": len(actions),
        "sourceRequestCount": source_request_count,
        "actionCounts": _count_by_key(actions, "action"),
        "stageCounts": _count_by_key(actions, "currentStage"),
        "actions": actions,
        "nextActions": actions[:10],
    }
