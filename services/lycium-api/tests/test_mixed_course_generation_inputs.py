from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest

from app.config import SETTINGS
from app.source_corpus import compile_generation_source_corpus


@pytest.fixture()
def isolated_local_data(tmp_path: Path) -> Iterator[None]:
    original = SETTINGS.local_data_dir
    object.__setattr__(SETTINGS, "local_data_dir", tmp_path / "lycium-local")
    try:
        yield
    finally:
        object.__setattr__(SETTINGS, "local_data_dir", original)


def _mock_models(*model_ids: str) -> list[dict[str, str]]:
    return [{"id": model_id, "label": model_id} for model_id in model_ids]


def _macro_artifact(name: str, text: str) -> dict[str, str]:
    return {
        "id": name.replace(".", "-").replace(" ", "-").lower(),
        "filename": name,
        "mimeType": "text/plain",
        "text": text,
    }


def _macro_input_artifacts() -> list[dict[str, str]]:
    return [
        _macro_artifact(
            "macroeconomics-syllabus.txt",
            "Macroeconomics principles covers GDP, national income accounting, inflation, unemployment, aggregate demand, fiscal policy, money, banking, and monetary policy.",
        ),
        _macro_artifact(
            "macroeconomics-data-guide.txt",
            "Macroeconomics data work includes GDP tables, price index calculations, unemployment measures, labor force participation, and policy analysis.",
        ),
        _macro_artifact(
            "macroeconomics-assessment.txt",
            "Assessments include inflation calculations, GDP component interpretation, aggregate demand scenarios, monetary policy questions, and data analysis.",
        ),
    ]


def _generation_payload(source_urls: list[str], input_artifacts: list[dict[str, str]]) -> dict:
    return {
        "prompt": "Create an undergraduate Macroeconomics Principles course with data activities and assessments.",
        "level": "undergrad",
        "category": "business-management",
        "department": "economics",
        "desired_module_count": 1,
        "expected_duration_minutes": 90,
        "max_stage_timeout_seconds": 30,
        "source_urls": source_urls,
        "input_artifacts": input_artifacts,
    }


def _save_active_local_model(client, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.routes.local_routes.validate_agent_api_key",
        lambda *args, **kwargs: _mock_models("kimi-k2.6:cloud"),
    )
    monkeypatch.setattr("app.routes.course_outline_routes.run_agent_course_generation_queue", lambda: None)
    saved = client.put("/v1/local/settings", json={"provider_id": "local-model", "agent_api_key": "http://localhost:11434"})
    assert saved.status_code == 200, saved.text


@pytest.mark.parametrize(
    ("source_urls", "artifact_count", "label"),
    [
        ([], 3, "files-only"),
        (["https://example.edu/macroeconomics/syllabus"], 2, "one-url-two-files"),
        (["https://example.edu/macroeconomics/syllabus", "https://example.edu/macroeconomics/data-guide"], 1, "two-urls-one-file"),
        (
            [
                "https://example.edu/macroeconomics/syllabus",
                "https://example.edu/macroeconomics/data-guide",
                "https://example.edu/macroeconomics/textbook",
            ],
            0,
            "urls-only",
        ),
    ],
)
def test_course_generation_jobs_accept_url_file_mixes(
    client,
    monkeypatch,
    isolated_local_data,
    source_urls: list[str],
    artifact_count: int,
    label: str,
) -> None:
    _save_active_local_model(client, monkeypatch)

    artifacts = _macro_input_artifacts()[:artifact_count]
    response = client.post("/v1/agent/courses/jobs", json=_generation_payload(source_urls, artifacts))

    assert response.status_code == 202, f"{label}: {response.text}"
    job = response.json()
    assert job["status"] == "queued"
    assert job["request"]["source_urls"] == source_urls
    assert len(job["request"]["input_artifacts"]) == artifact_count
    assert job["request"]["max_stage_timeout_seconds"] == 30
    assert job["request"]["generation_readiness"]["ready"] is True
    assert job["request"]["generation_readiness"]["status"] == "ready"
    assert job["request"]["generation_readiness"]["sourceEvidence"]["submittedEvidenceCount"] >= 3


def test_course_generation_jobs_enqueue_zero_source_active_generation(client, monkeypatch, isolated_local_data) -> None:
    _save_active_local_model(client, monkeypatch)

    response = client.post("/v1/agent/courses/jobs", json=_generation_payload([], []))

    assert response.status_code == 202, response.text
    job = response.json()
    assert job["status"] == "queued"
    assert job["request"]["source_urls"] == []
    assert job["request"]["input_artifacts"] == []
    assert job["request"]["generation_readiness"]["ready"] is False
    assert job["request"]["generation_readiness"]["status"] == "needs_sources"
    assert job.get("course_snapshot") is None


def test_course_generation_jobs_enqueue_under_sourced_url_file_mix(client, monkeypatch, isolated_local_data) -> None:
    _save_active_local_model(client, monkeypatch)

    response = client.post(
        "/v1/agent/courses/jobs",
        json=_generation_payload(["https://example.edu/macroeconomics/syllabus"], _macro_input_artifacts()[:1]),
    )

    assert response.status_code == 202, response.text
    job = response.json()
    assert job["status"] == "queued"
    assert job["current_stage"] == "queued"
    assert job.get("course_snapshot") is None
    assert job["request"]["source_urls"] == ["https://example.edu/macroeconomics/syllabus"]
    assert len(job["request"]["input_artifacts"]) == 1
    assert job["request"]["generation_readiness"]["status"] == "needs_sources"


def test_course_generation_jobs_enqueue_low_packet_concept_coverage(client, monkeypatch, isolated_local_data) -> None:
    _save_active_local_model(client, monkeypatch)

    response = client.post(
        "/v1/agent/courses/jobs",
        json={
            **_generation_payload([], []),
            "source_packet": {
                "contract_version": "source-packet-v1",
                "source_urls": [
                    "https://example.edu/macroeconomics/syllabus",
                    "https://example.edu/macroeconomics/data-guide",
                    "https://example.edu/macroeconomics/textbook",
                ],
                "quality": {
                    "status": "needs_review",
                    "conceptCoverageRatio": 0.33,
                    "conceptCandidateCount": 3,
                    "coveredConceptCandidateCount": 1,
                    "uncoveredConceptCandidates": ["inflation", "monetary policy"],
                },
            },
        },
    )

    assert response.status_code == 202, response.text
    job = response.json()
    readiness = job["request"]["generation_readiness"]
    assert job["status"] == "queued"
    assert job["current_stage"] == "queued"
    assert job.get("course_snapshot") is None
    assert readiness["status"] == "needs_sources"
    assert readiness["sourceEvidence"]["submittedEvidenceCount"] == 3
    assert readiness["conceptCoverage"]["uncoveredConcepts"] == ["inflation", "monetary policy"]


def test_source_corpus_preflight_combines_url_documents_and_input_artifacts() -> None:
    url = "https://example.edu/macroeconomics/open-textbook"
    corpus = compile_generation_source_corpus(
        prompt="macroeconomics principles GDP inflation unemployment monetary policy data course",
        source_urls=[url],
        fetch_sources=False,
        source_documents=[
            {
                "url": url,
                "title": "Open macroeconomics chapter",
                "text": "Macroeconomics chapters cover GDP, inflation, unemployment, aggregate demand, fiscal policy, and monetary policy.",
                "contentType": "text/plain",
                "fetchStatus": "provided",
            }
        ],
        input_artifacts=_macro_input_artifacts()[:2],
    )

    metrics = corpus.synthesis["metrics"]
    assert metrics["submittedSourceCount"] == 3
    assert metrics["submittedInputArtifactCount"] == 2
    assert metrics["usableInputArtifactCount"] == 2
    assert metrics["includedInputArtifactCount"] == 2
    assert url in corpus.source_urls
    assert any(url.startswith("artifact://") for url in corpus.source_urls)
    assert {document.get("inputArtifactId") for document in corpus.source_documents} >= {
        "macroeconomics-syllabus-txt",
        "macroeconomics-data-guide-txt",
    }


def test_source_corpus_preflight_filters_noisy_url_and_file_inputs() -> None:
    useful_url = "https://example.edu/macroeconomics/syllabus"
    noisy_url = "https://example.edu/student-life/parking"
    useful_artifact = _macro_input_artifacts()[0]
    noisy_artifact = _macro_artifact(
        "campus-parking.txt",
        "Parking permits, dining hall hours, residence move-in instructions, and campus shuttle routes.",
    )

    corpus = compile_generation_source_corpus(
        prompt="macroeconomics principles GDP inflation unemployment monetary policy data course",
        source_urls=[useful_url, noisy_url],
        fetch_sources=False,
        source_documents=[
            {
                "url": useful_url,
                "title": "Macroeconomics principles syllabus",
                "text": "Macroeconomics syllabus with GDP, inflation, unemployment, aggregate demand, fiscal policy, and monetary policy.",
                "contentType": "text/plain",
                "fetchStatus": "provided",
            },
            {
                "url": noisy_url,
                "title": "Campus parking information",
                "text": "Parking permits, shuttle hours, meal plans, and residence hall move-in dates.",
                "contentType": "text/plain",
                "fetchStatus": "provided",
            },
        ],
        input_artifacts=[useful_artifact, noisy_artifact],
    )

    metrics = corpus.synthesis["metrics"]
    included_artifact_ids = {document.get("inputArtifactId") for document in corpus.source_documents}

    assert metrics["submittedSourceCount"] == 4
    assert metrics["submittedInputArtifactCount"] == 2
    assert metrics["usableInputArtifactCount"] == 2
    assert metrics["includedInputArtifactCount"] == 1
    assert useful_url in corpus.source_urls
    assert noisy_url not in corpus.source_urls
    assert "macroeconomics-syllabus-txt" in included_artifact_ids
    assert "campus-parking-txt" not in included_artifact_ids
