from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.course_build_tasks import (
    transition_course_build_task_in_structure,
    transition_course_build_task_in_structure_from_outline,
    transition_course_build_task_in_structure_from_quality_report,
)
from app.course_outline_from_source_packet import build_outline_from_source_packet


def _task(structure: dict[str, Any]) -> dict[str, Any]:
    metadata = structure.get("metadata")
    if not isinstance(metadata, dict):
        return {}
    task = metadata.get("courseBuildTask")
    return task if isinstance(task, dict) else {}


def _transition_trace_row(
    *,
    input_type: str,
    before: dict[str, Any],
    after: dict[str, Any],
) -> dict[str, Any]:
    transition_report = _transition_report_for(input_type, after)
    return {
        "inputType": input_type,
        "fromStatus": before.get("status") or before.get("currentStage"),
        "toStatus": after.get("status") or after.get("currentStage"),
        "transitionStatus": after.get("transitionStatus"),
        "transitionReason": after.get("transitionReason"),
        "nextAction": after.get("nextAction"),
        "transitionReport": transition_report,
    }


def _transition_report_for(input_type: str, task: dict[str, Any]) -> dict[str, Any]:
    key_by_input = {
        "source_packet": "sourcePacketTransitionReport",
        "outline": "outlineTransitionReport",
        "quality_report": "reviewTransitionReport",
    }
    report = task.get(key_by_input.get(input_type, ""))
    if not isinstance(report, dict):
        return {}
    reasons = report.get("reasons")
    return {
        "contractVersion": report.get("contractVersion"),
        "status": report.get("status"),
        "passed": report.get("passed"),
        "nextStage": report.get("nextStage"),
        "nextAction": report.get("nextAction"),
        "reasonCount": len(reasons) if isinstance(reasons, list) else 0,
    }


def _count_rows(rows: list[dict[str, Any]], status: str) -> int:
    return sum(1 for row in rows if row.get("transitionStatus") == status)


def _required_inputs(task: dict[str, Any]) -> list[str]:
    values = task.get("requiredInputs")
    return [str(value) for value in values if str(value).strip()] if isinstance(values, list) else []


def _resume_report(trace: list[dict[str, Any]], task: dict[str, Any]) -> dict[str, Any]:
    current_stage = str(task.get("currentStage") or task.get("status") or "unknown")
    blocked_reports = [
        row
        for row in trace
        if isinstance(row.get("transitionReport"), dict)
        and row["transitionReport"].get("status") == "blocked"
    ]
    latest = trace[-1] if trace else {}
    if current_stage == "ready_for_review":
        status = "ready_for_review"
    elif blocked_reports:
        status = "blocked"
    elif current_stage in {"outline_ready", "section_generation_ready"}:
        status = current_stage
    else:
        status = "source_gathering"
    return {
        "contractVersion": "course-build-resume-report-v1",
        "status": status,
        "currentStage": current_stage,
        "nextAction": task.get("nextAction"),
        "requiredInputs": _required_inputs(task),
        "transitionCount": len(trace),
        "advancedTransitionCount": _count_rows(trace, "advanced"),
        "blockedTransitionCount": _count_rows(trace, "blocked"),
        "unchangedTransitionCount": _count_rows(trace, "unchanged"),
        "latestInputType": latest.get("inputType"),
        "latestTransitionStatus": latest.get("transitionStatus"),
        "latestTransitionReason": latest.get("transitionReason"),
        "transitionReports": [
            {
                "inputType": row.get("inputType"),
                **row.get("transitionReport"),
            }
            for row in trace
            if isinstance(row.get("transitionReport"), dict) and row.get("transitionReport")
        ][-10:],
    }


def _append_resume_trace(structure: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return structure
    metadata = structure.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    existing = metadata.get("courseBuildResumeTrace")
    trace = [row for row in existing if isinstance(row, dict)] if isinstance(existing, list) else []
    trace.extend(rows)
    metadata["courseBuildResumeTrace"] = trace[-20:]
    structure["metadata"] = metadata
    metadata["courseBuildResumeReport"] = _resume_report(metadata["courseBuildResumeTrace"], _task(structure))
    structure["metadata"] = metadata
    return structure


def apply_course_build_resume_inputs(
    structure: dict[str, Any],
    *,
    prompt: str = "",
    source_packet: dict[str, Any] | None = None,
    outline: dict[str, Any] | None = None,
    quality_report: dict[str, Any] | None = None,
    derive_outline_from_source_packet: bool = True,
    desired_module_count: int = 4,
) -> dict[str, Any]:
    next_structure = deepcopy(structure)
    rows: list[dict[str, Any]] = []

    if source_packet is not None:
        before = _task(next_structure)
        next_structure = transition_course_build_task_in_structure(next_structure, source_packet=source_packet)
        rows.append(_transition_trace_row(input_type="source_packet", before=before, after=_task(next_structure)))
        current_task = _task(next_structure)
        if (
            derive_outline_from_source_packet
            and outline is None
            and (current_task.get("status") or current_task.get("currentStage")) == "outline_ready"
        ):
            outline = build_outline_from_source_packet(
                prompt=prompt or str(next_structure.get("title") or current_task.get("title") or current_task.get("courseId") or ""),
                source_packet=source_packet,
                desired_module_count=desired_module_count,
            )
            metadata = next_structure.get("metadata")
            metadata = metadata if isinstance(metadata, dict) else {}
            metadata["courseBuildOutline"] = outline
            next_structure["metadata"] = metadata

    if outline is not None:
        before = _task(next_structure)
        next_structure = transition_course_build_task_in_structure_from_outline(next_structure, outline=outline)
        rows.append(_transition_trace_row(input_type="outline", before=before, after=_task(next_structure)))

    if quality_report is not None:
        before = _task(next_structure)
        next_structure = transition_course_build_task_in_structure_from_quality_report(
            next_structure,
            quality_report=quality_report,
        )
        rows.append(_transition_trace_row(input_type="quality_report", before=before, after=_task(next_structure)))

    return _append_resume_trace(next_structure, rows)
