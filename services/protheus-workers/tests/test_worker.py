from __future__ import annotations

from protheus_workers import main as worker_main


def test_run_cycle_processes_pending_jobs(monkeypatch) -> None:
    jobs = [{"id": 1}, {"id": 2}]
    processed_ids: list[int] = []

    def fake_fetch_pending_jobs(_client, *, limit: int):
        assert limit == 10
        return jobs

    def fake_run_job(_client, job_id: int):
        processed_ids.append(job_id)
        return {"id": job_id, "job_type": "ingest_source", "status": "completed"}

    monkeypatch.setattr(worker_main, "fetch_pending_jobs", fake_fetch_pending_jobs)
    monkeypatch.setattr(worker_main, "run_job", fake_run_job)
    monkeypatch.setattr(worker_main, "_api_base", lambda: "http://testserver")

    count = worker_main.run_cycle(once=True, max_jobs=10, sleep_seconds=0.01)
    assert count == 2
    assert processed_ids == [1, 2]


def test_run_cycle_once_with_no_jobs(monkeypatch) -> None:
    def fake_fetch_pending_jobs(_client, *, limit: int):
        assert limit == 3
        return []

    monkeypatch.setattr(worker_main, "fetch_pending_jobs", fake_fetch_pending_jobs)
    monkeypatch.setattr(worker_main, "_api_base", lambda: "http://testserver")

    count = worker_main.run_cycle(once=True, max_jobs=3, sleep_seconds=0.01)
    assert count == 0
