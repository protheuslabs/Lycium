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
    @app.post("/v1/portfolio", response_model=PortfolioArtifactRead, status_code=status.HTTP_201_CREATED)
    def create_portfolio_artifact(
        payload: PortfolioArtifactCreate,
        session: Session = Depends(get_session),
    ) -> PortfolioArtifact:
        learner = session.get(Learner, payload.learner_id)
        if learner is None:
            raise HTTPException(status_code=404, detail="Learner not found")
        artifact = PortfolioArtifact(
            learner_id=payload.learner_id,
            course_snapshot_id=payload.course_snapshot_id,
            title=payload.title,
            artifact_type=payload.artifact_type,
            url=payload.url,
            artifact_metadata=payload.artifact_metadata,
        )
        session.add(artifact)
        session.commit()
        session.refresh(artifact)
        return artifact


    @app.get("/v1/portfolio", response_model=list[PortfolioArtifactRead])
    def list_portfolio(
        learner_id: int,
        session: Session = Depends(get_session),
    ) -> list[PortfolioArtifact]:
        return list(
            session.scalars(
                select(PortfolioArtifact)
                .where(PortfolioArtifact.learner_id == learner_id)
                .order_by(PortfolioArtifact.created_at.desc())
            )
        )


    @app.post("/v1/credentials", response_model=CredentialRead, status_code=status.HTTP_201_CREATED)
    def create_credential(payload: CredentialCreate, session: Session = Depends(get_session)) -> CredentialRecord:
        learner = session.get(Learner, payload.learner_id)
        if learner is None:
            raise HTTPException(status_code=404, detail="Learner not found")
        credential = CredentialRecord(
            learner_id=payload.learner_id,
            kind=payload.kind,
            title=payload.title,
            evidence=payload.evidence,
        )
        session.add(credential)
        session.commit()
        session.refresh(credential)
        return credential


    @app.get("/v1/credentials", response_model=list[CredentialRead])
    def list_credentials(learner_id: int, session: Session = Depends(get_session)) -> list[CredentialRecord]:
        return list(
            session.scalars(
                select(CredentialRecord)
                .where(CredentialRecord.learner_id == learner_id)
                .order_by(CredentialRecord.issued_at.desc())
            )
        )


    @app.post("/v1/programs/generate", response_model=ProgramSnapshotRead, status_code=status.HTTP_201_CREATED)
    def generate_program_endpoint(
        payload: ProgramGenerateRequest,
        session: Session = Depends(get_session),
    ) -> ProgramSnapshot:
        try:
            validate_learner_exists(session, payload.learner_id)
            program = generate_program(
                session,
                goal=payload.goal,
                learner_id=payload.learner_id,
                level=payload.level,
                free_only=payload.free_only or payload.source_policy == "free-only",
                source_policy=payload.source_policy,
                trust_min=payload.trust_min,
                desired_course_count=payload.desired_course_count,
                source_urls=[str(url) for url in payload.source_urls],
            )
            session.commit()
            session.refresh(program)
            return program
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc


    @app.get("/v1/programs", response_model=list[ProgramSnapshotRead])
    def list_programs(
        learner_id: int | None = None,
        limit: int = Query(default=100, ge=1, le=1000),
        session: Session = Depends(get_session),
    ) -> list[ProgramSnapshot]:
        stmt = select(ProgramSnapshot).order_by(ProgramSnapshot.created_at.desc()).limit(limit)
        if learner_id is not None:
            stmt = stmt.where(ProgramSnapshot.learner_id == learner_id)
        return list(session.scalars(stmt))


    @app.get("/v1/programs/{program_id}", response_model=ProgramSnapshotRead)
    def get_program(program_id: int, session: Session = Depends(get_session)) -> ProgramSnapshot:
        row = session.get(ProgramSnapshot, program_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Program not found")
        return row


    @app.get("/v1/catalog")
    def catalog(
        query: str | None = None,
        free_only: bool = False,
        trust_min: float = Query(default=0.0, ge=0.0, le=1.0),
        level: str | None = None,
        limit: int = Query(default=30, ge=1, le=200),
        session: Session = Depends(get_session),
    ) -> dict[str, Any]:
        if query:
            objects = search_knowledge_objects(
                session,
                query=query,
                top_k=limit,
                free_only=free_only,
                trust_min=trust_min,
                level=level,
            )
        else:
            stmt = select(KnowledgeObject).order_by(KnowledgeObject.created_at.desc()).limit(limit)
            if level:
                stmt = stmt.where(KnowledgeObject.difficulty == level)
            if trust_min > 0:
                stmt = stmt.where(KnowledgeObject.trust_score >= trust_min)
            objects = list(session.scalars(stmt))
            if free_only:
                allowed_sources = {
                    source.id for source in session.scalars(select(Source.id).where(Source.is_free.is_(True)))
                }
                objects = [obj for obj in objects if obj.source_id in allowed_sources]

        courses = list(
            session.scalars(
                select(CourseSnapshot)
                .where(CourseSnapshot.status == "published")
                .order_by(CourseSnapshot.created_at.desc())
                .limit(12)
            )
        )
        programs = list(session.scalars(select(ProgramSnapshot).order_by(ProgramSnapshot.created_at.desc()).limit(12)))
        return {
            "query": query,
            "knowledge_objects": [KnowledgeObjectRead.model_validate(obj).model_dump() for obj in objects],
            "courses": [CourseSnapshotRead.model_validate(course).model_dump() for course in courses],
            "programs": [ProgramSnapshotRead.model_validate(program).model_dump() for program in programs],
        }


    @app.post("/v1/jobs", response_model=JobRead, status_code=status.HTTP_201_CREATED)
    def create_job(payload: JobCreate, session: Session = Depends(get_session)) -> Job:
        job = enqueue_job(session, job_type=payload.job_type, payload=payload.payload)
        session.commit()
        session.refresh(job)
        return job


    @app.get("/v1/jobs", response_model=list[JobRead])
    def list_jobs_endpoint(
        status_filter: str | None = Query(default=None, alias="status"),
        limit: int = Query(default=100, ge=1, le=500),
        session: Session = Depends(get_session),
    ) -> list[Job]:
        return list_jobs(session, status=status_filter, limit=limit)


    @app.get("/v1/jobs/{job_id}", response_model=JobRead)
    def get_job(job_id: int, session: Session = Depends(get_session)) -> Job:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        return job


    @app.post("/v1/jobs/{job_id}/run", response_model=JobRead)
    def run_job_endpoint(job_id: int, session: Session = Depends(get_session)) -> Job:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        run_job(session, job)
        session.commit()
        session.refresh(job)
        return job


    @app.post("/v1/jobs/run-pending", response_model=list[JobRead])
    def run_pending(max_jobs: int = Query(default=10, ge=1, le=100), session: Session = Depends(get_session)) -> list[Job]:
        completed = run_pending_jobs(session, max_jobs=max_jobs)
        session.commit()
        for job in completed:
            session.refresh(job)
        return completed
