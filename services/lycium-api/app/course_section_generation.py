from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.generation_helpers import _build_instructional_blocks, _youtube_embed
from app.models import Source
from app.retrieval import diversify_by_source, rank_by_intent, search_knowledge_objects


def _source_record_id(source_id: int | str) -> str:
    return f"source-{source_id}"


def _source_ids_from_citations(citations: list[dict[str, Any]]) -> list[str]:
    source_ids: list[str] = []
    seen: set[str] = set()
    for citation in citations:
        source_id = citation.get("source_id")
        if source_id is None:
            continue
        record_id = _source_record_id(source_id)
        if record_id in seen:
            continue
        seen.add(record_id)
        source_ids.append(record_id)
    return source_ids


def _source_records_from_citations(citation_map: dict[str, list[dict[str, Any]]], course_title: str) -> list[dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    for citations in citation_map.values():
        for citation in citations:
            source_id = citation.get("source_id")
            if source_id is None:
                continue
            record_id = _source_record_id(source_id)
            records.setdefault(
                record_id,
                {
                    "id": record_id,
                    "type": "web",
                    "title": citation.get("title") or f"Source {source_id}",
                    "url": citation.get("url"),
                    "license": citation.get("license", "unknown"),
                    "isFree": citation.get("is_free", True),
                    "usedByCourseTitles": [course_title],
                },
            )
    return list(records.values())


def _source_records_from_input_urls(source_urls: list[str] | None, course_title: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"input-source-{index}",
            "type": "web",
            "title": f"Submitted source {index}",
            "url": source_url,
            "usedByCourseTitles": [course_title],
        }
        for index, source_url in enumerate(source_urls or [], start=1)
    ]


def _with_source_ids(blocks: list[dict[str, Any]], source_ids: list[str]) -> list[dict[str, Any]]:
    if not source_ids:
        return blocks
    return [
        {**block, "sourceIds": block.get("sourceIds") or source_ids}
        if block.get("type") in {"text", "video", "game"}
        else block
        for block in blocks
    ]


def _source_slot_for_section(section_id: str, section_title: str, source_ids: list[str]) -> dict[str, Any] | None:
    if not source_ids:
        return None
    return {
        "requiredConceptId": section_id,
        "title": section_title,
        "primarySourceId": source_ids[0],
        "fallbackSourceIds": source_ids[1:],
        "replacementPolicy": "review_required",
        "sourceSectionId": section_id,
    }


def _section_candidates(
    session: Session,
    *,
    section_title: str,
    prompt: str,
    free_only: bool,
    trust_min: float,
    level: str | None,
) -> list[Any]:
    candidates = search_knowledge_objects(
        session,
        query=f"{prompt} {section_title}",
        top_k=10,
        free_only=free_only,
        trust_min=trust_min,
        level=level,
    )
    if not candidates and level:
        candidates = search_knowledge_objects(
            session,
            query=f"{prompt} {section_title}",
            top_k=10,
            free_only=free_only,
            trust_min=trust_min,
            level=None,
        )
    return diversify_by_source(rank_by_intent(candidates, query=prompt, context=section_title), limit=6)


def _build_section_content(
    session: Session,
    *,
    section_title: str,
    prompt: str,
    free_only: bool,
    trust_min: float,
    level: str | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[int]]:
    blocks: list[dict[str, Any]] = []
    citations: list[dict[str, Any]] = []
    selected_ids: list[int] = []
    seen_sources: set[int] = set()

    for obj in _section_candidates(
        session,
        section_title=section_title,
        prompt=prompt,
        free_only=free_only,
        trust_min=trust_min,
        level=level,
    ):
        selected_ids.append(obj.id)
        if not blocks:
            blocks.extend(_build_instructional_blocks(section_title, prompt, obj.content[:900]))

        if obj.modality == "video":
            video_url = _youtube_embed(obj.object_metadata.get("source_url", "")) or obj.object_metadata.get("source_url")
            if video_url:
                blocks.append({"type": "video", "url": video_url, "title": obj.title})

        if obj.object_type in {"practice", "project", "lab"}:
            blocks.append(
                {
                    "type": "game",
                    "name": f"Practice: {section_title}",
                    "description": "Apply the concept through a hands-on micro-project.",
                }
            )

        if obj.source_id in seen_sources:
            continue
        source = session.get(Source, obj.source_id)
        if source:
            citations.append(
                {
                    "object_id": obj.id,
                    "source_id": source.id,
                    "title": source.title or obj.title,
                    "url": source.canonical_url,
                    "trust_score": obj.trust_score,
                    "license": source.license,
                    "is_free": source.is_free,
                }
            )
            seen_sources.add(obj.source_id)

    if not blocks:
        blocks.extend(_build_instructional_blocks(section_title, prompt))

    return blocks, citations[:5], selected_ids
