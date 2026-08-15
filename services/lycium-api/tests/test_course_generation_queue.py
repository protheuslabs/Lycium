from __future__ import annotations

from app import db
from app.jobs import enqueue_job, run_agent_course_generation_queue
from app.models import Job


def test_agent_course_generation_queue_drains_pending_jobs_fifo(monkeypatch) -> None:
    completed_job_ids: list[int] = []

    def complete_job(job_id: int) -> None:
        completed_job_ids.append(job_id)
        with db.SessionLocal() as session:
            job = session.get(Job, job_id)
            assert job is not None
            job.status = "completed"
            job.result = {"current_stage": "ready_for_review", "progress": 1.0}
            session.commit()

    monkeypatch.setattr("app.jobs.run_agent_course_generation_job", complete_job)

    with db.SessionLocal() as session:
        first = enqueue_job(session, job_type="agent_generate_course_staged", payload={"prompt": "First"})
        second = enqueue_job(session, job_type="agent_generate_course_staged", payload={"prompt": "Second"})
        other = enqueue_job(session, job_type="ingest_source", payload={"url": "https://example.edu/source"})
        session.commit()
        first_id = first.id
        second_id = second.id
        other_id = other.id

    run_agent_course_generation_queue()

    assert completed_job_ids == [first_id, second_id]

    with db.SessionLocal() as session:
        assert session.get(Job, first_id).status == "completed"
        assert session.get(Job, second_id).status == "completed"
        assert session.get(Job, other_id).status == "pending"


def test_agent_course_generation_queue_rechecks_after_empty_drain(monkeypatch) -> None:
    completed_job_ids: list[int] = []

    def complete_job(job_id: int) -> None:
        completed_job_ids.append(job_id)
        with db.SessionLocal() as session:
            job = session.get(Job, job_id)
            assert job is not None
            job.status = "completed"
            job.result = {"current_stage": "ready_for_review", "progress": 1.0}
            session.commit()

    with db.SessionLocal() as session:
        first = enqueue_job(session, job_type="agent_generate_course_staged", payload={"prompt": "First"})
        second = enqueue_job(session, job_type="agent_generate_course_staged", payload={"prompt": "Second"})
        session.commit()
        first_id = first.id
        second_id = second.id

    next_ids = iter([first_id, None, second_id, None, None])
    monkeypatch.setattr("app.jobs.run_agent_course_generation_job", complete_job)
    monkeypatch.setattr("app.jobs._next_pending_agent_course_generation_job_id", lambda: next(next_ids))

    run_agent_course_generation_queue()

    assert completed_job_ids == [first_id, second_id]
