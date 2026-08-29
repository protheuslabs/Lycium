from __future__ import annotations

from typing import Any

from app.source_extraction.contracts import NORMALIZED_DOCUMENT_CONTRACT_VERSION, source_document_url


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _document_text(document: dict[str, Any]) -> str:
    chunks = [
        str(chunk.get("text") or "").strip()
        for chunk in _items(document.get("evidence"))
        if str(chunk.get("text") or "").strip()
    ]
    return "\n\n".join(chunks)


def _source_locator(document: dict[str, Any]) -> dict[str, Any]:
    source = document.get("source") if isinstance(document.get("source"), dict) else {}
    locator = source.get("locator") if isinstance(source.get("locator"), dict) else {}
    return locator


def _source_title(document: dict[str, Any]) -> str:
    source = document.get("source") if isinstance(document.get("source"), dict) else {}
    citation = document.get("citation") if isinstance(document.get("citation"), dict) else {}
    return str(source.get("title") or citation.get("title") or document.get("documentId") or "Direct source").strip()


def _content_type(document: dict[str, Any]) -> str:
    snapshot = document.get("snapshot") if isinstance(document.get("snapshot"), dict) else {}
    locator = _source_locator(document)
    return str(snapshot.get("mimeType") or locator.get("mimeType") or "text/plain").strip() or "text/plain"


def source_documents_from_normalized_documents(normalized_documents: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for document in normalized_documents or []:
        if not isinstance(document, dict):
            continue
        if document.get("contractVersion") != NORMALIZED_DOCUMENT_CONTRACT_VERSION:
            continue
        if document.get("status") != "extracted":
            continue
        text = _document_text(document)
        if not text:
            continue
        document_id = str(document.get("documentId") or "").strip()
        locator = _source_locator(document)
        citation = document.get("citation") if isinstance(document.get("citation"), dict) else {}
        snapshot = document.get("snapshot") if isinstance(document.get("snapshot"), dict) else {}
        source = document.get("source") if isinstance(document.get("source"), dict) else {}
        source_ref = str(source.get("sourceRef") or citation.get("sourceRef") or "").strip()
        url = str(locator.get("sourceUrl") or citation.get("url") or "").strip() or source_document_url(document_id)
        documents.append(
            {
                "url": url,
                "title": _source_title(document),
                "text": text,
                "contentType": _content_type(document),
                "fetchStatus": "provided",
                "inputArtifactId": document_id,
                "inputArtifactKind": str(locator.get("kind") or "document"),
                "inputArtifactOrigin": str(locator.get("type") or "uploaded_file"),
                "sourceType": "direct_evidence",
                "sourceRef": source_ref,
                "normalizedDocumentId": document_id,
                "directEvidenceRef": source_ref,
                "evidenceChunks": _items(document.get("evidence")),
                "citation": citation,
                "snapshot": snapshot,
                "extractor": document.get("extractor") if isinstance(document.get("extractor"), dict) else {},
            }
        )
    return documents
