from __future__ import annotations

from typing import Any

from app.retrieval import tokenize


def source_document_text(document: dict[str, Any]) -> str:
    return " ".join(
        str(document.get(key) or "")
        for key in ("title", "url", "text", "rawText", "content", "extracted_text")
    )


def source_document_records(source_documents: list[dict[str, Any]], course_title: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, document in enumerate(source_documents, start=1):
        url = str(document.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        records.append(
            {
                "id": f"input-source-{index}",
                "type": "web",
                "title": str(document.get("title") or f"Submitted source {index}"),
                "url": url,
                "usedByCourseTitles": [course_title],
            }
        )
    return records


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
