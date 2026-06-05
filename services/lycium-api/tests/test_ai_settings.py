from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

import pytest

from app.config import SETTINGS
from app.course_agent_types import CourseAgentError
from app.course_generation_workflow import run_course_generation_workflow
from app.course_agent_assembly import _coerce_plan_modules
from app.curriculum_artifacts import curriculum_artifacts_for_course, persist_curriculum_artifacts_for_snapshot
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context
from app.program_validation import validate_program_contract
from app.source_corpus import compile_source_corpus_preflight
from app import db
from app.models import CourseSnapshot
from app.source_index import source_documents_from_index_snapshots


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / "packages" / "contracts" / "fixtures"


@pytest.fixture()
def isolated_local_data(tmp_path: Path) -> Iterator[None]:
    original = SETTINGS.local_data_dir
    object.__setattr__(SETTINGS, "local_data_dir", tmp_path / "lycium-local")
    try:
        yield
    finally:
        object.__setattr__(SETTINGS, "local_data_dir", original)


def read_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def _install_source_fetch_mock(monkeypatch, mapping: dict[str, str]) -> None:
    def fake_fetch(url: str) -> tuple[str, str]:
        return mapping[url], "text/html"

    monkeypatch.setattr("app.ingestion.fetch_url", fake_fetch)



def test_local_endpoint_save_persists_unverified_connection(client, monkeypatch, isolated_local_data) -> None:
    def fail_validation(*args, **kwargs):
        raise CourseAgentError("Ollama is unavailable at http://localhost:65535")

    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", fail_validation)
    monkeypatch.setattr("app.routes.local_routes.detect_local_agent_endpoint", lambda provider_id: None)

    response = client.put(
        "/v1/local/settings",
        json={"provider_id": "local-model", "agent_api_key": "http://localhost:65535"},
    )

    assert response.status_code == 200, response.text
    settings = response.json()
    active_key = settings["agent_keys"][0]
    assert active_key["provider_id"] == "local-model"
    assert active_key["connection_status"] == "unverified"
    assert active_key["key_preview"] == "http://localhost:65535"


def test_cloud_key_save_rejects_invalid_connection(client, monkeypatch, isolated_local_data) -> None:
    def fail_validation(*args, **kwargs):
        raise CourseAgentError("API key invalid.")

    monkeypatch.setattr("app.routes.local_routes.validate_agent_api_key", fail_validation)

    response = client.put(
        "/v1/local/settings",
        json={"provider_id": "openai", "agent_api_key": "bad-key"},
    )

    assert response.status_code == 400
    assert "API key invalid" in response.text
