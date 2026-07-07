
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.agent_model_records import normalize_model_records
from app.config import SETTINGS
from app.security import PRIVATE_DIR_MODE, PRIVATE_FILE_MODE, chmod_private, permission_mode, permissions_are_private

LOCAL_DATA_SUBDIRS = ("courses", "completion", "generation-runs", "links", "secrets", "user", "backups")
LOCAL_DATA_SCHEMA_VERSION = 3
LOCAL_DATA_EXPORT_FORMAT = "lycium-local-data-export-v1"
LOCAL_DATA_REPAIR_WARNING_FILE = "local-data-repair-warnings.json"
LOCAL_DATA_DIRECTORIES = {
    "courses": "Generated course snapshots and exports.",
    "completion": "Learner completion and progress mirrors.",
    "generation-runs": "Durable local mirrors of generation run timelines and results.",
    "links": "User-added or fetched source/link metadata.",
    "secrets": "Local secrets such as agent provider credentials.",
    "user": "Local learner and user preference data.",
    "backups": "Local JSON backups created before risky operations or user-requested exports.",
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
    {
        "id": "003_local_backups_directory",
        "version": 3,
        "description": "Add dedicated local generation-run and backup directories with export format metadata.",
    },
)


class LocalDataMigrationError(RuntimeError):
    """Raised when local data cannot be safely migrated by this Lycium version."""


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


def _repair_warning_path(root: Path) -> Path:
    return root / "user" / LOCAL_DATA_REPAIR_WARNING_FILE


def _repair_warning_rows(root: Path) -> list[dict[str, Any]]:
    path = _repair_warning_path(root)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return [row for row in payload if isinstance(row, dict)] if isinstance(payload, list) else []


def _relative_path(root: Path, path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def _backup_corrupt_json(root: Path, path: Path) -> Path | None:
    if not path.exists():
        return None
    backup_dir = root / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    chmod_private(backup_dir, PRIVATE_DIR_MODE)
    backup_name = f"corrupt-{_safe_key(_relative_path(root, path))}-{_safe_key(_now())}.json.bak"
    backup_path = backup_dir / backup_name
    try:
        backup_path.write_text(path.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
        chmod_private(backup_path, PRIVATE_FILE_MODE)
        return backup_path
    except OSError:
        return None


def _record_repair_warning(root: Path, *, path: Path, error: str, action: str, backup_path: Path | None) -> None:
    repair_path = _repair_warning_path(root)
    if path == repair_path:
        return
    warnings = _repair_warning_rows(root)
    warnings.append(
        {
            "path": _relative_path(root, path),
            "error": error,
            "action": action,
            "backupPath": _relative_path(root, backup_path) if backup_path else None,
            "createdAt": _now(),
        }
    )
    _write_json(repair_path, warnings[-25:])


def _read_json(
    path: Path,
    fallback: Any,
    *,
    repair_root: Path | None = None,
    replace_corrupt: bool = False,
    repair_action: str = "backed up corrupt JSON and used fallback data",
) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        if repair_root is not None:
            error = f"{path}: invalid JSON at line {exc.lineno}, column {exc.colno}"
            backup_path = _backup_corrupt_json(repair_root, path)
            if replace_corrupt:
                _write_json(path, fallback)
            _record_repair_warning(repair_root, path=path, error=error, action=repair_action, backup_path=backup_path)
        return fallback


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    chmod_private(path.parent, PRIVATE_DIR_MODE)
    tmp_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    chmod_private(tmp_path, PRIVATE_FILE_MODE)
    tmp_path.replace(path)
    chmod_private(path, PRIVATE_FILE_MODE)


def _read_json_strict(path: Path) -> tuple[Any | None, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except json.JSONDecodeError as exc:
        return None, f"{path}: invalid JSON at line {exc.lineno}, column {exc.colno}"
    except OSError as exc:
        return None, f"{path}: {exc}"


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
                    "models": normalize_model_records(key.get("models"), selected_model),
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
                    "models": normalize_model_records(secret.get("models"), selected_model),
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
        secret = _read_json(
            secret_path,
            {},
            repair_root=root,
            replace_corrupt=True,
            repair_action="Backed up corrupt agent secret file and replaced it with an empty agent profile.",
        )
        if isinstance(secret, dict) and secret:
            normalized = _normalize_agent_secret_payload(secret)
            if normalized != secret:
                _write_json(secret_path, normalized)
    elif migration["id"] == "003_local_backups_directory":
        (root / "backups").mkdir(parents=True, exist_ok=True)
        chmod_private(root / "backups", PRIVATE_DIR_MODE)
        (root / "generation-runs").mkdir(parents=True, exist_ok=True)
        chmod_private(root / "generation-runs", PRIVATE_DIR_MODE)
    manifest["schema_version"] = max(int(manifest.get("schema_version") or 0), int(migration["version"]))


def run_local_data_migrations(root: Path | None = None) -> dict[str, Any]:
    local_root = root or SETTINGS.local_data_dir
    local_root.mkdir(parents=True, exist_ok=True)
    for subdir in LOCAL_DATA_SUBDIRS:
        (local_root / subdir).mkdir(parents=True, exist_ok=True)

    manifest_path = local_root / "manifest.json"
    manifest = _base_manifest(
        _read_json(
            manifest_path,
            {},
            repair_root=local_root,
            replace_corrupt=True,
            repair_action="Backed up corrupt manifest and regenerated local data manifest.",
        )
    )
    if int(manifest.get("schema_version") or 0) > LOCAL_DATA_SCHEMA_VERSION:
        raise LocalDataMigrationError(
            f"Local data schema version {manifest['schema_version']} is newer than supported version {LOCAL_DATA_SCHEMA_VERSION}."
        )
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
    schema_version = int(manifest.get("schema_version") or 0)
    unsupported_schema_version = schema_version > LOCAL_DATA_SCHEMA_VERSION
    applied_ids = {
        row.get("id")
        for row in manifest.get("migrations", [])
        if isinstance(row, dict) and isinstance(row.get("id"), str)
    }
    pending = [migration for migration in LOCAL_DATA_MIGRATIONS if migration["id"] not in applied_ids]
    return {
        "local_data_dir": str(local_root),
        "schema_version": schema_version,
        "target_schema_version": LOCAL_DATA_SCHEMA_VERSION,
        "unsupported_schema_version": unsupported_schema_version,
        "error": (
            f"Local data schema version {schema_version} is newer than supported version {LOCAL_DATA_SCHEMA_VERSION}."
            if unsupported_schema_version
            else None
        ),
        "pending_migrations": pending,
        "migrations": manifest.get("migrations", []),
        "updated_at": manifest.get("updated_at"),
    }


def _exportable_json_files(root: Path, *, include_secrets: bool) -> list[Path]:
    files: list[Path] = []
    for subdir in LOCAL_DATA_SUBDIRS:
        if subdir == "backups" or (subdir == "secrets" and not include_secrets):
            continue
        path = root / subdir
        if not path.exists():
            continue
        files.extend(sorted(file for file in path.rglob("*.json") if file.is_file()))
    manifest_path = root / "manifest.json"
    if manifest_path.exists():
        files.insert(0, manifest_path)
    return files


def _directory_status(root: Path, subdir: str) -> dict[str, Any]:
    path = root / subdir
    files = [file for file in path.rglob("*.json") if file.is_file()] if path.exists() else []
    return {
        "name": subdir,
        "path": str(path),
        "exists": path.exists(),
        "file_count": len(files),
        "byte_count": sum(file.stat().st_size for file in files),
        "description": LOCAL_DATA_DIRECTORIES.get(subdir),
    }


def local_data_storage_status(root: Path | None = None) -> dict[str, Any]:
    local_root = ensure_local_data_dirs() if root is None else root
    migration = local_data_migration_status(local_root)
    errors: list[str] = []
    for file in _exportable_json_files(local_root, include_secrets=True):
        _, error = _read_json_strict(file)
        if error:
            errors.append(error)
    backup_files = sorted((local_root / "backups").glob("*.json")) if (local_root / "backups").exists() else []
    return {
        **migration,
        "directories": [_directory_status(local_root, subdir) for subdir in LOCAL_DATA_SUBDIRS],
        "backup_count": len(backup_files),
        "latest_backup_path": str(backup_files[-1]) if backup_files else None,
        "json_error_count": len(errors),
        "json_errors": errors[:20],
        "repair_warning_count": len(_repair_warning_rows(local_root)),
        "repair_warnings": _repair_warning_rows(local_root)[-20:],
    }


def export_local_data(*, include_secrets: bool = False, root: Path | None = None) -> dict[str, Any]:
    local_root = ensure_local_data_dirs() if root is None else root
    errors: list[str] = []
    files: list[dict[str, Any]] = []
    for file in _exportable_json_files(local_root, include_secrets=include_secrets):
        payload, error = _read_json_strict(file)
        if error:
            errors.append(error)
            continue
        files.append({"path": str(file.relative_to(local_root)), "payload": payload})
    return {
        "format": LOCAL_DATA_EXPORT_FORMAT,
        "exported_at": _now(),
        "local_data_dir": str(local_root),
        "schema_version": LOCAL_DATA_SCHEMA_VERSION,
        "include_secrets": include_secrets,
        "file_count": len(files),
        "files": files,
        "errors": errors,
    }


def create_local_data_backup(*, include_secrets: bool = False, root: Path | None = None) -> dict[str, Any]:
    local_root = ensure_local_data_dirs() if root is None else root
    backup_dir = local_root / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    chmod_private(backup_dir, PRIVATE_DIR_MODE)
    export = export_local_data(include_secrets=include_secrets, root=local_root)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = backup_dir / f"lycium-local-data-backup-{timestamp}-{uuid4().hex[:8]}.json"
    _write_json(backup_path, export)
    return {
        "path": str(backup_path),
        "created_at": export["exported_at"],
        "file_count": export["file_count"],
        "byte_count": backup_path.stat().st_size,
        "include_secrets": include_secrets,
        "errors": export["errors"],
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
