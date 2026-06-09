from __future__ import annotations

from app import db
from app.models import CourseSnapshot


def _install_concept_gap(snapshot_id: int) -> None:
    with db.SessionLocal() as session:
        snapshot = session.get(CourseSnapshot, snapshot_id)
        assert snapshot is not None
        structure = dict(snapshot.structure or {})
        metadata = dict(structure.get("metadata") or {})
        concept_rows = [
            {"concept": "thermal equilibrium", "location": "Module 1", "sectionId": "lesson-1", "status": "missing"},
            {"concept": "crystal lattice", "location": "Module 2", "sectionId": "lesson-2", "status": "missing"},
        ]
        metadata["sourceGaps"] = [
            {
                "id": "concept-source-coverage",
                "scopeType": "course",
                "scopeId": "course",
                "title": "Add concept sources",
                "description": "Add targeted sources for concepts.",
                "severity": "blocking",
                "minimumSourceCount": 3,
                "currentSourceCount": 1,
                "conceptSourceNeeds": concept_rows,
                "coverageGate": {
                    "gate": "source_analysis",
                    "status": "failed",
                    "issues": ["Concept coverage is incomplete."],
                    "metrics": {"conceptCoverage": concept_rows},
                },
            }
        ]
        structure["metadata"] = metadata
        snapshot.structure = structure
        session.commit()


def test_source_gap_resume_updates_draft_then_queues_generation(client, monkeypatch) -> None:
    initial = client.post(
        "/v1/agent/courses/jobs",
        json={
            "prompt": "Create an undergraduate environmental health course",
            "level": "undergrad",
            "source_urls": ["https://example.edu/environmental-health-syllabus"],
            "category": "public-health",
            "department": "epidemiology",
        },
    )
    assert initial.status_code == 202, initial.text
    initial_job = initial.json()
    snapshot_id = initial_job["course_snapshot"]["id"]
    assert initial_job["status"] == "ready"
    assert initial_job["current_stage"] == "source_coverage"
    assert initial_job["course"]["metadata"]["sourceGaps"][0]["currentSourceCount"] == 1

    still_blocked = client.post(
        f"/v1/courses/{snapshot_id}/source-gaps/resume",
        json={"source_urls": ["https://example.edu/environmental-health-open-text"]},
    )
    assert still_blocked.status_code == 202, still_blocked.text
    blocked_job = still_blocked.json()
    assert blocked_job["status"] == "ready"
    assert blocked_job["current_stage"] == "source_coverage"
    assert blocked_job["course"]["metadata"]["sourceGaps"][0]["currentSourceCount"] == 2
    assert len(blocked_job["course"]["sourceRecords"]) == 2

    monkeypatch.setattr(
        "app.routes.course_source_gap_routes.require_verified_active_agent_profile",
        lambda: {"provider_id": "local-model", "model": "test-model", "agent_api_key": "local"},
    )
    monkeypatch.setattr("app.routes.course_source_gap_routes.run_agent_course_generation_job", lambda job_id: None)

    queued = client.post(
        f"/v1/courses/{snapshot_id}/source-gaps/resume",
        json={
            "source_urls": [
                "https://example.edu/environmental-health-casebook",
                "https://example.edu/environmental-health-labs",
            ]
        },
    )
    assert queued.status_code == 202, queued.text
    queued_job = queued.json()
    assert queued_job["status"] == "queued"
    assert queued_job["request"]["prompt"] == "Create an undergraduate environmental health course"
    assert queued_job["request"]["category"] == "public-health"
    assert queued_job["request"]["department"] == "epidemiology"
    assert len(queued_job["request"]["source_urls"]) == 4


def test_source_gap_resume_requires_concept_relevant_sources(client, monkeypatch) -> None:
    initial = client.post(
        "/v1/agent/courses/jobs",
        json={
            "prompt": "Create an undergraduate solid state chemistry course",
            "level": "undergrad",
            "source_urls": ["https://example.edu/solid-state-syllabus"],
            "category": "natural-sciences-mathematics",
            "department": "chemistry",
        },
    )
    assert initial.status_code == 202, initial.text
    snapshot_id = initial.json()["course_snapshot"]["id"]
    _install_concept_gap(snapshot_id)

    irrelevant = client.post(
        f"/v1/courses/{snapshot_id}/source-gaps/resume",
        json={
            "source_urls": [
                "https://example.edu/renaissance-painting",
                "https://example.edu/poetry-archive",
                "https://example.edu/cooking-lab",
            ]
        },
    )
    assert irrelevant.status_code == 202, irrelevant.text
    blocked_job = irrelevant.json()
    gap = blocked_job["course"]["metadata"]["sourceGaps"][0]
    assert blocked_job["status"] == "ready"
    assert blocked_job["current_stage"] == "source_coverage"
    assert gap["sourceResumeCoverage"]["coveragePercent"] < 70
    assert gap["conceptSourceNeeds"]

    monkeypatch.setattr(
        "app.routes.course_source_gap_routes.require_verified_active_agent_profile",
        lambda: {"provider_id": "local-model", "model": "test-model", "agent_api_key": "local"},
    )
    monkeypatch.setattr("app.routes.course_source_gap_routes.run_agent_course_generation_job", lambda job_id: None)

    queued = client.post(
        f"/v1/courses/{snapshot_id}/source-gaps/resume",
        json={
            "source_urls": [
                "https://example.edu/thermal-equilibrium-open-textbook",
                "https://example.edu/crystal-lattice-lab",
            ]
        },
    )
    assert queued.status_code == 202, queued.text
    assert queued.json()["status"] == "queued"


def test_source_gap_resume_uses_source_packet_text_for_concept_relevance(client, monkeypatch) -> None:
    initial = client.post(
        "/v1/agent/courses/jobs",
        json={
            "prompt": "Create an undergraduate solid state chemistry course",
            "level": "undergrad",
            "source_urls": ["https://example.edu/solid-state-syllabus"],
            "category": "natural-sciences-mathematics",
            "department": "chemistry",
        },
    )
    assert initial.status_code == 202, initial.text
    snapshot_id = initial.json()["course_snapshot"]["id"]
    _install_concept_gap(snapshot_id)
    monkeypatch.setattr(
        "app.routes.course_source_gap_routes.require_verified_active_agent_profile",
        lambda: {"provider_id": "local-model", "model": "test-model", "agent_api_key": "local"},
    )
    monkeypatch.setattr("app.routes.course_source_gap_routes.run_agent_course_generation_job", lambda job_id: None)

    queued = client.post(
        f"/v1/courses/{snapshot_id}/source-gaps/resume",
        json={
            "source_packet": {
                "contract_version": "source-packet-v1",
                "source_urls": ["https://example.edu/resource-a", "https://example.edu/resource-b"],
                "source_documents": [
                    {"url": "https://example.edu/resource-a", "title": "Thermal notes", "text": "Thermal equilibrium defines balanced energy exchange."},
                    {"url": "https://example.edu/resource-b", "title": "Crystal notes", "text": "A crystal lattice describes repeating solid-state structure."},
                ],
            }
        },
    )

    assert queued.status_code == 202, queued.text
    job = queued.json()
    assert job["status"] == "queued"
    assert len(job["request"]["source_urls"]) == 3


def test_generation_with_weak_concept_coverage_returns_needs_sources_draft(client) -> None:
    response = client.post(
        "/v1/courses/generate",
        json={
            "prompt": "Create an undergraduate materials science course",
            "level": "undergrad",
            "source_urls": [
                "https://example.edu/materials-science-syllabus",
                "https://example.edu/materials-science-open-text",
                "https://example.edu/materials-science-labs",
            ],
            "category": "natural-sciences-mathematics",
            "department": "chemistry",
        },
    )

    assert response.status_code == 201, response.text
    snapshot = response.json()
    course = snapshot["structure"]
    gap = course["metadata"]["sourceGaps"][0]

    assert snapshot["status"] == "needs_sources"
    assert course["metadata"]["status"] == "needs_sources"
    assert course["metadata"]["generationPlan"]["mode"] == "source-gated-draft"
    assert gap["id"] == "concept-source-coverage"
    assert gap["coverageGate"]["gate"] == "source_analysis"
    assert gap["missingConceptSourceCount"] == len(gap["conceptSourceNeeds"])
    assert gap["conceptSourceNeeds"]
    assert "Missing concept source coverage" in course["modules"][0]["sections"][0]["content"][0]["value"]
    assert course["modules"][0]["id"] == "source-planning"
