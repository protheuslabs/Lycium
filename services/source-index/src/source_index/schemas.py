from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, HttpUrl


class IndexedSourceCreate(BaseModel):
    url: HttpUrl
    title: str | None = None
    source_type: str | None = None
    license: str = "unknown"
    is_free: bool = True


class IndexedSourceRead(BaseModel):
    id: int
    canonical_url: str
    normalized_domain: str
    submitted_urls: list[str]
    title: str | None
    source_type: str
    license: str
    is_free: bool
    trust_baseline: float
    link_health: str
    created_at: datetime
    updated_at: datetime


class SourceSnapshotCreate(BaseModel):
    fetch: bool = True
    raw_text: str | None = None
    content_type: str | None = None
    title: str | None = None
    raw_storage_ref: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceSnapshotRead(BaseModel):
    id: int
    source_id: int
    fetched_at: datetime
    status: str
    content_hash: str | None
    content_type: str | None
    title: str | None
    text_digest: str | None
    extracted_text: str
    raw_storage_ref: str | None
    snapshot_metadata: dict[str, Any]


class CrawlPolicyCreate(BaseModel):
    name: str = "education-institution-crawl-v1"
    version: str = "v1"
    description: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class CrawlPolicyRead(BaseModel):
    id: int
    name: str
    version: str
    description: str | None
    payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CrawlRunCreate(BaseModel):
    policy_id: int
    seed_urls: list[HttpUrl]
    max_pages: int = Field(default=250, ge=1, le=5000)
    payload: dict[str, Any] = Field(default_factory=dict)


class CrawlRunRead(BaseModel):
    id: int
    policy_id: int
    status: str
    seed_urls: list[str]
    max_pages: int
    pages_queued: int
    pages_fetched: int
    pages_accepted: int
    pages_rejected: int
    started_at: datetime | None
    finished_at: datetime | None
    payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CrawlTaskRead(BaseModel):
    contract_version: str
    crawl_run_id: int
    policy_id: int
    url: str
    depth: int
    parent_url: str | None
    policy: dict[str, Any]
    trace: dict[str, Any]


class SourceDecisionRead(BaseModel):
    id: int
    corpus_run_id: int
    source_id: int
    consumer: str
    context_id: str
    original_url: str
    decision: str
    relevance_score: float
    matched_terms: list[str]
    reason: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class SourceCorpusRunCreate(BaseModel):
    consumer: str = "manual"
    context_id: str
    prompt: str
    source_urls: list[HttpUrl]
    fetch_sources: bool = True


class SourceCorpusRunRead(BaseModel):
    id: int
    consumer: str
    context_id: str
    prompt: str
    workflow_version: str
    submitted_source_count: int
    included_source_count: int
    excluded_source_count: int
    common_themes: list[dict[str, Any]]
    payload: dict[str, Any]
    decisions: list[SourceDecisionRead]
    created_at: datetime
    updated_at: datetime
