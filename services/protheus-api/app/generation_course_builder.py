from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.generation_helpers import (
    COURSE_GENERATION_RULES,
    _build_module_summary_section,
    _build_quiz_for_section,
    _stable_id,
    _youtube_embed,
)
from app.generation_outline import create_draft
from app.models import CourseDraft, CourseSnapshot, Source
from app.retrieval import search_knowledge_objects, tokenize


def _build_section_content(
    session: Session,
    *,
    section_title: str,
    prompt: str,
    free_only: bool,
    trust_min: float,
    level: str | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[int]]:
    candidates = search_knowledge_objects(
        session,
        query=f"{prompt} {section_title}",
        top_k=6,
        free_only=free_only,
        trust_min=trust_min,
        level=level,
    )

    blocks: list[dict[str, Any]] = []
    citations: list[dict[str, Any]] = []
    selected_ids: list[int] = []
    seen_sources: set[int] = set()

    for obj in candidates:
        selected_ids.append(obj.id)
        if not blocks:
            blocks.append({"type": "text", "value": obj.content[:900]})

        if obj.modality == "video":
            embed_url = _youtube_embed(obj.object_metadata.get("source_url", ""))
            if embed_url:
                blocks.append({"type": "video", "url": embed_url})

        if obj.object_type in {"practice", "project", "lab"}:
            blocks.append(
                {
                    "type": "game",
                    "name": f"Practice: {section_title}",
                    "description": "Apply the concept through a hands-on micro-project.",
                }
            )

        if obj.source_id not in seen_sources:
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
        blocks.append(
            {
                "type": "text",
                "value": (
                    f"This section covers {section_title}. Repository coverage is still sparse for this concept, "
                    "so this explanation is a synthesized scaffold."
                ),
            }
        )

    return blocks, citations[:5], selected_ids


def generate_course_from_draft(
    session: Session,
    *,
    draft: CourseDraft,
    learner_id: int | None,
    source_policy: str,
    free_only: bool,
    trust_min: float,
) -> CourseSnapshot:
    outline = draft.outline
    modules: list[dict[str, Any]] = []
    section_source_map: dict[str, list[int]] = {}
    citation_map: dict[str, list[dict[str, Any]]] = {}

    for module in outline.get("modules", []):
        section_rows: list[dict[str, Any]] = []
        for section in module.get("sections", []):
            blocks, citations, selected_ids = _build_section_content(
                session,
                section_title=section["title"],
                prompt=draft.prompt,
                free_only=free_only,
                trust_min=trust_min,
                level=draft.difficulty,
            )
            section_id = section["id"]
            concept_card_block = {
                "type": "conceptCards",
                "title": "Concepts introduced",
                "concepts": [
                    {
                        "name": section["title"],
                        "description": f"A core concept introduced in the lesson page titled {section['title']}.",
                    }
                ],
            }
            section_rows.append(
                {
                    "id": section_id,
                    "title": section["title"],
                    "sectionType": "lesson",
                    "pageType": "learn",
                    "learningObjectives": section.get("learning_objectives", []),
                    "estimatedMinutes": section.get("estimated_minutes", 20),
                    "content": [*blocks, concept_card_block],
                    "citations": citations,
                }
            )
            section_source_map[section_id] = selected_ids
            citation_map[section_id] = citations

            concept_tokens = [token for token in tokenize(section["title"]) if len(token) > 3][:3]
            quiz_section_id = _stable_id("q", section_id, section["title"])
            section_rows.append(
                {
                    "id": quiz_section_id,
                    "title": f"Quiz: {section['title']}",
                    "learningObjectives": [],
                    "estimatedMinutes": 10,
                    "content": [_build_quiz_for_section(section["title"], concept_tokens)],
                    "citations": citations,
                    "sectionType": "assessment",
                    "pageType": "apply",
                }
            )
            section_source_map[quiz_section_id] = selected_ids
            citation_map[quiz_section_id] = citations

        summary_section = _build_module_summary_section(
            module_id=module["id"], module_title=module["title"], section_rows=section_rows
        )
        section_rows.append(summary_section)
        section_source_map[summary_section["id"]] = []
        citation_map[summary_section["id"]] = summary_section["citations"]
        modules.append(
            {
                "id": module["id"],
                "title": module["title"],
                "learningObjectives": module.get("learning_objectives", []),
                "sections": section_rows,
            }
        )

    structure = {
        "title": draft.title,
        "orderMandatory": bool(draft.constraints.get("order_mandatory", False)),
        "metadata": {
            "prompt": draft.prompt,
            "pacingLabel": "Module",
            "targetAudience": draft.target_audience,
            "durationMinutes": draft.expected_duration_minutes,
            "difficulty": draft.difficulty,
            "language": draft.language,
            "status": "generated",
            "version": 1,
            "learningGoals": draft.learning_goals,
            "courseGenerationRules": [COURSE_GENERATION_RULES],
        },
        "agentRoster": [
            {
                "id": "instructor",
                "name": "Lycium Instructor",
                "role": "instructor",
                "style": draft.constraints.get("teaching_style", "adaptive"),
                "voice": "neutral",
                "enabled": True,
            },
            {"id": "assistant", "name": "Lycium Assistant", "role": "assistant", "style": "concise", "voice": "neutral", "enabled": True},
        ],
        "modules": modules,
    }
    trace = {
        "draft_id": draft.id,
        "source_policy": source_policy,
        "free_only": free_only,
        "trust_min": trust_min,
        "outline_provenance": outline.get("provenance", {}),
        "section_source_map": section_source_map,
        "citation_map": citation_map,
    }
    snapshot = CourseSnapshot(
        learner_id=learner_id,
        draft_id=draft.id,
        title=draft.title,
        prompt=draft.prompt,
        language=draft.language,
        level=draft.difficulty,
        source_policy=source_policy,
        status="generated",
        version=1,
        structure=structure,
        generation_trace=trace,
    )
    session.add(snapshot)
    session.flush()
    draft.status = "generated"
    return snapshot


def generate_course_direct(
    session: Session,
    *,
    prompt: str,
    learner_id: int | None,
    level: str | None,
    language: str,
    source_policy: str,
    free_only: bool,
    trust_min: float,
    desired_module_count: int,
    expected_duration_minutes: int,
) -> CourseSnapshot:
    draft = create_draft(
        session,
        prompt=prompt,
        learner_id=learner_id,
        target_audience=None,
        learning_goals=[],
        level=level,
        expected_duration_minutes=expected_duration_minutes,
        language=language,
        constraints={"source_policy": source_policy, "free_only": free_only, "trust_min": trust_min},
        desired_module_count=desired_module_count,
        free_only=free_only,
        trust_min=trust_min,
    )
    draft.status = "approved"
    return generate_course_from_draft(
        session,
        draft=draft,
        learner_id=learner_id,
        source_policy=source_policy,
        free_only=free_only,
        trust_min=trust_min,
    )


def regenerate_section(
    session: Session,
    *,
    course: CourseSnapshot,
    module_id: str,
    section_id: str,
    free_only: bool,
    trust_min: float,
    source_policy: str,
) -> CourseSnapshot:
    structure = dict(course.structure)
    modules = structure.get("modules", [])
    target_module = next((module for module in modules if module.get("id") == module_id), None)
    if target_module is None:
        raise ValueError(f"module_id '{module_id}' not found in course")

    target_section = next((section for section in target_module.get("sections", []) if section.get("id") == section_id), None)
    if target_section is None:
        raise ValueError(f"section_id '{section_id}' not found in module '{module_id}'")

    blocks, citations, selected_ids = _build_section_content(
        session,
        section_title=target_section["title"],
        prompt=course.prompt,
        free_only=free_only,
        trust_min=trust_min,
        level=course.level,
    )
    target_section["content"] = blocks
    target_section["citations"] = citations
    structure["modules"] = modules
    trace = dict(course.generation_trace)
    section_source_map = dict(trace.get("section_source_map", {}))
    section_source_map[section_id] = selected_ids
    trace["section_source_map"] = section_source_map
    trace["source_policy"] = source_policy
    course.structure = structure
    course.generation_trace = trace
    course.version += 1
    return course


def fork_course(session: Session, *, course: CourseSnapshot, learner_id: int | None) -> CourseSnapshot:
    clone = CourseSnapshot(
        learner_id=learner_id,
        draft_id=course.draft_id,
        title=f"{course.title} (Fork)",
        prompt=course.prompt,
        language=course.language,
        level=course.level,
        source_policy=course.source_policy,
        status="generated",
        version=1,
        structure=course.structure,
        generation_trace={**course.generation_trace, "forked_from": course.id},
    )
    session.add(clone)
    session.flush()
    return clone


def refresh_course(
    session: Session,
    *,
    course: CourseSnapshot,
    learner_id: int | None,
    free_only: bool,
    trust_min: float,
) -> CourseSnapshot:
    if course.draft_id is not None:
        draft = session.get(CourseDraft, course.draft_id)
        if draft is not None:
            return generate_course_from_draft(
                session,
                draft=draft,
                learner_id=learner_id,
                source_policy=course.source_policy,
                free_only=free_only,
                trust_min=trust_min,
            )

    return generate_course_direct(
        session,
        prompt=course.prompt,
        learner_id=learner_id,
        level=course.level,
        language=course.language,
        source_policy=course.source_policy,
        free_only=free_only,
        trust_min=trust_min,
        desired_module_count=3,
        expected_duration_minutes=180,
    )
