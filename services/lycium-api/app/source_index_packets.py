from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion import canonicalize_url
from app.models import Snapshot, Source, SourceCorpusRun
from app.source_corpus import compile_source_corpus_preflight
from app.source_identity import stable_snapshot_public_id, stable_source_public_id
from app.source_index_packet_quality import _packet_quality
from app.source_index_client import SourceIndexClient, source_index_client_configured
from app.source_index import (
    corpus_run_payload,
    persist_source_corpus_run,
    source_decision_payload,
    source_documents_from_index_snapshots,
    source_payload,
    upsert_indexed_source,
)

SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
SOURCE_IMPORT_BATCH_CONTRACT_VERSION = "source-import-batch-v1"
SOURCE_PACKET_SCHEMA_ID = "https://protheuslabs.github.io/Lycium/schemas/lycium-source-packet.schema.json"
BENCHMARK_SOURCE_TYPES = {
    "catalog",
    "certification",
    "curriculum",
    "employer_profile",
    "open_courseware",
    "program",
    "standard",
    "syllabus",
}
BROKEN_LINK_HEALTH_VALUES = {"broken", "dead", "failed", "unreachable"}
STALE_VERIFICATION_DAYS = 365

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


def _source_packet_id(*, consumer: str, context_id: str, prompt: str, source_urls: list[str]) -> str:
    seed = "\n".join([consumer, context_id, prompt, *sorted(source_urls)])
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]
    return f"source-packet-{digest}"


def _source_packet_producer(service_name: str) -> dict[str, str]:
    return {
        "service": service_name,
        "version": SOURCE_PACKET_CONTRACT_VERSION,
        "schema_id": SOURCE_PACKET_SCHEMA_ID,
    }


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
    if packet_sources and len(packet_documents) < len(packet_sources):
        warnings.append("Packet is missing extracted documents for one or more included sources.")
    quality = _packet_quality(packet_sources, packet_documents, warnings)
    packet_source_urls = [str(source["source"]["canonical_url"]) for source in packet_sources]
    return {
        "contract_version": SOURCE_PACKET_CONTRACT_VERSION,
        "packet_id": _source_packet_id(
            consumer=run.consumer,
            context_id=run.context_id,
            prompt=run.prompt,
            source_urls=packet_source_urls,
        ),
        "generated_at": (run.created_at or datetime.now(UTC)).isoformat(),
        "producer": _source_packet_producer("lycium-api-transitional-index"),
        "consumer": run.consumer,
        "context_id": run.context_id,
        "prompt": run.prompt,
        "source_urls": packet_source_urls,
        "corpus_run": corpus_run_payload(run),
        "sources": packet_sources,
        "source_documents": packet_documents,
        "synthesis": preflight.synthesis,
        "warnings": warnings,
        "quality": quality,
    }


def get_source_packet_response(session: Session, *, packet_id: int | str) -> dict[str, Any] | None:
    if source_index_client_configured():
        return SourceIndexClient().get_source_packet(packet_id)

    try:
        run_id = int(packet_id)
    except (TypeError, ValueError):
        return None

    run = session.get(SourceCorpusRun, run_id)
    if run is None:
        return None
    documents = source_documents_from_index_snapshots(
        session,
        source_urls=[decision.original_url for decision in run.decisions if decision.decision == "included"],
    )
    return create_source_packet_response(
        session,
        consumer=run.consumer,
        context_id=run.context_id,
        prompt=run.prompt,
        source_urls=[decision.original_url for decision in run.decisions],
        fetch_sources=False,
        source_documents=documents,
    )


def get_source_corpus_run_response(session: Session, *, run_id: int) -> dict[str, Any] | None:
    if source_index_client_configured():
        return SourceIndexClient().get_corpus_run(run_id)
    run = session.get(SourceCorpusRun, run_id)
    return corpus_run_payload(run) if run else None
