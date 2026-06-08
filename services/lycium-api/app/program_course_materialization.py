from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.course_source_gaps import create_needs_sources_course_snapshot
from app.models import CourseSnapshot, ProgramSnapshot


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _estimated_minutes(value: Any) -> int:
    try:
        hours = float(value)
    except (TypeError, ValueError):
        hours = 30.0
    return max(30, int(hours * 60))


def _course_title(scaffold_course: dict[str, Any]) -> str:
    title = _text(scaffold_course.get("title") or scaffold_course.get("courseId"))
    return title or "Draft Course"


def _course_tags(title: str, cluster_title: str, field: str) -> list[str]:
    terms = [field, cluster_title, title]
    tags: list[str] = []
    for term in terms:
        for piece in term.replace("/", " ").replace("&", " ").split():
            clean = piece.strip(".,:;()[]{}").lower()
            if len(clean) >= 4 and clean not in tags:
                tags.append(clean)
            if len(tags) >= 8:
                return tags
    return tags


def _course_taxonomy(title: str, cluster_title: str, field: str) -> tuple[str, str]:
    value = f"{title} {cluster_title} {field}".lower()
    if any(term in value for term in ("organic chemistry", "general chemistry", "chemistry", "chemical", "stoichiometry")):
        return "natural-sciences-mathematics", "chemistry"
    if any(term in value for term in ("biology", "biological", "genetics", "cell", "anatomy", "physiology", "biochemistry", "microbiology")):
        return "natural-sciences-mathematics", "biology"
    if any(term in value for term in ("physics", "mechanics", "electricity", "magnetism")):
        return "natural-sciences-mathematics", "physics"
    if any(term in value for term in ("calculus", "algebra", "mathematics")):
        return "natural-sciences-mathematics", "mathematics"
    if any(term in value for term in ("statistics", "biostatistics", "quantitative")):
        return "natural-sciences-mathematics", "statistics"
    if "psychology" in value:
        return "social-sciences", "psychology"
    if "sociology" in value:
        return "social-sciences", "sociology"
    if any(term in value for term in ("epidemiology", "public health", "population health")):
        return "public-health", "epidemiology"
    if any(term in value for term in ("clinical", "patient", "medical", "healthcare", "service")):
        return "health-sciences", "clinical-laboratory-science"
    if any(term in value for term in ("software", "programming", "systems", "application", "developer")):
        return "computing-information-sciences", "computer-science"
    return "interdisciplinary-studies", "interdisciplinary-studies"


def _annotate_snapshot(
    snapshot: CourseSnapshot,
    *,
    program: ProgramSnapshot,
    scaffold_course: dict[str, Any],
    cluster: dict[str, Any] | None,
    category: str,
    department: str,
    tags: list[str],
) -> CourseSnapshot:
    structure = dict(snapshot.structure or {})
    metadata = dict(structure.get("metadata") or {})
    title = _course_title(scaffold_course)
    cluster_title = _text(cluster.get("displayName") if cluster else scaffold_course.get("clusterId"))
    short_description = f"Draft course shell for the {cluster_title} cluster. Add sources before generating full content."

    metadata.update(
        {
            "programSnapshotId": program.id,
            "programId": _text((program.structure or {}).get("program", {}).get("id")),
            "programTitle": program.title,
            "clusterId": _text(scaffold_course.get("clusterId")),
            "clusterTitle": cluster_title,
            "requirementId": _text(scaffold_course.get("requirementId")),
            "scaffoldCourseId": _text(scaffold_course.get("courseId")),
            "courseScaffoldAction": "create_empty_course",
            "courseScaffoldStatus": "needs_course_buildout",
        }
    )
    structure.update(
        {
            "title": title,
            "shortDescription": short_description,
            "category": category,
            "department": department,
            "tags": tags,
            "metadata": metadata,
        }
    )
    snapshot.title = title
    snapshot.structure = structure
    snapshot.generation_trace = {
        **(snapshot.generation_trace if isinstance(snapshot.generation_trace, dict) else {}),
        "programSnapshotId": program.id,
        "programId": metadata["programId"],
        "clusterId": metadata["clusterId"],
        "requirementId": metadata["requirementId"],
        "scaffoldCourseId": metadata["scaffoldCourseId"],
    }
    flag_modified(snapshot, "structure")
    flag_modified(snapshot, "generation_trace")
    return snapshot


def materialize_program_course_scaffold(
    session: Session,
    *,
    program: ProgramSnapshot,
    structure: dict[str, Any],
    learner_id: int | None,
    level: str | None,
    source_policy: str,
) -> dict[str, Any]:
    trace = structure.get("generationTrace") if isinstance(structure.get("generationTrace"), dict) else {}
    synthesis = trace.get("programSynthesis") if isinstance(trace.get("programSynthesis"), dict) else {}
    plan = dict(synthesis.get("courseScaffoldPlan") if isinstance(synthesis.get("courseScaffoldPlan"), dict) else {})
    scaffold_courses = _items(plan.get("courses"))
    program_contract = structure.get("program") if isinstance(structure.get("program"), dict) else {}
    field = _text(program_contract.get("field"))
    clusters = {
        _text(group.get("id")): group
        for group in _items(program_contract.get("requirementGroups"))
        if _text(group.get("id"))
    }

    materialized_count = 0
    linked_count = 0
    updated_courses: list[dict[str, Any]] = []

    for scaffold_course in scaffold_courses:
        course_row = dict(scaffold_course)
        if course_row.get("action") == "link_existing_course":
            linked_count += 1
            updated_courses.append(course_row)
            continue
        if course_row.get("action") != "create_empty_course":
            updated_courses.append(course_row)
            continue

        title = _course_title(course_row)
        cluster = clusters.get(_text(course_row.get("clusterId")))
        cluster_title = _text(cluster.get("displayName") if cluster else course_row.get("clusterId"))
        category, department = _course_taxonomy(title, cluster_title, field)
        tags = _course_tags(title, cluster_title, field)
        snapshot = create_needs_sources_course_snapshot(
            session,
            prompt=title,
            learner_id=learner_id,
            level=level,
            language="en",
            source_policy=source_policy,
            desired_module_count=4,
            expected_duration_minutes=_estimated_minutes(course_row.get("estimatedHours")),
            source_urls=[],
            category=category,
            department=department,
        )
        _annotate_snapshot(
            snapshot,
            program=program,
            scaffold_course=course_row,
            cluster=cluster,
            category=category,
            department=department,
            tags=tags,
        )
        materialized_count += 1
        course_row.update(
            {
                "status": "needs_sources",
                "materializedSnapshotId": snapshot.id,
                "materializedCourseKey": _text(course_row.get("courseId")),
                "category": category,
                "department": department,
            }
        )
        updated_courses.append(course_row)

    plan["courses"] = updated_courses
    plan["materializedCourseCount"] = materialized_count
    plan["linkedExistingCourseCount"] = linked_count
    plan["pendingCourseCount"] = len(updated_courses) - materialized_count - linked_count
    synthesis["courseScaffoldPlan"] = plan
    synthesis["courseScaffoldSummary"] = {
        "status": "materialized" if materialized_count else "no_new_course_shells",
        "materializedCourseCount": materialized_count,
        "linkedExistingCourseCount": linked_count,
        "courseCount": len(updated_courses),
    }
    trace["programSynthesis"] = synthesis
    structure["generationTrace"] = trace
    program.structure = structure
    flag_modified(program, "structure")
    return synthesis["courseScaffoldSummary"]
