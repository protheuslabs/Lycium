
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
    public_id: str | None = None
    canonical_url: str
    normalized_domain: str
    title: str | None
    source_type: str
    license: str
    is_free: bool
    trust_baseline: float
    archive_links: list[str]
    last_verified_at: datetime


class IndexedSourceCreate(BaseModel):
    url: HttpUrl
    title: str | None = None
    source_type: str | None = None
    license: str = "unknown"
    is_free: bool = True


class IndexedSourceRead(SourceRead):
    link_health: str
    created_at: datetime
    updated_at: datetime


class BulkSourceImportItem(BaseModel):
    url: HttpUrl
    title: str | None = None
    source_type: str | None = None
    license: str = "unknown"
    is_free: bool = True
    raw_text: str | None = None
    content_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class BulkSourceImportCreate(BaseModel):
    batch_id: str | None = None
    sources: list[BulkSourceImportItem]


class BulkSourceImportRowRead(BaseModel):
    original_index: int
    source: dict[str, Any]
    snapshot: dict[str, Any] | None = None
    created_snapshot: bool
    warnings: list[str]


class BulkSourceImportRead(BaseModel):
    contract_version: str
    batch_id: str
    submitted_count: int
    imported_count: int
    snapshot_count: int
    sources: list[BulkSourceImportRowRead]
    warnings: list[str]


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
    consumer: str = "lycium"
    context_id: str
    prompt: str
    source_urls: list[HttpUrl]
    fetch_sources: bool = True
    source_documents: list[dict[str, Any]] = Field(default_factory=list)


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


class SourcePacketCreate(SourceCorpusRunCreate):
    snapshot_limit: int = Field(default=1, ge=0, le=5)


class SourcePacketSourceRead(BaseModel):
    source: dict[str, Any]
    decision: SourceDecisionRead
    snapshots: list[dict[str, Any]]
    evidence_refs: list[str]
    source_document: dict[str, Any] | None = None


class SourcePacketQualityRead(BaseModel):
    status: str
    includedSourceCount: int
    sourceDocumentCount: int
    snapshotCoverageRatio: float
    documentCoverageRatio: float
    evidenceCoverageRatio: float
    warningCount: int


class SourcePacketRead(BaseModel):
    contract_version: str
    packet_id: str
    generated_at: str
    producer: dict[str, Any]
    consumer: str
    context_id: str
    prompt: str
    source_urls: list[str]
    corpus_run: SourceCorpusRunRead
    sources: list[SourcePacketSourceRead]
    source_documents: list[dict[str, Any]]
    synthesis: dict[str, Any]
    warnings: list[str]
    quality: SourcePacketQualityRead


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


class RetrievalQualityReportRead(BaseModel):
    query: str
    returned: int
    score: float = Field(ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)


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
    level: Literal["elementary", "highschool", "undergrad", "postgrad"] | None = None


class LearningPacket(BaseModel):
    query: str
    object_ids: list[int]
    rationale: str
    modality_mix: dict[str, int]
    trust_floor_applied: float
    quality_report: RetrievalQualityReportRead | None = None
