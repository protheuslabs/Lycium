from __future__ import annotations

import json
from pathlib import Path

from app import db
from app.local_store import save_course_snapshot
from app.models import CourseSnapshot


FIXTURE_DIR = Path(__file__).resolve().parents[3] / "packages" / "contracts" / "fixtures"


def _read_fixture(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def _create_learner(client) -> dict:
    response = client.post(
        "/v1/learners",
        json={
            "name": "MVP Workflow Learner",
            "goal": "Use source-backed courses locally",
            "level": "undergrad",
            "preferences": {"modalities": ["text", "practice"], "time_budget": "5h/week"},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_local_source_gap_resume_publish_progress_workflow(client, monkeypatch) -> None:
    learner = _create_learner(client)
    learner_id = learner["id"]
    prompt = "Intro programming foundations with projects"
    source_urls = [
        "https://open.example.com/programming-syllabus",
        "https://open.example.com/programming-open-text",
        "https://open.example.com/programming-projects",
        "https://open.example.com/programming-labs",
    ]

    initial = client.post(
        "/v1/agent/courses/jobs",
        json={
            "prompt": prompt,
            "learner_id": learner_id,
            "level": "undergrad",
            "source_urls": [source_urls[0]],
            "category": "computing-information-sciences",
            "department": "computer-science",
            "desired_module_count": 2,
            "expected_duration_minutes": 120,
        },
    )
    assert initial.status_code == 202, initial.text
    initial_job = initial.json()
    source_gap_snapshot_id = initial_job["course_snapshot"]["id"]
    assert initial_job["status"] == "ready"
    assert initial_job["current_stage"] == "source_coverage"
    assert initial_job["course_snapshot"]["status"] == "needs_sources"
    assert initial_job["course"]["metadata"]["generationPlan"]["mode"] == "outline_first_empty_section_plan"
    assert initial_job["course"]["metadata"]["sourceGaps"][0]["currentSourceCount"] == 1

    still_blocked = client.post(
        f"/v1/courses/{source_gap_snapshot_id}/source-gaps/resume",
        json={"source_urls": [source_urls[1]]},
    )
    assert still_blocked.status_code == 202, still_blocked.text
    blocked_job = still_blocked.json()
    assert blocked_job["status"] == "ready"
    assert blocked_job["current_stage"] == "source_coverage"
    assert blocked_job["course"]["metadata"]["sourceGaps"][0]["currentSourceCount"] == 2

    monkeypatch.setattr(
        "app.routes.course_source_gap_routes.require_verified_active_agent_profile",
        lambda: {"provider_id": "local-model", "model": "mvp-test-model", "agent_api_key": "local"},
    )
    monkeypatch.setattr("app.routes.course_source_gap_routes.run_agent_course_generation_job", lambda job_id: None)

    queued = client.post(
        f"/v1/courses/{source_gap_snapshot_id}/source-gaps/resume",
        json={"source_urls": source_urls[2:]},
    )
    assert queued.status_code == 202, queued.text
    queued_job = queued.json()
    assert queued_job["status"] == "queued"
    assert queued_job["request"]["source_urls"] == source_urls
    assert queued_job["request"]["prompt"] == prompt

    course_structure = _read_fixture("valid-course.json")
    with db.SessionLocal() as session:
        snapshot = CourseSnapshot(
            learner_id=learner_id,
            draft_id=None,
            title=course_structure["title"],
            prompt=prompt,
            language="en",
            level="undergrad",
            source_policy="balanced",
            status="ready_for_review",
            version=1,
            structure=course_structure,
            generation_trace={
                "mvpLocalWorkflow": {
                    "sourceGapSnapshotId": source_gap_snapshot_id,
                    "queuedJobId": queued_job["id"],
                    "sourceUrls": source_urls,
                }
            },
        )
        session.add(snapshot)
        session.flush()
        save_course_snapshot(snapshot)
        session.commit()
        generated_course_id = snapshot.id

    generated_course = client.get(f"/v1/courses/{generated_course_id}").json()
    assert generated_course["status"] == "ready_for_review"
    assert generated_course["structure"]["modules"]
    assert generated_course["structure"]["sourceRecords"]

    quality = client.get(f"/v1/courses/{generated_course_id}/quality-report")
    assert quality.status_code == 200, quality.text
    assert quality.json()["passed"] is True

    published = client.post(
        f"/v1/courses/{generated_course_id}/publish",
        json={"reviewer_id": "pytest", "notes": "MVP vertical slice approved."},
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"

    first_section = generated_course["structure"]["modules"][0]["sections"][0]
    progress = client.post(
        f"/v1/courses/{generated_course_id}/progress",
        json={
            "learner_id": learner_id,
            "section_id": first_section["id"],
            "completion_state": "completed",
            "mastery_score": 0.91,
            "event_type": "section_completed",
            "event_payload": {"source": "mvp-local-workflow"},
        },
    )
    assert progress.status_code == 200, progress.text
    assert progress.json()["completion_state"] == "completed"

    catalog = client.get("/v1/courses", params={"status": "published", "learner_id": learner_id})
    assert catalog.status_code == 200, catalog.text
    assert any(course["id"] == generated_course_id for course in catalog.json())

    analytics = client.get(f"/v1/courses/{generated_course_id}/analytics", params={"learner_id": learner_id})
    assert analytics.status_code == 200, analytics.text
    assert analytics.json()["completion_rate"] > 0

    export = client.get(f"/v1/courses/{generated_course_id}/export")
    assert export.status_code == 200, export.text
    assert export.json()["structure"]["title"] == generated_course["structure"]["title"]
