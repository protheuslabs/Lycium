from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.course_generation_status import course_generation_workflow_status
from app.models import Job


def _generation_readiness_from_job_result(result: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any] | None:
    trace = result.get("trace") if isinstance(result.get("trace"), dict) else {}
    readiness = trace.get("generation_readiness")
    if isinstance(readiness, dict):
        return readiness
    request = result.get("request") if isinstance(result.get("request"), dict) else payload
    readiness = request.get("generation_readiness") if isinstance(request, dict) else None
    if isinstance(readiness, dict):
        return readiness
    course = result.get("course")
    metadata = course.get("metadata") if isinstance(course, dict) and isinstance(course.get("metadata"), dict) else {}
    readiness = metadata.get("generationReadiness") if isinstance(metadata, dict) else None
    return readiness if isinstance(readiness, dict) else None


def _non_empty_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _working_title_from_job_result(result: dict[str, Any]) -> str | None:
    course = result.get("course")
    if isinstance(course, dict):
        title = _non_empty_text(course.get("title"))
        if title:
            return title

    snapshot = result.get("course_snapshot")
    if isinstance(snapshot, dict):
        title = _non_empty_text(snapshot.get("title"))
        if title:
            return title

    trace = result.get("trace")
    if isinstance(trace, dict):
        plan = trace.get("plan")
        if isinstance(plan, dict):
            title = _non_empty_text(plan.get("title"))
            if title:
                return title

    return None


def human_readable_generation_error(error: Any) -> str | None:
    text = str(error or "").strip()
    if not text:
        return None
    lowered = text.lower()

    if any(marker in lowered for marker in ("402", "payment required", "extra usage", "balance is empty", "insufficient_quota")):
        return "The selected model needs extra credits or billing before it can generate this course. Choose another model or add credits, then try again."
    if any(marker in lowered for marker in ("401", "403", "unauthorized", "forbidden", "api key", "invalid key", "authentication")):
        return "The provider rejected the saved credentials. Check the API key or account connection in Settings, then try again."
    if any(marker in lowered for marker in ("model is not available", "model_not_found", "unknown model", "currently unavailable")):
        return "The selected model is not available for this provider right now. Choose another model in Settings, then try again."
    if any(marker in lowered for marker in ("rate limit", "429", "too many requests")):
        return "The provider is rate limiting requests right now. Wait a bit, then try again."
    if any(marker in lowered for marker in ("timed out", "timeout")):
        return "The provider took too long to respond. Try again, or switch to a faster model in Settings."
    if any(marker in lowered for marker in ("not found on path", "bridge could not be started", "bridge command was not found")):
        return "Lycium could not start the local AI runtime. Check the bridge command in Settings, then try again."
    if any(marker in lowered for marker in ("valid json", "json object", "usable text content")):
        return "The model responded in a format Lycium could not use. Try again, or switch to a stronger model."
    if "llm api" in lowered or "provider" in lowered or "bridge generation failed" in lowered:
        return "The selected AI provider stopped before the course was finished. Try again, or choose another model in Settings."

    return "Course generation stopped before the course was finished. Try again from the saved request."


def failed_experiment_response(payload: Any, exc: Any) -> dict[str, Any]:
    trace = getattr(exc, "trace", {}) or {}
    partial_course = trace.get("partial_course")
    course = partial_course if isinstance(partial_course, dict) else {
        "title": "Failed course generation",
        "shortDescription": "Course generation did not complete.",
        "difficultyLevel": payload.level or "undergrad",
        "category": "interdisciplinary-studies",
        "tags": [],
        "learningTypes": [],
        "orderMandatory": False,
        "sourceIds": [],
        "sourceRecords": [],
        "metadata": {
            "pacingLabel": "Module",
            "generationPlan": {"status": ["failed_generation"], "mode": trace.get("mode") or "llm-agent"},
        },
        "modules": [],
    }
    quality_report = {
        "gate": "generation",
        "passed": False,
        "score": 0.0,
        "errors": [str(exc)],
        "warnings": ["The provider failed before Lycium could complete a quality evaluation."],
        "metrics": {
            "provider_failure": 1,
            "completed_module_count": len(course.get("modules") or []),
        },
        "evals": None,
        "workflow": {"status": "failed", "failedGate": "llm_generation"},
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "contractVersion": "COURSE_AGENT_CONTRACT.md",
    }
    safe_trace = {key: value for key, value in trace.items() if key != "partial_course"}
    return {
        "accepted": False,
        "course": course,
        "quality_report": quality_report,
        "trace": {**safe_trace, "status": "failed", "error": str(exc), "quality_report": quality_report},
    }


def course_generation_job_response(job: Job) -> dict[str, Any]:
    result = job.result or {}
    payload = job.payload or {}
    status_map = {"pending": "queued", "running": "running", "completed": "ready", "failed": "failed"}
    current_stage = result.get("current_stage") or ("queued" if job.status == "pending" else None)
    progress = result.get("progress") or (1.0 if job.status == "completed" else 0.0)
    user_error = human_readable_generation_error(job.error if job.status == "failed" else None)
    workflow_status = result.get("workflow_status")
    if not isinstance(workflow_status, dict):
        workflow_status = course_generation_workflow_status(
            stage=current_stage,
            progress=progress,
            trace=result.get("trace") if isinstance(result.get("trace"), dict) else None,
        )
    return {
        "id": job.id,
        "status": status_map.get(job.status, "failed"),
        "request": result.get("request") or payload,
        "progress": progress,
        "current_stage": current_stage,
        "message": user_error if job.status == "failed" and user_error else result.get("message") or workflow_status.get("message"),
        "workflow_status": workflow_status,
        "working_title": _working_title_from_job_result(result),
        "course": result.get("course"),
        "quality_report": result.get("quality_report"),
        "generation_readiness": _generation_readiness_from_job_result(result, payload),
        "trace": result.get("trace") or {},
        "course_snapshot": result.get("course_snapshot"),
        "error": job.error,
        "user_error": user_error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }
