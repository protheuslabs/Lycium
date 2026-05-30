from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion import canonicalize_url
from app.models import Snapshot, Source, SourceCorpusRun, SourceDecision
from app.scoring import baseline_trust
from app.source_corpus import compile_source_corpus_preflight
from app.source_identity import stable_snapshot_public_id, stable_source_public_id

SOURCE_CORPUS_WORKFLOW_VERSION = "source-corpus-preflight-v1"


def _domain(url: str) -> str:
    parsed = urlparse(url)
    return (parsed.netloc or parsed.path).lower().replace("www.", "")


def _infer_source_type(url: str) -> str:
    lowered = url.lower()
    if lowered.endswith(".pdf") or "/pdf" in lowered:
        return "pdf"
    if any(host in lowered for host in ("youtube.com", "youtu.be", "vimeo.com")):
        return "video"
    if any(token in lowered for token in ("syllabus", "course-outline")):
        return "syllabus"
    if any(token in lowered for token in ("catalog", ".edu/courses", "/courses/")):
        return "catalog"
    if any(token in lowered for token in ("docs.", "/docs/", "documentation")):
        return "docs"
    if any(token in lowered for token in ("arxiv.org", "doi.org", "pubmed", "journal")):
        return "paper"
    if any(token in lowered for token in ("openstax.org/details/books", "bookshelves")):
        return "book"
    return "web"


def source_payload(source: Source) -> dict[str, Any]:
    return {
        "id": source.id,
        "public_id": source.public_id or stable_source_public_id(source.canonical_url),
        "canonical_url": source.canonical_url,
        "normalized_domain": source.normalized_domain,
        "title": source.title,
        "source_type": source.source_type,
        "license": source.license,
        "is_free": source.is_free,
        "trust_baseline": source.trust_baseline,
        "link_health": source.link_health,
        "archive_links": source.archive_links,
        "last_verified_at": source.last_verified_at,
        "created_at": source.created_at,
        "updated_at": source.updated_at,
    }


def source_decision_payload(decision: SourceDecision) -> dict[str, Any]:
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
        "decisions": [source_decision_payload(decision) for decision in run.decisions],
        "created_at": run.created_at,
        "updated_at": run.updated_at,
    }


def upsert_indexed_source(
    session: Session,
    *,
    url: str,
    title: str | None = None,
    source_type: str | None = None,
    license: str = "unknown",
    is_free: bool = True,
) -> Source:
    canonical_url = canonicalize_url(url)
    source_public_id = stable_source_public_id(canonical_url)
    source = session.scalar(select(Source).where(Source.canonical_url == canonical_url))
    if source is None:
        source = Source(
            public_id=source_public_id,
            canonical_url=canonical_url,
            normalized_domain=_domain(canonical_url),
            title=title,
            source_type=source_type or _infer_source_type(canonical_url),
            license=license,
            is_free=is_free,
            trust_baseline=baseline_trust(canonical_url),
            link_health="unknown",
            archive_links=[],
            last_verified_at=datetime.now(UTC),
        )
        session.add(source)
        session.flush()
        return source

    source.public_id = source.public_id or source_public_id
    if title and not source.title:
        source.title = title
    if source_type:
        source.source_type = source_type
    source.license = license or source.license
    source.is_free = is_free
    source.updated_at = datetime.now(UTC)
    return source


def list_indexed_sources(
    session: Session,
    *,
    query: str | None = None,
    domain: str | None = None,
    source_type: str | None = None,
    limit: int = 100,
) -> list[Source]:
    stmt = select(Source).order_by(Source.updated_at.desc(), Source.id.desc()).limit(limit)
    if query:
        like = f"%{query.lower()}%"
        stmt = stmt.where(
            Source.canonical_url.ilike(like)
            | Source.normalized_domain.ilike(like)
            | Source.title.ilike(like)
        )
    if domain:
        stmt = stmt.where(Source.normalized_domain == domain.lower().replace("www.", ""))
    if source_type:
        stmt = stmt.where(Source.source_type == source_type)
    return list(session.scalars(stmt))


def source_documents_from_index_snapshots(
    session: Session,
    *,
    source_urls: list[str] | None = None,
    source_ids: list[int] | None = None,
    limit: int = 25,
) -> list[dict[str, Any]]:
    canonical_urls = {canonicalize_url(url) for url in source_urls or []}
    source_id_set = set(source_ids or [])
    stmt = (
        select(Snapshot, Source)
        .join(Source, Source.id == Snapshot.source_id)
        .order_by(Snapshot.fetched_at.desc(), Snapshot.id.desc())
        .limit(max(limit * 4, limit))
    )
    if canonical_urls:
        stmt = stmt.where(Source.canonical_url.in_(canonical_urls))
    if source_id_set:
        stmt = stmt.where(Source.id.in_(source_id_set))

    documents: list[dict[str, Any]] = []
    seen_sources: set[int] = set()
    for snapshot, source in session.execute(stmt).all():
        if source.id in seen_sources:
            continue
        text = snapshot.cleaned_text or snapshot.raw_text
        if not text.strip():
            continue
        metadata = snapshot.artifact_metadata if isinstance(snapshot.artifact_metadata, dict) else {}
        source_public_id = source.public_id or stable_source_public_id(source.canonical_url)
        snapshot_public_id = snapshot.public_id or stable_snapshot_public_id(source_public_id, snapshot.content_hash)
        documents.append(
            {
                "url": source.canonical_url,
                "contentType": str(metadata.get("content_type") or "text/plain"),
                "text": text,
                "sourceId": source_public_id,
                "snapshotId": snapshot_public_id,
                "sourceIndexRef": {
                    "service": "lycium-api-transitional-index",
                    "sourcePublicId": source_public_id,
                    "snapshotPublicId": snapshot_public_id,
                    "sourceLocalId": source.id,
                    "snapshotLocalId": snapshot.id,
                },
                "title": source.title,
            }
        )
        seen_sources.add(source.id)
        if len(documents) >= limit:
            break
    return documents


def persist_source_corpus_run(
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
            source = upsert_indexed_source(session, url=url)
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


def create_source_corpus_run(
    session: Session,
    *,
    consumer: str,
    context_id: str,
    prompt: str,
    source_urls: list[str],
    fetch_sources: bool = True,
) -> SourceCorpusRun:
    preflight = compile_source_corpus_preflight(
        prompt=prompt,
        source_urls=source_urls,
        fetch_sources=fetch_sources,
    )
    return persist_source_corpus_run(
        session,
        consumer=consumer,
        context_id=context_id,
        prompt=prompt,
        source_urls=source_urls,
        synthesis=preflight.synthesis,
    )
