from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx

from app.config import SETTINGS
from app.course_agent_types import CourseAgentError

PROVIDERS_PATH = Path(__file__).with_name("ai_providers.json")


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


def _call_openai_chat_completions(provider: dict[str, Any], api_key: str, messages: list[dict[str, str]], model: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    return _post_json(provider, api_key, _provider_url(provider, "chatCompletionsPath"), payload)


def _call_anthropic_messages(provider: dict[str, Any], api_key: str, messages: list[dict[str, str]], model: str) -> dict[str, Any]:
    system_content = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
    user_messages = [message for message in messages if message["role"] != "system"]
    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": 16000,
        "temperature": 0.2,
        "system": system_content,
        "messages": user_messages,
    }
    return _post_json(provider, api_key, _provider_url(provider, "messagesPath"), payload)


def _call_gemini_generate_content(provider: dict[str, Any], api_key: str, messages: list[dict[str, str]], model: str) -> dict[str, Any]:
    system_content = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
    user_content = "\n\n".join(message["content"] for message in messages if message["role"] != "system")
    model_path = model if model.startswith("models/") else f"models/{model}"
    payload: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system_content}]},
        "contents": [{"role": "user", "parts": [{"text": user_content}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    url = f"{str(provider.get('baseUrl') or '').rstrip('/')}/{model_path}:generateContent"
    return _post_json(provider, api_key, url, payload)


def _post_json(provider: dict[str, Any], api_key: str, url: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        with httpx.Client(timeout=SETTINGS.agent_timeout_seconds) as client:
            response = client.post(url, headers=_provider_headers(provider, api_key, content_type=True), json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:500]
        raise CourseAgentError(f"LLM API rejected the request: {detail}") from exc
    except httpx.HTTPError as exc:
        raise CourseAgentError(f"LLM API request failed: {exc}") from exc


def call_agent_model(provider: dict[str, Any], api_key: str, messages: list[dict[str, str]], model: str) -> dict[str, Any]:
    adapter = provider.get("generationAdapter")
    if adapter == "anthropic-messages":
        return _call_anthropic_messages(provider, api_key, messages, model)
    if adapter == "gemini-generate-content":
        return _call_gemini_generate_content(provider, api_key, messages, model)
    return _call_openai_chat_completions(provider, api_key, messages, model)


def validate_agent_api_key(api_key: str, provider_id: str = "openai", model: str | None = None) -> list[dict[str, str]]:
    provider = get_agent_provider(provider_id)
    models = fetch_agent_models(provider_id, api_key)
    selected_model = model or provider.get("defaultModel") or (models[0]["id"] if models else SETTINGS.agent_model)
    if selected_model and not any(record["id"] == selected_model for record in models):
        models.insert(0, {"id": str(selected_model), "label": str(selected_model)})
    return models
