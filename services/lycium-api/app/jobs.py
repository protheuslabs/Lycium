from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import db
from app.coverage import recompute_coverage
from app.course_agent_harness import CourseAgentError, generate_course_with_agent_staged
from app.course_quality import assess_course_quality
from app.course_generation_service import build_course_snapshot_from_agent_result
from app.curriculum_artifacts import persist_curriculum_artifacts_for_snapshot
from app.generation import generate_course_direct
from app.generation_observability import (
    complete_generation_run,
    fail_generation_run,
    record_generation_run_checkpoint,
    start_generation_run,
)
from app.ingestion import ingest_source
from app.local_store import require_verified_active_agent_profile, save_course_snapshot
from app.models import CourseSnapshot, Job, Source
from app.source_index import persist_source_corpus_run

GENERATION_JOB_LOG_LIMIT = 5


def enqueue_job(session: Session, *, job_type: str, payload: dict[str, Any]) -> Job:
    job = Job(job_type=job_type, payload=payload, status="pending", result={})
    session.add(job)
    session.flush()
    return job


def list_jobs(session: Session, *, status: str | None = None, limit: int = 100) -> list[Job]:
    stmt = select(Job).order_by(Job.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Job.status == status)
    return list(session.scalars(stmt))


def _run_ingest_source(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    required = payload.get("url")
    if not required:
        raise ValueError("ingest_source job requires payload.url")
    result = ingest_source(
        session,
        url=payload["url"],
        source_type=payload.get("source_type", "web"),
        license=payload.get("license", "unknown"),
        is_free=bool(payload.get("is_free", True)),
        author=payload.get("author"),
        publisher=payload.get("publisher"),
        archive_requested=bool(payload.get("archive_requested", False)),
    )
    return {
        "source_id": result.source_id,
        "snapshot_id": result.snapshot_id,
        "new_snapshot": result.new_snapshot,
        "knowledge_objects_created": result.knowledge_objects_created,
        "topic": result.topic,
    }


def _run_recompute_coverage(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    topic = payload.get("topic")
    rows = recompute_coverage(session, topic=topic)
    return {"updated_topics": [row.topic for row in rows], "count": len(rows)}


def _run_generate_course(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    prompt = payload.get("prompt")
    if not prompt:
        raise ValueError("generate_course job requires payload.prompt")
    snapshot = generate_course_direct(
        session,
        prompt=prompt,
        learner_id=payload.get("learner_id"),
        level=payload.get("level"),
        language=payload.get("language", "en"),
        source_policy=payload.get("source_policy", "balanced"),
        free_only=bool(payload.get("free_only", False)),
        trust_min=float(payload.get("trust_min", 0.0)),
        desired_module_count=int(payload.get("desired_module_count", 3)),
        expected_duration_minutes=int(payload.get("expected_duration_minutes", 180)),
        source_urls=[str(url) for url in payload.get("source_urls") or []],
        source_packet_id=payload.get("source_packet_id"),
        source_packet=payload.get("source_packet") if isinstance(payload.get("source_packet"), dict) else None,
        category=payload.get("category"),
        department=payload.get("department"),
    )
    return {"course_snapshot_id": snapshot.id, "title": snapshot.title}


def _run_revalidate_source(session: Session, payload: dict[str, Any]) -> dict[str, Any]:
    source: Source | None = None
    if "source_id" in payload:
        source = session.get(Source, int(payload["source_id"]))
    elif "url" in payload:
        source = session.scalar(select(Source).where(Source.canonical_url == payload["url"]))
    if source is None:
        raise ValueError("revalidate_source job requires a valid source_id or url")

    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            response = client.head(source.canonical_url)
            if response.status_code >= 400:
                response = client.get(source.canonical_url)
        source.link_health = "healthy" if response.status_code < 400 else "broken"
        source.last_verified_at = datetime.now(UTC)
        return {"source_id": source.id, "status_code": response.status_code, "link_health": source.link_health}
    except Exception as exc:
        source.link_health = "unknown"
        source.last_verified_at = datetime.now(UTC)
        return {"source_id": source.id, "link_health": source.link_health, "error": str(exc)}


def _generation_expected_stage_count(payload: dict[str, Any]) -> int:
    desired_modules = int(payload.get("desired_module_count") or 3)
    return max(1, 1 + desired_modules * 7)


def _checkpoint_stage(trace: dict[str, Any]) -> str | None:
    stages = trace.get("stages")
    if isinstance(stages, list) and stages:
        latest = stages[-1]
        if isinstance(latest, dict):
            return str(latest.get("stage") or "")
    return None


def _checkpoint_progress(payload: dict[str, Any], trace: dict[str, Any]) -> float:
    stages = trace.get("stages")
    completed = len(stages) if isinstance(stages, list) else 0
    return min(0.95, completed / _generation_expected_stage_count(payload))


def _update_generation_job(job_id: int, updates: dict[str, Any], *, status: str | None = None, error: str | None = None) -> None:
    with db.SessionLocal() as session:
        job = session.get(Job, job_id)
        if job is None:
            return
        result = dict(job.result or {})
        result.update(updates)
        job.result = result
        if status is not None:
            job.status = status
        if error is not None:
            job.error = error
        if status in {"completed", "failed"}:
            _trim_generation_job_logs(session)
        session.commit()


def _trim_generation_job_logs(session: Session) -> None:
    generation_jobs = list(
        session.scalars(
            select(Job)
            .where(Job.job_type == "agent_generate_course_staged")
            .order_by(Job.created_at.desc(), Job.id.desc())
        )
    )
    for old_job in generation_jobs[GENERATION_JOB_LOG_LIMIT:]:
        session.delete(old_job)


def _course_snapshot_payload(snapshot: CourseSnapshot) -> dict[str, Any]:
    return {
        "id": snapshot.id,
        "title": snapshot.title,
        "status": snapshot.status,
        "structure": snapshot.structure,
        "generation_trace": snapshot.generation_trace,
        "created_at": snapshot.created_at.isoformat(),
        "updated_at": snapshot.updated_at.isoformat(),
    }


def _persist_source_index_for_generation(session: Session, *, job_id: int, payload: dict[str, Any], trace: dict[str, Any]) -> None:
    synthesis = trace.get("source_corpus_synthesis") or trace.get("sourceCorpusSynthesis")
    if not isinstance(synthesis, dict):
        return
    persist_source_corpus_run(
        session,
        consumer="lycium",
        context_id=f"course-generation-job:{job_id}",
        prompt=str(payload.get("prompt") or ""),
        source_urls=[str(url) for url in payload.get("source_urls") or []],
        synthesis=synthesis,
    )


def run_agent_course_generation_job(job_id: int) -> None:
    with db.SessionLocal() as session:
        job = session.get(Job, job_id)
        if job is None:
            return
        payload = dict(job.payload or {})
        previous_result = dict(job.result or {}) if isinstance(job.result, dict) else {}
        resume_course = previous_result.get("course") if isinstance(previous_result.get("course"), dict) else None
        resume_trace = previous_result.get("trace") if isinstance(previous_result.get("trace"), dict) else None
        job.status = "running"
        job.attempts += 1
        job.error = None
        job.result = {
            "request": payload,
            "progress": 0.0,
            "current_stage": "course_plan",
            "message": "Planning course structure.",
            "trace": {"mode": "staged-llm-agent", "stages": []},
        }
        start_generation_run(session, job, message="Planning course structure.", progress=0.0)
        session.commit()

    try:
        agent_profile = require_verified_active_agent_profile()

        def checkpoint(update: dict[str, Any]) -> None:
            trace = update.get("trace") if isinstance(update.get("trace"), dict) else {}
            current_stage = _checkpoint_stage(trace) or "course_plan"
            partial_course = update.get("partial_course")
            next_result: dict[str, Any] = {
                "request": payload,
                "progress": _checkpoint_progress(payload, trace),
                "current_stage": current_stage,
                "message": f"Generated {current_stage.replace('_', ' ')}.",
                "trace": trace,
            }
            if isinstance(partial_course, dict):
                next_result["course"] = partial_course
            _update_generation_job(job_id, next_result, status="running")
            record_generation_run_checkpoint(job_id, next_result, session_factory=db.SessionLocal)

        generated = generate_course_with_agent_staged(
            prompt=str(payload.get("prompt") or ""),
            api_key=str(agent_profile["agent_api_key"]),
            provider_id=str(agent_profile.get("provider_id") or "openai"),
            level=payload.get("level"),
            language=str(payload.get("language") or "en"),
            source_policy=str(payload.get("source_policy") or "balanced"),
            category=payload.get("category"),
            department=payload.get("department"),
            desired_module_count=int(payload.get("desired_module_count") or 3),
            expected_duration_minutes=int(payload.get("expected_duration_minutes") or 180),
            model=payload.get("model") or agent_profile.get("model"),
            source_urls=[str(url) for url in payload.get("source_urls") or []],
            source_packet_id=payload.get("source_packet_id"),
            source_packet=payload.get("source_packet") if isinstance(payload.get("source_packet"), dict) else None,
            enforce_contract=False,
            on_checkpoint=checkpoint,
            resume_course=resume_course,
            resume_trace=resume_trace,
        )
        quality_report = assess_course_quality(generated.course, gate="generation")
        snapshot_payload = None

        with db.SessionLocal() as session:
            job = session.get(Job, job_id)
            if job is None:
                return
            if quality_report["passed"]:
                snapshot = build_course_snapshot_from_agent_result(
                    session,
                    learner_id=payload.get("learner_id"),
                    prompt=str(payload.get("prompt") or ""),
                    language=str(payload.get("language") or "en"),
                    level=payload.get("level"),
                    source_policy=str(payload.get("source_policy") or "balanced"),
                    generated=generated,
                    quality_report=quality_report,
                )
                session.refresh(snapshot)
                save_course_snapshot(snapshot)
                snapshot_payload = _course_snapshot_payload(snapshot)

            accepted = bool(quality_report["passed"])
            job.status = "completed" if accepted else "failed"
            job.error = None if accepted else "; ".join([*quality_report["errors"], *quality_report["warnings"]][:12])
            final_trace = {**generated.trace, "quality_report": quality_report}
            _persist_source_index_for_generation(session, job_id=job_id, payload=payload, trace=final_trace)
            job.result = {
                "request": payload,
                "accepted": accepted,
                "progress": 1.0,
                "current_stage": "ready_for_review" if accepted else "quality_eval",
                "message": "Course ready for review." if accepted else "Course failed the generation quality gate.",
                "course": generated.course,
                "quality_report": quality_report,
                "trace": final_trace,
                "course_snapshot": snapshot_payload,
            }
            complete_generation_run(
                session,
                job_id=job_id,
                accepted=accepted,
                message="Course ready for review." if accepted else "Course failed the generation quality gate.",
                trace=final_trace,
                quality_report=quality_report,
                course_snapshot_id=snapshot_payload["id"] if snapshot_payload else None,
            )
            _trim_generation_job_logs(session)
            session.commit()
    except Exception as exc:
        trace = getattr(exc, "trace", {}) if isinstance(exc, CourseAgentError) else {}
        partial_course = trace.get("partial_course") if isinstance(trace, dict) else None
        failed_stage = trace.get("failed_stage") or _checkpoint_stage(trace) if isinstance(trace, dict) else None
        result: dict[str, Any] = {
            "request": payload,
            "accepted": False,
            "progress": _checkpoint_progress(payload, trace) if isinstance(trace, dict) else 0.0,
            "current_stage": failed_stage,
            "message": "Course generation failed.",
            "trace": {key: value for key, value in trace.items() if key != "partial_course"} if isinstance(trace, dict) else {},
        }
        if isinstance(partial_course, dict):
            result["course"] = partial_course
        fail_generation_run(job_id, error=str(exc), result=result, session_factory=db.SessionLocal)
        if isinstance(trace, dict):
            with db.SessionLocal() as session:
                _persist_source_index_for_generation(session, job_id=job_id, payload=payload, trace=trace)
                session.commit()
        _update_generation_job(job_id, result, status="failed", error=str(exc))


def run_job(session: Session, job: Job) -> Job:
    handlers = {
        "ingest_source": _run_ingest_source,
        "recompute_coverage": _run_recompute_coverage,
        "generate_course": _run_generate_course,
        "revalidate_source": _run_revalidate_source,
    }
    if job.job_type not in handlers:
        raise ValueError(f"Unsupported job type '{job.job_type}'")

    job.status = "running"
    job.attempts += 1
    session.flush()

    try:
        result = handlers[job.job_type](session, job.payload)
        job.status = "completed"
        job.result = result
        job.error = None
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.result = {}
    finally:
        session.flush()
    return job


def run_pending_jobs(session: Session, *, max_jobs: int = 10) -> list[Job]:
    pending = list(
        session.scalars(
            select(Job).where(Job.status == "pending").order_by(Job.created_at.asc()).limit(max_jobs)
        )
    )
    completed: list[Job] = []
    for job in pending:
        completed.append(run_job(session, job))
    return completed
