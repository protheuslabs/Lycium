from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from app.course_quality import apply_course_quality_gate, assess_course_quality
from app.db import get_session
from app.local_store import save_course_snapshot
from app.models import CourseSnapshot
from app.schemas import CoursePublishRequest, CourseQualityReportRead, CourseSectionLockRequest, CourseSnapshotRead


def _get_course_or_404(session: Session, course_snapshot_id: int) -> CourseSnapshot:
    row = session.get(CourseSnapshot, course_snapshot_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Course snapshot not found")
    return row


def _set_locked_section(structure: dict, section_id: str, locked: bool) -> dict:
    metadata = dict(structure.get("metadata") or {})
    review = dict(metadata.get("review") or {})
    locked_section_ids = set(review.get("lockedSectionIds") or [])
    if locked:
        locked_section_ids.add(section_id)
    else:
        locked_section_ids.discard(section_id)
    review["lockedSectionIds"] = sorted(locked_section_ids)
    metadata["review"] = review
    return {**structure, "metadata": metadata}


def register(app: FastAPI) -> None:
    @app.get("/v1/courses/{course_snapshot_id}/quality-report", response_model=CourseQualityReportRead)
    def get_course_quality_report(course_snapshot_id: int, session: Session = Depends(get_session)) -> dict:
        row = _get_course_or_404(session, course_snapshot_id)
        return assess_course_quality(row.structure, gate="publish")

    @app.post("/v1/courses/{course_snapshot_id}/submit-review", response_model=CourseSnapshotRead)
    def submit_course_for_review(course_snapshot_id: int, session: Session = Depends(get_session)) -> CourseSnapshot:
        row = _get_course_or_404(session, course_snapshot_id)
        apply_course_quality_gate(row, gate="review")
        session.commit()
        session.refresh(row)
        save_course_snapshot(row)
        return row

    @app.post("/v1/courses/{course_snapshot_id}/publish", response_model=CourseSnapshotRead)
    def publish_course(
        course_snapshot_id: int,
        payload: CoursePublishRequest | None = None,
        session: Session = Depends(get_session),
    ) -> CourseSnapshot:
        row = _get_course_or_404(session, course_snapshot_id)
        report = apply_course_quality_gate(row, gate="publish")
        if not report["passed"] and not (payload and payload.force):
            session.rollback()
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=report)

        trace = dict(row.generation_trace or {})
        lifecycle = dict(trace.get("lifecycle") or {})
        lifecycle["reviewedBy"] = payload.reviewer_id if payload else None
        lifecycle["reviewNotes"] = payload.notes if payload else None
        lifecycle["qualityReport"] = report
        trace["lifecycle"] = lifecycle
        row.generation_trace = trace
        row.status = "published"
        session.commit()
        session.refresh(row)
        save_course_snapshot(row)
        return row

    @app.post("/v1/courses/{course_snapshot_id}/sections/lock", response_model=CourseSnapshotRead)
    def lock_course_section(
        course_snapshot_id: int,
        payload: CourseSectionLockRequest,
        session: Session = Depends(get_session),
    ) -> CourseSnapshot:
        row = _get_course_or_404(session, course_snapshot_id)
        row.structure = _set_locked_section(dict(row.structure), payload.section_id, payload.locked)
        row.version += 1
        row.status = "ready_for_review" if row.status == "published" else row.status
        apply_course_quality_gate(row, gate="review")
        session.commit()
        session.refresh(row)
        save_course_snapshot(row)
        return row
