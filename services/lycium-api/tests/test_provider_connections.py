from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest

from app.config import SETTINGS
from app.course_agent_types import CourseAgentError


@pytest.fixture()
def isolated_local_data(tmp_path: Path) -> Iterator[None]:
    original = SETTINGS.local_data_dir
    object.__setattr__(SETTINGS, "local_data_dir", tmp_path / "lycium-local")
    try:
        yield
    finally:
        object.__setattr__(SETTINGS, "local_data_dir", original)


def _mock_models(*model_ids: str) -> list[dict[str, str]]:
    return [{"id": model_id, "label": model_id} for model_id in model_ids]


def test_valid_cloud_key_is_saved_verified_and_active(client, monkeypatch, isolated_local_data) -> None:
    monkeypatch.setattr(
        "app.routes.local_routes.validate_agent_api_key",
        lambda *args, **kwargs: _mock_models("gpt-4.1-mini", "gpt-4.1"),
    )

    response = client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "sk-valid-cloud-key"})

    assert response.status_code == 200, response.text
    settings = response.json()
    key = settings["agent_keys"][0]
    assert settings["active_agent_key_id"] == key["id"]
    assert key["connection_status"] == "verified"
    assert key["is_active"] is True
    assert key["model"] == "gpt-4.1-mini"
    assert key["models"][0]["id"] == "gpt-4.1-mini"
    assert key["key_preview"].endswith("-key")
    assert key["key_preview"].startswith("*")
    assert key["last_verified_at"]


def test_empty_cloud_model_list_keeps_default_model_available(client, monkeypatch, isolated_local_data) -> None:
    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", lambda *args, **kwargs: [])

    response = client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "sk-valid-no-models"})

    assert response.status_code == 200, response.text
    key = response.json()["agent_keys"][0]
    assert key["connection_status"] == "verified"
    assert key["model"] == "gpt-4.1-mini"
    assert key["models"] == [{"id": "gpt-4.1-mini", "label": "gpt-4.1-mini"}]


def test_local_key_can_be_saved_unverified_then_verified_later(client, monkeypatch, isolated_local_data) -> None:
    state = {"attempts": 0}

    def validate_later(*args, **kwargs):
        state["attempts"] += 1
        if state["attempts"] == 1:
            raise CourseAgentError("Ollama is unavailable at http://localhost:11434")
        return _mock_models("llama3.1:70b", "mistral-large:latest")

    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", validate_later)
    monkeypatch.setattr("app.routes.local_routes.detect_local_agent_endpoint", lambda provider_id: None)

    saved = client.put("/v1/local/settings", json={"provider_id": "local-model", "agent_api_key": "http://localhost:11434"})

    assert saved.status_code == 200, saved.text
    unverified_key = saved.json()["agent_keys"][0]
    assert unverified_key["connection_status"] == "unverified"
    assert unverified_key["last_error"]

    verified = client.put("/v1/local/settings/verify-key", json={"key_id": unverified_key["id"]})

    assert verified.status_code == 200, verified.text
    verified_key = verified.json()["agent_keys"][0]
    assert verified_key["connection_status"] == "verified"
    assert verified_key["last_error"] is None
    assert verified_key["model"] == "llama3.1:70b"
    assert verified_key["models"][0]["id"] == "llama3.1:70b"


def test_model_update_persists_for_active_key(client, monkeypatch, isolated_local_data) -> None:
    monkeypatch.setattr(
        "app.routes.local_routes.validate_agent_api_key",
        lambda *args, **kwargs: _mock_models("gpt-4.1-mini", "gpt-4.1"),
    )
    saved = client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "sk-valid-cloud-key"})
    key_id = saved.json()["agent_keys"][0]["id"]

    updated = client.put("/v1/local/settings/key-model", json={"key_id": key_id, "model": "gpt-4.1"})
    fetched = client.get("/v1/local/settings")

    assert updated.status_code == 200, updated.text
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["agent_keys"][0]["model"] == "gpt-4.1"


def test_unverified_active_local_key_blocks_generation(client, monkeypatch, isolated_local_data) -> None:
    def fail_validation(*args, **kwargs):
        raise CourseAgentError("Ollama is unavailable at http://localhost:11434")

    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", fail_validation)
    monkeypatch.setattr("app.routes.local_routes.detect_local_agent_endpoint", lambda provider_id: None)
    saved = client.put("/v1/local/settings", json={"provider_id": "local-model", "agent_api_key": "http://localhost:11434"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["agent_keys"][0]["connection_status"] == "unverified"

    experiment = client.post(
        "/v1/agent/courses/experiment",
        json={"prompt": "Create a short test course", "desired_module_count": 1},
    )
    job = client.post(
        "/v1/agent/courses/jobs",
        json={"prompt": "Create a short test course", "desired_module_count": 1},
    )

    assert experiment.status_code == 400
    assert "unverified" in experiment.text
    assert job.status_code == 400
    assert "unverified" in job.text
