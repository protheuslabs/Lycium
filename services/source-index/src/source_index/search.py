from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from source_index.models import IndexedSource, SourceSnapshot
from source_index.service import snapshot_payload, source_payload
from source_index.url_utils import canonicalize_url

SOURCE_INDEX_SEARCH_CONTRACT_VERSION = "source-index-search-v1"
SOURCE_FIT_ANALYSIS_CONTRACT_VERSION = "source-fit-analysis-v1"
TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+.#-]*")


def _terms(value: str | None) -> list[str]:
    if not value:
        return []
    return sorted({term for term in TOKEN_RE.findall(value.lower()) if len(term) > 2})


def _text(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(_text(item) for item in value.values())
    return str(value or "")


def _latest_snapshot(session: Session, source_id: int) -> SourceSnapshot | None:
    return session.scalar(
        select(SourceSnapshot)
        .where(SourceSnapshot.source_id == source_id)
        .order_by(SourceSnapshot.fetched_at.desc(), SourceSnapshot.id.desc())
        .limit(1)
    )


def _summary(snapshot: SourceSnapshot | None, source: IndexedSource) -> str:
    digest = (snapshot.text_digest if snapshot else None) or ""
    if digest:
        return digest[:280]
    return source.title or source.canonical_url


def _source_search_score(query_terms: list[str], source: IndexedSource, snapshot: SourceSnapshot | None) -> tuple[float, list[str]]:
    title_text = f"{source.title or ''} {source.canonical_url} {source.normalized_domain} {source.source_type}".lower()
    body_text = f"{snapshot.title if snapshot else ''} {snapshot.text_digest if snapshot else ''} {(snapshot.extracted_text if snapshot else '')[:5000]}".lower()
    matched_title = [term for term in query_terms if term in title_text]
    matched_body = [term for term in query_terms if term in body_text]
    matched_terms = sorted(set(matched_title + matched_body))
    if not query_terms:
        return round(source.trust_baseline, 3), []
    title_score = len(matched_title) * 1.5
    body_score = len(matched_body)
    coverage_score = len(matched_terms) / len(query_terms)
    score = coverage_score + (title_score + body_score) / max(len(query_terms), 1) + source.trust_baseline * 0.2
    return round(score, 3), matched_terms


def search_index(
    session: Session,
    *,
    query: str,
    filters: dict[str, Any] | None = None,
    limit: int = 12,
) -> dict[str, Any]:
    filters = filters or {}
    source_types = {str(value) for value in filters.get("source_types") or filters.get("sourceTypes") or [] if str(value)}
    domains = {str(value).lower().replace("www.", "") for value in filters.get("domains") or [] if str(value)}
    free_only = filters.get("free_only", filters.get("freeOnly"))
    query_terms = _terms(" ".join([query, _text(filters.get("topics"))]))
    stmt = select(IndexedSource).order_by(IndexedSource.trust_baseline.desc(), IndexedSource.updated_at.desc())
    if source_types:
        stmt = stmt.where(IndexedSource.source_type.in_(source_types))
    if domains:
        stmt = stmt.where(IndexedSource.normalized_domain.in_(domains))
    if free_only is not None:
        stmt = stmt.where(IndexedSource.is_free.is_(bool(free_only)))
    sources = list(session.scalars(stmt.limit(max(200, limit * 12))))
    results: list[dict[str, Any]] = []
    for source in sources:
        snapshot = _latest_snapshot(session, source.id)
        score, matched_terms = _source_search_score(query_terms, source, snapshot)
        if query_terms and not matched_terms:
            continue
        source_ref = source.public_id or f"source:{source.id}"
        snapshot_ref = snapshot.public_id if snapshot else None
        results.append(
            {
                "source": source_payload(source),
                "snapshot": snapshot_payload(snapshot) if snapshot else None,
                "score": score,
                "matched_terms": matched_terms,
                "evidence_refs": [ref for ref in [source_ref, snapshot_ref] if ref],
                "summary": _summary(snapshot, source),
            }
        )
    results.sort(key=lambda result: float(result["score"]), reverse=True)
    return {
        "contract_version": SOURCE_INDEX_SEARCH_CONTRACT_VERSION,
        "query": query,
        "result_count": len(results[:limit]),
        "results": results[:limit],
    }


def _resolve_fit_source(session: Session, item: dict[str, Any]) -> dict[str, Any] | None:
    source = None
    source_id = item.get("source_id") or item.get("sourceId")
    if source_id:
        source = session.get(IndexedSource, int(source_id))
    elif item.get("url"):
        canonical_url = canonicalize_url(str(item.get("url")))
        source = session.scalar(select(IndexedSource).where(IndexedSource.canonical_url == canonical_url))
    snapshot = _latest_snapshot(session, source.id) if source else None
    source_url = source.canonical_url if source else str(item.get("url") or "")
    source_title = source.title if source else item.get("title")
    source_text = " ".join(
        [
            str(item.get("title") or source_title or ""),
            str(item.get("text") or ""),
            snapshot.title if snapshot else "",
            snapshot.text_digest if snapshot else "",
            (snapshot.extracted_text if snapshot else "")[:8000],
            source_url,
        ]
    )
    if not source_url and not source_text.strip():
        return None
    return {
        "source_id": source.id if source else None,
        "source_url": source_url,
        "source_title": source_title or source_url or "Submitted source",
        "source_type": source.source_type if source else str(item.get("source_type") or item.get("sourceType") or "unknown"),
        "text": source_text,
    }


def _target_terms(target: dict[str, Any]) -> list[str]:
    return _terms(
        " ".join(
            [
                str(target.get("title") or ""),
                str(target.get("description") or ""),
                _text(target.get("concepts")),
                _text(target.get("requirements")),
                _text(target.get("tags")),
            ]
        )
    )


def _fit_candidate(source: dict[str, Any], target: dict[str, Any]) -> dict[str, Any] | None:
    terms = _target_terms(target)
    if not terms:
        return None
    source_text = str(source["text"]).lower()
    matched_terms = sorted({term for term in terms if term in source_text})
    if not matched_terms:
        return None
    fit_score = min(1.0, len(matched_terms) / len(terms) + min(len(matched_terms), 8) * 0.035)
    confidence = "high" if fit_score >= 0.72 else "medium" if fit_score >= 0.38 else "low"
    source_type = str(source.get("source_type") or "unknown")
    suggested_use = "curriculum_benchmark" if source_type in {"catalog", "curriculum", "syllabus", "standard"} else "source_candidate"
    target_title = str(target.get("title") or target.get("target_id") or target.get("targetId") or "Untitled target")
    return {
        "source_id": source.get("source_id"),
        "source_url": source.get("source_url"),
        "source_title": source.get("source_title"),
        "target_type": str(target.get("target_type") or target.get("targetType") or "target"),
        "target_id": str(target.get("target_id") or target.get("targetId") or target_title),
        "target_title": target_title,
        "fit_score": round(fit_score, 3),
        "matched_terms": matched_terms[:20],
        "fit_reason": f"Matched {len(matched_terms)} target terms, including {', '.join(matched_terms[:5])}.",
        "suggested_use": suggested_use,
        "confidence": confidence,
    }


def analyze_source_fit(
    session: Session,
    *,
    sources: list[dict[str, Any]],
    targets: list[dict[str, Any]],
    limit: int = 20,
    minimum_score: float = 0.15,
) -> dict[str, Any]:
    warnings: list[str] = []
    resolved_sources = [source for source in (_resolve_fit_source(session, item) for item in sources) if source]
    if not resolved_sources:
        warnings.append("No analyzable source text or indexed source records were available.")
    if not targets:
        warnings.append("No target descriptors were provided for fit analysis.")
    candidates = [
        candidate
        for source in resolved_sources
        for target in targets
        if (candidate := _fit_candidate(source, target)) and candidate["fit_score"] >= minimum_score
    ]
    candidates.sort(key=lambda candidate: float(candidate["fit_score"]), reverse=True)
    return {
        "contract_version": SOURCE_FIT_ANALYSIS_CONTRACT_VERSION,
        "source_count": len(resolved_sources),
        "target_count": len(targets),
        "candidate_count": len(candidates[:limit]),
        "candidates": candidates[:limit],
        "warnings": warnings,
    }
