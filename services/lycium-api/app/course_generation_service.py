from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.course_agent_types import CourseAgentResult
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
    status: str = "ready_for_review",
) -> CourseSnapshot:
    snapshot = CourseSnapshot(
        learner_id=learner_id,
        draft_id=None,
        title=generated.course["title"],
        prompt=prompt,
        language=language,
        level=level,
        source_policy=source_policy,
        status=status,
        version=1,
        structure=generated.course,
        generation_trace={**generated.trace, "quality_report": quality_report},
    )
    session.add(snapshot)
    session.flush()
    persist_curriculum_artifacts_for_snapshot(
        session,
        snapshot,
        context=generated.trace.get("curriculum_benchmark_context"),
    )
    return snapshot
