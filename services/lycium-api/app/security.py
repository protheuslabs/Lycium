from __future__ import annotations

import re
import stat
from pathlib import Path
from typing import Any


PRIVATE_DIR_MODE = 0o700
PRIVATE_FILE_MODE = 0o600
SENSITIVE_KEY_RE = re.compile(
    r"(api[_-]?key|token|secret|password|credential|authorization|agent_api_key)",
    re.IGNORECASE,
)


def chmod_private(path: Path, mode: int) -> None:
    try:
        path.chmod(mode)
    except OSError:
        return


def permission_mode(path: Path) -> str | None:
    try:
        return oct(stat.S_IMODE(path.stat().st_mode))
    except OSError:
        return None


def permissions_are_private(path: Path) -> bool:
    try:
        mode = stat.S_IMODE(path.stat().st_mode)
    except OSError:
        return True
    return mode & 0o077 == 0


def redact_sensitive_payload(value: Any) -> Any:
    if isinstance(value, dict):
        redacted: dict[str, Any] = {}
        for key, item in value.items():
            key_text = str(key)
            redacted[key_text] = "[redacted]" if SENSITIVE_KEY_RE.search(key_text) else redact_sensitive_payload(item)
        return redacted
    if isinstance(value, list):
        return [redact_sensitive_payload(item) for item in value]
    return value
