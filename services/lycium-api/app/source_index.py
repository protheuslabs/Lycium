from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion import canonicalize_url
from app.models import Snapshot, Source, SourceCorpusRun, SourceDecision
from app.scoring import baseline_trust
from app.source_corpus import compile_source_corpus_preflight
from app.source_index_client import SourceIndexClient, normalize_remote_source_payload, source_index_client_configured
from app.source_identity import stable_snapshot_public_id, stable_source_public_id

SOURCE_CORPUS_WORKFLOW_VERSION = "source-corpus-preflight-v1"
SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
SOURCE_IMPORT_BATCH_CONTRACT_VERSION = "source-import-batch-v1"


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


def snapshot_payload(snapshot: Snapshot, source: Source | None = None) -> dict[str, Any]:
    source_public_id = source.public_id if source else None
    snapshot_public_id = snapshot.public_id or stable_snapshot_public_id(
        source_public_id or f"source-{snapshot.source_id}",
        snapshot.content_hash,
    )
    metadata = snapshot.artifact_metadata if isinstance(snapshot.artifact_metadata, dict) else {}
    return {
        "id": snapshot.id,
        "public_id": snapshot_public_id,
        "source_id": snapshot.source_id,
        "fetched_at": snapshot.fetched_at,
        "status": snapshot.extraction_status,
        "content_hash": snapshot.content_hash,
        "content_type": metadata.get("content_type") or metadata.get("contentType") or "text/plain",
        "title": metadata.get("title") or source.title if source else metadata.get("title"),
        "text_digest": (snapshot.cleaned_text or snapshot.raw_text)[:1200],
        "extracted_text": snapshot.cleaned_text or snapshot.raw_text,
        "raw_storage_ref": metadata.get("raw_storage_ref"),
        "snapshot_metadata": metadata,
    }


def _normalized_import_text(value: str) -> str:
    return " ".join(value.split())


def _create_import_snapshot(
    session: Session,
    *,
    source: Source,
    raw_text: str,
    content_type: str,
    title: str | None = None,
    metadata: dict[str, Any] | None = None,
    batch_id: str | None = None,
) -> Snapshot:
    cleaned_text = _normalized_import_text(raw_text)
    content_hash = hashlib.sha256(cleaned_text.encode("utf-8")).hexdigest()
    source_public_id = source.public_id or stable_source_public_id(source.canonical_url)
    snapshot_public_id = stable_snapshot_public_id(source_public_id, content_hash)
    existing = session.scalar(select(Snapshot).where(Snapshot.public_id == snapshot_public_id))
    if existing is not None:
        return existing

    snapshot = Snapshot(
        public_id=snapshot_public_id,
        source_id=source.id,
        content_hash=content_hash,
        extraction_status="provided",
        raw_text=raw_text,
        cleaned_text=cleaned_text,
        artifact_metadata={
            **(metadata or {}),
            "content_type": content_type,
            "title": title or source.title,
            "source_import_batch": batch_id,
        },
    )
    session.add(snapshot)
    session.flush()
    return snapshot


def import_source_batch_response(
    session: Session,
    *,
    batch_id: str | None = None,
    sources: list[dict[str, Any]],
) -> dict[str, Any]:
    if source_index_client_configured():
        return SourceIndexClient().import_source_batch(batch_id=batch_id, sources=sources)

    resolved_batch_id = batch_id or f"manual-import-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    for index, item in enumerate(sources, start=1):
        row_warnings: list[str] = []
        source = upsert_indexed_source(
            session,
            url=str(item.get("url") or ""),
            title=item.get("title"),
            source_type=item.get("source_type") or item.get("sourceType"),
            license=str(item.get("license") or "unknown"),
            is_free=bool(item.get("is_free", item.get("isFree", True))),
        )
        raw_text = str(item.get("raw_text") or item.get("rawText") or "").strip()
        snapshot = None
        if raw_text:
            snapshot = _create_import_snapshot(
                session,
                source=source,
                raw_text=raw_text,
                content_type=str(item.get("content_type") or item.get("contentType") or "text/plain"),
                title=item.get("title"),
                metadata=item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
                batch_id=resolved_batch_id,
            )
        else:
            row_warnings.append("No raw_text provided; source was indexed without a snapshot.")

        rows.append(
            {
                "original_index": index,
                "source": source_payload(source),
                "snapshot": snapshot_payload(snapshot, source) if snapshot else None,
                "created_snapshot": bool(snapshot),
                "warnings": row_warnings,
            }
        )

    if not sources:
        warnings.append("Import batch contained no sources.")
    session.commit()
    return {
        "contract_version": SOURCE_IMPORT_BATCH_CONTRACT_VERSION,
        "batch_id": resolved_batch_id,
        "submitted_count": len(sources),
        "imported_count": len(rows),
        "snapshot_count": len([row for row in rows if row["snapshot"]]),
        "sources": rows,
        "warnings": warnings,
    }


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
            for source in SourceIndexClient().list_sources(query=query, domain=domain, source_type=source_type, limit=limit)
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


def create_source_packet_response(
    session: Session,
    *,
    consumer: str,
    context_id: str,
    prompt: str,
    source_urls: list[str],
    fetch_sources: bool = True,
    source_documents: list[dict[str, Any]] | None = None,
    snapshot_limit: int = 1,
) -> dict[str, Any]:
    if source_index_client_configured():
        return SourceIndexClient().create_source_packet(
            consumer=consumer,
            context_id=context_id,
            prompt=prompt,
            source_urls=source_urls,
            fetch_sources=fetch_sources,
            source_documents=source_documents,
            snapshot_limit=snapshot_limit,
        )

    preflight = compile_source_corpus_preflight(
        prompt=prompt,
        source_urls=source_urls,
        fetch_sources=fetch_sources,
        source_documents=source_documents,
    )
    run = persist_source_corpus_run(
        session,
        consumer=consumer,
        context_id=context_id,
        prompt=prompt,
        source_urls=source_urls,
        synthesis=preflight.synthesis,
    )
    session.commit()
    session.refresh(run)

    documents_by_url = {str(document.get("url") or ""): document for document in preflight.source_documents}
    packet_sources: list[dict[str, Any]] = []
    packet_documents: list[dict[str, Any]] = []
    for decision in run.decisions:
        if decision.decision != "included":
            continue
        source = decision.source or session.get(Source, decision.source_id)
        if source is None:
            continue
        source_public_id = source.public_id or stable_source_public_id(source.canonical_url)
        document = documents_by_url.get(decision.original_url) or documents_by_url.get(source.canonical_url)
        snapshots = []
        if snapshot_limit > 0:
            snapshots = list(
                session.scalars(
                    select(Snapshot)
                    .where(Snapshot.source_id == source.id)
                    .order_by(Snapshot.fetched_at.desc(), Snapshot.id.desc())
                    .limit(snapshot_limit)
                )
            )
        source_document = None
        snapshot_payloads = [snapshot_payload(snapshot, source) for snapshot in snapshots]
        if snapshots:
            snapshot = snapshots[0]
            source_document = {
                "url": source.canonical_url,
                "contentType": snapshot_payloads[0].get("content_type") or "text/plain",
                "text": snapshot.cleaned_text or snapshot.raw_text,
                "sourceId": source_public_id,
                "snapshotId": snapshot_payloads[0].get("public_id"),
                "title": source.title or snapshot_payloads[0].get("title"),
                "sourceIndexRef": {
                    "service": "lycium-api-transitional-index",
                    "sourcePublicId": source_public_id,
                    "snapshotPublicId": snapshot_payloads[0].get("public_id"),
                    "sourceLocalId": source.id,
                    "snapshotLocalId": snapshot.id,
                },
            }
        if document and str(document.get("text") or document.get("rawText") or document.get("content") or "").strip():
            source_document = {
                "url": source.canonical_url,
                "contentType": document.get("contentType") or document.get("content_type") or "text/plain",
                "text": document.get("text") or document.get("rawText") or document.get("content") or "",
                "sourceId": source_public_id,
                "snapshotId": None,
                "title": source.title or document.get("title"),
                "sourceIndexRef": {
                    "service": "lycium-api-transitional-index",
                    "sourcePublicId": source_public_id,
                    "snapshotPublicId": None,
                    "sourceLocalId": source.id,
                    "snapshotLocalId": None,
                },
            }
            packet_documents.append(source_document)
        elif source_document is not None:
            packet_documents.append(source_document)
        packet_sources.append(
            {
                "source": source_payload(source),
                "decision": source_decision_payload(decision),
                "snapshots": snapshot_payloads,
                "evidence_refs": [source_public_id, *[str(snapshot.get("public_id")) for snapshot in snapshot_payloads if snapshot.get("public_id")]],
                "source_document": source_document,
            }
        )

    warnings = []
    if packet_sources and not packet_documents:
        warnings.append("Packet has included sources but no extracted source documents.")
    return {
        "contract_version": SOURCE_PACKET_CONTRACT_VERSION,
        "consumer": run.consumer,
        "context_id": run.context_id,
        "prompt": run.prompt,
        "source_urls": [str(source["source"]["canonical_url"]) for source in packet_sources],
        "corpus_run": corpus_run_payload(run),
        "sources": packet_sources,
        "source_documents": packet_documents,
        "synthesis": preflight.synthesis,
        "warnings": warnings,
    }


def get_source_corpus_run_response(session: Session, *, run_id: int) -> dict[str, Any] | None:
    if source_index_client_configured():
        return SourceIndexClient().get_corpus_run(run_id)
    run = session.get(SourceCorpusRun, run_id)
    return corpus_run_payload(run) if run else None


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
