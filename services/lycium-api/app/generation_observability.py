from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import GenerationRun, GenerationRunEvent, Job, utcnow


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_trace(trace: Any) -> dict[str, Any]:
    payload = dict(trace) if isinstance(trace, dict) else {}
    payload.pop("partial_course", None)
    return payload


def _stage_count(trace: dict[str, Any]) -> int:
    stages = trace.get("stages")
    return len(stages) if isinstance(stages, list) else 0


def _event_payload(*, progress: float | None = None, trace: dict[str, Any] | None = None, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if progress is not None:
        payload["progress"] = round(progress, 4)
    if trace is not None:
        payload["stageCount"] = _stage_count(trace)
    if extra:
        payload.update(extra)
    return payload


def _event_read(event: GenerationRunEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "generation_run_id": event.generation_run_id,
        "event_type": event.event_type,
        "stage": event.stage,
        "status": event.status,
        "message": event.message,
        "payload": event.payload,
        "created_at": event.created_at,
    }


def generation_run_payload(run: GenerationRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "job_id": run.job_id,
        "course_snapshot_id": run.course_snapshot_id,
        "run_type": run.run_type,
        "status": run.status,
        "prompt": run.prompt,
        "provider_id": run.provider_id,
        "model": run.model,
        "progress": run.progress,
        "current_stage": run.current_stage,
        "message": run.message,
        "request_payload": run.request_payload,
        "result_summary": run.result_summary,
        "trace": run.trace,
        "events": [_event_read(event) for event in run.events],
        "created_at": run.created_at,
        "updated_at": run.updated_at,
        "completed_at": run.completed_at,
    }


def add_generation_run_event(
    session: Session,
    run: GenerationRun,
    *,
    event_type: str,
    stage: str | None = None,
    status: str | None = None,
    message: str | None = None,
    payload: dict[str, Any] | None = None,
) -> GenerationRunEvent:
    event = GenerationRunEvent(
        generation_run_id=run.id,
        event_type=event_type,
        stage=stage,
        status=status,
        message=message,
        payload=payload or {},
    )
    session.add(event)
    session.flush()
    return event


def generation_run_for_job(session: Session, job_id: int) -> GenerationRun | None:
    return session.scalar(
        select(GenerationRun)
        .where(GenerationRun.job_id == job_id)
        .options(selectinload(GenerationRun.events))
        .limit(1)
    )


def start_generation_run(session: Session, job: Job, *, message: str, progress: float = 0.0) -> GenerationRun:
    existing = generation_run_for_job(session, job.id)
    if existing:
        return existing

    payload = _as_dict(job.payload)
    run = GenerationRun(
        job_id=job.id,
        run_type=job.job_type,
        status="running",
        prompt=str(payload.get("prompt") or ""),
        provider_id=str(payload.get("provider_id") or "") or None,
        model=str(payload.get("model") or "") or None,
        progress=progress,
        current_stage="course_plan",
        message=message,
        request_payload=payload,
        result_summary={},
        trace={"mode": "staged-llm-agent", "stages": []},
    )
    session.add(run)
    session.flush()
    add_generation_run_event(
        session,
        run,
        event_type="run_started",
        stage="course_plan",
        status="running",
        message=message,
        payload=_event_payload(progress=progress),
    )
    return run


def record_generation_run_checkpoint(job_id: int, update: dict[str, Any], *, session_factory) -> None:
    with session_factory() as session:
        run = generation_run_for_job(session, job_id)
        if run is None:
            return
        trace = _safe_trace(update.get("trace"))
        progress = float(update.get("progress") or run.progress or 0.0)
        current_stage = str(update.get("current_stage") or run.current_stage or "course_plan")
        message = str(update.get("message") or "")
        run.status = "running"
        run.progress = progress
        run.current_stage = current_stage
        run.message = message
        run.trace = trace
        add_generation_run_event(
            session,
            run,
            event_type="stage_checkpoint",
            stage=current_stage,
            status="running",
            message=message,
            payload=_event_payload(progress=progress, trace=trace),
        )
        session.commit()


def complete_generation_run(
    session: Session,
    *,
    job_id: int,
    accepted: bool,
    message: str,
    trace: dict[str, Any],
    quality_report: dict[str, Any],
    course_snapshot_id: int | None = None,
) -> None:
    run = generation_run_for_job(session, job_id)
    if run is None:
        return
    run.status = "completed" if accepted else "failed"
    run.progress = 1.0
    run.current_stage = "ready_for_review" if accepted else "quality_eval"
    run.message = message
    run.course_snapshot_id = course_snapshot_id
    run.trace = _safe_trace(trace)
    run.result_summary = {
        "accepted": accepted,
        "qualityScore": quality_report.get("score"),
        "qualityPassed": quality_report.get("passed"),
        "errorCount": len(quality_report.get("errors") or []),
        "warningCount": len(quality_report.get("warnings") or []),
    }
    run.completed_at = utcnow()
    add_generation_run_event(
        session,
        run,
        event_type="run_completed" if accepted else "run_failed_quality_gate",
        stage=run.current_stage,
        status=run.status,
        message=message,
        payload=_event_payload(progress=1.0, trace=run.trace, extra=run.result_summary),
    )


def fail_generation_run(job_id: int, *, error: str, result: dict[str, Any], session_factory) -> None:
    with session_factory() as session:
        run = generation_run_for_job(session, job_id)
        if run is None:
            return
        trace = _safe_trace(result.get("trace"))
        progress = float(result.get("progress") or run.progress or 0.0)
        run.status = "failed"
        run.progress = progress
        run.current_stage = result.get("current_stage") or "failed"
        run.message = result.get("message") or "Course generation failed."
        run.trace = trace
        run.result_summary = {"accepted": False, "error": error}
        run.completed_at = utcnow()
        add_generation_run_event(
            session,
            run,
            event_type="run_failed",
            stage=run.current_stage,
            status="failed",
            message=error,
            payload=_event_payload(progress=progress, trace=trace, extra={"error": error}),
        )
        session.commit()


def list_generation_runs(session: Session, *, status: str | None = None, limit: int = 50) -> list[GenerationRun]:
    stmt = (
        select(GenerationRun)
        .options(selectinload(GenerationRun.events))
        .order_by(GenerationRun.created_at.desc(), GenerationRun.id.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(GenerationRun.status == status)
    return list(session.scalars(stmt))


def get_generation_run(session: Session, run_id: int) -> GenerationRun | None:
    return session.scalar(
        select(GenerationRun)
        .where(GenerationRun.id == run_id)
        .options(selectinload(GenerationRun.events))
        .limit(1)
    )
