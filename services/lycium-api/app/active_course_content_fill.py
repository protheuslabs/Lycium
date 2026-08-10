from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy.orm.attributes import flag_modified

from app.course_generation_stage_workflows import (
    compact_stage_workflow_report,
    run_module_apply_section_workflow,
    run_module_assembly_workflow,
    run_module_summary_section_workflow,
    run_section_fill_workflow,
)
from app.models import CourseSnapshot

ACTIVE_CONTENT_FILL_CONTRACT = "active-course-content-fill-orchestrator-v1"

FillScope = Literal["course", "module", "section"]


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _unique_strings(values: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = str(value or "").strip()
        if not clean or clean in seen:
            continue
        unique.append(clean)
        seen.add(clean)
    return unique


def _metadata(value: dict[str, Any]) -> dict[str, Any]:
    metadata = value.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    value["metadata"] = {}
    return value["metadata"]


def _generation_outline(section: dict[str, Any]) -> dict[str, Any]:
    metadata = section.get("metadata") if isinstance(section.get("metadata"), dict) else {}
    outline = metadata.get("generationOutline")
    return outline if isinstance(outline, dict) else {}


def _content_blocks(section: dict[str, Any]) -> list[dict[str, Any]]:
    return _items(section.get("content"))


def _is_lesson_section(section: dict[str, Any]) -> bool:
    page_type = str(section.get("pageType") or "learn").lower()
    section_type = str(section.get("sectionType") or "lesson").lower()
    return page_type == "learn" and section_type not in {"summary", "assessment", "quiz", "project"}


def _section_needs_fill(section: dict[str, Any], *, retry_filled: bool) -> bool:
    if not _is_lesson_section(section):
        return False
    if retry_filled:
        return True
    outline = _generation_outline(section)
    content_status = str(outline.get("contentStatus") or "").lower()
    next_workflow = str(outline.get("nextWorkflow") or "").lower()
    return not _content_blocks(section) or content_status in {"planned_empty", "fill_failed"} or next_workflow == "section_fill"


def _section_plan_from_planned_section(section: dict[str, Any], module: dict[str, Any]) -> dict[str, Any]:
    outline = _generation_outline(section)
    outline_role = str(outline.get("role") or "lesson")
    planned_source_ids = _strings(outline.get("plannedSourceIds"))
    candidate_source_ids = _strings(outline.get("candidateSourceIds"))
    section_source_ids = _strings(section.get("sourceIds"))
    module_source_ids = _strings(module.get("sourceIds"))
    coverage_item_ids = _unique_strings(
        _strings(outline.get("assignedCoverageItemIds") or outline.get("coverageItemIds"))
        or _strings(section.get("assignedCoverageItemIds") or section.get("coverageItemIds"))
    )
    coverage_item_id = str(
        outline.get("coverageItemId")
        or section.get("coverageItemId")
        or (coverage_item_ids[0] if coverage_item_ids else "")
    ).strip()
    if coverage_item_id and coverage_item_id not in coverage_item_ids:
        coverage_item_ids = [coverage_item_id, *coverage_item_ids]
    coverage_must_teach = _unique_strings(
        _strings(outline.get("coverageMustTeach")) or _strings(section.get("coverageMustTeach"))
    )
    planned_learning_objectives = _strings(outline.get("plannedLearningObjectives"))
    planned_learning_outcome = str(outline.get("plannedLearningOutcome") or "").strip()
    if planned_learning_outcome and planned_learning_outcome not in planned_learning_objectives:
        planned_learning_objectives = [planned_learning_outcome, *planned_learning_objectives]

    return {
        "contractVersion": "section-generation-outline-v1",
        "id": str(section.get("id") or outline.get("sectionOutlineId") or "generated-section"),
        "title": str(section.get("title") or outline.get("sectionOutlineTitle") or "Generated section"),
        "description": str(outline.get("plannedDescription") or section.get("description") or ""),
        "role": "lesson" if outline_role == "section_plan" else outline_role,
        "pageType": str(section.get("pageType") or "learn"),
        "sectionType": str(section.get("sectionType") or "lesson"),
        "sourceIds": _unique_strings(planned_source_ids or candidate_source_ids or section_source_ids or module_source_ids),
        "conceptKeywords": coverage_must_teach or _strings(outline.get("plannedConceptKeywords")) or [str(section.get("title") or "Lesson")],
        "learningObjectives": planned_learning_objectives or [f"Explain {section.get('title') or 'the section'} in context."],
        "planningSource": str(outline.get("planningSource") or module.get("planningSource") or "active_content_fill_orchestrator"),
        "assignedCoverageItemIds": coverage_item_ids,
        "coverageItemId": coverage_item_id,
        "coverageMustTeach": coverage_must_teach,
    }


def _mark_filled_section(
    section: dict[str, Any],
    *,
    run_at: str,
    result: dict[str, Any],
) -> dict[str, Any]:
    metadata = section.get("metadata") if isinstance(section.get("metadata"), dict) else {}
    outline = metadata.get("generationOutline") if isinstance(metadata.get("generationOutline"), dict) else {}
    outline.update(
        {
            "contentStatus": "filled",
            "nextWorkflow": "module_apply_summary",
            "filledAt": run_at,
            "filledBy": ACTIVE_CONTENT_FILL_CONTRACT,
            "lastSectionFillStatus": result.get("status"),
            "lastSectionFillContract": result.get("contractVersion"),
        }
    )
    metadata["generationOutline"] = outline
    section["metadata"] = metadata
    return section


def _mark_failed_section(section: dict[str, Any], *, run_at: str, result: dict[str, Any]) -> dict[str, Any]:
    metadata = section.get("metadata") if isinstance(section.get("metadata"), dict) else {}
    outline = metadata.get("generationOutline") if isinstance(metadata.get("generationOutline"), dict) else {}
    issues = result.get("issues") if isinstance(result.get("issues"), list) else []
    outline.update(
        {
            "contentStatus": "fill_failed",
            "nextWorkflow": "section_fill",
            "failedAt": run_at,
            "failedBy": ACTIVE_CONTENT_FILL_CONTRACT,
            "lastSectionFillStatus": result.get("status"),
            "lastSectionFillIssues": issues,
        }
    )
    metadata["generationOutline"] = outline
    section["metadata"] = metadata
    return section


def _module_matches(module: dict[str, Any], module_index: int, module_id: str | None) -> bool:
    if module_id is None:
        return True
    return module_id in {str(module.get("id") or ""), str(module_index)}


def _apply_sections(module: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        section
        for section in _items(module.get("sections"))
        if str(section.get("pageType") or "").lower() == "apply"
        or str(section.get("sectionType") or "").lower() in {"assessment", "quiz", "project"}
    ]


def _summary_sections(module: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        section
        for section in _items(module.get("sections"))
        if str(section.get("sectionType") or "").lower() == "summary"
    ]


def _lesson_sections(module: dict[str, Any]) -> list[dict[str, Any]]:
    return [section for section in _items(module.get("sections")) if _is_lesson_section(section)]


def _module_content_ready(module: dict[str, Any]) -> bool:
    lessons = _lesson_sections(module)
    return bool(lessons) and all(_content_blocks(section) for section in lessons)


def _module_complete(module: dict[str, Any]) -> bool:
    return _module_content_ready(module) and bool(_apply_sections(module)) and bool(_summary_sections(module))


def _course_complete(structure: dict[str, Any]) -> bool:
    modules = _items(structure.get("modules"))
    return bool(modules) and all(_module_complete(module) for module in modules)


def _fill_candidate_rows(
    modules: list[dict[str, Any]],
    *,
    scope: FillScope,
    module_id: str | None,
    section_id: str | None,
    retry_filled: bool,
) -> tuple[list[tuple[int, int]], bool, bool]:
    rows: list[tuple[int, int]] = []
    found_module = False
    found_section = False
    module_scope_started = False

    for module_index, module in enumerate(modules, start=1):
        if scope in {"module", "section"} and not _module_matches(module, module_index, module_id):
            continue
        if scope == "module" and module_id is None and module_scope_started:
            break

        found_module = True
        module_rows_before = len(rows)
        for section_index, section in enumerate(_items(module.get("sections")), start=1):
            if section_id is not None and str(section.get("id") or "") != section_id:
                continue
            found_section = found_section or section_id is not None
            if _section_needs_fill(section, retry_filled=retry_filled):
                rows.append((module_index - 1, section_index - 1))

        if scope == "module" and module_id is None and len(rows) > module_rows_before:
            module_scope_started = True

    return rows, found_module, found_section


def _run_module_artifacts(
    module: dict[str, Any],
    *,
    module_number: int,
    pacing_label: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    reports: list[dict[str, Any]] = []
    if not _module_content_ready(module):
        return module, reports

    lesson_sections = _lesson_sections(module)
    source_ids = _strings(module.get("sourceIds"))
    apply_report = run_module_apply_section_workflow(
        module,
        lesson_sections,
        module_number=module_number,
        fallback_source_ids=source_ids,
    )
    reports.append(compact_stage_workflow_report(apply_report))
    summary_report = run_module_summary_section_workflow(
        module,
        lesson_sections,
        module_number=module_number,
        fallback_source_ids=source_ids,
        pacing_label=pacing_label,
    )
    reports.append(compact_stage_workflow_report(summary_report))
    sections = [*lesson_sections]
    if apply_report.get("status") != "failed":
        sections.append(apply_report["artifacts"]["section"])
    if summary_report.get("status") != "failed":
        sections.append(summary_report["artifacts"]["section"])
    assembly_report = run_module_assembly_workflow(
        module,
        sections,
        module_number=module_number,
        fallback_source_ids=source_ids,
        pacing_label=pacing_label,
    )
    reports.append(compact_stage_workflow_report(assembly_report))
    if assembly_report.get("status") == "failed":
        return module, reports
    return {**module, **assembly_report["artifacts"]["module"]}, reports


def _update_course_build_task(metadata: dict[str, Any], *, complete: bool, filled_count: int) -> None:
    task = metadata.get("courseBuildTask")
    if not isinstance(task, dict):
        return
    if complete:
        task.update(
            {
                "status": "content_filled",
                "currentStage": "content_draft",
                "nextAction": "run_quality_review",
                "requiredInputs": ["quality_report"],
            }
        )
    elif filled_count:
        task.update(
            {
                "status": "section_generation_ready",
                "currentStage": "section_generation_ready",
                "nextAction": "generate_course_sections",
                "requiredInputs": ["section_generation"],
            }
        )
    metadata["courseBuildTask"] = task


def fill_active_course_content(
    course: CourseSnapshot,
    *,
    scope: FillScope = "course",
    module_id: str | None = None,
    section_id: str | None = None,
    max_sections: int | None = None,
    retry_filled: bool = False,
    include_module_artifacts: bool = True,
) -> CourseSnapshot:
    if scope not in {"course", "module", "section"}:
        raise ValueError("Active content fill scope must be course, module, or section.")
    if scope == "section" and not section_id:
        raise ValueError("section_id is required when filling a single section.")

    run_at = _now()
    structure = deepcopy(course.structure or {})
    modules = _items(structure.get("modules"))
    if not modules:
        raise ValueError("Active content fill requires a course with planned modules.")

    rows, found_module, found_section = _fill_candidate_rows(
        modules,
        scope=scope,
        module_id=module_id,
        section_id=section_id,
        retry_filled=retry_filled,
    )
    if scope in {"module", "section"} and not found_module:
        raise ValueError("Target module was not found for active content fill.")
    if scope == "section" and not found_section:
        raise ValueError("Target section was not found for active content fill.")
    if max_sections is not None:
        rows = rows[: max(0, int(max_sections))]

    filled_section_ids: list[str] = []
    failed_sections: list[dict[str, Any]] = []
    skipped_section_ids: list[str] = []
    stage_reports: list[dict[str, Any]] = []
    touched_module_indexes: set[int] = set()

    for module_position, section_position in rows:
        module = modules[module_position]
        sections = _items(module.get("sections"))
        section = sections[section_position]
        section_plan = _section_plan_from_planned_section(section, module)
        report = run_section_fill_workflow(section_plan, planned_section=section, module_outline=module)
        stage_reports.append(compact_stage_workflow_report(report))
        generated = report["artifacts"]["section"]
        if report.get("status") == "failed" or not _content_blocks(generated):
            sections[section_position] = _mark_failed_section(section, run_at=run_at, result=report)
            failed_sections.append(
                {
                    "moduleId": str(module.get("id") or ""),
                    "sectionId": str(section.get("id") or ""),
                    "status": report.get("status"),
                    "issues": report.get("issues") if isinstance(report.get("issues"), list) else [],
                }
            )
            continue
        sections[section_position] = _mark_filled_section(generated, run_at=run_at, result=report)
        module["sections"] = sections
        modules[module_position] = module
        touched_module_indexes.add(module_position)
        filled_section_ids.append(str(generated.get("id") or section.get("id") or ""))

    if not rows:
        for module in modules:
            for section in _items(module.get("sections")):
                if _is_lesson_section(section) and _content_blocks(section):
                    skipped_section_ids.append(str(section.get("id") or ""))

    module_reports: list[dict[str, Any]] = []
    if include_module_artifacts:
        for module_position in sorted(touched_module_indexes):
            module = modules[module_position]
            updated_module, reports = _run_module_artifacts(
                module,
                module_number=module_position + 1,
                pacing_label=str(_metadata(structure).get("pacingLabel") or "Module"),
            )
            modules[module_position] = updated_module
            module_reports.extend(reports)

    structure["modules"] = modules
    metadata = _metadata(structure)
    complete = _course_complete(structure)
    if failed_sections and not filled_section_ids:
        status = "failed"
    elif complete:
        status = "complete"
    elif filled_section_ids:
        status = "partially_filled"
    else:
        status = "no_pending_sections"

    remaining_planned_count = sum(
        1
        for module in modules
        for section in _items(module.get("sections"))
        if _is_lesson_section(section) and not _content_blocks(section)
    )
    run_report = {
        "contractVersion": ACTIVE_CONTENT_FILL_CONTRACT,
        "status": status,
        "scope": scope,
        "targetModuleId": module_id,
        "targetSectionId": section_id,
        "retryFilled": retry_filled,
        "includeModuleArtifacts": include_module_artifacts,
        "filledAt": run_at,
        "filledSectionIds": filled_section_ids,
        "skippedSectionIds": skipped_section_ids,
        "failedSections": failed_sections,
        "metrics": {
            "moduleCount": len(modules),
            "candidateSectionCount": len(rows),
            "filledSectionCount": len(filled_section_ids),
            "failedSectionCount": len(failed_sections),
            "remainingPlannedSectionCount": remaining_planned_count,
            "moduleArtifactReportCount": len(module_reports),
            "stageReportCount": len(stage_reports),
        },
        "stageWorkflows": stage_reports,
        "moduleWorkflows": module_reports,
    }
    metadata["activeContentFill"] = run_report
    _update_course_build_task(metadata, complete=complete, filled_count=len(filled_section_ids))
    structure["metadata"] = metadata
    course.structure = structure

    if complete and course.status != "needs_sources":
        course.status = "generated"

    trace = course.generation_trace if isinstance(course.generation_trace, dict) else {}
    trace["activeContentFill"] = run_report
    course.generation_trace = trace
    flag_modified(course, "structure")
    flag_modified(course, "generation_trace")
    return course
