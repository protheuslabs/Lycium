from __future__ import annotations

from typing import Any

from app.local_store_core import _now, _safe_key, _write_json, ensure_local_data_dirs

GENERATION_RUN_EXPORT_FORMAT = "lycium-generation-run-v1"


def generation_run_record_path(run_id: int | str):
    return ensure_local_data_dirs() / "generation-runs" / f"run-{_safe_key(str(run_id))}.json"


def write_generation_run_record(run_payload: dict[str, Any]) -> dict[str, Any]:
    run_id = run_payload.get("id")
    if run_id is None:
        return {}
    record = {
        "format": GENERATION_RUN_EXPORT_FORMAT,
        "saved_at": _now(),
        "run": run_payload,
    }
    _write_json(generation_run_record_path(run_id), record)
    return record
