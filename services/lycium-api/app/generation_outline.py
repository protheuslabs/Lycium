from __future__ import annotations

import re
from collections import defaultdict
from statistics import mean
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.generation_helpers import _extract_goals, _stable_id, _title_from_prompt
from app.models import CourseDraft, KnowledgeObject
from app.retrieval import assemble_learning_packet, intent_relevance_score, rank_by_intent, tokenize


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
    if not packet["object_ids"] and level:
        packet = assemble_learning_packet(
            session,
            query=prompt,
            top_k=max(desired_module_count * 4, 12),
            free_only=free_only,
            trust_min=trust_min,
            level=None,
        )
    if not packet["object_ids"]:
        return []
    objects = list(session.scalars(select(KnowledgeObject).where(KnowledgeObject.id.in_(packet["object_ids"]))))
    return rank_by_intent(objects, query=prompt)


def _fallback_outline(prompt: str, module_count: int, _goals: list[str]) -> dict[str, Any]:
    title = _title_from_prompt(prompt)
    subject = re.sub(r"\s+course$", "", title, flags=re.IGNORECASE).strip() or title
    module_arcs = [
        ("Foundations", ["Orientation and vocabulary", "Why the subject matters", "Foundational ideas"]),
        ("Core Concepts", ["Essential concepts", "How the concepts connect", "Recognizing the concepts in context"]),
        ("Models and Processes", ["Key models", "Common processes", "Choosing an appropriate model"]),
        ("Methods and Tools", ["Core methods", "Using common tools", "Selecting a method"]),
        ("Applied Practice", ["A guided application", "Working through constraints", "Reviewing an applied result"]),
        ("Analysis and Reasoning", ["Breaking down a problem", "Comparing alternatives", "Supporting a conclusion"]),
        ("Common Challenges", ["Frequent misconceptions", "Failure modes", "Troubleshooting an approach"]),
        ("Systems and Context", ["The wider system", "Stakeholders and constraints", "Context-sensitive decisions"]),
        ("Evaluation", ["Quality criteria", "Measuring outcomes", "Improving from evidence"]),
        ("Advanced Applications", ["Complex scenarios", "Combining methods", "Adapting to new conditions"]),
        ("Integration", ["Connecting the course ideas", "Planning an end-to-end approach", "Explaining key tradeoffs"]),
        ("Capstone Practice", ["Defining a capstone problem", "Building a defensible solution", "Reflecting and revising"]),
    ]
    modules: list[dict[str, Any]] = []
    for module_idx in range(1, module_count + 1):
        arc_name, section_patterns = module_arcs[(module_idx - 1) % len(module_arcs)]
        cycle = (module_idx - 1) // len(module_arcs)
        arc_label = arc_name if cycle == 0 else f"{arc_name}, Continued"
        module_title = f"Module {module_idx}: {arc_label} of {subject}"
        module_id = _stable_id("m", title, module_title, str(module_idx))
        sections = []
        for section_idx, section_pattern in enumerate(section_patterns, start=1):
            section_title = f"{section_pattern} in {subject}"
            section_id = _stable_id("s", module_id, section_title, str(section_idx))
            sections.append(
                {
                    "id": section_id,
                    "title": section_title,
                    "learning_objectives": [f"Explain and apply {section_pattern.lower()} in {subject}."],
                    "concept_keywords": [
                        token for token in tokenize(f"{section_pattern} {subject}") if len(token) > 3
                    ][:5],
                    "estimated_minutes": 20,
                }
            )
        modules.append(
            {
                "id": module_id,
                "title": module_title,
                "learning_objectives": [
                    f"Explain the role of {arc_name.lower()} in {subject}.",
                    f"Apply {arc_name.lower()} to a realistic {subject} problem.",
                ],
                "sections": sections,
            }
        )

    return {
        "title": title,
        "shortDescription": f"A structured course covering the foundations, core concepts, applications, and evaluation of {subject}.",
        "summary": f"A progressive introduction to {subject}, from foundational vocabulary through integrated practice.",
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
    goals = _extract_goals(prompt, learning_goals, [tok for tok in tokenize(prompt) if len(tok) > 3])
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
        key=lambda item: (
            mean(intent_relevance_score(node, query=prompt) for node in item[1]),
            len({node.source_id for node in item[1]}),
            mean(node.trust_score for node in item[1]),
        ),
        reverse=True,
    )[:desired_module_count]

    modules: list[dict[str, Any]] = []
    for module_idx, (topic, topic_objects) in enumerate(sorted_topics, start=1):
        topic_objects = rank_by_intent(topic_objects, query=prompt, context=topic)
        module_id = _stable_id("m", title, topic, str(module_idx))
        module_title = f"Module {module_idx}: {topic}"
        module_objectives = list(
            dict.fromkeys(
                objective for obj in topic_objects for objective in obj.learning_outcomes[:2] if objective
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
                    "learning_objectives": obj.learning_outcomes[:3] or [f"Apply concept from {section_title.lower()}"],
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
        "shortDescription": f"A personalized course covering the foundations and applications of {title}.",
        "summary": f"A progressive draft outline for {title}.",
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
        learning_goals=_extract_goals(prompt, learning_goals, [tok for tok in tokenize(prompt) if len(tok) > 3]),
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
