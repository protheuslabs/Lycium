from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
import tempfile
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Callable

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional fast path may be absent in minimal installs.
    PdfReader = None  # type: ignore[assignment]


NORMALIZED_DOCUMENT_CONTRACT_VERSION = "normalized-document-v1"
EVIDENCE_CHUNK_CONTRACT_VERSION = "evidence-chunk-v1"
SOURCE_CITATION_CONTRACT_VERSION = "source-citation-v1"
SOURCE_REGISTRATION_CANDIDATE_CONTRACT_VERSION = "source-registration-candidate-v1"
SOURCE_EXTRACTION_RUN_CONTRACT_VERSION = "source-extraction-run-v1"
EXTERNAL_EXTRACTOR_NAME = "external-source-extractor"
DOCLING_WRAPPER_NAME = "lycium-docling-wrapper"
DOCLING_WRAPPER_VERSION = "docling-wrapper-v1"

MAX_EXTRACTED_TEXT_CHARS = 240_000
MAX_EVIDENCE_CHUNK_CHARS = 12_000
TEXT_SOURCE_KINDS = {"text", "txt", "markdown", "md", "transcript"}
TEXT_MIME_PREFIXES = ("text/",)


class ExtractionError(RuntimeError):
    pass


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compact_whitespace(value: str) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", value).strip()


def decode_base64(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except ValueError:
        return base64.b64decode(value)


def payload_bytes(payload: dict[str, Any]) -> bytes:
    if payload.get("base64"):
        return decode_base64(str(payload["base64"]))
    return str(payload.get("text") or payload.get("content") or "").encode("utf-8")


def kind_from_filename(filename: str, fallback: str | None = None) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix == ".txt":
        return "text"
    if suffix in {".md", ".markdown"}:
        return "markdown"
    if suffix in {".html", ".htm"}:
        return "html"
    if suffix in {".docx", ".doc", ".odt"}:
        return "document"
    if suffix in {".pptx", ".ppt", ".odp"}:
        return "slides"
    if suffix in {".xlsx", ".xls", ".ods", ".csv"}:
        return "spreadsheet"
    if suffix in {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}:
        return "image"
    return str(fallback or "unknown").lower()


def source_document_url(document_id: str) -> str:
    return f"artifact://{document_id}"


def source_ref_for_hash(content_hash: str) -> str:
    return f"file:sha256:{content_hash}"


def document_id_for_payload(payload: dict[str, Any], content_hash: str) -> str:
    explicit = str(payload.get("id") or payload.get("artifactId") or "").strip()
    return explicit or f"file-{content_hash[:16]}"


def read_text(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)[:MAX_EXTRACTED_TEXT_CHARS], warnings
        except UnicodeDecodeError:
            continue
    warnings.append("text_decode_fallback_used")
    return data.decode("utf-8", errors="replace")[:MAX_EXTRACTED_TEXT_CHARS], warnings


def read_pdf_text(data: bytes) -> tuple[str, list[str]]:
    if PdfReader is None:
        return "", ["pypdf_unavailable"]
    try:
        reader = PdfReader(BytesIO(data))
    except Exception as exc:
        return "", [f"pypdf_extract_failed:{str(exc)[:120]}"]

    warnings: list[str] = []
    chunks: list[str] = []
    total_chars = 0
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            page_text = str(page.extract_text() or "").strip()
        except Exception:
            warnings.append(f"pypdf_page_{page_number}_extract_failed")
            continue
        if not page_text:
            continue
        remaining = MAX_EXTRACTED_TEXT_CHARS - total_chars
        if remaining <= 0:
            warnings.append("text_truncated")
            break
        chunks.append(page_text[:remaining])
        total_chars += len(chunks[-1])
        if total_chars >= MAX_EXTRACTED_TEXT_CHARS:
            warnings.append("text_truncated")
            break

    text = "\n\n".join(chunks)
    if not text.strip():
        warnings.append("pypdf_text_empty_or_scanned")
    return text, warnings


def docling_converter(*, ocr_enabled: bool = False) -> Any:
    try:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        from docling.document_converter import DocumentConverter, ImageFormatOption, PdfFormatOption
    except ImportError as exc:
        raise ExtractionError("docling_unavailable") from exc

    pdf_options = PdfPipelineOptions()
    pdf_options.do_ocr = ocr_enabled
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_options),
            InputFormat.IMAGE: ImageFormatOption(pipeline_options=pdf_options),
        }
    )


def export_docling_text(document: Any) -> str:
    if hasattr(document, "export_to_markdown"):
        return str(document.export_to_markdown() or "")
    if hasattr(document, "export_to_text"):
        return str(document.export_to_text() or "")
    return str(document or "")


def convert_with_docling(
    data: bytes,
    *,
    filename: str,
    ocr_enabled: bool = False,
    converter_factory: Callable[[], Any] | None = None,
) -> tuple[str, list[str]]:
    suffix = Path(filename).suffix or ".bin"
    with tempfile.TemporaryDirectory(prefix="lycium-docling-") as temp_dir:
        source_path = Path(temp_dir) / f"source{suffix}"
        source_path.write_bytes(data)
        try:
            converter = (
                converter_factory()
                if converter_factory is not None
                else docling_converter(ocr_enabled=ocr_enabled)
            )
            result = converter.convert(str(source_path))
        except ExtractionError:
            raise
        except Exception as exc:
            raise ExtractionError(f"docling_extract_failed:{str(exc)[:160]}") from exc

    document = getattr(result, "document", None)
    if document is None:
        raise ExtractionError("docling_no_document")
    return export_docling_text(document)[:MAX_EXTRACTED_TEXT_CHARS], []


def chunk_text(text: str, *, max_chars: int = MAX_EVIDENCE_CHUNK_CHARS) -> list[str]:
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


def evidence_chunks(
    *,
    document_id: str,
    source_ref: str,
    content_hash: str,
    title: str,
    filename: str,
    source_url: str,
    text: str,
) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for chunk_index, chunk in enumerate(chunk_text(text), start=1):
        citation = {
            "contractVersion": SOURCE_CITATION_CONTRACT_VERSION,
            "title": title,
            "filename": filename,
            "sourceRef": source_ref,
        }
        if source_url:
            citation["url"] = source_url
        chunks.append(
            {
                "contractVersion": EVIDENCE_CHUNK_CONTRACT_VERSION,
                "chunkId": f"{document_id}-chunk-{chunk_index}",
                "documentId": document_id,
                "sourceRef": source_ref,
                "heading": title,
                "text": compact_whitespace(chunk),
                "location": {"chunkIndex": chunk_index, "sectionIndex": chunk_index},
                "citation": citation,
                "contentHash": sha256_hex(chunk.encode("utf-8")),
                "snapshotContentHash": content_hash,
            }
        )
    return chunks


def source_registration_candidate_from_document(document: dict[str, Any]) -> dict[str, Any]:
    evidence = document.get("evidence") if isinstance(document.get("evidence"), list) else []
    return {
        "contractVersion": SOURCE_REGISTRATION_CANDIDATE_CONTRACT_VERSION,
        "sourceRef": document.get("source", {}).get("sourceRef"),
        "documentId": document.get("documentId"),
        "normalizedDocumentContract": document.get("contractVersion"),
        "source": document.get("source") if isinstance(document.get("source"), dict) else {},
        "snapshot": document.get("snapshot") if isinstance(document.get("snapshot"), dict) else {},
        "citation": document.get("citation") if isinstance(document.get("citation"), dict) else {},
        "evidenceChunkCount": len(evidence),
        "handoffPolicy": {
            "registrationRequiredForGeneration": False,
            "sourceIndexMayCanonicalize": True,
            "sourceIndexShouldNotReExtract": True,
        },
    }


def extract_file(
    file_payload: dict[str, Any],
    *,
    index: int = 1,
    ocr_enabled: bool = False,
    converter_factory: Callable[[], Any] | None = None,
) -> dict[str, Any]:
    filename = str(file_payload.get("filename") or file_payload.get("name") or f"input-file-{index}").strip()
    mime_type = str(file_payload.get("mimeType") or file_payload.get("mime_type") or "").strip()
    kind = kind_from_filename(filename, str(file_payload.get("kind") or file_payload.get("type") or ""))
    title = str(file_payload.get("title") or filename).strip()
    source_url = str(file_payload.get("sourceUrl") or file_payload.get("source_url") or file_payload.get("url") or "").strip()
    data = payload_bytes(file_payload)
    content_hash = sha256_hex(data)
    document_id = document_id_for_payload(file_payload, content_hash)
    source_ref = source_ref_for_hash(content_hash)

    adapter = "docling"
    warnings: list[str] = []
    try:
        if kind in TEXT_SOURCE_KINDS or mime_type.startswith(TEXT_MIME_PREFIXES):
            extracted_text, warnings = read_text(data)
            adapter = "plain-text"
        elif kind == "pdf" or mime_type == "application/pdf":
            extracted_text, warnings = read_pdf_text(data)
            adapter = "pypdf"
            if not extracted_text.strip():
                docling_text, docling_warnings = convert_with_docling(
                    data,
                    filename=filename,
                    ocr_enabled=ocr_enabled,
                    converter_factory=converter_factory,
                )
                extracted_text = docling_text
                warnings = [*warnings, *docling_warnings]
                adapter = "docling"
        else:
            extracted_text, warnings = convert_with_docling(
                data,
                filename=filename,
                ocr_enabled=ocr_enabled,
                converter_factory=converter_factory,
            )
    except ExtractionError as exc:
        extracted_text = ""
        warnings = [str(exc)]
        adapter = "docling"

    if not extracted_text.strip() and not warnings:
        warnings = ["docling_text_empty"]
    status = "extracted" if extracted_text.strip() else "failed"
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
        "status": status,
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
        "evidence": evidence_chunks(
            document_id=document_id,
            source_ref=source_ref,
            content_hash=content_hash,
            title=title,
            filename=filename,
            source_url=source_url,
            text=extracted_text,
        ),
        "extractor": {
            "contractVersion": SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
            "name": DOCLING_WRAPPER_NAME,
            "version": DOCLING_WRAPPER_VERSION,
            "adapter": adapter,
            "ocrEnabled": ocr_enabled,
            "replaceableBy": EXTERNAL_EXTRACTOR_NAME,
        },
        "warnings": warnings,
        "extractedAt": utc_timestamp(),
    }


def extract_payload(payload: dict[str, Any], *, converter_factory: Callable[[], Any] | None = None) -> dict[str, Any]:
    files = payload.get("files") if isinstance(payload.get("files"), list) else []
    ocr = payload.get("ocr") if isinstance(payload.get("ocr"), dict) else {}
    ocr_enabled = bool(ocr.get("enabled"))
    documents = [
        extract_file(
            file_payload,
            index=index,
            ocr_enabled=ocr_enabled,
            converter_factory=converter_factory,
        )
        for index, file_payload in enumerate(files, start=1)
        if isinstance(file_payload, dict)
    ]
    extracted_documents = [document for document in documents if document.get("status") == "extracted"]
    return {
        "contractVersion": SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
        "provider": DOCLING_WRAPPER_NAME,
        "replaceableBy": EXTERNAL_EXTRACTOR_NAME,
        "documentContractVersion": NORMALIZED_DOCUMENT_CONTRACT_VERSION,
        "documentCount": len(documents),
        "extractedDocumentCount": len(extracted_documents),
        "normalizedDocuments": documents,
        "sourceRegistrationCandidates": [
            source_registration_candidate_from_document(document)
            for document in extracted_documents
        ],
        "warnings": [],
        "requestedCapabilities": payload.get("requestedCapabilities") or [],
        "ocr": ocr,
    }


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        if not isinstance(payload, dict):
            raise ValueError("request must be a JSON object")
        result = extract_payload(payload)
    except Exception as exc:
        print(
            json.dumps(
                {
                    "contractVersion": SOURCE_EXTRACTION_RUN_CONTRACT_VERSION,
                    "provider": DOCLING_WRAPPER_NAME,
                    "replaceableBy": EXTERNAL_EXTRACTOR_NAME,
                    "documentContractVersion": NORMALIZED_DOCUMENT_CONTRACT_VERSION,
                    "documentCount": 0,
                    "extractedDocumentCount": 0,
                    "normalizedDocuments": [],
                    "sourceRegistrationCandidates": [],
                    "warnings": [f"wrapper_failed:{str(exc)[:160]}"],
                }
            ),
            file=sys.stdout,
        )
        raise SystemExit(1) from exc
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
