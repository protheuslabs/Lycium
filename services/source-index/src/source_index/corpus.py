from __future__ import annotations

import re
from collections import Counter
from typing import Any, NamedTuple
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from source_index.config import SETTINGS

MIN_RELEVANCE_SCORE = 0.12
STRONG_RELEVANCE_SCORE = 0.35
MAX_CORPUS_FETCHES = 40
AMBIGUOUS_RELEVANCE_TERMS = {
    "basis",
    "covering",
    "foundation",
    "foundations",
    "measurement",
    "molecular",
    "reaction",
    "reactions",
    "solution",
    "solutions",
    "structure",
    "systems",
    "trend",
    "trends",
}
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "course", "create", "for", "from", "has", "have",
    "how", "in", "into", "is", "learn", "learning", "lesson", "lessons", "may", "module", "modules", "must", "of",
    "on", "or", "prompt", "quiz", "quizzes", "section", "source", "student", "students", "teach", "that", "the", "this",
    "to", "undergraduate", "use", "was", "were", "when", "with", "would", "year", "you", "your", "available", "concept",
    "concepts", "content", "cover", "covered", "covering", "cumulative", "directly", "first", "general", "guide", "include",
    "including", "least", "media", "planning", "question", "questions", "review", "standard", "such", "summaries", "summary",
    "week", "weeks",
}
TOKEN_ALIASES = {
    "ai": "artificial-intelligence",
    "chem": "chemistry",
    "cs": "computer-science",
    "genchem": "chemistry",
    "js": "javascript",
    "ml": "machine-learning",
    "ts": "typescript",
}


class SourceCorpusPreflight(NamedTuple):
    synthesis: dict[str, Any]
    source_urls: list[str]
    source_documents: list[dict[str, Any]]


def _canonical_token(value: str) -> str:
    token = TOKEN_ALIASES.get(value.lower().strip("-_ ."), value.lower().strip("-_ ."))
    if len(token) > 4 and token.endswith("ies"):
        token = f"{token[:-3]}y"
    elif len(token) > 5 and token.endswith("s"):
        token = token[:-1]
    return token


def _tokens(value: str) -> set[str]:
    tokens: set[str] = set()
    for raw_token in re.findall(r"[A-Za-z][A-Za-z0-9+#.-]{1,}", value.lower()):
        token = _canonical_token(raw_token)
        if len(token) >= 3 and token not in STOPWORDS:
            tokens.add(token)
    return tokens


def _source_text_from_url(url: str) -> str:
    parsed = urlparse(url)
    path = re.sub(r"[/_\-.]+", " ", parsed.path)
    return f"{parsed.hostname or ''} {path}"


def _plain_text(raw_text: str, content_type: str) -> str:
    if "html" not in content_type.lower() and "<html" not in raw_text[:500].lower():
        return raw_text
    soup = BeautifulSoup(raw_text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    return " ".join(chunk.strip() for chunk in soup.get_text(separator=" ").split() if chunk.strip())


def _fetch_document(url: str) -> dict[str, Any] | None:
    headers = {"User-Agent": SETTINGS.user_agent}
    try:
        with httpx.Client(timeout=6.0, follow_redirects=True, headers=headers) as client:
            response = client.get(url)
            response.raise_for_status()
            return {
                "url": url,
                "text": response.text[:150_000],
                "contentType": response.headers.get("content-type", "text/plain"),
                "fetchStatus": "fetched",
            }
    except (httpx.HTTPError, OSError, ValueError) as exc:
        return {"url": url, "text": "", "contentType": "text/plain", "fetchStatus": "failed", "fetchError": str(exc)[:300]}


def _document_for_url(url: str, documents: list[dict[str, Any]]) -> dict[str, Any] | None:
    return next((document for document in documents if str(document.get("url") or "") == url), None)


def _score_source(prompt_tokens: set[str], url: str, document: dict[str, Any] | None) -> tuple[float, list[str], set[str]]:
    raw_text = ""
    content_type = "text/plain"
    if isinstance(document, dict):
        raw_text = str(document.get("text") or document.get("rawText") or document.get("content") or "")
        content_type = str(document.get("contentType") or document.get("content_type") or "text/plain")
    source_text = f"{_source_text_from_url(url)} {_plain_text(raw_text, content_type)[:40_000]}"
    source_tokens = _tokens(source_text)
    matched_terms = sorted(prompt_tokens.intersection(source_tokens))
    if not prompt_tokens:
        return 1.0, matched_terms, source_tokens
    score = len(matched_terms) / max(6, min(len(prompt_tokens), 24))
    if any(term in _source_text_from_url(url).lower() for term in matched_terms):
        score += 0.1
    if raw_text and len(matched_terms) >= 2:
        score += 0.08
    return round(min(1.0, score), 3), matched_terms, source_tokens


def _has_subject_anchor(matched_terms: list[str]) -> bool:
    return any(term not in AMBIGUOUS_RELEVANCE_TERMS for term in matched_terms)


def compile_source_corpus_preflight(
    *,
    prompt: str,
    source_urls: list[str] | None,
    fetch_sources: bool = False,
    source_documents: list[dict[str, Any]] | None = None,
) -> SourceCorpusPreflight:
    source_urls = [str(url) for url in source_urls or [] if str(url).strip()]
    source_documents = list(source_documents or [])
    prompt_tokens = _tokens(prompt)
    fetched_documents: list[dict[str, Any]] = []
    if fetch_sources:
        documented_urls = {str(document.get("url") or "") for document in source_documents}
        for url in source_urls[:MAX_CORPUS_FETCHES]:
            if url not in documented_urls:
                document = _fetch_document(url)
                if document:
                    fetched_documents.append(document)

    documents = [*source_documents, *fetched_documents]
    included: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    source_token_counts: Counter[str] = Counter()
    for original_index, url in enumerate(source_urls, start=1):
        document = _document_for_url(url, documents)
        score, matched_terms, source_tokens = _score_source(prompt_tokens, url, document)
        row: dict[str, Any] = {"url": url, "originalIndex": original_index, "relevanceScore": score, "matchedTerms": matched_terms[:16]}
        if isinstance(document, dict) and document.get("fetchStatus"):
            row["fetchStatus"] = document.get("fetchStatus")
        if score >= MIN_RELEVANCE_SCORE and (_has_subject_anchor(matched_terms) or score >= STRONG_RELEVANCE_SCORE):
            row["sourceId"] = f"input-source-{len(included) + 1}"
            row["reason"] = "Source matched the prompt strongly enough for corpus grounding."
            included.append(row)
            for token in source_tokens.intersection(prompt_tokens):
                source_token_counts[token] += 1
        else:
            row["reason"] = "Source did not share enough source-specific anchored terms with the prompt."
            excluded.append(row)

    selected_urls = [str(source["url"]) for source in included]
    selected_documents = [document for document in documents if str(document.get("url") or "") in selected_urls]
    common_themes = [
        {"term": token, "sourceCount": count}
        for token, count in source_token_counts.most_common(16)
        if count >= max(2, min(3, len(included)))
    ]
    synthesis = {
        "workflowGate": "source_corpus_preflight",
        "promptTerms": sorted(prompt_tokens)[:32],
        "includedSources": included,
        "excludedSources": excluded,
        "commonThemes": common_themes,
        "metrics": {
            "submittedSourceCount": len(source_urls),
            "includedSourceCount": len(included),
            "excludedSourceCount": len(excluded),
            "fetchedSourceCount": len([document for document in documents if document.get("fetchStatus") == "fetched"]),
            "failedFetchCount": len([document for document in documents if document.get("fetchStatus") == "failed"]),
        },
    }
    if source_urls and not included:
        synthesis["warning"] = "No submitted sources passed relevance preflight."
    return SourceCorpusPreflight(synthesis=synthesis, source_urls=selected_urls, source_documents=selected_documents)
