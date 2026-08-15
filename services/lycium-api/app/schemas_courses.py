
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
    max_stage_timeout_seconds: float | None = Field(default=None, ge=5.0, le=600.0)
    source_urls: list[HttpUrl] = Field(default_factory=list)
    source_packet_id: int | str | None = None
    source_packet: dict[str, Any] | None = None
    input_artifacts: list[dict[str, Any]] = Field(default_factory=list)


class FileInputReadRequest(BaseModel):
    files: list[dict[str, Any]] = Field(default_factory=list)


class FileInputReadResponse(BaseModel):
    contractVersion: str
    provider: str
    replaceableBy: str | None = None
    artifactCount: int
    extractedArtifactCount: int
    artifacts: list[dict[str, Any]] = Field(default_factory=list)


class CourseSourceGapResumeRequest(BaseModel):
    source_urls: list[HttpUrl] = Field(default_factory=list)
    model: str | None = None
    source_packet_id: int | str | None = None
    source_packet: dict[str, Any] | None = None
    input_artifacts: list[dict[str, Any]] = Field(default_factory=list)


class ActiveCourseGenerationBatchRequest(BaseModel):
    batch_index: int | None = Field(default=None, ge=1)
    module_count: int = Field(default=2, ge=1, le=4)
    source_packet: dict[str, Any] | None = None


class ActiveCourseContentFillRequest(BaseModel):
    scope: Literal["course", "module", "section"] = "course"
    module_id: str | None = None
    section_id: str | None = None
    max_sections: int | None = Field(default=None, ge=1, le=100)
    retry_filled: bool = False
    include_module_artifacts: bool = True


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


class CourseGenerationReadinessSourceEvidenceRead(BaseModel):
    sourceUrlCount: int | None = None
    usableInputArtifactCount: int | None = None
    submittedEvidenceCount: int | None = None
    minimumCourseSources: int | None = None
    minimumSourceStrengthScore: int | None = None
    model_config = ConfigDict(extra="allow")


class CourseGenerationReadinessConceptCoverageRead(BaseModel):
    status: str | None = None
    coverageRatio: float | None = None
    minimumCoverageRatio: float | None = None
    requiredConceptCount: int | None = None
    coveredConceptCount: int | None = None
    uncoveredConcepts: list[str] = Field(default_factory=list)
    coverageRows: list[dict[str, Any]] = Field(default_factory=list)
    model_config = ConfigDict(extra="allow")


class CourseGenerationReadinessIssueRead(BaseModel):
    code: str | None = None
    message: str
    model_config = ConfigDict(extra="allow")


class CourseGenerationReadinessRead(BaseModel):
    contractVersion: str | None = None
    status: str | None = None
    ready: bool | None = None
    sourceEvidence: CourseGenerationReadinessSourceEvidenceRead | None = None
    conceptCoverage: CourseGenerationReadinessConceptCoverageRead | None = None
    sourceStrength: dict[str, Any] | None = None
    sourceGate: dict[str, Any] | None = None
    issues: list[CourseGenerationReadinessIssueRead] = Field(default_factory=list)
    model_config = ConfigDict(extra="allow")


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
    workflow_status: dict[str, Any] | None = None
    working_title: str | None = None
    course: dict[str, Any] | None = None
    quality_report: CourseQualityReportRead | None = None
    generation_readiness: CourseGenerationReadinessRead | None = None
    trace: dict[str, Any] = Field(default_factory=dict)
    course_snapshot: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime


class GenerationRunEventRead(BaseModel):
    id: int
    generation_run_id: int
    event_type: str
    stage: str | None = None
    status: str | None = None
    message: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class GenerationRunRead(BaseModel):
    id: int
    job_id: int | None = None
    course_snapshot_id: int | None = None
    run_type: str
    status: Literal["running", "completed", "failed"]
    prompt: str
    provider_id: str | None = None
    model: str | None = None
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    current_stage: str | None = None
    message: str | None = None
    request_payload: dict[str, Any] = Field(default_factory=dict)
    result_summary: dict[str, Any] = Field(default_factory=dict)
    trace: dict[str, Any] = Field(default_factory=dict)
    events: list[GenerationRunEventRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class CurriculumArtifactsRead(BaseModel):
    course_snapshot_id: int
    artifactReferences: dict[str, list[int]]
    curriculumBenchmarks: list[dict[str, Any]] = Field(default_factory=list)
    requirementOrigins: list[dict[str, Any]] = Field(default_factory=list)
    sourceSlots: list[dict[str, Any]] = Field(default_factory=list)


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
    model: str | None = None
    feedback: str | None = None
    positive_feedback: list[str] = Field(default_factory=list)
    negative_feedback: list[str] = Field(default_factory=list)
    new_source_urls: list[HttpUrl] = Field(default_factory=list)
    bad_source_ids: list[str] = Field(default_factory=list)
    fork_if_read_only: bool = False


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
