from __future__ import annotations

from app import db
from app.generation_observability import add_generation_run_event, mirror_generation_run
from app.models import GenerationRun, Job


def test_generation_run_history_aliases_and_local_mirror(client, tmp_path, monkeypatch) -> None:
    local_data_dir = tmp_path / "local-data"
    monkeypatch.setattr("app.local_store_core.ensure_local_data_dirs", lambda: local_data_dir)
    monkeypatch.setattr("app.local_store_generation_runs.ensure_local_data_dirs", lambda: local_data_dir)

    with db.SessionLocal() as session:
        job = Job(
            job_type="agent_generate_course_staged",
            payload={"prompt": "Build a public health course", "source_urls": ["https://example.edu/a"]},
            status="failed",
            result={"message": "Needs review."},
        )
        session.add(job)
        session.flush()
        run = GenerationRun(
            job_id=job.id,
            run_type="agent_generate_course_staged",
            status="failed",
            prompt="Build a public health course",
            provider_id="local-model",
            model="test-model",
            progress=0.5,
            current_stage="source_coverage",
            message="Needs more source coverage.",
            request_payload={"prompt": "Build a public health course", "source_urls": ["https://example.edu/a"]},
            result_summary={"accepted": False, "sourceGapCount": 1},
            trace={"source_coverage_gate": {"passed": False}},
        )
        session.add(run)
        session.flush()
        add_generation_run_event(
            session,
            run,
            event_type="run_failed_quality_gate",
            stage="source_coverage",
            status="failed",
            message="Needs more source coverage.",
        )
        mirror_generation_run(run)
        run_id = run.id
        job_id = job.id
        session.commit()

    list_response = client.get("/v1/generation-runs")
    assert list_response.status_code == 200, list_response.text
    runs = list_response.json()
    assert runs[0]["id"] == run_id
    assert runs[0]["events"][0]["event_type"] == "run_failed_quality_gate"

    detail_response = client.get(f"/v1/generation-runs/{run_id}")
    assert detail_response.status_code == 200, detail_response.text
    assert detail_response.json()["job_id"] == job_id

    mirror_path = local_data_dir / "generation-runs" / f"run-{run_id}.json"
    assert mirror_path.exists()

    resume_response = client.post(f"/v1/generation-runs/{run_id}/resume")
    assert resume_response.status_code == 202, resume_response.text
    assert resume_response.json()["id"] == job_id
    assert resume_response.json()["status"] in {"queued", "running", "failed", "completed"}
