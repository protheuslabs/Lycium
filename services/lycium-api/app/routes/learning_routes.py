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
from app.retrieval import assemble_learning_packet, evaluate_retrieval_quality, search_knowledge_objects
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
    RetrievalQualityReportRead,
    SourceRead,
    UpdateOutlineRequest,
)




def register(app: FastAPI) -> None:
    @app.post("/v1/learners", response_model=LearnerRead, status_code=status.HTTP_201_CREATED)
    def create_learner(payload: LearnerCreate, session: Session = Depends(get_session)) -> Learner:
        learner = Learner(
            name=payload.name,
            goal=payload.goal,
            level=payload.level,
            preferences=payload.preferences,
        )
        session.add(learner)
        session.commit()
        session.refresh(learner)
        save_learner_record(learner)
        return learner


    @app.get("/v1/learners", response_model=list[LearnerRead])
    def list_learners(
        limit: int = Query(default=100, ge=1, le=500),
        session: Session = Depends(get_session),
    ) -> list[Learner]:
        return list(session.scalars(select(Learner).order_by(Learner.created_at.desc()).limit(limit)))


    @app.get("/v1/learners/{learner_id}", response_model=LearnerRead)
    def get_learner(learner_id: int, session: Session = Depends(get_session)) -> Learner:
        learner = session.get(Learner, learner_id)
        if learner is None:
            raise HTTPException(status_code=404, detail="Learner not found")
        return learner


    @app.patch("/v1/learners/{learner_id}", response_model=LearnerRead)
    def update_learner(
        learner_id: int,
        payload: LearnerUpdate,
        session: Session = Depends(get_session),
    ) -> Learner:
        learner = session.get(Learner, learner_id)
        if learner is None:
            raise HTTPException(status_code=404, detail="Learner not found")
        if payload.name is not None:
            learner.name = payload.name
        if payload.goal is not None:
            learner.goal = payload.goal
        if payload.level is not None:
            learner.level = payload.level
        if payload.preferences is not None:
            learner.preferences = payload.preferences
        session.commit()
        session.refresh(learner)
        save_learner_record(learner)
        return learner


    @app.post("/v1/sources/ingest", response_model=IngestSourceResponse, status_code=status.HTTP_201_CREATED)
    def ingest_source_endpoint(
        payload: IngestSourceRequest,
        session: Session = Depends(get_session),
    ) -> IngestSourceResponse:
        result = ingest_source(
            session,
            url=str(payload.url),
            source_type=payload.source_type,
            license=payload.license,
            is_free=payload.is_free,
            author=payload.author,
            publisher=payload.publisher,
            archive_requested=payload.archive_requested,
        )
        session.commit()
        return IngestSourceResponse(
            source_id=result.source_id,
            snapshot_id=result.snapshot_id,
            new_snapshot=result.new_snapshot,
            knowledge_objects_created=result.knowledge_objects_created,
            topic=result.topic,
        )


    @app.get("/v1/sources", response_model=list[SourceRead])
    def list_sources(
        free_only: bool = False,
        domain: str | None = None,
        limit: int = Query(default=100, ge=1, le=500),
        session: Session = Depends(get_session),
    ) -> list[Source]:
        stmt = select(Source).order_by(Source.last_verified_at.desc()).limit(limit)
        if free_only:
            stmt = stmt.where(Source.is_free.is_(True))
        if domain:
            stmt = stmt.where(Source.normalized_domain.ilike(f"%{domain.lower()}%"))
        return list(session.scalars(stmt))


    @app.get("/v1/sources/{source_id}", response_model=SourceRead)
    def get_source(source_id: int, session: Session = Depends(get_session)) -> Source:
        source = session.get(Source, source_id)
        if source is None:
            raise HTTPException(status_code=404, detail="Source not found")
        return source


    @app.get("/v1/knowledge/search", response_model=KnowledgeSearchResponse)
    def search_knowledge(
        query: str = Query(min_length=2),
        top_k: int = Query(default=20, ge=1, le=100),
        free_only: bool = False,
        trust_min: float = Query(default=0.0, ge=0.0, le=1.0),
        modality: str | None = None,
        topic: str | None = None,
        level: str | None = None,
        session: Session = Depends(get_session),
    ) -> KnowledgeSearchResponse:
        objects = search_knowledge_objects(
            session,
            query=query,
            top_k=top_k,
            free_only=free_only,
            trust_min=trust_min,
            modality=modality,
            topic=topic,
            level=level,
        )
        parsed = [KnowledgeObjectRead.model_validate(obj) for obj in objects]
        return KnowledgeSearchResponse(query=query, returned=len(parsed), objects=parsed)


    @app.get("/v1/knowledge/evaluate", response_model=RetrievalQualityReportRead)
    def evaluate_knowledge_retrieval(
        query: str = Query(min_length=2),
        top_k: int = Query(default=20, ge=1, le=100),
        free_only: bool = False,
        trust_min: float = Query(default=0.0, ge=0.0, le=1.0),
        modality: str | None = None,
        topic: str | None = None,
        level: str | None = None,
        session: Session = Depends(get_session),
    ) -> RetrievalQualityReportRead:
        objects = search_knowledge_objects(
            session,
            query=query,
            top_k=top_k,
            free_only=free_only,
            trust_min=trust_min,
            modality=modality,
            topic=topic,
            level=level,
        )
        return RetrievalQualityReportRead(**evaluate_retrieval_quality(objects, query=query, trust_min=trust_min).__dict__)


    @app.post("/v1/retrieval/packet", response_model=LearningPacket)
    def retrieval_packet(payload: LearningPacketRequest, session: Session = Depends(get_session)) -> LearningPacket:
        packet = assemble_learning_packet(
            session,
            query=payload.query,
            top_k=payload.top_k,
            free_only=payload.free_only,
            trust_min=payload.trust_min,
            modality=payload.modality,
            topic=payload.topic,
            level=payload.level,
        )
        return LearningPacket(**packet)


    @app.post("/v1/coverage/recompute", response_model=list[CoverageRead])
    def recompute_coverage_endpoint(topic: str | None = None, session: Session = Depends(get_session)) -> list[CoverageMap]:
        coverage_rows = recompute_coverage(session, topic=topic)
        session.commit()
        return coverage_rows


    @app.get("/v1/coverage", response_model=list[CoverageRead])
    def list_coverage(
        limit: int = Query(default=200, ge=1, le=1000),
        session: Session = Depends(get_session),
    ) -> list[CoverageMap]:
        return list(session.scalars(select(CoverageMap).order_by(CoverageMap.updated_at.desc()).limit(limit)))


    @app.get("/v1/coverage/{topic}", response_model=CoverageRead)
    def get_coverage(topic: str, session: Session = Depends(get_session)) -> CoverageMap:
        row = session.scalar(select(CoverageMap).where(CoverageMap.topic == topic))
        if row is None:
            raise HTTPException(status_code=404, detail="Coverage topic not found")
        return row
