from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.course_agent_types import CourseAgentResult
from app.course_build_task_resume import apply_course_build_resume_inputs
from app.course_health import summarize_course_health
from app.course_taxonomy import COURSE_TAXONOMY
from app.course_quality import assess_course_quality
from app.curriculum_artifacts import persist_curriculum_artifacts_for_snapshot
from app.models import CourseSnapshot


def validate_generation_taxonomy_input(category: str | None, department: str | None) -> list[str]:
    errors: list[str] = []
    if not category:
        return errors
    if category not in COURSE_TAXONOMY:
        errors.append(f'Course category "{category}" is not in the taxonomy.')
        return errors
    if department and department not in COURSE_TAXONOMY[category]:
        errors.append(f'Course department "{department}" is not in category "{category}".')
    return errors


def assess_agent_generation_result(generated: CourseAgentResult, *, gate: str) -> dict[str, Any]:
    return assess_course_quality(generated.course, gate=gate)


def _generated_generation_readiness(generated: CourseAgentResult) -> dict[str, Any] | None:
    trace_readiness = generated.trace.get("generation_readiness")
    if isinstance(trace_readiness, dict):
        return trace_readiness
    metadata = generated.course.get("metadata") if isinstance(generated.course, dict) else None
    if isinstance(metadata, dict) and isinstance(metadata.get("generationReadiness"), dict):
        return metadata["generationReadiness"]
    return None


def build_course_snapshot_from_agent_result(
    session: Session,
    *,
    learner_id: int | None,
    prompt: str,
    language: str,
    level: str | None,
    source_policy: str,
    generated: CourseAgentResult,
    quality_report: dict[str, Any],
    generation_readiness: dict[str, Any] | None = None,
    status: str = "ready_for_review",
) -> CourseSnapshot:
    structure = apply_course_build_resume_inputs(
        generated.course,
        quality_report=quality_report,
    )
    effective_readiness = _generated_generation_readiness(generated) or generation_readiness
    metadata = structure.get("metadata") if isinstance(structure.get("metadata"), dict) else {}
    structure["metadata"] = {
        **metadata,
        **({"generationReadiness": effective_readiness} if isinstance(effective_readiness, dict) else {}),
        "courseHealth": summarize_course_health(
            course_key=str(generated.course.get("id") or generated.course.get("slug") or generated.course.get("title") or "generated-course"),
            course_title=str(generated.course.get("title") or "Generated course"),
            course=structure,
            quality_report=quality_report,
            lifecycle_status=status,
        ),
    }
    snapshot = CourseSnapshot(
        learner_id=learner_id,
        draft_id=None,
        title=structure["title"],
        prompt=prompt,
        language=language,
        level=level,
        source_policy=source_policy,
        status=status,
        version=1,
        structure=structure,
        generation_trace={
            **generated.trace,
            **({"generation_readiness": effective_readiness} if isinstance(effective_readiness, dict) else {}),
            "quality_report": quality_report,
        },
    )
    session.add(snapshot)
    session.flush()
    persist_curriculum_artifacts_for_snapshot(
        session,
        snapshot,
        context=generated.trace.get("curriculum_benchmark_context"),
    )
    return snapshot
