
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


def _importance_rank(value: str) -> int:
    return {
        "required": 0,
        "recommended": 1,
        "remedial": 2,
        "optional": 3,
        "alternate": 4,
        "enrichment": 5,
    }.get(value, 6)


def _requirement_title(requirement: dict[str, Any]) -> str:
    title = str(requirement.get("title") or requirement.get("requirementId") or requirement.get("id") or "").strip()
    return title or "Curriculum requirement"


def _requirement_score(requirement: dict[str, Any]) -> float:
    score = requirement.get("score")
    if isinstance(score, int | float):
        return float(score)
    frequency = requirement.get("frequency")
    if isinstance(frequency, int | float):
        return float(frequency)
    return 0.0


def _requirements_from_benchmark_context(benchmark_context: dict | None) -> list[dict[str, Any]]:
    if not isinstance(benchmark_context, dict):
        return []
    raw_origins = benchmark_context.get("requirementOrigins")
    origins = [origin for origin in raw_origins if isinstance(origin, dict)] if isinstance(raw_origins, list) else []
    if origins:
        return sorted(
            origins,
            key=lambda origin: (
                _importance_rank(str(origin.get("importance") or "")),
                -_requirement_score(origin),
                _requirement_title(origin),
            ),
        )

    raw_benchmarks = benchmark_context.get("curriculumBenchmarks")
    benchmarks = [benchmark for benchmark in raw_benchmarks if isinstance(benchmark, dict)] if isinstance(raw_benchmarks, list) else []
    requirements: list[dict[str, Any]] = []
    for benchmark in benchmarks:
        benchmark_id = str(benchmark.get("id") or "")
        raw_requirements = benchmark.get("extractedRequirements")
        if not isinstance(raw_requirements, list):
            continue
        for requirement in raw_requirements:
            if not isinstance(requirement, dict):
                continue
            requirements.append(
                {
                    "requirementId": str(requirement.get("id") or ""),
                    "title": str(requirement.get("title") or ""),
                    "importance": str(requirement.get("importance") or "recommended"),
                    "evidenceRefs": requirement.get("origin", {}).get("evidenceRefs", [])
                    if isinstance(requirement.get("origin"), dict)
                    else [],
                    "benchmarkIds": [benchmark_id] if benchmark_id else [],
                    "score": _requirement_score(requirement),
                }
            )
    return sorted(
        requirements,
        key=lambda requirement: (
            _importance_rank(str(requirement.get("importance") or "")),
            -_requirement_score(requirement),
            _requirement_title(requirement),
        ),
    )


def _chunk_requirements(requirements: list[dict[str, Any]], module_count: int) -> list[list[dict[str, Any]]]:
    if not requirements:
        return []
    module_count = max(1, min(module_count, len(requirements)))
    chunks: list[list[dict[str, Any]]] = [[] for _ in range(module_count)]
    for index, requirement in enumerate(requirements):
        chunks[index % module_count].append(requirement)
    return [chunk for chunk in chunks if chunk]


def _module_outlines_from_requirements(requirements: list[dict[str, Any]], desired_module_count: int) -> list[dict[str, Any]]:
    modules: list[dict[str, Any]] = []
    for index, group in enumerate(_chunk_requirements(requirements, desired_module_count), start=1):
        titles = [_requirement_title(requirement) for requirement in group]
        evidence_refs = list(
            dict.fromkeys(
                str(ref)
                for requirement in group
                for ref in requirement.get("evidenceRefs", [])
                if str(ref).strip()
            )
        )
        requirement_ids = [
            str(requirement.get("requirementId") or requirement.get("id") or f"requirement-{index}-{item_index}")
            for item_index, requirement in enumerate(group, start=1)
        ]
        modules.append(
            {
                "id": f"module-{index}",
                "title": f"Module {index}: {titles[0]}",
                "objective": "Teach and assess benchmark-derived requirements: " + "; ".join(titles),
                "lessonTitles": titles[:6],
                "requirementOriginIds": requirement_ids,
                "requirementOrigins": group,
                "evidenceRefs": evidence_refs,
                "planningSource": "benchmark_requirements",
                "sourceIds": evidence_refs,
            }
        )
    return modules


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
        "url": url,
        "sourceIds": block.get("sourceIds") if isinstance(block.get("sourceIds"), list) else source_ids,
    }
    if block.get("title"):
        coerced["title"] = str(block.get("title"))
    return coerced, None


def _insert_media_block(sections: list[dict], media_block: dict[str, Any]) -> bool:
    if not sections:
        return False
    content = sections[0].get("content")
    if not isinstance(content, list):
        return False
    insert_at = len(content)
    for index, block in enumerate(content):
        if isinstance(block, dict) and block.get("type") in {"heading", "conceptCard", "concept_card", "conceptCards", "concept_cards"}:
            insert_at = index
            break
    content.insert(insert_at, media_block)
    sections[0]["content"] = content
    return True


def _coerce_plan_modules(plan: dict, desired_module_count: int, *, benchmark_context: dict | None = None) -> list[dict]:
    requirement_modules = _module_outlines_from_requirements(
        _requirements_from_benchmark_context(benchmark_context),
        desired_module_count,
    )
    if requirement_modules:
        return requirement_modules

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
