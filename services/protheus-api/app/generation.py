from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from dataclasses import dataclass
from statistics import mean
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CourseDraft, CourseSnapshot, KnowledgeObject, Learner, ProgramSnapshot, Source
from app.retrieval import assemble_learning_packet, search_knowledge_objects, tokenize


def _stable_id(prefix: str, *parts: str) -> str:
    seed = "::".join(parts)
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}-{digest}"


def _title_from_prompt(prompt: str) -> str:
    cleaned = re.sub(r"\s+", " ", prompt).strip()
    if len(cleaned) <= 64:
        return cleaned.title()
    return f"{cleaned[:61].strip().title()}..."


def _extract_goals(prompt: str, explicit_goals: list[str]) -> list[str]:
    if explicit_goals:
        return explicit_goals[:8]
    tokens = [tok for tok in tokenize(prompt) if len(tok) > 3]
    if not tokens:
        return ["Understand the topic fundamentals"]
    unique = list(dict.fromkeys(tokens))
    return [f"Understand {token}" for token in unique[:6]]


def _youtube_embed(url: str) -> str | None:
    if "youtube.com/watch?v=" in url:
        video_id = url.split("watch?v=")[-1].split("&", 1)[0]
        return f"https://www.youtube.com/embed/{video_id}"
    if "youtu.be/" in url:
        video_id = url.split("youtu.be/")[-1].split("?", 1)[0]
        return f"https://www.youtube.com/embed/{video_id}"
    if "youtube.com/embed/" in url:
        return url
    return None


def _build_quiz_for_section(section_title: str, concept_tokens: list[str]) -> dict[str, Any]:
    answer = concept_tokens[0].replace("_", " ").title() if concept_tokens else "Core Concept"
    distractor_1 = concept_tokens[1].replace("_", " ").title() if len(concept_tokens) > 1 else "Unrelated Detail"
    distractor_2 = concept_tokens[2].replace("_", " ").title() if len(concept_tokens) > 2 else "Advanced Edge Case"
    options = [answer, distractor_1, distractor_2]
    return {
        "type": "quiz",
        "question": f"Which concept is most central to: {section_title}?",
        "options": options,
        "answer": 0,
    }


def _select_objects_for_outline(
    session: Session,
    *,
    prompt: str,
    desired_module_count: int,
    free_only: bool,
    trust_min: float,
    level: str | None,
) -> list[KnowledgeObject]:
    packet = assemble_learning_packet(
        session,
        query=prompt,
        top_k=max(desired_module_count * 4, 12),
        free_only=free_only,
        trust_min=trust_min,
        level=level,
    )
    if not packet["object_ids"]:
        return []
    objects = list(
        session.scalars(select(KnowledgeObject).where(KnowledgeObject.id.in_(packet["object_ids"])))
    )
    return sorted(objects, key=lambda obj: (obj.topic, -obj.trust_score, obj.id))


def _fallback_outline(prompt: str, module_count: int, goals: list[str]) -> dict[str, Any]:
    title = _title_from_prompt(prompt)
    modules: list[dict[str, Any]] = []
    for module_idx in range(1, module_count + 1):
        module_title = f"Module {module_idx}: {goals[(module_idx - 1) % len(goals)]}"
        module_id = _stable_id("m", title, module_title, str(module_idx))
        sections = []
        for section_idx in range(1, 4):
            section_title = f"{module_title} - Part {section_idx}"
            section_id = _stable_id("s", module_id, section_title, str(section_idx))
            sections.append(
                {
                    "id": section_id,
                    "title": section_title,
                    "learning_objectives": [f"Explain {section_title.lower()}"],
                    "concept_keywords": [goals[(section_idx - 1) % len(goals)].lower().replace(" ", "_")],
                    "estimated_minutes": 20,
                }
            )
        modules.append(
            {
                "id": module_id,
                "title": module_title,
                "learning_objectives": goals[:3],
                "sections": sections,
            }
        )

    return {
        "title": title,
        "summary": f"Generated from prompt: {prompt}",
        "modules": modules,
        "provenance": {"mode": "fallback", "object_ids": []},
    }


def build_outline(
    session: Session,
    *,
    prompt: str,
    desired_module_count: int,
    free_only: bool,
    trust_min: float,
    level: str | None,
    learning_goals: list[str],
) -> dict[str, Any]:
    goals = _extract_goals(prompt, learning_goals)
    title = _title_from_prompt(prompt)
    objects = _select_objects_for_outline(
        session,
        prompt=prompt,
        desired_module_count=desired_module_count,
        free_only=free_only,
        trust_min=trust_min,
        level=level,
    )
    if not objects:
        return _fallback_outline(prompt, desired_module_count, goals)

    topics: dict[str, list[KnowledgeObject]] = defaultdict(list)
    for obj in objects:
        topics[obj.topic].append(obj)

    sorted_topics = sorted(
        topics.items(),
        key=lambda item: mean(node.trust_score for node in item[1]),
        reverse=True,
    )[:desired_module_count]

    modules: list[dict[str, Any]] = []
    for module_idx, (topic, topic_objects) in enumerate(sorted_topics, start=1):
        module_id = _stable_id("m", title, topic, str(module_idx))
        module_title = f"Module {module_idx}: {topic}"
        module_objectives = list(
            dict.fromkeys(
                objective
                for obj in topic_objects
                for objective in obj.learning_outcomes[:2]
                if objective
            )
        )[:4]
        if not module_objectives:
            module_objectives = [f"Understand foundational ideas in {topic}"]

        sections: list[dict[str, Any]] = []
        for section_idx, obj in enumerate(topic_objects[:4], start=1):
            section_title = obj.title.split(" - Segment ")[0].strip() or f"{topic} Segment {section_idx}"
            section_id = _stable_id("s", module_id, section_title, str(section_idx))
            keywords = [token for token in tokenize(f"{obj.title} {obj.topic}") if len(token) > 3][:5]
            sections.append(
                {
                    "id": section_id,
                    "title": section_title,
                    "learning_objectives": obj.learning_outcomes[:3]
                    or [f"Apply concept from {section_title.lower()}"],
                    "concept_keywords": keywords,
                    "estimated_minutes": max(10, obj.estimated_minutes),
                }
            )

        if not sections:
            sections.append(
                {
                    "id": _stable_id("s", module_id, topic, "1"),
                    "title": f"Introduction to {topic}",
                    "learning_objectives": [f"Explain {topic.lower()}"],
                    "concept_keywords": tokenize(topic)[:5],
                    "estimated_minutes": 20,
                }
            )

        modules.append(
            {
                "id": module_id,
                "title": module_title,
                "learning_objectives": module_objectives,
                "sections": sections,
            }
        )

    return {
        "title": title,
        "summary": f"Personalized draft outline for: {prompt}",
        "modules": modules,
        "provenance": {"mode": "knowledge-base", "object_ids": [obj.id for obj in objects]},
    }


def create_draft(
    session: Session,
    *,
    prompt: str,
    learner_id: int | None,
    target_audience: str | None,
    learning_goals: list[str],
    level: str | None,
    expected_duration_minutes: int,
    language: str,
    constraints: dict[str, Any],
    desired_module_count: int,
    free_only: bool,
    trust_min: float,
) -> CourseDraft:
    outline = build_outline(
        session,
        prompt=prompt,
        desired_module_count=desired_module_count,
        free_only=free_only,
        trust_min=trust_min,
        level=level,
        learning_goals=learning_goals,
    )
    draft = CourseDraft(
        learner_id=learner_id,
        title=outline["title"],
        prompt=prompt,
        target_audience=target_audience,
        learning_goals=_extract_goals(prompt, learning_goals),
        difficulty=level,
        expected_duration_minutes=expected_duration_minutes,
        language=language,
        constraints=constraints,
        outline=outline,
        status="draft",
    )
    session.add(draft)
    session.flush()
    return draft


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
            source_url = obj.object_metadata.get("source_url", "")
            embed_url = _youtube_embed(source_url)
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

    concept_tokens = [token for token in tokenize(section_title) if len(token) > 3][:3]
    blocks.append(_build_quiz_for_section(section_title, concept_tokens))
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
            section_rows.append(
                {
                    "id": section_id,
                    "title": section["title"],
                    "learningObjectives": section.get("learning_objectives", []),
                    "estimatedMinutes": section.get("estimated_minutes", 20),
                    "content": blocks,
                    "citations": citations,
                }
            )
            section_source_map[section_id] = selected_ids
            citation_map[section_id] = citations

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
            "targetAudience": draft.target_audience,
            "durationMinutes": draft.expected_duration_minutes,
            "difficulty": draft.difficulty,
            "language": draft.language,
            "status": "generated",
            "version": 1,
            "learningGoals": draft.learning_goals,
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
            {
                "id": "assistant",
                "name": "Lycium Assistant",
                "role": "assistant",
                "style": "concise",
                "voice": "neutral",
                "enabled": True,
            },
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
        constraints={
            "source_policy": source_policy,
            "free_only": free_only,
            "trust_min": trust_min,
        },
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


def ask_instructor(
    course: CourseSnapshot,
    *,
    section_id: str,
    question: str,
    response_mode: str,
) -> dict[str, Any]:
    modules = course.structure.get("modules", [])
    section: dict[str, Any] | None = None
    for module in modules:
        for row in module.get("sections", []):
            if row.get("id") == section_id:
                section = row
                break
        if section is not None:
            break

    if section is None:
        raise ValueError(f"section_id '{section_id}' not found")

    text_blocks = [block.get("value", "") for block in section.get("content", []) if block.get("type") == "text"]
    context = " ".join(text_blocks).strip()
    context_excerpt = context[:500] if context else "No section context was available."

    if response_mode == "concise":
        answer = (
            f"{section['title']}: {context_excerpt[:220]} "
            f"Focus answer to your question ({question}): review the core concept and its quiz checkpoint."
        )
    elif response_mode == "deep":
        answer = (
            f"{section['title']} detailed walkthrough: {context_excerpt} "
            f"To answer '{question}', connect the definition, why it matters, and how to apply it in practice. "
            "Use the cited sources for verification and compare at least two perspectives."
        )
    else:
        answer = (
            f"Example for '{question}': take the concept in '{section['title']}', "
            "build a tiny scenario where you apply it, verify with the section quiz, "
            "then extend the scenario one level harder."
        )

    return {
        "section_id": section_id,
        "answer": answer.strip(),
        "citations": section.get("citations", []),
        "mode": response_mode,
    }


def generate_program(
    session: Session,
    *,
    goal: str,
    learner_id: int | None,
    level: str | None,
    free_only: bool,
    source_policy: str,
    trust_min: float,
    desired_course_count: int,
) -> ProgramSnapshot:
    core_terms = [term for term in tokenize(goal) if len(term) > 3][:desired_course_count]
    if not core_terms:
        core_terms = ["foundation", "practice", "project"]

    courses = []
    for idx, term in enumerate(core_terms[:desired_course_count], start=1):
        packet = assemble_learning_packet(
            session,
            query=f"{goal} {term}",
            top_k=8,
            free_only=free_only,
            trust_min=trust_min,
            level=level,
        )
        courses.append(
            {
                "course_id": _stable_id("course", goal, term, str(idx)),
                "title": f"{term.title()} Track",
                "milestone_order": idx,
                "capstone": idx == len(core_terms[:desired_course_count]),
                "learning_packet": packet,
            }
        )

    structure = {
        "goal": goal,
        "level": level,
        "source_policy": source_policy,
        "courses": courses,
        "credential_checkpoints": [
            {"name": "Foundation checkpoint", "after_milestone": 1},
            {"name": "Capstone checkpoint", "after_milestone": len(courses)},
        ],
    }

    program = ProgramSnapshot(
        learner_id=learner_id,
        title=f"Program: {_title_from_prompt(goal)}",
        goal=goal,
        level=level,
        status="generated",
        structure=structure,
    )
    session.add(program)
    session.flush()
    return program


def validate_learner_exists(session: Session, learner_id: int | None) -> None:
    if learner_id is None:
        return
    learner = session.get(Learner, learner_id)
    if learner is None:
        raise ValueError(f"learner_id '{learner_id}' does not exist")
