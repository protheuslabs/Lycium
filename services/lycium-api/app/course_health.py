from __future__ import annotations

from typing import Any, Literal

from app.course_source_integrity import assess_course_source_integrity


CourseHealthStatus = Literal["unknown", "healthy", "watch", "needs_review"]
COURSE_HEALTH_CONTRACT_VERSION = "course-health-v1"
STATUS_RANK: dict[str, int] = {"unknown": 0, "healthy": 1, "watch": 2, "needs_review": 3}


def _status_max(*statuses: CourseHealthStatus) -> CourseHealthStatus:
    return max(statuses, key=lambda status: STATUS_RANK[status])


def _feedback_metrics(feedback: dict[str, Any] | None) -> dict[str, Any]:
    feedback = feedback if isinstance(feedback, dict) else {}
    rating_events = [event for event in feedback.get("rating_events", []) if isinstance(event, dict)]
    feedback_notes = [note for note in feedback.get("feedback_notes", []) if isinstance(note, dict)]
    source_suggestions = [source for source in feedback.get("source_suggestions", []) if isinstance(source, dict)]
    rating_counts = {"up": 0, "down": 0}
    for event in rating_events:
        rating = event.get("rating")
        if rating in rating_counts:
            rating_counts[rating] += 1
    magnitudes = [
        note.get("feedback_magnitude")
        for note in feedback_notes
        if isinstance(note.get("feedback_magnitude"), int) and note.get("feedback_magnitude") in {1, 2, 3}
    ]
    return {
        "latest_rating": feedback.get("rating") if feedback.get("rating") in {"up", "down"} else None,
        "rating_counts": rating_counts,
        "feedback_note_count": len(feedback_notes),
        "source_suggestion_count": len(source_suggestions),
        "average_feedback_magnitude": round(sum(magnitudes) / len(magnitudes), 2) if magnitudes else None,
        "updated_at": str(feedback.get("updated_at")) if feedback.get("updated_at") else None,
        "has_feedback": bool(rating_events or feedback_notes or source_suggestions),
    }


def _feedback_health(metrics: dict[str, Any]) -> tuple[CourseHealthStatus, int | None, list[str]]:
    rating_counts = metrics["rating_counts"]
    latest_rating = metrics["latest_rating"]
    source_suggestion_count = int(metrics["source_suggestion_count"])
    feedback_note_count = int(metrics["feedback_note_count"])
    average_magnitude = metrics["average_feedback_magnitude"]
    signals: list[str] = []
    if not metrics["has_feedback"]:
        return "unknown", None, ["No learner feedback has been recorded yet."]

    score = 72
    score += min(rating_counts["up"] * 4, 16)
    score -= min(rating_counts["down"] * 7, 28)
    score -= min(source_suggestion_count * 3, 12)
    if latest_rating == "up":
        score += 5
    elif latest_rating == "down":
        score -= 8
    if average_magnitude is not None:
        if latest_rating == "up":
            score += int(round((average_magnitude - 2) * 4))
        elif latest_rating == "down":
            score -= int(round(average_magnitude * 3))
    score = max(0, min(100, score))

    if rating_counts["down"] > rating_counts["up"] or score < 55:
        status: CourseHealthStatus = "needs_review"
        signals.append("Negative feedback is outweighing positive feedback.")
    elif source_suggestion_count or latest_rating == "down" or score < 72:
        status = "watch"
        signals.append("Learner feedback or source suggestions should be reviewed.")
    else:
        status = "healthy"
        signals.append("Feedback signals are currently positive.")
    if source_suggestion_count:
        signals.append(f"{source_suggestion_count} learner source suggestion(s) are waiting for review.")
    if feedback_note_count:
        signals.append(f"{feedback_note_count} written feedback note(s) are available.")
    return status, score, signals


def _artifact_health(
    *,
    course: dict[str, Any] | None,
    quality_report: dict[str, Any] | None,
    lifecycle_status: str | None,
) -> tuple[CourseHealthStatus, int | None, list[str], dict[str, Any]]:
    metrics: dict[str, Any] = {
        "lifecycle_status": lifecycle_status,
        "quality_score": None,
        "quality_passed": None,
        "quality_error_count": 0,
        "quality_warning_count": 0,
        "source_gap_count": 0,
        "missing_source_id_count": 0,
        "direct_concept_source_coverage_percent": None,
        "direct_block_source_coverage_percent": None,
    }
    signals: list[str] = []
    status: CourseHealthStatus = "unknown"
    score: int | None = None

    if lifecycle_status in {"needs_sources", "needs_revision", "failed"}:
        status = "needs_review"
        signals.append(f"Lifecycle status is {lifecycle_status}.")
    elif lifecycle_status in {"draft", "generated", "ready_for_review"}:
        status = "watch"
        signals.append(f"Lifecycle status is {lifecycle_status}; review is still expected.")
    elif lifecycle_status == "published":
        status = "healthy"

    if isinstance(course, dict):
        metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
        source_gaps = metadata.get("sourceGaps") if isinstance(metadata.get("sourceGaps"), list) else []
        metrics["source_gap_count"] = len(source_gaps)
        if source_gaps:
            status = _status_max(status, "needs_review")
            signals.append(f"{len(source_gaps)} source gap(s) are unresolved.")
        integrity = assess_course_source_integrity(course)
        integrity_metrics = integrity.get("metrics") if isinstance(integrity.get("metrics"), dict) else {}
        metrics["direct_concept_source_coverage_percent"] = integrity_metrics.get("directConceptSourceCoveragePercent")
        metrics["direct_block_source_coverage_percent"] = integrity_metrics.get("directBlockSourceCoveragePercent")
        missing_source_ids = [
            issue
            for issue in integrity.get("issues", [])
            if isinstance(issue, dict) and "missing" in str(issue.get("message") or "").lower()
        ]
        metrics["missing_source_id_count"] = len(missing_source_ids)
        if missing_source_ids:
            status = _status_max(status, "needs_review")
            signals.append("Course has unresolved or missing source references.")

    if isinstance(quality_report, dict):
        quality_score = quality_report.get("score") or quality_report.get("overallScore")
        metrics["quality_score"] = quality_score
        metrics["quality_passed"] = bool(quality_report.get("passed"))
        metrics["quality_error_count"] = len(quality_report.get("errors") or [])
        metrics["quality_warning_count"] = len(quality_report.get("warnings") or [])
        report_score = int(round(float(quality_score) * 100)) if isinstance(quality_score, int | float) else None
        score = report_score
        if quality_report.get("passed") is False or metrics["quality_error_count"]:
            status = _status_max(status, "needs_review")
            signals.append("Quality report has failing gates or errors.")
        elif metrics["quality_warning_count"] or (report_score is not None and report_score < 85):
            status = _status_max(status, "watch")
            signals.append("Quality report has warnings or a borderline score.")
        elif quality_report.get("passed") is True:
            status = _status_max(status, "healthy")
    return status, score, signals, metrics


def summarize_course_health(
    *,
    course_key: str,
    course_title: str | None = None,
    feedback: dict[str, Any] | None = None,
    course: dict[str, Any] | None = None,
    quality_report: dict[str, Any] | None = None,
    lifecycle_status: str | None = None,
) -> dict[str, Any]:
    feedback_metrics = _feedback_metrics(feedback)
    feedback_status, feedback_score, feedback_signals = _feedback_health(feedback_metrics)
    artifact_status, artifact_score, artifact_signals, artifact_metrics = _artifact_health(
        course=course,
        quality_report=quality_report,
        lifecycle_status=lifecycle_status,
    )
    scores = [score for score in (feedback_score, artifact_score) if isinstance(score, int)]
    return {
        "contract_version": COURSE_HEALTH_CONTRACT_VERSION,
        "course_key": course_key,
        "course_title": course_title or (feedback or {}).get("course_title"),
        "status": _status_max(feedback_status, artifact_status),
        "score": min(scores) if scores else None,
        "latest_rating": feedback_metrics["latest_rating"],
        "rating_counts": feedback_metrics["rating_counts"],
        "feedback_note_count": feedback_metrics["feedback_note_count"],
        "source_suggestion_count": feedback_metrics["source_suggestion_count"],
        "average_feedback_magnitude": feedback_metrics["average_feedback_magnitude"],
        "signals": list(dict.fromkeys([*artifact_signals, *feedback_signals])),
        "artifact_metrics": artifact_metrics,
        "updated_at": feedback_metrics["updated_at"],
    }
