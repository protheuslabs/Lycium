from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Snapshot, Source, SourceCorpusRun, SourceDecision
from app.scoring import baseline_trust
from app.source_corpus import compile_source_corpus_preflight
from app.source_index_client import SourceIndexClient, normalize_remote_source_payload, source_index_client_configured
from app.source_identity import stable_snapshot_public_id, stable_source_public_id
from app.source_url_utils import canonicalize_url, infer_source_type, normalized_domain

SOURCE_CORPUS_WORKFLOW_VERSION = "source-corpus-preflight-v1"
SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
SOURCE_IMPORT_BATCH_CONTRACT_VERSION = "source-import-batch-v1"


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


def create_indexed_source_response(
    session: Session,
    *,
    url: str,
    title: str | None = None,
    source_type: str | None = None,
    license: str = "unknown",
    is_free: bool = True,
) -> dict[str, Any]:
    if source_index_client_configured():
        return normalize_remote_source_payload(
            SourceIndexClient().create_source(
                url=url,
                title=title,
                source_type=source_type,
                license=license,
                is_free=is_free,
            )
        )

    source = upsert_indexed_source(
        session,
        url=url,
        title=title,
        source_type=source_type,
        license=license,
        is_free=is_free,
    )
    session.commit()
    session.refresh(source)
    return source_payload(source)


def list_indexed_source_responses(
    session: Session,
    *,
    query: str | None = None,
    domain: str | None = None,
    source_type: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    if source_index_client_configured():
        return [
            normalize_remote_source_payload(source)
            for source in SourceIndexClient().list_sources(
                query=query,
                domain=domain,
                source_type=source_type,
                limit=limit,
            )
        ]
    return [
        source_payload(source)
        for source in list_indexed_sources(
            session,
            query=query,
            domain=domain,
            source_type=source_type,
            limit=limit,
        )
    ]


def get_indexed_source_response(session: Session, *, source_id: int) -> dict[str, Any] | None:
    if source_index_client_configured():
        return normalize_remote_source_payload(SourceIndexClient().get_source(source_id))
    source = session.get(Source, source_id)
    return source_payload(source) if source else None


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
        "matched_terms": decision.matched_terms or [],
        "reason": decision.reason,
        "payload": decision.payload or {},
        "created_at": decision.created_at,
    }


def corpus_run_payload(run: SourceCorpusRun) -> dict[str, Any]:
    decisions = sorted(run.decisions, key=lambda decision: decision.id)
    return {
        "id": run.id,
        "consumer": run.consumer,
        "context_id": run.context_id,
        "prompt": run.prompt,
        "workflow_version": run.workflow_version,
        "submitted_source_count": run.submitted_source_count,
        "included_source_count": run.included_source_count,
        "excluded_source_count": run.excluded_source_count,
        "common_themes": run.common_themes or [],
        "payload": run.payload or {},
        "decisions": [source_decision_payload(decision) for decision in decisions],
        "created_at": run.created_at,
        "updated_at": run.updated_at,
    }


def get_source_corpus_run_response(session: Session, *, run_id: int) -> dict[str, Any] | None:
    if source_index_client_configured():
        return SourceIndexClient().get_corpus_run(run_id)
    run = session.get(SourceCorpusRun, run_id)
    return corpus_run_payload(run) if run else None




def create_source_corpus_run_response(
    session: Session,
    *,
    consumer: str,
    context_id: str,
    prompt: str,
    source_urls: list[str],
    fetch_sources: bool = True,
    source_documents: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if source_index_client_configured():
        return SourceIndexClient().create_corpus_run(
            consumer=consumer,
            context_id=context_id,
            prompt=prompt,
            source_urls=source_urls,
            fetch_sources=fetch_sources,
            source_documents=source_documents,
        )

    run = create_source_corpus_run(
        session,
        consumer=consumer,
        context_id=context_id,
        prompt=prompt,
        source_urls=source_urls,
        fetch_sources=fetch_sources,
        source_documents=source_documents,
    )
    session.commit()
    session.refresh(run)
    return corpus_run_payload(run)




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
            normalized_domain=normalized_domain(canonical_url),
            title=title,
            source_type=source_type or infer_source_type(canonical_url),
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
    if source_index_client_configured():
        remote_documents = _remote_source_documents_from_index_snapshots(source_urls=source_urls, limit=limit)
        if remote_documents:
            return remote_documents

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
                "sourceType": source.source_type,
                "trustBaseline": source.trust_baseline,
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


def _remote_source_documents_from_index_snapshots(
    *,
    source_urls: list[str] | None = None,
    limit: int = 25,
) -> list[dict[str, Any]]:
    client = SourceIndexClient()
    documents: list[dict[str, Any]] = []
    seen_sources: set[str] = set()
    for url in source_urls or []:
        canonical_url = canonicalize_url(url)
        matches = client.list_sources(query=canonical_url, limit=5)
        source = next((row for row in matches if row.get("canonical_url") == canonical_url), None)
        if not source:
            continue
        source_public_id = str(source.get("public_id") or stable_source_public_id(canonical_url))
        if source_public_id in seen_sources:
            continue
        snapshots = client.list_source_snapshots(int(source["id"]), limit=1)
        if not snapshots:
            continue
        snapshot = snapshots[0]
        text = str(snapshot.get("extracted_text") or "")
        if not text.strip():
            continue
        snapshot_public_id = str(snapshot.get("public_id") or stable_snapshot_public_id(source_public_id, str(snapshot.get("content_hash") or "")))
        documents.append(
            {
                "url": canonical_url,
                "contentType": str(snapshot.get("content_type") or "text/plain"),
                "text": text,
                "sourceId": source_public_id,
                "snapshotId": snapshot_public_id,
                "sourceIndexRef": {
                    "service": client.base_url,
                    "sourcePublicId": source_public_id,
                    "snapshotPublicId": snapshot_public_id,
                    "sourceRemoteId": source.get("id"),
                    "snapshotRemoteId": snapshot.get("id"),
                },
                "title": source.get("title") or snapshot.get("title"),
            }
        )
        seen_sources.add(source_public_id)
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
    source_documents: list[dict[str, Any]] | None = None,
) -> SourceCorpusRun:
    preflight = compile_source_corpus_preflight(
        prompt=prompt,
        source_urls=source_urls,
        fetch_sources=fetch_sources,
        source_documents=source_documents,
    )
    return persist_source_corpus_run(
        session,
        consumer=consumer,
        context_id=context_id,
        prompt=prompt,
        source_urls=source_urls,
        synthesis=preflight.synthesis,
    )
