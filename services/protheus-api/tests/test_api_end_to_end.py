from __future__ import annotations

from typing import Any


def _install_fetch_mock(monkeypatch, mapping: dict[str, str]) -> None:
    def fake_fetch(url: str) -> tuple[str, str]:
        html = mapping.get(url)
        if html is None:
            html = (
                "<html><head><title>Generic Learning Resource</title></head><body>"
                "<h1>General Learning</h1><p>This section is an explanation and includes an exercise.</p>"
                "</body></html>"
            )
        return html, "text/html"

    monkeypatch.setattr("app.ingestion.fetch_url", fake_fetch)


def _sample_html(title: str, body: str) -> str:
    return f"""
    <html>
      <head><title>{title}</title></head>
      <body>
        <h1>{title}</h1>
        <p>{body}</p>
        <p>This lesson includes an example, an exercise, and a quiz question.</p>
        <p>Machine learning is a practical discipline. Learners should test models and compare errors.</p>
      </body>
    </html>
    """


def _create_learner(client, *, name: str = "Ada Learner") -> dict[str, Any]:
    response = client.post(
        "/v1/learners",
        json={
            "name": name,
            "goal": "Become production-ready in machine learning",
            "level": "beginner",
            "preferences": {"modalities": ["text", "video"], "time_budget": "6h/week"},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_ingestion_dedup_search_and_coverage(client, monkeypatch) -> None:
    html = _sample_html(
        "Intro to Machine Learning",
        "Machine learning is the study of algorithms that improve with data.",
    )
    _install_fetch_mock(monkeypatch, {"https://example.com/ml": html})

    payload = {
        "url": "https://example.com/ml?utm_source=newsletter",
        "source_type": "article",
        "license": "cc-by",
        "is_free": True,
        "author": "Open Educator",
        "publisher": "Example Institute",
        "archive_requested": True,
    }
    first = client.post("/v1/sources/ingest", json=payload)
    assert first.status_code == 201, first.text
    first_json = first.json()
    assert first_json["new_snapshot"] is True
    assert first_json["knowledge_objects_created"] > 0

    second = client.post("/v1/sources/ingest", json=payload)
    assert second.status_code == 201, second.text
    second_json = second.json()
    assert second_json["new_snapshot"] is False
    assert second_json["knowledge_objects_created"] == 0

    search = client.get(
        "/v1/knowledge/search",
        params={"query": "machine learning algorithms", "top_k": 5, "trust_min": 0.1},
    )
    assert search.status_code == 200, search.text
    search_json = search.json()
    assert search_json["returned"] >= 1
    assert search_json["objects"][0]["trust_score"] >= 0.1

    recompute = client.post("/v1/coverage/recompute")
    assert recompute.status_code == 200, recompute.text
    assert len(recompute.json()) >= 1


def test_outline_generation_course_delivery_and_analytics(client, monkeypatch) -> None:
    _install_fetch_mock(
        monkeypatch,
        {
            "https://learn.example.com/python": _sample_html(
                "Python Foundations",
                "Python is a high-level language used for scripting, automation, and data science.",
            ),
            "https://video.example.com/python": _sample_html(
                "Python Video Walkthrough",
                "This course video explains variables, loops, and practical coding exercises.",
            ),
        },
    )
    ingest_1 = client.post(
        "/v1/sources/ingest",
        json={"url": "https://learn.example.com/python", "source_type": "docs", "license": "cc-by", "is_free": True},
    )
    assert ingest_1.status_code == 201, ingest_1.text
    ingest_2 = client.post(
        "/v1/sources/ingest",
        json={"url": "https://video.example.com/python", "source_type": "video", "license": "cc-by", "is_free": True},
    )
    assert ingest_2.status_code == 201, ingest_2.text

    learner = _create_learner(client)
    learner_id = learner["id"]

    outline = client.post(
        "/v1/courses/outlines",
        json={
            "prompt": "Build a beginner python course for automation and scripting",
            "learner_id": learner_id,
            "learning_goals": ["write scripts", "understand loops", "debug basic programs"],
            "desired_module_count": 2,
            "free_only": True,
            "source_policy": "free-only",
        },
    )
    assert outline.status_code == 201, outline.text
    outline_json = outline.json()
    draft_id = outline_json["id"]
    assert outline_json["status"] == "draft"
    assert len(outline_json["outline"]["modules"]) >= 1

    approve = client.post(f"/v1/courses/outlines/{draft_id}/approve", json={"approve": True})
    assert approve.status_code == 200, approve.text
    assert approve.json()["status"] == "approved"

    generated = client.post(
        f"/v1/courses/outlines/{draft_id}/generate",
        json={"learner_id": learner_id, "source_policy": "free-only", "free_only": True, "trust_min": 0.1},
    )
    assert generated.status_code == 201, generated.text
    course = generated.json()
    course_id = course["id"]
    first_module = course["structure"]["modules"][0]
    first_section = first_module["sections"][0]
    assert any(block["type"] == "quiz" for block in first_section["content"])

    ask = client.post(
        f"/v1/courses/{course_id}/ask",
        json={
            "section_id": first_section["id"],
            "question": "How should I practice this concept?",
            "response_mode": "example",
            "learner_id": learner_id,
        },
    )
    assert ask.status_code == 200, ask.text
    ask_json = ask.json()
    assert ask_json["mode"] == "example"
    assert ask_json["section_id"] == first_section["id"]

    progress = client.post(
        f"/v1/courses/{course_id}/progress",
        json={
            "learner_id": learner_id,
            "section_id": first_section["id"],
            "completion_state": "completed",
            "mastery_score": 0.88,
            "event_type": "quiz_submitted",
            "event_payload": {"is_correct": True},
        },
    )
    assert progress.status_code == 200, progress.text
    assert progress.json()["completion_state"] == "completed"

    analytics = client.get(f"/v1/courses/{course_id}/analytics", params={"learner_id": learner_id})
    assert analytics.status_code == 200, analytics.text
    summary = analytics.json()
    assert summary["completion_rate"] > 0
    assert "quiz_submitted" in summary["event_counts"]
    assert summary["quiz_accuracy"] == 1.0

    export = client.get(f"/v1/courses/{course_id}/export")
    assert export.status_code == 200, export.text
    assert export.json()["structure"]["title"] == course["structure"]["title"]


def test_program_portfolio_credentials_and_catalog(client, monkeypatch) -> None:
    _install_fetch_mock(
        monkeypatch,
        {
            "https://open.example.com/data-science": _sample_html(
                "Data Science Basics",
                "Data science combines statistics, programming, and domain expertise.",
            ),
        },
    )
    ingested = client.post(
        "/v1/sources/ingest",
        json={"url": "https://open.example.com/data-science", "source_type": "article", "license": "cc-by", "is_free": True},
    )
    assert ingested.status_code == 201, ingested.text

    learner = _create_learner(client, name="Jordan Pathbuilder")
    learner_id = learner["id"]

    generated_course = client.post(
        "/v1/courses/generate",
        json={
            "prompt": "Data science fundamentals with projects",
            "learner_id": learner_id,
            "source_policy": "balanced",
            "desired_module_count": 2,
            "expected_duration_minutes": 120,
        },
    )
    assert generated_course.status_code == 201, generated_course.text
    course_id = generated_course.json()["id"]

    program = client.post(
        "/v1/programs/generate",
        json={
            "goal": "Become a data scientist from free online resources",
            "learner_id": learner_id,
            "level": "beginner",
            "free_only": True,
            "source_policy": "free-only",
            "desired_course_count": 3,
        },
    )
    assert program.status_code == 201, program.text
    assert len(program.json()["structure"]["courses"]) >= 1

    artifact = client.post(
        "/v1/portfolio",
        json={
            "learner_id": learner_id,
            "course_snapshot_id": course_id,
            "title": "EDA Notebook",
            "artifact_type": "project",
            "url": "https://github.com/example/eda-notebook",
            "artifact_metadata": {"score": 95},
        },
    )
    assert artifact.status_code == 201, artifact.text

    credential = client.post(
        "/v1/credentials",
        json={
            "learner_id": learner_id,
            "kind": "certificate",
            "title": "Data Science Foundations",
            "evidence": {"course_snapshot_id": course_id},
        },
    )
    assert credential.status_code == 201, credential.text

    catalog = client.get("/v1/catalog", params={"query": "data science", "free_only": True, "trust_min": 0.1})
    assert catalog.status_code == 200, catalog.text
    catalog_json = catalog.json()
    assert len(catalog_json["knowledge_objects"]) >= 1
    assert len(catalog_json["courses"]) >= 1
    assert len(catalog_json["programs"]) >= 1


def test_job_queue_and_runner_endpoints(client, monkeypatch) -> None:
    _install_fetch_mock(
        monkeypatch,
        {
            "https://jobs.example.com/algorithms": _sample_html(
                "Algorithms Bootcamp",
                "Algorithms are step-by-step procedures for solving computational problems.",
            )
        },
    )

    ingest_job = client.post(
        "/v1/jobs",
        json={
            "job_type": "ingest_source",
            "payload": {
                "url": "https://jobs.example.com/algorithms",
                "source_type": "article",
                "license": "cc-by",
                "is_free": True,
            },
        },
    )
    assert ingest_job.status_code == 201, ingest_job.text

    run_pending = client.post("/v1/jobs/run-pending", params={"max_jobs": 5})
    assert run_pending.status_code == 200, run_pending.text
    completed = run_pending.json()
    assert len(completed) >= 1
    assert completed[0]["status"] == "completed"

    generate_job = client.post(
        "/v1/jobs",
        json={"job_type": "generate_course", "payload": {"prompt": "Learn algorithms for beginners"}},
    )
    assert generate_job.status_code == 201, generate_job.text
    generate_job_id = generate_job.json()["id"]

    run_one = client.post(f"/v1/jobs/{generate_job_id}/run")
    assert run_one.status_code == 200, run_one.text
    assert run_one.json()["status"] == "completed"
    assert "course_snapshot_id" in run_one.json()["result"]
