from __future__ import annotations

import re
from typing import Any

from app.course_build_task_reports import build_course_build_task_report, build_program_course_shell_readiness_report
from app.program_course_shell_actions import build_program_course_shell_action_plan
from app.program_source_acquisition import build_program_source_acquisition_plan


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


def _requirement_course_ids(requirements: list[dict[str, Any]]) -> list[str]:
    course_ids: list[str] = []

    def add_course_id(course_id: Any) -> None:
        clean = str(course_id or "").strip()
        if clean and clean not in course_ids:
            course_ids.append(clean)

    def visit(requirement: dict[str, Any]) -> None:
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            add_course_id(requirement.get("courseId"))
        elif requirement_type == "complete_n_of_courses":
            for course_id in requirement.get("courseIds") or []:
                add_course_id(course_id)
        elif requirement_type == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested)

    for requirement in requirements:
        visit(requirement)
    return course_ids


def _course_build_task(
    *,
    course_id: str,
    title: str,
    action: str,
    status: str,
    prerequisite_course_ids: list[str],
    importance: str,
) -> dict[str, Any]:
    if action == "link_existing_course":
        return {
            "contractVersion": "course-build-task-v1",
            "courseId": course_id,
            "title": title,
            "status": "linked_existing_course",
            "nextAction": "review_existing_course_fit",
            "requiredInputs": [],
            "prerequisiteCourseIds": prerequisite_course_ids,
            "importance": importance,
        }
    return {
        "contractVersion": "course-build-task-v1",
        "courseId": course_id,
        "title": title,
        "status": "source_gathering",
        "nextAction": "attach_source_packet",
        "requiredInputs": ["source_packet", "concept_source_coverage"],
        "prerequisiteCourseIds": prerequisite_course_ids,
        "importance": importance,
        "stageOrder": ["source_gathering", "outline_ready", "section_generation_ready", "ready_for_review"],
        "currentStage": "source_gathering" if status == "needs_course_buildout" else status,
    }


def _source_request_for_requirement(
    *,
    goal_title: str,
    requirement: dict[str, Any],
    course_id: str,
    title: str,
) -> dict[str, Any]:
    origin = requirement.get("origin") if isinstance(requirement.get("origin"), dict) else {}
    evidence_refs = [
        str(value)
        for value in origin.get("evidenceRefs", [])
        if isinstance(value, str) and value.strip()
    ] if isinstance(origin.get("evidenceRefs"), list) else []
    required_concepts = [
        str(value)
        for value in (
            origin.get("concepts")
            or origin.get("topics")
            or origin.get("requiredConcepts")
            or []
        )
        if isinstance(value, str) and value.strip()
    ] if isinstance(origin.get("concepts") or origin.get("topics") or origin.get("requiredConcepts"), list) else []
    if not required_concepts:
        required_concepts = [title.replace(" Course", "").strip()]
    queries: list[str] = []
    for concept in required_concepts[:4]:
        queries.extend(
            [
                f"{goal_title} {concept} syllabus",
                f"{concept} open educational resource",
                f"{concept} lecture notes",
            ]
        )
    return {
        "contractVersion": "course-source-request-v1",
        "courseId": course_id,
        "title": title,
        "requirementId": str(requirement.get("id") or ""),
        "importance": str(requirement.get("importance") or "required"),
        "requiredConcepts": required_concepts[:12],
        "suggestedQueries": queries[:12],
        "sourceTypeHints": ["syllabus", "open_textbook", "lecture_notes", "video", "practice"],
        "minimumConceptCoverageRatio": 0.7,
        "evidenceRefs": evidence_refs[:10],
    }


def build_course_scaffold_plan(
    groups: list[dict[str, Any]],
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    known_index = _known_course_index(known_course_ids, known_courses)
    clusters: list[dict[str, Any]] = []
    courses: list[dict[str, Any]] = []
    prior_group_course_ids: list[str] = []

    def course_action(course_id: str, title: str) -> dict[str, str]:
        existing = known_index.get(_slugify(course_id)) or known_index.get(_slugify(title))
        if existing:
            return {
                "action": "link_existing_course",
                "status": "existing_course_available",
                "existingCourseId": str(existing.get("courseId") or course_id),
            }
        return {"action": "create_empty_course", "status": "needs_course_buildout"}

    def visit(requirement: dict[str, Any], group: dict[str, Any], prerequisite_course_ids: list[str]) -> None:
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            course_id = str(requirement.get("courseId") or "")
            title = str(requirement.get("title") or course_id)
            action = course_action(course_id, title)
            importance = str(requirement.get("importance") or "required")
            source_request = _source_request_for_requirement(
                goal_title=str(group.get("title") or group.get("displayName") or title),
                requirement=requirement,
                course_id=course_id,
                title=title,
            )
            courses.append({
                "clusterId": group["id"],
                "requirementId": requirement["id"],
                "courseId": course_id,
                "title": title,
                **action,
                "estimatedHours": requirement.get("estimatedHours"),
                "importance": importance,
                "prerequisiteCourseIds": prerequisite_course_ids,
                "sourceRequest": source_request if action["action"] == "create_empty_course" else None,
                "courseBuildTask": _course_build_task(
                    course_id=course_id,
                    title=title,
                    action=action["action"],
                    status=action["status"],
                    prerequisite_course_ids=prerequisite_course_ids,
                    importance=importance,
                ),
            })
        elif requirement_type == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested, group, prerequisite_course_ids)
        elif requirement_type == "complete_n_of_courses":
            for course_id in requirement.get("courseIds") or []:
                if isinstance(course_id, str) and course_id:
                    action = course_action(course_id, course_id)
                    importance = str(requirement.get("importance") or "required")
                    source_request = _source_request_for_requirement(
                        goal_title=str(group.get("title") or group.get("displayName") or course_id),
                        requirement=requirement,
                        course_id=course_id,
                        title=course_id,
                    )
                    courses.append({
                        "clusterId": group["id"],
                        "requirementId": requirement["id"],
                        "courseId": course_id,
                        "title": course_id,
                        **action,
                        "estimatedHours": requirement.get("estimatedHours"),
                        "importance": importance,
                        "prerequisiteCourseIds": prerequisite_course_ids,
                        "sourceRequest": source_request if action["action"] == "create_empty_course" else None,
                        "courseBuildTask": _course_build_task(
                            course_id=course_id,
                            title=course_id,
                            action=action["action"],
                            status=action["status"],
                            prerequisite_course_ids=prerequisite_course_ids,
                            importance=importance,
                        ),
                    })

    for group in groups:
        group_requirements = _items(group.get("requirements"))
        prerequisite_course_ids = list(prior_group_course_ids)
        clusters.append({
            "clusterId": group["id"],
            "title": str(group.get("displayName") or group.get("title") or group["id"]),
            "action": "create_cluster",
            "locked": False,
            "estimatedHours": group.get("estimatedHours"),
            "prerequisiteCourseIds": prerequisite_course_ids,
        })
        for requirement in group_requirements:
            visit(requirement, group, prerequisite_course_ids)
        group_course_ids = _requirement_course_ids(group_requirements)
        if group_course_ids:
            prior_group_course_ids = group_course_ids

    return {
        "version": "program-course-scaffold-plan-v1",
        "clusterCount": len(clusters),
        "courseCount": len(courses),
        "clusters": clusters,
        "courses": courses,
        "courseBuildTaskReport": build_course_build_task_report(courses),
        "courseShellReadinessReport": build_program_course_shell_readiness_report(
            clusters=clusters,
            courses=courses,
        ),
        "courseShellActionPlan": build_program_course_shell_action_plan(
            clusters=clusters,
            courses=courses,
        ),
        "sourceAcquisitionPlan": build_program_source_acquisition_plan(
            clusters=clusters,
            courses=courses,
        ),
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
