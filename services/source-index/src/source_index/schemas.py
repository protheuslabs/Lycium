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
    public_id: str | None = None
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


class SourceSnapshotCreate(BaseModel):
    fetch: bool = True
    raw_text: str | None = None
    content_type: str | None = None
    title: str | None = None
    raw_storage_ref: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceSnapshotRead(BaseModel):
    id: int
    public_id: str | None = None
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


class BulkSourceImportRowRead(BaseModel):
    original_index: int
    source: IndexedSourceRead
    snapshot: SourceSnapshotRead | None = None
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
    source: IndexedSourceRead
    decision: SourceDecisionRead
    snapshots: list[SourceSnapshotRead]
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
    conceptCandidateCount: int
    coveredConceptCandidateCount: int
    conceptCoverageRatio: float
    uncoveredConceptCandidates: list[str]
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


class SourceIndexServiceContractRead(BaseModel):
    contract_version: str
    service: str
    api_version: str
    purpose: str
    portable_contracts: list[dict[str, Any]]
    stable_endpoints: list[dict[str, Any]]
    cli_commands: list[str]
    owns: list[str]
    does_not_own: list[str]
    consumer_expectations: list[str]


class SourcePacketImportCreate(BaseModel):
    packet: dict[str, Any]
    import_snapshots: bool = True
    dry_run: bool = False


class SourcePacketImportRead(BaseModel):
    contract_version: str
    packet_id: str
    valid: bool
    dry_run: bool
    import_snapshots: bool
    source_count: int
    source_document_count: int
    imported_source_count: int
    imported_snapshot_count: int
    source_refs: list[dict[str, Any]]
    errors: list[str]
    warnings: list[str]


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
    source: IndexedSourceRead
    snapshot: SourceSnapshotRead | None = None
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
