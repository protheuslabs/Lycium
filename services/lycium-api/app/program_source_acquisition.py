from __future__ import annotations

import re
from typing import Any


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _values(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


IMPORTANCE_PRIORITY = {
    "required": 10,
    "core": 10,
    "common": 10,
    "recommended": 20,
    "support": 20,
    "remedial": 30,
    "optional": 40,
    "enrichment": 40,
}


def _priority(source_request: dict[str, Any]) -> int:
    importance = str(source_request.get("importance") or "required").lower()
    return IMPORTANCE_PRIORITY.get(importance, 50)


def _source_request_row(course: dict[str, Any], cluster_index: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    source_request = course.get("sourceRequest")
    if not isinstance(source_request, dict):
        return None
    cluster_id = str(course.get("clusterId") or "")
    cluster = cluster_index.get(cluster_id, {})
    required_concepts = [
        str(value)
        for value in _values(source_request.get("requiredConcepts"))
        if str(value).strip()
    ]
    suggested_queries = [
        str(value)
        for value in _values(source_request.get("suggestedQueries"))
        if str(value).strip()
    ]
    return {
        "contractVersion": "program-source-acquisition-request-v1",
        "priority": _priority(source_request),
        "clusterId": cluster_id,
        "clusterTitle": str(cluster.get("title") or cluster.get("displayName") or cluster_id),
        "courseId": str(source_request.get("courseId") or course.get("courseId") or ""),
        "title": str(source_request.get("title") or course.get("title") or ""),
        "requirementId": str(source_request.get("requirementId") or course.get("requirementId") or ""),
        "importance": str(source_request.get("importance") or "required"),
        "requiredConcepts": required_concepts,
        "suggestedQueries": suggested_queries,
        "sourceTypeHints": [
            str(value)
            for value in _values(source_request.get("sourceTypeHints"))
            if str(value).strip()
        ],
        "minimumConceptCoverageRatio": source_request.get("minimumConceptCoverageRatio"),
        "evidenceRefs": [
            str(value)
            for value in _values(source_request.get("evidenceRefs"))
            if str(value).strip()
        ],
    }


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(value)
    return deduped


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "search"


def _source_index_search_plan(requests: list[dict[str, Any]]) -> dict[str, Any]:
    tasks: list[dict[str, Any]] = []
    for request in requests:
        course_id = str(request.get("courseId") or "")
        requirement_id = str(request.get("requirementId") or "")
        required_concepts = [
            str(concept)
            for concept in _values(request.get("requiredConcepts"))
            if str(concept).strip()
        ]
        for index, query in enumerate(_values(request.get("suggestedQueries"))[:6], start=1):
            query_text = str(query).strip()
            if not query_text:
                continue
            task_id_seed = f"{course_id}-{requirement_id}-{index}-{query_text}"
            tasks.append(
                {
                    "contractVersion": "source-index-search-task-v1",
                    "taskId": f"search-{_slugify(task_id_seed)[:96]}",
                    "courseId": course_id,
                    "requirementId": requirement_id,
                    "clusterId": str(request.get("clusterId") or ""),
                    "query": query_text,
                    "requiredConcepts": required_concepts,
                    "sourceTypeHints": request.get("sourceTypeHints") or [],
                    "minimumConceptCoverageRatio": request.get("minimumConceptCoverageRatio"),
                    "intent": "find_source_packet_evidence",
                }
            )
    return {
        "contractVersion": "program-source-index-search-plan-v1",
        "status": "ready" if tasks else "empty",
        "searchTaskCount": len(tasks),
        "tasks": tasks,
        "nextTasks": tasks[:20],
    }


def build_program_source_acquisition_plan(
    *,
    clusters: list[dict[str, Any]],
    courses: list[dict[str, Any]],
) -> dict[str, Any]:
    cluster_rows = _items(clusters)
    course_rows = _items(courses)
    cluster_index = {
        str(cluster.get("clusterId") or cluster.get("id") or ""): cluster
        for cluster in cluster_rows
    }
    requests = [
        request
        for course in course_rows
        if (request := _source_request_row(course, cluster_index)) is not None
    ]
    requests.sort(
        key=lambda request: (
            int(request.get("priority") or 99),
            str(request.get("clusterTitle") or ""),
            str(request.get("title") or ""),
        )
    )
    all_concepts = _dedupe(
        [
            concept
            for request in requests
            for concept in request["requiredConcepts"]
        ]
    )
    all_queries = _dedupe(
        [
            query
            for request in requests
            for query in request["suggestedQueries"]
        ]
    )
    status = "needs_sources" if requests else "satisfied"
    search_plan = _source_index_search_plan(requests)
    return {
        "contractVersion": "program-source-acquisition-plan-v1",
        "status": status,
        "clusterCount": len(cluster_rows),
        "courseCount": len(course_rows),
        "sourceRequestCount": len(requests),
        "requiredConceptCount": len(all_concepts),
        "suggestedQueryCount": len(all_queries),
        "requiredConcepts": all_concepts[:100],
        "suggestedQueries": all_queries[:120],
        "requests": requests,
        "nextRequests": requests[:10],
        "sourceIndexSearchPlan": search_plan,
    }
