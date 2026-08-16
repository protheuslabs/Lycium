from __future__ import annotations

from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.generation_eval_reports import build_generation_eval_trend, load_generation_eval_runs
from app.generation_observability import generation_run_payload, get_generation_run, list_generation_runs
from app.jobs import run_agent_course_generation_queue
from app.local_store import require_verified_active_agent_profile
from app.models import Job
from app.routes.course_generation_responses import course_generation_job_response
from app.schemas import CourseGenerationJobRead, GenerationRunRead


def _resume_agent_course_generation_job(
    job_id: int,
    background_tasks: BackgroundTasks,
    session: Session,
) -> dict[str, Any]:
    job = session.get(Job, job_id)
    if job is None or job.job_type != "agent_generate_course_staged":
        raise HTTPException(status_code=404, detail="Course generation job not found.")
    if job.status == "running":
        return course_generation_job_response(job)
    try:
        active_profile = require_verified_active_agent_profile()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    payload = dict(job.payload or {})
    active_model = str(active_profile.get("model") or "").strip()
    if active_model:
        payload["model"] = active_model
    job.payload = payload
    job.status = "pending"
    job.error = None
    job.result = {**(job.result or {}), "message": "Generation re-queued from the saved request."}
    session.commit()
    session.refresh(job)
    background_tasks.add_task(run_agent_course_generation_queue)
    return course_generation_job_response(job)


def register(app: FastAPI) -> None:
    @app.get("/v1/agent/courses/runs", response_model=list[GenerationRunRead])
    def list_agent_course_generation_runs(
        limit: int = Query(default=50, ge=1, le=200),
        status_filter: str | None = Query(default=None, alias="status"),
        session: Session = Depends(get_session),
    ) -> list[dict[str, Any]]:
        return [
            generation_run_payload(run)
            for run in list_generation_runs(session, status=status_filter, limit=limit)
        ]

    @app.get("/v1/generation-runs", response_model=list[GenerationRunRead])
    def list_generation_run_history(
        limit: int = Query(default=50, ge=1, le=200),
        status_filter: str | None = Query(default=None, alias="status"),
        session: Session = Depends(get_session),
    ) -> list[dict[str, Any]]:
        return list_agent_course_generation_runs(limit=limit, status_filter=status_filter, session=session)

    @app.get("/v1/generation-evals/trend")
    def get_generation_eval_trend(limit: int = Query(default=20, ge=1, le=100)) -> dict[str, Any]:
        runs = load_generation_eval_runs(limit=limit)
        return {
            "runs": runs,
            "trend": build_generation_eval_trend(runs),
        }

    @app.get("/v1/agent/courses/runs/{run_id}", response_model=GenerationRunRead)
    def get_agent_course_generation_run(run_id: int, session: Session = Depends(get_session)) -> dict[str, Any]:
        run = get_generation_run(session, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Generation run not found.")
        return generation_run_payload(run)

    @app.get("/v1/generation-runs/{run_id}", response_model=GenerationRunRead)
    def get_generation_run_history_item(run_id: int, session: Session = Depends(get_session)) -> dict[str, Any]:
        return get_agent_course_generation_run(run_id=run_id, session=session)

    @app.post("/v1/agent/courses/jobs/{job_id}/resume", response_model=CourseGenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
    def resume_agent_course_generation_job(
        job_id: int,
        background_tasks: BackgroundTasks,
        session: Session = Depends(get_session),
    ) -> dict[str, Any]:
        return _resume_agent_course_generation_job(job_id=job_id, background_tasks=background_tasks, session=session)

    @app.post("/v1/generation-runs/{run_id}/resume", response_model=CourseGenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
    def resume_generation_run(
        run_id: int,
        background_tasks: BackgroundTasks,
        session: Session = Depends(get_session),
    ) -> dict[str, Any]:
        run = get_generation_run(session, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="Generation run not found.")
        if run.job_id is None:
            raise HTTPException(status_code=400, detail="Generation run is not attached to a resumable job.")
        return _resume_agent_course_generation_job(job_id=run.job_id, background_tasks=background_tasks, session=session)
