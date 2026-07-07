from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import analytics_summary, record_event, upsert_progress
from app.coverage import recompute_coverage
from app.course_agent_harness import (
    CourseAgentError,
    generate_course_with_agent,
    generate_course_with_agent_staged,
    get_agent_provider,
    list_agent_provider_summaries,
    validate_agent_api_key,
)
from app.course_quality import assess_course_quality
from app.course_generation_service import (
    assess_agent_generation_result,
    build_course_snapshot_from_agent_result,
    validate_generation_taxonomy_input,
)
from app.course_generation_job_helpers import job_payload_from_course_request, source_gap_job_result
from app.course_generation_route_inputs import generation_readiness_for_request, generation_source_urls
from app.curriculum_artifacts import persist_curriculum_artifacts_for_snapshot
from app.db import get_session, init_db
from app.generation import (
    ask_instructor,
    create_needs_sources_course_snapshot,
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
from app.jobs import enqueue_job, list_jobs, run_agent_course_generation_job, run_job, run_pending_jobs
from app.local_store import (
    activate_agent_api_key,
    ensure_local_data_dirs,
    get_active_agent_profile,
    local_settings_summary,
    read_course_bookmark,
    read_completion,
    require_verified_active_agent_profile,
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
from app.routes.course_generation_responses import course_generation_job_response, failed_experiment_response
from app.schemas import (
    AnalyticsSummaryRead,
    ApproveOutlineRequest,
    AskInstructorRequest,
    AskInstructorResponse,
    CourseDraftRead,
    CourseGenerationExperimentRead,
    CourseGenerationJobRead,
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
            taxonomy_errors = validate_generation_taxonomy_input(payload.category, payload.department)
            if taxonomy_errors:
                raise ValueError("; ".join(taxonomy_errors))
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
                source_urls=generation_source_urls(payload),
                source_packet_id=payload.source_packet_id,
                source_packet=payload.source_packet,
                input_artifacts=payload.input_artifacts,
                category=payload.category,
                department=payload.department,
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
            taxonomy_errors = validate_generation_taxonomy_input(payload.category, payload.department)
            if taxonomy_errors:
                raise ValueError("; ".join(taxonomy_errors))
            source_urls = generation_source_urls(payload)
            readiness = generation_readiness_for_request(payload, source_urls)
            if not bool(readiness["ready"]):
                snapshot = create_needs_sources_course_snapshot(
                    session,
                    prompt=payload.prompt,
                    learner_id=payload.learner_id,
                    level=payload.level,
                    language=payload.language,
                    source_policy=payload.source_policy,
                    desired_module_count=payload.desired_module_count,
                    expected_duration_minutes=payload.expected_duration_minutes,
                    source_urls=source_urls,
                    source_packet=payload.source_packet,
                    source_gate=readiness.get("sourceGate"),
                    generation_readiness=readiness,
                    category=payload.category,
                    department=payload.department,
                )
                session.commit()
                session.refresh(snapshot)
                save_course_snapshot(snapshot)
                return snapshot
            agent_profile = require_verified_active_agent_profile()

            generated = generate_course_with_agent_staged(
                prompt=payload.prompt,
                api_key=str(agent_profile["agent_api_key"]),
                provider_id=str(agent_profile.get("provider_id") or "openai"),
                level=payload.level,
                language=payload.language,
                source_policy=payload.source_policy,
                category=payload.category,
                department=payload.department,
                desired_module_count=payload.desired_module_count,
                expected_duration_minutes=payload.expected_duration_minutes,
                max_stage_timeout_seconds=payload.max_stage_timeout_seconds,
                model=payload.model or agent_profile.get("model"),
                source_urls=source_urls,
                source_packet_id=payload.source_packet_id,
                source_packet=payload.source_packet,
                input_artifacts=payload.input_artifacts,
            )
            quality_report = assess_agent_generation_result(generated, gate="review")
            if not quality_report["passed"]:
                raise ValueError(
                    "Generated course failed quality gate: "
                    + "; ".join([*quality_report["errors"], *quality_report["warnings"]][:12])
                )
            snapshot = build_course_snapshot_from_agent_result(
                session,
                learner_id=payload.learner_id,
                prompt=payload.prompt,
                language=payload.language,
                level=payload.level,
                source_policy=payload.source_policy,
                generated=generated,
                quality_report=quality_report,
                generation_readiness=readiness,
            )
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


    @app.post("/v1/agent/courses/experiment", response_model=CourseGenerationExperimentRead)
    def experiment_with_llm_course_generation(payload: GenerateCourseRequest) -> dict[str, Any]:
        try:
            taxonomy_errors = validate_generation_taxonomy_input(payload.category, payload.department)
            if taxonomy_errors:
                raise ValueError("; ".join(taxonomy_errors))
            agent_profile = require_verified_active_agent_profile()

            generated = generate_course_with_agent(
                prompt=payload.prompt,
                api_key=str(agent_profile["agent_api_key"]),
                provider_id=str(agent_profile.get("provider_id") or "openai"),
                level=payload.level,
                language=payload.language,
                source_policy=payload.source_policy,
                category=payload.category,
                department=payload.department,
                desired_module_count=payload.desired_module_count,
                expected_duration_minutes=payload.expected_duration_minutes,
                max_stage_timeout_seconds=payload.max_stage_timeout_seconds,
                model=payload.model or agent_profile.get("model"),
                source_urls=generation_source_urls(payload),
                source_packet_id=payload.source_packet_id,
                source_packet=payload.source_packet,
                input_artifacts=payload.input_artifacts,
                enforce_contract=False,
            )
            quality_report = assess_course_quality(generated.course, gate="generation")
            return {
                "accepted": quality_report["passed"],
                "course": generated.course,
                "quality_report": quality_report,
                "trace": {**generated.trace, "quality_report": quality_report},
            }
        except CourseAgentError as exc:
            return failed_experiment_response(payload, exc)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


    @app.post("/v1/agent/courses/experiment/staged", response_model=CourseGenerationExperimentRead)
    def experiment_with_staged_llm_course_generation(payload: GenerateCourseRequest) -> dict[str, Any]:
        try:
            taxonomy_errors = validate_generation_taxonomy_input(payload.category, payload.department)
            if taxonomy_errors:
                raise ValueError("; ".join(taxonomy_errors))
            agent_profile = require_verified_active_agent_profile()

            generated = generate_course_with_agent_staged(
                prompt=payload.prompt,
                api_key=str(agent_profile["agent_api_key"]),
                provider_id=str(agent_profile.get("provider_id") or "openai"),
                level=payload.level,
                language=payload.language,
                source_policy=payload.source_policy,
                category=payload.category,
                department=payload.department,
                desired_module_count=payload.desired_module_count,
                expected_duration_minutes=payload.expected_duration_minutes,
                model=payload.model or agent_profile.get("model"),
                source_urls=generation_source_urls(payload),
                source_packet_id=payload.source_packet_id,
                source_packet=payload.source_packet,
                input_artifacts=payload.input_artifacts,
                enforce_contract=False,
            )
            quality_report = assess_course_quality(generated.course, gate="generation")
            return {
                "accepted": quality_report["passed"],
                "course": generated.course,
                "quality_report": quality_report,
                "trace": {**generated.trace, "quality_report": quality_report},
            }
        except CourseAgentError as exc:
            return failed_experiment_response(payload, exc)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


    @app.post("/v1/agent/courses/jobs", response_model=CourseGenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
    def create_agent_course_generation_job(
        payload: GenerateCourseRequest,
        background_tasks: BackgroundTasks,
        session: Session = Depends(get_session),
    ) -> dict[str, Any]:
        try:
            taxonomy_errors = validate_generation_taxonomy_input(payload.category, payload.department)
            if taxonomy_errors:
                raise ValueError("; ".join(taxonomy_errors))
            source_urls = generation_source_urls(payload)
            readiness = generation_readiness_for_request(payload, source_urls)
            agent_profile = get_active_agent_profile()
            if agent_profile is not None:
                agent_profile = require_verified_active_agent_profile()
            if not bool(readiness["ready"]):
                job = enqueue_job(
                    session,
                    job_type="agent_generate_course_staged",
                    payload=job_payload_from_course_request(
                        payload,
                        source_urls,
                        model=payload.model or (agent_profile or {}).get("model"),
                        generation_readiness=readiness,
                    ),
                )
                snapshot = create_needs_sources_course_snapshot(
                    session,
                    prompt=payload.prompt,
                    learner_id=payload.learner_id,
                    level=payload.level,
                    language=payload.language,
                    source_policy=payload.source_policy,
                    desired_module_count=payload.desired_module_count,
                    expected_duration_minutes=payload.expected_duration_minutes,
                    source_urls=source_urls,
                    source_packet=payload.source_packet,
                    source_gate=readiness.get("sourceGate"),
                    generation_readiness=readiness,
                    category=payload.category,
                    department=payload.department,
                )
                save_course_snapshot(snapshot)
                source_gap_job_result(session, job, snapshot)
                session.commit()
                session.refresh(job)
                return course_generation_job_response(job)
            agent_profile = agent_profile or require_verified_active_agent_profile()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        job = enqueue_job(
            session,
            job_type="agent_generate_course_staged",
            payload=job_payload_from_course_request(
                payload,
                source_urls,
                model=payload.model or agent_profile.get("model"),
                generation_readiness=readiness,
            ),
        )
        session.commit()
        session.refresh(job)
        background_tasks.add_task(run_agent_course_generation_job, job.id)
        return course_generation_job_response(job)


    @app.get("/v1/agent/courses/jobs/{job_id}", response_model=CourseGenerationJobRead)
    def get_agent_course_generation_job(job_id: int, session: Session = Depends(get_session)) -> dict[str, Any]:
        job = session.get(Job, job_id)
        if job is None or job.job_type != "agent_generate_course_staged":
            raise HTTPException(status_code=404, detail="Course generation job not found.")
        return course_generation_job_response(job)
