from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ProjectSubmissionGradeRequest(BaseModel):
    learner_id: int | None = None
    course_snapshot_id: int | None = None
    courseTitle: str | None = None
    sectionId: str | None = None
    sectionTitle: str | None = None
    projectBlock: dict[str, Any] = Field(default_factory=dict)
    submission: dict[str, Any] = Field(default_factory=dict)
    sourceRecords: list[dict[str, Any]] = Field(default_factory=list)
    learnerProgress: dict[str, Any] = Field(default_factory=dict)
    grader: Literal["agent", "admin", "human"] | str = "agent"


class ProjectCriterionGradeRead(BaseModel):
    criterionId: str
    title: str
    score: float
    maxScore: float
    level: str
    feedback: str
    evidence: dict[str, Any] = Field(default_factory=dict)


class ProjectSubmissionGradeRead(BaseModel):
    contractVersion: str
    workflowVersion: str
    status: str
    grader: str
    gradedAt: str
    score: float
    maxScore: float
    scorePercentage: float
    passed: bool
    summary: str
    criterionResults: list[ProjectCriterionGradeRead]
    feedback: str
    nextSteps: list[str] = Field(default_factory=list)
    errors: list[dict[str, Any]] = Field(default_factory=list)
    boundedContext: dict[str, Any] = Field(default_factory=dict)
    trace: dict[str, Any] = Field(default_factory=dict)
