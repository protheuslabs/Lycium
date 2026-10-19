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
SOURCE_DOCUMENT_MAP_CONTRACT_VERSION = "source-document-map-v1"
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
MAX_DOCUMENT_MAP_ENTRIES = 240
HEADING_PATTERN = re.compile(r"^(?:#{1,6}\s*)?(?P<title>[A-Z0-9][A-Za-z0-9 &:/,.'+#()\-]{2,120})$")
NON_COURSE_MAP_TITLES = {
    "abstract",
    "acknowledgements",
    "acknowledgments",
    "author's note",
    "about the book",
    "bibliography",
    "copyright",
    "contents",
    "dedication",
    "glossary",
    "index",
    "preface",
    "references",
    "support our mission",
    "table of contents",
}


class ExtractionError(RuntimeError):
    pass


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compact_whitespace(value: str) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", value).strip()


def document_map_entry(
    *,
    document_id: str,
    order: int,
    title: str,
    level: int,
    path: list[str],
    source: str,
    page: int | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "id": f"{document_id}-map-{order:03d}",
        "title": compact_whitespace(title),
        "level": max(1, level),
        "order": order,
        "path": path,
        "source": source,
    }
    if page is not None:
        entry["location"] = {"page": page}
    return entry


def empty_document_map(document_id: str, *, source_kind: str, strategy: str) -> dict[str, Any]:
    return {
        "contractVersion": SOURCE_DOCUMENT_MAP_CONTRACT_VERSION,
        "documentId": document_id,
        "sourceKind": source_kind,
        "strategy": strategy,
        "entryCount": 0,
        "maxDepth": 0,
        "entries": [],
        "quality": {"status": "empty", "coursePlanningReady": False},
    }


def document_map_from_entries(
    document_id: str,
    *,
    source_kind: str,
    strategy: str,
    entries: list[dict[str, Any]],
    actual_entry_count: int | None = None,
) -> dict[str, Any]:
    limited_entries = entries[:MAX_DOCUMENT_MAP_ENTRIES]
    max_depth = max((int(entry.get("level") or 0) for entry in limited_entries), default=0)
    top_level_count = len([entry for entry in limited_entries if int(entry.get("level") or 0) == 1])
    entry_count = actual_entry_count if actual_entry_count is not None else len(entries)
    return {
        "contractVersion": SOURCE_DOCUMENT_MAP_CONTRACT_VERSION,
        "documentId": document_id,
        "sourceKind": source_kind,
        "strategy": strategy,
        "entryCount": entry_count,
        "storedEntryCount": len(limited_entries),
        "maxDepth": max_depth,
        "entries": limited_entries,
        "truncated": entry_count > len(limited_entries),
        "quality": {
            "status": "usable" if len(limited_entries) >= 3 else "thin" if limited_entries else "empty",
            "coursePlanningReady": top_level_count >= 3 or len(limited_entries) >= 6,
            "topLevelEntryCount": top_level_count,
        },
    }


def pdf_outline_page(reader: Any, item: Any) -> int | None:
    page_number_fn = getattr(reader, "get_destination_page_number", None)
    if not callable(page_number_fn):
        return None
    try:
        page_number = page_number_fn(item)
    except Exception:
        return None
    try:
        return int(page_number) + 1
    except (TypeError, ValueError):
        return None


def document_map_from_pdf_data(data: bytes, document_id: str, *, source_kind: str) -> dict[str, Any]:
    if PdfReader is None:
        return empty_document_map(document_id, source_kind=source_kind, strategy="pdf_outline")
    try:
        reader = PdfReader(BytesIO(data))
    except Exception:
        return empty_document_map(document_id, source_kind=source_kind, strategy="pdf_outline")
    outline = getattr(reader, "outline", None)
    if not isinstance(outline, list):
        return empty_document_map(document_id, source_kind=source_kind, strategy="pdf_outline")

    entries: list[dict[str, Any]] = []

    def walk(items: list[Any], *, depth: int = 0, parent_path: list[str] | None = None) -> None:
        path_prefix = parent_path or []
        last_path = path_prefix
        for item in items:
            if isinstance(item, list):
                walk(item, depth=depth + 1, parent_path=last_path)
                continue
            title = compact_whitespace(str(getattr(item, "title", None) or item or ""))
            if not title:
                continue
            path = [*path_prefix, title]
            entries.append(
                document_map_entry(
                    document_id=document_id,
                    order=len(entries) + 1,
                    title=title,
                    level=depth + 1,
                    path=path,
                    source="pdf_outline",
                    page=pdf_outline_page(reader, item),
                )
            )
            last_path = path

    walk(outline)
    return document_map_from_entries(
        document_id,
        source_kind=source_kind,
        strategy="pdf_outline",
        entries=entries,
    )


def line_looks_like_heading(line: str) -> bool:
    clean = compact_whitespace(line.strip("# "))
    if not clean or len(clean) > 120:
        return False
    lowered = clean.lower().strip(" .:")
    if lowered in NON_COURSE_MAP_TITLES:
        return False
    if clean.endswith((".", "?", "!")):
        return False
    if re.search(r"\b(?:https?://|www\.)", clean, flags=re.IGNORECASE):
        return False
    return bool(HEADING_PATTERN.match(clean)) and len(clean.split()) <= 14


def document_map_from_text(text: str, document_id: str, *, source_kind: str) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    current_path: list[str] = []
    for line in text.splitlines():
        raw = line.strip()
        if not raw:
            continue
        markdown_match = re.match(r"^(#{1,6})\s+(.+)$", raw)
        if markdown_match:
            level = len(markdown_match.group(1))
            title = compact_whitespace(markdown_match.group(2).strip())
        else:
            if not line_looks_like_heading(raw):
                continue
            level = 1
            title = compact_whitespace(raw)
        if not title:
            continue
        current_path = [*current_path[: level - 1], title]
        entries.append(
            document_map_entry(
                document_id=document_id,
                order=len(entries) + 1,
                title=title,
                level=level,
                path=current_path,
                source="text_headings",
            )
        )
        if len(entries) >= MAX_DOCUMENT_MAP_ENTRIES:
            break
    return document_map_from_entries(
        document_id,
        source_kind=source_kind,
        strategy="text_headings",
        entries=entries,
    )


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
    document_map = document.get("documentMap") if isinstance(document.get("documentMap"), dict) else {}
    candidate = {
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
    if document_map:
        candidate["documentMap"] = {
            "contractVersion": document_map.get("contractVersion"),
            "strategy": document_map.get("strategy"),
            "entryCount": document_map.get("entryCount") or 0,
            "storedEntryCount": document_map.get("storedEntryCount") or len(document_map.get("entries", []))
            if isinstance(document_map.get("entries"), list)
            else 0,
            "coursePlanningReady": (
                document_map.get("quality", {}).get("coursePlanningReady")
                if isinstance(document_map.get("quality"), dict)
                else False
            ),
        }
    return candidate


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
    document_map = empty_document_map(document_id, source_kind=kind or "unknown", strategy="none")
    try:
        if kind in TEXT_SOURCE_KINDS or mime_type.startswith(TEXT_MIME_PREFIXES):
            extracted_text, warnings = read_text(data)
            adapter = "plain-text"
            document_map = document_map_from_text(extracted_text, document_id, source_kind=kind or "text")
        elif kind == "pdf" or mime_type == "application/pdf":
            extracted_text, warnings = read_pdf_text(data)
            adapter = "pypdf"
            document_map = document_map_from_pdf_data(data, document_id, source_kind=kind or "pdf")
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
                document_map = document_map_from_text(extracted_text, document_id, source_kind=kind or "pdf")
            elif not document_map.get("entries"):
                document_map = document_map_from_text(extracted_text, document_id, source_kind=kind or "pdf")
        else:
            extracted_text, warnings = convert_with_docling(
                data,
                filename=filename,
                ocr_enabled=ocr_enabled,
                converter_factory=converter_factory,
            )
            document_map = document_map_from_text(extracted_text, document_id, source_kind=kind or "document")
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
        "documentMap": document_map,
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
