from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.course_quiz_blocks import normalize_quiz_block
from app.course_generation_workflow import run_course_generation_workflow
from app.course_source_gaps import create_needs_sources_course_snapshot, source_count_meets_minimum, update_needs_sources_course_snapshot
from app.course_quality import assess_course_quality
from app.course_section_generation import _build_section_content, _source_ids_from_citations, _source_records_from_citations, _source_records_from_input_urls, _source_slot_for_section, _with_source_ids
from app.generation_helpers import COURSE_GENERATION_RULES, _build_module_summary_section, _build_quiz_for_section, _catalog_metadata_from_prompt, _ensure_minimum_outline_modules, _stable_id
from app.generation_outline import create_draft
from app.models import CourseDraft, CourseSnapshot
from app.retrieval import tokenize


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
    source_slots: list[dict[str, Any]] = []

    for module in _ensure_minimum_outline_modules(outline.get("modules", [])):
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
            source_ids = _source_ids_from_citations(citations)
            source_slot = _source_slot_for_section(section_id, section["title"], source_ids)
            if source_slot:
                source_slots.append(source_slot)
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
                    "sourceIds": source_ids,
                    "learningObjectives": section.get("learning_objectives", []),
                    "estimatedMinutes": section.get("estimated_minutes", 20),
                    "content": [*_with_source_ids(blocks, source_ids), concept_card_block],
                    "citations": citations,
                }
            )
            section_source_map[section_id] = selected_ids
            citation_map[section_id] = citations

            concept_tokens = [token for token in tokenize(section["title"]) if len(token) > 3][:3]
            quiz_section_id = _stable_id("q", section_id, section["title"])
            quiz_block = normalize_quiz_block(_build_quiz_for_section(section["title"], concept_tokens))
            if source_ids:
                quiz_block["sourceIds"] = source_ids
            section_rows.append(
                {
                    "id": quiz_section_id,
                    "title": f"Quiz: {section['title']}",
                    "sourceIds": source_ids,
                    "learningObjectives": [],
                    "estimatedMinutes": 10,
                    "content": [quiz_block],
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
        module_source_ids = sorted(
            {
                source_id
                for section in section_rows
                for source_id in section.get("sourceIds", [])
                if isinstance(source_id, str)
            }
        )
        modules.append(
            {
                "id": module["id"],
                "title": module["title"],
                "sourceIds": module_source_ids,
                "learningObjectives": module.get("learning_objectives", []),
                "sections": section_rows,
            }
        )

    submitted_source_urls = draft.constraints.get("source_urls")
    if not isinstance(submitted_source_urls, list):
        submitted_source_urls = []
    input_source_records = _source_records_from_input_urls([str(url) for url in submitted_source_urls], draft.title)
    source_records_by_id = {
        source_record["id"]: source_record
        for source_record in [*_source_records_from_citations(citation_map, draft.title), *input_source_records]
    }
    source_records = list(source_records_by_id.values())
    course_source_ids = [source["id"] for source in source_records]
    catalog_metadata = _catalog_metadata_from_prompt(draft.prompt)
    requested_category = draft.constraints.get("category")
    requested_department = draft.constraints.get("department")
    structure = {
        "title": draft.title,
        "shortDescription": outline.get("shortDescription") or outline.get("summary") or f"A generated Lycium course for {draft.title}.",
        "difficultyLevel": draft.difficulty or "beginner",
        "category": requested_category if isinstance(requested_category, str) and requested_category else catalog_metadata["category"],
        "department": requested_department if isinstance(requested_department, str) and requested_department else catalog_metadata["department"],
        "tags": catalog_metadata["tags"],
        "learningTypes": [],
        "orderMandatory": bool(draft.constraints.get("order_mandatory", False)),
        "sourceIds": course_source_ids,
        "sourceRecords": source_records,
        "metadata": {
            "prompt": draft.prompt,
            "retrievalPolicy": {
                "candidateRanking": "intent-aware",
                "sourceSelection": "source-diversified",
                "levelFallback": "strict-then-unscoped",
            },
            "sourceSlots": source_slots,
            "sourceCoverageTrace": {
                "sourceSlotCount": len(source_slots),
                "sectionSourceMap": {
                    section_id: _source_ids_from_citations(citations)
                    for section_id, citations in citation_map.items()
                    if _source_ids_from_citations(citations)
                },
                "knowledgeObjectMap": section_source_map,
            },
            "pacingLabel": "Module",
            "targetAudience": draft.target_audience,
            "durationMinutes": draft.expected_duration_minutes,
            "scope": {
                "audience": draft.target_audience or "self-directed learner",
                "level": draft.difficulty or "undergrad",
                "duration": f"{draft.expected_duration_minutes} minutes",
                "outcome": outline.get("summary") or f"Complete a structured introduction to {draft.title}.",
            },
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
    workflow_report = run_course_generation_workflow(structure)
    source_gate = next((gate for gate in workflow_report.gates if gate.gate == "source_analysis"), None)
    if source_gate and source_gate.status == "failed":
        snapshot = CourseSnapshot(
            learner_id=learner_id,
            draft_id=draft.id,
            title=draft.title,
            prompt=draft.prompt,
            language=draft.language,
            level=draft.difficulty,
            source_policy=source_policy,
            status="needs_sources",
            version=1,
            structure=structure,
            generation_trace={**trace, "workflow_report": workflow_report.model_dump()},
        )
        session.add(snapshot)
        session.flush()
        draft.status = "needs_sources"
        return update_needs_sources_course_snapshot(
            snapshot,
            source_urls=[str(url) for url in submitted_source_urls],
            source_gate=source_gate.model_dump(),
        )

    quality_report = assess_course_quality(structure, gate="review")
    snapshot = CourseSnapshot(
        learner_id=learner_id,
        draft_id=draft.id,
        title=draft.title,
        prompt=draft.prompt,
        language=draft.language,
        level=draft.difficulty,
        source_policy=source_policy,
        status="ready_for_review" if quality_report["passed"] else "needs_revision",
        version=1,
        structure=structure,
        generation_trace={**trace, "quality_report": quality_report},
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
    source_urls: list[str] | None = None,
    category: str | None = None,
    department: str | None = None,
) -> CourseSnapshot:
    if not source_count_meets_minimum(source_urls):
        return create_needs_sources_course_snapshot(
            session,
            prompt=prompt,
            learner_id=learner_id,
            level=level,
            language=language,
            source_policy=source_policy,
            desired_module_count=desired_module_count,
            expected_duration_minutes=expected_duration_minutes,
            source_urls=source_urls,
            category=category,
            department=department,
        )

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
            "source_urls": source_urls or [],
            "category": category,
            "department": department,
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
        source_urls=[],
    )
