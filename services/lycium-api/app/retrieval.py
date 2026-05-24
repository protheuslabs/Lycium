from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import GraphEdge, KnowledgeObject, Source


TOKEN_PATTERN = re.compile(r"[a-z0-9]+", re.IGNORECASE)


def tokenize(text: str) -> list[str]:
    return TOKEN_PATTERN.findall(text.lower())


def lexical_similarity(query: str, text: str) -> float:
    q_tokens = set(tokenize(query))
    t_tokens = set(tokenize(text))
    if not q_tokens or not t_tokens:
        return 0.0
    intersection = len(q_tokens & t_tokens)
    union = len(q_tokens | t_tokens)
    return round(intersection / max(union, 1), 4)


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
        return {
            "query": query,
            "object_ids": [],
            "rationale": "No qualifying knowledge objects matched the retrieval policy.",
            "modality_mix": {},
            "trust_floor_applied": trust_min,
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
        "Hybrid retrieval selected objects by lexical relevance, trust/freshness thresholds, "
        "and modality balancing. "
        f"Selected {len(selected)} objects across {len(modality_mix)} modalities."
    )

    return {
        "query": query,
        "object_ids": [obj.id for obj in selected[:top_k]],
        "rationale": rationale,
        "modality_mix": dict(modality_mix),
        "trust_floor_applied": trust_min,
    }
