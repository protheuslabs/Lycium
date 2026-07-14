from __future__ import annotations

from typing import Any


def _optional_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def normalize_model_records(models: Any, selected_model: str | None = None) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if isinstance(models, list):
        for model in models:
            if isinstance(model, str):
                model_id = model.strip()
                label = model_id
                extra: dict[str, Any] = {}
            elif isinstance(model, dict):
                model_id = str(model.get("id") or model.get("name") or "").strip()
                label = str(model.get("label") or model.get("display_name") or model.get("displayName") or model_id)
                extra = {
                    "error": _optional_text(model.get("error") or model.get("last_error")),
                    "warning": _optional_text(model.get("warning")),
                    "disabled": bool(model.get("disabled")),
                }
            else:
                continue
            if model_id:
                record: dict[str, Any] = {"id": model_id, "label": label or model_id}
                record.update({key: value for key, value in extra.items() if value not in {None, False}})
                normalized.append(record)

    if selected_model and not any(model["id"] == selected_model for model in normalized):
        normalized.insert(0, {"id": selected_model, "label": selected_model})

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for model in normalized:
        if model["id"] in seen:
            continue
        seen.add(model["id"])
        deduped.append(model)
    return deduped
