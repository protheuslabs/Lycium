from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

import pytest

from app.config import SETTINGS
from app.course_agent_types import CourseAgentError
from app.course_generation_workflow import run_course_generation_workflow
from app.curriculum_artifacts import curriculum_artifacts_for_course, persist_curriculum_artifacts_for_snapshot
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context
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


def test_source_corpus_preflight_filters_irrelevant_sources() -> None:
    preflight = compile_source_corpus_preflight(
        prompt="CHEM 105 General Chemistry I covering atoms, bonding, stoichiometry, gases, equilibrium, and acids",
        source_urls=[
            "https://catalog.example.edu/courses/chem105",
            "https://example.org/gardening/herb-roasting-guide",
        ],
        source_documents=[
            {
                "url": "https://catalog.example.edu/courses/chem105",
                "contentType": "text/plain",
                "text": "CHEM 105 covers atoms, isotopes, periodic trends, bonding, stoichiometry, gases, equilibrium, acids, and bases.",
            },
            {
                "url": "https://example.org/gardening/herb-roasting-guide",
                "contentType": "text/plain",
                "text": "This guide explains soil preparation, basil harvesting, olive oil, roasting vegetables, and kitchen storage.",
            },
        ],
    )

    assert preflight.source_urls == ["https://catalog.example.edu/courses/chem105"]
    assert preflight.synthesis["metrics"]["includedSourceCount"] == 1
    assert preflight.synthesis["metrics"]["excludedSourceCount"] == 1
    assert preflight.synthesis["excludedSources"][0]["url"] == "https://example.org/gardening/herb-roasting-guide"


def test_curriculum_context_extracts_real_syllabus_structure() -> None:
    syllabus = """
    CHEM 105 General Chemistry I
    Course Description
    Students will apply atomic structure, stoichiometry, bonding, thermochemistry, and gases to explain chemical systems.
    Learning Outcomes
    1. Calculate quantities in chemical reactions using dimensional analysis and stoichiometry.
    2. Explain atomic structure, periodic trends, and electron configurations.
    3. Compare ionic, covalent, and metallic bonding models.
    4. Solve thermochemistry problems using enthalpy and calorimetry.
    Topics
    Week 1: Measurement, matter, and significant figures
    Week 2: Atoms, isotopes, and periodic trends
    Week 3: Chemical formulas, reactions, and stoichiometry
    Week 4: Chemical bonding and molecular geometry
    """
    context = compile_curriculum_benchmark_context(
        prompt="CHEM 105 General Chemistry I",
        source_urls=[],
        source_documents=[
            {
                "url": "https://catalog.example.edu/courses/chem105",
                "contentType": "text/plain",
                "text": syllabus,
            }
        ],
        category="natural-sciences-mathematics",
        department="chemistry",
    )
    benchmark = context["curriculumBenchmarks"][0]

    assert benchmark["extraction"]["status"] == "parsed"
    assert benchmark["sourceType"] == "university_catalog"
    assert len(benchmark["extractedRequirements"]) >= 4
    assert any("Stoichiometry" in topic for topic in context["courseParityProfile"]["commonRequiredTopics"])
    assert context["sourceSlots"]


def test_source_index_snapshots_feed_curriculum_benchmark_extraction(client, monkeypatch) -> None:
    url = "https://catalog.example.edu/courses/chem105"
    _install_source_fetch_mock(
        monkeypatch,
        {
            url: """
            <html><head><title>CHEM 105 Catalog</title></head><body>
            <h1>CHEM 105 General Chemistry I</h1>
            <h2>Course Description</h2>
            <p>Students study atomic structure, stoichiometry, bonding, thermochemistry, and gases.</p>
            <h2>Learning Outcomes</h2>
            <ol>
              <li>Calculate stoichiometric quantities in chemical reactions.</li>
              <li>Explain periodic trends, atomic structure, and electron configurations.</li>
              <li>Compare ionic, covalent, and metallic bonding models.</li>
              <li>Solve thermochemistry and gas law problems.</li>
            </ol>
            </body></html>
            """,
        },
    )
    ingested = client.post(
        "/v1/sources/ingest",
        json={"url": url, "source_type": "catalog", "license": "cc-by", "is_free": True},
    )
    assert ingested.status_code == 201, ingested.text

    with db.SessionLocal() as session:
        documents = source_documents_from_index_snapshots(session, source_urls=[url])

    assert len(documents) == 1
    assert documents[0]["snapshotId"]
    assert "stoichiometry" in documents[0]["text"].lower()

    context = compile_curriculum_benchmark_context(
        prompt="CHEM 105 General Chemistry I",
        source_urls=[url],
        source_documents=documents,
        category="natural-sciences-mathematics",
        department="chemistry",
    )

    assert context["curriculumBenchmarks"][0]["extraction"]["status"] == "parsed"
    assert context["requirementOrigins"]
    assert context["sourceSlots"]


def test_source_index_snapshot_to_program_compiler_flow(client, monkeypatch) -> None:
    url = "https://catalog.example.edu/programs/data-science-foundations"
    _install_source_fetch_mock(
        monkeypatch,
        {
            url: """
            <html><head><title>Data Science Foundations Catalog</title></head><body>
            <h1>Data Science Foundations</h1>
            <h2>Course Description</h2>
            <p>Data science combines statistics, programming, data visualization, modeling, and project communication.</p>
            <h2>Learning Outcomes</h2>
            <ul>
              <li>Apply statistics to summarize and reason about data.</li>
              <li>Use programming to clean, transform, and analyze datasets.</li>
              <li>Create visualizations and communicate findings in a project artifact.</li>
              <li>Evaluate models and explain limitations.</li>
            </ul>
            <h2>Assessment</h2>
            <p>Students complete quizzes, labs, and a final data project.</p>
            </body></html>
            """,
        },
    )
    ingested = client.post(
        "/v1/sources/ingest",
        json={"url": url, "source_type": "catalog", "license": "cc-by", "is_free": True},
    )
    assert ingested.status_code == 201, ingested.text

    learner = client.post(
        "/v1/learners",
        json={"name": "Compiler Test Learner", "goal": "Learn data science", "level": "beginner", "preferences": {}},
    )
    assert learner.status_code == 201, learner.text

    program = client.post(
        "/v1/programs/generate",
        json={
            "goal": "Data science statistics programming visualization modeling project",
            "learner_id": learner.json()["id"],
            "level": "beginner",
            "free_only": True,
            "source_policy": "free-only",
            "desired_course_count": 3,
            "source_urls": [url],
        },
    )
    assert program.status_code == 201, program.text
    structure = program.json()["structure"]
    quality = structure["qualityReport"]
    trace = structure["generationTrace"]

    assert trace["sourceIndexSnapshotDocumentCount"] == 1
    assert trace["curriculumBenchmarkContext"]["curriculumBenchmarks"][0]["extraction"]["status"] == "parsed"
    assert quality["passed"] is True
    assert quality["metrics"]["benchmarkCount"] >= 1
    assert quality["metrics"]["requirementOriginEvidenceCoverageRatio"] > 0
    assert quality["metrics"]["sourceSlotPrimaryCoverageRatio"] > 0


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


def test_curriculum_artifacts_are_persisted_as_course_records(client) -> None:
    course = read_fixture("valid-course.json")
    context = compile_curriculum_benchmark_context(
        prompt=course["title"],
        source_urls=[
            "https://catalog.example.edu/courses/web101",
            "https://syllabus.example.edu/web101",
        ],
        category=course["category"],
        department=course["department"],
    )
    attached_course = attach_curriculum_context(course, context)

    with db.SessionLocal() as session:
        snapshot = CourseSnapshot(
            learner_id=None,
            draft_id=None,
            title=attached_course["title"],
            prompt="Create a web development course from benchmark curricula.",
            language="en",
            level="undergrad",
            source_policy="balanced",
            status="ready_for_review",
            version=1,
            structure=attached_course,
            generation_trace={"curriculum_benchmark_context": context},
        )
        session.add(snapshot)
        session.flush()
        refs = persist_curriculum_artifacts_for_snapshot(session, snapshot, context=context)
        session.commit()
        course_snapshot_id = snapshot.id

    assert refs["curriculumBenchmarkRecordIds"]
    assert refs["requirementOriginRecordIds"]
    assert refs["sourceSlotRecordIds"]

    with db.SessionLocal() as session:
        artifacts = curriculum_artifacts_for_course(session, course_snapshot_id)

    assert len(artifacts["curriculumBenchmarks"]) == len(context["curriculumBenchmarks"])
    assert artifacts["requirementOrigins"][0]["recordId"] in refs["requirementOriginRecordIds"]
    assert artifacts["sourceSlots"][0]["recordId"] in refs["sourceSlotRecordIds"]

    response = client.get(f"/v1/courses/{course_snapshot_id}/curriculum-artifacts")
    assert response.status_code == 200, response.text
    assert response.json()["artifactReferences"] == artifacts["artifactReferences"]


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
