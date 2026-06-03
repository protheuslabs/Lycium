from __future__ import annotations


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
    assert course["modules"][0]["id"] == "source-planning"
