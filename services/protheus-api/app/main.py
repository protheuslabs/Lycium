from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import analytics_summary, record_event, upsert_progress
from app.coverage import recompute_coverage
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


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_db()
        yield

    app = FastAPI(
        title="Protheus API",
        version="0.2.0",
        summary="Knowledge-platform control plane for Lyceum.",
        lifespan=lifespan,
    )

    @app.get("/healthz")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/system/boundary")
    def system_boundary() -> dict[str, str]:
        return {
            "lyceum": "learner-facing web application",
            "protheus": "knowledge platform services",
        }

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
            )
            session.commit()
            session.refresh(snapshot)
            return snapshot
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=400, detail=str(exc)) from exc

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

        courses = list(session.scalars(select(CourseSnapshot).order_by(CourseSnapshot.created_at.desc()).limit(12)))
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

    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
