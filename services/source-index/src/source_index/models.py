from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(UTC)


class IndexedSource(Base):
    __tablename__ = "indexed_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    canonical_url: Mapped[str] = mapped_column(String(2048), unique=True, nullable=False, index=True)
    normalized_domain: Mapped[str] = mapped_column(String(255), index=True)
    submitted_urls: Mapped[list[str]] = mapped_column(JSON, default=list)
    title: Mapped[str | None] = mapped_column(String(512))
    source_type: Mapped[str] = mapped_column(String(50), default="web", index=True)
    license: Mapped[str] = mapped_column(String(80), default="unknown")
    is_free: Mapped[bool] = mapped_column(Boolean, default=True)
    trust_baseline: Mapped[float] = mapped_column(Float, default=0.4)
    link_health: Mapped[str] = mapped_column(String(30), default="unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    snapshots: Mapped[list["SourceSnapshot"]] = relationship(back_populates="source", cascade="all, delete-orphan")
    decisions: Mapped[list["SourceDecision"]] = relationship(back_populates="source")


class SourceSnapshot(Base):
    __tablename__ = "source_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("indexed_sources.id"), index=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String(30), default="fetched", index=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    content_type: Mapped[str | None] = mapped_column(String(120))
    title: Mapped[str | None] = mapped_column(String(512))
    text_digest: Mapped[str | None] = mapped_column(Text)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    raw_storage_ref: Mapped[str | None] = mapped_column(String(2048))
    snapshot_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    source: Mapped[IndexedSource] = relationship(back_populates="snapshots")


class CrawlPolicyRecord(Base):
    __tablename__ = "crawl_policies"
    __table_args__ = (UniqueConstraint("name", "version", name="ux_crawl_policy_name_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    version: Mapped[str] = mapped_column(String(80), default="v1", index=True)
    description: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    runs: Mapped[list["CrawlRun"]] = relationship(back_populates="policy", cascade="all, delete-orphan")


class CrawlRun(Base):
    __tablename__ = "crawl_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    policy_id: Mapped[int] = mapped_column(ForeignKey("crawl_policies.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="queued", index=True)
    seed_urls: Mapped[list[str]] = mapped_column(JSON, default=list)
    max_pages: Mapped[int] = mapped_column(Integer, default=250)
    pages_queued: Mapped[int] = mapped_column(Integer, default=0)
    pages_fetched: Mapped[int] = mapped_column(Integer, default=0)
    pages_accepted: Mapped[int] = mapped_column(Integer, default=0)
    pages_rejected: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    policy: Mapped[CrawlPolicyRecord] = relationship(back_populates="runs")


class SourceCorpusRun(Base):
    __tablename__ = "source_corpus_runs"
    __table_args__ = (
        UniqueConstraint("consumer", "context_id", "workflow_version", name="ux_source_corpus_consumer_context_version"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    consumer: Mapped[str] = mapped_column(String(80), default="manual", index=True)
    context_id: Mapped[str] = mapped_column(String(180), index=True)
    prompt: Mapped[str] = mapped_column(Text, default="")
    workflow_version: Mapped[str] = mapped_column(String(120), default="source-corpus-preflight-v1")
    submitted_source_count: Mapped[int] = mapped_column(Integer, default=0)
    included_source_count: Mapped[int] = mapped_column(Integer, default=0)
    excluded_source_count: Mapped[int] = mapped_column(Integer, default=0)
    common_themes: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    decisions: Mapped[list["SourceDecision"]] = relationship(
        back_populates="corpus_run",
        cascade="all, delete-orphan",
        order_by="SourceDecision.id",
    )


class SourceDecision(Base):
    __tablename__ = "source_decisions"
    __table_args__ = (
        UniqueConstraint("corpus_run_id", "original_url", name="ux_source_decision_run_original_url"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    corpus_run_id: Mapped[int] = mapped_column(ForeignKey("source_corpus_runs.id"), index=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("indexed_sources.id"), index=True)
    consumer: Mapped[str] = mapped_column(String(80), default="manual", index=True)
    context_id: Mapped[str] = mapped_column(String(180), index=True)
    original_url: Mapped[str] = mapped_column(String(2048))
    decision: Mapped[str] = mapped_column(String(40), index=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    matched_terms: Mapped[list[str]] = mapped_column(JSON, default=list)
    reason: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    corpus_run: Mapped[SourceCorpusRun] = relationship(back_populates="decisions")
    source: Mapped[IndexedSource] = relationship(back_populates="decisions")
