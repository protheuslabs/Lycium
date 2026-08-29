from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from hashlib import sha256
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import SETTINGS
from app.source_input_artifacts import prepare_source_inputs
from app.source_index_client import SourceIndexClient, SourceIndexClientError, source_index_client_configured
from app.source_index_packet_adapter import source_packet_generation_handoff
from app.source_corpus_terms import AMBIGUOUS_RELEVANCE_TERMS, STOPWORDS, TOKEN_ALIASES
from app.source_relevance import decide_source_relevance


MIN_RELEVANCE_SCORE = 0.12
STRONG_RELEVANCE_SCORE = 0.35
MAX_CORPUS_FETCHES = 40
SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"


@dataclass(frozen=True)
class SourceCorpusPreflight:
    synthesis: dict[str, Any]
    source_urls: list[str]
    source_documents: list[dict[str, Any]]
    input_artifacts: list[dict[str, Any]] = field(default_factory=list)


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


def compile_source_corpus_preflight(
    *,
    prompt: str,
    source_urls: list[str] | None,
    fetch_sources: bool = False,
    source_documents: list[dict[str, Any]] | None = None,
    input_artifacts: list[dict[str, Any]] | None = None,
) -> SourceCorpusPreflight:
    source_urls, source_documents, input_artifact_metadata = prepare_source_inputs(
        source_urls=source_urls,
        source_documents=source_documents,
        input_artifacts=input_artifacts,
    )
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
    exclusion_reasons: Counter[str] = Counter()
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
        if isinstance(document, dict) and document.get("inputArtifactId"):
            row["inputArtifactId"] = document.get("inputArtifactId")
            row["inputArtifactKind"] = document.get("inputArtifactKind")
        decision = decide_source_relevance(
            score=score,
            matched_terms=matched_terms,
            prompt_tokens=prompt_tokens,
            url=url,
            document=document,
            min_score=MIN_RELEVANCE_SCORE,
            strong_score=STRONG_RELEVANCE_SCORE,
            ambiguous_terms=AMBIGUOUS_RELEVANCE_TERMS,
        )
        row["decision"] = "included" if decision["included"] else "excluded"
        row["reasonCode"] = decision["reasonCode"]
        row["reason"] = decision["reason"]
        row["evidence"] = decision["evidence"]
        if decision["included"]:
            row["sourceId"] = f"input-source-{len(included) + 1}"
            included.append(row)
            for token in source_tokens.intersection(prompt_tokens):
                source_token_counts[token] += 1
        else:
            exclusion_reasons[str(decision["reasonCode"])] += 1
            excluded.append(row)

    selected_urls = [str(source["url"]) for source in included]
    selected_document_keys = {
        "url",
        "title",
        "text",
        "rawText",
        "content",
        "contentType",
        "content_type",
        "fetchStatus",
        "inputArtifactId",
        "inputArtifactKind",
        "inputArtifactOrigin",
        "sourceIndexRef",
        "sourceType",
        "sourceRef",
        "normalizedDocumentId",
        "directEvidenceRef",
        "evidenceChunks",
        "citation",
        "snapshot",
        "extractor",
        "trustBaseline",
    }
    selected_documents = [
        {key: value for key, value in document.items() if key in selected_document_keys}
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
        "exclusionReasons": [
            {"reasonCode": reason_code, "count": count}
            for reason_code, count in exclusion_reasons.most_common()
        ],
        "commonThemes": common_themes,
        "metrics": {
            "submittedSourceCount": len(source_urls),
            "includedSourceCount": len(included),
            "excludedSourceCount": len(excluded),
            "fetchedSourceCount": len([document for document in documents if document.get("fetchStatus") == "fetched"]),
            "failedFetchCount": len([document for document in documents if document.get("fetchStatus") == "failed"]),
            "submittedInputArtifactCount": len(input_artifact_metadata),
            "usableInputArtifactCount": len([artifact for artifact in input_artifact_metadata if int(artifact.get("textLength") or 0) > 0]),
            "includedInputArtifactCount": len([source for source in included if source.get("inputArtifactId")]),
            "ambiguousOverlapExcludedCount": exclusion_reasons.get("ambiguous_overlap_only", 0),
            "weakSingleAnchorExcludedCount": exclusion_reasons.get("weak_single_anchor_match", 0),
        },
    }
    if input_artifact_metadata:
        synthesis["inputArtifacts"] = input_artifact_metadata
    if source_urls and not included:
        synthesis["warning"] = "No submitted sources passed relevance preflight; course planning should not treat the source list as authoritative."
    elif excluded:
        synthesis["warning"] = "Some submitted sources were excluded before generation; use includedSources as the authoritative evidence set."
    return SourceCorpusPreflight(
        synthesis=synthesis,
        source_urls=selected_urls,
        source_documents=selected_documents,
        input_artifacts=input_artifact_metadata,
    )


def _source_packet_context_id(prompt: str, source_urls: list[str]) -> str:
    digest = sha256(f"{prompt}\n{'|'.join(source_urls)}".encode("utf-8")).hexdigest()[:16]
    return f"course-generation-{digest}"


def _source_packet_to_preflight(packet: dict[str, Any]) -> SourceCorpusPreflight:
    handoff = source_packet_generation_handoff(packet)
    return SourceCorpusPreflight(
        synthesis=handoff.synthesis,
        source_urls=handoff.source_urls,
        source_documents=handoff.source_documents,
        input_artifacts=handoff.input_artifacts,
    )


def _source_packet_has_generation_evidence(packet: dict[str, Any]) -> bool:
    return bool(
        [
            document
            for document in packet.get("source_documents", [])
            if isinstance(document, dict) and str(document.get("url") or "").strip()
        ]
        or [evidence for evidence in packet.get("evidence", []) if isinstance(evidence, dict)]
    )


def _source_packet_empty_fallback(
    fallback: SourceCorpusPreflight,
    *,
    source_packet: dict[str, Any],
) -> SourceCorpusPreflight:
    synthesis = dict(fallback.synthesis)
    quality = source_packet.get("quality") if isinstance(source_packet.get("quality"), dict) else {}
    synthesis["sourcePacket"] = {
        "contractVersion": str(source_packet.get("contract_version") or SOURCE_PACKET_CONTRACT_VERSION),
        "status": "empty",
        "packetId": source_packet.get("packet_id"),
        "contextId": source_packet.get("context_id"),
        "quality": quality,
        "warnings": source_packet.get("warnings") if isinstance(source_packet.get("warnings"), list) else [],
    }
    return SourceCorpusPreflight(
        synthesis=synthesis,
        source_urls=fallback.source_urls,
        source_documents=fallback.source_documents,
        input_artifacts=fallback.input_artifacts,
    )


def compile_generation_source_corpus(
    *,
    prompt: str,
    source_urls: list[str] | None,
    fetch_sources: bool = True,
    source_documents: list[dict[str, Any]] | None = None,
    context_id: str | None = None,
    source_packet_id: int | str | None = None,
    source_packet: dict[str, Any] | None = None,
    input_artifacts: list[dict[str, Any]] | None = None,
) -> SourceCorpusPreflight:
    if isinstance(source_packet, dict) and source_packet.get("contract_version") == SOURCE_PACKET_CONTRACT_VERSION:
        return _source_packet_to_preflight(source_packet)

    normalized_urls, prepared_documents, _input_artifact_metadata = prepare_source_inputs(
        source_urls=source_urls,
        source_documents=source_documents,
        input_artifacts=input_artifacts,
    )
    if source_index_client_configured() and source_packet_id is not None:
        try:
            return _source_packet_to_preflight(SourceIndexClient().get_source_packet(source_packet_id))
        except SourceIndexClientError as exc:
            fallback = compile_source_corpus_preflight(
                prompt=prompt,
                source_urls=normalized_urls,
                fetch_sources=fetch_sources,
                source_documents=source_documents,
                input_artifacts=input_artifacts,
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

    if source_index_client_configured():
        try:
            packet = SourceIndexClient().create_source_packet(
                consumer="lycium-course-generation",
                context_id=context_id or _source_packet_context_id(prompt, normalized_urls),
                prompt=prompt,
                source_urls=normalized_urls,
                fetch_sources=fetch_sources,
                source_documents=prepared_documents,
                snapshot_limit=1,
            )
            if _source_packet_has_generation_evidence(packet):
                return _source_packet_to_preflight(packet)
            fallback = compile_source_corpus_preflight(
                prompt=prompt,
                source_urls=normalized_urls,
                fetch_sources=fetch_sources,
                source_documents=source_documents,
                input_artifacts=input_artifacts,
            )
            return _source_packet_empty_fallback(fallback, source_packet=packet)
        except SourceIndexClientError as exc:
            fallback = compile_source_corpus_preflight(
                prompt=prompt,
                source_urls=normalized_urls,
                fetch_sources=fetch_sources,
                source_documents=source_documents,
                input_artifacts=input_artifacts,
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
                input_artifacts=fallback.input_artifacts,
            )

    return compile_source_corpus_preflight(
        prompt=prompt,
        source_urls=normalized_urls,
        fetch_sources=fetch_sources,
        source_documents=source_documents,
        input_artifacts=input_artifacts,
    )
