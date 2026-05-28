
from __future__ import annotations

from typing import Any

from app.config import SETTINGS
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
    if key.get("provider_id") == "local-model":
        return credential
    return _mask_key(credential)


def _normalize_model_records(models: Any, selected_model: str | None = None) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    if isinstance(models, list):
        for model in models:
            if isinstance(model, str):
                model_id = model.strip()
                label = model_id
            elif isinstance(model, dict):
                model_id = str(model.get("id") or model.get("name") or "").strip()
                label = str(model.get("label") or model.get("display_name") or model.get("displayName") or model_id)
            else:
                continue
            if model_id:
                normalized.append({"id": model_id, "label": label or model_id})

    if selected_model and not any(model["id"] == selected_model for model in normalized):
        normalized.insert(0, {"id": selected_model, "label": selected_model})

    deduped: list[dict[str, str]] = []
    seen: set[str] = set()
    for model in normalized:
        if model["id"] in seen:
            continue
        seen.add(model["id"])
        deduped.append(model)
    return deduped


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
                    "models": _normalize_model_records(key.get("models"), selected_model),
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
                    "models": _normalize_model_records([], SETTINGS.agent_model),
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
                "id": key["id"],
                "provider_id": key["provider_id"],
                "provider_label": key["provider_label"],
                "key_preview": _credential_preview(key),
                "model": key.get("model"),
                "models": key.get("models", []),
                "models_fetched_at": key.get("models_fetched_at"),
                "connection_status": key.get("connection_status") or "verified",
                "connection_message": key.get("connection_message"),
                "last_verified_at": key.get("last_verified_at"),
                "last_error": key.get("last_error"),
                "is_active": key["id"] == (active_key["id"] if active_key else None),
            }
            for key in keys
        ],
    }


def save_agent_api_key(
    *,
    provider_id: str,
    provider_label: str,
    api_key: str,
    models: list[dict[str, str]],
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
    normalized_models = _normalize_model_records(models, selected_model)
    verified_at = _now() if connection_status == "verified" else None
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
    return next((key for key in secret.get("agent_keys", []) if key["id"] == key_id), None)


def update_agent_key_verification(
    key_id: str,
    *,
    models: list[dict[str, str]],
    model: str | None,
    connection_status: str,
    connection_message: str | None = None,
) -> dict[str, Any]:
    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    for key in secret["agent_keys"]:
        if key["id"] != key_id:
            continue
        selected_model = model or key.get("model") or (models[0]["id"] if models else SETTINGS.agent_model)
        key["models"] = _normalize_model_records(models, selected_model)
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


def update_agent_key_model(key_id: str, model: str) -> dict[str, Any]:
    cleaned_model = model.strip()
    if not cleaned_model:
        raise ValueError("Model cannot be blank.")

    secret = _normalize_secret_payload(_read_json(_agent_secret_path(), {}))
    for key in secret["agent_keys"]:
        if key["id"] != key_id:
            continue
        available_model_ids = {available_model["id"] for available_model in key.get("models", [])}
        if available_model_ids and cleaned_model not in available_model_ids:
            raise ValueError("Model is not available for this API key.")
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
    return active_key


def get_active_agent_api_key() -> str | None:
    active_key = get_active_agent_profile()
    if not active_key:
        return None
    return str(active_key.get("agent_api_key") or "") or None
