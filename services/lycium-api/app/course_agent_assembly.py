
from __future__ import annotations

import json
from typing import Any, Callable

from app.course_agent_contract import normalize_course
from app.course_agent_providers import call_agent_model
from app.course_agent_response import extract_message_content, json_from_model_text
from app.course_agent_types import CourseAgentError

CourseGenerationCheckpoint = Callable[[dict[str, Any]], None]


def _input_source_records(source_urls: list[str] | None, course_title: str) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for index, source_url in enumerate(source_urls or [], start=1):
        records.append(
            {
                "id": f"input-source-{index}",
                "type": "web",
                "title": f"Submitted source {index}",
                "url": source_url,
                "usedByCourseTitles": [course_title],
            }
        )
    return records


def _merge_input_sources(course: dict, source_urls: list[str] | None) -> dict:
    input_records = _input_source_records(source_urls, str(course.get("title") or "Generated course"))
    if not input_records:
        return course

    existing_records = course.get("sourceRecords")
    records = existing_records if isinstance(existing_records, list) else []
    existing_ids = {str(record.get("id")) for record in records if isinstance(record, dict) and record.get("id")}
    merged_records = [*records, *[record for record in input_records if str(record["id"]) not in existing_ids]]
    source_ids = [source_id for source_id in course.get("sourceIds", []) if isinstance(source_id, str)]
    merged_source_ids = list(dict.fromkeys([*source_ids, *[str(record["id"]) for record in input_records]]))
    return {**course, "sourceRecords": merged_records, "sourceIds": merged_source_ids}


def _model_json(
    *,
    provider: dict,
    api_key: str,
    adapter: str,
    model: str,
    messages: list[dict[str, str]],
    stage: str,
    timeout_seconds: float | None = None,
) -> tuple[dict, dict]:
    try:
        response = call_agent_model(provider, api_key, messages, model, timeout_seconds=timeout_seconds)
        return json_from_model_text(extract_message_content(response, adapter)), response
    except CourseAgentError as exc:
        raise CourseAgentError(
            str(exc),
            trace={"failed_stage": stage, **getattr(exc, "trace", {})},
        ) from exc
    except ValueError as exc:
        raise CourseAgentError(
            f"LLM response could not be parsed as course JSON: {exc}",
            trace={"failed_stage": stage},
        ) from exc


def _base_agent_trace(
    *,
    provider: dict,
    adapter: str,
    selected_model: str,
    model_capability: dict,
    mode: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_urls: list[str] | None,
) -> dict:
    return {
        "mode": mode,
        "provider": provider.get("id"),
        "provider_label": provider.get("label"),
        "generation_adapter": adapter,
        "model": selected_model,
        "model_capability": model_capability,
        "behavioral_contract": "COURSE_AGENT_CONTRACT.md",
        "desired_module_count": desired_module_count,
        "expected_duration_minutes": expected_duration_minutes,
        "source_urls": source_urls or [],
    }


def _partial_course_from_stages(
    *,
    plan: dict | None,
    source_records: list[dict[str, object]],
    modules: list[dict],
    level: str | None,
    category: str | None = None,
    department: str | None = None,
) -> dict:
    title = str((plan or {}).get("title") or "Partially generated course")
    source_ids = [str(record["id"]) for record in source_records]
    resolved_department = str(department or (plan or {}).get("department") or "").strip()
    pacing_label = str((plan or {}).get("pacingLabel") or "").strip()
    if pacing_label not in {"Module", "Week"}:
        module_titles = [str(module.get("title") or "") for module in (plan or {}).get("modules", []) if isinstance(module, dict)]
        pacing_label = "Week" if any(title.startswith("Week ") for title in module_titles) else "Module"
    course_payload = {
        "title": title,
        "shortDescription": str((plan or {}).get("shortDescription") or f"A partial generation artifact for {title}."),
        "difficultyLevel": str((plan or {}).get("difficultyLevel") or level or "undergrad"),
        "category": str(category or (plan or {}).get("category") or "interdisciplinary-studies"),
        "tags": (plan or {}).get("tags") if isinstance((plan or {}).get("tags"), list) else [],
        "learningTypes": [],
        "orderMandatory": False,
        "sourceIds": source_ids,
        "sourceRecords": source_records,
        "metadata": {
            "pacingLabel": pacing_label,
            "scope": (plan or {}).get("scope") if isinstance((plan or {}).get("scope"), dict) else {},
            "generationPlan": {"status": ["failed_partial_generation"], "mode": "staged-llm-agent"},
        },
        "modules": modules,
    }
    if resolved_department:
        course_payload["department"] = resolved_department
    return normalize_course(course_payload)


def _emit_checkpoint(
    on_checkpoint: CourseGenerationCheckpoint | None,
    *,
    trace: dict,
    partial_course: dict | None = None,
) -> None:
    if on_checkpoint is None:
        return
    payload: dict[str, Any] = {"trace": json.loads(json.dumps(trace, default=str))}
    if partial_course is not None:
        payload["partial_course"] = partial_course
    on_checkpoint(payload)


def _module_lesson_titles(module_outline: dict) -> list[str]:
    raw_titles = module_outline.get("lessonTitles")
    titles: list[str] = []
    if isinstance(raw_titles, list):
        for raw_title in raw_titles:
            title = str(raw_title or "").strip()
            lowered = title.lower()
            if not title:
                continue
            if any(marker in lowered for marker in ("quiz", "assessment", "summary", "review")):
                continue
            titles.append(title)
    return titles[:6] or ["Core concepts", "Worked examples", "Practice and applications"]


def _coerce_generated_section(
    raw_section: dict,
    *,
    fallback_id: str,
    fallback_title: str,
    page_type: str,
    section_type: str,
    source_ids: list[str],
) -> dict:
    section = raw_section
    if isinstance(raw_section.get("section"), dict):
        section = raw_section["section"]
    elif isinstance(raw_section.get("sections"), list) and raw_section["sections"] and isinstance(raw_section["sections"][0], dict):
        section = raw_section["sections"][0]

    content = section.get("content") if isinstance(section.get("content"), list) else []
    return {
        **section,
        "id": str(section.get("id") or fallback_id),
        "title": str(section.get("title") or fallback_title),
        "pageType": str(section.get("pageType") or page_type),
        "sectionType": str(section.get("sectionType") or section_type),
        "sourceIds": section.get("sourceIds") if isinstance(section.get("sourceIds"), list) else source_ids,
        "content": content,
    }


def _coerce_media_block(raw_media: dict, source_ids: list[str]) -> tuple[dict[str, Any] | None, str | None]:
    if raw_media.get("available") is False:
        return None, str(raw_media.get("reason") or "No source-backed video was available.")

    block = raw_media.get("block") if isinstance(raw_media.get("block"), dict) else raw_media
    block_type = str(block.get("type") or "").strip().lower()
    url = str(block.get("url") or block.get("embedUrl") or "").strip()
    if block_type not in {"video", "embed"}:
        return None, "Media stage did not return a video or embed block."
    if not url.startswith("http://") and not url.startswith("https://"):
        return None, "Media stage did not return a usable source-backed URL."

    coerced = {
        **block,
        "type": "video",
        "title": str(block.get("title") or "Source-backed video"),
        "url": url,
        "sourceIds": block.get("sourceIds") if isinstance(block.get("sourceIds"), list) else source_ids,
    }
    return coerced, None


def _insert_media_block(sections: list[dict], media_block: dict[str, Any]) -> bool:
    if not sections:
        return False
    content = sections[0].get("content")
    if not isinstance(content, list):
        return False
    insert_at = max(0, len(content) - 1) if content and isinstance(content[-1], dict) and content[-1].get("type") == "conceptCards" else len(content)
    content.insert(insert_at, media_block)
    sections[0]["content"] = content
    return True


def _coerce_plan_modules(plan: dict, desired_module_count: int) -> list[dict]:
    modules = plan.get("modules")
    if not isinstance(modules, list):
        modules = []
    coerced = [module for module in modules if isinstance(module, dict)]
    if coerced:
        return coerced[:desired_module_count]
    return [
        {
            "id": f"module-{index}",
            "title": f"Module {index}",
            "objective": "Teach one coherent part of the requested course.",
            "lessonTitles": ["Core idea", "Applied workflow"],
            "sourceIds": [],
        }
        for index in range(1, desired_module_count + 1)
    ]
