from __future__ import annotations

from app.config import SETTINGS
from app.course_agent_assembly import (
    _coerce_generated_section,
    _coerce_media_block,
    _insert_media_block,
    _model_json,
    _module_lesson_titles,
    _partial_course_from_stages,
)
from app.course_agent_assessment_prompting import _staged_quiz_messages, _staged_summary_messages
from app.course_agent_lesson_prompting import _staged_lesson_messages, _staged_media_messages
from app.course_agent_types import CourseAgentError

DEFAULT_MODULE_PARALLELISM = 2


def _plan_timeout_seconds(desired_module_count: int) -> float:
    scaled_timeout = 180 + (max(1, desired_module_count) * 25)
    return max(SETTINGS.agent_timeout_seconds, min(720, scaled_timeout))


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
        for block in content:
            if isinstance(block, dict) and block.get("type") in {"conceptCards", "concept_cards"}:
                block["title"] = expected_title
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
) -> dict:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    sections: list[dict] = []
    module_usage: list[dict] = []
    stages: list[dict] = []
    media_logs: list[dict] = []

    for lesson_index, lesson_title in enumerate(_module_lesson_titles(module_outline), start=1):
        stage = f"module_{module_number}_lesson_{lesson_index}"
        try:
            section, section_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=selected_model,
                stage=stage,
                messages=_staged_lesson_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=module_number,
                    lesson_number=lesson_index,
                    lesson_title=lesson_title,
                    source_urls=source_urls,
                ),
            )
        except CourseAgentError as exc:
            partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
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
        section = _coerce_generated_section(
            section,
            fallback_id=f"module-{module_number}-lesson-{lesson_index}",
            fallback_title=lesson_title,
            page_type="learn",
            section_type="lesson",
            source_ids=source_ids,
        )
        sections.append(section)
        module_usage.append({"stage": stage, "usage": section_response.get("usage", {})})
        stages.append({"stage": stage, "status": "passed", "section_id": section.get("id"), "section_title": section.get("title")})

    media_stage = f"module_{module_number}_media"
    try:
        media_payload, media_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=media_stage,
            messages=_staged_media_messages(
                plan=plan,
                module_outline=module_outline,
                module_number=module_number,
                lesson_sections=sections,
                source_urls=source_urls,
            ),
        )
        media_block, media_skip_reason = _coerce_media_block(media_payload, source_ids)
        if media_block and _insert_media_block(sections, media_block):
            module_usage.append({"stage": media_stage, "usage": media_response.get("usage", {})})
            stages.append({"stage": media_stage, "status": "passed", "block_title": media_block.get("title")})
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
    try:
        quiz_section, quiz_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=quiz_stage,
            messages=_staged_quiz_messages(
                plan=plan,
                module_outline=module_outline,
                module_number=module_number,
                lesson_sections=sections,
                source_urls=source_urls,
            ),
        )
    except CourseAgentError as exc:
        partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
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
        source_ids=source_ids,
    )
    sections.append(quiz_section)
    module_usage.append({"stage": quiz_stage, "usage": quiz_response.get("usage", {})})
    stages.append({"stage": quiz_stage, "status": "passed", "section_id": quiz_section.get("id")})

    summary_stage = f"module_{module_number}_summary"
    try:
        summary_section, summary_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=summary_stage,
                messages=_staged_summary_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=module_number,
                    lesson_sections=sections,
                    source_urls=source_urls,
                    pacing_label=pacing_label,
                ),
            )
    except CourseAgentError as exc:
        partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
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
    summary_section = _coerce_generated_section(
        summary_section,
        fallback_id=f"module-{module_number}-summary",
        fallback_title=f"{pacing_label} {module_number} Concept Review",
        page_type="learn",
        section_type="summary",
        source_ids=source_ids,
    )
    summary_section = _normalize_summary_for_pacing(summary_section, pacing_label)
    sections.append(summary_section)
    module_usage.append({"stage": summary_stage, "usage": summary_response.get("usage", {})})
    stages.append({"stage": summary_stage, "status": "passed", "section_id": summary_section.get("id")})

    module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
    stages.append({"stage": f"module_{module_number}", "status": "assembled", "module_id": module_id, "module_title": module_title})
    return {
        "module_number": module_number,
        "module": module,
        "usage": module_usage,
        "stages": stages,
        "media_logs": media_logs,
    }
