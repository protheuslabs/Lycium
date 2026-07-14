
from __future__ import annotations

from pathlib import Path
from typing import Any

from app.agent_model_records import normalize_model_records
from app.config import SETTINGS
from app.course_agent_providers import (
    agent_provider_contract,
    assess_agent_model_capability,
    get_agent_provider,
    validate_agent_api_key,
)
from app.course_agent_types import CourseAgentError
from app.local_store_core import _now, _read_json, _safe_key, _write_json, ensure_local_data_dirs


def _agent_secret_path() -> Path:
    return ensure_local_data_dirs() / "secrets" / "agent.json"


def _mask_key(api_key: str) -> str:
    if not api_key:
        return ""
    visible_count = min(6, max(4, len(api_key) // 8))
    hidden_count = max(len(api_key) - visible_count, 0)
    return f"{'*' * hidden_count}{api_key[-visible_count:]}"


def _credential_preview(key: dict[str, Any]) -> str:
    credential = str(key.get("agent_api_key") or "")
    provider_metadata = _agent_provider_metadata(str(key.get("provider_id") or ""))
    if provider_metadata.get("credential_kind") != "api_key":
        return credential
    return _mask_key(credential)


def _agent_provider_metadata(provider_id: str, provider_label: str | None = None) -> dict[str, Any]:
    try:
        provider = get_agent_provider(provider_id)
        contract = agent_provider_contract(provider)
        return {
            "provider_label": str(provider.get("label") or provider_label or provider_id),
            "generation_adapter": str(provider.get("generationAdapter") or contract["generation_adapter"]),
            "local_provider": bool(provider.get("localProvider") or contract["provider_kind"] == "local"),
            "credential_label": str(provider.get("credentialLabel") or ("local path" if contract["credential_kind"] == "local_endpoint" else "api key")),
            "credential_kind": contract["credential_kind"],
            "contract": contract,
        }
    except Exception:
        local_provider = provider_id == "local-model" or provider_id.endswith("-runtime")
        agent_runtime_provider = provider_id.endswith("-runtime")
        credential_kind = "local_endpoint" if local_provider else "api_key"
        if agent_runtime_provider:
            credential_kind = "local_runtime"
        return {
            "provider_label": provider_label or provider_id,
            "generation_adapter": "",
            "local_provider": local_provider,
            "credential_label": "local path" if local_provider else "api key",
            "credential_kind": credential_kind,
            "contract": {
                "provider_kind": "agent_runtime" if agent_runtime_provider else ("local" if local_provider else "cloud"),
                "credential_kind": credential_kind,
                "generation_adapter": "",
                "requires_verified_connection": True,
                "supports_model_list": False,
                "supports_json_mode": False,
                "supports_streaming": False,
                "supports_tool_use": False,
                "supports_usage_metadata": False,
                "model_source": "runtime_bridge" if agent_runtime_provider else "static_default",
                "capabilities": {},
            },
        }


def _agent_model_capability(provider_id: str, model: str | None) -> dict[str, Any]:
    if not model:
        return {
            "recommended_model": None,
            "minimum_recommended_parameters_billion": None,
            "estimated_parameters_billion": None,
            "is_recommended_model": False,
            "meets_recommended_floor": True,
            "warning": None,
        }
    try:
        return assess_agent_model_capability(get_agent_provider(provider_id), str(model))
    except Exception:
        return {
            "recommended_model": None,
            "minimum_recommended_parameters_billion": None,
            "estimated_parameters_billion": None,
            "is_recommended_model": False,
            "meets_recommended_floor": True,
            "warning": None,
        }


def _enrich_agent_key(key: dict[str, Any]) -> dict[str, Any]:
    metadata = _agent_provider_metadata(str(key.get("provider_id") or "openai"), str(key.get("provider_label") or ""))
    return {
        **key,
        **metadata,
        "model_capability": _agent_model_capability(
            str(key.get("provider_id") or "openai"),
            str(key.get("model") or "") or None,
        ),
    }


def _normalize_secret_payload(secret: dict[str, Any]) -> dict[str, Any]:
    keys = secret.get("agent_keys")
    if isinstance(keys, list):
        normalized_keys = []
        for key in keys:
            if not isinstance(key, dict) or not key.get("agent_api_key"):
                continue
            provider_id = str(key.get("provider_id") or "openai")
            provider_label = str(key.get("provider_label") or ("OpenAI" if provider_id == "openai" else provider_id))
            selected_model = str(key.get("model") or key.get("selected_model") or SETTINGS.agent_model)
            normalized_keys.append(
                {
                    "id": str(key.get("id") or _safe_key(f"{provider_id}-key")),
                    "provider_id": provider_id,
                    "provider_label": provider_label,
                    "agent_api_key": str(key.get("agent_api_key") or ""),
                    "model": selected_model,
                    "models": normalize_model_records(key.get("models"), selected_model),
                    "models_fetched_at": key.get("models_fetched_at"),
                    "connection_status": str(key.get("connection_status") or "verified"),
                    "connection_message": key.get("connection_message"),
                    "last_verified_at": key.get("last_verified_at"),
                    "last_error": key.get("last_error"),
                    "created_at": key.get("created_at") or _now(),
                    "updated_at": key.get("updated_at") or key.get("created_at") or _now(),
                }
            )
        active_key_id = secret.get("active_agent_key_id")
        if active_key_id is None and normalized_keys:
            active_key_id = normalized_keys[0]["id"]
        return {"agent_keys": normalized_keys, "active_agent_key_id": active_key_id}

    legacy_key = str(secret.get("agent_api_key") or "")
    if legacy_key:
        return {
            "agent_keys": [
                {
                    "id": "default",
                    "provider_id": "openai",
                    "provider_label": "OpenAI",
                    "agent_api_key": legacy_key,
                    "model": SETTINGS.agent_model,
                    "models": normalize_model_records([], SETTINGS.agent_model),
                    "models_fetched_at": secret.get("updated_at"),
                    "connection_status": "verified",
                    "connection_message": None,
                    "last_verified_at": secret.get("updated_at") or _now(),
                    "last_error": None,
                    "created_at": secret.get("updated_at") or _now(),
                    "updated_at": secret.get("updated_at") or _now(),
                }
            ],
            "active_agent_key_id": "default",
        }

    return {"agent_keys": [], "active_agent_key_id": None}


def local_settings_summary() -> dict[str, Any]:
    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    active_key_id = secret.get("active_agent_key_id")
    keys = secret.get("agent_keys", [])
    active_key = next((key for key in keys if key["id"] == active_key_id), keys[0] if keys else None)

    return {
        "local_data_dir": str(ensure_local_data_dirs()),
        "has_agent_api_key": bool(keys),
        "agent_api_key_preview": _credential_preview(active_key) if active_key else None,
        "active_agent_key_id": active_key["id"] if active_key else None,
        "agent_keys": [
            {
                "id": enriched_key["id"],
                "provider_id": enriched_key["provider_id"],
                "provider_label": enriched_key["provider_label"],
                "key_preview": _credential_preview(enriched_key),
                "model": enriched_key.get("model"),
                "models": enriched_key.get("models", []),
                "models_fetched_at": enriched_key.get("models_fetched_at"),
                "connection_status": enriched_key.get("connection_status") or "verified",
                "connection_message": enriched_key.get("connection_message"),
                "last_verified_at": enriched_key.get("last_verified_at"),
                "last_error": enriched_key.get("last_error"),
                "is_active": enriched_key["id"] == (active_key["id"] if active_key else None),
                "generation_adapter": enriched_key.get("generation_adapter"),
                "local_provider": bool(enriched_key.get("local_provider")),
                "credential_label": enriched_key.get("credential_label") or "api key",
                "credential_kind": enriched_key.get("credential_kind") or "api_key",
                "contract": enriched_key.get("contract"),
                "model_capability": enriched_key.get("model_capability"),
            }
            for enriched_key in [_enrich_agent_key(key) for key in keys]
        ],
    }


def save_agent_api_key(
    *,
    provider_id: str,
    provider_label: str,
    api_key: str,
    models: list[dict[str, Any]],
    model: str | None = None,
    connection_status: str = "verified",
    connection_message: str | None = None,
) -> dict[str, Any]:
    cleaned = api_key.strip()
    cleaned_provider_id = provider_id.strip()
    cleaned_provider_label = provider_label.strip() or cleaned_provider_id
    if not cleaned_provider_id:
        raise ValueError("Provider cannot be blank.")
    if not cleaned:
        raise ValueError("API key cannot be blank.")

    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    selected_model = model or (models[0]["id"] if models else SETTINGS.agent_model)
    normalized_models = normalize_model_records(models, selected_model)
    verified_at = _now() if connection_status == "verified" else None
    for key in secret["agent_keys"]:
        if key.get("provider_id") != cleaned_provider_id or key.get("agent_api_key") != cleaned:
            continue
        key["provider_label"] = cleaned_provider_label
        key["model"] = selected_model
        key["models"] = normalized_models
        key["models_fetched_at"] = _now()
        key["connection_status"] = connection_status
        key["connection_message"] = connection_message
        key["last_verified_at"] = verified_at or key.get("last_verified_at")
        key["last_error"] = None if connection_status == "verified" else connection_message
        key["updated_at"] = _now()
        secret["active_agent_key_id"] = key["id"]
        secret["updated_at"] = _now()
        secret["purpose"] = "Course generation agent access."
        _write_json(_agent_secret_path(), secret)
        return local_settings_summary()

    key_id_base = _safe_key(cleaned_provider_id.lower())
    key_id = key_id_base
    existing_ids = {key["id"] for key in secret["agent_keys"]}
    suffix = 2
    while key_id in existing_ids:
        key_id = f"{key_id_base}-{suffix}"
        suffix += 1

    secret["agent_keys"].append(
        {
            "id": key_id,
            "provider_id": cleaned_provider_id,
            "provider_label": cleaned_provider_label,
            "agent_api_key": cleaned,
            "model": selected_model,
            "models": normalized_models,
            "models_fetched_at": _now(),
            "connection_status": connection_status,
            "connection_message": connection_message,
            "last_verified_at": verified_at,
            "last_error": None if connection_status == "verified" else connection_message,
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    secret["active_agent_key_id"] = key_id
    secret["updated_at"] = _now()
    secret["purpose"] = "Course generation agent access."
    _write_json(_agent_secret_path(), secret)
    return local_settings_summary()


def get_agent_profile_by_id(key_id: str) -> dict[str, Any] | None:
    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    key = next((key for key in secret.get("agent_keys", []) if key["id"] == key_id), None)
    return _enrich_agent_key(key) if key else None


def update_agent_key_verification(
    key_id: str,
    *,
    models: list[dict[str, Any]],
    model: str | None,
    connection_status: str,
    connection_message: str | None = None,
) -> dict[str, Any]:
    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    for key in secret["agent_keys"]:
        if key["id"] != key_id:
            continue
        selected_model = model or key.get("model") or (models[0]["id"] if models else SETTINGS.agent_model)
        key["models"] = normalize_model_records(models, selected_model)
        key["model"] = selected_model
        key["models_fetched_at"] = _now()
        key["connection_status"] = connection_status
        key["connection_message"] = connection_message
        key["last_verified_at"] = _now() if connection_status == "verified" else key.get("last_verified_at")
        key["last_error"] = None if connection_status == "verified" else connection_message
        key["updated_at"] = _now()
        secret["updated_at"] = _now()
        _write_json(_agent_secret_path(), secret)
        return local_settings_summary()

    raise ValueError("API key not found.")


def activate_agent_api_key(key_id: str) -> dict[str, Any]:
    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    if not any(key["id"] == key_id for key in secret["agent_keys"]):
        raise ValueError("API key not found.")

    secret["active_agent_key_id"] = key_id
    secret["updated_at"] = _now()
    _write_json(
        _agent_secret_path(),
        secret,
    )
    return local_settings_summary()


def delete_agent_api_key(key_id: str) -> dict[str, Any]:
    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    original_count = len(secret["agent_keys"])
    secret["agent_keys"] = [key for key in secret["agent_keys"] if key["id"] != key_id]
    if len(secret["agent_keys"]) == original_count:
        raise ValueError("API key not found.")

    if secret.get("active_agent_key_id") == key_id:
        secret["active_agent_key_id"] = secret["agent_keys"][0]["id"] if secret["agent_keys"] else None
    secret["updated_at"] = _now()
    _write_json(_agent_secret_path(), secret)
    return local_settings_summary()


def update_agent_key_model(key_id: str, model: str) -> dict[str, Any]:
    cleaned_model = model.strip()
    if not cleaned_model:
        raise ValueError("Model cannot be blank.")

    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    for key in secret["agent_keys"]:
        if key["id"] != key_id:
            continue
        available_model_ids = {
            available_model["id"]
            for available_model in key.get("models", [])
            if not available_model.get("disabled") and not available_model.get("error")
        }
        if available_model_ids and cleaned_model not in available_model_ids:
            try:
                refreshed_models = validate_agent_api_key(
                    str(key.get("agent_api_key") or ""),
                    provider_id=str(key.get("provider_id") or ""),
                    model=cleaned_model,
                )
            except CourseAgentError as exc:
                raise ValueError(f"Model is not available for this API key. {exc}") from exc
            normalized_models = normalize_model_records(refreshed_models, cleaned_model)
            refreshed_model_ids = {
                available_model["id"]
                for available_model in normalized_models
                if not available_model.get("disabled") and not available_model.get("error")
            }
            if cleaned_model not in refreshed_model_ids:
                raise ValueError("Model is not available for this API key.")
            key["models"] = normalized_models
            key["models_fetched_at"] = _now()
            key["connection_status"] = "verified"
            key["connection_message"] = "Connection verified."
            key["last_verified_at"] = _now()
            key["last_error"] = None
        key["model"] = cleaned_model
        key["updated_at"] = _now()
        secret["updated_at"] = _now()
        _write_json(_agent_secret_path(), secret)
        return local_settings_summary()

    raise ValueError("API key not found.")


def get_active_agent_profile() -> dict[str, Any] | None:
    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    keys = secret.get("agent_keys", [])
    active_key_id = secret.get("active_agent_key_id")
    active_key = next((key for key in keys if key["id"] == active_key_id), keys[0] if keys else None)
    if not active_key:
        return None
    return _enrich_agent_key(active_key)


def require_verified_active_agent_profile() -> dict[str, Any]:
    active_key = get_active_agent_profile()
    if not active_key or not str(active_key.get("agent_api_key") or "").strip():
        raise ValueError("No active agent API key is saved. Add one in Settings first.")
    if active_key.get("connection_status") != "verified":
        raise ValueError("Active AI connection is unverified. Verify it in Settings before generating a course.")
    if not str(active_key.get("model") or "").strip():
        raise ValueError("Choose an AI model in Settings before generating a course.")
    model_capability = active_key.get("model_capability") if isinstance(active_key.get("model_capability"), dict) else {}
    if model_capability.get("meets_recommended_floor") is False:
        warning = str(model_capability.get("warning") or "").strip()
        raise ValueError(
            warning
            or "The selected AI model is below Lycium's recommended course-generation capacity. Choose a 70B+ model."
        )
    return active_key


def get_active_agent_api_key() -> str | None:
    active_key = get_active_agent_profile()
    if not active_key:
        return None
    return str(active_key.get("agent_api_key") or "") or None
