from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

WORKFLOW_VERSION = "project-submission-grader-v1"
CONTRACT_VERSION = "lycium-project-grade-report-v1"


def grade_project_submission(payload: dict[str, Any]) -> dict[str, Any]:
    project = _record(payload.get("projectBlock"))
    submission = _record(payload.get("submission"))
    rubric = _normalize_rubric(project.get("rubric"))
    criteria = rubric["criteria"]
    required_evidence = _string_list(project.get("requiredEvidence"))
    source_records = [item for item in _items(payload.get("sourceRecords")) if isinstance(item, dict)]
    submission_text = _submission_text(submission)
    evidence_signals = _evidence_signals(submission, submission_text, required_evidence)
    criterion_results = [
        _grade_criterion(criterion, submission_text, evidence_signals, required_evidence)
        for criterion in criteria
    ]
    total_score = sum(result["score"] for result in criterion_results)
    total_possible = sum(result["maxScore"] for result in criterion_results) or 1.0
    score_percentage = round((total_score / total_possible) * 100, 1)
    passed = score_percentage >= _pass_threshold(project)
    status = "graded" if submission_text else "needs_review"

    return {
        "contractVersion": CONTRACT_VERSION,
        "workflowVersion": WORKFLOW_VERSION,
        "status": status,
        "grader": _grader_name(project),
        "gradedAt": datetime.now(UTC).isoformat(),
        "score": round(total_score, 2),
        "maxScore": round(total_possible, 2),
        "scorePercentage": score_percentage,
        "passed": passed,
        "summary": _summary(score_percentage, passed, status),
        "criterionResults": criterion_results,
        "feedback": _feedback(criterion_results, evidence_signals),
        "nextSteps": _next_steps(criterion_results, evidence_signals),
        "boundedContext": {
            "courseTitle": payload.get("courseTitle"),
            "sectionId": payload.get("sectionId"),
            "sectionTitle": payload.get("sectionTitle"),
            "projectTitle": project.get("title") or "Project",
            "rubricId": rubric.get("id"),
            "sourceRecordCount": len(source_records),
            "usedContext": ["projectBlock", "submission", "rubric", "requiredEvidence", "sourceRecords"],
        },
        "trace": {
            "mode": "deterministic-agent-ready",
            "evidenceSignals": evidence_signals,
            "humanReviewRecommended": score_percentage < 70 or status == "needs_review",
        },
    }


def _record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _items(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _string_list(value: Any) -> list[str]:
    return [str(item).strip() for item in _items(value) if str(item).strip()]


def _normalize_rubric(raw_rubric: Any) -> dict[str, Any]:
    if isinstance(raw_rubric, list):
        criteria = raw_rubric
        title = "Project rubric"
        rubric_id = "project-rubric"
    elif isinstance(raw_rubric, dict):
        criteria = _items(raw_rubric.get("criteria"))
        title = str(raw_rubric.get("title") or "Project rubric")
        rubric_id = str(raw_rubric.get("id") or "project-rubric")
    else:
        criteria = []
        title = "Project rubric"
        rubric_id = "project-rubric"

    normalized_criteria = [_normalize_criterion(criterion, index) for index, criterion in enumerate(criteria) if isinstance(criterion, dict)]
    return {
        "id": rubric_id,
        "title": title,
        "criteria": normalized_criteria or [
            {"id": "criterion-understanding", "title": "Concept understanding", "description": "Applies relevant concepts accurately.", "points": 40.0},
            {"id": "criterion-evidence", "title": "Required evidence", "description": "Includes enough evidence for grading.", "points": 35.0},
            {"id": "criterion-reflection", "title": "Reflection", "description": "Explains tradeoffs and next improvements.", "points": 25.0},
        ],
    }


def _normalize_criterion(raw: dict[str, Any], index: int) -> dict[str, Any]:
    title = str(raw.get("title") or raw.get("criterion") or f"Criterion {index + 1}")
    return {
        "id": str(raw.get("id") or f"criterion-{index + 1}"),
        "title": title,
        "description": str(raw.get("description") or "Describe what successful work should show."),
        "points": _number(raw.get("points"), 10.0),
        "levels": _items(raw.get("levels")),
    }


def _number(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _submission_text(submission: dict[str, Any]) -> str:
    parts = [
        str(submission.get("text") or ""),
        str(submission.get("link") or ""),
        str(submission.get("fileName") or ""),
        str(submission.get("notes") or ""),
    ]
    return " ".join(part.strip() for part in parts if part.strip()).strip()


def _evidence_signals(submission: dict[str, Any], submission_text: str, required_evidence: list[str]) -> dict[str, Any]:
    lowered = submission_text.lower()
    evidence_matches = [
        evidence
        for evidence in required_evidence
        if any(token in lowered for token in _meaningful_tokens(evidence))
    ]
    return {
        "hasText": bool(str(submission.get("text") or "").strip()),
        "hasLink": bool(str(submission.get("link") or "").strip()),
        "hasFile": bool(str(submission.get("fileName") or "").strip()),
        "submissionWordCount": len(submission_text.split()),
        "requiredEvidenceCount": len(required_evidence),
        "matchedRequiredEvidenceCount": len(evidence_matches),
        "matchedRequiredEvidence": evidence_matches,
    }


def _meaningful_tokens(value: str) -> list[str]:
    stop_words = {"the", "and", "for", "with", "that", "this", "from", "into", "your", "what", "when", "where"}
    return [
        token
        for token in "".join(character.lower() if character.isalnum() else " " for character in value).split()
        if len(token) >= 5 and token not in stop_words
    ][:8]


def _grade_criterion(
    criterion: dict[str, Any],
    submission_text: str,
    evidence_signals: dict[str, Any],
    required_evidence: list[str],
) -> dict[str, Any]:
    max_score = _number(criterion.get("points"), 10.0)
    word_count = int(evidence_signals["submissionWordCount"])
    completeness_ratio = (
        1.0
        if not required_evidence
        else min(1.0, float(evidence_signals["matchedRequiredEvidenceCount"]) / max(1, len(required_evidence)))
    )
    format_bonus = sum(1 for key in ("hasText", "hasLink", "hasFile") if evidence_signals[key]) / 3
    depth_ratio = min(1.0, word_count / 120)
    title_blob = f"{criterion.get('title', '')} {criterion.get('description', '')}".lower()
    if any(token in title_blob for token in ("evidence", "artifact", "submit", "required")):
        ratio = (completeness_ratio * 0.7) + (format_bonus * 0.3)
    elif any(token in title_blob for token in ("reflection", "tradeoff", "improvement", "decision")):
        ratio = (depth_ratio * 0.65) + (completeness_ratio * 0.35)
    else:
        ratio = (depth_ratio * 0.45) + (completeness_ratio * 0.35) + (format_bonus * 0.2)

    score = round(max_score * min(1.0, ratio), 2)
    return {
        "criterionId": criterion["id"],
        "title": criterion["title"],
        "score": score,
        "maxScore": max_score,
        "level": _level(score / max_score if max_score else 0.0),
        "feedback": _criterion_feedback(criterion, score, max_score, evidence_signals),
        "evidence": {
            "wordCount": word_count,
            "matchedRequiredEvidenceCount": evidence_signals["matchedRequiredEvidenceCount"],
        },
    }


def _level(ratio: float) -> str:
    if ratio >= 0.85:
        return "strong"
    if ratio >= 0.6:
        return "developing"
    return "needs_work"


def _criterion_feedback(criterion: dict[str, Any], score: float, max_score: float, evidence_signals: dict[str, Any]) -> str:
    ratio = score / max_score if max_score else 0.0
    if ratio >= 0.85:
        return f"{criterion['title']} is well supported by the submitted evidence."
    if evidence_signals["submissionWordCount"] < 40:
        return f"{criterion['title']} needs more explanation so the grader can inspect the learner's reasoning."
    return f"{criterion['title']} is partially supported. Add more direct evidence, explanation, or reflection."


def _pass_threshold(project: dict[str, Any]) -> float:
    workflow = _record(project.get("graderWorkflow"))
    return _number(workflow.get("passPercentage"), 70.0)


def _grader_name(project: dict[str, Any]) -> str:
    workflow = _record(project.get("graderWorkflow"))
    return str(workflow.get("grader") or "agent")


def _summary(score_percentage: float, passed: bool, status: str) -> str:
    if status == "needs_review":
        return "Submission does not include enough evidence to grade confidently."
    if passed:
        return f"Submission passed with {score_percentage}% against the project rubric."
    return f"Submission scored {score_percentage}% and needs revision before it satisfies the rubric."


def _feedback(criterion_results: list[dict[str, Any]], evidence_signals: dict[str, Any]) -> str:
    weak = [result["title"] for result in criterion_results if result["level"] != "strong"]
    if not weak:
        return "The submission is complete, reviewable, and aligned with the rubric."
    evidence_note = " Add the missing required evidence." if evidence_signals["matchedRequiredEvidenceCount"] < evidence_signals["requiredEvidenceCount"] else ""
    return f"Revise these rubric areas: {', '.join(weak)}.{evidence_note}"


def _next_steps(criterion_results: list[dict[str, Any]], evidence_signals: dict[str, Any]) -> list[str]:
    steps: list[str] = []
    if evidence_signals["submissionWordCount"] < 80:
        steps.append("Add a fuller explanation of the approach, decisions, and result.")
    if evidence_signals["matchedRequiredEvidenceCount"] < evidence_signals["requiredEvidenceCount"]:
        steps.append("Attach or describe every required evidence item from the project prompt.")
    if any(result["level"] == "needs_work" for result in criterion_results):
        steps.append("Revise the weakest rubric criteria before resubmitting.")
    return steps or ["Save the graded artifact to the learner portfolio or request human review if needed."]
