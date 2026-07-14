from __future__ import annotations

import json
import re
import shlex
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.config import SETTINGS
from app.course_agent_types import CourseAgentError

PROVIDERS_PATH = Path(__file__).with_name("ai_providers.json")
RUNTIME_BRIDGE_PATH = Path(__file__).parents[1] / "scripts" / "agent_runtime_bridge.py"
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}
TRANSIENT_ERROR_MARKERS = (
    "connection reset",
    "connection refused",
    "eof",
    "remote protocol error",
    "server disconnected",
    "temporarily unavailable",
    "timeout",
    "timed out",
)

ModelRecord = dict[str, Any]


def load_agent_providers() -> list[dict[str, Any]]:
    payload = json.loads(PROVIDERS_PATH.read_text(encoding="utf-8"))
    providers = payload.get("providers", [])
    return [provider for provider in providers if isinstance(provider, dict)]


def get_agent_provider(provider_id: str) -> dict[str, Any]:
    for provider in load_agent_providers():
        if provider.get("id") == provider_id:
            return provider
    raise CourseAgentError("Unknown AI provider.")


def agent_provider_contract(provider: dict[str, Any]) -> dict[str, Any]:
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    agent_runtime_provider = bool(provider.get("localRuntime") or adapter == "local-agent-runtime")
    local_provider = bool(provider.get("localProvider") or adapter == "ollama-chat" or agent_runtime_provider)
    model_fetch_supported = bool(provider.get("modelsPath") or provider.get("staticModels"))
    json_mode_supported = adapter in {
        "openai-chat-completions",
        "gemini-generate-content",
        "ollama-chat",
        "local-agent-runtime",
    }

    return {
        "provider_kind": "agent_runtime" if agent_runtime_provider else ("local" if local_provider else "cloud"),
        "credential_kind": "local_runtime" if agent_runtime_provider else ("local_endpoint" if local_provider else "api_key"),
        "generation_adapter": adapter,
        "requires_verified_connection": True,
        "supports_model_list": model_fetch_supported,
        "supports_json_mode": json_mode_supported,
        "supports_streaming": False,
        "supports_tool_use": False,
        "supports_usage_metadata": False,
        "model_source": "runtime_bridge" if agent_runtime_provider else ("provider_api" if provider.get("modelsPath") else "static_default"),
        "capabilities": {
            "agent_runtime": agent_runtime_provider,
            "json_mode": json_mode_supported,
            "local_execution": local_provider,
            "model_list": model_fetch_supported,
            "runtime_bridge": agent_runtime_provider,
            "streaming": False,
            "tool_use": False,
            "usage_metadata": False,
        },
    }


def _default_credential(provider: dict[str, Any]) -> str:
    configured_default = str(provider.get("credentialDefault") or "").strip()
    if configured_default:
        return configured_default
    if provider.get("generationAdapter") != "local-agent-runtime":
        return ""
    runtime_kind = str(provider.get("runtimeKind") or provider.get("id") or "").strip()
    if not runtime_kind:
        return ""
    return f"python3 {shlex.quote(str(RUNTIME_BRIDGE_PATH))} --runtime {shlex.quote(runtime_kind)}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _provider_model_discovery(provider: dict[str, Any], *, discover_models: bool) -> dict[str, Any]:
    contract = agent_provider_contract(provider)
    payload: dict[str, Any] = {
        "models": [],
        "models_fetched_at": None,
        "model_discovery_status": "not_checked",
        "model_discovery_error": None,
    }
    if not contract["supports_model_list"]:
        return {**payload, "model_discovery_status": "unsupported"}
    if not discover_models:
        return payload

    adapter = str(provider.get("generationAdapter") or "")
    if contract["credential_kind"] == "api_key" and provider.get("modelsPath"):
        return {**payload, "model_discovery_status": "requires_credential"}

    try:
        if adapter == "local-agent-runtime":
            models = _validate_local_agent_runtime(provider, _default_credential(provider))
        elif adapter == "ollama-chat":
            models = fetch_agent_models(str(provider.get("id") or ""), _default_credential(provider))
        else:
            models = _static_agent_models(provider)
    except CourseAgentError as exc:
        return {
            **payload,
            "models": _static_agent_models(provider),
            "model_discovery_status": "error",
            "model_discovery_error": str(exc),
        }

    return {
        **payload,
        "models": models,
        "models_fetched_at": _now(),
        "model_discovery_status": "partial" if any(model.get("error") for model in models) else "available",
    }


def list_agent_provider_summaries(*, discover_models: bool = False) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for provider in load_agent_providers():
        if not provider.get("id"):
            continue
        contract = agent_provider_contract(provider)
        summary = {
            "id": str(provider.get("id") or ""),
            "label": str(provider.get("label") or provider.get("id") or ""),
            "default_model": provider.get("defaultModel") or None,
            "recommended_model": provider.get("recommendedModel") or provider.get("defaultModel") or None,
            "minimum_recommended_parameters_billion": provider.get("minimumRecommendedParametersBillion") or None,
            "model_recommendation_note": provider.get("modelRecommendationNote") or None,
            "model_fetch_supported": contract["supports_model_list"],
            "generation_adapter": str(provider.get("generationAdapter") or ""),
            "local_provider": bool(provider.get("localProvider")),
            "credential_label": str(provider.get("credentialLabel") or "api key"),
            "credential_placeholder": str(provider.get("credentialPlaceholder") or "api key"),
            "credential_default": _default_credential(provider),
            "local_endpoint_candidates": provider.get("localEndpointCandidates") if isinstance(provider.get("localEndpointCandidates"), list) else [],
            "credential_kind": contract["credential_kind"],
            "contract": contract,
        }
        summary.update(_provider_model_discovery(provider, discover_models=discover_models))
        summaries.append(summary)
    return summaries


def _provider_url(provider: dict[str, Any], path_key: str) -> str:
    base_url = str(provider.get("baseUrl") or "").rstrip("/")
    path = str(provider.get(path_key) or "")
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{base_url}/{path.lstrip('/')}"


def _local_endpoint(provider: dict[str, Any], input_value: str) -> str:
    cleaned = input_value.strip()
    default_base_url = str(provider.get("baseUrl") or "http://localhost:11434").rstrip("/")

    if not cleaned:
        return default_base_url

    if cleaned.startswith("http://") or cleaned.startswith("https://"):
        return cleaned.rstrip("/")

    if cleaned.startswith("localhost") or cleaned.startswith("127.0.0.1") or cleaned.startswith("0.0.0.0"):
        return f"http://{cleaned}".rstrip("/")

    return cleaned.rstrip("/")


def looks_like_local_agent_endpoint(value: str) -> bool:
    cleaned = value.strip().lower()
    return (
        cleaned.startswith("http://localhost")
        or cleaned.startswith("https://localhost")
        or cleaned.startswith("localhost")
        or cleaned.startswith("http://127.0.0.1")
        or cleaned.startswith("https://127.0.0.1")
        or cleaned.startswith("127.0.0.1")
        or cleaned.startswith("http://0.0.0.0")
        or cleaned.startswith("https://0.0.0.0")
        or cleaned.startswith("0.0.0.0")
    )


def _provider_headers(provider: dict[str, Any], api_key: str, *, content_type: bool = False) -> dict[str, str]:
    headers = {str(key): str(value) for key, value in provider.get("headers", {}).items()}
    auth = provider.get("auth", {})
    auth_type = auth.get("type") if isinstance(auth, dict) else "bearer"

    if auth_type == "none":
        pass
    elif auth_type == "bearer":
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


def _normalize_model_response(provider: dict[str, Any], payload: dict[str, Any]) -> list[ModelRecord]:
    response_key = provider.get("modelsResponseKey")
    raw_models = payload.get(response_key) if response_key else None
    if not isinstance(raw_models, list):
        raw_models = payload.get("data") if isinstance(payload.get("data"), list) else payload.get("models")
    if not isinstance(raw_models, list):
        return []

    required_generation_method = provider.get("requiredGenerationMethod")
    models: list[ModelRecord] = []
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
            record: ModelRecord = {"id": model_id, "label": label or model_id}
            if isinstance(raw_model, dict):
                error = str(raw_model.get("error") or raw_model.get("last_error") or "").strip()
                warning = str(raw_model.get("warning") or "").strip()
                if error:
                    record["error"] = error
                if warning:
                    record["warning"] = warning
                if raw_model.get("disabled") is not None:
                    record["disabled"] = bool(raw_model.get("disabled"))
            models.append(record)
    return _prioritize_models(provider, models)


def _static_agent_models(provider: dict[str, Any]) -> list[ModelRecord]:
    raw_models = provider.get("staticModels")
    if not isinstance(raw_models, list):
        return []

    models: list[ModelRecord] = []
    for raw_model in raw_models:
        if isinstance(raw_model, str):
            model_id = raw_model.strip()
            label = model_id
        elif isinstance(raw_model, dict):
            model_id = str(raw_model.get("id") or raw_model.get("name") or "").strip()
            label = str(raw_model.get("label") or raw_model.get("displayName") or model_id).strip()
        else:
            continue
        if model_id:
            record: ModelRecord = {"id": model_id, "label": label or model_id}
            if isinstance(raw_model, dict):
                error = str(raw_model.get("error") or raw_model.get("last_error") or "").strip()
                warning = str(raw_model.get("warning") or "").strip()
                if error:
                    record["error"] = error
                if warning:
                    record["warning"] = warning
                if raw_model.get("disabled") is not None:
                    record["disabled"] = bool(raw_model.get("disabled"))
            models.append(record)
    return _prioritize_models(provider, models)


def _prioritize_models(provider: dict[str, Any], models: list[ModelRecord]) -> list[ModelRecord]:
    recommended_model = str(provider.get("recommendedModel") or provider.get("defaultModel") or "").strip()
    if not recommended_model:
        return models

    prioritized: list[ModelRecord] = []
    remaining: list[ModelRecord] = []
    for model in models:
        if model.get("id") == recommended_model:
            label = model.get("label") or recommended_model
            prioritized.append({**model, "label": label if "recommended" in label.lower() else f"{label} (recommended)"})
        else:
            remaining.append(model)
    return [*prioritized, *remaining]


def _estimated_parameters_billion(model: str) -> float | None:
    normalized = model.lower()
    trillion_match = re.search(r"(\d+(?:\.\d+)?)\s*t\b", normalized)
    if trillion_match:
        return float(trillion_match.group(1)) * 1000
    billion_match = re.search(r"(\d+(?:\.\d+)?)\s*b\b", normalized)
    if billion_match:
        return float(billion_match.group(1))
    if normalized.endswith(":cloud") or "-cloud" in normalized:
        return None
    return None


def assess_agent_model_capability(provider: dict[str, Any], model: str) -> dict[str, Any]:
    recommended_model = str(provider.get("recommendedModel") or provider.get("defaultModel") or "").strip()
    floor = provider.get("minimumRecommendedParametersBillion")
    floor_value = float(floor) if isinstance(floor, int | float) else None
    estimated_parameters = _estimated_parameters_billion(model)
    is_recommended_model = bool(recommended_model and model == recommended_model)
    meets_floor = True
    warning = None

    if floor_value is not None and not is_recommended_model:
        if estimated_parameters is None:
            meets_floor = False
            warning = (
                f"Model parameter size is unknown. For course generation, prefer {recommended_model or 'a high-capability model'} "
                f"or another model around {floor_value:g}B+ parameters."
            )
        elif estimated_parameters < floor_value:
            meets_floor = False
            warning = (
                f"{model} appears to be about {estimated_parameters:g}B parameters. Course generation is recommended on "
                f"{recommended_model or 'a high-capability model'} or another {floor_value:g}B+ model."
            )

    return {
        "recommended_model": recommended_model or None,
        "minimum_recommended_parameters_billion": floor_value,
        "estimated_parameters_billion": estimated_parameters,
        "is_recommended_model": is_recommended_model,
        "meets_recommended_floor": meets_floor,
        "warning": warning,
    }


def fetch_agent_models(provider_id: str, api_key: str) -> list[ModelRecord]:
    provider = get_agent_provider(provider_id)
    if not provider.get("modelsPath"):
        return _static_agent_models(provider)

    if provider.get("generationAdapter") == "ollama-chat":
        base_url = _local_endpoint(provider, api_key)
        models_url = f"{base_url}/{str(provider.get('modelsPath') or '/api/tags').lstrip('/')}"
        try:
            with httpx.Client(timeout=min(SETTINGS.agent_timeout_seconds, 20)) as client:
                response = client.get(models_url)
                response.raise_for_status()
                return _normalize_model_response(provider, response.json())
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:300]
            raise CourseAgentError(f"Ollama model fetch failed: {detail}") from exc
        except httpx.HTTPError as exc:
            raise CourseAgentError(f"Ollama is unavailable at {base_url}: {exc}") from exc

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


def _runtime_command_parts(command: str, provider: dict[str, Any]) -> list[str]:
    cleaned = command.strip()
    label = str(provider.get("label") or provider.get("id") or "agent runtime")
    if not cleaned:
        raise CourseAgentError(f"Add a {label} bridge command before verifying this runtime.")
    try:
        parts = shlex.split(cleaned)
    except ValueError as exc:
        raise CourseAgentError(f"{label} bridge command could not be parsed: {exc}") from exc
    if not parts:
        raise CourseAgentError(f"Add a {label} bridge command before verifying this runtime.")

    executable = parts[0]
    executable_path = Path(executable).expanduser()
    if not executable_path.exists() and shutil.which(executable) is None:
        raise CourseAgentError(f"{label} bridge command was not found: {executable}")
    return parts


def _parse_runtime_bridge_output(provider: dict[str, Any], stdout: str) -> dict[str, Any]:
    cleaned = stdout.strip()
    if not cleaned:
        return {"ok": True}
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return {"content": cleaned}
    if not isinstance(payload, dict):
        raise CourseAgentError(f"{provider.get('label') or 'Agent runtime'} bridge returned non-object JSON.")
    return payload


def _validate_local_agent_runtime(provider: dict[str, Any], command: str) -> list[ModelRecord]:
    parts = _runtime_command_parts(command, provider)
    label = str(provider.get("label") or provider.get("id") or "Agent runtime")
    probe_payload = {
        "type": "lycium-agent-runtime-probe-v1",
        "providerId": provider.get("id"),
        "runtimeKind": provider.get("runtimeKind"),
        "requiredCapabilities": ["generate-json"],
    }
    try:
        result = subprocess.run(
            parts,
            input=json.dumps(probe_payload, ensure_ascii=False),
            text=True,
            capture_output=True,
            timeout=min(10, SETTINGS.agent_timeout_seconds),
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise CourseAgentError(f"{label} bridge probe timed out.") from exc
    except OSError as exc:
        raise CourseAgentError(f"{label} bridge could not be started: {exc}") from exc

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()[:500]
        raise CourseAgentError(f"{label} bridge probe failed: {detail or f'exit code {result.returncode}'}")

    payload = _parse_runtime_bridge_output(provider, result.stdout)
    if payload.get("ok") is False:
        detail = payload.get("error") or payload.get("message") or "Bridge reported that it is not ready."
        raise CourseAgentError(f"{label} bridge is not ready: {detail}")

    models = _normalize_model_response(provider, payload)
    return models or _static_agent_models(provider)


def detect_local_agent_endpoint(provider_id: str) -> tuple[str, list[ModelRecord]] | None:
    provider = get_agent_provider(provider_id)
    if provider.get("generationAdapter") != "ollama-chat":
        return None

    candidates = [
        str(candidate)
        for candidate in provider.get("localEndpointCandidates", [])
        if isinstance(candidate, str) and candidate.strip()
    ]
    for fallback in [provider.get("credentialDefault"), provider.get("baseUrl"), "http://localhost:11434"]:
        fallback_value = str(fallback or "").strip()
        if fallback_value and fallback_value not in candidates:
            candidates.append(fallback_value)

    for endpoint in candidates:
        try:
            return endpoint, fetch_agent_models(provider_id, endpoint)
        except CourseAgentError:
            continue
    return None


def _call_openai_chat_completions(
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    return _post_json(provider, api_key, _provider_url(provider, "chatCompletionsPath"), payload, timeout_seconds=timeout_seconds)


def _call_anthropic_messages(
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    system_content = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
    user_messages = [message for message in messages if message["role"] != "system"]
    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": 16000,
        "temperature": 0.2,
        "system": system_content,
        "messages": user_messages,
    }
    return _post_json(provider, api_key, _provider_url(provider, "messagesPath"), payload, timeout_seconds=timeout_seconds)


def _call_gemini_generate_content(
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    system_content = "\n\n".join(message["content"] for message in messages if message["role"] == "system")
    user_content = "\n\n".join(message["content"] for message in messages if message["role"] != "system")
    model_path = model if model.startswith("models/") else f"models/{model}"
    payload: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system_content}]},
        "contents": [{"role": "user", "parts": [{"text": user_content}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    url = f"{str(provider.get('baseUrl') or '').rstrip('/')}/{model_path}:generateContent"
    return _post_json(provider, api_key, url, payload, timeout_seconds=timeout_seconds)


def _call_ollama_chat(
    provider: dict[str, Any],
    model_or_endpoint: str,
    messages: list[dict[str, str]],
    model: str,
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    base_url = _local_endpoint(provider, model_or_endpoint)
    selected_model = str(model or provider.get("defaultModel") or "").strip()
    if not selected_model:
        raise CourseAgentError("Choose an Ollama model before generating a course.")

    payload: dict[str, Any] = {
        "model": selected_model,
        "messages": messages,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.2},
    }
    url = f"{base_url}/{str(provider.get('chatPath') or '/api/chat').lstrip('/')}"
    return _post_json(provider, "", url, payload, timeout_seconds=timeout_seconds)


def _call_local_agent_runtime(
    provider: dict[str, Any],
    runtime_command: str,
    messages: list[dict[str, str]],
    model: str,
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    parts = _runtime_command_parts(runtime_command, provider)
    label = str(provider.get("label") or provider.get("id") or "Agent runtime")
    selected_model = str(model or provider.get("defaultModel") or "").strip()
    payload = {
        "type": "lycium-agent-runtime-generate-v1",
        "providerId": provider.get("id"),
        "runtimeKind": provider.get("runtimeKind"),
        "model": selected_model,
        "messages": messages,
        "responseFormat": "json_object",
        "temperature": 0.2,
    }
    try:
        result = subprocess.run(
            parts,
            input=json.dumps(payload, ensure_ascii=False),
            text=True,
            capture_output=True,
            timeout=timeout_seconds or SETTINGS.agent_timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise CourseAgentError(f"{label} bridge generation timed out.") from exc
    except OSError as exc:
        raise CourseAgentError(f"{label} bridge could not be started: {exc}") from exc

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()[:500]
        raise CourseAgentError(f"{label} bridge generation failed: {detail or f'exit code {result.returncode}'}")
    return _parse_runtime_bridge_output(provider, result.stdout)


def _post_json(
    provider: dict[str, Any],
    api_key: str,
    url: str,
    payload: dict[str, Any],
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    max_attempts = 3
    attempt_errors: list[dict[str, Any]] = []
    timeout = timeout_seconds or SETTINGS.agent_timeout_seconds

    for attempt in range(1, max_attempts + 1):
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.post(url, headers=_provider_headers(provider, api_key, content_type=True), json=payload)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500]
            status_code = exc.response.status_code
            attempt_errors.append({"attempt": attempt, "timeout_seconds": timeout, "status_code": status_code, "detail": detail})
            if status_code in RETRYABLE_STATUS_CODES and attempt < max_attempts:
                time.sleep(0.75 * attempt)
                continue
            raise CourseAgentError(
                f"LLM API rejected the request after {attempt} attempt(s): {detail}",
                trace={"provider_attempts": attempt_errors},
            ) from exc
        except httpx.HTTPError as exc:
            detail = str(exc)
            attempt_errors.append({"attempt": attempt, "timeout_seconds": timeout, "detail": detail})
            is_transient = any(marker in detail.lower() for marker in TRANSIENT_ERROR_MARKERS)
            if is_transient and attempt < max_attempts:
                time.sleep(0.75 * attempt)
                continue
            raise CourseAgentError(
                f"LLM API request failed after {attempt} attempt(s): {detail}",
                trace={"provider_attempts": attempt_errors},
            ) from exc

    raise CourseAgentError("LLM API request failed without a response.", trace={"provider_attempts": attempt_errors})


def call_agent_model(
    provider: dict[str, Any],
    api_key: str,
    messages: list[dict[str, str]],
    model: str,
    *,
    timeout_seconds: float | None = None,
) -> dict[str, Any]:
    adapter = provider.get("generationAdapter")
    if adapter == "ollama-chat":
        return _call_ollama_chat(provider, api_key, messages, model, timeout_seconds=timeout_seconds)
    if adapter == "local-agent-runtime":
        return _call_local_agent_runtime(provider, api_key, messages, model, timeout_seconds=timeout_seconds)
    if adapter == "anthropic-messages":
        return _call_anthropic_messages(provider, api_key, messages, model, timeout_seconds=timeout_seconds)
    if adapter == "gemini-generate-content":
        return _call_gemini_generate_content(provider, api_key, messages, model, timeout_seconds=timeout_seconds)
    return _call_openai_chat_completions(provider, api_key, messages, model, timeout_seconds=timeout_seconds)


def validate_agent_api_key(api_key: str, provider_id: str = "openai", model: str | None = None) -> list[ModelRecord]:
    provider = get_agent_provider(provider_id)
    if provider.get("generationAdapter") == "local-agent-runtime":
        models = _validate_local_agent_runtime(provider, api_key)
        selected_model = model or provider.get("defaultModel") or (models[0]["id"] if models else SETTINGS.agent_model)
        if selected_model and not any(record["id"] == selected_model for record in models):
            models.insert(0, {"id": str(selected_model), "label": str(selected_model)})
        return models

    models = fetch_agent_models(provider_id, api_key)
    if provider.get("generationAdapter") == "ollama-chat":
        selected_model = model or (models[0]["id"] if models else str(provider.get("defaultModel") or SETTINGS.agent_model))
        if selected_model and not any(record["id"] == selected_model for record in models):
            models.insert(0, {"id": str(selected_model), "label": str(selected_model)})
        return models

    selected_model = model or provider.get("defaultModel") or (models[0]["id"] if models else SETTINGS.agent_model)
    if selected_model and not any(record["id"] == selected_model for record in models):
        models.insert(0, {"id": str(selected_model), "label": str(selected_model)})
    return models
