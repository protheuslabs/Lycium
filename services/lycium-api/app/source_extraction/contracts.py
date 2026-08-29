from __future__ import annotations

import base64
import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

NORMALIZED_DOCUMENT_CONTRACT_VERSION = "normalized-document-v1"
EVIDENCE_CHUNK_CONTRACT_VERSION = "evidence-chunk-v1"
SOURCE_CITATION_CONTRACT_VERSION = "source-citation-v1"
SOURCE_REGISTRATION_CANDIDATE_CONTRACT_VERSION = "source-registration-candidate-v1"
SOURCE_EXTRACTION_RUN_CONTRACT_VERSION = "source-extraction-run-v1"
SOURCE_EXTRACTION_REQUEST_CONTRACT_VERSION = "source-extraction-request-v1"

EXTERNAL_EXTRACTOR_NAME = "external-source-extractor"
LOCAL_EXTRACTOR_NAME = "lycium-local-source-extractor"
LOCAL_EXTRACTOR_VERSION = "local-source-extractor-v1"
LOCAL_EXTRACTOR_REPLACEABLE_BY = EXTERNAL_EXTRACTOR_NAME

MAX_EXTRACTED_TEXT_CHARS = 240_000
MAX_EVIDENCE_CHUNK_CHARS = 12_000
TEXT_SOURCE_KINDS = {"text", "txt", "markdown", "md", "transcript", "html"}


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def decode_base64(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except ValueError:
        return base64.b64decode(value)


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
    if suffix in {".docx", ".doc"}:
        return "document"
    if suffix in {".pptx", ".ppt"}:
        return "slides"
    return str(fallback or "unknown").lower()


def artifact_id_for_hash(payload: dict[str, Any], content_hash: str, *, index: int = 1) -> str:
    explicit = str(payload.get("id") or payload.get("artifactId") or "").strip()
    return explicit or f"file-{content_hash[:16]}"


def source_ref_for_hash(content_hash: str) -> str:
    return f"file:sha256:{content_hash}"


def source_document_url(artifact_id: str) -> str:
    return f"artifact://{artifact_id}"


def compact_whitespace(value: str) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", value).strip()


def text_from_payload(payload: dict[str, Any]) -> bytes:
    if payload.get("base64"):
        return decode_base64(str(payload["base64"]))
    raw_text = str(payload.get("text") or payload.get("content") or "")
    return raw_text.encode("utf-8")


def source_registration_candidate_from_document(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "contractVersion": SOURCE_REGISTRATION_CANDIDATE_CONTRACT_VERSION,
        "sourceRef": document.get("source", {}).get("sourceRef"),
        "documentId": document.get("documentId"),
        "normalizedDocumentContract": document.get("contractVersion"),
        "source": document.get("source") if isinstance(document.get("source"), dict) else {},
        "snapshot": document.get("snapshot") if isinstance(document.get("snapshot"), dict) else {},
        "citation": document.get("citation") if isinstance(document.get("citation"), dict) else {},
        "evidenceChunkCount": len(document.get("evidence", [])) if isinstance(document.get("evidence"), list) else 0,
        "handoffPolicy": {
            "registrationRequiredForGeneration": False,
            "sourceIndexMayCanonicalize": True,
            "sourceIndexShouldNotReExtract": True,
        },
    }
