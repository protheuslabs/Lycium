from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

import pytest

from app.config import SETTINGS
from app.course_agent_types import CourseAgentError
from app.course_generation_workflow import run_course_generation_workflow
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context


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


def test_curriculum_context_derives_requirements_origins_and_source_slots() -> None:
    context = compile_curriculum_benchmark_context(
        prompt="Intro programming course based on college CS101 syllabi",
        source_urls=[
            "https://catalog.example.edu/courses/cs101",
            "https://university.example.edu/syllabus/cs101",
        ],
        category="college-of-engineering",
        department="computer-science",
    )

    assert context["curriculumBenchmarks"]
    assert context["requirementOrigins"]
    assert context["courseParityProfile"]["commonRequiredTopics"]
    assert context["sourceSlots"]
    assert "benchmark_intake" in context["workflowGates"]


def test_curriculum_context_is_visible_to_generation_workflow() -> None:
    course = read_fixture("valid-course.json")
    context = compile_curriculum_benchmark_context(
        prompt=course["title"],
        source_urls=["https://catalog.example.edu/courses/web101"],
        category=course["category"],
        department=course["department"],
    )
    report = run_course_generation_workflow(attach_curriculum_context(course, context)).model_dump()
    gates = {gate["gate"]: gate for gate in report["gates"]}

    assert gates["benchmark_intake"]["status"] == "passed"
    assert gates["requirement_extraction"]["artifacts"]["requirementOriginCount"] > 0
    assert gates["commonality_analysis"]["artifacts"]["sourceSlotCount"] > 0


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
