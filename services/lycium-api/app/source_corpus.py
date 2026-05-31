from __future__ import annotations

import re
from collections import Counter
from hashlib import sha256
from typing import Any, NamedTuple
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import SETTINGS
from app.source_index_client import SourceIndexClient, SourceIndexClientError, source_index_client_configured


MIN_RELEVANCE_SCORE = 0.12
STRONG_RELEVANCE_SCORE = 0.35
MAX_CORPUS_FETCHES = 40
SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
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
    "the",
    "and",
    "for",
    "you",
    "your",
    "with",
    "from",
    "that",
    "this",
    "into",
    "onto",
    "than",
    "then",
    "they",
    "them",
    "over",
    "under",
    "after",
    "before",
    "about",
    "above",
    "below",
    "been",
    "being",
    "have",
    "has",
    "had",
    "will",
    "would",
    "could",
    "should",
    "shall",
    "may",
    "might",
    "must",
    "can",
    "are",
    "was",
    "were",
    "is",
    "be",
    "as",
    "at",
    "by",
    "in",
    "of",
    "on",
    "or",
    "to",
    "a",
    "an",
    "about",
    "after",
    "also",
    "and",
    "any",
    "are",
    "around",
    "because",
    "based",
    "basics",
    "before",
    "between",
    "but",
    "can",
    "class",
    "college",
    "common",
    "complete",
    "concept",
    "concepts",
    "content",
    "cover",
    "covered",
    "covering",
    "covers",
    "course",
    "create",
    "credit",
    "cumulative",
    "directly",
    "each",
    "first",
    "for",
    "from",
    "general",
    "guide",
    "help",
    "how",
    "include",
    "including",
    "inside",
    "into",
    "its",
    "least",
    "learn",
    "learners",
    "learning",
    "lesson",
    "lessons",
    "media",
    "module",
    "modules",
    "must",
    "not",
    "one",
    "online",
    "only",
    "planning",
    "principle",
    "principles",
    "prompt",
    "question",
    "questions",
    "quiz",
    "quizzes",
    "review",
    "resources",
    "right",
    "science",
    "should",
    "resources",
    "section",
    "specific",
    "source",
    "source-backed",
    "standard",
    "student",
    "students",
    "style",
    "such",
    "summaries",
    "summary",
    "teach",
    "that",
    "their",
    "this",
    "through",
    "undergraduate",
    "undergraduates",
    "use",
    "available",
    "when",
    "week",
    "weeks",
    "with",
    "year",
}

TOKEN_ALIASES = {
    "chem": "chemistry",
    "genchem": "chemistry",
    "js": "javascript",
    "ts": "typescript",
    "ml": "machine-learning",
    "ai": "artificial-intelligence",
    "cs": "computer-science",
}


class SourceCorpusPreflight(NamedTuple):
    synthesis: dict[str, Any]
    source_urls: list[str]
    source_documents: list[dict[str, Any]]


def _canonical_token(value: str) -> str:
    token = value.lower().strip("-_.")
    token = TOKEN_ALIASES.get(token, token)
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
    hostname = parsed.hostname or ""
    path = re.sub(r"[/_\-.]+", " ", parsed.path)
    return f"{hostname} {path}"


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


def _document_for_url(url: str, source_documents: list[dict[str, Any]]) -> dict[str, Any] | None:
    for document in source_documents:
        if str(document.get("url") or "") == url:
            return document
    return None


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

    prompt_basis = max(6, min(len(prompt_tokens), 24))
    score = len(matched_terms) / prompt_basis
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
        row = {
            "url": url,
            "originalIndex": original_index,
            "relevanceScore": score,
            "matchedTerms": matched_terms[:16],
        }
        if isinstance(document, dict) and document.get("fetchStatus"):
            row["fetchStatus"] = document.get("fetchStatus")
        if score >= MIN_RELEVANCE_SCORE and (_has_subject_anchor(matched_terms) or score >= STRONG_RELEVANCE_SCORE):
            row["sourceId"] = f"input-source-{len(included) + 1}"
            row["reason"] = "Source matched the course prompt strongly enough for curriculum grounding."
            included.append(row)
            for token in source_tokens.intersection(prompt_tokens):
                source_token_counts[token] += 1
        else:
            row["reason"] = "Source did not share enough course-specific anchored terms with the prompt."
            excluded.append(row)

    selected_urls = [str(source["url"]) for source in included]
    selected_documents = [
        {key: value for key, value in document.items() if key in {"url", "text", "rawText", "content", "contentType", "content_type"}}
        for document in documents
        if str(document.get("url") or "") in selected_urls
    ]
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
        synthesis["warning"] = "No submitted sources passed relevance preflight; course planning should not treat the source list as authoritative."
    return SourceCorpusPreflight(synthesis=synthesis, source_urls=selected_urls, source_documents=selected_documents)


def _source_packet_context_id(prompt: str, source_urls: list[str]) -> str:
    digest = sha256(f"{prompt}\n{'|'.join(source_urls)}".encode("utf-8")).hexdigest()[:16]
    return f"course-generation-{digest}"


def _source_packet_to_preflight(packet: dict[str, Any]) -> SourceCorpusPreflight:
    synthesis = packet.get("synthesis") if isinstance(packet.get("synthesis"), dict) else {}
    synthesis = dict(synthesis)
    source_documents = [
        document
        for document in packet.get("source_documents", [])
        if isinstance(document, dict) and str(document.get("url") or "").strip()
    ]
    source_urls = [str(document.get("url")) for document in source_documents]
    if not source_urls:
        for source in packet.get("sources", []):
            source_record = source.get("source") if isinstance(source, dict) else None
            if isinstance(source_record, dict) and str(source_record.get("canonical_url") or "").strip():
                source_urls.append(str(source_record.get("canonical_url")))
    synthesis["sourcePacket"] = {
        "contractVersion": str(packet.get("contract_version") or SOURCE_PACKET_CONTRACT_VERSION),
        "contextId": packet.get("context_id"),
        "sourceCount": len(packet.get("sources", []) if isinstance(packet.get("sources"), list) else []),
        "sourceDocumentCount": len(source_documents),
        "warnings": packet.get("warnings") if isinstance(packet.get("warnings"), list) else [],
    }
    return SourceCorpusPreflight(synthesis=synthesis, source_urls=source_urls, source_documents=source_documents)


def compile_generation_source_corpus(
    *,
    prompt: str,
    source_urls: list[str] | None,
    fetch_sources: bool = True,
    source_documents: list[dict[str, Any]] | None = None,
    context_id: str | None = None,
    source_packet_id: int | str | None = None,
    source_packet: dict[str, Any] | None = None,
) -> SourceCorpusPreflight:
    if isinstance(source_packet, dict) and source_packet.get("contract_version") == SOURCE_PACKET_CONTRACT_VERSION:
        return _source_packet_to_preflight(source_packet)

    normalized_urls = [str(url) for url in source_urls or [] if str(url).strip()]
    if source_index_client_configured() and source_packet_id is not None:
        try:
            return _source_packet_to_preflight(SourceIndexClient().get_source_packet(source_packet_id))
        except SourceIndexClientError as exc:
            fallback = compile_source_corpus_preflight(
                prompt=prompt,
                source_urls=normalized_urls,
                fetch_sources=fetch_sources,
                source_documents=source_documents,
            )
            synthesis = dict(fallback.synthesis)
            synthesis["sourcePacket"] = {
                "contractVersion": SOURCE_PACKET_CONTRACT_VERSION,
                "status": "fallback",
                "sourcePacketId": source_packet_id,
                "error": str(exc)[:300],
            }
            return SourceCorpusPreflight(
                synthesis=synthesis,
                source_urls=fallback.source_urls,
                source_documents=fallback.source_documents,
            )

    if source_index_client_configured() and normalized_urls:
        try:
            packet = SourceIndexClient().create_source_packet(
                consumer="lycium-course-generation",
                context_id=context_id or _source_packet_context_id(prompt, normalized_urls),
                prompt=prompt,
                source_urls=normalized_urls,
                fetch_sources=fetch_sources,
                source_documents=source_documents,
                snapshot_limit=1,
            )
            return _source_packet_to_preflight(packet)
        except SourceIndexClientError as exc:
            fallback = compile_source_corpus_preflight(
                prompt=prompt,
                source_urls=normalized_urls,
                fetch_sources=fetch_sources,
                source_documents=source_documents,
            )
            synthesis = dict(fallback.synthesis)
            synthesis["sourcePacket"] = {
                "contractVersion": SOURCE_PACKET_CONTRACT_VERSION,
                "status": "fallback",
                "error": str(exc)[:300],
            }
            return SourceCorpusPreflight(
                synthesis=synthesis,
                source_urls=fallback.source_urls,
                source_documents=fallback.source_documents,
            )

    return compile_source_corpus_preflight(
        prompt=prompt,
        source_urls=normalized_urls,
        fetch_sources=fetch_sources,
        source_documents=source_documents,
    )
