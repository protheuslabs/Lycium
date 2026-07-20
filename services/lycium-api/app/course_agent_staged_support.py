from __future__ import annotations

from app.config import SETTINGS
from app.course_agent_assembly import (
    _coerce_generated_section,
    _coerce_media_block,
    _insert_media_block,
    _model_json,
    _module_lesson_outlines,
    _partial_course_from_stages,
    _source_ids_from_outline,
)
from app.course_agent_assessment_prompting import _staged_quiz_messages, _staged_summary_messages
from app.course_agent_lesson_prompting import _staged_lesson_messages, _staged_media_messages
from app.course_agent_source_context import compact_source_context_for_stage
from app.course_agent_types import CourseAgentError

DEFAULT_MODULE_PARALLELISM = 2


def _string_list(value: object) -> list[str]:
    return [str(item) for item in value if str(item).strip()] if isinstance(value, list) else []


def _with_generation_outline_metadata(
    section: dict,
    *,
    module_outline: dict,
    section_outline: dict | None,
    source_ids: list[str],
    role: str,
) -> dict:
    existing_metadata = section.get("metadata") if isinstance(section.get("metadata"), dict) else {}
    section_outline = section_outline if isinstance(section_outline, dict) else {}
    generation_outline = {
        "contractVersion": "section-generation-outline-v1",
        "role": role,
        "planningSource": str(section_outline.get("planningSource") or module_outline.get("planningSource") or "model_plan"),
        "moduleOutlineId": str(module_outline.get("id") or ""),
        "moduleOutlineTitle": str(module_outline.get("title") or ""),
        "sectionOutlineId": str(section_outline.get("id") or ""),
        "sectionOutlineTitle": str(section_outline.get("title") or ""),
        "plannedDescription": str(section_outline.get("description") or ""),
        "plannedConceptKeywords": _string_list(
            section_outline.get("concept_keywords") or section_outline.get("conceptKeywords")
        ),
        "plannedLearningObjectives": _string_list(
            section_outline.get("learning_objectives") or section_outline.get("learningObjectives")
        ),
        "plannedSourceIds": list(source_ids),
    }
    return {
        **section,
        "metadata": {
            **existing_metadata,
            "generationOutline": generation_outline,
        },
    }


def _plan_timeout_seconds(desired_module_count: int) -> float:
    scaled_timeout = 180 + (max(1, desired_module_count) * 25)
    return max(SETTINGS.agent_timeout_seconds, min(720, scaled_timeout))


def _bounded_timeout_seconds(timeout_seconds: float, max_stage_timeout_seconds: float | None = None) -> float:
    if max_stage_timeout_seconds is None:
        return timeout_seconds
    return max(1.0, min(timeout_seconds, float(max_stage_timeout_seconds)))


def _infer_pacing_label(plan: dict) -> str:
    explicit = str(plan.get("pacingLabel") or "").strip()
    if explicit in {"Module", "Week"}:
        return explicit
    modules = plan.get("modules") if isinstance(plan.get("modules"), list) else []
    titles = [str(module.get("title") or "") for module in modules if isinstance(module, dict)]
    if any(title.startswith("Week ") for title in titles):
        return "Week"
    return "Module"


def _normalize_summary_for_pacing(summary_section: dict, pacing_label: str) -> dict:
    expected_title = f"{pacing_label} concepts"
    content = summary_section.get("content")
    if isinstance(content, list):
        has_concepts = False
        has_summary_heading = False
        first_concept_index: int | None = None

        for index, block in enumerate(content):
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type in {"conceptCard", "concept_card", "conceptCards", "concept_cards"}:
                has_concepts = True
                if first_concept_index is None:
                    first_concept_index = index
            if block_type == "heading" and str(block.get("title") or "").strip() in {
                "Module concepts",
                "Week concepts",
                "Concepts introduced",
                expected_title,
            }:
                block["title"] = expected_title
                has_summary_heading = True
            if block_type in {"conceptCards", "concept_cards"}:
                block["title"] = expected_title
        if has_concepts and not has_summary_heading:
            insert_index = first_concept_index if first_concept_index is not None else 0
            content.insert(insert_index, {"type": "heading", "title": expected_title})
    return summary_section


def _resume_modules_from_course(resume_course: dict | None, desired_module_count: int) -> list[dict]:
    if not isinstance(resume_course, dict):
        return []
    modules = resume_course.get("modules")
    if not isinstance(modules, list):
        return []
    return [module for module in modules[:desired_module_count] if isinstance(module, dict)]


def _resume_trace(value: dict | None) -> dict:
    return value if isinstance(value, dict) else {}


def _failure_trace_context(exc: CourseAgentError) -> dict:
    trace = getattr(exc, "trace", {})
    if not isinstance(trace, dict):
        return {}
    return {key: value for key, value in trace.items() if key not in {"stages", "partial_course"}}


def _source_context_stats(source_context: dict | None) -> dict:
    if not isinstance(source_context, dict):
        return {"sourceContextSourceCount": 0, "sourceContextCharCount": 0}
    sources = source_context.get("sources") if isinstance(source_context.get("sources"), list) else []
    return {
        "sourceContextSourceCount": len(sources),
        "sourceContextCharCount": sum(len(str(source.get("excerpt") or "")) for source in sources if isinstance(source, dict)),
    }


def _strip_source_ids(value: object) -> object:
    if isinstance(value, dict):
        return {key: _strip_source_ids(child) for key, child in value.items() if key != "sourceIds"}
    if isinstance(value, list):
        return [_strip_source_ids(child) for child in value]
    return value


def _unique_source_ids_from_value(value: object) -> list[str]:
    source_ids: list[str] = []
    if isinstance(value, dict):
        raw_source_ids = value.get("sourceIds")
        if isinstance(raw_source_ids, list):
            source_ids.extend(str(source_id).strip() for source_id in raw_source_ids if str(source_id).strip())
        for child in value.values():
            source_ids.extend(_unique_source_ids_from_value(child))
    elif isinstance(value, list):
        for child in value:
            source_ids.extend(_unique_source_ids_from_value(child))

    unique: list[str] = []
    seen: set[str] = set()
    for source_id in source_ids:
        if source_id in seen:
            continue
        seen.add(source_id)
        unique.append(source_id)
    return unique


def _filter_source_ids(value: object, allowed_source_ids: set[str]) -> object:
    if isinstance(value, dict):
        filtered: dict[str, object] = {}
        for key, child in value.items():
            if key == "sourceIds":
                source_ids = [
                    str(source_id).strip()
                    for source_id in child
                    if str(source_id).strip() in allowed_source_ids
                ] if isinstance(child, list) else []
                if source_ids:
                    filtered[key] = list(dict.fromkeys(source_ids))
                continue
            filtered[key] = _filter_source_ids(child, allowed_source_ids)
        return filtered
    if isinstance(value, list):
        return [_filter_source_ids(child, allowed_source_ids) for child in value]
    return value


def _normalize_explicit_source_refs(section: dict, raw_section: dict, planned_source_ids: list[str]) -> dict:
    planned = set(planned_source_ids)
    explicit_source_ids = [
        source_id
        for source_id in _unique_source_ids_from_value(raw_section)
        if not planned or source_id in planned
    ]
    filtered = _filter_source_ids(section, set(explicit_source_ids))
    local_source_ids = _unique_source_ids_from_value(filtered)
    if local_source_ids:
        filtered["sourceIds"] = local_source_ids
    else:
        filtered.pop("sourceIds", None)
    return filtered


def _generate_module_bundle(
    *,
    provider: dict,
    api_key: str,
    adapter: str,
    selected_model: str,
    plan: dict,
    module_outline: dict,
    module_number: int,
    source_urls: list[str] | None,
    source_ids: list[str],
    source_records: list[dict[str, object]],
    existing_modules: list[dict],
    level: str | None,
    pacing_label: str,
    max_stage_timeout_seconds: float | None = None,
    source_context_index: dict[str, dict] | None = None,
) -> dict:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    module_source_ids = _source_ids_from_outline(module_outline, source_ids)
    sections: list[dict] = []
    module_usage: list[dict] = []
    stages: list[dict] = []
    media_logs: list[dict] = []

    for lesson_index, lesson_outline in enumerate(_module_lesson_outlines(module_outline), start=1):
        lesson_title = str(lesson_outline.get("title") or f"Lesson {lesson_index}")
        lesson_source_ids = _source_ids_from_outline(lesson_outline, module_source_ids)
        stage = f"module_{module_number}_lesson_{lesson_index}"
        lesson_source_context = compact_source_context_for_stage(
            source_context_index=source_context_index or {},
            source_ids=lesson_source_ids,
            query_values=[plan.get("title"), module_title, module_outline, lesson_title, lesson_outline],
        )
        try:
            section, section_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=selected_model,
                stage=stage,
                timeout_seconds=max_stage_timeout_seconds,
                messages=_staged_lesson_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=module_number,
                    lesson_number=lesson_index,
                    lesson_title=lesson_title,
                    lesson_outline=lesson_outline,
                    available_source_ids=lesson_source_ids,
                    source_urls=source_urls,
                    source_context=lesson_source_context,
                ),
            )
        except CourseAgentError as exc:
            partial_module = {"id": module_id, "title": module_title, "sourceIds": module_source_ids, "sections": sections}
            partial_course = _partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=[*existing_modules, partial_module],
                level=level,
            )
            stages.append(
                {
                    "stage": stage,
                    "status": "failed",
                    "module_outline": module_outline,
                    "completed_section_count": len(sections),
                    "error": str(exc),
                }
            )
            raise CourseAgentError(str(exc), trace={**getattr(exc, "trace", {}), "stages": stages, "partial_course": partial_course}) from exc
        raw_section = section
        section = _coerce_generated_section(
            section,
            fallback_id=f"module-{module_number}-lesson-{lesson_index}",
            fallback_title=lesson_title,
            page_type="learn",
            section_type="lesson",
            source_ids=lesson_source_ids,
        )
        section = _normalize_explicit_source_refs(section, raw_section, lesson_source_ids)
        section = _with_generation_outline_metadata(
            section,
            module_outline=module_outline,
            section_outline=lesson_outline,
            source_ids=lesson_source_ids,
            role="lesson",
        )
        sections.append(section)
        module_usage.append({"stage": stage, "usage": section_response.get("usage", {})})
        stages.append(
            {
                "stage": stage,
                "status": "passed",
                "section_id": section.get("id"),
                "section_title": section.get("title"),
                **_source_context_stats(lesson_source_context),
            }
        )

    media_stage = f"module_{module_number}_media"
    media_source_context = compact_source_context_for_stage(
        source_context_index=source_context_index or {},
        source_ids=module_source_ids,
        query_values=[plan.get("title"), module_title, module_outline, [section.get("title") for section in sections]],
    )
    try:
        media_payload, media_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=media_stage,
            timeout_seconds=max_stage_timeout_seconds,
            messages=_staged_media_messages(
                plan=plan,
                module_outline=module_outline,
                module_number=module_number,
                lesson_sections=sections,
                available_source_ids=module_source_ids,
                source_urls=source_urls,
                source_context=media_source_context,
            ),
        )
        media_block, media_skip_reason = _coerce_media_block(media_payload, module_source_ids)
        if media_block and _insert_media_block(sections, media_block):
            module_usage.append({"stage": media_stage, "usage": media_response.get("usage", {})})
            stages.append(
                {
                    "stage": media_stage,
                    "status": "passed",
                    "block_title": media_block.get("title"),
                    **_source_context_stats(media_source_context),
                }
            )
        else:
            media_logs.append(
                {
                    "stage": media_stage,
                    "status": "skipped",
                    "module_id": module_id,
                    "module_title": module_title,
                    "reason": media_skip_reason or "Media block could not be inserted.",
                }
            )
            stages.append({"stage": media_stage, "status": "skipped", "reason": media_skip_reason})
    except CourseAgentError as exc:
        media_logs.append(
            {
                "stage": media_stage,
                "status": "failed_nonfatal",
                "module_id": module_id,
                "module_title": module_title,
                "error": str(exc),
                "trace": getattr(exc, "trace", {}),
            }
        )
        stages.append({"stage": media_stage, "status": "failed_nonfatal", "error": str(exc)})

    quiz_stage = f"module_{module_number}_quiz"
    quiz_source_context = compact_source_context_for_stage(
        source_context_index=source_context_index or {},
        source_ids=module_source_ids,
        query_values=[plan.get("title"), module_title, module_outline, sections],
    )
    try:
        quiz_section, quiz_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=quiz_stage,
            timeout_seconds=max_stage_timeout_seconds,
            messages=_staged_quiz_messages(
                plan=plan,
                module_outline=module_outline,
                module_number=module_number,
                lesson_sections=sections,
                available_source_ids=module_source_ids,
                source_urls=source_urls,
                source_context=quiz_source_context,
            ),
        )
    except CourseAgentError as exc:
        partial_module = {"id": module_id, "title": module_title, "sourceIds": module_source_ids, "sections": sections}
        partial_course = _partial_course_from_stages(
            plan=plan,
            source_records=source_records,
            modules=[*existing_modules, partial_module],
            level=level,
        )
        stages.append(
            {
                "stage": quiz_stage,
                "status": "failed",
                "module_outline": module_outline,
                "completed_section_count": len(sections),
                "error": str(exc),
            }
        )
        raise CourseAgentError(str(exc), trace={**getattr(exc, "trace", {}), "stages": stages, "partial_course": partial_course}) from exc
    quiz_section = _coerce_generated_section(
        quiz_section,
        fallback_id=f"module-{module_number}-quiz",
        fallback_title=f"Quiz: {module_title}",
        page_type="apply",
        section_type="assessment",
        source_ids=[],
    )
    quiz_section = _strip_source_ids(quiz_section)
    quiz_section = _with_generation_outline_metadata(
        quiz_section,
        module_outline=module_outline,
        section_outline=None,
        source_ids=[],
        role="assessment",
    )
    quiz_section = _strip_source_ids(quiz_section)
    sections.append(quiz_section)
    module_usage.append({"stage": quiz_stage, "usage": quiz_response.get("usage", {})})
    stages.append({"stage": quiz_stage, "status": "passed", "section_id": quiz_section.get("id"), **_source_context_stats(quiz_source_context)})

    summary_stage = f"module_{module_number}_summary"
    summary_source_context = compact_source_context_for_stage(
        source_context_index=source_context_index or {},
        source_ids=module_source_ids,
        query_values=[plan.get("title"), module_title, module_outline, sections],
    )
    try:
        summary_section, summary_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=summary_stage,
            timeout_seconds=max_stage_timeout_seconds,
            messages=_staged_summary_messages(
                plan=plan,
                module_outline=module_outline,
                module_number=module_number,
                lesson_sections=sections,
                available_source_ids=module_source_ids,
                source_urls=source_urls,
                pacing_label=pacing_label,
                source_context=summary_source_context,
            ),
        )
    except CourseAgentError as exc:
        partial_module = {"id": module_id, "title": module_title, "sourceIds": module_source_ids, "sections": sections}
        partial_course = _partial_course_from_stages(
            plan=plan,
            source_records=source_records,
            modules=[*existing_modules, partial_module],
            level=level,
        )
        stages.append(
            {
                "stage": summary_stage,
                "status": "failed",
                "module_outline": module_outline,
                "completed_section_count": len(sections),
                "error": str(exc),
            }
        )
        raise CourseAgentError(str(exc), trace={**getattr(exc, "trace", {}), "stages": stages, "partial_course": partial_course}) from exc
    raw_summary_section = summary_section
    summary_section = _coerce_generated_section(
        summary_section,
        fallback_id=f"module-{module_number}-summary",
        fallback_title=f"{pacing_label} {module_number} Concept Review",
        page_type="learn",
        section_type="summary",
        source_ids=module_source_ids,
    )
    summary_section = _normalize_explicit_source_refs(summary_section, raw_summary_section, module_source_ids)
    summary_section = _with_generation_outline_metadata(
        summary_section,
        module_outline=module_outline,
        section_outline=None,
        source_ids=module_source_ids,
        role="summary",
    )
    summary_section = _normalize_summary_for_pacing(summary_section, pacing_label)
    summary_source_ids = _unique_source_ids_from_value(summary_section)
    if summary_source_ids:
        summary_section["sourceIds"] = summary_source_ids
    else:
        summary_section.pop("sourceIds", None)
    sections.append(summary_section)
    module_usage.append({"stage": summary_stage, "usage": summary_response.get("usage", {})})
    stages.append(
        {
            "stage": summary_stage,
            "status": "passed",
            "section_id": summary_section.get("id"),
            **_source_context_stats(summary_source_context),
        }
    )

    module = {"id": module_id, "title": module_title, "sourceIds": module_source_ids, "sections": sections}
    stages.append({"stage": f"module_{module_number}", "status": "assembled", "module_id": module_id, "module_title": module_title})
    return {
        "module_number": module_number,
        "module": module,
        "usage": module_usage,
        "stages": stages,
        "media_logs": media_logs,
    }
