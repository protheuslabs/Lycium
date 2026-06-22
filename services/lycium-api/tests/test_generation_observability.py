from __future__ import annotations

import json
from types import SimpleNamespace

from app import db
from app.generation_observability import (
    complete_generation_run,
    record_generation_run_checkpoint,
    start_generation_run,
)
from app.jobs import run_agent_course_generation_job
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
                "input_artifacts": [
                    {
                        "id": "chem-lab-notes",
                        "filename": "chem-lab-notes.txt",
                        "text": "General chemistry laboratory notes about titration and safety.",
                    }
                ],
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
                    "metrics": {
                        "submittedSourceCount": 2,
                        "submittedInputArtifactCount": 1,
                        "usableInputArtifactCount": 1,
                        "includedInputArtifactCount": 1,
                        "includedSourceCount": 2,
                        "excludedSourceCount": 1,
                        "fetchFailureCount": 0,
                    },
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
                    "metrics": {
                        "submittedSourceCount": 2,
                        "submittedInputArtifactCount": 1,
                        "usableInputArtifactCount": 1,
                        "includedInputArtifactCount": 1,
                        "includedSourceCount": 2,
                        "excludedSourceCount": 1,
                        "fetchFailureCount": 0,
                    },
                    "includedSources": [{"url": "https://example.edu/chemistry/syllabus"}],
                    "excludedSources": [{"url": "https://example.edu/noise"}],
                    "fetchFailures": [],
                    "commonThemes": ["stoichiometry"],
                },
                "generation_readiness": {
                    "contractVersion": "course-generation-readiness-v1",
                    "status": "needs_sources",
                    "ready": False,
                    "sourceEvidence": {
                        "sourceUrlCount": 1,
                        "usableInputArtifactCount": 1,
                        "submittedEvidenceCount": 2,
                        "minimumCourseSources": 3,
                    },
                    "conceptCoverage": {
                        "status": "needs_sources",
                        "coverageRatio": 0.5,
                        "minimumCoverageRatio": 0.7,
                        "requiredConceptCount": 2,
                        "coveredConceptCount": 1,
                        "uncoveredConcepts": ["thermochemistry"],
                    },
                    "issues": [{"code": "minimum_source_evidence", "message": "Add at least 3 relevant sources."}],
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
    assert payload["result_summary"]["inputs"]["inputArtifactCount"] == 1
    assert payload["result_summary"]["inputs"]["usableInputArtifactCount"] == 1
    assert payload["result_summary"]["inputs"]["submittedEvidenceCount"] == 2
    assert payload["result_summary"]["inputs"]["inputArtifactFilenames"] == ["chem-lab-notes.txt"]
    assert payload["result_summary"]["sourceCorpus"]["submittedSourceCount"] == 2
    assert payload["result_summary"]["sourceCorpus"]["submittedInputArtifactCount"] == 1
    assert payload["result_summary"]["sourceCorpus"]["includedInputArtifactCount"] == 1
    assert payload["result_summary"]["sourceCorpus"]["includedSourceCount"] == 2
    assert payload["result_summary"]["sourceCorpus"]["excludedSourceCount"] == 1
    assert payload["result_summary"]["generationReadiness"]["status"] == "needs_sources"
    assert payload["result_summary"]["generationReadiness"]["sourceEvidence"]["submittedEvidenceCount"] == 2
    assert payload["result_summary"]["generationReadiness"]["conceptCoverage"]["uncoveredConcepts"] == ["thermochemistry"]
    assert payload["result_summary"]["generationReadiness"]["issueCount"] == 1
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


def test_generation_job_mirrors_file_backed_source_gap_resume_report(client, tmp_path, monkeypatch) -> None:
    local_data_dir = tmp_path / "local-data"
    monkeypatch.setattr("app.local_store_core.ensure_local_data_dirs", lambda: local_data_dir)
    monkeypatch.setattr("app.local_store_generation_runs.ensure_local_data_dirs", lambda: local_data_dir)
    monkeypatch.setattr(
        "app.jobs.require_verified_active_agent_profile",
        lambda: {"agent_api_key": "test-key", "provider_id": "local-model", "model": "kimi-k2.6:cloud"},
    )
    monkeypatch.setattr(
        "app.jobs.generate_course_with_agent_staged",
        lambda **_kwargs: SimpleNamespace(
            course={"title": "Mock mixed-source chemistry course", "modules": []},
            trace={
                "mode": "staged-llm-agent",
                "source_corpus_synthesis": {
                    "metrics": {
                        "submittedSourceCount": 3,
                        "submittedInputArtifactCount": 1,
                        "usableInputArtifactCount": 1,
                        "includedInputArtifactCount": 1,
                        "includedSourceCount": 2,
                        "excludedSourceCount": 1,
                        "fetchFailureCount": 0,
                    },
                    "commonThemes": ["stoichiometry", "laboratory safety"],
                },
                "stages": [{"stage": "course_plan", "status": "passed"}],
            },
        ),
    )
    monkeypatch.setattr(
        "app.jobs.assess_course_quality",
        lambda *_args, **_kwargs: {
            "passed": False,
            "score": 0.72,
            "errors": ["source_grounding: Missing section-level citation support."],
            "warnings": [],
            "gates": [{"gate": "source_grounding", "status": "failed"}],
        },
    )

    with db.SessionLocal() as session:
        job = Job(
            job_type="agent_generate_course_staged",
            payload={
                "prompt": "Create a CHEM 105 course from mixed evidence.",
                "provider_id": "local-model",
                "model": "kimi-k2.6:cloud",
                "source_urls": ["https://example.edu/chem105/syllabus", "https://example.edu/noise"],
                "input_artifacts": [
                    {
                        "id": "chem-lab-notes",
                        "filename": "chem-lab-notes.txt",
                        "text": "Laboratory safety and titration notes.",
                    }
                ],
                "source_packet": {
                    "contract_version": "source-packet-v1",
                    "source_documents": [
                        {
                            "url": "artifact://chem-lab-notes.txt",
                            "title": "chem-lab-notes.txt",
                            "text": "Laboratory safety and titration notes.",
                            "inputArtifactId": "chem-lab-notes",
                        }
                    ],
                },
                "resume_course": {
                    "title": "Chemistry 105 Draft",
                    "metadata": {"status": "needs_sources"},
                },
                "resume_trace": {"status": "needs_sources"},
                "desired_module_count": 1,
            },
            status="queued",
            result={},
        )
        session.add(job)
        session.flush()
        job_id = job.id
        session.commit()

    run_agent_course_generation_job(job_id)

    runs_response = client.get("/v1/agent/courses/runs")
    assert runs_response.status_code == 200, runs_response.text
    run_payload = next(run for run in runs_response.json() if run["job_id"] == job_id)
    mirror_path = local_data_dir / "generation-runs" / f"run-{run_payload['id']}.json"
    mirrored = json.loads(mirror_path.read_text())
    mirrored_summary = mirrored["run"]["result_summary"]

    assert run_payload["status"] == "failed"
    assert mirrored_summary["inputs"]["sourceUrlCount"] == 2
    assert mirrored_summary["inputs"]["inputArtifactCount"] == 1
    assert mirrored_summary["inputs"]["usableInputArtifactCount"] == 1
    assert mirrored_summary["inputs"]["submittedEvidenceCount"] == 3
    assert mirrored_summary["inputs"]["isResume"] is True
    assert mirrored_summary["inputs"]["hasResumeTrace"] is True
    assert mirrored_summary["inputs"]["sourcePacketDocumentCount"] == 1
    assert mirrored_summary["inputs"]["sourcePacketInputArtifactDocumentCount"] == 1
    assert mirrored_summary["inputs"]["sourceGapResumeFileBacked"] is True
    assert mirrored_summary["inputs"]["inputArtifactFilenames"] == ["chem-lab-notes.txt"]
    assert mirrored_summary["sourceCorpus"]["submittedSourceCount"] == 3
    assert mirrored_summary["sourceCorpus"]["submittedInputArtifactCount"] == 1
    assert mirrored_summary["sourceCorpus"]["includedInputArtifactCount"] == 1
    assert mirrored_summary["sourceCorpus"]["excludedSourceCount"] == 1
    assert mirrored_summary["gateSummary"]["failedGates"] == ["source_grounding"]
    assert mirrored_summary["qualityScore"] == 0.72
