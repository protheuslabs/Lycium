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
    @app.get("/healthz")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}


    @app.get("/v1/system/boundary")
    def system_boundary() -> dict[str, str]:
        return {
            "web": "learner-facing Lycium application",
            "backend": "Lycium knowledge platform services",
        }


    @app.get("/v1/local/settings", response_model=LocalSettingsRead)
    def get_local_settings() -> dict[str, Any]:
        return local_settings_summary()


    @app.get("/v1/local/ai/providers", response_model=list[LocalAiProviderRead])
    def get_local_ai_providers() -> list[dict[str, Any]]:
        return list_agent_provider_summaries()


    @app.put("/v1/local/settings", response_model=LocalSettingsRead)
    def update_local_settings(payload: LocalSettingsUpdate) -> dict[str, Any]:
        try:
            provider = get_agent_provider(payload.provider_id)
            models = validate_agent_api_key(payload.agent_api_key, provider_id=payload.provider_id)
            default_model = str(provider.get("defaultModel") or "")
            selected_model = (
                default_model
                if default_model and any(model.get("id") == default_model for model in models)
                else (models[0]["id"] if models else default_model or None)
            )
            return save_agent_api_key(
                provider_id=payload.provider_id,
                provider_label=str(provider.get("label") or payload.provider_id),
                api_key=payload.agent_api_key,
                models=models,
                model=selected_model,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


    @app.put("/v1/local/settings/active-key", response_model=LocalSettingsRead)
    def update_active_local_agent_key(payload: LocalActiveAgentKeyUpdate) -> dict[str, Any]:
        try:
            return activate_agent_api_key(payload.key_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc


    @app.put("/v1/local/settings/key-model", response_model=LocalSettingsRead)
    def update_local_agent_key_model(payload: LocalAgentKeyModelUpdate) -> dict[str, Any]:
        try:
            return update_agent_key_model(payload.key_id, payload.model)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


    @app.get("/v1/local/completion/{course_key}", response_model=LocalCompletionRead)
    def get_local_completion(course_key: str) -> dict[str, Any]:
        return read_completion(course_key)


    @app.post("/v1/local/completion", response_model=LocalCompletionRead)
    def update_local_completion(payload: LocalCompletionUpdate) -> dict[str, Any]:
        return save_completion(
            course_key=payload.course_key,
            course_title=payload.course_title,
            section_id=payload.section_id,
            completed_section_ids=payload.completed_section_ids,
            section_statuses=payload.section_statuses,
        )


    @app.get("/v1/local/bookmarks/{course_key}", response_model=LocalCourseBookmarkRead)
    def get_local_course_bookmark(course_key: str) -> dict[str, Any]:
        return read_course_bookmark(course_key)


    @app.post("/v1/local/bookmarks", response_model=LocalCourseBookmarkRead)
    def update_local_course_bookmark(payload: LocalCourseBookmarkUpdate) -> dict[str, Any]:
        return save_course_bookmark(
            course_key=payload.course_key,
            course_title=payload.course_title,
            section_id=payload.section_id,
            section_title=payload.section_title,
            path=payload.path,
        )
