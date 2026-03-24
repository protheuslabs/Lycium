from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class LearnerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    goal: str | None = None
    level: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)


class LearnerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    goal: str | None = None
    level: str | None = None
    preferences: dict[str, Any] | None = None


class LearnerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    goal: str | None
    level: str | None
    preferences: dict[str, Any]
    created_at: datetime


class IngestSourceRequest(BaseModel):
    url: HttpUrl
    source_type: str = "web"
    license: str = "unknown"
    is_free: bool = True
    author: str | None = None
    publisher: str | None = None
    archive_requested: bool = False


class IngestSourceResponse(BaseModel):
    source_id: int
    snapshot_id: int
    new_snapshot: bool
    knowledge_objects_created: int
    topic: str


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    canonical_url: str
    normalized_domain: str
    title: str | None
    source_type: str
    license: str
    is_free: bool
    trust_baseline: float
    archive_links: list[str]
    last_verified_at: datetime


class KnowledgeObjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_id: int
    title: str
    object_type: str
    modality: str
    topic: str
    difficulty: str
    estimated_minutes: int
    trust_score: float
    freshness_score: float
    pedagogy_score: float
    accessibility_score: float
    corroboration_score: float
    content: str
    object_metadata: dict[str, Any]


class KnowledgeSearchResponse(BaseModel):
    query: str
    returned: int
    objects: list[KnowledgeObjectRead]


class CoverageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    topic: str
    object_count: int
    modality_count: int
    average_trust: float
    average_freshness: float
    trust_distribution: dict[str, Any]
    freshness_distribution: dict[str, Any]
    known_gaps: list[str]
    updated_at: datetime


class LearningPacketRequest(BaseModel):
    query: str
    top_k: int = Field(default=20, ge=1, le=100)
    free_only: bool = False
    trust_min: float = Field(default=0.0, ge=0.0, le=1.0)
    modality: str | None = None
    topic: str | None = None
    level: Literal["beginner", "intermediate", "advanced"] | None = None


class LearningPacket(BaseModel):
    query: str
    object_ids: list[int]
    rationale: str
    modality_mix: dict[str, int]
    trust_floor_applied: float


class OutlineSection(BaseModel):
    id: str
    title: str
    learning_objectives: list[str] = Field(default_factory=list)
    concept_keywords: list[str] = Field(default_factory=list)
    estimated_minutes: int = 20


class OutlineModule(BaseModel):
    id: str
    title: str
    learning_objectives: list[str] = Field(default_factory=list)
    sections: list[OutlineSection] = Field(default_factory=list)


class GenerateOutlineRequest(BaseModel):
    prompt: str = Field(min_length=5)
    learner_id: int | None = None
    target_audience: str | None = None
    learning_goals: list[str] = Field(default_factory=list)
    level: Literal["beginner", "intermediate", "advanced"] | None = None
    expected_duration_minutes: int = Field(default=180, ge=30, le=4000)
    language: str = "en"
    teaching_style: str | None = None
    prerequisite_knowledge: list[str] = Field(default_factory=list)
    desired_module_count: int = Field(default=3, ge=1, le=20)
    assessment_style: str | None = None
    source_policy: Literal["balanced", "high-trust", "free-only"] = "balanced"
    free_only: bool = False
    trust_min: float = Field(default=0.0, ge=0.0, le=1.0)


class CourseDraftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int | None
    title: str
    prompt: str
    target_audience: str | None
    learning_goals: list[str]
    difficulty: str | None
    expected_duration_minutes: int
    language: str
    constraints: dict[str, Any]
    outline: dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime


class UpdateOutlineRequest(BaseModel):
    title: str | None = None
    outline: dict[str, Any]


class ApproveOutlineRequest(BaseModel):
    approve: bool = True


class GenerateCourseRequest(BaseModel):
    prompt: str = Field(min_length=5)
    learner_id: int | None = None
    level: Literal["beginner", "intermediate", "advanced"] | None = None
    language: str = "en"
    source_policy: Literal["balanced", "high-trust", "free-only"] = "balanced"
    free_only: bool = False
    trust_min: float = Field(default=0.0, ge=0.0, le=1.0)
    desired_module_count: int = Field(default=3, ge=1, le=20)
    expected_duration_minutes: int = Field(default=180, ge=30, le=4000)


class GenerateCourseFromOutlineRequest(BaseModel):
    learner_id: int | None = None
    source_policy: Literal["balanced", "high-trust", "free-only"] = "balanced"
    free_only: bool = False
    trust_min: float = Field(default=0.0, ge=0.0, le=1.0)


class CourseSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int | None
    draft_id: int | None
    title: str
    prompt: str
    language: str
    level: str | None
    source_policy: str
    status: str
    version: int
    structure: dict[str, Any]
    generation_trace: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class RegenerateSectionRequest(BaseModel):
    module_id: str
    section_id: str
    learner_id: int | None = None
    free_only: bool = False
    trust_min: float = Field(default=0.0, ge=0.0, le=1.0)
    source_policy: Literal["balanced", "high-trust", "free-only"] = "balanced"


class AskInstructorRequest(BaseModel):
    section_id: str
    question: str = Field(min_length=2)
    response_mode: Literal["concise", "deep", "example"] = "concise"
    learner_id: int | None = None


class AskInstructorResponse(BaseModel):
    section_id: str
    answer: str
    citations: list[dict[str, Any]]
    mode: str


class ProgressUpdateRequest(BaseModel):
    learner_id: int
    section_id: str
    completion_state: Literal["not_started", "in_progress", "completed", "mastered"] = "in_progress"
    mastery_score: float = Field(default=0.0, ge=0.0, le=1.0)
    event_type: str | None = None
    event_payload: dict[str, Any] = Field(default_factory=dict)


class ProgressRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    learner_id: int
    course_snapshot_id: int
    section_id: str
    completion_state: str
    mastery_score: float
    attempts: int
    last_interacted_at: datetime
    updated_at: datetime


class AnalyticsSummaryRead(BaseModel):
    course_snapshot_id: int
    completion_rate: float
    average_mastery: float
    quiz_accuracy: float
    most_questioned_sections: list[dict[str, Any]]
    event_counts: dict[str, int]


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
