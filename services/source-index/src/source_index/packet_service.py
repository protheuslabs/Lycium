from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from source_index.corpus import compile_source_corpus_preflight
from source_index.identity import stable_snapshot_public_id, stable_source_public_id
from source_index.models import IndexedSource, SourceCorpusRun, SourceSnapshot
from source_index.service import (
    corpus_run_payload,
    create_source_snapshot,
    decision_payload,
    list_source_snapshots,
    persist_corpus_run,
    snapshot_payload,
    source_payload,
    upsert_source,
)

SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
SOURCE_IMPORT_BATCH_CONTRACT_VERSION = "source-import-batch-v1"

def import_source_batch(
    session: Session,
    *,
    sources: list[dict[str, Any]],
    batch_id: str | None = None,
) -> dict[str, Any]:
    resolved_batch_id = batch_id or f"manual-import-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []

    for index, item in enumerate(sources, start=1):
        row_warnings: list[str] = []
        raw_text = str(item.get("raw_text") or item.get("rawText") or "").strip()
        source = upsert_source(
            session,
            url=str(item.get("url") or ""),
            title=item.get("title"),
            source_type=item.get("source_type") or item.get("sourceType"),
            license=str(item.get("license") or "unknown"),
            is_free=bool(item.get("is_free", item.get("isFree", True))),
        )
        snapshot = None
        if raw_text:
            snapshot = create_source_snapshot(
                session,
                source_id=source.id,
                fetch=False,
                raw_text=raw_text,
                content_type=item.get("content_type") or item.get("contentType") or "text/plain",
                title=item.get("title") or source.title,
                snapshot_metadata={
                    **(item.get("metadata") if isinstance(item.get("metadata"), dict) else {}),
                    "source_import_batch": resolved_batch_id,
                },
            )
        else:
            row_warnings.append("No raw_text provided; source was indexed without a snapshot.")

        rows.append(
            {
                "original_index": index,
                "source": source_payload(source),
                "snapshot": snapshot_payload(snapshot) if snapshot else None,
                "created_snapshot": bool(snapshot),
                "warnings": row_warnings,
            }
        )

    if not sources:
        warnings.append("Import batch contained no sources.")

    return {
        "contract_version": SOURCE_IMPORT_BATCH_CONTRACT_VERSION,
        "batch_id": resolved_batch_id,
        "submitted_count": len(sources),
        "imported_count": len(rows),
        "snapshot_count": len([row for row in rows if row["snapshot"]]),
        "sources": rows,
        "warnings": warnings,
    }

def _document_text(document: dict[str, Any]) -> str:
    return str(document.get("text") or document.get("rawText") or document.get("content") or "")


def _document_content_type(document: dict[str, Any]) -> str:
    return str(document.get("contentType") or document.get("content_type") or "text/plain")


def _documents_by_url(documents: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(document.get("url") or ""): document for document in documents if str(document.get("url") or "")}


def _latest_source_snapshots(session: Session, source_id: int, *, limit: int) -> list[SourceSnapshot]:
    if limit <= 0:
        return []
    return list_source_snapshots(session, source_id=source_id, limit=limit)


def _packet_quality(packet_sources: list[dict[str, Any]], packet_documents: list[dict[str, Any]], warnings: list[str]) -> dict[str, Any]:
    source_count = len(packet_sources)
    document_count = len(packet_documents)
    snapshot_count = sum(1 for source in packet_sources if source.get("snapshots"))
    evidence_count = sum(1 for source in packet_sources if source.get("evidence_refs"))
    document_coverage = document_count / source_count if source_count else 0
    snapshot_coverage = snapshot_count / source_count if source_count else 0
    evidence_coverage = evidence_count / source_count if source_count else 0
    if not source_count:
        status = "empty"
    elif document_coverage >= 1 and evidence_coverage >= 1:
        status = "usable"
    else:
        status = "needs_review"
    return {
        "status": status,
        "includedSourceCount": source_count,
        "sourceDocumentCount": document_count,
        "snapshotCoverageRatio": round(snapshot_coverage, 3),
        "documentCoverageRatio": round(document_coverage, 3),
        "evidenceCoverageRatio": round(evidence_coverage, 3),
        "warningCount": len(warnings),
    }


def _snapshot_document(source: IndexedSource, snapshot: SourceSnapshot, *, service_name: str) -> dict[str, Any]:
    source_public_id = source.public_id or stable_source_public_id(source.canonical_url)
    snapshot_public_id = snapshot.public_id or stable_snapshot_public_id(source_public_id, snapshot.content_hash or "")
    return {
        "url": source.canonical_url,
        "contentType": snapshot.content_type or "text/plain",
        "text": snapshot.extracted_text,
        "sourceId": source_public_id,
        "snapshotId": snapshot_public_id,
        "title": source.title or snapshot.title,
        "sourceIndexRef": {
            "service": service_name,
            "sourcePublicId": source_public_id,
            "snapshotPublicId": snapshot_public_id,
            "sourceRemoteId": source.id,
            "snapshotRemoteId": snapshot.id,
        },
    }


def source_packet_payload(
    session: Session,
    *,
    run: SourceCorpusRun,
    source_documents: list[dict[str, Any]] | None = None,
    snapshot_limit: int = 1,
    service_name: str = "source-index",
) -> dict[str, Any]:
    documents_by_url = _documents_by_url(source_documents or [])
    packet_sources: list[dict[str, Any]] = []
    packet_documents: list[dict[str, Any]] = []
    warnings: list[str] = []

    for decision in run.decisions:
        if decision.decision != "included":
            continue
        source = decision.source or session.get(IndexedSource, decision.source_id)
        if source is None:
            warnings.append(f"Included decision {decision.id} has no indexed source.")
            continue

        source_public_id = source.public_id or stable_source_public_id(source.canonical_url)
        document = documents_by_url.get(decision.original_url) or documents_by_url.get(source.canonical_url)
        snapshots = _latest_source_snapshots(session, source.id, limit=snapshot_limit)
        if not snapshots and document is not None and _document_text(document).strip() and snapshot_limit > 0:
            snapshot = create_source_snapshot(
                session,
                source_id=source.id,
                fetch=False,
                raw_text=_document_text(document),
                content_type=_document_content_type(document),
                title=str(document.get("title") or source.title or "") or None,
                snapshot_metadata={"source_packet": run.context_id, "consumer": run.consumer},
            )
            snapshots = [snapshot]

        snapshot_payloads = [snapshot_payload(snapshot) for snapshot in snapshots]
        source_document = _snapshot_document(source, snapshots[0], service_name=service_name) if snapshots else None
        if source_document is None and document is not None and _document_text(document).strip():
            source_document = {
                "url": source.canonical_url,
                "contentType": _document_content_type(document),
                "text": _document_text(document),
                "sourceId": source_public_id,
                "snapshotId": None,
                "title": source.title or document.get("title"),
                "sourceIndexRef": {
                    "service": service_name,
                    "sourcePublicId": source_public_id,
                    "snapshotPublicId": None,
                    "sourceRemoteId": source.id,
                    "snapshotRemoteId": None,
                },
            }

        evidence_refs = [source_public_id]
        if snapshots:
            evidence_refs.append(snapshot_payloads[0].get("public_id") or f"snapshot-{snapshots[0].id}")
        if source_document is not None:
            packet_documents.append(source_document)

        packet_sources.append(
            {
                "source": source_payload(source),
                "decision": decision_payload(decision),
                "snapshots": snapshot_payloads,
                "evidence_refs": evidence_refs,
                "source_document": source_document,
            }
        )

    synthesis = dict(run.payload or {})
    if run.included_source_count and not packet_sources:
        warnings.append("Corpus run included sources, but no packet source records could be assembled.")
    if packet_sources and not packet_documents:
        warnings.append("Packet has included sources but no extracted source documents.")
    if packet_sources and len(packet_documents) < len(packet_sources):
        warnings.append("Packet is missing extracted documents for one or more included sources.")
    quality = _packet_quality(packet_sources, packet_documents, warnings)

    return {
        "contract_version": SOURCE_PACKET_CONTRACT_VERSION,
        "consumer": run.consumer,
        "context_id": run.context_id,
        "prompt": run.prompt,
        "source_urls": [str(source.get("source", {}).get("canonical_url") or "") for source in packet_sources],
        "corpus_run": corpus_run_payload(run),
        "sources": packet_sources,
        "source_documents": packet_documents,
        "synthesis": synthesis,
        "warnings": warnings,
        "quality": quality,
    }


def create_source_packet(
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
    preflight = compile_source_corpus_preflight(
        prompt=prompt,
        source_urls=source_urls,
        fetch_sources=fetch_sources,
        source_documents=source_documents,
    )
    run = persist_corpus_run(
        session,
        consumer=consumer,
        context_id=context_id,
        prompt=prompt,
        source_urls=source_urls,
        synthesis=preflight.synthesis,
    )
    return source_packet_payload(
        session,
        run=run,
        source_documents=preflight.source_documents,
        snapshot_limit=snapshot_limit,
    )
