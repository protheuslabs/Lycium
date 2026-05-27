from __future__ import annotations

import json
import re
from uuid import uuid4
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import SETTINGS


LOCAL_DATA_SUBDIRS = ("courses", "completion", "links", "secrets", "user")
VALID_SECTION_STATUSES = {"completed", "locked", "seen", "timed"}
_PRESERVE_FEEDBACK_RATING = object()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_key(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_.-]+", "-", value.strip()).strip("-")
    return safe or "default"


def ensure_local_data_dirs() -> Path:
    root = SETTINGS.local_data_dir
    root.mkdir(parents=True, exist_ok=True)
    for subdir in LOCAL_DATA_SUBDIRS:
        (root / subdir).mkdir(parents=True, exist_ok=True)

    manifest = root / "manifest.json"
    if not manifest.exists():
        _write_json(
            manifest,
            {
                "created_at": _now(),
                "description": "Local Lycium user data. This directory is intentionally gitignored.",
                "directories": {
                    "courses": "Generated course snapshots and exports.",
                    "completion": "Learner completion and progress mirrors.",
                    "links": "User-added or fetched source/link metadata.",
                    "secrets": "Local secrets such as an agent API key.",
                    "user": "Local learner and user preference data.",
                },
            },
        )
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
    tmp_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    tmp_path.replace(path)


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
            "created_at": _now(),
            "updated_at": _now(),
        }
    )
    secret["active_agent_key_id"] = key_id
    secret["updated_at"] = _now()
    secret["purpose"] = "Course generation agent access."
    _write_json(_agent_secret_path(), secret)
    return local_settings_summary()


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


def save_course_snapshot(course: Any) -> None:
    course_id = getattr(course, "id", None)
    if course_id is None:
        return

    payload = {
        "id": course.id,
        "title": course.title,
        "prompt": course.prompt,
        "language": course.language,
        "level": course.level,
        "source_policy": course.source_policy,
        "status": course.status,
        "version": course.version,
        "structure": course.structure,
        "generation_trace": course.generation_trace,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
        "saved_at": _now(),
    }
    _write_json(ensure_local_data_dirs() / "courses" / f"course-{course.id}.json", payload)


def save_learner_record(learner: Any) -> None:
    learner_id = getattr(learner, "id", None)
    if learner_id is None:
        return

    path = ensure_local_data_dirs() / "user" / "learners.json"
    payload = _read_json(path, {"learners": {}})
    payload.setdefault("learners", {})
    payload["learners"][str(learner.id)] = {
        "id": learner.id,
        "name": learner.name,
        "goal": learner.goal,
        "level": learner.level,
        "preferences": learner.preferences,
        "created_at": learner.created_at,
        "updated_at": _now(),
    }
    _write_json(path, payload)


def _bookmarks_path() -> Path:
    return ensure_local_data_dirs() / "user" / "course-bookmarks.json"


def _feedback_path() -> Path:
    return ensure_local_data_dirs() / "user" / "course-feedback.json"


def _normalize_completed_section_ids(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    completed_section_ids: list[str] = []
    seen: set[str] = set()
    for entry in value:
        if not isinstance(entry, str):
            continue
        section_id = entry.strip()
        if not section_id or section_id in seen:
            continue
        seen.add(section_id)
        completed_section_ids.append(section_id)
    return completed_section_ids


def _normalize_section_statuses(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}

    statuses: dict[str, str] = {}
    for section_id, status_value in value.items():
        if not isinstance(section_id, str):
            continue
        clean_section_id = section_id.strip()
        if not clean_section_id or not isinstance(status_value, str):
            continue
        clean_status = status_value.strip()
        if clean_status in VALID_SECTION_STATUSES:
            statuses[clean_section_id] = clean_status
    return statuses


def read_course_bookmark(course_key: str) -> dict[str, Any]:
    payload = _read_json(_bookmarks_path(), {"courses": {}})
    bookmark = payload.get("courses", {}).get(course_key)
    if not isinstance(bookmark, dict):
        return {
            "course_key": course_key,
            "course_title": None,
            "section_id": None,
            "section_title": None,
            "path": None,
            "updated_at": None,
        }

    return {
        "course_key": course_key,
        "course_title": bookmark.get("course_title"),
        "section_id": bookmark.get("section_id"),
        "section_title": bookmark.get("section_title"),
        "path": bookmark.get("path"),
        "updated_at": bookmark.get("updated_at"),
    }


def save_course_bookmark(
    *,
    course_key: str,
    course_title: str | None,
    section_id: str,
    section_title: str | None,
    path: str,
) -> dict[str, Any]:
    bookmarks_path = _bookmarks_path()
    payload = _read_json(bookmarks_path, {"courses": {}})
    payload.setdefault("courses", {})
    bookmark = {
        "course_key": course_key,
        "course_title": course_title,
        "section_id": section_id,
        "section_title": section_title,
        "path": path,
        "updated_at": _now(),
    }
    payload["courses"][course_key] = bookmark
    payload["last_course_key"] = course_key
    payload["updated_at"] = bookmark["updated_at"]
    _write_json(bookmarks_path, payload)
    return bookmark


def read_course_feedback(course_key: str) -> dict[str, Any]:
    payload = _read_json(_feedback_path(), {"courses": {}})
    feedback = payload.get("courses", {}).get(course_key)
    if not isinstance(feedback, dict):
        return {
            "course_key": course_key,
            "course_title": None,
            "rating": None,
            "source_suggestions": [],
            "updated_at": None,
        }
    suggestions = feedback.get("source_suggestions")
    notes = feedback.get("feedback_notes")
    return {
        "course_key": course_key,
        "course_title": feedback.get("course_title"),
        "rating": feedback.get("rating") if feedback.get("rating") in {"up", "down"} else None,
        "feedback_notes": notes if isinstance(notes, list) else [],
        "source_suggestions": suggestions if isinstance(suggestions, list) else [],
        "updated_at": feedback.get("updated_at"),
    }


def save_course_feedback(
    *,
    course_key: str,
    course_title: str | None,
    rating: str | None | object = _PRESERVE_FEEDBACK_RATING,
    feedback_text: str | None = None,
    source_url: str | None = None,
    source_description: str | None = None,
) -> dict[str, Any]:
    feedback_path = _feedback_path()
    payload = _read_json(feedback_path, {"courses": {}})
    payload.setdefault("courses", {})
    current = read_course_feedback(course_key)
    next_feedback = {
        **current,
        "course_key": course_key,
        "course_title": course_title or current.get("course_title"),
        "updated_at": _now(),
    }
    if rating is None:
        next_feedback["rating"] = None
    elif rating in {"up", "down"}:
        next_feedback["rating"] = rating
    clean_feedback_text = (feedback_text or "").strip()
    if clean_feedback_text:
        notes = list(next_feedback.get("feedback_notes") or [])
        notes.append(
            {
                "id": f"feedback-note-{uuid4().hex}",
                "rating": rating if rating in {"up", "down"} else next_feedback.get("rating"),
                "text": clean_feedback_text,
                "created_at": next_feedback["updated_at"],
            }
        )
        next_feedback["feedback_notes"] = notes
    clean_url = (source_url or "").strip()
    if clean_url:
        suggestions = list(next_feedback.get("source_suggestions") or [])
        suggestions.append(
            {
                "id": f"source-suggestion-{uuid4().hex}",
                "url": clean_url,
                "description": (source_description or "").strip() or None,
                "created_at": next_feedback["updated_at"],
            }
        )
        next_feedback["source_suggestions"] = suggestions
    payload["courses"][course_key] = next_feedback
    payload["updated_at"] = next_feedback["updated_at"]
    _write_json(feedback_path, payload)
    return next_feedback


def read_completion(course_key: str) -> dict[str, Any]:
    path = ensure_local_data_dirs() / "completion" / f"{_safe_key(course_key)}.json"
    payload = _read_json(
        path,
        {
            "course_key": course_key,
            "course_title": None,
            "completed_section_ids": [],
            "section_statuses": {},
            "updated_at": None,
        },
    )
    section_statuses = _normalize_section_statuses(payload.get("section_statuses"))
    completed_section_ids: list[str] = []
    for section_id in _normalize_completed_section_ids(payload.get("completed_section_ids")):
        stored_status = section_statuses.get(section_id)
        if stored_status and stored_status != "completed":
            continue
        completed_section_ids.append(section_id)
        section_statuses[section_id] = "completed"

    return {
        "course_key": payload.get("course_key") or course_key,
        "course_title": payload.get("course_title"),
        "completed_section_ids": completed_section_ids,
        "section_statuses": section_statuses,
        "updated_at": payload.get("updated_at"),
    }


def save_completion(
    *,
    course_key: str,
    course_title: str | None,
    section_id: str | None,
    completed_section_ids: list[str],
    section_statuses: dict[str, str],
) -> dict[str, Any]:
    current = read_completion(course_key)
    merged_statuses = {
        **_normalize_section_statuses(current.get("section_statuses")),
        **_normalize_section_statuses(section_statuses),
    }
    completed = _normalize_completed_section_ids(
        [
            *current.get("completed_section_ids", []),
            *completed_section_ids,
            *[status_section_id for status_section_id, status in merged_statuses.items() if status == "completed"],
        ]
    )
    for completed_section_id in completed:
        merged_statuses[completed_section_id] = "completed"

    payload = {
        "course_key": course_key,
        "course_title": course_title or current.get("course_title"),
        "completed_section_ids": completed,
        "section_statuses": merged_statuses,
        "updated_at": _now(),
    }
    _write_json(ensure_local_data_dirs() / "completion" / f"{_safe_key(course_key)}.json", payload)
    return payload
