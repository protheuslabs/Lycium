from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.coverage import recompute_coverage
from app.generation import generate_course_direct
from app.ingestion import ingest_source
from app.models import Job, Source


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
