from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from source_index.corpus import compile_source_corpus_preflight
from source_index.identity import stable_snapshot_public_id, stable_source_public_id
from source_index.models import IndexedSource, SourceCorpusRun, SourceSnapshot
from source_index.packet_quality import _packet_quality
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
SOURCE_PACKET_IMPORT_REPORT_VERSION = "source-packet-import-report-v1"
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


def validate_source_packet(packet: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    if packet.get("contract_version") != SOURCE_PACKET_CONTRACT_VERSION:
        errors.append("Packet contract_version must be source-packet-v1.")
    packet_id = str(packet.get("packet_id") or "").strip()
    if not packet_id:
        errors.append("Packet packet_id is required.")
    producer = packet.get("producer")
    if not isinstance(producer, dict) or not str(producer.get("service") or "").strip():
        errors.append("Packet producer.service is required.")
    if not str(packet.get("consumer") or "").strip():
        errors.append("Packet consumer is required.")
    if not str(packet.get("context_id") or "").strip():
        errors.append("Packet context_id is required.")
    if not str(packet.get("prompt") or "").strip():
        warnings.append("Packet prompt is empty; downstream relevance checks may be weak.")
    sources = packet.get("sources")
    documents = packet.get("source_documents")
    if not isinstance(sources, list):
        errors.append("Packet sources must be an array.")
        sources = []
    if not isinstance(documents, list):
        errors.append("Packet source_documents must be an array.")
        documents = []
    for index, item in enumerate(sources, start=1):
        if not isinstance(item, dict):
            errors.append(f"Packet source {index} must be an object.")
            continue
        source = item.get("source")
        if not isinstance(source, dict) or not str(source.get("canonical_url") or "").strip():
            errors.append(f"Packet source {index} is missing source.canonical_url.")
        if not isinstance(item.get("decision"), dict):
            errors.append(f"Packet source {index} is missing a decision object.")
        if not isinstance(item.get("evidence_refs"), list):
            errors.append(f"Packet source {index} is missing evidence_refs.")
    return {
        "valid": not errors,
        "packet_id": packet_id,
        "source_count": len(sources),
        "source_document_count": len(documents),
        "errors": errors,
        "warnings": warnings,
    }


def import_source_packet(
    session: Session,
    *,
    packet: dict[str, Any],
    import_snapshots: bool = True,
    dry_run: bool = False,
) -> dict[str, Any]:
    validation = validate_source_packet(packet)
    imported_sources = 0
    imported_snapshots = 0
    source_refs: list[dict[str, Any]] = []
    warnings = list(validation["warnings"])

    if validation["valid"] and not dry_run:
        for item in packet.get("sources", []):
            source_data = item.get("source") if isinstance(item, dict) else None
            if not isinstance(source_data, dict):
                continue
            source = upsert_source(
                session,
                url=str(source_data.get("canonical_url") or ""),
                title=source_data.get("title"),
                source_type=source_data.get("source_type"),
                license=str(source_data.get("license") or "unknown"),
                is_free=bool(source_data.get("is_free", True)),
            )
            imported_sources += 1
            snapshot_refs: list[dict[str, Any]] = []
            if import_snapshots:
                for snapshot_data in item.get("snapshots", []):
                    if not isinstance(snapshot_data, dict):
                        continue
                    raw_text = str(snapshot_data.get("extracted_text") or "").strip()
                    if not raw_text:
                        warnings.append(f"Source {source.canonical_url} has a snapshot without extracted_text.")
                        continue
                    snapshot = create_source_snapshot(
                        session,
                        source_id=source.id,
                        fetch=False,
                        raw_text=raw_text,
                        content_type=snapshot_data.get("content_type") or "text/plain",
                        title=snapshot_data.get("title") or source.title,
                        raw_storage_ref=snapshot_data.get("raw_storage_ref"),
                        snapshot_metadata={
                            **(snapshot_data.get("snapshot_metadata") if isinstance(snapshot_data.get("snapshot_metadata"), dict) else {}),
                            "imported_from_packet_id": validation["packet_id"],
                        },
                    )
                    imported_snapshots += 1
                    snapshot_refs.append(snapshot_payload(snapshot))
            source_refs.append({"source": source_payload(source), "snapshots": snapshot_refs})

    return {
        "contract_version": SOURCE_PACKET_IMPORT_REPORT_VERSION,
        "packet_id": validation["packet_id"],
        "valid": validation["valid"],
        "dry_run": dry_run,
        "import_snapshots": import_snapshots,
        "source_count": validation["source_count"],
        "source_document_count": validation["source_document_count"],
        "imported_source_count": imported_sources,
        "imported_snapshot_count": imported_snapshots,
        "source_refs": source_refs,
        "errors": validation["errors"],
        "warnings": warnings,
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
        "packet_id": _source_packet_id(
            consumer=run.consumer,
            context_id=run.context_id,
            prompt=run.prompt,
            source_urls=[str(source.get("source", {}).get("canonical_url") or "") for source in packet_sources],
        ),
        "generated_at": (run.created_at or datetime.now(UTC)).isoformat(),
        "producer": _source_packet_producer(service_name),
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
