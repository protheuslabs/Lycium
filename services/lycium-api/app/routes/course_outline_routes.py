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
from app.course_quality import assess_course_quality
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
    @app.post("/v1/courses/outlines", response_model=CourseDraftRead, status_code=status.HTTP_201_CREATED)
    def create_outline(payload: GenerateOutlineRequest, session: Session = Depends(get_session)) -> CourseDraft:
        try:
            validate_learner_exists(session, payload.learner_id)
            draft = create_draft(
                session,
                prompt=payload.prompt,
                learner_id=payload.learner_id,
                target_audience=payload.target_audience,
                learning_goals=payload.learning_goals,
                level=payload.level,
                expected_duration_minutes=payload.expected_duration_minutes,
                language=payload.language,
                constraints={
                    "teaching_style": payload.teaching_style,
                    "prerequisite_knowledge": payload.prerequisite_knowledge,
                    "assessment_style": payload.assessment_style,
                    "source_policy": payload.source_policy,
                    "free_only": payload.free_only,
                    "trust_min": payload.trust_min,
                },
                desired_module_count=payload.desired_module_count,
                free_only=payload.free_only or payload.source_policy == "free-only",
                trust_min=payload.trust_min,
            )
            session.commit()
            session.refresh(draft)
            return draft
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc



    @app.get("/v1/courses/outlines/{draft_id}", response_model=CourseDraftRead)
    def get_outline(draft_id: int, session: Session = Depends(get_session)) -> CourseDraft:
        draft = session.get(CourseDraft, draft_id)
        if draft is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        return draft



    @app.patch("/v1/courses/outlines/{draft_id}", response_model=CourseDraftRead)
    def update_outline(draft_id: int, payload: UpdateOutlineRequest, session: Session = Depends(get_session)) -> CourseDraft:
        draft = session.get(CourseDraft, draft_id)
        if draft is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        if payload.title is not None:
            draft.title = payload.title
        draft.outline = payload.outline
        draft.status = "draft"
        session.commit()
        session.refresh(draft)
        return draft



    @app.post("/v1/courses/outlines/{draft_id}/approve", response_model=CourseDraftRead)
    def approve_outline(
        draft_id: int,
        payload: ApproveOutlineRequest,
        session: Session = Depends(get_session),
    ) -> CourseDraft:
        draft = session.get(CourseDraft, draft_id)
        if draft is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        draft.status = "approved" if payload.approve else "rejected"
        session.commit()
        session.refresh(draft)
        return draft



    @app.post("/v1/courses/outlines/{draft_id}/generate", response_model=CourseSnapshotRead, status_code=status.HTTP_201_CREATED)
    def generate_from_outline(
        draft_id: int,
        payload: GenerateCourseFromOutlineRequest,
        session: Session = Depends(get_session),
    ) -> CourseSnapshot:
        draft = session.get(CourseDraft, draft_id)
        if draft is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        try:
            validate_learner_exists(session, payload.learner_id)
            snapshot = generate_course_from_draft(
                session,
                draft=draft,
                learner_id=payload.learner_id if payload.learner_id is not None else draft.learner_id,
                source_policy=payload.source_policy,
                free_only=payload.free_only or payload.source_policy == "free-only",
                trust_min=payload.trust_min,
            )
            session.commit()
            session.refresh(snapshot)
            save_course_snapshot(snapshot)
            return snapshot
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc



    @app.post("/v1/courses/generate", response_model=CourseSnapshotRead, status_code=status.HTTP_201_CREATED)
    def generate_course(payload: GenerateCourseRequest, session: Session = Depends(get_session)) -> CourseSnapshot:
        try:
            validate_learner_exists(session, payload.learner_id)
            snapshot = generate_course_direct(
                session,
                prompt=payload.prompt,
                learner_id=payload.learner_id,
                level=payload.level,
                language=payload.language,
                source_policy=payload.source_policy,
                free_only=payload.free_only or payload.source_policy == "free-only",
                trust_min=payload.trust_min,
                desired_module_count=payload.desired_module_count,
                expected_duration_minutes=payload.expected_duration_minutes,
                source_urls=[str(url) for url in payload.source_urls],
            )
            session.commit()
            session.refresh(snapshot)
            save_course_snapshot(snapshot)
            return snapshot
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc



    @app.post("/v1/agent/courses/generate", response_model=CourseSnapshotRead, status_code=status.HTTP_201_CREATED)
    def generate_course_with_llm_agent(
        payload: GenerateCourseRequest,
        session: Session = Depends(get_session),
    ) -> CourseSnapshot:
        try:
            validate_learner_exists(session, payload.learner_id)
            agent_profile = get_active_agent_profile()
            if not agent_profile or not agent_profile.get("agent_api_key"):
                raise ValueError("No active agent API key is saved. Add one in Settings first.")

            generated = generate_course_with_agent(
                prompt=payload.prompt,
                api_key=str(agent_profile["agent_api_key"]),
                provider_id=str(agent_profile.get("provider_id") or "openai"),
                level=payload.level,
                language=payload.language,
                source_policy=payload.source_policy,
                desired_module_count=payload.desired_module_count,
                expected_duration_minutes=payload.expected_duration_minutes,
                model=payload.model or agent_profile.get("model"),
                source_urls=[str(url) for url in payload.source_urls],
            )
            quality_report = assess_course_quality(generated.course, gate="review")
            if not quality_report["passed"]:
                raise ValueError(
                    "Generated course failed quality gate: "
                    + "; ".join([*quality_report["errors"], *quality_report["warnings"]][:12])
                )
            snapshot = CourseSnapshot(
                learner_id=payload.learner_id,
                draft_id=None,
                title=generated.course["title"],
                prompt=payload.prompt,
                language=payload.language,
                level=payload.level,
                source_policy=payload.source_policy,
                status="ready_for_review",
                version=1,
                structure=generated.course,
                generation_trace={**generated.trace, "quality_report": quality_report},
            )
            session.add(snapshot)
            session.commit()
            session.refresh(snapshot)
            save_course_snapshot(snapshot)
            return snapshot
        except CourseAgentError as exc:
            session.rollback()
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc
