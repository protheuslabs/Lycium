from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.source_url_utils import canonicalize_url
from app.models import Snapshot, Source
from app.source_identity import stable_snapshot_public_id, stable_source_public_id
from app.source_index import source_payload
from app.source_index_client import SourceIndexClient, source_index_client_configured

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


def _latest_snapshot(session: Session, source_id: int) -> Snapshot | None:
    return session.scalar(
        select(Snapshot)
        .where(Snapshot.source_id == source_id)
        .order_by(Snapshot.fetched_at.desc(), Snapshot.id.desc())
        .limit(1)
    )


def _snapshot_text(snapshot: Snapshot | None) -> str:
    if snapshot is None:
        return ""
    return snapshot.cleaned_text or snapshot.raw_text or ""


def _snapshot_payload(snapshot: Snapshot, source: Source | None = None) -> dict[str, Any]:
    source_public_id = source.public_id if source else None
    snapshot_public_id = snapshot.public_id or stable_snapshot_public_id(
        source_public_id or f"source-{snapshot.source_id}",
        snapshot.content_hash,
    )
    metadata = snapshot.artifact_metadata if isinstance(snapshot.artifact_metadata, dict) else {}
    return {
        "id": snapshot.id,
        "public_id": snapshot_public_id,
        "source_id": snapshot.source_id,
        "fetched_at": snapshot.fetched_at,
        "status": snapshot.extraction_status,
        "content_hash": snapshot.content_hash,
        "content_type": metadata.get("content_type") or metadata.get("contentType") or "text/plain",
        "title": metadata.get("title") or source.title if source else metadata.get("title"),
        "text_digest": _snapshot_text(snapshot)[:1200],
        "extracted_text": _snapshot_text(snapshot),
        "raw_storage_ref": metadata.get("raw_storage_ref"),
        "snapshot_metadata": metadata,
    }


def _summary(snapshot: Snapshot | None, source: Source) -> str:
    text = _snapshot_text(snapshot)
    if text:
        return text[:280]
    return source.title or source.canonical_url


def _source_search_score(query_terms: list[str], source: Source, snapshot: Snapshot | None) -> tuple[float, list[str]]:
    title_text = f"{source.title or ''} {source.canonical_url} {source.normalized_domain} {source.source_type}".lower()
    body_text = f"{_snapshot_text(snapshot)[:5000]}".lower()
    matched_title = [term for term in query_terms if term in title_text]
    matched_body = [term for term in query_terms if term in body_text]
    matched_terms = sorted(set(matched_title + matched_body))
    if not query_terms:
        return round(source.trust_baseline, 3), []
    coverage_score = len(matched_terms) / len(query_terms)
    score = coverage_score + (len(matched_title) * 1.5 + len(matched_body)) / max(len(query_terms), 1) + source.trust_baseline * 0.2
    return round(score, 3), matched_terms


def search_index_response(
    session: Session,
    *,
    query: str,
    filters: dict[str, Any] | None = None,
    limit: int = 12,
) -> dict[str, Any]:
    if source_index_client_configured():
        return SourceIndexClient().search_index(query=query, filters=filters or {}, limit=limit)

    filters = filters or {}
    source_types = {str(value) for value in filters.get("source_types") or filters.get("sourceTypes") or [] if str(value)}
    domains = {str(value).lower().replace("www.", "") for value in filters.get("domains") or [] if str(value)}
    free_only = filters.get("free_only", filters.get("freeOnly"))
    query_terms = _terms(" ".join([query, _text(filters.get("topics"))]))
    stmt = select(Source).order_by(Source.trust_baseline.desc(), Source.updated_at.desc())
    if source_types:
        stmt = stmt.where(Source.source_type.in_(source_types))
    if domains:
        stmt = stmt.where(Source.normalized_domain.in_(domains))
    if free_only is not None:
        stmt = stmt.where(Source.is_free.is_(bool(free_only)))
    results: list[dict[str, Any]] = []
    for source in session.scalars(stmt.limit(max(200, limit * 12))):
        snapshot = _latest_snapshot(session, source.id)
        score, matched_terms = _source_search_score(query_terms, source, snapshot)
        if query_terms and not matched_terms:
            continue
        source_ref = source.public_id or f"source:{source.id}"
        snapshot_ref = snapshot.public_id or stable_snapshot_public_id(source.public_id or stable_source_public_id(source.canonical_url), snapshot.content_hash) if snapshot else None
        results.append(
            {
                "source": source_payload(source),
                "snapshot": _snapshot_payload(snapshot, source) if snapshot else None,
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
        source = session.get(Source, int(source_id))
    elif item.get("url"):
        canonical_url = canonicalize_url(str(item.get("url")))
        source = session.scalar(select(Source).where(Source.canonical_url == canonical_url))
    snapshot = _latest_snapshot(session, source.id) if source else None
    source_url = source.canonical_url if source else str(item.get("url") or "")
    source_title = source.title if source else item.get("title")
    source_text = " ".join(
        [
            str(item.get("title") or source_title or ""),
            str(item.get("text") or ""),
            _snapshot_text(snapshot)[:8000],
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


def analyze_source_fit_response(
    session: Session,
    *,
    sources: list[dict[str, Any]],
    targets: list[dict[str, Any]],
    limit: int = 20,
    minimum_score: float = 0.15,
) -> dict[str, Any]:
    if source_index_client_configured():
        return SourceIndexClient().analyze_source_fit(sources=sources, targets=targets, limit=limit, minimum_score=minimum_score)

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
