from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse


def _url_text(url: str) -> str:
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    path = re.sub(r"[/_\-.]+", " ", parsed.path)
    return f"{hostname} {path}".lower()


def _document_has_text(document: dict[str, Any] | None) -> bool:
    if not isinstance(document, dict):
        return False
    return bool(str(document.get("text") or document.get("rawText") or document.get("content") or "").strip())


def _url_has_anchor(url: str, anchor_terms: list[str]) -> bool:
    url_text = _url_text(url)
    return any(term and term in url_text for term in anchor_terms)


def decide_source_relevance(
    *,
    score: float,
    matched_terms: list[str],
    prompt_tokens: set[str],
    url: str,
    document: dict[str, Any] | None,
    min_score: float,
    strong_score: float,
    ambiguous_terms: set[str],
) -> dict[str, Any]:
    anchor_terms = sorted(term for term in matched_terms if term not in ambiguous_terms)
    prompt_anchor_count = len(prompt_tokens.difference(ambiguous_terms))
    url_anchor_matched = _url_has_anchor(url, anchor_terms)
    document_available = _document_has_text(document)
    prompt_coverage = len(matched_terms) / max(1, len(prompt_tokens))

    if not prompt_tokens:
        reason_code = "no_prompt_terms"
        included = True
        reason = "No prompt terms were available, so the submitted source was retained for reviewer inspection."
    elif score >= strong_score and anchor_terms:
        reason_code = "strong_relevance"
        included = True
        reason = "Source had strong relevance with course-specific anchored terms."
    elif len(anchor_terms) >= 2:
        reason_code = "multiple_subject_anchors"
        included = True
        reason = "Source matched multiple course-specific anchored terms."
    elif anchor_terms and url_anchor_matched:
        reason_code = "url_subject_anchor"
        included = True
        reason = "Source had a course-specific anchor in the URL or path."
    elif anchor_terms and prompt_anchor_count <= 3 and score >= min_score:
        reason_code = "focused_prompt_anchor"
        included = True
        reason = "Source matched the focused prompt with a course-specific anchored term."
    elif score >= min_score and not anchor_terms:
        reason_code = "ambiguous_overlap_only"
        included = False
        reason = "Source matched only generic or ambiguous terms, not course-specific anchors."
    elif anchor_terms:
        reason_code = "weak_single_anchor_match"
        included = False
        reason = "Source had only weak single-anchor overlap and was not strong enough for course evidence."
    else:
        reason_code = "no_prompt_overlap"
        included = False
        reason = "Source did not share course-specific terms with the prompt."

    return {
        "included": included,
        "reasonCode": reason_code,
        "reason": reason,
        "evidence": {
            "matchedTermCount": len(matched_terms),
            "matchedAnchorTerms": anchor_terms[:12],
            "matchedAnchorTermCount": len(anchor_terms),
            "promptAnchorCount": prompt_anchor_count,
            "promptCoverageRatio": round(prompt_coverage, 3),
            "urlAnchorMatched": url_anchor_matched,
            "documentAvailable": document_available,
        },
    }
