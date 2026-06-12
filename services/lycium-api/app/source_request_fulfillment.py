from __future__ import annotations

import re
from typing import Any


TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+.#-]*")


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _values(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _text(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_text(item) for item in value)
    return str(value or "")


def _terms(value: Any) -> set[str]:
    return {term for term in TOKEN_RE.findall(_text(value).lower()) if len(term) > 2}


def _concepts(source_request: dict[str, Any]) -> list[str]:
    concepts = [
        str(value).strip()
        for value in _values(source_request.get("requiredConcepts"))
        if str(value).strip()
    ]
    return concepts or [str(source_request.get("title") or "required concept").strip()]


def _result_text(result: dict[str, Any]) -> str:
    return " ".join(
        [
            _text(result.get("source")),
            _text(result.get("snapshot")),
            _text(result.get("summary")),
            _text(result.get("matched_terms") or result.get("matchedTerms")),
            _text(result.get("evidence_refs") or result.get("evidenceRefs")),
        ]
    )


def _result_ref(result: dict[str, Any]) -> str:
    source = result.get("source") if isinstance(result.get("source"), dict) else {}
    for key in ("public_id", "publicId", "id", "sourceId"):
        value = source.get(key)
        if value:
            return str(value)
    refs = result.get("evidence_refs") or result.get("evidenceRefs")
    if isinstance(refs, list) and refs:
        return str(refs[0])
    return str(result.get("url") or result.get("title") or "source")


def _result_title(result: dict[str, Any]) -> str:
    source = result.get("source") if isinstance(result.get("source"), dict) else {}
    snapshot = result.get("snapshot") if isinstance(result.get("snapshot"), dict) else {}
    return str(source.get("title") or snapshot.get("title") or result.get("title") or _result_ref(result))


def _matched_concepts(result: dict[str, Any], concepts: list[str]) -> list[str]:
    result_terms = _terms(_result_text(result))
    matched: list[str] = []
    for concept in concepts:
        concept_terms = _terms(concept)
        if concept_terms and concept_terms.issubset(result_terms):
            matched.append(concept)
    return matched


def _score(result: dict[str, Any]) -> float:
    try:
        return float(result.get("score") or 0)
    except (TypeError, ValueError):
        return 0.0


def build_course_source_request_fulfillment_report(
    *,
    source_request: dict[str, Any],
    search_results: list[dict[str, Any]],
) -> dict[str, Any]:
    concepts = _concepts(source_request)
    results = _items(search_results)
    candidates: list[dict[str, Any]] = []
    covered_concepts: set[str] = set()
    for result in results:
        matched = _matched_concepts(result, concepts)
        if not matched:
            continue
        covered_concepts.update(matched)
        candidates.append(
            {
                "sourceId": _result_ref(result),
                "title": _result_title(result),
                "score": _score(result),
                "matchedConcepts": matched,
                "matchedConceptCount": len(matched),
                "evidenceRefs": [
                    str(value)
                    for value in _values(result.get("evidence_refs") or result.get("evidenceRefs"))
                    if str(value).strip()
                ],
            }
        )
    candidates.sort(key=lambda candidate: (-candidate["matchedConceptCount"], -float(candidate["score"]), candidate["title"]))
    uncovered = [concept for concept in concepts if concept not in covered_concepts]
    coverage_ratio = len(covered_concepts) / len(concepts) if concepts else 1.0
    try:
        minimum_ratio = float(source_request.get("minimumConceptCoverageRatio") or 1.0)
    except (TypeError, ValueError):
        minimum_ratio = 1.0
    if not candidates:
        status = "unmatched"
    elif coverage_ratio >= minimum_ratio:
        status = "satisfied"
    else:
        status = "partial"
    return {
        "contractVersion": "course-source-request-fulfillment-report-v1",
        "status": status,
        "courseId": str(source_request.get("courseId") or ""),
        "requirementId": str(source_request.get("requirementId") or ""),
        "title": str(source_request.get("title") or ""),
        "requiredConcepts": concepts,
        "coveredConcepts": sorted(covered_concepts),
        "uncoveredConcepts": uncovered,
        "selectedCandidates": candidates[:12],
        "candidateCount": len(candidates),
        "resultCount": len(results),
        "metrics": {
            "requiredConceptCount": len(concepts),
            "coveredConceptCount": len(covered_concepts),
            "uncoveredConceptCount": len(uncovered),
            "conceptCoverageRatio": round(coverage_ratio, 4),
            "minimumConceptCoverageRatio": minimum_ratio,
        },
    }


def build_program_source_acquisition_fulfillment_report(
    *,
    source_acquisition_plan: dict[str, Any],
    search_results_by_task_id: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    search_plan = source_acquisition_plan.get("sourceIndexSearchPlan")
    search_tasks = _items(search_plan.get("tasks")) if isinstance(search_plan, dict) else []
    results_by_course: dict[str, list[dict[str, Any]]] = {}
    for task in search_tasks:
        course_id = str(task.get("courseId") or "")
        task_id = str(task.get("taskId") or "")
        results_by_course.setdefault(course_id, []).extend(_items(search_results_by_task_id.get(task_id)))

    reports = [
        build_course_source_request_fulfillment_report(
            source_request=request,
            search_results=results_by_course.get(str(request.get("courseId") or ""), []),
        )
        for request in _items(source_acquisition_plan.get("requests"))
    ]
    satisfied = [report for report in reports if report["status"] == "satisfied"]
    partial = [report for report in reports if report["status"] == "partial"]
    unmatched = [report for report in reports if report["status"] == "unmatched"]
    if unmatched or partial:
        status = "needs_more_sources"
    elif reports:
        status = "satisfied"
    else:
        status = "empty"
    return {
        "contractVersion": "program-source-acquisition-fulfillment-report-v1",
        "status": status,
        "requestCount": len(reports),
        "satisfiedRequestCount": len(satisfied),
        "partialRequestCount": len(partial),
        "unmatchedRequestCount": len(unmatched),
        "reports": reports,
        "nextUnfulfilledRequests": [
            {
                "courseId": report["courseId"],
                "title": report["title"],
                "status": report["status"],
                "uncoveredConcepts": report["uncoveredConcepts"],
            }
            for report in [*partial, *unmatched]
        ][:20],
    }
