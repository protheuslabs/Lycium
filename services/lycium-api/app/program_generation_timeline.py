from __future__ import annotations

from datetime import UTC, datetime
from typing import Any


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _program(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("program") if isinstance(payload.get("program"), dict) else {}


def _trace(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("generationTrace") if isinstance(payload.get("generationTrace"), dict) else {}


def _quality(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("qualityReport") if isinstance(payload.get("qualityReport"), dict) else {}


def _contract_validation(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("contractValidation") if isinstance(payload.get("contractValidation"), dict) else {}


def _scaffold_plan(trace: dict[str, Any]) -> dict[str, Any]:
    synthesis = trace.get("programSynthesis") if isinstance(trace.get("programSynthesis"), dict) else {}
    return synthesis.get("courseScaffoldPlan") if isinstance(synthesis.get("courseScaffoldPlan"), dict) else {}


def _program_brief(trace: dict[str, Any]) -> dict[str, Any]:
    synthesis = trace.get("programSynthesis") if isinstance(trace.get("programSynthesis"), dict) else {}
    return synthesis.get("programBrief") if isinstance(synthesis.get("programBrief"), dict) else {}


def _count_by_key(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = str(row.get(key) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


def _course_task_metrics(scaffold_plan: dict[str, Any]) -> dict[str, Any]:
    courses = _items(scaffold_plan.get("courses"))
    tasks = [course.get("courseBuildTask") for course in courses]
    task_rows = [task for task in tasks if isinstance(task, dict)]
    source_packet_tasks = [
        task
        for task in task_rows
        if isinstance(task.get("requiredInputs"), list) and "source_packet" in task["requiredInputs"]
    ]
    return {
        "courseCount": len(courses),
        "courseBuildTaskCount": len(task_rows),
        "missingCourseBuildTaskCount": len(courses) - len(task_rows),
        "sourcePacketRequiredCount": len(source_packet_tasks),
        "courseActionCounts": _count_by_key(courses, "action"),
        "taskStatusCounts": _count_by_key(task_rows, "status"),
        "taskStageCounts": _count_by_key(task_rows, "currentStage"),
    }


def _event(
    *,
    event_type: str,
    stage: str,
    status: str,
    message: str,
    progress: float,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "eventType": event_type,
        "stage": stage,
        "status": status,
        "message": message,
        "progress": round(progress, 4),
        "payload": payload or {},
    }


def build_program_generation_timeline(payload: dict[str, Any]) -> dict[str, Any]:
    program = _program(payload)
    trace = _trace(payload)
    quality = _quality(payload)
    validation = _contract_validation(payload)
    benchmark_context = trace.get("curriculumBenchmarkContext") if isinstance(trace.get("curriculumBenchmarkContext"), dict) else {}
    program_brief = _program_brief(trace)
    scaffold_plan = _scaffold_plan(trace)
    task_report = scaffold_plan.get("courseBuildTaskReport") if isinstance(scaffold_plan.get("courseBuildTaskReport"), dict) else {}
    shell_readiness = scaffold_plan.get("courseShellReadinessReport") if isinstance(scaffold_plan.get("courseShellReadinessReport"), dict) else {}
    action_plan = scaffold_plan.get("courseShellActionPlan") if isinstance(scaffold_plan.get("courseShellActionPlan"), dict) else {}
    source_acquisition = scaffold_plan.get("sourceAcquisitionPlan") if isinstance(scaffold_plan.get("sourceAcquisitionPlan"), dict) else {}
    active_generation_course_count = int(scaffold_plan.get("activeGenerationCourseCount") or 0)
    generation_policy = scaffold_plan.get("generationPolicy") if isinstance(scaffold_plan.get("generationPolicy"), dict) else {}
    quality_gates = _items(quality.get("gates"))
    task_metrics = _course_task_metrics(scaffold_plan)
    benchmark_count = len(_items(benchmark_context.get("curriculumBenchmarks")))
    requirement_origin_count = len(_items(benchmark_context.get("requirementOrigins")))
    source_slot_count = len(_items(benchmark_context.get("sourceSlots")))
    validation_passed = bool(validation.get("passed")) if "passed" in validation else not validation.get("errors")
    quality_passed = bool(quality.get("passed"))
    scaffold_passed = task_metrics["courseCount"] > 0 and task_metrics["missingCourseBuildTaskCount"] == 0
    timeline_status = "passed" if validation_passed and quality_passed and scaffold_passed else "needs_review"

    events = [
        _event(
            event_type="program_intake",
            stage="program_intake",
            status="passed" if program.get("title") and program.get("targetOutcome") else "needs_review",
            message="Program request captured.",
            progress=0.1,
            payload={
                "goal": trace.get("goal"),
                "level": trace.get("level"),
                "sourceUrlCount": len(trace.get("sourceUrls")) if isinstance(trace.get("sourceUrls"), list) else 0,
            },
        ),
        _event(
            event_type="program_brief_created",
            stage="program_brief",
            status="passed" if program_brief.get("title") and program_brief.get("targetOutcome") else "needs_review",
            message="Program intent, audience, outcome, and broad requirement groups drafted.",
            progress=0.18,
            payload={
                "title": program_brief.get("title"),
                "programType": program_brief.get("programType"),
                "field": program_brief.get("field"),
                "level": program_brief.get("level"),
                "broadRequirementGroupCount": len(_items(program_brief.get("broadRequirementGroups"))),
                "learningOutcomeCount": len(_items(program_brief.get("learningOutcomes"))),
            },
        ),
        _event(
            event_type="curriculum_benchmark_context",
            stage="benchmark_context",
            status="passed" if benchmark_count or requirement_origin_count else "needs_review",
            message="Curriculum benchmark evidence compiled.",
            progress=0.25,
            payload={
                "benchmarkCount": benchmark_count,
                "requirementOriginCount": requirement_origin_count,
                "sourceSlotCount": source_slot_count,
            },
        ),
        _event(
            event_type="program_contract_validated",
            stage="program_contract",
            status="passed" if validation_passed else "failed",
            message="Program contract validation completed.",
            progress=0.45,
            payload=validation,
        ),
        _event(
            event_type="program_quality_assessed",
            stage="program_quality",
            status="passed" if quality_passed else "failed",
            message="Program quality gates assessed.",
            progress=0.65,
            payload={
                "score": quality.get("score"),
                "passed": quality_passed,
                "failedGateCount": len([gate for gate in quality_gates if gate.get("status") == "failed"]),
            },
        ),
        _event(
            event_type="course_scaffold_planned",
            stage="course_scaffold",
            status="passed" if scaffold_passed else "failed",
            message="Cluster and course-shell scaffold plan created.",
            progress=0.8,
            payload={
                "clusterCount": scaffold_plan.get("clusterCount"),
                "courseCount": scaffold_plan.get("courseCount"),
                "courseBuildTaskReport": task_report,
                "courseShellReadinessReport": shell_readiness,
                "courseShellActionPlan": action_plan,
                "sourceAcquisitionPlan": source_acquisition,
                "activeGenerationCourseCount": active_generation_course_count,
                "generationPolicy": generation_policy,
                **task_metrics,
            },
        ),
        _event(
            event_type="course_build_task_summary",
            stage="course_build_tasks",
            status="passed" if task_metrics["missingCourseBuildTaskCount"] == 0 else "failed",
            message="Course build task states summarized for downstream course generation.",
            progress=1.0,
            payload={
                "courseBuildTaskReport": task_report,
                "courseShellReadinessReport": shell_readiness,
                "courseShellActionPlan": action_plan,
                "sourceAcquisitionPlan": source_acquisition,
                "activeGenerationCourseCount": active_generation_course_count,
                "generationPolicy": generation_policy,
                **task_metrics,
            },
        ),
    ]
    return {
        "contractVersion": "program-generation-timeline-v1",
        "status": timeline_status,
        "eventCount": len(events),
        "events": events,
        "generatedAt": _now(),
    }
