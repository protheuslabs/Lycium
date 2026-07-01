from __future__ import annotations

import base64
from datetime import UTC, datetime
from io import BytesIO
from typing import Any
from xml.etree import ElementTree
from zipfile import ZipFile

WORKFLOW_VERSION = "project-submission-grader-v1"
CONTRACT_VERSION = "lycium-project-grade-report-v1"


def grade_project_submission(payload: dict[str, Any]) -> dict[str, Any]:
    project = _record(payload.get("projectBlock"))
    submission = _record(payload.get("submission"))
    rubric = _normalize_rubric(project.get("rubric"))
    criteria = rubric["criteria"]
    required_evidence = _string_list(project.get("requiredEvidence"))
    source_records = [item for item in _items(payload.get("sourceRecords")) if isinstance(item, dict)]
    extraction = _extract_submission_text(submission)
    submission_text = str(extraction["text"])
    context_tokens = _grading_context_tokens(project, rubric, required_evidence)
    errors = _grading_errors(submission, submission_text, context_tokens, extraction)
    evidence_signals = _evidence_signals(submission, submission_text, required_evidence, context_tokens)
    criterion_results = (
        [_zero_criterion(criterion, evidence_signals) for criterion in criteria]
        if _has_blocking_errors(errors)
        else [
            _grade_criterion(criterion, submission_text, evidence_signals, required_evidence)
            for criterion in criteria
        ]
    )
    total_score = sum(result["score"] for result in criterion_results)
    total_possible = sum(result["maxScore"] for result in criterion_results) or 1.0
    score_percentage = round((total_score / total_possible) * 100, 1)
    status = "needs_review" if _has_blocking_errors(errors) else "graded"
    passed = status == "graded" and score_percentage >= _pass_threshold(project)

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
        "summary": _summary(score_percentage, passed, status, errors),
        "criterionResults": criterion_results,
        "feedback": _feedback(criterion_results, evidence_signals, errors),
        "nextSteps": _next_steps(criterion_results, evidence_signals, errors),
        "errors": errors,
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
            "mode": "native-deterministic-text-extraction",
            "requestedGrader": _requested_grader_name(project),
            "workflowSteps": [
                "extract_submission_text",
                "collect_rubric_criteria",
                "compare_submission_to_required_evidence",
                "score_each_rubric_criterion",
                "emit_structured_grade_report",
            ],
            "toolCalls": [extraction["toolCall"]],
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
            {"id": "criterion-understanding", "title": "Concept understanding", "description": "Applies relevant concepts accurately.", "points": 40},
            {"id": "criterion-evidence", "title": "Required evidence", "description": "Includes enough evidence for grading.", "points": 35},
            {"id": "criterion-reflection", "title": "Reflection", "description": "Explains tradeoffs and next improvements.", "points": 25},
        ],
    }


def _normalize_criterion(raw: dict[str, Any], index: int) -> dict[str, Any]:
    title = str(raw.get("title") or raw.get("criterion") or f"Criterion {index + 1}")
    return {
        "id": str(raw.get("id") or f"criterion-{index + 1}"),
        "title": title,
        "description": str(raw.get("description") or "Describe what successful work should show."),
        "points": _whole_points(raw.get("points"), 10),
        "levels": _items(raw.get("levels")),
    }


def _number(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _whole_points(value: Any, fallback: int) -> int:
    return max(1, int(round(_number(value, float(fallback)))))


def _extract_submission_text(submission: dict[str, Any]) -> dict[str, Any]:
    file_extraction = _extract_file_text(submission)
    parts = [
        str(submission.get("text") or ""),
        str(submission.get("notes") or ""),
        file_extraction["text"],
    ]
    text = " ".join(part.strip() for part in parts if part.strip()).strip()
    return {
        "text": text,
        "toolCall": {
            "tool": "native_submission_text_extractor",
            "adapter": "lycium-native",
            "status": file_extraction["status"] if file_extraction["status"] != "not_requested" else ("ok" if text else "empty"),
            "message": file_extraction.get("message"),
            "inputTypes": {
                "hasText": bool(str(submission.get("text") or "").strip()),
                "hasLink": bool(str(submission.get("link") or "").strip()),
                "hasFile": bool(str(submission.get("fileName") or "").strip()),
                "hasFileData": bool(str(submission.get("fileDataBase64") or "").strip()),
            },
            "fileName": str(submission.get("fileName") or ""),
            "extractedFileWordCount": len(str(file_extraction["text"]).split()),
        },
    }


def _extract_file_text(submission: dict[str, Any]) -> dict[str, str]:
    file_name = str(submission.get("fileName") or "").strip()
    file_data_base64 = str(submission.get("fileDataBase64") or "").strip()
    if not file_name:
        return {"status": "not_requested", "text": ""}
    if not file_data_base64:
        return {
            "status": "missing_file_data",
            "text": "",
            "message": "The file name was received, but the uploaded file content was not available to the grader.",
        }

    try:
        file_bytes = base64.b64decode(_strip_data_url_prefix(file_data_base64), validate=True)
    except Exception:
        return {
            "status": "invalid_file_data",
            "text": "",
            "message": "The uploaded file content could not be decoded.",
        }

    lower_name = file_name.lower()
    if lower_name.endswith((".txt", ".md", ".csv")):
        return _extract_plain_text_file(file_bytes)
    if lower_name.endswith(".pdf"):
        return _extract_pdf_file(file_bytes)
    if lower_name.endswith(".docx"):
        return _extract_docx_file(file_bytes)
    if _is_image_submission(submission):
        return {
            "status": "image_inspection_unavailable",
            "text": "",
            "message": "Image submissions are accepted, but the native grader cannot inspect image content yet. Use a vision-capable agent grader or human review.",
        }

    return {
        "status": "unsupported_file_type",
        "text": "",
        "message": "The native grader can only inspect TXT, PDF, DOCX, and image artifact uploads right now.",
    }


def _is_image_submission(submission: dict[str, Any]) -> bool:
    file_name = str(submission.get("fileName") or "").strip().lower()
    file_mime_type = str(submission.get("fileMimeType") or "").strip().lower()
    submission_type = str(submission.get("submissionType") or "").strip().lower()
    return (
        submission_type == "image"
        or file_mime_type.startswith("image/")
        or file_name.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tif", ".tiff"))
    )


def _strip_data_url_prefix(value: str) -> str:
    return value.split(",", 1)[1] if value.startswith("data:") and "," in value else value


def _extract_plain_text_file(file_bytes: bytes) -> dict[str, str]:
    try:
        return {"status": "ok", "text": file_bytes.decode("utf-8", errors="replace")}
    except Exception:
        return {"status": "file_text_extraction_failed", "text": "", "message": "The text file could not be decoded."}


def _extract_pdf_file(file_bytes: bytes) -> dict[str, str]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(file_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as exc:
        return {"status": "file_text_extraction_failed", "text": "", "message": f"The PDF text could not be extracted: {exc.__class__.__name__}."}

    if not text:
        return {"status": "file_text_extraction_failed", "text": "", "message": "The PDF did not contain extractable text."}
    return {"status": "ok", "text": text}


def _extract_docx_file(file_bytes: bytes) -> dict[str, str]:
    try:
        with ZipFile(BytesIO(file_bytes)) as archive:
            document_xml = archive.read("word/document.xml")
    except Exception as exc:
        return {"status": "file_text_extraction_failed", "text": "", "message": f"The DOCX text could not be extracted: {exc.__class__.__name__}."}

    try:
        root = ElementTree.fromstring(document_xml)
        text_values = [
            node.text or ""
            for node in root.iter()
            if node.tag.endswith("}t") or node.tag == "t"
        ]
    except Exception as exc:
        return {"status": "file_text_extraction_failed", "text": "", "message": f"The DOCX document text could not be parsed: {exc.__class__.__name__}."}

    text = " ".join(value.strip() for value in text_values if value.strip()).strip()
    if not text:
        return {"status": "file_text_extraction_failed", "text": "", "message": "The DOCX did not contain extractable text."}
    return {"status": "ok", "text": text}


def _grading_errors(
    submission: dict[str, Any],
    submission_text: str,
    context_tokens: list[str],
    extraction: dict[str, Any],
) -> list[dict[str, Any]]:
    has_text = bool(str(submission.get("text") or "").strip())
    has_link = bool(str(submission.get("link") or "").strip())
    has_file = bool(str(submission.get("fileName") or "").strip())
    has_file_data = bool(str(submission.get("fileDataBase64") or "").strip())
    errors: list[dict[str, Any]] = []
    lowered = submission_text.lower()
    word_count = len(submission_text.split())
    context_match_count = len({token for token in context_tokens if token in lowered})

    if not submission_text and not has_link and not has_file:
        errors.append(
            {
                "code": "missing_submission",
                "message": "No submission content was provided.",
                "severity": "blocking",
                "retryable": True,
            },
        )
    elif has_text and _looks_like_gibberish(submission_text):
        errors.append(
            {
                "code": "unreadable_submission_text",
                "message": "The native text grader could not identify readable project content in this submission.",
                "severity": "blocking",
                "retryable": True,
            },
        )
    elif has_text and word_count < 8:
        errors.append(
            {
                "code": "submission_too_short",
                "message": "The native text grader needs a fuller submission before it can grade this project.",
                "severity": "blocking",
                "retryable": True,
            },
        )
    elif has_text and context_tokens and context_match_count < 2:
        errors.append(
            {
                "code": "no_relevant_project_evidence",
                "message": "The submission text does not match the project prompt or rubric closely enough to grade.",
                "severity": "blocking",
                "retryable": True,
            },
        )
    if has_link and not has_text:
        errors.append(
            {
                "code": "external_link_not_fetched",
                "message": "The native grader can record the link, but it cannot inspect external link content yet.",
                "severity": "blocking",
                "retryable": False,
            },
        )
    if has_file and not has_text and not has_file_data:
        errors.append(
            {
                "code": "file_content_not_extracted",
                "message": "The native grader received the file name but not the uploaded file content.",
                "severity": "blocking",
                "retryable": False,
            },
        )
    if has_file and has_file_data and not submission_text:
        tool_call = _record(extraction.get("toolCall"))
        errors.append(
            {
                "code": str(tool_call.get("status") or "file_content_not_extracted"),
                "message": str(tool_call.get("message") or "The native grader could not extract readable text from the uploaded file."),
                "severity": "blocking",
                "retryable": True,
            },
        )

    return errors


def _has_blocking_errors(errors: list[dict[str, Any]]) -> bool:
    return any(error.get("severity") == "blocking" for error in errors)


def _evidence_signals(
    submission: dict[str, Any],
    submission_text: str,
    required_evidence: list[str],
    context_tokens: list[str],
) -> dict[str, Any]:
    lowered = submission_text.lower()
    evidence_matches = [
        evidence
        for evidence in required_evidence
        if any(token in lowered for token in _meaningful_tokens(evidence))
    ]
    context_matches = sorted({token for token in context_tokens if token in lowered})
    return {
        "hasText": bool(str(submission.get("text") or "").strip()),
        "hasLink": bool(str(submission.get("link") or "").strip()),
        "hasFile": bool(str(submission.get("fileName") or "").strip()),
        "submissionWordCount": len(submission_text.split()),
        "requiredEvidenceCount": len(required_evidence),
        "matchedRequiredEvidenceCount": len(evidence_matches),
        "matchedRequiredEvidence": evidence_matches,
        "contextTokenCount": len(context_tokens),
        "matchedContextTokenCount": len(context_matches),
        "matchedContextTokens": context_matches[:20],
    }


def _meaningful_tokens(value: str, limit: int = 8) -> list[str]:
    stop_words = {"the", "and", "for", "with", "that", "this", "from", "into", "your", "what", "when", "where"}
    return [
        token
        for token in "".join(character.lower() if character.isalnum() else " " for character in value).split()
        if len(token) >= 5 and token not in stop_words
    ][:limit]


def _grading_context_tokens(project: dict[str, Any], rubric: dict[str, Any], required_evidence: list[str]) -> list[str]:
    context_values = [
        str(project.get("title") or ""),
        str(project.get("instructions") or ""),
        str(project.get("description") or ""),
        str(project.get("value") or ""),
        str(project.get("text") or ""),
        *required_evidence,
    ]
    for criterion in _items(rubric.get("criteria")):
        if isinstance(criterion, dict):
            context_values.append(str(criterion.get("title") or ""))
            context_values.append(str(criterion.get("description") or ""))

    tokens: list[str] = []
    for value in context_values:
        tokens.extend(_meaningful_tokens(value, limit=24))
    return sorted(set(tokens))


def _looks_like_gibberish(submission_text: str) -> bool:
    words = [
        token
        for token in "".join(character.lower() if character.isalnum() else " " for character in submission_text).split()
        if len(token) >= 3
    ]
    if len(words) < 4:
        return False

    unique_ratio = len(set(words)) / max(1, len(words))
    vowel_words = sum(1 for word in words if any(vowel in word for vowel in "aeiou"))
    vowel_ratio = vowel_words / max(1, len(words))
    repeated_noise = len(words) >= 6 and unique_ratio <= 0.35
    consonant_noise = len(words) >= 6 and vowel_ratio <= 0.35
    return repeated_noise or consonant_noise


def _grade_criterion(
    criterion: dict[str, Any],
    submission_text: str,
    evidence_signals: dict[str, Any],
    required_evidence: list[str],
) -> dict[str, Any]:
    max_score = _whole_points(criterion.get("points"), 10)
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

    score = max(0, min(max_score, int(round(max_score * min(1.0, ratio)))))
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


def _zero_criterion(criterion: dict[str, Any], evidence_signals: dict[str, Any]) -> dict[str, Any]:
    max_score = _whole_points(criterion.get("points"), 10)
    return {
        "criterionId": criterion["id"],
        "title": criterion["title"],
        "score": 0,
        "maxScore": max_score,
        "level": "needs_work",
        "feedback": f"{criterion['title']} could not be graded because the submission needs readable, relevant project evidence.",
        "evidence": {
            "wordCount": evidence_signals["submissionWordCount"],
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


def _requested_grader_name(project: dict[str, Any]) -> str:
    workflow = _record(project.get("graderWorkflow"))
    return str(workflow.get("grader") or "agent")


def _grader_name(project: dict[str, Any]) -> str:
    requested = _requested_grader_name(project)
    return "native_text_grader" if requested == "agent" else requested


def _summary(score_percentage: float, passed: bool, status: str, errors: list[dict[str, Any]]) -> str:
    if status == "needs_review":
        if errors:
            return f"Native text grader could not grade this submission: {errors[0]['message']}"
        return "Native text grader could not grade this submission because it does not include enough evidence."
    if passed:
        return f"Native text grader passed this submission with {score_percentage}% against the project rubric."
    return f"Native text grader scored this submission {score_percentage}% and it needs revision before it satisfies the rubric."


def _feedback(criterion_results: list[dict[str, Any]], evidence_signals: dict[str, Any], errors: list[dict[str, Any]]) -> str:
    if errors:
        return "Revise the submission with readable, relevant evidence from the project prompt, then resubmit."
    weak = [result["title"] for result in criterion_results if result["level"] != "strong"]
    if not weak:
        return "The submission is complete, reviewable, and aligned with the rubric."
    evidence_note = " Add the missing required evidence." if evidence_signals["matchedRequiredEvidenceCount"] < evidence_signals["requiredEvidenceCount"] else ""
    return f"Revise these rubric areas: {', '.join(weak)}.{evidence_note}"


def _next_steps(criterion_results: list[dict[str, Any]], evidence_signals: dict[str, Any], errors: list[dict[str, Any]]) -> list[str]:
    if errors:
        return [str(error["message"]) for error in errors]
    steps: list[str] = []
    if evidence_signals["submissionWordCount"] < 80:
        steps.append("Add a fuller explanation of the approach, decisions, and result.")
    if evidence_signals["matchedRequiredEvidenceCount"] < evidence_signals["requiredEvidenceCount"]:
        steps.append("Attach or describe every required evidence item from the project prompt.")
    if any(result["level"] == "needs_work" for result in criterion_results):
        steps.append("Revise the weakest rubric criteria before resubmitting.")
    return steps or ["Save the graded artifact to the learner portfolio or request human review if needed."]
