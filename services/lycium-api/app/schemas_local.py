
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class LocalAiProviderRead(BaseModel):
    id: str
    label: str
    default_model: str | None = None
    recommended_model: str | None = None
    minimum_recommended_parameters_billion: float | None = None
    model_recommendation_note: str | None = None
    model_fetch_supported: bool = True
    generation_adapter: str
    local_provider: bool = False
    credential_label: str = "api key"
    credential_placeholder: str = "api key"
    credential_default: str = ""
    local_endpoint_candidates: list[str] = Field(default_factory=list)


class LocalAgentModelRead(BaseModel):
    id: str
    label: str | None = None


class LocalAgentKeyRead(BaseModel):
    id: str
    provider_id: str
    provider_label: str
    key_preview: str
    model: str | None = None
    models: list[LocalAgentModelRead] = Field(default_factory=list)
    models_fetched_at: str | None = None
    connection_status: Literal["verified", "unverified"] = "verified"
    connection_message: str | None = None
    last_verified_at: str | None = None
    last_error: str | None = None
    is_active: bool = False


class LocalSettingsRead(BaseModel):
    local_data_dir: str
    has_agent_api_key: bool
    agent_api_key_preview: str | None = None
    active_agent_key_id: str | None = None
    agent_keys: list[LocalAgentKeyRead] = Field(default_factory=list)


class LocalDataMigrationRecordRead(BaseModel):
    id: str
    version: int
    description: str
    applied_at: str | None = None


class LocalDataMigrationStatusRead(BaseModel):
    local_data_dir: str
    schema_version: int
    target_schema_version: int
    pending_migrations: list[dict[str, Any]] = Field(default_factory=list)
    migrations: list[LocalDataMigrationRecordRead] = Field(default_factory=list)
    updated_at: str | None = None


class LocalSecurityStatusRead(BaseModel):
    local_data_dir: str
    secret_backend: Literal["local-file"]
    encryption_at_rest: bool = False
    os_keychain_backed: bool = False
    secrets_file_exists: bool = False
    local_data_dir_mode: str | None = None
    secrets_dir_mode: str | None = None
    secrets_file_mode: str | None = None
    permissions_private: bool
    warnings: list[str] = Field(default_factory=list)


class LocalSettingsUpdate(BaseModel):
    provider_id: str = Field(min_length=1, max_length=120)
    agent_api_key: str = Field(min_length=1, max_length=4096)


class LocalActiveAgentKeyUpdate(BaseModel):
    key_id: str = Field(min_length=1, max_length=160)


class LocalAgentKeyModelUpdate(BaseModel):
    key_id: str = Field(min_length=1, max_length=160)
    model: str = Field(min_length=1, max_length=255)


class LocalAgentKeyVerifyUpdate(BaseModel):
    key_id: str = Field(min_length=1, max_length=160)


class LocalCompletionUpdate(BaseModel):
    course_key: str = Field(min_length=1)
    course_title: str | None = None
    section_id: str | None = None
    completed_section_ids: list[str] = Field(default_factory=list)
    section_statuses: dict[str, Literal["completed", "locked", "seen", "timed"]] = Field(default_factory=dict)


class LocalCompletionRead(BaseModel):
    course_key: str
    course_title: str | None = None
    completed_section_ids: list[str] = Field(default_factory=list)
    section_statuses: dict[str, Literal["completed", "locked", "seen", "timed"]] = Field(default_factory=dict)
    updated_at: str | None = None


class LocalCourseBookmarkUpdate(BaseModel):
    course_key: str = Field(min_length=1)
    course_title: str | None = None
    section_id: str = Field(min_length=1)
    section_title: str | None = None
    path: str = Field(min_length=1)


class LocalCourseBookmarkRead(BaseModel):
    course_key: str
    course_title: str | None = None
    section_id: str | None = None
    section_title: str | None = None
    path: str | None = None
    updated_at: str | None = None


class LocalCourseFeedbackUpdate(BaseModel):
    course_key: str = Field(min_length=1)
    course_title: str | None = None
    rating: Literal["up", "down"] | None = None
    feedback_text: str | None = Field(default=None, max_length=2000)
    feedback_magnitude: int | None = Field(default=None, ge=1, le=3)
    source_url: str | None = Field(default=None, max_length=4096)
    source_description: str | None = Field(default=None, max_length=2000)


class LocalCourseFeedbackRead(BaseModel):
    course_key: str
    course_title: str | None = None
    rating: Literal["up", "down"] | None = None
    rating_events: list[dict[str, Any]] = Field(default_factory=list)
    feedback_notes: list[dict[str, Any]] = Field(default_factory=list)
    source_suggestions: list[dict[str, Any]] = Field(default_factory=list)
    updated_at: str | None = None


class LocalCourseHealthRead(BaseModel):
    course_key: str
    course_title: str | None = None
    status: Literal["unknown", "healthy", "watch", "needs_review"]
    score: int | None = Field(default=None, ge=0, le=100)
    latest_rating: Literal["up", "down"] | None = None
    rating_counts: dict[str, int] = Field(default_factory=dict)
    feedback_note_count: int = 0
    source_suggestion_count: int = 0
    average_feedback_magnitude: float | None = None
    signals: list[str] = Field(default_factory=list)
    updated_at: str | None = None
