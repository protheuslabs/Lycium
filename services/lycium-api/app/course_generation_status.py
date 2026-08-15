from __future__ import annotations

from typing import Any

COURSE_GENERATION_STATUS_CONTRACT = "course-generation-workflow-status-v1"

COURSE_GENERATION_WORKFLOW_MESSAGES = {
    "queued": "Queued for course generation...",
    "course_template": "Creating course template...",
    "modules": "Creating modules...",
    "sections": "Creating sections...",
    "section_content": "Writing section content...",
    "review": "Checking course quality...",
    "sources": "Checking sources...",
    "needs_sources": "Course generated; sources need review.",
    "needs_revision": "Course generated; review gates need attention.",
    "complete": "Course ready for review.",
    "failed": "Course generation failed.",
}


def workflow_key_for_generation_stage(stage: str | None) -> str:
    normalized = str(stage or "").strip().lower()
    if normalized in {"queued", "pending"}:
        return "queued"
    if not normalized:
        return "course_template"
    if normalized in {"source_coverage", "source_strength", "source_packet_quality"}:
        return "sources"
    if normalized in {"course_plan", "course_template_generation", "benchmark_intake"}:
        return "course_template"
    if normalized in {"course_module_outline_generation", "module_outline_generation"}:
        return "modules"
    if normalized in {"module_section_plan_generation", "section_plan_generation"}:
        return "sections"
    if normalized in {
        "section_fill_generation",
        "module_assessment_planning",
        "module_apply_section_generation",
        "module_quiz_assessment_generation",
        "module_project_assessment_generation",
        "module_summary_section_generation",
        "module_assembly",
    }:
        return "section_content"
    if normalized.startswith("module_"):
        return "section_content"
    if normalized in {"quality_eval", "publish_readiness"}:
        return "review"
    if normalized in {"needs_sources", "source_review"}:
        return "needs_sources"
    if normalized in {"needs_revision", "quality_review"}:
        return "needs_revision"
    if normalized in {"completed", "complete", "ready", "ready_for_review"}:
        return "complete"
    if normalized in {"failed", "error"}:
        return "failed"
    return "course_template"


def course_generation_workflow_status(
    *,
    stage: str | None,
    progress: float | None = None,
    detail: str | None = None,
    trace: dict[str, Any] | None = None,
) -> dict[str, Any]:
    workflow = workflow_key_for_generation_stage(stage)
    return {
        "contractVersion": COURSE_GENERATION_STATUS_CONTRACT,
        "workflow": workflow,
        "stage": str(stage or "").strip() or None,
        "message": COURSE_GENERATION_WORKFLOW_MESSAGES[workflow],
        "detail": str(detail or "").strip() or None,
        "progress": None if progress is None else round(max(0.0, min(1.0, float(progress))), 4),
        "stageWorkflowCount": len(trace.get("stage_workflows", [])) if isinstance(trace, dict) and isinstance(trace.get("stage_workflows"), list) else 0,
    }
