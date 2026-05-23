from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from app.config import SETTINGS


CONTRACT_PATH = Path(__file__).resolve().parents[3] / "COURSE_AGENT_CONTRACT.md"
PROVIDERS_PATH = Path(__file__).with_name("ai_providers.json")


class CourseAgentError(ValueError):
    pass


@dataclass(frozen=True)
class CourseAgentResult:
    course: dict[str, Any]
    trace: dict[str, Any]


def load_behavioral_contract() -> str:
    return CONTRACT_PATH.read_text(encoding="utf-8")


def load_agent_providers() -> list[dict[str, Any]]:
    payload = json.loads(PROVIDERS_PATH.read_text(encoding="utf-8"))
    providers = payload.get("providers", [])
    return [provider for provider in providers if isinstance(provider, dict)]


def get_agent_provider(provider_id: str) -> dict[str, Any]:
    for provider in load_agent_providers():
        if provider.get("id") == provider_id:
            return provider
    raise CourseAgentError("Unknown AI provider.")


def list_agent_provider_summaries() -> list[dict[str, Any]]:
    return [
        {
            "id": str(provider.get("id") or ""),
            "label": str(provider.get("label") or provider.get("id") or ""),
            "default_model": provider.get("defaultModel") or None,
            "model_fetch_supported": bool(provider.get("modelsPath")),
            "generation_adapter": str(provider.get("generationAdapter") or ""),
        }
        for provider in load_agent_providers()
        if provider.get("id")
    ]


def _slug(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or fallback


def _json_from_model_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise CourseAgentError("The agent did not return valid JSON.") from exc

    if not isinstance(parsed, dict):
        raise CourseAgentError("The agent response must be a JSON object.")
    if isinstance(parsed.get("course"), dict):
        parsed = parsed["course"]
    if isinstance(parsed.get("error"), dict):
        detail = parsed["error"].get("message") or parsed["error"].get("detail") or "Course generation failed."
        raise CourseAgentError(str(detail))
    return parsed


def _llm_messages(
    *,
    prompt: str,
    level: str | None,
    language: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_policy: str,
) -> list[dict[str, str]]:
    user_contract = {
        "prompt": prompt,
        "level": level,
        "language": language,
        "desired_module_count": desired_module_count,
        "expected_duration_minutes": expected_duration_minutes,
        "source_policy": source_policy,
        "course_shape": "Lyceum course JSON with learn/apply pages, conceptCards, sourceRecords, and quiz-only assessment pages.",
    }

    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one valid JSON object. Do not wrap it in markdown. "
                "Prefer 2-4 learn sections, 1 quiz-only apply section, and 1 summary section per module unless the prompt requires more."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(user_contract, indent=2),
        },
    ]


def _provider_url(provider: dict[str, Any], path_key: str) -> str:
    base_url = str(provider.get("baseUrl") or "").rstrip("/")
    path = str(provider.get(path_key) or "")
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{base_url}/{path.lstrip('/')}"


def _provider_headers(provider: dict[str, Any], api_key: str, *, content_type: bool = False) -> dict[str, str]:
    headers = {str(key): str(value) for key, value in provider.get("headers", {}).items()}
    auth = provider.get("auth", {})
    auth_type = auth.get("type") if isinstance(auth, dict) else "bearer"

    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {api_key}"
    elif auth_type == "x-api-key":
        headers["x-api-key"] = api_key
    elif auth_type == "x-goog-api-key":
        headers["x-goog-api-key"] = api_key
    else:
        headers["Authorization"] = f"Bearer {api_key}"

    if content_type:
        headers["Content-Type"] = "application/json"
    return headers


def _normalize_model_response(provider: dict[str, Any], payload: dict[str, Any]) -> list[dict[str, str]]:
    response_key = provider.get("modelsResponseKey")
    raw_models = payload.get(response_key) if response_key else None
    if not isinstance(raw_models, list):
        raw_models = payload.get("data") if isinstance(payload.get("data"), list) else payload.get("models")
    if not isinstance(raw_models, list):
        return []

    required_generation_method = provider.get("requiredGenerationMethod")
    models: list[dict[str, str]] = []
    for raw_model in raw_models:
        if isinstance(raw_model, str):
            model_id = raw_model
            label = raw_model
        elif isinstance(raw_model, dict):
            if required_generation_method:
                methods = raw_model.get("supportedGenerationMethods")
                if isinstance(methods, list) and required_generation_method not in methods:
                    continue
            model_id = str(raw_model.get("id") or raw_model.get("name") or "").strip()
            label = str(
                raw_model.get("display_name")
                or raw_model.get("displayName")
                or raw_model.get("name")
                or raw_model.get("id")
                or model_id
            )
        else:
            continue

        if model_id:
            models.append({"id": model_id, "label": label or model_id})

    return models


def fetch_agent_models(provider_id: str, api_key: str) -> list[dict[str, str]]:
    provider = get_agent_provider(provider_id)
    if not provider.get("modelsPath"):
        return []

    try:
        with httpx.Client(timeout=min(SETTINGS.agent_timeout_seconds, 20)) as client:
            response = client.get(_provider_url(provider, "modelsPath"), headers=_provider_headers(provider, api_key))
            if response.status_code in {401, 403}:
                raise CourseAgentError("API key invalid.")
            response.raise_for_status()
            return _normalize_model_response(provider, response.json())
    except CourseAgentError:
        raise
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:300]
        raise CourseAgentError(f"Model fetch failed: {detail}") from exc
    except httpx.HTTPError as exc:
        raise CourseAgentError(f"Model fetch failed: {exc}") from exc


def _call_openai_chat_completions(
    *,
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    try:
        with httpx.Client(timeout=SETTINGS.agent_timeout_seconds) as client:
            response = client.post(
                _provider_url(provider, "chatCompletionsPath"),
                headers=_provider_headers(provider, api_key, content_type=True),
                json=payload,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500]
        raise CourseAgentError(f"LLM API rejected the request: {detail}") from exc
    except httpx.HTTPError as exc:
        raise CourseAgentError(f"LLM API request failed: {exc}") from exc


def _call_anthropic_messages(
    *,
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
) -> dict[str, Any]:
    system_content = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
    user_messages = [
        {"role": "user" if message["role"] == "system" else message["role"], "content": message["content"]}
        for message in messages
        if message["role"] != "system"
    ]
    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": 16000,
        "temperature": 0.2,
        "system": system_content,
        "messages": user_messages,
    }

    try:
        with httpx.Client(timeout=SETTINGS.agent_timeout_seconds) as client:
            response = client.post(
                _provider_url(provider, "messagesPath"),
                headers=_provider_headers(provider, api_key, content_type=True),
                json=payload,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500]
        raise CourseAgentError(f"LLM API rejected the request: {detail}") from exc
    except httpx.HTTPError as exc:
        raise CourseAgentError(f"LLM API request failed: {exc}") from exc


def _call_gemini_generate_content(
    *,
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
) -> dict[str, Any]:
    system_content = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
    user_content = "\n\n".join(message["content"] for message in messages if message["role"] != "system")
    model_path = model if model.startswith("models/") else f"models/{model}"
    payload: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system_content}]},
        "contents": [{"role": "user", "parts": [{"text": user_content}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=SETTINGS.agent_timeout_seconds) as client:
            response = client.post(
                f"{str(provider.get('baseUrl') or '').rstrip('/')}/{model_path}:generateContent",
                headers=_provider_headers(provider, api_key, content_type=True),
                json=payload,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500]
        raise CourseAgentError(f"LLM API rejected the request: {detail}") from exc
    except httpx.HTTPError as exc:
        raise CourseAgentError(f"LLM API request failed: {exc}") from exc


def _call_agent_model(
    *,
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
) -> dict[str, Any]:
    adapter = provider.get("generationAdapter")
    if adapter == "anthropic-messages":
        return _call_anthropic_messages(provider=provider, api_key=api_key, messages=messages, model=model)
    if adapter == "gemini-generate-content":
        return _call_gemini_generate_content(provider=provider, api_key=api_key, messages=messages, model=model)
    return _call_openai_chat_completions(provider=provider, api_key=api_key, messages=messages, model=model)


def validate_agent_api_key(api_key: str, provider_id: str = "openai", model: str | None = None) -> list[dict[str, str]]:
    provider = get_agent_provider(provider_id)
    models = fetch_agent_models(provider_id, api_key)
    selected_model = model or provider.get("defaultModel") or (models[0]["id"] if models else SETTINGS.agent_model)

    if selected_model and not any(record["id"] == selected_model for record in models):
        models.insert(0, {"id": str(selected_model), "label": str(selected_model)})

    return models


def _extract_message_content(response: dict[str, Any], adapter: str) -> str:
    if adapter == "anthropic-messages":
        content = response.get("content")
        if isinstance(content, list):
            text = "".join(
                str(part.get("text") or "")
                for part in content
                if isinstance(part, dict) and part.get("type") in {None, "text"}
            )
            if text.strip():
                return text

    if adapter == "gemini-generate-content":
        candidates = response.get("candidates")
        if isinstance(candidates, list) and candidates:
            parts = candidates[0].get("content", {}).get("parts", []) if isinstance(candidates[0], dict) else []
            if isinstance(parts, list):
                text = "".join(str(part.get("text") or "") for part in parts if isinstance(part, dict))
                if text.strip():
                    return text

    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise CourseAgentError("LLM API response did not include choices.")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise CourseAgentError("LLM API response did not include JSON content.")
    return content


def _normalize_course(course: dict[str, Any]) -> dict[str, Any]:
    course.setdefault("orderMandatory", False)
    course.setdefault("sourceIds", [])
    course.setdefault("sourceRecords", [])
    course.setdefault("metadata", {})
    course["metadata"].setdefault("scope", {})
    course["metadata"].setdefault("generationPlan", {})
    if not course["metadata"].get("pacingLabel"):
        module_titles = [str(module.get("title") or "") for module in course.get("modules", []) if isinstance(module, dict)]
        course["metadata"]["pacingLabel"] = "Week" if any(title.startswith("Week ") for title in module_titles) else "Module"

    for module_index, module in enumerate(course.get("modules", []), start=1):
        if isinstance(module, dict):
            module.setdefault("id", _slug(str(module.get("title") or ""), f"module-{module_index}"))
            module.setdefault("sourceIds", course.get("sourceIds", []))
            for section_index, section in enumerate(module.get("sections", []), start=1):
                if not isinstance(section, dict):
                    continue
                section.setdefault(
                    "id",
                    _slug(str(section.get("title") or ""), f"{module['id']}-section-{section_index}"),
                )
                section.setdefault("sourceIds", module.get("sourceIds", []))
                content = section.get("content", [])
                contains_quiz = any(isinstance(block, dict) and block.get("type") == "quiz" for block in content)
                if contains_quiz:
                    section.setdefault("pageType", "apply")
                    section.setdefault("sectionType", "assessment")
                else:
                    section.setdefault("pageType", "learn")
                    section.setdefault("sectionType", "lesson")

    return course


def _validate_concept_cards(block: dict[str, Any], errors: list[str], location: str) -> None:
    concepts = block.get("concepts")
    if not isinstance(concepts, list) or not concepts:
        errors.append(f"{location} conceptCards must include concepts.")
        return

    for concept_index, concept in enumerate(concepts, start=1):
        if not isinstance(concept, dict):
            errors.append(f"{location} concept {concept_index} must be an object.")
            continue
        if not concept.get("name"):
            errors.append(f"{location} concept {concept_index} is missing name.")
        if not concept.get("description"):
            errors.append(f"{location} concept {concept_index} is missing description.")


def validate_course_contract(course: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not isinstance(course.get("title"), str) or not course["title"].strip():
        errors.append("Course is missing title.")

    modules = course.get("modules")
    if not isinstance(modules, list) or not modules:
        errors.append("Course must include at least one module.")
        return errors

    pacing_label = course.get("metadata", {}).get("pacingLabel")
    if pacing_label not in {"Module", "Week"}:
        errors.append("Course metadata.pacingLabel must be Module or Week.")
        pacing_label = "Module"

    declared_sources = course.get("sourceRecords", [])
    declared_source_ids: set[str] = set()
    if isinstance(declared_sources, dict):
        declared_source_ids.update(str(source_id) for source_id in declared_sources.keys())
    elif isinstance(declared_sources, list):
        declared_source_ids.update(
            str(source.get("id"))
            for source in declared_sources
            if isinstance(source, dict) and source.get("id")
        )
    if not declared_source_ids:
        errors.append("Course must include sourceRecords with at least one source.")

    referenced_source_ids: set[str] = set(str(source_id) for source_id in course.get("sourceIds", []) if source_id)

    for module_index, module in enumerate(modules, start=1):
        location = f"module {module_index}"
        if not isinstance(module, dict):
            errors.append(f"{location} must be an object.")
            continue
        if not module.get("id"):
            errors.append(f"{location} is missing id.")
        if not module.get("title"):
            errors.append(f"{location} is missing title.")
        module_title = str(module.get("title") or "")
        other_label = "Week" if pacing_label == "Module" else "Module"
        if module_title.startswith(f"{other_label} "):
            errors.append(f"{location} title mixes {other_label} with course pacing label {pacing_label}.")
        referenced_source_ids.update(str(source_id) for source_id in module.get("sourceIds", []) if source_id)

        sections = module.get("sections")
        if not isinstance(sections, list) or not sections:
            errors.append(f"{location} must include sections.")
            continue

        last_section = sections[-1] if sections else None
        if not isinstance(last_section, dict) or last_section.get("sectionType") != "summary":
            errors.append(f"{location} must end with a summary section.")

        for section_index, section in enumerate(sections, start=1):
            section_location = f"{location} section {section_index}"
            if not isinstance(section, dict):
                errors.append(f"{section_location} must be an object.")
                continue
            if section.get("pageType") not in {"learn", "apply"}:
                errors.append(f"{section_location} must set pageType to learn or apply.")
            section_title = str(section.get("title") or "")
            if section.get("sectionType") == "summary" and section_title.startswith(f"{other_label} Summary"):
                errors.append(f"{section_location} summary title mixes {other_label} with course pacing label {pacing_label}.")
            if not isinstance(section.get("content"), list) or not section["content"]:
                errors.append(f"{section_location} must include content blocks.")
                continue
            referenced_source_ids.update(str(source_id) for source_id in section.get("sourceIds", []) if source_id)

            content = section["content"]
            quiz_blocks = [block for block in content if isinstance(block, dict) and block.get("type") == "quiz"]
            concept_blocks = [block for block in content if isinstance(block, dict) and block.get("type") == "conceptCards"]

            for block in content:
                if isinstance(block, dict):
                    referenced_source_ids.update(str(source_id) for source_id in block.get("sourceIds", []) if source_id)

            if quiz_blocks:
                if section.get("pageType") != "apply" or section.get("sectionType") != "assessment":
                    errors.append(f"{section_location} quiz sections must be assessment apply pages.")
                if len(quiz_blocks) != len(content):
                    errors.append(f"{section_location} mixes quiz blocks with non-quiz content.")
                for quiz_index, quiz in enumerate(quiz_blocks, start=1):
                    questions = quiz.get("questions") or quiz.get("questionBank") or []
                    if not isinstance(questions, list) or not questions:
                        errors.append(f"{section_location} quiz {quiz_index} must include questions.")
                    for question_index, question in enumerate(questions, start=1):
                        if not isinstance(question, dict):
                            errors.append(f"{section_location} question {question_index} must be an object.")
                            continue
                        if not isinstance(question.get("answers"), list):
                            errors.append(f"{section_location} question {question_index} must use answers array.")
                continue

            if section.get("sectionType") == "summary":
                if section.get("pageType") != "learn":
                    errors.append(f"{section_location} summary must be a learn page.")
                expected_summary_title = f"{pacing_label} concepts"
                if len(concept_blocks) != 1 or concept_blocks[0].get("title") != expected_summary_title:
                    errors.append(f"{section_location} summary must include one {expected_summary_title} block.")
                for concept_block in concept_blocks:
                    _validate_concept_cards(concept_block, errors, section_location)
                continue

            if section.get("pageType") == "learn":
                if not concept_blocks:
                    errors.append(f"{section_location} learn page must include conceptCards.")
                elif concept_blocks[-1].get("title") != "Concepts introduced":
                    errors.append(f"{section_location} learn page conceptCards title must be Concepts introduced.")
                for concept_block in concept_blocks:
                    _validate_concept_cards(concept_block, errors, section_location)

    if referenced_source_ids:
        if not declared_source_ids:
            errors.append("Course references sourceIds but does not include sourceRecords.")
        else:
            missing_sources = sorted(referenced_source_ids - declared_source_ids)
            if missing_sources:
                errors.append(f"Referenced sourceIds are missing from sourceRecords: {', '.join(missing_sources[:10])}.")

    return errors


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
) -> CourseAgentResult:
    messages = _llm_messages(
        prompt=prompt,
        level=level,
        language=language,
        source_policy=source_policy,
        desired_module_count=desired_module_count,
        expected_duration_minutes=expected_duration_minutes,
    )
    provider = get_agent_provider(provider_id)
    selected_model = model or provider.get("defaultModel") or SETTINGS.agent_model
    response = _call_agent_model(provider=provider, api_key=api_key, messages=messages, model=selected_model)
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    raw_course = _json_from_model_text(_extract_message_content(response, adapter))
    course = _normalize_course(raw_course)
    validation_errors = validate_course_contract(course)
    if validation_errors:
        raise CourseAgentError("Generated course failed contract validation: " + "; ".join(validation_errors[:12]))

    return CourseAgentResult(
        course=course,
        trace={
            "mode": "llm-agent",
            "provider": provider.get("id"),
            "provider_label": provider.get("label"),
            "generation_adapter": adapter,
            "model": selected_model,
            "behavioral_contract": "COURSE_AGENT_CONTRACT.md",
            "desired_module_count": desired_module_count,
            "expected_duration_minutes": expected_duration_minutes,
            "validation": {"status": "passed"},
            "usage": response.get("usage", {}),
        },
    )
