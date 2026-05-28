from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models import Job


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
    status_map = {"pending": "queued", "running": "running", "completed": "ready", "failed": "failed"}
    return {
        "id": job.id,
        "status": status_map.get(job.status, "failed"),
        "request": result.get("request") or job.payload or {},
        "progress": result.get("progress") or (1.0 if job.status == "completed" else 0.0),
        "current_stage": result.get("current_stage"),
        "message": result.get("message"),
        "course": result.get("course"),
        "quality_report": result.get("quality_report"),
        "trace": result.get("trace") or {},
        "course_snapshot": result.get("course_snapshot"),
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }
