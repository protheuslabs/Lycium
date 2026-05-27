
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


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
    level: Literal["elementary", "highschool", "undergrad", "postgrad"] | None = None
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
    level: Literal["elementary", "highschool", "undergrad", "postgrad"] | None = None
    language: str = "en"
    model: str | None = None
    source_policy: Literal["balanced", "high-trust", "free-only"] = "balanced"
    free_only: bool = False
    trust_min: float = Field(default=0.0, ge=0.0, le=1.0)
    category: str | None = None
    department: str | None = None
    desired_module_count: int = Field(default=3, ge=1, le=20)
    expected_duration_minutes: int = Field(default=180, ge=30, le=4000)
    source_urls: list[HttpUrl] = Field(default_factory=list)


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


class CourseQualityReportRead(BaseModel):
    gate: Literal["generation", "review", "publish"]
    passed: bool
    score: float = Field(ge=0.0, le=1.0)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    metrics: dict[str, float | int] = Field(default_factory=dict)
    evals: dict[str, Any] | None = None
    workflow: dict[str, Any] | None = None
    checkedAt: str
    contractVersion: str | None = None


class CourseGenerationExperimentRead(BaseModel):
    accepted: bool
    course: dict[str, Any]
    quality_report: CourseQualityReportRead
    trace: dict[str, Any]


class CourseGenerationJobRead(BaseModel):
    id: int
    status: Literal["queued", "running", "ready", "failed"]
    request: dict[str, Any] = Field(default_factory=dict)
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    current_stage: str | None = None
    message: str | None = None
    course: dict[str, Any] | None = None
    quality_report: CourseQualityReportRead | None = None
    trace: dict[str, Any] = Field(default_factory=dict)
    course_snapshot: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class CoursePublishRequest(BaseModel):
    reviewer_id: str | None = None
    notes: str | None = None
    force: bool = False


class CourseSectionLockRequest(BaseModel):
    module_id: str | None = None
    section_id: str = Field(min_length=1)
    locked: bool = True


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
