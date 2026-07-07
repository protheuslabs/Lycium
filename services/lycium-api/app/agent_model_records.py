from __future__ import annotations

from typing import Any


def normalize_model_records(models: Any, selected_model: str | None = None) -> list[dict[str, str]]:
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
