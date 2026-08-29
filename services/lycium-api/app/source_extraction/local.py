from __future__ import annotations

from io import BytesIO
from typing import Any

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional dependency may be absent in minimal deployments.
    PdfReader = None  # type: ignore[assignment]

from app.source_extraction.contracts import (
    EVIDENCE_CHUNK_CONTRACT_VERSION,
    LOCAL_EXTRACTOR_NAME,
    LOCAL_EXTRACTOR_REPLACEABLE_BY,
    LOCAL_EXTRACTOR_VERSION,
    MAX_EVIDENCE_CHUNK_CHARS,
    MAX_EXTRACTED_TEXT_CHARS,
    NORMALIZED_DOCUMENT_CONTRACT_VERSION,
    SOURCE_CITATION_CONTRACT_VERSION,
    SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
    TEXT_SOURCE_KINDS,
    artifact_id_for_hash,
    compact_whitespace,
    kind_from_filename,
    source_document_url,
    source_ref_for_hash,
    source_registration_candidate_from_document,
    sha256_hex,
    text_from_payload,
    utc_timestamp,
)


def _read_text_bytes(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)[:MAX_EXTRACTED_TEXT_CHARS], warnings
        except UnicodeDecodeError:
            continue
    warnings.append("text_decode_fallback_used")
    return data.decode("utf-8", errors="replace")[:MAX_EXTRACTED_TEXT_CHARS], warnings


def _read_pdf_pages(data: bytes) -> tuple[list[tuple[int, str]], list[str]]:
    warnings: list[str] = []
    if PdfReader is None:
        return [], ["pdf_reader_unavailable"]
    try:
        reader = PdfReader(BytesIO(data))
    except Exception as exc:
        return [], [f"pdf_extract_failed:{str(exc)[:120]}"]

    pages: list[tuple[int, str]] = []
    total_chars = 0
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            page_text = str(page.extract_text() or "").strip()
        except Exception:
            warnings.append(f"pdf_page_{page_number}_extract_failed")
            continue
        if not page_text:
            continue
        remaining = MAX_EXTRACTED_TEXT_CHARS - total_chars
        if remaining <= 0:
            warnings.append("text_truncated")
            break
        page_text = page_text[:remaining]
        total_chars += len(page_text)
        pages.append((page_number, page_text))
        if total_chars >= MAX_EXTRACTED_TEXT_CHARS:
            warnings.append("text_truncated")
            break

    if not pages:
        warnings.append("pdf_text_empty_or_scanned")
    return pages, warnings


def _chunk_text(text: str, *, max_chars: int = MAX_EVIDENCE_CHUNK_CHARS) -> list[str]:
    clean = text.strip()
    if not clean:
        return []

    chunks: list[str] = []
    current = ""
    paragraphs = [paragraph.strip() for paragraph in clean.split("\n\n") if paragraph.strip()] or [clean]
    for paragraph in paragraphs:
        if len(paragraph) > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
            chunks.extend(paragraph[index : index + max_chars].strip() for index in range(0, len(paragraph), max_chars))
            continue
        candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
        if len(candidate) > max_chars:
            chunks.append(current.strip())
            current = paragraph
        else:
            current = candidate
    if current:
        chunks.append(current.strip())
    return [chunk for chunk in chunks if chunk]


def _evidence_chunks(
    *,
    document_id: str,
    source_ref: str,
    content_hash: str,
    title: str,
    filename: str,
    source_url: str,
    pages: list[tuple[int | None, str]],
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for page_number, page_text in pages:
        for page_chunk_index, chunk_text in enumerate(_chunk_text(page_text), start=1):
            chunk_hash = sha256_hex(chunk_text.encode("utf-8"))
            location: dict[str, Any] = {"chunkIndex": len(chunks) + 1}
            heading = title
            if page_number is not None:
                location["page"] = page_number
                location["pageChunkIndex"] = page_chunk_index
                heading = f"Page {page_number}"
            else:
                location["sectionIndex"] = page_chunk_index
            citation = {
                "contractVersion": SOURCE_CITATION_CONTRACT_VERSION,
                "title": title,
                "filename": filename,
                "sourceRef": source_ref,
            }
            if source_url:
                citation["url"] = source_url
            if page_number is not None:
                citation["page"] = page_number
            chunks.append(
                {
                    "contractVersion": EVIDENCE_CHUNK_CONTRACT_VERSION,
                    "chunkId": f"{document_id}-chunk-{len(chunks) + 1}",
                    "documentId": document_id,
                    "sourceRef": source_ref,
                    "heading": heading,
                    "text": compact_whitespace(chunk_text),
                    "location": location,
                    "citation": citation,
                    "contentHash": chunk_hash,
                    "snapshotContentHash": content_hash,
                }
            )
    return chunks


def _normalized_document_status(text: str, warnings: list[str]) -> str:
    if text.strip():
        return "extracted"
    if warnings and warnings[0].startswith("unsupported"):
        return "unsupported"
    return "failed"


def extract_source_file(file_payload: dict[str, Any], *, index: int = 1) -> dict[str, Any]:
    filename = str(file_payload.get("filename") or file_payload.get("name") or f"input-file-{index}").strip()
    mime_type = str(file_payload.get("mimeType") or file_payload.get("mime_type") or "").strip()
    kind = kind_from_filename(filename, str(file_payload.get("kind") or file_payload.get("type") or ""))
    title = str(file_payload.get("title") or filename).strip()
    source_url = str(file_payload.get("sourceUrl") or file_payload.get("source_url") or file_payload.get("url") or "").strip()
    data = text_from_payload(file_payload)
    content_hash = sha256_hex(data)
    document_id = artifact_id_for_hash(file_payload, content_hash, index=index)
    source_ref = source_ref_for_hash(content_hash)

    if kind == "pdf" or mime_type == "application/pdf":
        pdf_pages, warnings = _read_pdf_pages(data)
        pages: list[tuple[int | None, str]] = [(page_number, text) for page_number, text in pdf_pages]
        extracted_text = "\n\n".join(text for _page_number, text in pages)[:MAX_EXTRACTED_TEXT_CHARS]
        adapter = "pypdf"
    elif kind in TEXT_SOURCE_KINDS or mime_type.startswith("text/"):
        extracted_text, warnings = _read_text_bytes(data)
        pages = [(None, extracted_text)]
        adapter = "plain-text"
    else:
        warnings = [f"unsupported_file_kind:{kind or 'unknown'}"]
        extracted_text = ""
        pages = []
        adapter = "unsupported"

    evidence = _evidence_chunks(
        document_id=document_id,
        source_ref=source_ref,
        content_hash=content_hash,
        title=title,
        filename=filename,
        source_url=source_url,
        pages=pages,
    )
    extraction_status = _normalized_document_status(extracted_text, warnings)
    citation = {
        "contractVersion": SOURCE_CITATION_CONTRACT_VERSION,
        "title": title,
        "filename": filename,
        "sourceRef": source_ref,
    }
    if source_url:
        citation["url"] = source_url

    return {
        "contractVersion": NORMALIZED_DOCUMENT_CONTRACT_VERSION,
        "documentId": document_id,
        "status": extraction_status,
        "source": {
            "sourceRef": source_ref,
            "title": title,
            "locator": {
                "type": "uploaded_file",
                "kind": kind,
                "filename": filename,
                "mimeType": mime_type,
                "sourceUrl": source_url or None,
                "sourceDocumentUrl": source_document_url(document_id),
            },
        },
        "snapshot": {
            "contentHash": content_hash,
            "mimeType": mime_type,
            "byteLength": len(data),
            "textLength": len(extracted_text),
        },
        "citation": citation,
        "evidence": evidence,
        "extractor": {
            "contractVersion": SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
            "name": LOCAL_EXTRACTOR_NAME,
            "version": LOCAL_EXTRACTOR_VERSION,
            "adapter": adapter,
            "replaceableBy": LOCAL_EXTRACTOR_REPLACEABLE_BY,
        },
        "warnings": warnings,
        "extractedAt": utc_timestamp(),
    }


def extract_source_files(files: list[dict[str, Any]] | None) -> dict[str, Any]:
    documents = [
        extract_source_file(file_payload, index=index)
        for index, file_payload in enumerate(files or [], start=1)
        if isinstance(file_payload, dict)
    ]
    extracted_documents = [document for document in documents if document.get("status") == "extracted"]
    return {
        "contractVersion": SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
        "provider": "lycium-local",
        "replaceableBy": LOCAL_EXTRACTOR_REPLACEABLE_BY,
        "documentContractVersion": NORMALIZED_DOCUMENT_CONTRACT_VERSION,
        "documentCount": len(documents),
        "extractedDocumentCount": len(extracted_documents),
        "normalizedDocuments": documents,
        "sourceRegistrationCandidates": [
            source_registration_candidate_from_document(document)
            for document in extracted_documents
        ],
    }
