from __future__ import annotations

import re
from typing import Any

SOURCE_CONTEXT_CONTRACT_VERSION = "course-generation-source-context-v1"
DEFAULT_STAGE_CONTEXT_CHARS = 4_800
DEFAULT_SOURCE_EXCERPT_CHARS = 1_400
DEFAULT_MAX_STAGE_SOURCES = 4
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9+#.-]{2,}")
STOPWORDS = {
    "about",
    "after",
    "also",
    "and",
    "are",
    "because",
    "course",
    "from",
    "into",
    "learn",
    "learning",
    "lesson",
    "module",
    "section",
    "source",
    "that",
    "the",
    "this",
    "through",
    "with",
}


def _text(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(_text(item) for item in value.values())
    return str(value or "")


def _document_text(document: dict[str, Any]) -> str:
    return _text(document.get("text") or document.get("rawText") or document.get("content") or document.get("extractedText"))


def _tokens(value: Any) -> set[str]:
    return {
        token.lower().strip("-_.")
        for token in TOKEN_RE.findall(_text(value))
        if len(token) >= 3 and token.lower().strip("-_.") not in STOPWORDS
    }


def _record_by_url(source_records: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    return {str(record.get("url") or ""): record for record in source_records if str(record.get("url") or "")}


def build_source_context_index(
    *,
    source_documents: list[dict[str, Any]],
    source_records: list[dict[str, object]],
) -> dict[str, dict[str, Any]]:
    records_by_url = _record_by_url(source_records)
    source_index: dict[str, dict[str, Any]] = {}
    for fallback_index, document in enumerate(source_documents, start=1):
        url = str(document.get("url") or "")
        if not url:
            continue
        record = records_by_url.get(url, {})
        source_id = str(record.get("id") or document.get("courseSourceId") or f"input-source-{fallback_index}")
        text = _document_text(document).strip()
        if not text:
            continue
        source_index[source_id] = {
            "sourceId": source_id,
            "title": str(document.get("title") or record.get("title") or source_id),
            "url": url,
            "inputArtifactId": str(document.get("inputArtifactId") or ""),
            "inputArtifactKind": str(document.get("inputArtifactKind") or ""),
            "text": text,
            "tokenCountEstimate": len(text.split()),
        }
    return source_index


def source_context_index_summary(source_context_index: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {
        "contractVersion": SOURCE_CONTEXT_CONTRACT_VERSION,
        "sourceCount": len(source_context_index),
        "sources": [
            {
                "sourceId": source["sourceId"],
                "title": source["title"],
                "url": source["url"],
                "inputArtifactId": source.get("inputArtifactId") or None,
                "inputArtifactKind": source.get("inputArtifactKind") or None,
                "tokenCountEstimate": source.get("tokenCountEstimate") or 0,
            }
            for source in source_context_index.values()
        ],
    }


def _chunks(text: str, *, chunk_chars: int = 900, overlap_chars: int = 120) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    if not clean:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(clean):
        chunk = clean[start : start + chunk_chars].strip()
        if chunk:
            chunks.append(chunk)
        next_start = start + chunk_chars - overlap_chars
        if next_start <= start:
            break
        start = next_start
        if len(chunks) >= 220:
            break
    return chunks


def _best_excerpt(text: str, query_tokens: set[str], *, max_chars: int) -> tuple[str, list[str]]:
    candidates = _chunks(text)
    if not candidates:
        return "", []
    if not query_tokens:
        return candidates[0][:max_chars], []
    scored: list[tuple[int, int, str, list[str]]] = []
    for index, chunk in enumerate(candidates):
        chunk_tokens = _tokens(chunk)
        matched = sorted(query_tokens.intersection(chunk_tokens))
        score = (len(matched) * 10) + min(len(chunk_tokens), 80)
        scored.append((score, -index, chunk, matched[:10]))
    scored.sort(reverse=True)
    excerpt_parts: list[str] = []
    matched_terms: list[str] = []
    for _score, _negative_index, chunk, matched in scored[:3]:
        if sum(len(part) for part in excerpt_parts) + len(chunk) > max_chars:
            remaining = max_chars - sum(len(part) for part in excerpt_parts) - 4
            if remaining <= 120:
                continue
            chunk = chunk[:remaining].rstrip()
        excerpt_parts.append(chunk)
        matched_terms.extend(matched)
        if sum(len(part) for part in excerpt_parts) >= max_chars * 0.85:
            break
    return " [...] ".join(excerpt_parts)[:max_chars], sorted(set(matched_terms))[:12]


def compact_source_context_for_stage(
    *,
    source_context_index: dict[str, dict[str, Any]],
    source_ids: list[str],
    query_values: list[Any],
    total_char_budget: int = DEFAULT_STAGE_CONTEXT_CHARS,
    per_source_char_budget: int = DEFAULT_SOURCE_EXCERPT_CHARS,
    max_sources: int = DEFAULT_MAX_STAGE_SOURCES,
) -> dict[str, Any] | None:
    available_sources = [source_context_index[source_id] for source_id in source_ids if source_id in source_context_index]
    if not available_sources:
        available_sources = list(source_context_index.values())[:max_sources]
    if not available_sources:
        return None

    query_tokens = _tokens(query_values)
    selected_sources = available_sources[:max_sources]
    remaining_budget = max(800, total_char_budget)
    rows: list[dict[str, Any]] = []
    for source in selected_sources:
        if remaining_budget <= 200:
            break
        excerpt_budget = min(per_source_char_budget, remaining_budget)
        excerpt, matched_terms = _best_excerpt(str(source.get("text") or ""), query_tokens, max_chars=excerpt_budget)
        if not excerpt:
            continue
        remaining_budget -= len(excerpt)
        rows.append(
            {
                "sourceId": source["sourceId"],
                "title": source["title"],
                "url": source["url"],
                "inputArtifactId": source.get("inputArtifactId") or None,
                "inputArtifactKind": source.get("inputArtifactKind") or None,
                "matchedTerms": matched_terms,
                "excerpt": excerpt,
            }
        )

    if not rows:
        return None
    return {
        "contractVersion": SOURCE_CONTEXT_CONTRACT_VERSION,
        "selectionPolicy": "stage-relevant-bounded-excerpts",
        "totalCharBudget": total_char_budget,
        "perSourceCharBudget": per_source_char_budget,
        "queryTerms": sorted(query_tokens)[:24],
        "sources": rows,
    }
