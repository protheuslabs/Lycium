from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from source_index.corpus import compile_source_corpus_preflight
from source_index.models import IndexedSource, SourceCorpusRun, SourceDecision
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
