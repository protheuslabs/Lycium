from __future__ import annotations

from typing import Any

from app.retrieval import tokenize

SOURCE_RECORD_METADATA_KEYS = (
    "filename",
    "mimeType",
    "sourceDocumentUrl",
    "inputArtifactId",
    "inputArtifactKind",
    "inputArtifactOrigin",
    "sourceIndexRef",
    "sourceType",
    "sourceRef",
    "normalizedDocumentId",
    "directEvidenceRef",
    "contentType",
    "fetchStatus",
    "trustBaseline",
)


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _clean_urls(source_urls: list[str] | None) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for source_url in source_urls or []:
        url = _clean(source_url)
        if not url or url in seen:
            continue
        urls.append(url)
        seen.add(url)
    return urls


def source_document_text(document: dict[str, Any]) -> str:
    return " ".join(
        str(document.get(key) or "")
        for key in ("title", "url", "text", "rawText", "content", "extracted_text")
    )


def _document_by_url(source_documents: list[dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    documents_by_url: dict[str, dict[str, Any]] = {}
    for document in source_documents or []:
        if not isinstance(document, dict):
            continue
        url = _clean(document.get("url"))
        if url and url not in documents_by_url:
            documents_by_url[url] = document
    return documents_by_url


def _source_ids_by_url(source_corpus_synthesis: dict[str, Any] | None) -> dict[str, str]:
    included_sources = source_corpus_synthesis.get("includedSources") if isinstance(source_corpus_synthesis, dict) else []
    source_ids_by_url: dict[str, str] = {}
    if not isinstance(included_sources, list):
        return source_ids_by_url
    for source in included_sources:
        if not isinstance(source, dict):
            continue
        url = _clean(source.get("url"))
        source_id = _clean(source.get("sourceId"))
        if url and source_id:
            source_ids_by_url[url] = source_id
    return source_ids_by_url


def _source_type(url: str, document: dict[str, Any] | None) -> str:
    filename = _clean((document or {}).get("filename")).lower()
    mime_type = _clean((document or {}).get("mimeType") or (document or {}).get("contentType")).lower()
    input_kind = _clean((document or {}).get("inputArtifactKind")).lower()
    source_type = _clean((document or {}).get("sourceType")).lower()

    if mime_type == "application/pdf" or filename.endswith(".pdf"):
        return "pdf"
    if input_kind and input_kind not in {"file", "document"}:
        return input_kind
    if url.startswith(("artifact://", "input-artifact://")):
        return input_kind or "file"
    if source_type and source_type != "direct_evidence":
        return source_type
    return input_kind or "web"


def _source_title(document: dict[str, Any] | None, fallback_title: str) -> str:
    citation = document.get("citation") if isinstance(document, dict) and isinstance(document.get("citation"), dict) else {}
    return (
        _clean((document or {}).get("title"))
        or _clean(citation.get("title"))
        or _clean((document or {}).get("filename"))
        or fallback_title
    )


def _metadata_record_fields(document: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(document, dict):
        return {}
    fields = {
        key: document[key]
        for key in SOURCE_RECORD_METADATA_KEYS
        if key in document and document[key] not in ("", None, [], {})
    }
    for key in ("citation", "snapshot", "extractor", "reader"):
        if isinstance(document.get(key), dict) and document[key]:
            fields[key] = document[key]
    evidence_chunks = document.get("evidenceChunks")
    if isinstance(evidence_chunks, list) and evidence_chunks:
        fields["evidenceChunkCount"] = len([chunk for chunk in evidence_chunks if isinstance(chunk, dict)])
    return fields


def source_records_from_inputs(
    source_urls: list[str] | None,
    course_title: str,
    *,
    source_documents: list[dict[str, Any]] | None = None,
    source_corpus_synthesis: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    documents_by_url = _document_by_url(source_documents)
    source_ids_by_url = _source_ids_by_url(source_corpus_synthesis)
    document_urls = [
        _clean(document.get("url"))
        for document in source_documents or []
        if isinstance(document, dict) and _clean(document.get("url"))
    ]

    for url in [*_clean_urls(source_urls), *document_urls]:
        if not url or url in seen:
            continue
        seen.add(url)
        index = len(records) + 1
        document = documents_by_url.get(url)
        citation = document.get("citation") if isinstance(document, dict) and isinstance(document.get("citation"), dict) else {}
        record = {
            "id": source_ids_by_url.get(url) or _clean((document or {}).get("courseSourceId")) or f"input-source-{index}",
            "type": _source_type(url, document),
            "title": _source_title(document, f"Submitted source {index}"),
            "url": url,
            "usedByCourseTitles": [course_title],
        }
        for key in ("author", "publisher", "license", "publishedAt"):
            value = (document or {}).get(key) or citation.get(key)
            if value not in ("", None, [], {}):
                record[key] = value
        record.update(_metadata_record_fields(document))
        records.append(record)
    return records


def source_document_records(source_documents: list[dict[str, Any]], course_title: str) -> list[dict[str, Any]]:
    source_urls = [
        _clean(document.get("url"))
        for document in source_documents or []
        if isinstance(document, dict) and _clean(document.get("url"))
    ]
    return source_records_from_inputs(source_urls, course_title, source_documents=source_documents)


def fallback_source_ids_for_section(section_title: str, source_documents: list[dict[str, Any]]) -> list[str]:
    if not source_documents:
        return []
    section_tokens = {token for token in tokenize(section_title) if len(token) > 3}
    scored: list[tuple[int, str]] = []
    for index, document in enumerate(source_documents, start=1):
        document_tokens = {token for token in tokenize(source_document_text(document)) if len(token) > 3}
        overlap = len(section_tokens.intersection(document_tokens))
        scored.append((overlap, f"input-source-{index}"))
    matches = [source_id for overlap, source_id in sorted(scored, reverse=True) if overlap > 0]
    return matches[:2] or [f"input-source-{index}" for index in range(1, min(len(source_documents), 2) + 1)]
