
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import SETTINGS

LOCAL_DATA_SUBDIRS = ("courses", "completion", "links", "secrets", "user")


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
