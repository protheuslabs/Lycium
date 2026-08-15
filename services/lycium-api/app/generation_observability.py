from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import GenerationRun, GenerationRunEvent, Job, utcnow
from app.security import redact_sensitive_payload
from app.local_store_generation_runs import write_generation_run_record
from app.generation_readiness_summary import generation_readiness_summary


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_trace(trace: Any) -> dict[str, Any]:
    payload = dict(trace) if isinstance(trace, dict) else {}
    payload.pop("partial_course", None)
    return payload


def _stage_count(trace: dict[str, Any]) -> int:
    stages = trace.get("stages")
    return len(stages) if isinstance(stages, list) else 0


def _event_payload(*, progress: float | None = None, trace: dict[str, Any] | None = None, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if progress is not None:
        payload["progress"] = round(progress, 4)
    if trace is not None:
        payload["stageCount"] = _stage_count(trace)
    if extra:
        payload.update(extra)
    return payload


def _input_summary(payload: dict[str, Any]) -> dict[str, Any]:
    source_urls = payload.get("source_urls")
    input_artifacts = payload.get("input_artifacts")
    artifacts = [artifact for artifact in input_artifacts if isinstance(artifact, dict)] if isinstance(input_artifacts, list) else []
    usable_artifacts = [
        artifact
        for artifact in artifacts
        if str(artifact.get("text") or artifact.get("extractedText") or "").strip()
    ]
    source_url_count = len(source_urls) if isinstance(source_urls, list) else 0
    artifact_count = len(artifacts)
    source_packet = payload.get("source_packet") if isinstance(payload.get("source_packet"), dict) else {}
    raw_source_documents = source_packet.get("source_documents") if isinstance(source_packet.get("source_documents"), list) else []
    source_documents = [source_document for source_document in raw_source_documents if isinstance(source_document, dict)]
    source_packet_input_artifact_documents = [
        source_document
        for source_document in source_documents
        if str(source_document.get("inputArtifactId") or source_document.get("input_artifact_id") or "").strip()
    ]
    is_resume = isinstance(payload.get("resume_course"), dict)
    return {
        "promptLength": len(str(payload.get("prompt") or "")),
        "level": payload.get("level"),
        "language": payload.get("language"),
        "sourcePolicy": payload.get("source_policy"),
        "sourceUrlCount": source_url_count,
        "inputArtifactCount": artifact_count,
        "usableInputArtifactCount": len(usable_artifacts),
        "submittedEvidenceCount": source_url_count + artifact_count,
        "isResume": is_resume,
        "hasResumeTrace": isinstance(payload.get("resume_trace"), dict),
        "sourcePacketDocumentCount": len(source_documents),
        "sourcePacketInputArtifactDocumentCount": len(source_packet_input_artifact_documents),
        "sourceGapResumeFileBacked": is_resume and bool(usable_artifacts or source_packet_input_artifact_documents),
        "inputArtifactFilenames": [
            str(artifact.get("filename") or artifact.get("title") or artifact.get("id"))
            for artifact in artifacts[:8]
            if str(artifact.get("filename") or artifact.get("title") or artifact.get("id") or "").strip()
        ],
        "sourcePacketId": payload.get("source_packet_id"),
        "desiredModuleCount": payload.get("desired_module_count"),
        "expectedDurationMinutes": payload.get("expected_duration_minutes"),
    }


def _source_corpus_summary(trace: dict[str, Any]) -> dict[str, Any]:
    candidates = (
        trace.get("source_corpus_preflight"),
        trace.get("sourceCorpusPreflight"),
        trace.get("source_corpus_synthesis"),
        trace.get("sourceCorpusSynthesis"),
        trace.get("source_corpus"),
        trace.get("sourceCorpus"),
    )
    preflight = next((candidate for candidate in candidates if isinstance(candidate, dict)), {})
    metrics = preflight.get("metrics") if isinstance(preflight.get("metrics"), dict) else {}
    included = preflight.get("includedSources") or preflight.get("included") or preflight.get("acceptedSources") or []
    excluded = preflight.get("excludedSources") or preflight.get("excluded") or preflight.get("rejectedSources") or []
    failures = preflight.get("fetchFailures") or preflight.get("fetch_failures") or preflight.get("failures") or []
    themes = preflight.get("commonThemes") or preflight.get("common_themes") or preflight.get("themes") or []
    return {
        "submittedSourceCount": metrics.get("submittedSourceCount"),
        "submittedInputArtifactCount": metrics.get("submittedInputArtifactCount"),
        "usableInputArtifactCount": metrics.get("usableInputArtifactCount"),
        "includedInputArtifactCount": metrics.get("includedInputArtifactCount"),
        "includedSourceCount": metrics.get("includedSourceCount") or (len(included) if isinstance(included, list) else 0),
        "excludedSourceCount": metrics.get("excludedSourceCount") or (len(excluded) if isinstance(excluded, list) else 0),
        "fetchFailureCount": metrics.get("fetchFailureCount") or (len(failures) if isinstance(failures, list) else 0),
        "commonThemes": themes[:8] if isinstance(themes, list) else [],
    }


def _quality_gate_summary(quality_report: dict[str, Any], trace: dict[str, Any]) -> dict[str, Any]:
    gates = quality_report.get("gates")
    if not isinstance(gates, list):
        trace_quality = trace.get("quality_report")
        gates = trace_quality.get("gates") if isinstance(trace_quality, dict) else []
    if not isinstance(gates, list):
        gates = []
    passed = [
        str(gate.get("gate") or gate.get("name"))
        for gate in gates
        if isinstance(gate, dict) and str(gate.get("status") or "").lower() in {"passed", "pass", "ok"}
    ]
    failed = [
        str(gate.get("gate") or gate.get("name"))
        for gate in gates
        if isinstance(gate, dict) and str(gate.get("status") or "").lower() in {"failed", "fail", "blocked"}
    ]
    return {
        "passedGateCount": len([gate for gate in passed if gate]),
        "failedGateCount": len([gate for gate in failed if gate]),
        "passedGates": [gate for gate in passed if gate],
        "failedGates": [gate for gate in failed if gate],
    }


def _usage_summary(trace: dict[str, Any]) -> dict[str, Any]:
    usage = trace.get("usage") or trace.get("token_usage") or trace.get("tokenUsage") or {}
    costs = trace.get("cost") or trace.get("costs") or trace.get("costEstimate") or {}
    return {
        "promptTokens": usage.get("prompt_tokens") or usage.get("promptTokens") if isinstance(usage, dict) else None,
        "completionTokens": usage.get("completion_tokens") or usage.get("completionTokens") if isinstance(usage, dict) else None,
        "totalTokens": usage.get("total_tokens") or usage.get("totalTokens") if isinstance(usage, dict) else None,
        "estimatedCostUsd": costs.get("estimated_cost_usd") or costs.get("estimatedCostUsd") if isinstance(costs, dict) else None,
    }


def _course_build_task_summary(task: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(task, dict):
        return {}
    summary = {
        "contractVersion": task.get("contractVersion"),
        "courseId": task.get("courseId"),
        "status": task.get("status"),
        "currentStage": task.get("currentStage"),
        "nextAction": task.get("nextAction"),
        "transitionStatus": task.get("transitionStatus"),
        "transitionReason": task.get("transitionReason"),
        "requiredInputs": task.get("requiredInputs") if isinstance(task.get("requiredInputs"), list) else [],
        "prerequisiteCourseIds": task.get("prerequisiteCourseIds") if isinstance(task.get("prerequisiteCourseIds"), list) else [],
    }
    source_packet = task.get("sourcePacketEvidence")
    if isinstance(source_packet, dict):
        summary["sourcePacketEvidence"] = {
            "qualityStatus": source_packet.get("qualityStatus"),
            "conceptCoverageRatio": source_packet.get("conceptCoverageRatio"),
            "minimumConceptCoverageRatio": source_packet.get("minimumConceptCoverageRatio"),
        }
    transition_report = task.get("sourcePacketTransitionReport")
    if isinstance(transition_report, dict):
        metrics = transition_report.get("metrics") if isinstance(transition_report.get("metrics"), dict) else {}
        summary["sourcePacketTransitionReport"] = {
            "status": transition_report.get("status"),
            "passed": transition_report.get("passed"),
            "nextStage": transition_report.get("nextStage"),
            "nextAction": transition_report.get("nextAction"),
            "reasonCount": len(transition_report.get("reasons") or []) if isinstance(transition_report.get("reasons"), list) else 0,
            "conceptCoverageRatio": metrics.get("conceptCoverageRatio"),
        }
    outline = task.get("outlineReadiness")
    if isinstance(outline, dict):
        metrics = outline.get("metrics") if isinstance(outline.get("metrics"), dict) else {}
        summary["outlineReadiness"] = {
            "passed": outline.get("passed"),
            "moduleCount": metrics.get("moduleCount"),
            "sectionCount": metrics.get("sectionCount"),
        }
    outline_transition = task.get("outlineTransitionReport")
    if isinstance(outline_transition, dict):
        metrics = outline_transition.get("metrics") if isinstance(outline_transition.get("metrics"), dict) else {}
        summary["outlineTransitionReport"] = {
            "status": outline_transition.get("status"),
            "passed": outline_transition.get("passed"),
            "nextStage": outline_transition.get("nextStage"),
            "nextAction": outline_transition.get("nextAction"),
            "reasonCount": len(outline_transition.get("reasons") or []) if isinstance(outline_transition.get("reasons"), list) else 0,
            "moduleCount": metrics.get("moduleCount"),
            "sectionCount": metrics.get("sectionCount"),
        }
    review = task.get("reviewReadiness")
    if isinstance(review, dict):
        metrics = review.get("metrics") if isinstance(review.get("metrics"), dict) else {}
        summary["reviewReadiness"] = {
            "passed": review.get("passed"),
            "qualityPassed": metrics.get("qualityPassed"),
            "failedGateCount": metrics.get("failedGateCount"),
            "score": metrics.get("score"),
        }
    review_transition = task.get("reviewTransitionReport")
    if isinstance(review_transition, dict):
        metrics = review_transition.get("metrics") if isinstance(review_transition.get("metrics"), dict) else {}
        summary["reviewTransitionReport"] = {
            "status": review_transition.get("status"),
            "passed": review_transition.get("passed"),
            "nextStage": review_transition.get("nextStage"),
            "nextAction": review_transition.get("nextAction"),
            "reasonCount": len(review_transition.get("reasons") or []) if isinstance(review_transition.get("reasons"), list) else 0,
            "failedGateCount": metrics.get("failedGateCount"),
            "failedEvalCount": metrics.get("failedEvalCount"),
            "score": metrics.get("score"),
        }
    return {key: value for key, value in summary.items() if value not in (None, "")}


def _event_read(event: GenerationRunEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "generation_run_id": event.generation_run_id,
        "event_type": event.event_type,
        "stage": event.stage,
        "status": event.status,
        "message": event.message,
        "payload": event.payload,
        "created_at": event.created_at,
    }


def generation_run_payload(run: GenerationRun) -> dict[str, Any]:
    return {
        "id": run.id,
        "job_id": run.job_id,
        "course_snapshot_id": run.course_snapshot_id,
        "run_type": run.run_type,
        "status": run.status,
        "prompt": run.prompt,
        "provider_id": run.provider_id,
        "model": run.model,
        "progress": run.progress,
        "current_stage": run.current_stage,
        "message": run.message,
        "request_payload": run.request_payload,
        "result_summary": run.result_summary,
        "trace": run.trace,
        "events": [_event_read(event) for event in run.events],
        "created_at": run.created_at,
        "updated_at": run.updated_at,
        "completed_at": run.completed_at,
    }


def mirror_generation_run(run: GenerationRun) -> None:
    write_generation_run_record(generation_run_payload(run))


def add_generation_run_event(
    session: Session,
    run: GenerationRun,
    *,
    event_type: str,
    stage: str | None = None,
    status: str | None = None,
    message: str | None = None,
    payload: dict[str, Any] | None = None,
) -> GenerationRunEvent:
    event = GenerationRunEvent(
        generation_run_id=run.id,
        event_type=event_type,
        stage=stage,
        status=status,
        message=message,
        payload=payload or {},
    )
    session.add(event)
    session.flush()
    return event


def generation_run_for_job(session: Session, job_id: int) -> GenerationRun | None:
    return session.scalar(
        select(GenerationRun)
        .where(GenerationRun.job_id == job_id)
        .options(selectinload(GenerationRun.events))
        .limit(1)
    )


def start_generation_run(session: Session, job: Job, *, message: str, progress: float = 0.0) -> GenerationRun:
    existing = generation_run_for_job(session, job.id)
    if existing:
        return existing

    payload = _as_dict(job.payload)
    run = GenerationRun(
        job_id=job.id,
        run_type=job.job_type,
        status="running",
        prompt=str(payload.get("prompt") or ""),
        provider_id=str(payload.get("provider_id") or "") or None,
        model=str(payload.get("model") or "") or None,
        progress=progress,
        current_stage="course_plan",
        message=message,
        request_payload=redact_sensitive_payload(payload),
        result_summary={},
        trace={"mode": "staged-llm-agent", "stages": []},
    )
    session.add(run)
    session.flush()
    add_generation_run_event(
        session,
        run,
        event_type="run_started",
        stage="course_plan",
        status="running",
        message=message,
        payload=redact_sensitive_payload(
            _event_payload(
                progress=progress,
                extra={
                    "inputs": _input_summary(payload),
                    "providerId": run.provider_id,
                    "model": run.model,
                },
            )
        ),
    )
    mirror_generation_run(run)
    return run


def record_generation_run_checkpoint(job_id: int, update: dict[str, Any], *, session_factory) -> None:
    with session_factory() as session:
        run = generation_run_for_job(session, job_id)
        if run is None:
            return
        trace = _safe_trace(update.get("trace"))
        progress = float(update.get("progress") or run.progress or 0.0)
        current_stage = str(update.get("current_stage") or run.current_stage or "course_plan")
        message = str(update.get("message") or "")
        run.status = "running"
        run.progress = progress
        run.current_stage = current_stage
        run.message = message
        run.trace = trace
        add_generation_run_event(
            session,
            run,
            event_type="stage_checkpoint",
            stage=current_stage,
            status="running",
            message=message,
            payload=redact_sensitive_payload(_event_payload(progress=progress, trace=trace)),
        )
        mirror_generation_run(run)
        session.commit()


def complete_generation_run(
    session: Session,
    *,
    job_id: int,
    accepted: bool,
    message: str,
    trace: dict[str, Any],
    quality_report: dict[str, Any],
    course_snapshot_id: int | None = None,
    course_build_task: dict[str, Any] | None = None,
    current_stage: str | None = None,
) -> None:
    run = generation_run_for_job(session, job_id)
    if run is None:
        return
    run.status = "completed" if accepted else "failed"
    run.progress = 1.0
    run.current_stage = current_stage or ("ready_for_review" if accepted else "quality_eval")
    run.message = message
    run.course_snapshot_id = course_snapshot_id
    run.trace = _safe_trace(trace)
    usage_summary = _usage_summary(run.trace)
    build_task_summary = _course_build_task_summary(course_build_task)
    readiness_summary = generation_readiness_summary(run.trace)
    run.result_summary = {
        "accepted": accepted,
        "providerId": run.provider_id,
        "model": run.model,
        "inputs": _input_summary(_as_dict(run.request_payload)),
        "sourceCorpus": _source_corpus_summary(run.trace),
        "generationReadiness": readiness_summary,
        "gateSummary": _quality_gate_summary(quality_report, run.trace),
        "usage": {key: value for key, value in usage_summary.items() if value is not None},
        "qualityScore": quality_report.get("score"),
        "qualityPassed": quality_report.get("passed"),
        "errorCount": len(quality_report.get("errors") or []),
        "warningCount": len(quality_report.get("warnings") or []),
    }
    if build_task_summary:
        run.result_summary["courseBuildTask"] = build_task_summary
    run.completed_at = utcnow()
    if build_task_summary:
        add_generation_run_event(
            session,
            run,
            event_type="course_build_task_transition",
            stage=str(build_task_summary.get("currentStage") or build_task_summary.get("status") or run.current_stage),
            status=str(build_task_summary.get("transitionStatus") or run.status),
            message=str(build_task_summary.get("transitionReason") or "Course build task state recorded."),
            payload=redact_sensitive_payload({"courseBuildTask": build_task_summary}),
        )
    add_generation_run_event(
        session,
        run,
        event_type="run_completed" if accepted else "run_failed_quality_gate",
        stage=run.current_stage,
        status=run.status,
        message=message,
        payload=redact_sensitive_payload(_event_payload(progress=1.0, trace=run.trace, extra=run.result_summary)),
    )
    mirror_generation_run(run)


def fail_generation_run(job_id: int, *, error: str, result: dict[str, Any], session_factory) -> None:
    with session_factory() as session:
        run = generation_run_for_job(session, job_id)
        if run is None:
            return
        trace = _safe_trace(result.get("trace"))
        progress = float(result.get("progress") or run.progress or 0.0)
        run.status = "failed"
        run.progress = progress
        run.current_stage = result.get("current_stage") or "failed"
        run.message = result.get("message") or "Course generation failed."
        run.trace = trace
        run.result_summary = {"accepted": False, "error": error}
        run.completed_at = utcnow()
        add_generation_run_event(
            session,
            run,
            event_type="run_failed",
            stage=run.current_stage,
            status="failed",
            message=error,
            payload=redact_sensitive_payload(_event_payload(progress=progress, trace=trace, extra={"error": error})),
        )
        mirror_generation_run(run)
        session.commit()


def list_generation_runs(session: Session, *, status: str | None = None, limit: int = 50) -> list[GenerationRun]:
    stmt = (
        select(GenerationRun)
        .options(selectinload(GenerationRun.events))
        .order_by(GenerationRun.created_at.desc(), GenerationRun.id.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(GenerationRun.status == status)
    return list(session.scalars(stmt))


def get_generation_run(session: Session, run_id: int) -> GenerationRun | None:
    return session.scalar(
        select(GenerationRun)
        .where(GenerationRun.id == run_id)
        .options(selectinload(GenerationRun.events))
        .limit(1)
    )
