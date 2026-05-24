from __future__ import annotations

from collections import defaultdict
from statistics import mean

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import CoverageMap, KnowledgeObject


def _bucket(value: float) -> str:
    if value < 0.35:
        return "very_low"
    if value < 0.55:
        return "low"
    if value < 0.75:
        return "medium"
    if value < 0.9:
        return "high"
    return "very_high"


def _topic_gaps(objects: list[KnowledgeObject], avg_trust: float, avg_freshness: float) -> list[str]:
    gaps: list[str] = []
    modalities = {obj.modality for obj in objects}
    object_types = {obj.object_type for obj in objects}

    if len(objects) < 4:
        gaps.append("low_volume")
    if len(modalities) < 3:
        gaps.append("low_modality_diversity")
    if avg_trust < 0.6:
        gaps.append("low_trust")
    if avg_freshness < 0.6:
        gaps.append("stale_sources")
    if "assessment" not in object_types:
        gaps.append("missing_assessment")
    if "practice" not in object_types and "project" not in object_types:
        gaps.append("missing_practice")

    return gaps


def recompute_coverage(session: Session, topic: str | None = None) -> list[CoverageMap]:
    objects_stmt = select(KnowledgeObject)
    if topic:
        objects_stmt = objects_stmt.where(KnowledgeObject.topic == topic)
    objects = list(session.scalars(objects_stmt))

    grouped: dict[str, list[KnowledgeObject]] = defaultdict(list)
    for obj in objects:
        grouped[obj.topic].append(obj)

    if topic:
        session.execute(delete(CoverageMap).where(CoverageMap.topic == topic))
    else:
        session.execute(delete(CoverageMap))
    session.flush()

    coverage_rows: list[CoverageMap] = []
    for topic_name, topic_objects in grouped.items():
        trust_values = [obj.trust_score for obj in topic_objects]
        freshness_values = [obj.freshness_score for obj in topic_objects]
        modality_values = {obj.modality for obj in topic_objects}

        trust_distribution: dict[str, int] = defaultdict(int)
        freshness_distribution: dict[str, int] = defaultdict(int)
        for obj in topic_objects:
            trust_distribution[_bucket(obj.trust_score)] += 1
            freshness_distribution[_bucket(obj.freshness_score)] += 1

        avg_trust = round(mean(trust_values), 4) if trust_values else 0.0
        avg_freshness = round(mean(freshness_values), 4) if freshness_values else 0.0

        row = CoverageMap(
            topic=topic_name,
            object_count=len(topic_objects),
            modality_count=len(modality_values),
            average_trust=avg_trust,
            average_freshness=avg_freshness,
            trust_distribution=dict(trust_distribution),
            freshness_distribution=dict(freshness_distribution),
            known_gaps=_topic_gaps(topic_objects, avg_trust, avg_freshness),
        )
        session.add(row)
        coverage_rows.append(row)

    session.flush()
    return coverage_rows
