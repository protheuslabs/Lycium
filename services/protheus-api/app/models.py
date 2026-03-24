from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(UTC)


class Learner(Base):
    __tablename__ = "learners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    goal: Mapped[str | None] = mapped_column(Text)
    level: Mapped[str | None] = mapped_column(String(50))
    preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    courses: Mapped[list["CourseSnapshot"]] = relationship(back_populates="learner")
    drafts: Mapped[list["CourseDraft"]] = relationship(back_populates="learner")
    section_progress: Mapped[list["LearnerSectionProgress"]] = relationship(back_populates="learner")
    events: Mapped[list["LearningEvent"]] = relationship(back_populates="learner")
    portfolio_items: Mapped[list["PortfolioArtifact"]] = relationship(back_populates="learner")
    credentials: Mapped[list["CredentialRecord"]] = relationship(back_populates="learner")
    programs: Mapped[list["ProgramSnapshot"]] = relationship(back_populates="learner")


class CourseDraft(Base):
    __tablename__ = "course_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    learner_id: Mapped[int | None] = mapped_column(ForeignKey("learners.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    prompt: Mapped[str] = mapped_column(Text)
    target_audience: Mapped[str | None] = mapped_column(String(255))
    learning_goals: Mapped[list[str]] = mapped_column(JSON, default=list)
    difficulty: Mapped[str | None] = mapped_column(String(50))
    expected_duration_minutes: Mapped[int] = mapped_column(Integer, default=180)
    language: Mapped[str] = mapped_column(String(30), default="en")
    constraints: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    outline: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    learner: Mapped["Learner | None"] = relationship(back_populates="drafts")
    snapshots: Mapped[list["CourseSnapshot"]] = relationship(back_populates="draft")


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    canonical_url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False, index=True)
    normalized_domain: Mapped[str] = mapped_column(String(255), index=True)
    title: Mapped[str | None] = mapped_column(String(512))
    author: Mapped[str | None] = mapped_column(String(255))
    publisher: Mapped[str | None] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(50), default="web")
    license: Mapped[str] = mapped_column(String(80), default="unknown")
    is_free: Mapped[bool] = mapped_column(Boolean, default=True)
    trust_baseline: Mapped[float] = mapped_column(Float, default=0.4)
    link_health: Mapped[str] = mapped_column(String(30), default="healthy")
    archive_links: Mapped[list[str]] = mapped_column(JSON, default=list)
    last_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    snapshots: Mapped[list[Snapshot]] = relationship(back_populates="source", cascade="all, delete-orphan")
    knowledge_objects: Mapped[list[KnowledgeObject]] = relationship(back_populates="source", cascade="all, delete-orphan")


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), index=True)
    content_hash: Mapped[str] = mapped_column(String(128), index=True)
    extraction_status: Mapped[str] = mapped_column(String(30), default="processed")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    cleaned_text: Mapped[str] = mapped_column(Text, default="")
    artifact_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    source: Mapped[Source] = relationship(back_populates="snapshots")
    knowledge_objects: Mapped[list["KnowledgeObject"]] = relationship(back_populates="snapshot")


class KnowledgeObject(Base):
    __tablename__ = "knowledge_objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id"), index=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("snapshots.id"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    object_type: Mapped[str] = mapped_column(String(80), index=True)
    modality: Mapped[str] = mapped_column(String(80), index=True)
    topic: Mapped[str] = mapped_column(String(255), index=True)
    difficulty: Mapped[str] = mapped_column(String(50), default="intermediate")
    audience: Mapped[str | None] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(30), default="en")
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=8)
    content: Mapped[str] = mapped_column(Text)
    prerequisites: Mapped[list[str]] = mapped_column(JSON, default=list)
    learning_outcomes: Mapped[list[str]] = mapped_column(JSON, default=list)
    trust_score: Mapped[float] = mapped_column(Float, default=0.5)
    freshness_score: Mapped[float] = mapped_column(Float, default=0.5)
    pedagogy_score: Mapped[float] = mapped_column(Float, default=0.5)
    accessibility_score: Mapped[float] = mapped_column(Float, default=0.5)
    corroboration_score: Mapped[float] = mapped_column(Float, default=0.5)
    object_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    source: Mapped[Source] = relationship(back_populates="knowledge_objects")
    snapshot: Mapped[Snapshot] = relationship(back_populates="knowledge_objects")
    claims: Mapped[list["Claim"]] = relationship(back_populates="knowledge_object", cascade="all, delete-orphan")


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    knowledge_object_id: Mapped[int] = mapped_column(ForeignKey("knowledge_objects.id"), index=True)
    claim_text: Mapped[str] = mapped_column(Text)
    claim_type: Mapped[str] = mapped_column(String(40), default="statement")
    confidence_score: Mapped[float] = mapped_column(Float, default=0.5)
    supporting_objects: Mapped[list[int]] = mapped_column(JSON, default=list)
    conflicting_objects: Mapped[list[int]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    knowledge_object: Mapped[KnowledgeObject] = relationship(back_populates="claims")


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_object_id: Mapped[int] = mapped_column(ForeignKey("knowledge_objects.id"), index=True)
    to_object_id: Mapped[int] = mapped_column(ForeignKey("knowledge_objects.id"), index=True)
    edge_type: Mapped[str] = mapped_column(String(60), index=True)
    weight: Mapped[float] = mapped_column(Float, default=0.5)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CoverageMap(Base):
    __tablename__ = "coverage_maps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    object_count: Mapped[int] = mapped_column(Integer, default=0)
    modality_count: Mapped[int] = mapped_column(Integer, default=0)
    average_trust: Mapped[float] = mapped_column(Float, default=0.0)
    average_freshness: Mapped[float] = mapped_column(Float, default=0.0)
    trust_distribution: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    freshness_distribution: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    known_gaps: Mapped[list[str]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CourseSnapshot(Base):
    __tablename__ = "course_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    learner_id: Mapped[int | None] = mapped_column(ForeignKey("learners.id"), index=True)
    draft_id: Mapped[int | None] = mapped_column(ForeignKey("course_drafts.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    prompt: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(30), default="en")
    level: Mapped[str | None] = mapped_column(String(50))
    source_policy: Mapped[str] = mapped_column(String(80), default="balanced")
    status: Mapped[str] = mapped_column(String(30), default="generated")
    version: Mapped[int] = mapped_column(Integer, default=1)
    structure: Mapped[dict[str, Any]] = mapped_column(JSON)
    generation_trace: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    learner: Mapped["Learner | None"] = relationship(back_populates="courses")
    draft: Mapped["CourseDraft | None"] = relationship(back_populates="snapshots")
    section_progress: Mapped[list["LearnerSectionProgress"]] = relationship(back_populates="course_snapshot")
    events: Mapped[list["LearningEvent"]] = relationship(back_populates="course_snapshot")
    portfolio_items: Mapped[list["PortfolioArtifact"]] = relationship(back_populates="course_snapshot")


class LearnerSectionProgress(Base):
    __tablename__ = "learner_section_progress"
    __table_args__ = (
        UniqueConstraint("learner_id", "course_snapshot_id", "section_id", name="ux_progress_learner_course_section"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    learner_id: Mapped[int] = mapped_column(ForeignKey("learners.id"), index=True)
    course_snapshot_id: Mapped[int] = mapped_column(ForeignKey("course_snapshots.id"), index=True)
    section_id: Mapped[str] = mapped_column(String(120), index=True)
    completion_state: Mapped[str] = mapped_column(String(30), default="not_started")
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_interacted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    learner: Mapped["Learner"] = relationship(back_populates="section_progress")
    course_snapshot: Mapped["CourseSnapshot"] = relationship(back_populates="section_progress")


class LearningEvent(Base):
    __tablename__ = "learning_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    learner_id: Mapped[int | None] = mapped_column(ForeignKey("learners.id"), index=True)
    course_snapshot_id: Mapped[int | None] = mapped_column(ForeignKey("course_snapshots.id"), index=True)
    section_id: Mapped[str | None] = mapped_column(String(120), index=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    learner: Mapped["Learner | None"] = relationship(back_populates="events")
    course_snapshot: Mapped["CourseSnapshot | None"] = relationship(back_populates="events")


class PortfolioArtifact(Base):
    __tablename__ = "portfolio_artifacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    learner_id: Mapped[int] = mapped_column(ForeignKey("learners.id"), index=True)
    course_snapshot_id: Mapped[int | None] = mapped_column(ForeignKey("course_snapshots.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    artifact_type: Mapped[str] = mapped_column(String(80), default="project")
    url: Mapped[str | None] = mapped_column(String(2048))
    artifact_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    learner: Mapped["Learner"] = relationship(back_populates="portfolio_items")
    course_snapshot: Mapped["CourseSnapshot | None"] = relationship(back_populates="portfolio_items")


class CredentialRecord(Base):
    __tablename__ = "credential_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    learner_id: Mapped[int] = mapped_column(ForeignKey("learners.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40), default="badge")
    title: Mapped[str] = mapped_column(String(255))
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    learner: Mapped["Learner"] = relationship(back_populates="credentials")


class ProgramSnapshot(Base):
    __tablename__ = "program_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    learner_id: Mapped[int | None] = mapped_column(ForeignKey("learners.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    goal: Mapped[str] = mapped_column(Text)
    level: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30), default="generated")
    structure: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    learner: Mapped["Learner | None"] = relationship(back_populates="programs")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_type: Mapped[str] = mapped_column(String(80), index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    result: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
