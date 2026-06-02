from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.course_source_gaps import source_gap_quality_report
from app.generation_observability import complete_generation_run, start_generation_run
from app.models import CourseSnapshot, Job
from app.schemas import GenerateCourseRequest


def source_gap_job_result(session: Session, job: Job, snapshot: CourseSnapshot) -> dict[str, Any]:
    quality_report = source_gap_quality_report(snapshot)
    result = {
        "request": job.payload,
        "accepted": False,
        "progress": 1.0,
        "current_stage": "source_coverage",
        "message": "Course draft needs more sources before full generation.",
        "course": snapshot.structure,
        "quality_report": quality_report,
        "trace": {**(snapshot.generation_trace or {}), "quality_report": quality_report},
        "course_snapshot": {
            "id": snapshot.id,
            "title": snapshot.title,
            "status": snapshot.status,
            "version": snapshot.version,
        },
    }
    job.status = "completed"
    job.result = result
    start_generation_run(session, job, message="Checking source coverage.", progress=0.0)
    complete_generation_run(
        session,
        job_id=job.id,
        accepted=False,
        message=result["message"],
        trace=result["trace"],
        quality_report=quality_report,
        course_snapshot_id=snapshot.id,
    )
    return result


def job_payload_from_course_request(
    payload: GenerateCourseRequest,
    source_urls: list[str],
    model: str | None = None,
) -> dict[str, Any]:
    return {
        "prompt": payload.prompt,
        "learner_id": payload.learner_id,
        "level": payload.level,
        "language": payload.language,
        "model": model if model is not None else payload.model,
        "source_policy": payload.source_policy,
        "free_only": payload.free_only,
        "trust_min": payload.trust_min,
        "category": payload.category,
        "department": payload.department,
        "desired_module_count": payload.desired_module_count,
        "expected_duration_minutes": payload.expected_duration_minutes,
        "source_urls": source_urls,
        "source_packet_id": payload.source_packet_id,
        "source_packet": payload.source_packet,
    }
