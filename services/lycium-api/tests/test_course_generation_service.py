from __future__ import annotations

from app import db
from app.course_agent_types import CourseAgentResult
from app.course_generation_service import build_course_snapshot_from_agent_result


def test_agent_snapshot_preserves_positive_generation_readiness() -> None:
    readiness = {
        "contractVersion": "course-generation-readiness-v1",
        "status": "ready",
        "ready": True,
        "sourceEvidence": {"sourceUrlCount": 3, "usableInputArtifactCount": 0, "submittedEvidenceCount": 3, "minimumCourseSources": 3},
        "conceptCoverage": {"status": "ready", "coverageRatio": 1, "minimumCoverageRatio": 0.7, "requiredConceptCount": 3, "coveredConceptCount": 3, "uncoveredConcepts": []},
        "issues": [],
    }
    generated = CourseAgentResult(
        course={
            "title": "Readiness Preserved Course",
            "shortDescription": "A generated course for readiness preservation.",
            "metadata": {},
            "sourceRecords": [],
            "modules": [],
        },
        trace={"mode": "test-agent"},
    )

    with db.SessionLocal() as session:
        snapshot = build_course_snapshot_from_agent_result(
            session,
            learner_id=None,
            prompt="Create a readiness-preserved course",
            language="en",
            level="undergrad",
            source_policy="balanced",
            generated=generated,
            quality_report={"passed": True, "score": 1, "errors": [], "warnings": []},
            generation_readiness=readiness,
        )
        structure = snapshot.structure
        generation_trace = snapshot.generation_trace
        session.commit()

    assert structure["metadata"]["generationReadiness"] == readiness
    assert generation_trace["generation_readiness"] == readiness


def test_agent_snapshot_prefers_generated_readiness_over_stale_request_readiness() -> None:
    generated_readiness = {
        "contractVersion": "course-generation-readiness-v1",
        "status": "ready",
        "ready": True,
        "sourceEvidence": {"submittedEvidenceCount": 3, "minimumCourseSources": 3},
        "conceptCoverage": {"status": "ready", "coverageRatio": 1, "uncoveredConcepts": []},
        "issues": [],
    }
    stale_request_readiness = {
        "contractVersion": "course-generation-readiness-v1",
        "status": "needs_sources",
        "ready": False,
        "sourceEvidence": {"submittedEvidenceCount": 1, "minimumCourseSources": 3},
        "conceptCoverage": {"status": "needs_sources", "coverageRatio": 0.4, "uncoveredConcepts": ["stoichiometry"]},
        "issues": [{"code": "minimum_source_evidence", "message": "Add more sources."}],
    }
    generated = CourseAgentResult(
        course={
            "title": "Generated Ready Course",
            "shortDescription": "A generated course with newer readiness evidence.",
            "metadata": {"generationReadiness": generated_readiness},
            "sourceRecords": [],
            "modules": [],
        },
        trace={"mode": "test-agent", "generation_readiness": generated_readiness},
    )

    with db.SessionLocal() as session:
        snapshot = build_course_snapshot_from_agent_result(
            session,
            learner_id=None,
            prompt="Create a generated ready course",
            language="en",
            level="undergrad",
            source_policy="balanced",
            generated=generated,
            quality_report={"passed": True, "score": 1, "errors": [], "warnings": []},
            generation_readiness=stale_request_readiness,
        )
        structure = snapshot.structure
        generation_trace = snapshot.generation_trace
        session.commit()

    assert structure["metadata"]["generationReadiness"] == generated_readiness
    assert generation_trace["generation_readiness"] == generated_readiness
