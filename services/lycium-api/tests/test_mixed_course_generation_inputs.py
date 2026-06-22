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


def _chem_artifact(name: str, text: str) -> dict[str, str]:
    return {
        "id": name.replace(".", "-").replace(" ", "-").lower(),
        "filename": name,
        "mimeType": "text/plain",
        "text": text,
    }


def _chem_input_artifacts() -> list[dict[str, str]]:
    return [
        _chem_artifact(
            "chem105-syllabus.txt",
            "CHEM 105 covers measurement, atomic structure, stoichiometry, bonding, thermochemistry, gases, and aqueous reactions.",
        ),
        _chem_artifact(
            "chem105-labs.txt",
            "General chemistry laboratory work includes safety, density, hydrate composition, calorimetry, titration, and gas collection.",
        ),
        _chem_artifact(
            "chem105-assessment.txt",
            "Assessments include stoichiometry problems, limiting reactant calculations, molecular geometry, gas law questions, and lab analysis.",
        ),
    ]


def _generation_payload(source_urls: list[str], input_artifacts: list[dict[str, str]]) -> dict:
    return {
        "prompt": "Create an undergraduate CHEM 105 General Chemistry I course with labs and assessments.",
        "level": "undergrad",
        "category": "natural-sciences-mathematics",
        "department": "chemistry",
        "desired_module_count": 1,
        "expected_duration_minutes": 90,
        "max_stage_timeout_seconds": 30,
        "source_urls": source_urls,
        "input_artifacts": input_artifacts,
    }


@pytest.mark.parametrize(
    ("source_urls", "artifact_count", "label"),
    [
        ([], 3, "files-only"),
        (["https://example.edu/chem105/syllabus"], 2, "one-url-two-files"),
        (["https://example.edu/chem105/syllabus", "https://example.edu/chem105/labs"], 1, "two-urls-one-file"),
        (
            [
                "https://example.edu/chem105/syllabus",
                "https://example.edu/chem105/labs",
                "https://example.edu/chem105/textbook",
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
    monkeypatch.setattr(
        "app.routes.local_routes.validate_agent_api_key",
        lambda *args, **kwargs: _mock_models("kimi-k2.6:cloud", "llama3.1:70b"),
    )
    monkeypatch.setattr("app.routes.course_outline_routes.run_agent_course_generation_job", lambda job_id: None)
    saved = client.put("/v1/local/settings", json={"provider_id": "local-model", "agent_api_key": "http://localhost:11434"})
    assert saved.status_code == 200, saved.text

    artifacts = _chem_input_artifacts()[:artifact_count]
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


def test_course_generation_jobs_hold_under_sourced_url_file_mix_for_source_gaps(client, isolated_local_data) -> None:
    response = client.post(
        "/v1/agent/courses/jobs",
        json=_generation_payload(["https://example.edu/chem105/syllabus"], _chem_input_artifacts()[:1]),
    )

    assert response.status_code == 202, response.text
    job = response.json()
    assert job["status"] == "ready"
    assert job["current_stage"] == "source_coverage"
    assert job["course_snapshot"]["status"] == "needs_sources"
    assert job["request"]["source_urls"] == ["https://example.edu/chem105/syllabus"]
    assert len(job["request"]["input_artifacts"]) == 1


def test_course_generation_jobs_hold_low_packet_concept_coverage_for_source_gaps(client, isolated_local_data) -> None:
    response = client.post(
        "/v1/agent/courses/jobs",
        json={
            **_generation_payload([], []),
            "source_packet": {
                "contract_version": "source-packet-v1",
                "source_urls": [
                    "https://example.edu/chem105/syllabus",
                    "https://example.edu/chem105/labs",
                    "https://example.edu/chem105/textbook",
                ],
                "quality": {
                    "status": "needs_review",
                    "conceptCoverageRatio": 0.33,
                    "conceptCandidateCount": 3,
                    "coveredConceptCandidateCount": 1,
                    "uncoveredConceptCandidates": ["stoichiometry", "thermochemistry"],
                },
            },
        },
    )

    assert response.status_code == 202, response.text
    job = response.json()
    readiness = job["course"]["metadata"]["generationReadiness"]
    assert job["status"] == "ready"
    assert job["current_stage"] == "source_coverage"
    assert readiness["status"] == "needs_sources"
    assert readiness["sourceEvidence"]["submittedEvidenceCount"] == 3
    assert readiness["conceptCoverage"]["uncoveredConcepts"] == ["stoichiometry", "thermochemistry"]


def test_source_corpus_preflight_combines_url_documents_and_input_artifacts() -> None:
    url = "https://example.edu/chem105/open-textbook"
    corpus = compile_generation_source_corpus(
        prompt="CHEM 105 general chemistry stoichiometry bonding thermochemistry laboratory course",
        source_urls=[url],
        fetch_sources=False,
        source_documents=[
            {
                "url": url,
                "title": "Open general chemistry chapter",
                "text": "General chemistry chapters cover stoichiometry, molecular bonding, thermochemistry, and gas laws.",
                "contentType": "text/plain",
                "fetchStatus": "provided",
            }
        ],
        input_artifacts=_chem_input_artifacts()[:2],
    )

    metrics = corpus.synthesis["metrics"]
    assert metrics["submittedSourceCount"] == 3
    assert metrics["submittedInputArtifactCount"] == 2
    assert metrics["usableInputArtifactCount"] == 2
    assert metrics["includedInputArtifactCount"] == 2
    assert url in corpus.source_urls
    assert any(url.startswith("artifact://") for url in corpus.source_urls)
    assert {document.get("inputArtifactId") for document in corpus.source_documents} >= {
        "chem105-syllabus-txt",
        "chem105-labs-txt",
    }


def test_source_corpus_preflight_filters_noisy_url_and_file_inputs() -> None:
    useful_url = "https://example.edu/chem105/syllabus"
    noisy_url = "https://example.edu/student-life/parking"
    useful_artifact = _chem_input_artifacts()[0]
    noisy_artifact = _chem_artifact(
        "campus-parking.txt",
        "Parking permits, dining hall hours, residence move-in instructions, and campus shuttle routes.",
    )

    corpus = compile_generation_source_corpus(
        prompt="CHEM 105 general chemistry stoichiometry bonding thermochemistry laboratory course",
        source_urls=[useful_url, noisy_url],
        fetch_sources=False,
        source_documents=[
            {
                "url": useful_url,
                "title": "CHEM 105 syllabus",
                "text": "General chemistry syllabus with stoichiometry, bonding, gas laws, thermochemistry, and laboratory safety.",
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
    assert "chem105-syllabus-txt" in included_artifact_ids
    assert "campus-parking-txt" not in included_artifact_ids
