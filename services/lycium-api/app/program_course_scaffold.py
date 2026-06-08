from __future__ import annotations

import re
from typing import Any


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "program"


def _known_course_index(
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for course_id in known_course_ids or set():
        index[_slugify(course_id)] = {"courseId": course_id, "title": course_id}
    for course in known_courses or []:
        course_id = str(course.get("courseId") or course.get("id") or course.get("key") or "").strip()
        title = str(course.get("title") or course_id).strip()
        if course_id:
            index[_slugify(course_id)] = {"courseId": course_id, "title": title}
        if title:
            index[_slugify(title)] = {"courseId": course_id or _slugify(title), "title": title}
    return index


def build_course_scaffold_plan(
    groups: list[dict[str, Any]],
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    known_index = _known_course_index(known_course_ids, known_courses)
    clusters: list[dict[str, Any]] = []
    courses: list[dict[str, Any]] = []

    def course_action(course_id: str, title: str) -> dict[str, str]:
        existing = known_index.get(_slugify(course_id)) or known_index.get(_slugify(title))
        if existing:
            return {
                "action": "link_existing_course",
                "status": "existing_course_available",
                "existingCourseId": str(existing.get("courseId") or course_id),
            }
        return {"action": "create_empty_course", "status": "needs_course_buildout"}

    def visit(requirement: dict[str, Any], group: dict[str, Any]) -> None:
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            course_id = str(requirement.get("courseId") or "")
            title = str(requirement.get("title") or course_id)
            courses.append({
                "clusterId": group["id"],
                "requirementId": requirement["id"],
                "courseId": course_id,
                "title": title,
                **course_action(course_id, title),
                "estimatedHours": requirement.get("estimatedHours"),
                "importance": requirement.get("importance") or "required",
            })
        elif requirement_type == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested, group)
        elif requirement_type == "complete_n_of_courses":
            for course_id in requirement.get("courseIds") or []:
                if isinstance(course_id, str) and course_id:
                    courses.append({
                        "clusterId": group["id"],
                        "requirementId": requirement["id"],
                        "courseId": course_id,
                        "title": course_id,
                        **course_action(course_id, course_id),
                        "estimatedHours": requirement.get("estimatedHours"),
                        "importance": requirement.get("importance") or "required",
                    })

    for group in groups:
        clusters.append({
            "clusterId": group["id"],
            "title": str(group.get("displayName") or group.get("title") or group["id"]),
            "action": "create_cluster",
            "locked": False,
            "estimatedHours": group.get("estimatedHours"),
        })
        for requirement in _items(group.get("requirements")):
            visit(requirement, group)

    return {
        "version": "program-course-scaffold-plan-v1",
        "clusterCount": len(clusters),
        "courseCount": len(courses),
        "clusters": clusters,
        "courses": courses,
    }


def apply_existing_course_links(
    groups: list[dict[str, Any]],
    scaffold_plan: dict[str, Any],
) -> int:
    link_targets = {
        str(course.get("courseId")): str(course.get("existingCourseId"))
        for course in _items(scaffold_plan.get("courses"))
        if course.get("action") == "link_existing_course"
        and course.get("courseId")
        and course.get("existingCourseId")
    }
    if not link_targets:
        return 0

    linked_count = 0

    def visit(requirement: dict[str, Any]) -> None:
        nonlocal linked_count
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            course_id = str(requirement.get("courseId") or "")
            existing_course_id = link_targets.get(course_id)
            if existing_course_id:
                requirement["generatedCourseId"] = course_id
                requirement["linkedExistingCourseId"] = existing_course_id
                requirement["courseId"] = existing_course_id
                linked_count += 1
        elif requirement_type == "complete_n_of_courses":
            next_course_ids: list[str] = []
            for course_id in requirement.get("courseIds") or []:
                if not isinstance(course_id, str):
                    continue
                existing_course_id = link_targets.get(course_id)
                next_course_ids.append(existing_course_id or course_id)
                if existing_course_id:
                    linked_count += 1
            requirement["courseIds"] = next_course_ids
        elif requirement_type == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested)

    for group in groups:
        for requirement in _items(group.get("requirements")):
            visit(requirement)

    return linked_count
