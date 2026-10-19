from __future__ import annotations

import re
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
    SOURCE_DOCUMENT_MAP_CONTRACT_VERSION,
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


MAX_DOCUMENT_MAP_ENTRIES = 240
HEADING_PATTERN = re.compile(r"^(?:#{1,6}\s*)?(?P<title>[A-Z0-9][A-Za-z0-9 &:/,.'+#()\\-]{2,120})$")
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
NON_COURSE_MAP_TITLE_PARTS = (
    "socratiq ai",
    "ai learning companion",
    "online ai learning companion",
    "listen to the ai podcast",
    "want to help out",
    "join the community",
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


def _document_map_entry(
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


def _empty_document_map(document_id: str, *, source_kind: str, strategy: str) -> dict[str, Any]:
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


def _document_map_from_entries(
    document_id: str,
    *,
    source_kind: str,
    strategy: str,
    entries: list[dict[str, Any]],
    actual_entry_count: int | None = None,
) -> dict[str, Any]:
    limited_entries = _compact_document_map_entries(entries)
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
        "coursePlanningEntries": [
            entry for entry in limited_entries if _document_map_entry_role(entry) == "main_content"
        ],
        "truncated": entry_count > len(limited_entries),
        "quality": {
            "status": "usable" if len(limited_entries) >= 3 else "thin" if limited_entries else "empty",
            "coursePlanningReady": top_level_count >= 3 or len(limited_entries) >= 6,
            "topLevelEntryCount": top_level_count,
        },
    }


def _document_map_entry_role(entry: dict[str, Any]) -> str:
    title = compact_whitespace(str(entry.get("title") or "")).strip(" -:;,." )
    lowered = title.lower()
    if lowered in NON_COURSE_MAP_TITLES or any(part in lowered for part in NON_COURSE_MAP_TITLE_PARTS):
        return "frontmatter"
    path = entry.get("path") if isinstance(entry.get("path"), list) else []
    if any(str(part).strip().lower() in {"references", "bibliography", "glossary", "index"} for part in path):
        return "backmatter"
    return "main_content"


def _compact_document_map_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep a representative outline of the whole document, not only its first pages."""
    if len(entries) <= MAX_DOCUMENT_MAP_ENTRIES:
        return entries

    top_level = [entry for entry in entries if int(entry.get("level") or 0) == 1]
    selected: list[dict[str, Any]] = list(top_level)
    selected_ids = {str(entry.get("id") or "") for entry in selected}
    remaining = [entry for entry in entries if str(entry.get("id") or "") not in selected_ids]
    slots = max(0, MAX_DOCUMENT_MAP_ENTRIES - len(selected))
    if slots:
        stride = max(1, len(remaining) // slots)
        selected.extend(remaining[::stride][:slots])
    selected.sort(key=lambda entry: int(entry.get("order") or 0))
    return selected[:MAX_DOCUMENT_MAP_ENTRIES]


def _pdf_outline_page(reader: Any, item: Any) -> int | None:
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


def _document_map_from_pdf_reader(reader: Any, document_id: str, *, source_kind: str) -> dict[str, Any]:
    outline = getattr(reader, "outline", None)
    if not isinstance(outline, list):
        return _empty_document_map(document_id, source_kind=source_kind, strategy="pdf_outline")

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
                _document_map_entry(
                    document_id=document_id,
                    order=len(entries) + 1,
                    title=title,
                    level=depth + 1,
                    path=path,
                    source="pdf_outline",
                    page=_pdf_outline_page(reader, item),
                )
            )
            last_path = path

    walk(outline)
    return _document_map_from_entries(
        document_id,
        source_kind=source_kind,
        strategy="pdf_outline",
        entries=entries,
    )


def _line_looks_like_heading(line: str) -> bool:
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


def _document_map_from_text(text: str, document_id: str, *, source_kind: str) -> dict[str, Any]:
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
            if not _line_looks_like_heading(raw):
                continue
            level = 1
            title = compact_whitespace(raw)
        if not title:
            continue
        current_path = [*current_path[: level - 1], title]
        entries.append(
            _document_map_entry(
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
    return _document_map_from_entries(
        document_id,
        source_kind=source_kind,
        strategy="text_headings",
        entries=entries,
    )


def _read_pdf_pages(data: bytes, document_id: str, *, source_kind: str) -> tuple[list[tuple[int, str]], list[str], dict[str, Any]]:
    warnings: list[str] = []
    if PdfReader is None:
        return [], ["pdf_reader_unavailable"], _empty_document_map(document_id, source_kind=source_kind, strategy="pdf_outline")
    try:
        reader = PdfReader(BytesIO(data))
    except Exception as exc:
        return [], [f"pdf_extract_failed:{str(exc)[:120]}"], _empty_document_map(document_id, source_kind=source_kind, strategy="pdf_outline")

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
    document_map = _document_map_from_pdf_reader(reader, document_id, source_kind=source_kind)
    if not document_map.get("entries"):
        document_map = _document_map_from_text("\n\n".join(text for _page, text in pages), document_id, source_kind=source_kind)
    return pages, warnings, document_map


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

    document_map = _empty_document_map(document_id, source_kind=kind or "unknown", strategy="none")
    if kind == "pdf" or mime_type == "application/pdf":
        pdf_pages, warnings, document_map = _read_pdf_pages(data, document_id, source_kind=kind or "pdf")
        pages: list[tuple[int | None, str]] = [(page_number, text) for page_number, text in pdf_pages]
        extracted_text = "\n\n".join(text for _page_number, text in pages)[:MAX_EXTRACTED_TEXT_CHARS]
        adapter = "pypdf"
    elif kind in TEXT_SOURCE_KINDS or mime_type.startswith("text/"):
        extracted_text, warnings = _read_text_bytes(data)
        pages = [(None, extracted_text)]
        adapter = "plain-text"
        document_map = _document_map_from_text(extracted_text, document_id, source_kind=kind or "text")
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
        "documentMap": document_map,
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
