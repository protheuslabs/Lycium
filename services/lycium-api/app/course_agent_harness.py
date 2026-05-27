from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from app.config import SETTINGS
from app.course_agent_contract import normalize_course, validate_course_contract
from app.course_agent_providers import (
    assess_agent_model_capability,
    call_agent_model,
    get_agent_provider,
    list_agent_provider_summaries,
    validate_agent_api_key,
)
from app.course_agent_response import extract_message_content, json_from_model_text
from app.course_agent_types import CourseAgentError, CourseAgentResult

CONTRACT_PATH = Path(__file__).resolve().parents[3] / "COURSE_AGENT_CONTRACT.md"
CourseGenerationCheckpoint = Callable[[dict[str, Any]], None]


def load_behavioral_contract() -> str:
    return CONTRACT_PATH.read_text(encoding="utf-8")


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


def _llm_messages(
    *,
    prompt: str,
    level: str | None,
    language: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_policy: str,
    source_urls: list[str] | None = None,
) -> list[dict[str, str]]:
    user_contract = {
        "prompt": prompt,
        "level": level,
        "language": language,
        "desired_module_count": desired_module_count,
        "expected_duration_minutes": expected_duration_minutes,
        "source_policy": source_policy,
        "source_urls": source_urls or [],
        "course_short_description": "Return a top-level shortDescription: one concise sentence for catalog cards.",
        "course_shape": "Lycium course JSON with learn/apply pages, conceptCards, sourceRecords, and quiz-only assessment pages.",
        "critical_renderer_rules": [
            "Every section.content MUST be an array of block objects, never a plain string.",
            "Text blocks use {\"type\":\"text\",\"heading\":\"...\",\"value\":\"...\"}.",
            "Every non-summary Learn section ends with {\"type\":\"conceptCards\",\"title\":\"Concepts introduced\",\"concepts\":[{\"name\":\"...\",\"description\":\"...\"}]}",
            "Every module has one Apply assessment section containing only one quiz block.",
            "Each quiz block contains at least 10 questions.",
            "Quiz questions MUST use {\"id\":\"q1\",\"question\":\"...\",\"options\":[\"...\"],\"answers\":[0]}; answers are zero-based option indexes, not answer objects.",
            "Every module ends with one summary section containing one conceptCards block titled \"Module concepts\" or \"Week concepts\".",
        ],
        "minimal_section_example": {
            "id": "module-1-section-1",
            "title": "Focused lesson title",
            "pageType": "learn",
            "sectionType": "lesson",
            "sourceIds": ["source-1"],
            "content": [
                {"type": "text", "heading": "Explanation", "value": "Teach the idea directly in learner-facing prose."},
                {"type": "text", "heading": "Worked example", "value": "Show the idea in a concrete situation."},
                {"type": "text", "heading": "Practice", "value": "Ask the learner to apply the idea."},
                {
                    "type": "conceptCards",
                    "title": "Concepts introduced",
                    "concepts": [{"name": "Raw concept name", "description": "Concise definition."}],
                },
            ],
        },
    }

    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one valid JSON object. Do not wrap it in markdown. "
                "Prefer 2-4 learn sections, 1 quiz-only apply section, and 1 summary section per module unless the prompt requires more. "
                "If section.content is a string instead of an array of typed block objects, the output fails."
            ),
        },
        {"role": "user", "content": json.dumps(user_contract, indent=2)},
    ]


def _model_json(
    *,
    provider: dict,
    api_key: str,
    adapter: str,
    model: str,
    messages: list[dict[str, str]],
    stage: str,
) -> tuple[dict, dict]:
    try:
        response = call_agent_model(provider, api_key, messages, model)
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
) -> dict:
    title = str((plan or {}).get("title") or "Partially generated course")
    source_ids = [str(record["id"]) for record in source_records]
    return normalize_course(
        {
            "title": title,
            "shortDescription": str((plan or {}).get("shortDescription") or f"A partial generation artifact for {title}."),
            "difficultyLevel": str((plan or {}).get("difficultyLevel") or level or "undergrad"),
            "category": str((plan or {}).get("category") or "interdisciplinary-studies"),
            "tags": (plan or {}).get("tags") if isinstance((plan or {}).get("tags"), list) else [],
            "learningTypes": [],
            "orderMandatory": False,
            "sourceIds": source_ids,
            "sourceRecords": source_records,
            "metadata": {
                "pacingLabel": "Module",
                "scope": (plan or {}).get("scope") if isinstance((plan or {}).get("scope"), dict) else {},
                "generationPlan": {"status": ["failed_partial_generation"], "mode": "staged-llm-agent"},
            },
            "modules": modules,
        }
    )


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


def _source_ids_for_input(source_urls: list[str] | None) -> list[str]:
    return [f"input-source-{index}" for index, _ in enumerate(source_urls or [], start=1)]


def _staged_plan_messages(
    *,
    prompt: str,
    level: str | None,
    language: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_policy: str,
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only JSON. This stage returns a compact course plan, not full lessons."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "course_plan",
                    "prompt": prompt,
                    "level": level,
                    "language": language,
                    "desired_module_count": desired_module_count,
                    "expected_duration_minutes": expected_duration_minutes,
                    "source_policy": source_policy,
                    "source_urls": source_urls or [],
                    "available_source_ids": source_ids,
                    "required_json_shape": {
                        "title": "Course title",
                        "shortDescription": "One catalog sentence.",
                        "difficultyLevel": level or "undergrad",
                        "category": "university-style college category id or label",
                        "tags": ["specific", "searchable", "tags"],
                        "scope": {
                            "audience": "target learner",
                            "level": level or "undergrad",
                            "duration": "duration",
                            "outcome": "course outcome",
                            "prerequisites": [],
                            "exclusions": [],
                        },
                        "modules": [
                            {
                                "id": "module-1",
                                "title": "Module 1: ...",
                                "objective": "What learners can do.",
                                "lessonTitles": ["Lesson 1", "Lesson 2"],
                                "sourceIds": source_ids,
                            }
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


def _staged_module_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    pacing_label = "Module"
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for this module. Do not return the whole course. "
                "Every section.content must be an array of typed block objects."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "module_draft",
                    "course": {
                        "title": plan.get("title"),
                        "shortDescription": plan.get("shortDescription"),
                        "scope": plan.get("scope"),
                    },
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "available_source_ids": source_ids,
                    "required_shape": {
                        "id": module_outline.get("id") or f"module-{module_number}",
                        "title": module_outline.get("title") or f"{pacing_label} {module_number}",
                        "sourceIds": source_ids,
                        "sections": [
                            {
                                "id": f"module-{module_number}-lesson-1",
                                "title": "Lesson title",
                                "pageType": "learn",
                                "sectionType": "lesson",
                                "sourceIds": source_ids,
                                "content": [
                                    {"type": "text", "heading": "Explanation", "value": "Direct learner-facing teaching prose."},
                                    {"type": "text", "heading": "Worked example", "value": "Concrete example."},
                                    {"type": "text", "heading": "Practice", "value": "Learner action prompt."},
                                    {
                                        "type": "conceptCards",
                                        "title": "Concepts introduced",
                                        "concepts": [{"name": "Concept", "description": "Concise definition."}],
                                    },
                                ],
                            },
                            {
                                "id": f"module-{module_number}-quiz",
                                "title": "Quiz: Module topic",
                                "pageType": "apply",
                                "sectionType": "assessment",
                                "sourceIds": source_ids,
                                "content": [
                                    {
                                        "type": "quiz",
                                        "questions": [
                                            {
                                                "id": "q1",
                                                "question": "Question text",
                                                "options": ["Correct option", "Distractor", "Distractor", "Distractor"],
                                                "answers": [0],
                                            }
                                        ],
                                        "maxAttempts": "",
                                        "timeLimitSeconds": "",
                                        "passPercentage": 70,
                                    }
                                ],
                            },
                            {
                                "id": f"module-{module_number}-summary",
                                "title": f"{pacing_label} {module_number} Concept Review",
                                "pageType": "learn",
                                "sectionType": "summary",
                                "sourceIds": source_ids,
                                "content": [
                                    {
                                        "type": "conceptCards",
                                        "title": f"{pacing_label} concepts",
                                        "concepts": "concepts copied from the module Learn pages, with sourceSectionId",
                                    }
                                ],
                            },
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


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


def _concepts_from_sections(sections: list[dict]) -> list[dict[str, str]]:
    concepts: list[dict[str, str]] = []
    for section in sections:
        section_id = str(section.get("id") or "")
        content = section.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict) or block.get("type") != "conceptCards":
                continue
            raw_concepts = block.get("concepts")
            if not isinstance(raw_concepts, list):
                continue
            for concept in raw_concepts:
                if not isinstance(concept, dict):
                    continue
                name = str(concept.get("name") or "").strip()
                description = str(concept.get("description") or "").strip()
                if name and description:
                    concepts.append({"name": name, "description": description, "sourceSectionId": section_id})
    return concepts


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


def _staged_lesson_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    lesson_number: int,
    lesson_title: str,
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for one Learn section. Do not return the module or the whole course. "
                "Every section.content must be an array of typed block objects."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "lesson_draft",
                    "course": {
                        "title": plan.get("title"),
                        "shortDescription": plan.get("shortDescription"),
                        "scope": plan.get("scope"),
                    },
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "lesson_number": lesson_number,
                    "lesson_title": lesson_title,
                    "available_source_ids": source_ids,
                    "required_shape": {
                        "id": f"module-{module_number}-lesson-{lesson_number}",
                        "title": lesson_title,
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": source_ids,
                        "content": [
                            {"type": "text", "heading": "Explanation", "value": "Teach the chemistry idea directly in learner-facing prose."},
                            {"type": "text", "heading": "Worked example", "value": "Show a concrete problem or classification example with reasoning."},
                            {"type": "text", "heading": "Practice", "value": "Give the learner a short action prompt or self-check."},
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "concepts": [{"name": "Specific chemistry concept", "description": "Concise definition."}],
                            },
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


def _staged_quiz_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    lesson_sections: list[dict],
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for one Apply quiz section. Do not include instructional prose outside the quiz block."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "quiz_draft",
                    "course": {"title": plan.get("title"), "scope": plan.get("scope")},
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "lesson_section_titles": [section.get("title") for section in lesson_sections],
                    "concepts_to_assess": _concepts_from_sections(lesson_sections),
                    "available_source_ids": source_ids,
                    "minimum_question_count": 10,
                    "required_shape": {
                        "id": f"module-{module_number}-quiz",
                        "title": f"Quiz: {module_outline.get('title') or f'Module {module_number}'}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": source_ids,
                        "content": [
                            {
                                "type": "quiz",
                                "question_count_rule": "Include at least 10 questions. More questions are acceptable for a real quiz.",
                                "questions": [
                                    {
                                        "id": "q1",
                                        "question": "Question text",
                                        "options": ["Correct option", "Distractor", "Distractor", "Distractor"],
                                        "answers": [0],
                                    }
                                ],
                                "maxAttempts": "",
                                "timeLimitSeconds": "",
                                "passPercentage": 70,
                            }
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


def _staged_media_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    lesson_sections: list[dict],
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for an optional source-backed media block. "
                "If no reputable source-backed video is available from the provided sources, return available:false with a reason. "
                "Do not invent a video URL."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "media_draft",
                    "course": {"title": plan.get("title"), "scope": plan.get("scope")},
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "lesson_section_titles": [section.get("title") for section in lesson_sections],
                    "available_source_ids": source_ids,
                    "source_urls": source_urls or [],
                    "required_shape": {
                        "available": True,
                        "reason": "Why this video supports the module, or why no video is available.",
                        "block": {
                            "type": "video",
                            "title": "Short video title",
                            "url": "https://source-backed-video-url",
                            "sourceIds": source_ids,
                            "description": "One sentence explaining why this video belongs in the module.",
                        },
                    },
                },
                indent=2,
            ),
        },
    ]


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


def _staged_summary_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    lesson_sections: list[dict],
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for one module summary section. The summary is a concept-card inventory, not a prose recap."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "summary_draft",
                    "course": {"title": plan.get("title"), "scope": plan.get("scope")},
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "concepts_to_include": _concepts_from_sections(lesson_sections),
                    "available_source_ids": source_ids,
                    "required_shape": {
                        "id": f"module-{module_number}-summary",
                        "title": f"Module {module_number} Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": source_ids,
                        "content": [
                            {
                                "type": "conceptCards",
                                "title": "Module concepts",
                                "concepts": "copy the provided concepts_to_include array, preserving sourceSectionId",
                            }
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


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


def generate_course_with_agent(
    *,
    prompt: str,
    api_key: str,
    provider_id: str,
    level: str | None,
    language: str,
    source_policy: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    model: str | None = None,
    source_urls: list[str] | None = None,
    enforce_contract: bool = True,
) -> CourseAgentResult:
    messages = _llm_messages(
        prompt=prompt,
        level=level,
        language=language,
        source_policy=source_policy,
        desired_module_count=desired_module_count,
        expected_duration_minutes=expected_duration_minutes,
        source_urls=source_urls,
    )
    provider = get_agent_provider(provider_id)
    selected_model = model or provider.get("defaultModel") or SETTINGS.agent_model
    model_capability = assess_agent_model_capability(provider, str(selected_model))
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    base_trace = _base_agent_trace(
        provider=provider,
        adapter=adapter,
        selected_model=str(selected_model),
        model_capability=model_capability,
        mode="llm-agent",
        desired_module_count=desired_module_count,
        expected_duration_minutes=expected_duration_minutes,
        source_urls=source_urls,
    )
    try:
        response = call_agent_model(provider, api_key, messages, selected_model)
    except CourseAgentError as exc:
        raise CourseAgentError(
            str(exc),
            trace={**base_trace, "status": "failed", **getattr(exc, "trace", {})},
        ) from exc
    try:
        raw_course = json_from_model_text(extract_message_content(response, adapter))
    except ValueError as exc:
        raise CourseAgentError(
            f"LLM response could not be parsed as course JSON: {exc}",
            trace={**base_trace, "status": "failed", "failed_stage": "course_generation"},
        ) from exc
    course = _merge_input_sources(normalize_course(raw_course), source_urls)
    validation_errors = validate_course_contract(course)
    if validation_errors and enforce_contract:
        raise CourseAgentError("Generated course failed contract validation: " + "; ".join(validation_errors[:12]))

    return CourseAgentResult(
        course=course,
        trace={
            **base_trace,
            "validation": {"status": "failed" if validation_errors else "passed", "errors": validation_errors},
            "usage": response.get("usage", {}),
        },
    )


def generate_course_with_agent_staged(
    *,
    prompt: str,
    api_key: str,
    provider_id: str,
    level: str | None,
    language: str,
    source_policy: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    model: str | None = None,
    source_urls: list[str] | None = None,
    enforce_contract: bool = True,
    on_checkpoint: CourseGenerationCheckpoint | None = None,
) -> CourseAgentResult:
    provider = get_agent_provider(provider_id)
    selected_model = model or provider.get("defaultModel") or SETTINGS.agent_model
    model_capability = assess_agent_model_capability(provider, str(selected_model))
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    trace = {
        **_base_agent_trace(
            provider=provider,
            adapter=adapter,
            selected_model=str(selected_model),
            model_capability=model_capability,
            mode="staged-llm-agent",
            desired_module_count=desired_module_count,
            expected_duration_minutes=expected_duration_minutes,
            source_urls=source_urls,
        ),
        "stages": [],
    }
    try:
        plan, plan_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=str(selected_model),
            stage="course_plan",
            messages=_staged_plan_messages(
                prompt=prompt,
                level=level,
                language=language,
                desired_module_count=desired_module_count,
                expected_duration_minutes=expected_duration_minutes,
                source_policy=source_policy,
                source_urls=source_urls,
            ),
        )
    except CourseAgentError as exc:
        trace["stages"].append({"stage": "course_plan", "status": "failed", "error": str(exc)})
        raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {})}) from exc
    trace["stages"].append({"stage": "course_plan", "status": "passed"})

    title = str(plan.get("title") or "Generated course")
    source_records = _input_source_records(source_urls, title)
    source_ids = [str(record["id"]) for record in source_records]
    module_outlines = _coerce_plan_modules(plan, desired_module_count)
    modules: list[dict] = []
    module_usage: list[dict] = []
    _emit_checkpoint(
        on_checkpoint,
        trace=trace,
        partial_course=_partial_course_from_stages(plan=plan, source_records=source_records, modules=modules, level=level),
    )

    for index, module_outline in enumerate(module_outlines, start=1):
        module_id = str(module_outline.get("id") or f"module-{index}")
        module_title = str(module_outline.get("title") or f"Module {index}")
        sections: list[dict] = []

        for lesson_index, lesson_title in enumerate(_module_lesson_titles(module_outline), start=1):
            stage = f"module_{index}_lesson_{lesson_index}"
            try:
                section, section_response = _model_json(
                    provider=provider,
                    api_key=api_key,
                    adapter=adapter,
                    model=str(selected_model),
                    stage=stage,
                    messages=_staged_lesson_messages(
                        plan=plan,
                        module_outline=module_outline,
                        module_number=index,
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
                    modules=[*modules, partial_module],
                    level=level,
                )
                trace["stages"].append(
                    {
                        "stage": stage,
                        "status": "failed",
                        "module_outline": module_outline,
                        "completed_module_count": len(modules),
                        "completed_section_count": len(sections),
                        "error": str(exc),
                    }
                )
                raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {}), "partial_course": partial_course}) from exc
            section = _coerce_generated_section(
                section,
                fallback_id=f"module-{index}-lesson-{lesson_index}",
                fallback_title=lesson_title,
                page_type="learn",
                section_type="lesson",
                source_ids=source_ids,
            )
            sections.append(section)
            module_usage.append({"stage": stage, "usage": section_response.get("usage", {})})
            trace["stages"].append({"stage": stage, "status": "passed", "section_id": section.get("id"), "section_title": section.get("title")})
            _emit_checkpoint(
                on_checkpoint,
                trace=trace,
                partial_course=_partial_course_from_stages(
                    plan=plan,
                    source_records=source_records,
                    modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                    level=level,
                ),
            )

        media_stage = f"module_{index}_media"
        try:
            media_payload, media_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage=media_stage,
                messages=_staged_media_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=index,
                    lesson_sections=sections,
                    source_urls=source_urls,
                ),
            )
            media_block, media_skip_reason = _coerce_media_block(media_payload, source_ids)
            if media_block and _insert_media_block(sections, media_block):
                module_usage.append({"stage": media_stage, "usage": media_response.get("usage", {})})
                trace["stages"].append({"stage": media_stage, "status": "passed", "block_title": media_block.get("title")})
            else:
                trace.setdefault("media_logs", []).append(
                    {
                        "stage": media_stage,
                        "status": "skipped",
                        "module_id": module_id,
                        "module_title": module_title,
                        "reason": media_skip_reason or "Media block could not be inserted.",
                    }
                )
                trace["stages"].append({"stage": media_stage, "status": "skipped", "reason": media_skip_reason})
        except CourseAgentError as exc:
            trace.setdefault("media_logs", []).append(
                {
                    "stage": media_stage,
                    "status": "failed_nonfatal",
                    "module_id": module_id,
                    "module_title": module_title,
                    "error": str(exc),
                    "trace": getattr(exc, "trace", {}),
                }
            )
            trace["stages"].append({"stage": media_stage, "status": "failed_nonfatal", "error": str(exc)})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                level=level,
            ),
        )

        quiz_stage = f"module_{index}_quiz"
        try:
            quiz_section, quiz_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage=quiz_stage,
                messages=_staged_quiz_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=index,
                    lesson_sections=sections,
                    source_urls=source_urls,
                ),
            )
        except CourseAgentError as exc:
            partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
            partial_course = _partial_course_from_stages(plan=plan, source_records=source_records, modules=[*modules, partial_module], level=level)
            trace["stages"].append(
                {
                    "stage": quiz_stage,
                    "status": "failed",
                    "module_outline": module_outline,
                    "completed_module_count": len(modules),
                    "completed_section_count": len(sections),
                    "error": str(exc),
                }
            )
            raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {}), "partial_course": partial_course}) from exc
        quiz_section = _coerce_generated_section(
            quiz_section,
            fallback_id=f"module-{index}-quiz",
            fallback_title=f"Quiz: {module_title}",
            page_type="apply",
            section_type="assessment",
            source_ids=source_ids,
        )
        sections.append(quiz_section)
        module_usage.append({"stage": quiz_stage, "usage": quiz_response.get("usage", {})})
        trace["stages"].append({"stage": quiz_stage, "status": "passed", "section_id": quiz_section.get("id")})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                level=level,
            ),
        )

        summary_stage = f"module_{index}_summary"
        try:
            summary_section, summary_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage=summary_stage,
                messages=_staged_summary_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=index,
                    lesson_sections=sections,
                    source_urls=source_urls,
                ),
            )
        except CourseAgentError as exc:
            partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
            partial_course = _partial_course_from_stages(plan=plan, source_records=source_records, modules=[*modules, partial_module], level=level)
            trace["stages"].append(
                {
                    "stage": summary_stage,
                    "status": "failed",
                    "module_outline": module_outline,
                    "completed_module_count": len(modules),
                    "completed_section_count": len(sections),
                    "error": str(exc),
                }
            )
            raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {}), "partial_course": partial_course}) from exc
        summary_section = _coerce_generated_section(
            summary_section,
            fallback_id=f"module-{index}-summary",
            fallback_title=f"Module {index} Concept Review",
            page_type="learn",
            section_type="summary",
            source_ids=source_ids,
        )
        sections.append(summary_section)
        module_usage.append({"stage": summary_stage, "usage": summary_response.get("usage", {})})
        trace["stages"].append({"stage": summary_stage, "status": "passed", "section_id": summary_section.get("id")})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                level=level,
            ),
        )

        module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
        modules.append(module)
        trace["stages"].append({"stage": f"module_{index}", "status": "assembled", "module_id": module_id, "module_title": module_title})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(plan=plan, source_records=source_records, modules=modules, level=level),
        )

    course = normalize_course(
        {
            "title": title,
            "shortDescription": str(plan.get("shortDescription") or f"A structured Lycium course for {title}."),
            "difficultyLevel": str(plan.get("difficultyLevel") or level or "undergrad"),
            "category": str(plan.get("category") or "interdisciplinary-studies"),
            "tags": plan.get("tags") if isinstance(plan.get("tags"), list) else [],
            "learningTypes": [],
            "orderMandatory": False,
            "sourceIds": source_ids,
            "sourceRecords": source_records,
            "metadata": {
                "pacingLabel": "Module",
                "scope": plan.get("scope") if isinstance(plan.get("scope"), dict) else {},
                "generationPlan": {
                    "status": ["scope_drafted", "modules_drafted"],
                    "mode": "staged-llm-agent",
                    "moduleOutlines": module_outlines,
                },
            },
            "modules": modules,
        }
    )
    validation_errors = validate_course_contract(course)
    if validation_errors and enforce_contract:
        raise CourseAgentError(
            "Generated course failed contract validation: " + "; ".join(validation_errors[:12]),
            trace={**trace, "partial_course": course},
        )

    return CourseAgentResult(
        course=course,
        trace={
            **trace,
            "validation": {"status": "failed" if validation_errors else "passed", "errors": validation_errors},
            "usage": {"plan": plan_response.get("usage", {}), "modules": module_usage},
        },
    )


__all__ = [
    "CourseAgentError",
    "CourseAgentResult",
    "generate_course_with_agent",
    "generate_course_with_agent_staged",
    "get_agent_provider",
    "list_agent_provider_summaries",
    "load_behavioral_contract",
    "validate_agent_api_key",
]
