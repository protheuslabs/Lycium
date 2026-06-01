from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import GraphEdge, KnowledgeObject, Source


TOKEN_PATTERN = re.compile(r"[a-z0-9]+", re.IGNORECASE)
INTENT_STOPWORDS = {
    "a",
    "and",
    "are",
    "build",
    "course",
    "for",
    "from",
    "into",
    "intro",
    "introduction",
    "learn",
    "learning",
    "module",
    "of",
    "on",
    "the",
    "to",
    "with",
}


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


def intent_tokens(text: str) -> set[str]:
    return {token for token in tokenize(text) if len(token) > 2 and token not in INTENT_STOPWORDS}


def lexical_similarity(query: str, text: str) -> float:
    q_tokens = set(tokenize(query))
    t_tokens = set(tokenize(text))
    if not q_tokens or not t_tokens:
        return 0.0
    intersection = len(q_tokens & t_tokens)
    union = len(q_tokens | t_tokens)
    return round(intersection / max(union, 1), 4)


def intent_overlap_score(query: str, text: str) -> float:
    query_tokens = intent_tokens(query)
    text_tokens = intent_tokens(text)
    if not query_tokens or not text_tokens:
        return 0.0
    return round(len(query_tokens & text_tokens) / len(query_tokens), 4)


def _object_search_text(obj: KnowledgeObject) -> str:
    source = getattr(obj, "source", None)
    source_text = ""
    if source is not None:
        source_text = f"{source.title or ''} {source.canonical_url or ''}"
    return f"{obj.title} {obj.topic} {source_text} {obj.content[:1600]}"


def intent_relevance_score(obj: KnowledgeObject, *, query: str, context: str = "") -> float:
    combined_query = f"{query} {context}".strip()
    search_text = _object_search_text(obj)
    title_topic = f"{obj.title} {obj.topic}"
    return round(
        intent_overlap_score(combined_query, title_topic) * 0.46
        + intent_overlap_score(combined_query, search_text) * 0.26
        + lexical_similarity(combined_query, search_text) * 0.18
        + obj.trust_score * 0.1,
        4,
    )


def rank_by_intent(objects: list[KnowledgeObject], *, query: str, context: str = "") -> list[KnowledgeObject]:
    return sorted(
        objects,
        key=lambda obj: (intent_relevance_score(obj, query=query, context=context), obj.trust_score, -obj.id),
        reverse=True,
    )


def diversify_by_source(objects: list[KnowledgeObject], *, limit: int) -> list[KnowledgeObject]:
    selected: list[KnowledgeObject] = []
    selected_ids: set[int] = set()
    used_sources: set[int] = set()

    for obj in objects:
        if len(selected) >= limit:
            break
        if obj.id in selected_ids or obj.source_id in used_sources:
            continue
        selected.append(obj)
        selected_ids.add(obj.id)
        used_sources.add(obj.source_id)

    for obj in objects:
        if len(selected) >= limit:
            break
        if obj.id in selected_ids:
            continue
        selected.append(obj)
        selected_ids.add(obj.id)

    return selected


def _role_for_object(object_type: str, modality: str) -> str:
    if object_type in {"assessment"}:
        return "assessment"
    if object_type in {"practice", "project", "lab"}:
        return "practice"
    if object_type in {"reference", "dataset"}:
        return "reference"
    if modality in {"video", "audio"}:
        return "example"
    return "explanation"


@dataclass
class RankedKnowledgeObject:
    object_id: int
    score: float
    reasons: list[str]


@dataclass
class RetrievalQualityReport:
    query: str
    returned: int
    score: float
    warnings: list[str]
    metrics: dict[str, float]


def search_knowledge_objects(
    session: Session,
    *,
    query: str,
    top_k: int,
    free_only: bool,
    trust_min: float,
    modality: str | None = None,
    topic: str | None = None,
    level: str | None = None,
) -> list[KnowledgeObject]:
    stmt = (
        select(KnowledgeObject)
        .join(Source, Source.id == KnowledgeObject.source_id)
        .options(joinedload(KnowledgeObject.source))
    )
    if free_only:
        stmt = stmt.where(Source.is_free.is_(True))
    if modality:
        stmt = stmt.where(KnowledgeObject.modality == modality)
    if topic:
        stmt = stmt.where(KnowledgeObject.topic.ilike(f"%{topic}%"))
    if level:
        stmt = stmt.where(KnowledgeObject.difficulty == level)
    stmt = stmt.where(KnowledgeObject.trust_score >= trust_min)

    rows = list(session.scalars(stmt))
    ranked: list[tuple[KnowledgeObject, float]] = []
    for obj in rows:
        lexical = lexical_similarity(query, f"{obj.title} {obj.content} {obj.topic}")
        topic_match = 0.1 if any(tok in obj.topic.lower() for tok in tokenize(query)) else 0.0
        score = (
            lexical * 0.4
            + obj.trust_score * 0.25
            + obj.freshness_score * 0.15
            + obj.pedagogy_score * 0.1
            + obj.accessibility_score * 0.1
            + topic_match
        )
        ranked.append((obj, round(score, 4)))

    ranked.sort(key=lambda item: item[1], reverse=True)
    return [item[0] for item in ranked[:top_k]]


def evaluate_retrieval_quality(
    objects: list[KnowledgeObject],
    *,
    query: str,
    trust_min: float,
) -> RetrievalQualityReport:
    if not objects:
        return RetrievalQualityReport(
            query=query,
            returned=0,
            score=0.0,
            warnings=["No qualifying knowledge objects matched the retrieval policy."],
            metrics={
                "averageTrust": 0.0,
                "averageLexicalSimilarity": 0.0,
                "sourceDiversity": 0.0,
                "modalityDiversity": 0.0,
                "trustFloor": trust_min,
            },
        )

    average_trust = sum(obj.trust_score for obj in objects) / len(objects)
    average_similarity = sum(lexical_similarity(query, f"{obj.title} {obj.content} {obj.topic}") for obj in objects) / len(objects)
    source_diversity = len({obj.source_id for obj in objects}) / len(objects)
    modality_diversity = len({obj.modality for obj in objects}) / len(objects)
    warnings: list[str] = []

    if average_trust < max(trust_min, 0.55):
        warnings.append("Average trust is below the recommended retrieval floor.")
    if average_similarity < 0.04:
        warnings.append("Lexical match is weak; consider adding more focused sources.")
    if source_diversity < 0.34 and len(objects) >= 3:
        warnings.append("Results are concentrated in too few sources.")
    if modality_diversity < 0.25 and len(objects) >= 4:
        warnings.append("Results have limited modality diversity.")

    score = (
        min(average_trust, 1.0) * 0.42
        + min(average_similarity * 6, 1.0) * 0.28
        + min(source_diversity, 1.0) * 0.18
        + min(modality_diversity, 1.0) * 0.12
    )

    return RetrievalQualityReport(
        query=query,
        returned=len(objects),
        score=round(score, 2),
        warnings=warnings,
        metrics={
            "averageTrust": round(average_trust, 4),
            "averageLexicalSimilarity": round(average_similarity, 4),
            "sourceDiversity": round(source_diversity, 4),
            "modalityDiversity": round(modality_diversity, 4),
            "trustFloor": trust_min,
        },
    )


def assemble_learning_packet(
    session: Session,
    *,
    query: str,
    top_k: int,
    free_only: bool,
    trust_min: float,
    modality: str | None = None,
    topic: str | None = None,
    level: str | None = None,
) -> dict[str, Any]:
    candidates = search_knowledge_objects(
        session,
        query=query,
        top_k=max(top_k * 4, 12),
        free_only=free_only,
        trust_min=trust_min,
        modality=modality,
        topic=topic,
        level=level,
    )

    selected: list[KnowledgeObject] = []
    used_ids: set[int] = set()
    required_roles = ("explanation", "example", "assessment", "practice")
    grouped: dict[str, list[KnowledgeObject]] = {role: [] for role in required_roles}

    for obj in candidates:
        role = _role_for_object(obj.object_type, obj.modality)
        if role in grouped:
            grouped[role].append(obj)

    for role in required_roles:
        if grouped[role]:
            candidate = grouped[role][0]
            if candidate.id not in used_ids:
                selected.append(candidate)
                used_ids.add(candidate.id)

    for obj in candidates:
        if len(selected) >= top_k:
            break
        if obj.id in used_ids:
            continue
        selected.append(obj)
        used_ids.add(obj.id)

    if not selected:
        report = evaluate_retrieval_quality([], query=query, trust_min=trust_min)
        return {
            "query": query,
            "object_ids": [],
            "rationale": "No qualifying knowledge objects matched the retrieval policy.",
            "modality_mix": {},
            "trust_floor_applied": trust_min,
            "quality_report": report.__dict__,
        }

    # Expand packet with prerequisite neighbors when available.
    object_id_set = {obj.id for obj in selected}
    edge_stmt = select(GraphEdge).where(GraphEdge.to_object_id.in_(list(object_id_set)))
    edges = list(session.scalars(edge_stmt))
    for edge in edges:
        if len(selected) >= top_k:
            break
        if edge.edge_type != "requires" or edge.from_object_id in object_id_set:
            continue
        prerequisite_obj = session.get(KnowledgeObject, edge.from_object_id)
        if prerequisite_obj is None:
            continue
        selected.append(prerequisite_obj)
        object_id_set.add(prerequisite_obj.id)

    modality_mix = Counter(obj.modality for obj in selected)
    rationale = (
        "Heuristic lexical retrieval selected objects by lexical relevance, trust/freshness thresholds, "
        "prerequisite expansion, and modality balancing. "
        f"Selected {len(selected)} objects across {len(modality_mix)} modalities."
    )

    return {
        "query": query,
        "object_ids": [obj.id for obj in selected[:top_k]],
        "rationale": rationale,
        "modality_mix": dict(modality_mix),
        "trust_floor_applied": trust_min,
        "quality_report": evaluate_retrieval_quality(selected[:top_k], query=query, trust_min=trust_min).__dict__,
    }
