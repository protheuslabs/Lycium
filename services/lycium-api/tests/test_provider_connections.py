from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest

from app.config import SETTINGS
from app.course_agent_types import CourseAgentError
from app.local_store import get_active_agent_profile


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


def _provider_models(_api_key: str, provider_id: str = "openai", *_args, **_kwargs) -> list[dict[str, str]]:
    return {
        "anthropic": _mock_models("claude-3-5-sonnet-latest", "claude-3-opus-latest"),
        "google-gemini": _mock_models("models/gemini-2.5-flash", "models/gemini-2.5-pro"),
        "local-model": _mock_models("kimi-k2.6:cloud", "llama3.1:70b"),
        "openai": _mock_models("gpt-4.1-mini", "gpt-4.1"),
        "openrouter": _mock_models("openai/gpt-4.1-mini", "anthropic/claude-3.5-sonnet"),
    }.get(provider_id, _mock_models("gpt-4.1-mini"))


def test_provider_summaries_expose_generation_contract(client) -> None:
    response = client.get("/v1/local/ai/providers")

    assert response.status_code == 200, response.text
    providers = {provider["id"]: provider for provider in response.json()}
    assert providers["local-model"]["credential_kind"] == "local_endpoint"
    assert providers["local-model"]["contract"]["provider_kind"] == "local"
    assert providers["local-model"]["contract"]["supports_json_mode"] is True
    assert providers["openai"]["credential_kind"] == "api_key"
    assert providers["openai"]["contract"]["generation_adapter"] == "openai-chat-completions"
    assert providers["anthropic"]["contract"]["provider_kind"] == "cloud"


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
    assert key["credential_kind"] == "api_key"
    assert key["generation_adapter"] == "openai-chat-completions"
    assert key["contract"]["supports_model_list"] is True


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
    assert verified_key["model_capability"]["minimum_recommended_parameters_billion"] == 70
    assert verified_key["model_capability"]["estimated_parameters_billion"] == 70
    assert verified_key["model_capability"]["meets_recommended_floor"] is True


def test_underpowered_local_model_is_saved_but_blocks_course_generation(client, monkeypatch, isolated_local_data) -> None:
    monkeypatch.setattr(
        "app.routes.local_routes.validate_agent_api_key",
        lambda *args, **kwargs: _mock_models("qwen2.5:3b", "llama3.1:70b"),
    )
    monkeypatch.setattr("app.routes.course_outline_routes.run_agent_course_generation_job", lambda job_id: None)

    saved = client.put("/v1/local/settings", json={"provider_id": "local-model", "agent_api_key": "http://localhost:11434"})

    assert saved.status_code == 200, saved.text
    key = saved.json()["agent_keys"][0]
    assert key["model"] == "qwen2.5:3b"
    assert key["model_capability"]["estimated_parameters_billion"] == 3
    assert key["model_capability"]["meets_recommended_floor"] is False
    assert "70B+ model" in key["model_capability"]["warning"]

    job = client.post(
        "/v1/agent/courses/jobs",
        json={
            "prompt": "Create an undergrad chemistry course",
            "level": "undergrad",
            "desired_module_count": 1,
            "source_urls": [
                "https://example.edu/chemistry/syllabus",
                "https://example.edu/chemistry/readings",
                "https://example.edu/chemistry/lab",
            ],
        },
    )

    assert job.status_code == 400
    assert "70B+ model" in job.text


def test_local_endpoint_input_routes_to_local_provider_even_if_provider_dropdown_is_stale(
    client,
    monkeypatch,
    isolated_local_data,
) -> None:
    def fail_validation(*args, **kwargs):
        raise CourseAgentError("Ollama is unavailable at http://localhost:11434")

    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", fail_validation)
    monkeypatch.setattr("app.routes.local_routes.detect_local_agent_endpoint", lambda provider_id: None)

    response = client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "http://localhost:11434"})

    assert response.status_code == 200, response.text
    key = response.json()["agent_keys"][0]
    assert key["provider_id"] == "local-model"
    assert key["connection_status"] == "unverified"
    assert key["key_preview"] == "http://localhost:11434"
    assert key["credential_kind"] == "local_endpoint"
    assert key["local_provider"] is True


def test_saving_same_local_endpoint_updates_existing_key_instead_of_duplicating(
    client,
    monkeypatch,
    isolated_local_data,
) -> None:
    monkeypatch.setattr(
        "app.routes.local_routes.validate_agent_api_key",
        lambda *args, **kwargs: _mock_models("kimi-k2.6:cloud", "qwen3:8b"),
    )

    first = client.put("/v1/local/settings", json={"provider_id": "local-model", "agent_api_key": "http://localhost:11434"})
    second = client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "http://localhost:11434"})

    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    settings = second.json()
    assert len(settings["agent_keys"]) == 1
    key = settings["agent_keys"][0]
    assert key["provider_id"] == "local-model"
    assert key["connection_status"] == "verified"
    assert key["key_preview"] == "http://localhost:11434"


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


def test_active_provider_switch_persists_selected_provider_and_model(client, monkeypatch, isolated_local_data) -> None:
    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", _provider_models)

    openai = client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "sk-valid-openai"})
    anthropic = client.put("/v1/local/settings", json={"provider_id": "anthropic", "agent_api_key": "sk-valid-anthropic"})

    assert openai.status_code == 200, openai.text
    assert anthropic.status_code == 200, anthropic.text
    anthropic_key = next(key for key in anthropic.json()["agent_keys"] if key["provider_id"] == "anthropic")
    assert anthropic.json()["active_agent_key_id"] == anthropic_key["id"]
    active = get_active_agent_profile()
    assert active is not None
    assert active["provider_id"] == "anthropic"
    assert active["model"] == "claude-3-5-sonnet-latest"
    assert active["contract"]["provider_kind"] == "cloud"

    openai_key = next(key for key in anthropic.json()["agent_keys"] if key["provider_id"] == "openai")
    switched = client.put("/v1/local/settings/active-key", json={"key_id": openai_key["id"]})

    assert switched.status_code == 200, switched.text
    active = get_active_agent_profile()
    assert active is not None
    assert active["provider_id"] == "openai"
    assert active["model"] == "gpt-4.1-mini"
    assert active["generation_adapter"] == "openai-chat-completions"


def test_generation_job_uses_active_provider_model_after_switch(client, monkeypatch, isolated_local_data) -> None:
    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", _provider_models)
    monkeypatch.setattr("app.routes.course_outline_routes.run_agent_course_generation_job", lambda job_id: None)
    client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "sk-valid-openai"})
    anthropic = client.put("/v1/local/settings", json={"provider_id": "anthropic", "agent_api_key": "sk-valid-anthropic"})
    anthropic_key = next(key for key in anthropic.json()["agent_keys"] if key["provider_id"] == "anthropic")
    client.put("/v1/local/settings/active-key", json={"key_id": anthropic_key["id"]})

    response = client.post(
        "/v1/agent/courses/jobs",
        json={
            "prompt": "Create an undergrad environmental policy course",
            "level": "undergrad",
            "desired_module_count": 3,
            "source_urls": [
                "https://example.edu/environmental-policy/syllabus",
                "https://example.edu/environmental-policy/readings",
                "https://example.edu/environmental-policy/lab",
            ],
        },
    )

    assert response.status_code == 202, response.text
    assert response.json()["request"]["model"] == "claude-3-5-sonnet-latest"


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


def test_generation_job_preserves_bounded_stage_timeout(client, monkeypatch, isolated_local_data) -> None:
    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", _provider_models)
    monkeypatch.setattr("app.routes.course_outline_routes.run_agent_course_generation_job", lambda job_id: None)
    client.put("/v1/local/settings", json={"provider_id": "openai", "agent_api_key": "sk-valid-openai"})

    response = client.post(
        "/v1/agent/courses/jobs",
        json={
            "prompt": "Create an undergrad chemistry course from bounded model-sweep inputs",
            "level": "undergrad",
            "desired_module_count": 1,
            "expected_duration_minutes": 90,
            "max_stage_timeout_seconds": 45,
            "source_urls": [
                "https://example.edu/chemistry/syllabus",
                "https://example.edu/chemistry/readings",
                "https://example.edu/chemistry/lab",
            ],
        },
    )

    assert response.status_code == 202, response.text
    assert response.json()["request"]["max_stage_timeout_seconds"] == 45
