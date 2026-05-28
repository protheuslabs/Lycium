
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import SETTINGS
from app.security import PRIVATE_DIR_MODE, PRIVATE_FILE_MODE, chmod_private, permission_mode, permissions_are_private

LOCAL_DATA_SUBDIRS = ("courses", "completion", "links", "secrets", "user")
LOCAL_DATA_SCHEMA_VERSION = 2
LOCAL_DATA_DIRECTORIES = {
    "courses": "Generated course snapshots and exports.",
    "completion": "Learner completion and progress mirrors.",
    "links": "User-added or fetched source/link metadata.",
    "secrets": "Local secrets such as agent provider credentials.",
    "user": "Local learner and user preference data.",
}
LOCAL_DATA_MIGRATIONS = (
    {
        "id": "001_manifest_schema_version",
        "version": 1,
        "description": "Add local data schema versioning and migration history.",
    },
    {
        "id": "002_agent_key_profiles",
        "version": 2,
        "description": "Normalize AI credentials into provider/model profile records.",
    },
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_key(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_.-]+", "-", value.strip()).strip("-")
    return safe or "default"


def ensure_local_data_dirs() -> Path:
    root = SETTINGS.local_data_dir
    root.mkdir(parents=True, exist_ok=True)
    chmod_private(root, PRIVATE_DIR_MODE)
    for subdir in LOCAL_DATA_SUBDIRS:
        path = root / subdir
        path.mkdir(parents=True, exist_ok=True)
        chmod_private(path, PRIVATE_DIR_MODE)

    run_local_data_migrations(root)
    return root


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    chmod_private(path.parent, PRIVATE_DIR_MODE)
    tmp_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    chmod_private(tmp_path, PRIVATE_FILE_MODE)
    tmp_path.replace(path)
    chmod_private(path, PRIVATE_FILE_MODE)


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


def _normalize_agent_secret_payload(secret: dict[str, Any]) -> dict[str, Any]:
    keys = secret.get("agent_keys")
    now = _now()
    if isinstance(keys, list):
        normalized_keys = []
        for key in keys:
            if not isinstance(key, dict) or not str(key.get("agent_api_key") or "").strip():
                continue
            provider_id = str(key.get("provider_id") or "openai")
            provider_label = str(key.get("provider_label") or ("OpenAI" if provider_id == "openai" else provider_id))
            selected_model = str(key.get("model") or key.get("selected_model") or SETTINGS.agent_model)
            connection_status = str(key.get("connection_status") or "verified")
            if connection_status not in {"verified", "unverified"}:
                connection_status = "verified"
            normalized_keys.append(
                {
                    "id": str(key.get("id") or _safe_key(f"{provider_id}-key")),
                    "provider_id": provider_id,
                    "provider_label": provider_label,
                    "agent_api_key": str(key.get("agent_api_key") or ""),
                    "model": selected_model,
                    "models": _normalize_model_records(key.get("models"), selected_model),
                    "models_fetched_at": key.get("models_fetched_at"),
                    "connection_status": connection_status,
                    "connection_message": key.get("connection_message"),
                    "last_verified_at": key.get("last_verified_at") if connection_status == "verified" else None,
                    "last_error": key.get("last_error"),
                    "created_at": key.get("created_at") or now,
                    "updated_at": now,
                }
            )
        active_key_id = secret.get("active_agent_key_id")
        if active_key_id is None and normalized_keys:
            active_key_id = normalized_keys[0]["id"]
        return {
            **secret,
            "agent_keys": normalized_keys,
            "active_agent_key_id": active_key_id,
            "updated_at": now,
            "purpose": secret.get("purpose") or "Course generation agent access.",
        }

    legacy_key = str(secret.get("agent_api_key") or "")
    if legacy_key:
        selected_model = str(secret.get("model") or SETTINGS.agent_model)
        return {
            "agent_keys": [
                {
                    "id": "default",
                    "provider_id": "openai",
                    "provider_label": "OpenAI",
                    "agent_api_key": legacy_key,
                    "model": selected_model,
                    "models": _normalize_model_records(secret.get("models"), selected_model),
                    "models_fetched_at": secret.get("updated_at"),
                    "connection_status": "verified",
                    "connection_message": None,
                    "last_verified_at": secret.get("updated_at") or now,
                    "last_error": None,
                    "created_at": secret.get("updated_at") or now,
                    "updated_at": now,
                }
            ],
            "active_agent_key_id": "default",
            "updated_at": now,
            "purpose": "Course generation agent access.",
        }
    return {**secret, "agent_keys": [], "active_agent_key_id": None, "updated_at": now}


def _base_manifest(payload: Any) -> dict[str, Any]:
    manifest = payload if isinstance(payload, dict) else {}
    created_at = manifest.get("created_at") or _now()
    migrations = manifest.get("migrations") if isinstance(manifest.get("migrations"), list) else []
    return {
        **manifest,
        "created_at": created_at,
        "description": "Local Lycium user data. This directory is intentionally gitignored.",
        "schema_version": int(manifest.get("schema_version") or 0),
        "target_schema_version": LOCAL_DATA_SCHEMA_VERSION,
        "directories": LOCAL_DATA_DIRECTORIES,
        "migrations": migrations,
    }


def _migration_applied(manifest: dict[str, Any], migration_id: str) -> bool:
    return any(isinstance(row, dict) and row.get("id") == migration_id for row in manifest.get("migrations", []))


def _append_migration_record(manifest: dict[str, Any], migration: dict[str, Any]) -> None:
    manifest.setdefault("migrations", []).append(
        {
            "id": migration["id"],
            "version": migration["version"],
            "description": migration["description"],
            "applied_at": _now(),
        }
    )


def _apply_local_data_migration(root: Path, manifest: dict[str, Any], migration: dict[str, Any]) -> None:
    if migration["id"] == "001_manifest_schema_version":
        manifest["directories"] = LOCAL_DATA_DIRECTORIES
    elif migration["id"] == "002_agent_key_profiles":
        secret_path = root / "secrets" / "agent.json"
        secret = _read_json(secret_path, {})
        if isinstance(secret, dict) and secret:
            normalized = _normalize_agent_secret_payload(secret)
            if normalized != secret:
                _write_json(secret_path, normalized)
    manifest["schema_version"] = max(int(manifest.get("schema_version") or 0), int(migration["version"]))


def run_local_data_migrations(root: Path | None = None) -> dict[str, Any]:
    local_root = root or SETTINGS.local_data_dir
    local_root.mkdir(parents=True, exist_ok=True)
    for subdir in LOCAL_DATA_SUBDIRS:
        (local_root / subdir).mkdir(parents=True, exist_ok=True)

    manifest_path = local_root / "manifest.json"
    manifest = _base_manifest(_read_json(manifest_path, {}))
    for migration in LOCAL_DATA_MIGRATIONS:
        if _migration_applied(manifest, migration["id"]):
            continue
        _apply_local_data_migration(local_root, manifest, migration)
        _append_migration_record(manifest, migration)

    manifest["schema_version"] = LOCAL_DATA_SCHEMA_VERSION
    manifest["target_schema_version"] = LOCAL_DATA_SCHEMA_VERSION
    manifest["directories"] = LOCAL_DATA_DIRECTORIES
    manifest["updated_at"] = _now()
    _write_json(manifest_path, manifest)
    return local_data_migration_status(local_root)


def local_data_migration_status(root: Path | None = None) -> dict[str, Any]:
    local_root = root or SETTINGS.local_data_dir
    manifest = _base_manifest(_read_json(local_root / "manifest.json", {}))
    applied_ids = {
        row.get("id")
        for row in manifest.get("migrations", [])
        if isinstance(row, dict) and isinstance(row.get("id"), str)
    }
    pending = [migration for migration in LOCAL_DATA_MIGRATIONS if migration["id"] not in applied_ids]
    return {
        "local_data_dir": str(local_root),
        "schema_version": int(manifest.get("schema_version") or 0),
        "target_schema_version": LOCAL_DATA_SCHEMA_VERSION,
        "pending_migrations": pending,
        "migrations": manifest.get("migrations", []),
        "updated_at": manifest.get("updated_at"),
    }


def local_data_security_status(root: Path | None = None) -> dict[str, Any]:
    local_root = root or SETTINGS.local_data_dir
    secret_dir = local_root / "secrets"
    agent_secret_path = secret_dir / "agent.json"
    root_private = permissions_are_private(local_root)
    secret_dir_private = permissions_are_private(secret_dir)
    secret_file_private = permissions_are_private(agent_secret_path)
    warnings: list[str] = []
    if not root_private:
        warnings.append("Local data directory is readable by group or others.")
    if not secret_dir_private:
        warnings.append("Secrets directory is readable by group or others.")
    if not secret_file_private:
        warnings.append("Agent secret file is readable by group or others.")
    warnings.append("Local secrets are stored in a private local file, not encrypted-at-rest or OS-keychain backed yet.")

    return {
        "local_data_dir": str(local_root),
        "secret_backend": "local-file",
        "encryption_at_rest": False,
        "os_keychain_backed": False,
        "secrets_file_exists": agent_secret_path.exists(),
        "local_data_dir_mode": permission_mode(local_root),
        "secrets_dir_mode": permission_mode(secret_dir),
        "secrets_file_mode": permission_mode(agent_secret_path),
        "permissions_private": root_private and secret_dir_private and secret_file_private,
        "warnings": warnings,
    }
