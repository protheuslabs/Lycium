from __future__ import annotations

from app import db
from app.generation_observability import (
    complete_generation_run,
    record_generation_run_checkpoint,
    start_generation_run,
)
from app.models import Job


def test_generation_run_records_timeline_and_is_readable(client) -> None:
    with db.SessionLocal() as session:
        job = Job(
            job_type="agent_generate_course_staged",
            payload={"prompt": "Create a CHEM 105 course", "model": "test-model"},
            status="running",
            result={},
        )
        session.add(job)
        session.flush()
        run = start_generation_run(session, job, message="Planning course structure.", progress=0.0)
        job_id = job.id
        run_id = run.id
        session.commit()

    record_generation_run_checkpoint(
        job_id,
        {
            "progress": 0.25,
            "current_stage": "module_1_lesson_1",
            "message": "Generated module 1 lesson 1.",
            "trace": {"mode": "staged-llm-agent", "stages": [{"stage": "course_plan", "status": "passed"}]},
        },
        session_factory=db.SessionLocal,
    )

    with db.SessionLocal() as session:
        complete_generation_run(
            session,
            job_id=job_id,
            accepted=True,
            message="Course ready for review.",
            trace={"mode": "staged-llm-agent", "stages": [{"stage": "course_plan", "status": "passed"}]},
            quality_report={"passed": True, "score": 0.94, "errors": [], "warnings": ["Check media manually."]},
            course_snapshot_id=42,
        )
        session.commit()

    list_response = client.get("/v1/agent/courses/runs")
    detail_response = client.get(f"/v1/agent/courses/runs/{run_id}")

    assert list_response.status_code == 200, list_response.text
    assert any(run["id"] == run_id for run in list_response.json())
    assert detail_response.status_code == 200, detail_response.text
    payload = detail_response.json()
    assert payload["status"] == "completed"
    assert payload["progress"] == 1.0
    assert payload["course_snapshot_id"] == 42
    assert payload["result_summary"]["qualityScore"] == 0.94
    assert [event["event_type"] for event in payload["events"]] == [
        "run_started",
        "stage_checkpoint",
        "run_completed",
    ]
