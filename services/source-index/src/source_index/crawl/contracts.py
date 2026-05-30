from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

CRAWL_TASK_CONTRACT_VERSION = "crawl-task-v1"
CRAWL_WORKER_RESULT_CONTRACT_VERSION = "crawl-worker-result-v1"


class CrawlTask(BaseModel):
    contract_version: Literal["crawl-task-v1"] = CRAWL_TASK_CONTRACT_VERSION
    crawl_run_id: int
    policy_id: int
    url: str
    depth: int = 0
    parent_url: str | None = None
    policy: dict[str, Any] = Field(default_factory=dict)
    trace: dict[str, Any] = Field(default_factory=dict)


class DiscoveredLink(BaseModel):
    url: str
    depth: int
    anchor_text: str | None = None
    reason: str | None = None


class PageClassification(BaseModel):
    label: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)


class FetchResult(BaseModel):
    url: str
    final_url: str | None = None
    status_code: int | None = None
    content_type: str | None = None
    content_hash: str | None = None
    raw_storage_ref: str | None = None
    fetched_at: str | None = None
    error: str | None = None


class ExtractionResult(BaseModel):
    title: str | None = None
    extracted_text: str = ""
    text_digest: str | None = None
    language: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CrawlWorkerResult(BaseModel):
    contract_version: Literal["crawl-worker-result-v1"] = CRAWL_WORKER_RESULT_CONTRACT_VERSION
    crawl_run_id: int
    policy_id: int
    source_id: int | None = None
    snapshot_id: int | None = None
    task: CrawlTask
    fetch: FetchResult
    extraction: ExtractionResult | None = None
    classification: PageClassification | None = None
    discovered_links: list[DiscoveredLink] = Field(default_factory=list)
    accepted: bool = False
    rejection_reason: str | None = None
