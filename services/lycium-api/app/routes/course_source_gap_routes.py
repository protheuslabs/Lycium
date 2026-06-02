from __future__ import annotations

from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from app.course_generation_job_helpers import source_gap_job_result
from app.course_source_gaps import (
    source_urls_from_needs_sources_snapshot,
    update_needs_sources_course_snapshot,
)
from app.db import get_session
from app.generation import source_count_meets_minimum
from app.jobs import enqueue_job, run_agent_course_generation_job
from app.local_store import require_verified_active_agent_profile, save_course_snapshot
from app.models import CourseDraft, CourseSnapshot
from app.routes.course_generation_responses import course_generation_job_response
from app.schemas import CourseGenerationJobRead, CourseSourceGapResumeRequest


def _snapshot_generation_payload(
    snapshot: CourseSnapshot,
    draft: CourseDraft | None,
    payload: CourseSourceGapResumeRequest,
    source_urls: list[str],
    model: str | None,
) -> dict[str, Any]:
    constraints = draft.constraints if draft and isinstance(draft.constraints, dict) else {}
    structure = snapshot.structure if isinstance(snapshot.structure, dict) else {}
    return {
        "prompt": snapshot.prompt,
        "learner_id": snapshot.learner_id,
        "level": snapshot.level,
        "language": snapshot.language,
        "model": model,
        "source_policy": snapshot.source_policy,
        "free_only": bool(constraints.get("free_only", False)),
        "trust_min": float(constraints.get("trust_min") or 0.0),
        "category": structure.get("category"),
        "department": structure.get("department"),
        "desired_module_count": int(constraints.get("desired_module_count") or 3),
        "expected_duration_minutes": draft.expected_duration_minutes if draft else 180,
        "source_urls": source_urls,
        "source_packet_id": payload.source_packet_id,
        "source_packet": payload.source_packet,
    }


def _merged_source_urls(snapshot: CourseSnapshot, payload: CourseSourceGapResumeRequest) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for source_url in [*source_urls_from_needs_sources_snapshot(snapshot), *[str(url) for url in payload.source_urls]]:
        if source_url in seen:
            continue
        seen.add(source_url)
        merged.append(source_url)
    return merged


def register(app: FastAPI) -> None:
    @app.post("/v1/courses/{course_id}/source-gaps/resume", response_model=CourseGenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
    def resume_course_from_source_gaps(
        course_id: int,
        payload: CourseSourceGapResumeRequest,
        background_tasks: BackgroundTasks,
        session: Session = Depends(get_session),
    ) -> dict[str, Any]:
        snapshot = session.get(CourseSnapshot, course_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found.")
        if snapshot.status != "needs_sources":
            raise HTTPException(status_code=400, detail="Only needs_sources course drafts can resume from source gaps.")

        draft = session.get(CourseDraft, snapshot.draft_id) if snapshot.draft_id else None
        merged_source_urls = _merged_source_urls(snapshot, payload)
        if not source_count_meets_minimum(merged_source_urls):
            update_needs_sources_course_snapshot(snapshot, source_urls=merged_source_urls)
            save_course_snapshot(snapshot)
            job = enqueue_job(
                session,
                job_type="agent_generate_course_staged",
                payload=_snapshot_generation_payload(snapshot, draft, payload, merged_source_urls, payload.model),
            )
            source_gap_job_result(session, job, snapshot)
            session.commit()
            session.refresh(job)
            return course_generation_job_response(job)

        try:
            agent_profile = require_verified_active_agent_profile()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        job = enqueue_job(
            session,
            job_type="agent_generate_course_staged",
            payload=_snapshot_generation_payload(
                snapshot,
                draft,
                payload,
                merged_source_urls,
                payload.model or agent_profile.get("model"),
            ),
        )
        session.commit()
        session.refresh(job)
        background_tasks.add_task(run_agent_course_generation_job, job.id)
        return course_generation_job_response(job)
