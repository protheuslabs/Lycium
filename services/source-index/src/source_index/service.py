from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from source_index.config import SETTINGS
from source_index.corpus import compile_source_corpus_preflight
from source_index.crawl.policies import normalize_policy_payload
from source_index.crawl.tasks import build_seed_tasks
from source_index.models import CrawlPolicyRecord, CrawlRun, IndexedSource, SourceCorpusRun, SourceDecision, SourceSnapshot
from source_index.url_utils import baseline_trust, canonicalize_url, infer_source_type, normalized_domain

SOURCE_CORPUS_WORKFLOW_VERSION = "source-corpus-preflight-v1"


def source_payload(source: IndexedSource) -> dict[str, Any]:
    return {
        "id": source.id,
        "canonical_url": source.canonical_url,
        "normalized_domain": source.normalized_domain,
        "submitted_urls": source.submitted_urls,
        "title": source.title,
        "source_type": source.source_type,
        "license": source.license,
        "is_free": source.is_free,
        "trust_baseline": source.trust_baseline,
        "link_health": source.link_health,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }


def snapshot_payload(snapshot: SourceSnapshot) -> dict[str, Any]:
    return {
        "id": snapshot.id,
        "source_id": snapshot.source_id,
        "fetched_at": snapshot.fetched_at,
        "status": snapshot.status,
        "content_hash": snapshot.content_hash,
        "content_type": snapshot.content_type,
        "title": snapshot.title,
        "text_digest": snapshot.text_digest,
        "extracted_text": snapshot.extracted_text,
        "raw_storage_ref": snapshot.raw_storage_ref,
        "snapshot_metadata": snapshot.snapshot_metadata,
    }


def decision_payload(decision: SourceDecision) -> dict[str, Any]:
    return {
        "id": decision.id,
        "corpus_run_id": decision.corpus_run_id,
        "source_id": decision.source_id,
        "consumer": decision.consumer,
        "context_id": decision.context_id,
        "original_url": decision.original_url,
        "decision": decision.decision,
        "relevance_score": decision.relevance_score,
        "matched_terms": decision.matched_terms,
        "reason": decision.reason,
        "payload": decision.payload,
        "created_at": decision.created_at,
    }


def corpus_run_payload(run: SourceCorpusRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "consumer": run.consumer,
        "context_id": run.context_id,
        "prompt": run.prompt,
        "workflow_version": run.workflow_version,
        "submitted_source_count": run.submitted_source_count,
        "included_source_count": run.included_source_count,
        "excluded_source_count": run.excluded_source_count,
        "common_themes": run.common_themes,
        "payload": run.payload,
        "decisions": [decision_payload(decision) for decision in run.decisions],
        "created_at": run.created_at,
        "updated_at": run.updated_at,
    }


def crawl_policy_payload(policy: CrawlPolicyRecord) -> dict[str, Any]:
    return {
        "id": policy.id,
        "name": policy.name,
        "version": policy.version,
        "description": policy.description,
        "payload": policy.payload,
        "created_at": policy.created_at,
        "updated_at": policy.updated_at,
    }


def crawl_run_payload(run: CrawlRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "policy_id": run.policy_id,
        "status": run.status,
        "seed_urls": run.seed_urls,
        "max_pages": run.max_pages,
        "pages_queued": run.pages_queued,
        "pages_fetched": run.pages_fetched,
        "pages_accepted": run.pages_accepted,
        "pages_rejected": run.pages_rejected,
        "started_at": run.started_at,
        "finished_at": run.finished_at,
        "payload": run.payload,
        "created_at": run.created_at,
        "updated_at": run.updated_at,
    }


def upsert_source(
    session: Session,
    *,
    url: str,
    title: str | None = None,
    source_type: str | None = None,
    license: str = "unknown",
    is_free: bool = True,
) -> IndexedSource:
    canonical_url = canonicalize_url(url)
    source = session.scalar(select(IndexedSource).where(IndexedSource.canonical_url == canonical_url))
    if source is None:
        source = IndexedSource(
            canonical_url=canonical_url,
            normalized_domain=normalized_domain(canonical_url),
            submitted_urls=[url],
            title=title,
            source_type=source_type or infer_source_type(canonical_url),
            license=license,
            is_free=is_free,
            trust_baseline=baseline_trust(canonical_url),
            link_health="unknown",
        )
        session.add(source)
        session.flush()
        return source

    if url not in source.submitted_urls:
        source.submitted_urls = [*source.submitted_urls, url]
    if title and not source.title:
        source.title = title
    if source_type:
        source.source_type = source_type
    source.license = license or source.license
    source.is_free = is_free
    source.updated_at = datetime.now(UTC)
    return source


def _normalize_text(value: str) -> str:
    return " ".join(value.split())


def _extract_title_and_text(raw_text: str, content_type: str | None, fallback_title: str | None = None) -> tuple[str | None, str]:
    lowered_content_type = (content_type or "").lower()
    looks_like_html = "html" in lowered_content_type or "<html" in raw_text[:1000].lower()
    if not looks_like_html:
        return fallback_title, _normalize_text(raw_text)

    soup = BeautifulSoup(raw_text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    title = fallback_title
    if not title and soup.title and soup.title.string:
        title = _normalize_text(soup.title.string)
    return title, _normalize_text(soup.get_text(" "))


def _fetch_source_text(source: IndexedSource) -> tuple[str, str | None, dict[str, Any]]:
    response = httpx.get(
        source.canonical_url,
        follow_redirects=True,
        timeout=20.0,
        headers={"User-Agent": SETTINGS.user_agent},
    )
    response.raise_for_status()
    return (
        response.text,
        response.headers.get("content-type"),
        {"fetched_url": str(response.url), "status_code": response.status_code},
    )


def create_source_snapshot(
    session: Session,
    *,
    source_id: int,
    fetch: bool = True,
    raw_text: str | None = None,
    content_type: str | None = None,
    title: str | None = None,
    raw_storage_ref: str | None = None,
    snapshot_metadata: dict[str, Any] | None = None,
) -> SourceSnapshot:
    source = session.get(IndexedSource, source_id)
    if source is None:
        raise LookupError("Indexed source not found.")

    metadata = dict(snapshot_metadata or {})
    status = "provided"
    if fetch:
        raw_text, fetched_content_type, fetch_metadata = _fetch_source_text(source)
        content_type = content_type or fetched_content_type
        metadata = {**metadata, **fetch_metadata}
        status = "fetched"
    elif not raw_text or not raw_text.strip():
        raise ValueError("Snapshot requires raw_text when fetch is false.")

    extracted_title, extracted_text = _extract_title_and_text(raw_text or "", content_type, title or source.title)
    content_hash = hashlib.sha256(extracted_text.encode("utf-8")).hexdigest() if extracted_text else None
    snapshot = SourceSnapshot(
        source_id=source.id,
        status=status,
        content_hash=content_hash,
        content_type=content_type,
        title=extracted_title,
        text_digest=extracted_text[:1200],
        extracted_text=extracted_text,
        raw_storage_ref=raw_storage_ref,
        snapshot_metadata=metadata,
    )
    session.add(snapshot)

    if extracted_title and not source.title:
        source.title = extracted_title
    if fetch:
        source.link_health = "healthy"
    source.updated_at = datetime.now(UTC)

    session.flush()
    return snapshot


def list_source_snapshots(session: Session, *, source_id: int, limit: int = 50) -> list[SourceSnapshot]:
    return list(
        session.scalars(
            select(SourceSnapshot)
            .where(SourceSnapshot.source_id == source_id)
            .order_by(SourceSnapshot.fetched_at.desc(), SourceSnapshot.id.desc())
            .limit(limit)
        )
    )


def create_crawl_policy(
    session: Session,
    *,
    name: str,
    version: str = "v1",
    description: str | None = None,
    payload: dict[str, Any] | None = None,
) -> CrawlPolicyRecord:
    normalized_payload = normalize_policy_payload(payload)
    normalized_payload["name"] = name
    normalized_payload["version"] = version
    policy = session.scalar(
        select(CrawlPolicyRecord).where(
            CrawlPolicyRecord.name == name,
            CrawlPolicyRecord.version == version,
        )
    )
    if policy is None:
        policy = CrawlPolicyRecord(
            name=name,
            version=version,
            description=description or normalized_payload.get("description"),
            payload=normalized_payload,
        )
        session.add(policy)
    else:
        policy.description = description or policy.description or normalized_payload.get("description")
        policy.payload = normalized_payload
        policy.updated_at = datetime.now(UTC)
    session.flush()
    return policy


def list_crawl_policies(session: Session, *, limit: int = 100) -> list[CrawlPolicyRecord]:
    return list(
        session.scalars(
            select(CrawlPolicyRecord).order_by(CrawlPolicyRecord.updated_at.desc(), CrawlPolicyRecord.id.desc()).limit(limit)
        )
    )


def create_crawl_run(
    session: Session,
    *,
    policy_id: int,
    seed_urls: list[str],
    max_pages: int = 250,
    payload: dict[str, Any] | None = None,
) -> CrawlRun:
    policy = session.get(CrawlPolicyRecord, policy_id)
    if policy is None:
        raise LookupError("Crawl policy not found.")

    run_payload = dict(payload or {})
    run_payload.setdefault("task_contract_version", "crawl-task-v1")
    run_payload.setdefault("worker_result_contract_version", "crawl-worker-result-v1")
    run = CrawlRun(
        policy_id=policy.id,
        status="queued",
        seed_urls=seed_urls,
        max_pages=max_pages,
        pages_queued=len(seed_urls),
        payload=run_payload,
    )
    session.add(run)
    session.flush()
    return run


def list_crawl_run_seed_tasks(session: Session, *, run_id: int) -> list[dict[str, Any]]:
    run = session.get(CrawlRun, run_id)
    if run is None:
        raise LookupError("Crawl run not found.")
    policy = session.get(CrawlPolicyRecord, run.policy_id)
    if policy is None:
        raise LookupError("Crawl policy not found.")
    return [
        task.model_dump(mode="json")
        for task in build_seed_tasks(
            crawl_run_id=run.id,
            policy_id=policy.id,
            seed_urls=run.seed_urls,
            policy=policy.payload,
        )
    ]


def list_sources(
    session: Session,
    *,
    query: str | None = None,
    domain: str | None = None,
    source_type: str | None = None,
    limit: int = 100,
) -> list[IndexedSource]:
    stmt = select(IndexedSource).order_by(IndexedSource.updated_at.desc(), IndexedSource.id.desc()).limit(limit)
    if query:
        like = f"%{query.lower()}%"
        stmt = stmt.where(
            IndexedSource.canonical_url.ilike(like)
            | IndexedSource.normalized_domain.ilike(like)
            | IndexedSource.title.ilike(like)
        )
    if domain:
        stmt = stmt.where(IndexedSource.normalized_domain == domain.lower().replace("www.", ""))
    if source_type:
        stmt = stmt.where(IndexedSource.source_type == source_type)
    return list(session.scalars(stmt))


def persist_corpus_run(
    session: Session,
    *,
    consumer: str,
    context_id: str,
    prompt: str,
    source_urls: list[str],
    synthesis: dict[str, Any],
    workflow_version: str = SOURCE_CORPUS_WORKFLOW_VERSION,
) -> SourceCorpusRun:
    existing = session.scalar(
        select(SourceCorpusRun).where(
            SourceCorpusRun.consumer == consumer,
            SourceCorpusRun.context_id == context_id,
            SourceCorpusRun.workflow_version == workflow_version,
        )
    )
    if existing is not None:
        return existing

    metrics = synthesis.get("metrics") if isinstance(synthesis.get("metrics"), dict) else {}
    run = SourceCorpusRun(
        consumer=consumer,
        context_id=context_id,
        prompt=prompt,
        workflow_version=workflow_version,
        submitted_source_count=int(metrics.get("submittedSourceCount") or len(source_urls)),
        included_source_count=int(metrics.get("includedSourceCount") or 0),
        excluded_source_count=int(metrics.get("excludedSourceCount") or 0),
        common_themes=synthesis.get("commonThemes") if isinstance(synthesis.get("commonThemes"), list) else [],
        payload=synthesis,
    )
    session.add(run)
    session.flush()

    for decision_name, rows in (("included", synthesis.get("includedSources")), ("excluded", synthesis.get("excludedSources"))):
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            url = str(row.get("url") or "").strip()
            if not url:
                continue
            source = upsert_source(session, url=url)
            session.add(
                SourceDecision(
                    corpus_run_id=run.id,
                    source_id=source.id,
                    consumer=consumer,
                    context_id=context_id,
                    original_url=url,
                    decision=decision_name,
                    relevance_score=float(row.get("relevanceScore") or 0.0),
                    matched_terms=[str(term) for term in row.get("matchedTerms", []) if isinstance(term, str)],
                    reason=str(row.get("reason") or ""),
                    payload=row,
                )
            )
    session.flush()
    return run


def create_corpus_run(
    session: Session,
    *,
    consumer: str,
    context_id: str,
    prompt: str,
    source_urls: list[str],
    fetch_sources: bool = True,
) -> SourceCorpusRun:
    preflight = compile_source_corpus_preflight(prompt=prompt, source_urls=source_urls, fetch_sources=fetch_sources)
    return persist_corpus_run(
        session,
        consumer=consumer,
        context_id=context_id,
        prompt=prompt,
        source_urls=source_urls,
        synthesis=preflight.synthesis,
    )
