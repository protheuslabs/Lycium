from __future__ import annotations

import stat
from pathlib import Path
from typing import Iterator

import pytest

from app.config import SETTINGS
from app.local_store import ensure_local_data_dirs, local_data_security_status, save_agent_api_key
from app.security import redact_sensitive_payload


@pytest.fixture()
def isolated_local_data(tmp_path: Path) -> Iterator[Path]:
    original = SETTINGS.local_data_dir
    local_root = tmp_path / "lycium-local"
    object.__setattr__(SETTINGS, "local_data_dir", local_root)
    try:
        yield local_root
    finally:
        object.__setattr__(SETTINGS, "local_data_dir", original)


def _mode(path: Path) -> int:
    return stat.S_IMODE(path.stat().st_mode)


def test_local_secret_files_are_written_with_private_permissions(isolated_local_data: Path) -> None:
    ensure_local_data_dirs()
    save_agent_api_key(
        provider_id="openai",
        provider_label="OpenAI",
        api_key="sk-private",
        models=[{"id": "gpt-4.1-mini", "label": "gpt-4.1-mini"}],
        model="gpt-4.1-mini",
    )

    secret_path = isolated_local_data / "secrets" / "agent.json"
    status = local_data_security_status()

    assert _mode(isolated_local_data) & 0o077 == 0
    assert _mode(isolated_local_data / "secrets") & 0o077 == 0
    assert _mode(secret_path) & 0o077 == 0
    assert status["secret_backend"] == "local-file"
    assert status["permissions_private"] is True
    assert status["encryption_at_rest"] is False


def test_security_status_endpoint_masks_boundary_without_returning_secret(client, isolated_local_data: Path) -> None:
    save_agent_api_key(
        provider_id="openai",
        provider_label="OpenAI",
        api_key="sk-private",
        models=[{"id": "gpt-4.1-mini", "label": "gpt-4.1-mini"}],
        model="gpt-4.1-mini",
    )

    response = client.get("/v1/local/security")
    settings_response = client.get("/v1/local/settings")

    assert response.status_code == 200, response.text
    assert response.json()["secrets_file_exists"] is True
    assert "sk-private" not in response.text
    assert "sk-private" not in settings_response.text


def test_redacts_sensitive_generation_payload_fields() -> None:
    payload = {
        "prompt": "Create a course",
        "agent_api_key": "sk-secret",
        "nested": {"token": "tok-secret", "safe": "visible"},
        "items": [{"authorization": "Bearer nope"}],
    }

    redacted = redact_sensitive_payload(payload)

    assert redacted["prompt"] == "Create a course"
    assert redacted["agent_api_key"] == "[redacted]"
    assert redacted["nested"]["token"] == "[redacted]"
    assert redacted["nested"]["safe"] == "visible"
    assert redacted["items"][0]["authorization"] == "[redacted]"
