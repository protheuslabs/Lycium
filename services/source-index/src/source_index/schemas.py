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
