from __future__ import annotations

import json
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm.attributes import flag_modified

from app.config import SETTINGS
from app.course_agent_contract import normalize_course
from app.course_agent_providers import assess_agent_model_capability, call_agent_model, get_agent_provider
from app.course_agent_response import extract_message_content, json_from_model_text
from app.course_agent_types import CourseAgentError
from app.models import CourseSnapshot


def _source_id_from_url(url: str, existing_count: int) -> str:
    clean = url.strip().lower().replace("https://", "").replace("http://", "")
    slug = "".join(char if char.isalnum() else "-" for char in clean).strip("-")[:54] or "source"
    return f"refresh-source-{slug}-{existing_count + 1}"


def _source_title_from_url(url: str) -> str:
    clean = url.strip()
    try:
        from urllib.parse import urlparse

        parsed = urlparse(clean)
        return parsed.netloc.replace("www.", "") or clean
    except Exception:
        return clean


def _source_records(structure: dict[str, Any]) -> list[dict[str, Any]]:
    records = structure.get("sourceRecords")
    if isinstance(records, list):
        return [record for record in records if isinstance(record, dict)]
    if isinstance(records, dict):
        return [record for record in records.values() if isinstance(record, dict)]
    return []


def _add_new_source_records(structure: dict[str, Any], urls: list[str]) -> list[dict[str, Any]]:
    records = _source_records(structure)
    existing_urls = {str(record.get("url") or "").strip() for record in records}
    existing_ids = {str(record.get("id") or "").strip() for record in records}
    added: list[dict[str, Any]] = []

    for url in urls:
        clean_url = url.strip()
        if not clean_url or clean_url in existing_urls:
            continue
        source_id = _source_id_from_url(clean_url, len(records) + len(added))
        while source_id in existing_ids:
            source_id = f"{source_id}-next"
        record = {
            "id": source_id,
            "type": "web",
            "title": _source_title_from_url(clean_url),
            "url": clean_url,
        }
        added.append(record)
        existing_ids.add(source_id)
        existing_urls.add(clean_url)

    if added:
        structure["sourceRecords"] = [*records, *added]
        source_ids = [str(source_id) for source_id in structure.get("sourceIds", []) if source_id]
        structure["sourceIds"] = list(dict.fromkeys([*source_ids, *(record["id"] for record in added)]))
    elif "sourceRecords" not in structure and records:
        structure["sourceRecords"] = records

    return added


def _find_module_and_section(
    structure: dict[str, Any],
    module_id: str,
    section_id: str,
) -> tuple[dict[str, Any], int, dict[str, Any], int]:
    modules = structure.get("modules")
    if not isinstance(modules, list):
        raise ValueError("Course snapshot does not contain modules.")

    for module_index, module in enumerate(modules):
        if not isinstance(module, dict) or str(module.get("id") or "") != module_id:
            continue
        sections = module.get("sections")
        if not isinstance(sections, list):
            break
        for section_index, section in enumerate(sections):
            if isinstance(section, dict) and str(section.get("id") or "") == section_id:
                return module, module_index, section, section_index

    raise ValueError("Section was not found in the selected course snapshot.")


def _clean_source_ids(source_ids: Any, bad_source_ids: set[str]) -> list[str]:
    if not isinstance(source_ids, list):
        return []
    return [
        str(source_id)
        for source_id in source_ids
        if str(source_id).strip() and str(source_id) not in bad_source_ids
    ]


def _coerce_refreshed_section(
    raw_section: dict[str, Any],
    original_section: dict[str, Any],
    bad_source_ids: set[str],
) -> dict[str, Any]:
    section = raw_section.get("section") if isinstance(raw_section.get("section"), dict) else raw_section
    if not isinstance(section, dict):
        raise CourseAgentError("The agent did not return a section JSON object.")

    content = section.get("content")
    if not isinstance(content, list) or not content:
        raise CourseAgentError("The refreshed section must include non-empty content blocks.")

    refreshed = {
        **original_section,
        **section,
        "id": original_section.get("id"),
        "title": str(section.get("title") or original_section.get("title") or "Section"),
        "content": content,
    }
    refreshed["pageType"] = section.get("pageType") or original_section.get("pageType") or "learn"
    refreshed["sectionType"] = section.get("sectionType") or original_section.get("sectionType") or "lesson"
    refreshed["sourceIds"] = _clean_source_ids(refreshed.get("sourceIds"), bad_source_ids)

    for block in refreshed["content"]:
        if isinstance(block, dict):
            block["sourceIds"] = _clean_source_ids(block.get("sourceIds"), bad_source_ids)

    return refreshed


def _messages_for_section_refresh(
    *,
    structure: dict[str, Any],
    module: dict[str, Any],
    section: dict[str, Any],
    available_sources: list[dict[str, Any]],
    added_sources: list[dict[str, Any]],
    feedback: str | None,
    positive_feedback: list[str],
    negative_feedback: list[str],
    bad_source_ids: list[str],
) -> list[dict[str, str]]:
    context = {
        "course": {
            "title": structure.get("title"),
            "shortDescription": structure.get("shortDescription"),
            "level": structure.get("level"),
            "category": structure.get("category"),
            "department": structure.get("department"),
        },
        "module": {
            "id": module.get("id"),
            "title": module.get("title"),
            "objective": module.get("objective") or module.get("description"),
        },
        "sectionToRefresh": section,
        "availableSources": available_sources,
        "newSources": added_sources,
        "avoidSourceIds": bad_source_ids,
        "feedback": {
            "general": feedback,
            "positive": positive_feedback,
            "negative": negative_feedback,
        },
    }

    return [
        {
            "role": "system",
            "content": (
                "You regenerate exactly one Lycium course section. Return JSON only. "
                "Preserve the section id. Write finished learner-facing course content, never instructions to another model. "
                "Use only sources from availableSources/newSources, avoid avoidSourceIds when possible, and attach sourceIds "
                "to the specific blocks they support. If the section is learn/instructional, include concise explanation blocks "
                "and conceptCard blocks for raw concepts introduced. If the section is a quiz/apply section, keep quiz content "
                "separate from instruction and return assessment blocks only."
            ),
        },
        {
            "role": "user",
            "content": (
                "Regenerate this section based on the context and feedback. Return this shape: "
                '{"section":{"id":"same id","title":"...","pageType":"learn|apply","sectionType":"lesson|assessment",'
                '"sourceIds":["source-id"],"content":[{"type":"text","heading":"...","value":"...","sourceIds":["source-id"]}]}}\n\n'
                f"{json.dumps(context, ensure_ascii=False, indent=2)}"
            ),
        },
    ]


def regenerate_section_with_agent(
    *,
    course: CourseSnapshot,
    module_id: str,
    section_id: str,
    agent_profile: dict[str, Any],
    model: str | None = None,
    feedback: str | None = None,
    positive_feedback: list[str] | None = None,
    negative_feedback: list[str] | None = None,
    new_source_urls: list[str] | None = None,
    bad_source_ids: list[str] | None = None,
) -> CourseSnapshot:
    structure = deepcopy(course.structure or {})
    module, module_index, original_section, section_index = _find_module_and_section(structure, module_id, section_id)
    added_sources = _add_new_source_records(structure, new_source_urls or [])
    bad_ids = {source_id for source_id in (bad_source_ids or []) if source_id}
    available_sources = [
        record for record in _source_records(structure)
        if str(record.get("id") or "") not in bad_ids
    ]

    provider_id = str(agent_profile.get("provider_id") or agent_profile.get("provider") or "")
    api_key = str(agent_profile.get("agent_api_key") or agent_profile.get("api_key") or "")
    provider = get_agent_provider(provider_id)
    selected_model = str(model or agent_profile.get("model") or provider.get("defaultModel") or SETTINGS.agent_model)
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    response = call_agent_model(
        provider,
        api_key,
        _messages_for_section_refresh(
            structure=structure,
            module=module,
            section=original_section,
            available_sources=available_sources,
            added_sources=added_sources,
            feedback=feedback,
            positive_feedback=positive_feedback or [],
            negative_feedback=negative_feedback or [],
            bad_source_ids=bad_source_ids or [],
        ),
        selected_model,
    )
    raw_section = json_from_model_text(extract_message_content(response, adapter))
    refreshed_section = _coerce_refreshed_section(raw_section, original_section, bad_ids)
    module["sections"][section_index] = refreshed_section

    course.structure = normalize_course(structure)
    trace = dict(course.generation_trace or {})
    events = list(trace.get("section_regenerations", []))
    events.append({
        "moduleId": module_id,
        "sectionId": section_id,
        "moduleIndex": module_index,
        "sectionIndex": section_index,
        "providerId": provider_id,
        "model": selected_model,
        "modelCapability": assess_agent_model_capability(provider, selected_model),
        "feedback": feedback,
        "positiveFeedback": positive_feedback or [],
        "negativeFeedback": negative_feedback or [],
        "newSourceUrls": new_source_urls or [],
        "badSourceIds": bad_source_ids or [],
        "usage": response.get("usage", {}),
        "refreshedAt": datetime.now(UTC).isoformat(),
    })
    trace["section_regenerations"] = events
    course.generation_trace = trace
    course.version = (course.version or 0) + 1
    flag_modified(course, "structure")
    flag_modified(course, "generation_trace")
    return course
