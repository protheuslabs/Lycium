from __future__ import annotations

import re
from typing import Any


MAX_INPUT_ARTIFACT_TEXT_CHARS = 200_000


def _flatten_text(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(_flatten_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(_flatten_text(item) for item in value.values())
    return str(value or "")


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80] or "artifact"


def _artifact_text(artifact: dict[str, Any]) -> str:
    for key in (
        "extractedText",
        "extracted_text",
        "text",
        "content",
        "rawText",
        "raw_text",
        "transcript",
        "markdown",
    ):
        value = artifact.get(key)
        text = _flatten_text(value).strip()
        if text:
            return text[:MAX_INPUT_ARTIFACT_TEXT_CHARS]
    return ""


def _artifact_kind(artifact: dict[str, Any]) -> str:
    raw = str(
        artifact.get("kind")
        or artifact.get("type")
        or artifact.get("fileType")
        or artifact.get("file_type")
        or ""
    ).strip().lower()
    if raw:
        return raw
    filename = str(artifact.get("filename") or artifact.get("name") or "").lower()
    if filename.endswith(".pdf"):
        return "pdf"
    if filename.endswith((".docx", ".doc")):
        return "document"
    if filename.endswith((".pptx", ".ppt")):
        return "slides"
    if filename.endswith((".md", ".markdown")):
        return "markdown"
    if filename.endswith(".txt"):
        return "text"
    return "document"


def _artifact_id(artifact: dict[str, Any], index: int) -> str:
    explicit = str(artifact.get("id") or artifact.get("artifactId") or "").strip()
    if explicit:
        return explicit
    label = str(artifact.get("filename") or artifact.get("title") or artifact.get("name") or f"artifact-{index}")
    return f"input-artifact-{index}-{_slug(label)}"


def _artifact_title(artifact: dict[str, Any], artifact_id: str) -> str:
    return str(
        artifact.get("title")
        or artifact.get("filename")
        or artifact.get("name")
        or artifact_id
    ).strip()


def _artifact_url(artifact: dict[str, Any], artifact_id: str) -> str:
    explicit = str(artifact.get("url") or artifact.get("sourceUrl") or artifact.get("source_url") or "").strip()
    return explicit or f"artifact://{artifact_id}"


def normalize_generation_input_artifacts(input_artifacts: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    for index, artifact in enumerate(input_artifacts or [], start=1):
        if not isinstance(artifact, dict):
            continue
        artifact_id = _artifact_id(artifact, index)
        text = _artifact_text(artifact)
        title = _artifact_title(artifact, artifact_id)
        artifacts.append(
            {
                "id": artifact_id,
                "kind": _artifact_kind(artifact),
                "title": title,
                "filename": str(artifact.get("filename") or artifact.get("name") or "").strip(),
                "mimeType": str(artifact.get("mimeType") or artifact.get("mime_type") or "").strip(),
                "sourceUrl": str(artifact.get("url") or artifact.get("sourceUrl") or artifact.get("source_url") or "").strip(),
                "sourceDocumentUrl": _artifact_url(artifact, artifact_id),
                "extractionStatus": str(artifact.get("extractionStatus") or artifact.get("extraction_status") or ("extracted" if text else "missing_text")),
                "textLength": len(text),
            }
        )
    return artifacts


def source_documents_from_input_artifacts(input_artifacts: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for index, artifact in enumerate(input_artifacts or [], start=1):
        if not isinstance(artifact, dict):
            continue
        text = _artifact_text(artifact)
        if not text:
            continue
        artifact_id = _artifact_id(artifact, index)
        mime_type = str(artifact.get("mimeType") or artifact.get("mime_type") or "text/plain")
        documents.append(
            {
                "url": _artifact_url(artifact, artifact_id),
                "title": _artifact_title(artifact, artifact_id),
                "text": text,
                "contentType": mime_type or "text/plain",
                "fetchStatus": "provided",
                "inputArtifactId": artifact_id,
                "inputArtifactKind": _artifact_kind(artifact),
            }
        )
    return documents


def usable_input_artifact_count(input_artifacts: list[dict[str, Any]] | None) -> int:
    return len(source_documents_from_input_artifacts(input_artifacts))


def _dedupe_urls(urls: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for url in urls:
        clean = str(url).strip()
        if not clean or clean in seen:
            continue
        deduped.append(clean)
        seen.add(clean)
    return deduped


def prepare_source_inputs(
    *,
    source_urls: list[str] | None,
    source_documents: list[dict[str, Any]] | None,
    input_artifacts: list[dict[str, Any]] | None,
) -> tuple[list[str], list[dict[str, Any]], list[dict[str, Any]]]:
    artifact_documents = source_documents_from_input_artifacts(input_artifacts)
    artifact_metadata = normalize_generation_input_artifacts(input_artifacts)
    urls = _dedupe_urls([
        *[str(url) for url in source_urls or [] if str(url).strip()],
        *[str(document.get("url")) for document in artifact_documents if str(document.get("url") or "").strip()],
    ])
    documents = [*(source_documents or []), *artifact_documents]
    return urls, documents, artifact_metadata
