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
    detect_local_agent_endpoint,
    generate_course_with_agent,
    get_agent_provider,
    list_agent_provider_summaries,
    looks_like_local_agent_endpoint,
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
    create_local_data_backup,
    delete_agent_api_key,
    ensure_local_data_dirs,
    export_local_data,
    get_active_agent_profile,
    get_agent_profile_by_id,
    local_data_migration_status,
    local_data_security_status,
    local_data_storage_status,
    local_settings_summary,
    read_course_bookmark,
    read_course_feedback,
    read_course_health,
    read_completion,
    save_agent_api_key,
    save_course_bookmark,
    save_course_feedback,
    save_completion,
    save_course_snapshot,
    save_learner_record,
    update_agent_key_verification,
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
    LocalAgentKeyVerifyUpdate,
    LocalAiProviderRead,
    LocalDataBackupRead,
    LocalDataExportRead,
    LocalDataMigrationStatusRead,
    LocalDataStorageStatusRead,
    LocalCourseBookmarkRead,
    LocalCourseBookmarkUpdate,
    LocalCourseFeedbackRead,
    LocalCourseFeedbackUpdate,
    LocalCourseHealthRead,
    LocalCompletionRead,
    LocalCompletionUpdate,
    LocalSettingsRead,
    LocalSettingsUpdate,
    LocalSecurityStatusRead,
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


    @app.get("/v1/local/migrations", response_model=LocalDataMigrationStatusRead)
    def get_local_data_migrations() -> dict[str, Any]:
        ensure_local_data_dirs()
        return local_data_migration_status()


    @app.get("/v1/local/security", response_model=LocalSecurityStatusRead)
    def get_local_security_status() -> dict[str, Any]:
        ensure_local_data_dirs()
        return local_data_security_status()


    @app.get("/v1/local/storage", response_model=LocalDataStorageStatusRead)
    def get_local_storage_status() -> dict[str, Any]:
        return local_data_storage_status()


    @app.get("/v1/local/export", response_model=LocalDataExportRead)
    def get_local_data_export(include_secrets: bool = Query(default=False)) -> dict[str, Any]:
        return export_local_data(include_secrets=include_secrets)


    @app.post("/v1/local/backups", response_model=LocalDataBackupRead)
    def create_local_backup(include_secrets: bool = Query(default=False)) -> dict[str, Any]:
        return create_local_data_backup(include_secrets=include_secrets)


    @app.get("/v1/local/ai/providers", response_model=list[LocalAiProviderRead])
    def get_local_ai_providers() -> list[dict[str, Any]]:
        return list_agent_provider_summaries(discover_models=True)


    @app.put("/v1/local/settings", response_model=LocalSettingsRead)
    def update_local_settings(payload: LocalSettingsUpdate) -> dict[str, Any]:
        try:
            provider_id = payload.provider_id
            requested_provider = get_agent_provider(provider_id)
            if (
                provider_id != "local-model"
                and not bool(requested_provider.get("localProvider"))
                and looks_like_local_agent_endpoint(payload.agent_api_key)
            ):
                provider_id = "local-model"
                provider = get_agent_provider(provider_id)
            else:
                provider = requested_provider
            adapter = str(provider.get("generationAdapter") or "")
            is_local_provider = adapter in {"ollama-chat", "local-agent-runtime"} or bool(provider.get("localProvider"))
            connection_status = "verified"
            connection_message = None
            try:
                models = validate_agent_api_key(payload.agent_api_key, provider_id=provider_id)
            except CourseAgentError as exc:
                if not is_local_provider:
                    raise
                detected = detect_local_agent_endpoint(provider_id) if adapter == "ollama-chat" else None
                if detected:
                    payload.agent_api_key, models = detected
                    connection_message = f"Auto-detected local model endpoint at {payload.agent_api_key}."
                else:
                    models = [
                        {"id": str(model.get("id") or model.get("name") or ""), "label": str(model.get("label") or model.get("id") or model.get("name") or "")}
                        for model in provider.get("staticModels", [])
                        if isinstance(model, dict) and str(model.get("id") or model.get("name") or "").strip()
                    ]
                    connection_status = "unverified"
                    connection_message = str(exc)
            default_model = str(provider.get("defaultModel") or "")
            if is_local_provider:
                selected_model = models[0]["id"] if models else default_model or None
                if selected_model and not any(model.get("id") == selected_model for model in models):
                    models.insert(0, {"id": selected_model, "label": selected_model})
            else:
                selected_model = (
                    default_model
                    if default_model and any(model.get("id") == default_model for model in models)
                    else (models[0]["id"] if models else default_model or None)
                )
            return save_agent_api_key(
                provider_id=provider_id,
                provider_label=str(provider.get("label") or provider_id),
                api_key=payload.agent_api_key,
                models=models,
                model=selected_model,
                connection_status=connection_status,
                connection_message=connection_message,
            )
        except CourseAgentError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


    @app.put("/v1/local/settings/verify-key", response_model=LocalSettingsRead)
    def verify_local_agent_key(payload: LocalAgentKeyVerifyUpdate) -> dict[str, Any]:
        profile = get_agent_profile_by_id(payload.key_id)
        if not profile:
            raise HTTPException(status_code=404, detail="API key not found.")
        try:
            provider = get_agent_provider(str(profile.get("provider_id") or ""))
            models = validate_agent_api_key(
                str(profile.get("agent_api_key") or ""),
                provider_id=str(profile.get("provider_id") or ""),
                model=str(profile.get("model") or "") or None,
            )
            current_model = str(profile.get("model") or "").strip()
            available_model_ids = {str(model.get("id") or "") for model in models}
            default_model = str(provider.get("defaultModel") or "").strip()
            selected_model = (
                current_model
                if current_model and current_model in available_model_ids
                else (models[0]["id"] if models else current_model or default_model)
            )
            return update_agent_key_verification(
                payload.key_id,
                models=models,
                model=selected_model or None,
                connection_status="verified",
                connection_message="Connection verified.",
            )
        except CourseAgentError as exc:
            is_local_provider = str(provider.get("generationAdapter") or "") in {"ollama-chat", "local-agent-runtime"} or bool(provider.get("localProvider"))
            update_agent_key_verification(
                payload.key_id,
                models=profile.get("models", []),
                model=str(profile.get("model") or "") or None,
                connection_status="unverified",
                connection_message=str(exc),
            )
            if is_local_provider:
                return local_settings_summary()
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


    @app.put("/v1/local/settings/active-key", response_model=LocalSettingsRead)
    def update_active_local_agent_key(payload: LocalActiveAgentKeyUpdate) -> dict[str, Any]:
        try:
            return activate_agent_api_key(payload.key_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc


    @app.delete("/v1/local/settings/key/{key_id}", response_model=LocalSettingsRead)
    def delete_local_agent_key(key_id: str) -> dict[str, Any]:
        try:
            return delete_agent_api_key(key_id)
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


    @app.get("/v1/local/course-feedback/{course_key}", response_model=LocalCourseFeedbackRead)
    def get_local_course_feedback(course_key: str) -> dict[str, Any]:
        return read_course_feedback(course_key)


    @app.post("/v1/local/course-feedback", response_model=LocalCourseFeedbackRead)
    def update_local_course_feedback(payload: LocalCourseFeedbackUpdate) -> dict[str, Any]:
        fields_set = getattr(payload, "model_fields_set", getattr(payload, "__fields_set__", set()))
        feedback_update = {
            "course_key": payload.course_key,
            "course_title": payload.course_title,
            "feedback_text": payload.feedback_text,
            "feedback_magnitude": payload.feedback_magnitude,
            "source_url": payload.source_url,
            "source_description": payload.source_description,
        }
        if "rating" in fields_set:
            feedback_update["rating"] = payload.rating
        return save_course_feedback(**feedback_update)


    @app.get("/v1/local/course-health/{course_key}", response_model=LocalCourseHealthRead)
    def get_local_course_health(course_key: str) -> dict[str, Any]:
        return read_course_health(course_key)
