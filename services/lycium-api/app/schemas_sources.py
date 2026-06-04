
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


class SourceIndexSearchFilters(BaseModel):
    source_types: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    free_only: bool | None = None


class SourceIndexSearchCreate(BaseModel):
    query: str
    filters: SourceIndexSearchFilters = Field(default_factory=SourceIndexSearchFilters)
    limit: int = Field(default=12, ge=1, le=100)


class SourceIndexSearchResultRead(BaseModel):
    source: dict[str, Any]
    snapshot: dict[str, Any] | None = None
    score: float
    matched_terms: list[str]
    evidence_refs: list[str]
    summary: str | None = None


class SourceIndexSearchRead(BaseModel):
    contract_version: str
    query: str
    result_count: int
    results: list[SourceIndexSearchResultRead]


class SourceFitSourceInput(BaseModel):
    source_id: int | None = None
    url: HttpUrl | None = None
    title: str | None = None
    text: str | None = None
    source_type: str | None = None


class SourceFitTargetDescriptor(BaseModel):
    target_id: str
    target_type: str = "target"
    title: str
    description: str | None = None
    concepts: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class SourceFitCreate(BaseModel):
    sources: list[SourceFitSourceInput]
    targets: list[SourceFitTargetDescriptor]
    limit: int = Field(default=20, ge=1, le=200)
    minimum_score: float = Field(default=0.15, ge=0, le=1)


class SourceFitCandidateRead(BaseModel):
    source_id: int | None = None
    source_url: str | None = None
    source_title: str | None = None
    target_type: str
    target_id: str
    target_title: str
    fit_score: float
    matched_terms: list[str]
    fit_reason: str
    suggested_use: str
    confidence: str


class SourceFitRead(BaseModel):
    contract_version: str
    source_count: int
    target_count: int
    candidate_count: int
    candidates: list[SourceFitCandidateRead]
    warnings: list[str]


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
    duplicateSourceCount: int
    brokenUrlCount: int
    snapshotCoverageRatio: float
    documentCoverageRatio: float
    evidenceCoverageRatio: float
    sourceTypeMix: dict[str, int]
    averageTrustScore: float
    freshnessKnownRatio: float
    staleVerificationCount: int
    benchmarkSourceCount: int
    benchmarkUsefulnessRatio: float
    qualityWarnings: list[str]
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
