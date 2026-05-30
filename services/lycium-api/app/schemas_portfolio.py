
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class PortfolioArtifactCreate(BaseModel):
    learner_id: int
    course_snapshot_id: int | None = None
    title: str = Field(min_length=2)
    artifact_type: str = "project"
    url: str | None = None
    artifact_metadata: dict[str, Any] = Field(default_factory=dict)


class PortfolioArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int
    course_snapshot_id: int | None
    title: str
    artifact_type: str
    url: str | None
    artifact_metadata: dict[str, Any]
    created_at: datetime


class CredentialCreate(BaseModel):
    learner_id: int
    kind: Literal["badge", "certificate", "transcript", "skill"] = "badge"
    title: str = Field(min_length=2)
    evidence: dict[str, Any] = Field(default_factory=dict)


class CredentialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int
    kind: str
    title: str
    evidence: dict[str, Any]
    issued_at: datetime


class ProgramGenerateRequest(BaseModel):
    goal: str = Field(min_length=5)
    learner_id: int | None = None
    level: Literal["beginner", "intermediate", "advanced"] | None = None
    free_only: bool = False
    source_policy: Literal["balanced", "high-trust", "free-only"] = "balanced"
    trust_min: float = Field(default=0.0, ge=0.0, le=1.0)
    desired_course_count: int = Field(default=4, ge=1, le=30)
    source_urls: list[HttpUrl] = Field(default_factory=list)


class ProgramSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int | None
    title: str
    goal: str
    level: str | None
    status: str
    structure: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class JobCreate(BaseModel):
    job_type: Literal["ingest_source", "recompute_coverage", "generate_course", "revalidate_source"]
    payload: dict[str, Any] = Field(default_factory=dict)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_type: str
    status: str
    payload: dict[str, Any]
    result: dict[str, Any]
    error: str | None
    attempts: int
    created_at: datetime
    updated_at: datetime
