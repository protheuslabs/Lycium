from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import analytics_summary, record_event, upsert_progress
from app.coverage import recompute_coverage
from app.course_agent_harness import (
    CourseAgentError,
    generate_course_with_agent,
    get_agent_provider,
    list_agent_provider_summaries,
    validate_agent_api_key,
)
from app.db import get_session, init_db
from app.generation import (
    ask_instructor,
    create_draft,
    fork_course,
    generate_course_direct,
    generate_course_from_draft,
    generate_program,
    refresh_course,
    regenerate_section,
    validate_learner_exists,
)
from app.ingestion import ingest_source
from app.jobs import enqueue_job, list_jobs, run_job, run_pending_jobs
from app.local_store import (
    activate_agent_api_key,
    ensure_local_data_dirs,
    get_active_agent_profile,
    local_settings_summary,
    read_course_bookmark,
    read_completion,
    save_agent_api_key,
    save_course_bookmark,
    save_completion,
    save_course_snapshot,
    save_learner_record,
    update_agent_key_model,
)
from app.models import (
    CourseDraft,
    CourseSnapshot,
    CoverageMap,
    CredentialRecord,
    Job,
    KnowledgeObject,
    Learner,
    LearnerSectionProgress,
    PortfolioArtifact,
    ProgramSnapshot,
    Source,
)
from app.retrieval import assemble_learning_packet, search_knowledge_objects
from app.schemas import (
    AnalyticsSummaryRead,
    ApproveOutlineRequest,
    AskInstructorRequest,
    AskInstructorResponse,
    CourseDraftRead,
    CourseSnapshotRead,
    CoverageRead,
    CredentialCreate,
    CredentialRead,
    GenerateCourseFromOutlineRequest,
    GenerateCourseRequest,
    GenerateOutlineRequest,
    IngestSourceRequest,
    IngestSourceResponse,
    JobCreate,
    JobRead,
    KnowledgeObjectRead,
    KnowledgeSearchResponse,
    LearnerCreate,
    LearnerRead,
    LearnerUpdate,
    LearningPacket,
    LearningPacketRequest,
    LocalActiveAgentKeyUpdate,
    LocalAgentKeyModelUpdate,
    LocalAiProviderRead,
    LocalCourseBookmarkRead,
    LocalCourseBookmarkUpdate,
    LocalCompletionRead,
    LocalCompletionUpdate,
    LocalSettingsRead,
    LocalSettingsUpdate,
    PortfolioArtifactCreate,
    PortfolioArtifactRead,
    ProgramGenerateRequest,
    ProgramSnapshotRead,
    ProgressRead,
    ProgressUpdateRequest,
    RegenerateSectionRequest,
    SourceRead,
    UpdateOutlineRequest,
)






def register(app: FastAPI) -> None:
    @app.get("/v1/courses", response_model=list[CourseSnapshotRead])
    def list_courses(
        learner_id: int | None = None,
        limit: int = Query(default=200, ge=1, le=1000),
        session: Session = Depends(get_session),
    ) -> list[CourseSnapshot]:
        stmt = select(CourseSnapshot).order_by(CourseSnapshot.created_at.desc()).limit(limit)
        if learner_id is not None:
            stmt = stmt.where(CourseSnapshot.learner_id == learner_id)
        return list(session.scalars(stmt))



    @app.get("/v1/courses/{course_snapshot_id}", response_model=CourseSnapshotRead)
    def get_course(course_snapshot_id: int, session: Session = Depends(get_session)) -> CourseSnapshot:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        return row



    @app.get("/v1/courses/{course_snapshot_id}/export")
    def export_course(
        course_snapshot_id: int,
        format: str = Query(default="json", pattern="^(json)$"),
        session: Session = Depends(get_session),
    ) -> JSONResponse:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        if format != "json":
            raise HTTPException(status_code=400, detail="Unsupported export format")
        payload: dict[str, Any] = {
            "id": row.id,
            "title": row.title,
            "prompt": row.prompt,
            "language": row.language,
            "level": row.level,
            "source_policy": row.source_policy,
            "version": row.version,
            "structure": row.structure,
            "generation_trace": row.generation_trace,
        }
        return JSONResponse(payload)



    @app.post("/v1/courses/{course_snapshot_id}/fork", response_model=CourseSnapshotRead, status_code=status.HTTP_201_CREATED)
    def fork_course_endpoint(
        course_snapshot_id: int,
        learner_id: int | None = None,
        session: Session = Depends(get_session),
    ) -> CourseSnapshot:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        try:
            validate_learner_exists(session, learner_id)
            clone = fork_course(session, course=row, learner_id=learner_id)
            session.commit()
            session.refresh(clone)
            save_course_snapshot(clone)
            return clone
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc



    @app.post("/v1/courses/{course_snapshot_id}/refresh", response_model=CourseSnapshotRead, status_code=status.HTTP_201_CREATED)
    def refresh_course_endpoint(
        course_snapshot_id: int,
        learner_id: int | None = None,
        free_only: bool = False,
        trust_min: float = Query(default=0.0, ge=0.0, le=1.0),
        session: Session = Depends(get_session),
    ) -> CourseSnapshot:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        try:
            validate_learner_exists(session, learner_id)
            refreshed = refresh_course(
                session,
                course=row,
                learner_id=learner_id if learner_id is not None else row.learner_id,
                free_only=free_only,
                trust_min=trust_min,
            )
            session.commit()
            session.refresh(refreshed)
            save_course_snapshot(refreshed)
            return refreshed
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc



    @app.post("/v1/courses/{course_snapshot_id}/regenerate-section", response_model=CourseSnapshotRead)
    def regenerate_section_endpoint(
        course_snapshot_id: int,
        payload: RegenerateSectionRequest,
        session: Session = Depends(get_session),
    ) -> CourseSnapshot:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        try:
            updated = regenerate_section(
                session,
                course=row,
                module_id=payload.module_id,
                section_id=payload.section_id,
                free_only=payload.free_only or payload.source_policy == "free-only",
                trust_min=payload.trust_min,
                source_policy=payload.source_policy,
            )
            session.commit()
            session.refresh(updated)
            save_course_snapshot(updated)
            return updated
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc



    @app.post("/v1/courses/{course_snapshot_id}/ask", response_model=AskInstructorResponse)
    def ask_course(
        course_snapshot_id: int,
        payload: AskInstructorRequest,
        session: Session = Depends(get_session),
    ) -> AskInstructorResponse:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        try:
            answer = ask_instructor(
                row,
                section_id=payload.section_id,
                question=payload.question,
                response_mode=payload.response_mode,
            )
            record_event(
                session,
                learner_id=payload.learner_id,
                course_snapshot_id=row.id,
                section_id=payload.section_id,
                event_type="question_asked",
                payload={"question": payload.question, "mode": payload.response_mode},
            )
            session.commit()
            return AskInstructorResponse(**answer)
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc



    @app.post("/v1/courses/{course_snapshot_id}/progress", response_model=ProgressRead)
    def update_progress(
        course_snapshot_id: int,
        payload: ProgressUpdateRequest,
        session: Session = Depends(get_session),
    ) -> LearnerSectionProgress:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        learner = session.get(Learner, payload.learner_id)
        if learner is None:
            raise HTTPException(status_code=404, detail="Learner not found")

        known_sections = {
            section["id"]
            for module in row.structure.get("modules", [])
            for section in module.get("sections", [])
            if "id" in section
        }
        if payload.section_id not in known_sections:
            raise HTTPException(status_code=400, detail="section_id is not part of the selected course snapshot")

        progress = upsert_progress(
            session,
            learner_id=payload.learner_id,
            course_snapshot_id=course_snapshot_id,
            section_id=payload.section_id,
            completion_state=payload.completion_state,
            mastery_score=payload.mastery_score,
        )
        if payload.event_type:
            record_event(
                session,
                learner_id=payload.learner_id,
                course_snapshot_id=course_snapshot_id,
                section_id=payload.section_id,
                event_type=payload.event_type,
                payload=payload.event_payload,
            )
        session.commit()
        session.refresh(progress)
        if payload.completion_state in {"completed", "mastered"}:
            save_completion(
                course_key=f"remote-{course_snapshot_id}",
                course_title=row.title,
                section_id=payload.section_id,
                completed_section_ids=[payload.section_id],
            )
        return progress



    @app.get("/v1/courses/{course_snapshot_id}/progress", response_model=list[ProgressRead])
    def get_progress(
        course_snapshot_id: int,
        learner_id: int,
        session: Session = Depends(get_session),
    ) -> list[LearnerSectionProgress]:
        stmt = select(LearnerSectionProgress).where(
            LearnerSectionProgress.course_snapshot_id == course_snapshot_id,
            LearnerSectionProgress.learner_id == learner_id,
        )
        return list(session.scalars(stmt))



    @app.get("/v1/courses/{course_snapshot_id}/analytics", response_model=AnalyticsSummaryRead)
    def course_analytics(
        course_snapshot_id: int,
        learner_id: int | None = None,
        session: Session = Depends(get_session),
    ) -> AnalyticsSummaryRead:
        row = session.get(CourseSnapshot, course_snapshot_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found")
        summary = analytics_summary(session, course_snapshot=row, learner_id=learner_id)
        return AnalyticsSummaryRead(**summary)
