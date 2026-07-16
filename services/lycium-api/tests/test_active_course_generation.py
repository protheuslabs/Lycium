from __future__ import annotations

from copy import deepcopy

import pytest

from app import db
from app.active_course_generation import generate_active_course_batch
from app.course_quality import assess_course_quality
from app.models import CourseSnapshot


def _source_packet() -> dict:
    return {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1,
            "uncoveredConceptCandidates": [],
        },
        "source_documents": [
            {
                "courseSourceId": "packet-source-1",
                "title": "Statistics source",
                "url": "https://example.edu/statistics",
                "text": "Statistics, probability, analytics practice, prerequisite foundations, mastery evidence, and source-backed decisions.",
            },
            {
                "courseSourceId": "packet-source-2",
                "title": "Python source",
                "url": "https://example.edu/python",
                "text": "Python, data cleaning, SQL, reproducible workflows, applied analysis, and review-ready project evidence.",
            },
        ],
    }


def _active_plan(*, with_batches: bool = False) -> dict:
    planned_modules = [
        {
            "moduleIndex": 1,
            "title": "Module 1: Statistics",
            "status": "not_generated",
            "requiredConcepts": ["statistics"],
        },
        {
            "moduleIndex": 2,
            "title": "Module 2: Python",
            "status": "not_generated",
            "requiredConcepts": ["python"],
        },
        {
            "moduleIndex": 3,
            "title": "Module 3: SQL",
            "status": "not_generated",
            "requiredConcepts": ["sql"],
        },
    ]
    batches = [
        {"batchIndex": 1, "moduleIndexes": [1, 2], "status": "not_generated"},
        {"batchIndex": 2, "moduleIndexes": [3], "status": "not_generated"},
    ] if with_batches else []
    return {
        "contractVersion": "active-course-generation-plan-v1",
        "status": "needs_sources",
        "mode": "on_demand_module_batches",
        "batchSizeModules": 2,
        "plannedModules": planned_modules,
        "batches": batches,
    }


def _snapshot(*, with_batches: bool = False) -> CourseSnapshot:
    return CourseSnapshot(
        learner_id=None,
        draft_id=None,
        title="Data Analytics Shell",
        prompt="Create a data analytics course.",
        language="en",
        level="professional",
        source_policy="balanced",
        status="needs_sources",
        version=1,
        structure={
            "title": "Data Analytics Shell",
            "shortDescription": "Course shell for active generation.",
            "metadata": {
                "activeGenerationPlan": _active_plan(with_batches=with_batches),
                "courseBuildTask": {
                    "contractVersion": "course-build-task-v1",
                    "courseId": "data-analytics-shell",
                    "title": "Data Analytics Shell",
                    "status": "source_gathering",
                    "currentStage": "source_gathering",
                    "nextAction": "attach_source_packet",
                    "requiredInputs": ["source_packet", "concept_source_coverage"],
                },
                "courseWrapper": {
                    "contractVersion": "course-wrapper-v1",
                    "courseId": "data-analytics-shell",
                    "status": "wrapper",
                    "requiredConcepts": ["statistics", "python", "sql"],
                },
            },
            "modules": [],
            "sourceRecords": [],
        },
        generation_trace={},
    )


def _course_build_outline() -> dict:
    return {
        "contractVersion": "course-outline-from-source-packet-v1",
        "title": "Data Analytics",
        "shortDescription": "Source-packet outline for a data analytics course.",
        "modules": [
            {
                "id": "outline-m1",
                "title": "Module 1: Statistics",
                "sourceIds": ["packet-source-1"],
                "concept_keywords": ["statistics", "probability"],
                "sections": [
                    {
                        "id": "outline-m1-s1",
                        "title": "Statistics Foundations",
                        "learning_objectives": ["Explain statistics with source-backed reasoning."],
                        "concept_keywords": ["statistics", "probability"],
                        "sourceIds": ["packet-source-1"],
                        "planningSource": "source_packet",
                    },
                    {
                        "id": "outline-m1-s2",
                        "title": "Analytics Practice",
                        "learning_objectives": ["Apply statistical evidence to analytics practice."],
                        "concept_keywords": ["analytics practice", "evidence"],
                        "sourceIds": ["packet-source-1"],
                        "planningSource": "source_packet",
                    },
                ],
            },
            {
                "id": "outline-m2",
                "title": "Module 2: Python",
                "sourceIds": ["packet-source-2"],
                "concept_keywords": ["python", "data cleaning"],
                "sections": [
                    {
                        "id": "outline-m2-s1",
                        "title": "Python Workflows",
                        "learning_objectives": ["Explain data cleaning workflows."],
                        "concept_keywords": ["python", "data cleaning"],
                        "sourceIds": ["packet-source-2"],
                        "planningSource": "source_packet",
                    },
                    {
                        "id": "outline-m2-s2",
                        "title": "Reproducible Analysis",
                        "learning_objectives": ["Apply reproducible workflow checks."],
                        "concept_keywords": ["reproducible workflows", "analysis"],
                        "sourceIds": ["packet-source-2"],
                        "planningSource": "source_packet",
                    },
                ],
            },
            {
                "id": "outline-m3",
                "title": "Module 3: SQL",
                "sourceIds": ["packet-source-2"],
                "concept_keywords": ["sql", "query design"],
                "sections": [
                    {
                        "id": "outline-m3-s1",
                        "title": "SQL Foundations",
                        "learning_objectives": ["Explain SQL query design."],
                        "concept_keywords": ["sql", "query design"],
                        "sourceIds": ["packet-source-2"],
                        "planningSource": "source_packet",
                    },
                    {
                        "id": "outline-m3-s2",
                        "title": "Query Practice",
                        "learning_objectives": ["Apply SQL to validation practice."],
                        "concept_keywords": ["query practice", "data validation"],
                        "sourceIds": ["packet-source-2"],
                        "planningSource": "source_packet",
                    },
                ],
            },
        ],
        "provenance": {"mode": "source_packet", "sourceDocumentCount": 2},
    }


def _outline_snapshot() -> CourseSnapshot:
    return CourseSnapshot(
        learner_id=None,
        draft_id=None,
        title="Data Analytics Shell",
        prompt="Create a data analytics course.",
        language="en",
        level="professional",
        source_policy="balanced",
        status="needs_sources",
        version=1,
        structure={
            "title": "Data Analytics Shell",
            "shortDescription": "Course shell for active generation.",
            "difficultyLevel": "intermediate",
            "category": "computing-information-sciences",
            "department": "data-science",
            "tags": ["data analytics", "statistics", "python"],
            "metadata": {
                "courseBuildOutline": _course_build_outline(),
                "courseBuildTask": {
                    "contractVersion": "course-build-task-v1",
                    "courseId": "data-analytics-shell",
                    "title": "Data Analytics Shell",
                    "status": "section_generation_ready",
                    "currentStage": "section_generation_ready",
                    "nextAction": "generate_course_sections",
                    "requiredInputs": ["section_generation"],
                },
                "scope": {
                    "audience": "early career analysts",
                    "level": "intermediate",
                    "duration": "3 modules",
                    "outcome": "Use statistics, Python, and SQL to explain source-backed analytics decisions.",
                },
                "curriculumBenchmarks": [
                    {
                        "id": "analytics-benchmark",
                        "title": "Analytics skills benchmark",
                        "extractedRequirements": ["Statistics", "Python workflows", "SQL query practice"],
                    }
                ],
                "requirementOrigins": [
                    {
                        "id": "analytics-requirement",
                        "title": "Analytics foundations",
                        "description": "Statistics, Python, SQL, and source-backed mastery evidence.",
                        "evidenceRefs": ["packet-source-1", "packet-source-2"],
                    }
                ],
                "courseParityProfile": {
                    "commonRequiredTopics": ["statistics", "python", "sql"],
                },
            },
            "modules": [],
            "sourceRecords": [],
        },
        generation_trace={},
    )


def _persist(snapshot: CourseSnapshot) -> CourseSnapshot:
    with db.SessionLocal() as session:
        session.add(snapshot)
        session.commit()
        session.refresh(snapshot)
        return snapshot


def test_active_generation_advances_fallback_batches_and_preserves_source_ids() -> None:
    snapshot = _persist(_snapshot())

    generate_active_course_batch(snapshot, source_packet=_source_packet(), module_count=2)
    first_structure = snapshot.structure
    first_plan = first_structure["metadata"]["activeGenerationPlan"]
    first_task = first_structure["metadata"]["courseBuildTask"]

    assert [source["id"] for source in first_structure["sourceRecords"]] == ["packet-source-1", "packet-source-2"]
    assert len(first_structure["modules"]) == 2
    assert first_plan["status"] == "partially_generated"
    assert first_plan["batches"][0]["batchIndex"] == 1
    assert first_plan["batches"][0]["moduleIndexes"] == [1, 2]
    assert first_plan["batches"][0]["status"] == "generated"
    assert first_task["status"] == "section_generation_ready"
    assert first_task["nextAction"] == "generate_course_sections"
    assert first_task["requiredInputs"] == ["section_generation"]

    generate_active_course_batch(snapshot, source_packet=_source_packet(), module_count=2)
    final_structure = snapshot.structure
    final_plan = final_structure["metadata"]["activeGenerationPlan"]
    final_task = final_structure["metadata"]["courseBuildTask"]
    lesson_titles = [module["sections"][0]["title"] for module in final_structure["modules"]]

    assert [source["id"] for source in final_structure["sourceRecords"]] == ["packet-source-1", "packet-source-2"]
    assert len(final_structure["modules"]) == 3
    assert len(final_plan["batches"]) == 2
    assert final_plan["batches"][1]["batchIndex"] == 2
    assert final_plan["batches"][1]["moduleIndexes"] == [3]
    assert final_plan["status"] == "complete"
    assert final_task["status"] == "section_generation_ready"
    assert final_task["nextAction"] == "run_quality_review"
    assert final_task["requiredInputs"] == ["quality_report"]
    assert lesson_titles == ["Statistics", "Python", "Sql"]
    assert snapshot.generation_trace["activeGeneration"]["status"] == "complete"
    assert snapshot.generation_trace["activeGeneration"]["generatedModuleIndexes"] == [3]


def test_active_generation_rejects_explicit_completed_batch_without_mutating_course() -> None:
    snapshot = _persist(_snapshot(with_batches=True))
    generate_active_course_batch(snapshot, source_packet=_source_packet(), batch_index=1)
    before_structure = deepcopy(snapshot.structure)
    before_trace = deepcopy(snapshot.generation_trace)

    with pytest.raises(ValueError, match="already been generated"):
        generate_active_course_batch(snapshot, source_packet=_source_packet(), batch_index=1)

    assert snapshot.structure == before_structure
    assert snapshot.generation_trace == before_trace


def test_active_generation_endpoint_generates_next_batch(client) -> None:
    snapshot = _persist(_snapshot(with_batches=True))

    response = client.post(
        f"/v1/courses/{snapshot.id}/active-generation/generate-next-batch",
        json={"module_count": 2, "source_packet": _source_packet()},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    plan = body["structure"]["metadata"]["activeGenerationPlan"]
    task = body["structure"]["metadata"]["courseBuildTask"]

    assert body["status"] == "generated"
    assert len(body["structure"]["modules"]) == 2
    assert plan["batches"][0]["status"] == "generated"
    assert plan["batches"][1]["status"] == "not_generated"
    assert task["currentStage"] == "section_generation_ready"
    assert task["nextAction"] == "generate_course_sections"


def test_active_generation_derives_batches_from_course_build_outline() -> None:
    snapshot = _persist(_outline_snapshot())

    generate_active_course_batch(snapshot, source_packet=_source_packet(), module_count=2)
    structure = snapshot.structure
    metadata = structure["metadata"]
    plan = metadata["activeGenerationPlan"]
    modules = structure["modules"]

    assert plan["planningSource"] == "course_build_outline"
    assert [module["title"] for module in plan["plannedModules"]] == [
        "Module 1: Statistics",
        "Module 2: Python",
        "Module 3: SQL",
    ]
    assert plan["plannedModules"][0]["sections"][0]["id"] == "outline-m1-s1"
    assert metadata["courseBuildOutline"]["contractVersion"] == "course-outline-from-source-packet-v1"
    assert metadata["generationPlan"]["planningSource"] == "source_packet_outline"
    assert len(modules) == 2
    assert [section["title"] for section in modules[0]["sections"][:2]] == [
        "Statistics Foundations",
        "Analytics Practice",
    ]
    assert modules[0]["sections"][0]["metadata"]["generationOutline"]["planningSource"] == "source_packet"
    assert modules[0]["sections"][0]["metadata"]["generationOutline"]["plannedSourceIds"] == ["packet-source-1"]
    assert metadata["sourceSlots"]
    assert metadata["conceptSourceCoverageMap"]
    assert {slot["primarySourceId"] for slot in metadata["sourceSlots"]} == {"packet-source-1", "packet-source-2"}


def test_completed_active_generation_passes_quality_and_submit_review_promotes_task(client) -> None:
    snapshot = _persist(_outline_snapshot())

    for _ in range(2):
        response = client.post(
            f"/v1/courses/{snapshot.id}/active-generation/generate-next-batch",
            json={"module_count": 2, "source_packet": _source_packet()},
        )
        assert response.status_code == 200, response.text

    quality_response = client.get(f"/v1/courses/{snapshot.id}/quality-report")
    assert quality_response.status_code == 200, quality_response.text
    quality = quality_response.json()
    assert quality["passed"] is True
    assert quality["evals"]["status"] == "passed"
    assert quality["metrics"]["moduleCount"] == 3

    review_response = client.post(f"/v1/courses/{snapshot.id}/submit-review")

    assert review_response.status_code == 200, review_response.text
    body = review_response.json()
    task = body["structure"]["metadata"]["courseBuildTask"]
    review_report = task["reviewTransitionReport"]

    assert body["status"] == "ready_for_review"
    assert body["generation_trace"]["quality_report"]["passed"] is True
    assert task["status"] == "ready_for_review"
    assert task["currentStage"] == "ready_for_review"
    assert task["nextAction"] == "review_and_publish"
    assert task["requiredInputs"] == ["human_review"]
    assert task["reviewReadiness"]["passed"] is True
    assert review_report["contractVersion"] == "review-transition-report-v1"
    assert review_report["status"] == "ready_for_review"
    assert review_report["passed"] is True
    assert review_report["nextAction"] == "review_and_publish"


def test_submit_review_blocks_incomplete_active_generation_with_traceable_quality_report(client) -> None:
    snapshot = _persist(_outline_snapshot())
    generate_active_course_batch(snapshot, source_packet=_source_packet(), module_count=1)
    with db.SessionLocal() as session:
        stored = session.get(CourseSnapshot, snapshot.id)
        stored.structure = snapshot.structure
        stored.generation_trace = snapshot.generation_trace
        session.commit()

    review_response = client.post(f"/v1/courses/{snapshot.id}/submit-review")

    assert review_response.status_code == 200, review_response.text
    body = review_response.json()
    task = body["structure"]["metadata"]["courseBuildTask"]
    quality_report = body["generation_trace"]["quality_report"]

    assert body["status"] == "needs_revision"
    assert quality_report["passed"] is False
    assert any("Active generation must complete" in error for error in quality_report["errors"])
    assert quality_report["metrics"]["moduleCount"] == 1
    assert quality_report["metrics"]["workflowFailedGateCount"] >= 1
    assert task["status"] == "section_generation_ready"
    assert task["currentStage"] == "section_generation_ready"
    assert task["nextAction"] == "repair_generated_sections"
    assert task["requiredInputs"] == ["quality_gate_repairs"]
    assert task["reviewReadiness"]["passed"] is False
    assert task["reviewTransitionReport"]["status"] == "blocked"
    assert task["reviewTransitionReport"]["nextStage"] == "section_generation_ready"


def test_active_generation_rejects_unusable_source_packet_without_mutating_course() -> None:
    snapshot = _persist(_outline_snapshot())
    before_structure = deepcopy(snapshot.structure)
    before_trace = deepcopy(snapshot.generation_trace)
    bad_packet = {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "needs_review",
            "conceptCoverageRatio": 0.25,
            "uncoveredConceptCandidates": ["statistics"],
        },
        "source_documents": [{"courseSourceId": "packet-source-1", "title": "Weak source"}],
    }

    with pytest.raises(ValueError, match="usable source-packet-v1"):
        generate_active_course_batch(snapshot, source_packet=bad_packet, module_count=2)

    assert snapshot.structure == before_structure
    assert snapshot.generation_trace == before_trace
