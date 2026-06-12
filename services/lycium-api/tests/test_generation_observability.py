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
            payload={
                "prompt": "Create a CHEM 105 course",
                "provider_id": "openai",
                "model": "test-model",
                "source_urls": ["https://example.edu/chemistry/syllabus"],
                "desired_module_count": 14,
            },
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
            "trace": {
                "mode": "staged-llm-agent",
                "source_corpus_preflight": {
                    "includedSources": [{"url": "https://example.edu/chemistry/syllabus"}],
                    "excludedSources": [{"url": "https://example.edu/noise"}],
                    "fetchFailures": [],
                    "commonThemes": ["stoichiometry"],
                },
                "stages": [{"stage": "course_plan", "status": "passed"}],
            },
        },
        session_factory=db.SessionLocal,
    )

    with db.SessionLocal() as session:
        complete_generation_run(
            session,
            job_id=job_id,
            accepted=True,
            message="Course ready for review.",
            trace={
                "mode": "staged-llm-agent",
                "usage": {"prompt_tokens": 1000, "completion_tokens": 2000, "total_tokens": 3000},
                "costs": {"estimated_cost_usd": 0.42},
                "source_corpus_preflight": {
                    "includedSources": [{"url": "https://example.edu/chemistry/syllabus"}],
                    "excludedSources": [{"url": "https://example.edu/noise"}],
                    "fetchFailures": [],
                    "commonThemes": ["stoichiometry"],
                },
                "stages": [{"stage": "course_plan", "status": "passed"}],
            },
            quality_report={
                "passed": True,
                "score": 0.94,
                "errors": [],
                "warnings": ["Check media manually."],
                "gates": [{"gate": "course_contract", "status": "passed"}],
            },
            course_snapshot_id=42,
            course_build_task={
                "contractVersion": "course-build-task-v1",
                "courseId": "chem-105",
                "status": "ready_for_review",
                "currentStage": "ready_for_review",
                "nextAction": "review_and_publish",
                "transitionStatus": "advanced",
                "transitionReason": "Generated course passed quality gates.",
                "requiredInputs": ["human_review"],
                "prerequisiteCourseIds": ["high-school-chemistry"],
                "reviewReadiness": {
                    "passed": True,
                    "metrics": {"qualityPassed": True, "failedGateCount": 0, "score": 0.94},
                },
            },
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
    assert payload["result_summary"]["providerId"] == "openai"
    assert payload["result_summary"]["model"] == "test-model"
    assert payload["result_summary"]["inputs"]["sourceUrlCount"] == 1
    assert payload["result_summary"]["sourceCorpus"]["includedSourceCount"] == 1
    assert payload["result_summary"]["sourceCorpus"]["excludedSourceCount"] == 1
    assert payload["result_summary"]["gateSummary"]["passedGates"] == ["course_contract"]
    assert payload["result_summary"]["usage"]["totalTokens"] == 3000
    assert payload["result_summary"]["usage"]["estimatedCostUsd"] == 0.42
    assert payload["result_summary"]["courseBuildTask"]["status"] == "ready_for_review"
    assert payload["result_summary"]["courseBuildTask"]["nextAction"] == "review_and_publish"
    assert payload["result_summary"]["courseBuildTask"]["reviewReadiness"]["passed"] is True
    assert [event["event_type"] for event in payload["events"]] == [
        "run_started",
        "stage_checkpoint",
        "course_build_task_transition",
        "run_completed",
    ]
    transition_event = payload["events"][2]
    assert transition_event["stage"] == "ready_for_review"
    assert transition_event["payload"]["courseBuildTask"]["prerequisiteCourseIds"] == ["high-school-chemistry"]
