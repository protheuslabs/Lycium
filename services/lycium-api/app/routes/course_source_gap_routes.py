from __future__ import annotations

from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from app.course_build_task_resume import apply_course_build_resume_inputs
from app.course_generation_readiness import build_generation_readiness_report
from app.course_generation_job_helpers import source_gap_job_result
from app.course_source_gaps import (
    SOURCE_COVERAGE_POLICY,
    source_urls_from_needs_sources_snapshot,
    update_needs_sources_course_snapshot,
)
from app.course_source_gap_resume import (
    concept_source_needs_meet_resume_policy,
    summarize_concept_source_need_coverage,
    source_gate_from_needs_sources_snapshot,
    source_urls_from_source_packet,
)
from app.db import get_session
from app.jobs import enqueue_job, run_agent_course_generation_queue
from app.local_store import require_verified_active_agent_profile, save_course_snapshot
from app.models import CourseDraft, CourseSnapshot
from app.routes.course_generation_responses import course_generation_job_response
from app.schemas import CourseGenerationJobRead, CourseSourceGapResumeRequest
from app.source_input_artifacts import source_documents_from_input_artifacts, usable_input_artifact_count


def _snapshot_generation_payload(
    snapshot: CourseSnapshot,
    draft: CourseDraft | None,
    payload: CourseSourceGapResumeRequest,
    source_urls: list[str],
    model: str | None,
    source_packet: dict[str, Any] | None = None,
) -> dict[str, Any]:
    constraints = draft.constraints if draft and isinstance(draft.constraints, dict) else {}
    structure = snapshot.structure if isinstance(snapshot.structure, dict) else {}
    generation_trace = snapshot.generation_trace if isinstance(snapshot.generation_trace, dict) else None
    effective_source_packet = source_packet if source_packet is not None else payload.source_packet
    generation_readiness = build_generation_readiness_report(
        source_urls=_resume_source_evidence_urls(source_urls, payload),
        input_artifacts=payload.input_artifacts,
        source_packet=effective_source_packet,
        source_documents=source_documents_from_input_artifacts(payload.input_artifacts),
    )
    return {
        "prompt": snapshot.prompt,
        "learner_id": snapshot.learner_id,
        "level": snapshot.level,
        "language": snapshot.language,
        "model": model,
        "source_policy": snapshot.source_policy,
        "free_only": bool(constraints.get("free_only", False)),
        "trust_min": float(constraints.get("trust_min") or 0.0),
        "category": structure.get("category"),
        "department": structure.get("department"),
        "desired_module_count": int(constraints.get("desired_module_count") or 3),
        "expected_duration_minutes": draft.expected_duration_minutes if draft else 180,
        "source_urls": source_urls,
        "source_packet_id": payload.source_packet_id,
        "source_packet": effective_source_packet,
        "input_artifacts": payload.input_artifacts,
        "generation_readiness": generation_readiness,
        "resume_course": structure,
        "resume_trace": generation_trace,
    }


def _merged_source_urls(snapshot: CourseSnapshot, payload: CourseSourceGapResumeRequest) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for source_url in [
        *source_urls_from_needs_sources_snapshot(snapshot),
        *[str(url) for url in payload.source_urls],
        *source_urls_from_source_packet(payload.source_packet),
    ]:
        if source_url in seen:
            continue
        seen.add(source_url)
        merged.append(source_url)
    return merged


def _resume_source_evidence_urls(source_urls: list[str], payload: CourseSourceGapResumeRequest) -> list[str]:
    artifact_count = usable_input_artifact_count(payload.input_artifacts)
    artifact_urls = [f"input-artifact://{index}" for index in range(artifact_count)]
    return [*source_urls, *artifact_urls]


def _concept_source_needs(snapshot: CourseSnapshot) -> list[dict[str, Any]]:
    structure = snapshot.structure if isinstance(snapshot.structure, dict) else {}
    metadata = structure.get("metadata") if isinstance(structure.get("metadata"), dict) else {}
    gaps = metadata.get("sourceGaps")
    first_gap = gaps[0] if isinstance(gaps, list) and gaps and isinstance(gaps[0], dict) else {}
    needs = first_gap.get("conceptSourceNeeds")
    return [need for need in needs if isinstance(need, dict)] if isinstance(needs, list) else []


def _resume_source_packet(
    payload: CourseSourceGapResumeRequest,
    coverage_summary: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    artifact_documents = source_documents_from_input_artifacts(payload.input_artifacts)
    if not artifact_documents:
        return payload.source_packet
    source_packet = dict(payload.source_packet or {})
    source_packet.setdefault("contract_version", "source-packet-v1")
    source_documents = source_packet.get("source_documents") if isinstance(source_packet.get("source_documents"), list) else []
    source_packet["source_documents"] = [*source_documents, *artifact_documents]
    if coverage_summary and not isinstance(source_packet.get("quality"), dict):
        ratio = float(coverage_summary.get("coveragePercent") or 0) / 100
        uncovered = coverage_summary.get("uncoveredConcepts")
        uncovered_concepts = [str(concept) for concept in uncovered if str(concept).strip()] if isinstance(uncovered, list) else []
        source_packet["quality"] = {
            "status": "usable" if ratio >= float(SOURCE_COVERAGE_POLICY["minimumRequiredConceptCoveragePercent"]) / 100 and not uncovered_concepts else "needs_review",
            "conceptCoverageRatio": ratio,
            "conceptCandidateCount": int(coverage_summary.get("requiredConceptCount") or 0),
            "coveredConceptCandidateCount": int(coverage_summary.get("coveredConceptCount") or 0),
            "uncoveredConceptCandidates": uncovered_concepts,
        }
    return source_packet


def register(app: FastAPI) -> None:
    @app.post("/v1/courses/{course_id}/source-gaps/resume", response_model=CourseGenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
    def resume_course_from_source_gaps(
        course_id: int,
        payload: CourseSourceGapResumeRequest,
        background_tasks: BackgroundTasks,
        session: Session = Depends(get_session),
    ) -> dict[str, Any]:
        snapshot = session.get(CourseSnapshot, course_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Course snapshot not found.")
        if snapshot.status != "needs_sources":
            raise HTTPException(status_code=400, detail="Only needs_sources course drafts can resume from source gaps.")

        draft = session.get(CourseDraft, snapshot.draft_id) if snapshot.draft_id else None
        merged_source_urls = _merged_source_urls(snapshot, payload)
        resume_source_packet = _resume_source_packet(payload)
        coverage_summary = summarize_concept_source_need_coverage(
            _concept_source_needs(snapshot),
            merged_source_urls,
            resume_source_packet,
        )
        resume_source_packet = _resume_source_packet(payload, coverage_summary)
        concept_coverage_ready = concept_source_needs_meet_resume_policy(
            snapshot,
            merged_source_urls,
            minimum_coverage_percent=int(SOURCE_COVERAGE_POLICY["minimumRequiredConceptCoveragePercent"]),
            source_packet=resume_source_packet,
        )
        resume_readiness = build_generation_readiness_report(
            source_urls=_resume_source_evidence_urls(merged_source_urls, payload),
            input_artifacts=payload.input_artifacts,
            source_packet=resume_source_packet,
            source_documents=source_documents_from_input_artifacts(payload.input_artifacts),
        )
        if not bool(resume_readiness.get("ready")) or not concept_coverage_ready:
            update_needs_sources_course_snapshot(
                snapshot,
                source_urls=merged_source_urls,
                source_gate=resume_readiness.get("sourceGate") or source_gate_from_needs_sources_snapshot(snapshot),
                source_packet=resume_source_packet,
                generation_readiness=resume_readiness,
                session=session,
            )
            save_course_snapshot(snapshot)
            job = enqueue_job(
                session,
                job_type="agent_generate_course_staged",
                payload=_snapshot_generation_payload(snapshot, draft, payload, merged_source_urls, payload.model, resume_source_packet),
            )
            source_gap_job_result(session, job, snapshot)
            session.commit()
            session.refresh(job)
            return course_generation_job_response(job)

        try:
            agent_profile = require_verified_active_agent_profile()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if resume_source_packet:
            constraints = draft.constraints if draft and isinstance(draft.constraints, dict) else {}
            snapshot.structure = apply_course_build_resume_inputs(
                snapshot.structure if isinstance(snapshot.structure, dict) else {},
                prompt=snapshot.prompt,
                source_packet=resume_source_packet,
                desired_module_count=int(constraints.get("desired_module_count") or 4),
            )
            save_course_snapshot(snapshot)

        job_payload = _snapshot_generation_payload(
            snapshot,
            draft,
            payload,
            merged_source_urls,
            payload.model or agent_profile.get("model"),
            resume_source_packet,
        )
        fresh_readiness = job_payload.get("generation_readiness")
        if isinstance(fresh_readiness, dict):
            structure = dict(snapshot.structure if isinstance(snapshot.structure, dict) else {})
            metadata = dict(structure.get("metadata") if isinstance(structure.get("metadata"), dict) else {})
            metadata["generationReadiness"] = fresh_readiness
            structure["metadata"] = metadata
            snapshot.structure = structure
            snapshot.generation_trace = {
                **(snapshot.generation_trace if isinstance(snapshot.generation_trace, dict) else {}),
                "generation_readiness": fresh_readiness,
            }
            job_payload["resume_course"] = structure
            job_payload["resume_trace"] = snapshot.generation_trace
            save_course_snapshot(snapshot)

        job = enqueue_job(
            session,
            job_type="agent_generate_course_staged",
            payload=job_payload,
        )
        session.commit()
        session.refresh(job)
        background_tasks.add_task(run_agent_course_generation_queue)
        return course_generation_job_response(job)
