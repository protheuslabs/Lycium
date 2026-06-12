from __future__ import annotations

import base64
import hashlib
from io import BytesIO
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional dependency may be absent in minimal deployments.
    PdfReader = None  # type: ignore[assignment]

from app.source_input_artifacts import normalize_generation_input_artifacts


FILE_READER_CONTRACT_VERSION = "lycium-file-reader-v1"
MAX_FILE_READER_TEXT_CHARS = 240_000
TEXT_KINDS = {"text", "txt", "markdown", "md", "transcript", "html"}


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _decode_base64(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except ValueError:
        return base64.b64decode(value)


def _kind_from_filename(filename: str, fallback: str | None = None) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix in {".txt"}:
        return "text"
    if suffix in {".md", ".markdown"}:
        return "markdown"
    if suffix in {".html", ".htm"}:
        return "html"
    if suffix in {".docx", ".doc"}:
        return "document"
    if suffix in {".pptx", ".ppt"}:
        return "slides"
    return str(fallback or "unknown").lower()


def _read_text_bytes(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)[:MAX_FILE_READER_TEXT_CHARS], warnings
        except UnicodeDecodeError:
            continue
    warnings.append("text_decode_fallback_used")
    return data.decode("utf-8", errors="replace")[:MAX_FILE_READER_TEXT_CHARS], warnings


def _read_pdf_bytes(data: bytes) -> tuple[str, list[str]]:
    warnings: list[str] = []
    if PdfReader is None:
        return "", ["pdf_reader_unavailable"]
    try:
        reader = PdfReader(BytesIO(data))
        parts: list[str] = []
        for page_number, page in enumerate(reader.pages, start=1):
            try:
                page_text = page.extract_text() or ""
            except Exception:
                warnings.append(f"pdf_page_{page_number}_extract_failed")
                page_text = ""
            if page_text.strip():
                parts.append(page_text)
            if sum(len(part) for part in parts) >= MAX_FILE_READER_TEXT_CHARS:
                warnings.append("text_truncated")
                break
        text = "\n".join(parts)[:MAX_FILE_READER_TEXT_CHARS]
        if not text.strip():
            warnings.append("pdf_text_empty_or_scanned")
        return text, warnings
    except Exception as exc:
        return "", [f"pdf_extract_failed:{str(exc)[:120]}"]


def read_generation_input_file(file_payload: dict[str, Any], *, index: int = 1) -> dict[str, Any]:
    filename = str(file_payload.get("filename") or file_payload.get("name") or f"input-file-{index}").strip()
    mime_type = str(file_payload.get("mimeType") or file_payload.get("mime_type") or "").strip()
    kind = _kind_from_filename(filename, str(file_payload.get("kind") or file_payload.get("type") or ""))
    raw_text = str(file_payload.get("text") or file_payload.get("content") or "").encode("utf-8")
    data = raw_text
    if file_payload.get("base64"):
        data = _decode_base64(str(file_payload["base64"]))

    if kind == "pdf" or mime_type == "application/pdf":
        extracted_text, warnings = _read_pdf_bytes(data)
    elif kind in TEXT_KINDS or mime_type.startswith("text/"):
        extracted_text, warnings = _read_text_bytes(data)
    else:
        extracted_text, warnings = "", [f"unsupported_file_kind:{kind or 'unknown'}"]

    content_hash = _sha256(data)
    extraction_status = "extracted" if extracted_text.strip() else "unsupported" if warnings and warnings[0].startswith("unsupported") else "failed"
    artifact = {
        "id": str(file_payload.get("id") or f"file-{content_hash[:16]}"),
        "kind": kind,
        "filename": filename,
        "title": str(file_payload.get("title") or filename),
        "mimeType": mime_type,
        "sourceUrl": str(file_payload.get("sourceUrl") or file_payload.get("source_url") or ""),
        "extractedText": extracted_text,
        "extractionStatus": extraction_status,
        "extractionWarnings": warnings,
        "textLength": len(extracted_text),
        "contentHash": content_hash,
        "reader": {"contractVersion": FILE_READER_CONTRACT_VERSION, "adapter": "lycium-local"},
    }
    normalized = normalize_generation_input_artifacts([artifact])[0]
    return {**artifact, **normalized}


def read_generation_input_files(files: list[dict[str, Any]] | None) -> dict[str, Any]:
    artifacts = [
        read_generation_input_file(file_payload, index=index)
        for index, file_payload in enumerate(files or [], start=1)
        if isinstance(file_payload, dict)
    ]
    return {
        "contractVersion": FILE_READER_CONTRACT_VERSION,
        "provider": "lycium-local",
        "replaceableBy": "infring-os-file-reader",
        "artifactCount": len(artifacts),
        "extractedArtifactCount": len([artifact for artifact in artifacts if artifact.get("extractionStatus") == "extracted"]),
        "artifacts": artifacts,
    }
