from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.course_generation_readiness import build_generation_readiness_report
from app.course_source_policy import SOURCE_COVERAGE_POLICY
from app.generation_helpers import COURSE_GENERATION_RULES, _catalog_metadata_from_prompt, _title_from_prompt
from app.models import CourseDraft, CourseSnapshot
from app.course_source_gap_resume import summarize_concept_source_need_coverage
from app.source_index_search import search_index_response


def _unique_source_urls(source_urls: list[str] | None) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for source_url in source_urls or []:
        clean_url = str(source_url).strip()
        if not clean_url or clean_url in seen:
            continue
        seen.add(clean_url)
        urls.append(clean_url)
    return urls


def source_count_meets_minimum(source_urls: list[str] | None) -> bool:
    return len(_unique_source_urls(source_urls)) >= int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])


def _source_records_from_input_urls(source_urls: list[str], course_title: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"input-source-{index}",
            "type": "web",
            "title": f"Submitted source {index}",
            "url": source_url,
            "usedByCourseTitles": [course_title],
        }
        for index, source_url in enumerate(source_urls, start=1)
    ]


def source_urls_from_needs_sources_snapshot(snapshot: CourseSnapshot) -> list[str]:
    trace = snapshot.generation_trace if isinstance(snapshot.generation_trace, dict) else {}
    trace_urls = trace.get("source_urls")
    urls: list[str] = [str(url) for url in trace_urls if isinstance(url, str)] if isinstance(trace_urls, list) else []
    structure = snapshot.structure if isinstance(snapshot.structure, dict) else {}
    records = structure.get("sourceRecords")
    if isinstance(records, list):
        urls.extend(str(record.get("url")) for record in records if isinstance(record, dict) and record.get("url"))
    return _unique_source_urls(urls)


def _source_gate_issue_messages(source_gate: dict[str, Any] | None) -> list[str]:
    issues = source_gate.get("issues") if isinstance(source_gate, dict) else None
    if not isinstance(issues, list):
        return []
    messages: list[str] = []
    for issue in issues:
        if isinstance(issue, dict) and isinstance(issue.get("message"), str) and issue["message"].strip():
            messages.append(issue["message"].strip())
    return messages


def _source_gate_artifacts(source_gate: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(source_gate, dict):
        return {}
    artifacts = source_gate.get("artifacts")
    return artifacts if isinstance(artifacts, dict) else {}


def _source_need_query(title: str, concept: str) -> list[str]:
    clean_concept = concept.strip() or "course concept"
    return [
        f"{title} {clean_concept} open textbook",
        f"{title} {clean_concept} lecture notes",
        f"{title} {clean_concept} practice problems",
    ]


def _concept_source_needs(title: str, source_gate: dict[str, Any] | None) -> list[dict[str, Any]]:
    artifacts = _source_gate_artifacts(source_gate)
    rows = artifacts.get("conceptCoverage")
    if not isinstance(rows, list):
        return []
    needs: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        status = str(row.get("status") or "missing")
        if status == "direct":
            continue
        concept = str(row.get("concept") or row.get("title") or "").strip()
        location = str(row.get("location") or row.get("sectionId") or "course").strip()
        key = (concept, location)
        if not concept or key in seen:
            continue
        seen.add(key)
        needs.append(
            {
                "concept": concept,
                "location": location,
                "sectionId": row.get("sectionId"),
                "sourceSectionId": row.get("sourceSectionId"),
                "status": status,
                "sourceTypeHints": ["open_textbook", "lecture_notes", "practice", "video", "simulation", "lab"],
                "suggestedQueries": _source_need_query(title, concept),
            }
        )
    return needs


def _source_gap_content(description: str, gap: dict[str, Any]) -> list[dict[str, str]]:
    needs = gap.get("conceptSourceNeeds")
    if not isinstance(needs, list) or not needs:
        return [{"type": "text", "heading": "Course generation is paused", "value": description}]
    concept_lines = [
        f"- {need.get('concept')} ({need.get('location')})"
        for need in needs[:12]
        if isinstance(need, dict) and need.get("concept")
    ]
    value = description + "\n\nMissing concept source coverage:\n" + "\n".join(concept_lines)
    return [{"type": "text", "heading": "Course generation is paused", "value": value}]


def _source_gap_description(current_count: int, source_gate: dict[str, Any] | None = None) -> str:
    if source_gate:
        artifacts = _source_gate_artifacts(source_gate)
        strength = artifacts.get("sourceStrength") if isinstance(artifacts.get("sourceStrength"), dict) else {}
        score = strength.get("score")
        minimum = strength.get("minimumScore")
        score_text = f" Source strength is {score}/{minimum}." if score is not None and minimum is not None else ""
        return (
            f"This draft has {current_count} submitted source{'' if current_count == 1 else 's'}, "
            "but Lycium could not verify enough source strength for full learner-facing generation."
            f"{score_text} "
            "Add targeted benchmark, textbook, lecture, lab, video, simulation, or assignment sources for the uncovered concepts."
        )
    return (
        f"This draft has {current_count} submitted source"
        f"{'' if current_count == 1 else 's'}, but Lycium could not verify enough source strength "
        "before full course generation. Add benchmark, textbook, lecture, lab, video, simulation, or assignment sources."
    )


def _source_gap(title: str, current_count: int, source_gate: dict[str, Any] | None = None) -> dict[str, Any]:
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    gap_id = "concept-source-coverage" if source_gate else "course-source-minimum"
    gap = {
        "id": gap_id,
        "scopeType": "course",
        "scopeId": "course",
        "title": "Add concept sources" if source_gate else "Add course sources",
        "description": _source_gap_description(current_count, source_gate),
        "severity": "blocking",
        "minimumSourceCount": minimum_count,
        "currentSourceCount": current_count,
        "sourceTypeHints": ["university_catalog", "syllabus", "open_textbook", "video", "simulation", "lab"],
        "suggestedQueries": [
            f"{title} syllabus",
            f"{title} open textbook",
            f"{title} lecture notes",
        ],
    }
    if source_gate:
        artifacts = _source_gate_artifacts(source_gate)
        concept_needs = _concept_source_needs(title, source_gate)
        gap["coverageGate"] = {
            "gate": source_gate.get("gate") or "source_analysis",
            "status": source_gate.get("status") or "failed",
            "issues": _source_gate_issue_messages(source_gate)[:8],
            "metrics": artifacts,
        }
        gap["requiredConcepts"] = sorted({str(row.get("concept")) for row in artifacts.get("conceptCoverage", []) if isinstance(row, dict) and row.get("concept")})
        gap["conceptSourceNeeds"] = concept_needs
        gap["missingConceptSourceCount"] = len(concept_needs)
    return gap


def _candidate_source(candidate: dict[str, Any]) -> dict[str, Any] | None:
    source = candidate.get("source") if isinstance(candidate.get("source"), dict) else {}
    url = source.get("canonical_url") or source.get("canonicalUrl") or source.get("url") or candidate.get("url")
    if not isinstance(url, str) or not url.strip():
        return None
    return {
        "sourceId": source.get("public_id") or source.get("id") or candidate.get("sourceId"),
        "title": source.get("title") or candidate.get("title") or url,
        "url": url,
        "sourceType": source.get("source_type") or source.get("sourceType") or candidate.get("sourceType"),
        "score": candidate.get("score"),
        "matchedTerms": candidate.get("matched_terms") or candidate.get("matchedTerms") or [],
        "evidenceRefs": candidate.get("evidence_refs") or candidate.get("evidenceRefs") or [],
        "summary": candidate.get("summary"),
    }


def _search_query_for_need(title: str, need: dict[str, Any]) -> str:
    suggested = need.get("suggestedQueries")
    if isinstance(suggested, list):
        for query in suggested:
            if isinstance(query, str) and query.strip():
                return query.strip()
    concept = str(need.get("concept") or "").strip()
    return f"{title} {concept} open educational source".strip()


def _attach_source_index_suggestions(
    session: Session | None,
    *,
    title: str,
    gap: dict[str, Any],
    limit_per_need: int = 3,
) -> list[dict[str, Any]]:
    if session is None:
        return []
    needs = gap.get("conceptSourceNeeds")
    if not isinstance(needs, list) or not needs:
        return []
    suggestions: list[dict[str, Any]] = []
    for need in needs:
        if not isinstance(need, dict):
            continue
        query = _search_query_for_need(title, need)
        concept = str(need.get("concept") or "").strip()
        try:
            search = search_index_response(
                session,
                query=query,
                filters={"free_only": True, "topics": [concept] if concept else []},
                limit=limit_per_need,
            )
        except Exception as exc:  # pragma: no cover - defensive around detachable service availability
            need["sourceIndexSearchStatus"] = "unavailable"
            need["sourceIndexSearchError"] = str(exc)[:240]
            continue
        candidates = [
            candidate
            for result in search.get("results", [])
            if isinstance(result, dict) and (candidate := _candidate_source(result))
        ]
        need["sourceIndexSearchStatus"] = "searched"
        need["sourceIndexQuery"] = query
        need["sourceIndexCandidates"] = candidates
        if candidates:
            suggestions.append(
                {
                    "concept": concept,
                    "location": need.get("location"),
                    "sectionId": need.get("sectionId"),
                    "query": query,
                    "candidates": candidates,
                }
            )
    return suggestions


def source_gap_quality_report(snapshot: CourseSnapshot) -> dict[str, Any]:
    trace = snapshot.generation_trace if isinstance(snapshot.generation_trace, dict) else {}
    gate = trace.get("source_coverage_gate") if isinstance(trace.get("source_coverage_gate"), dict) else {}
    return {
        "gate": "generation",
        "passed": False,
        "score": 0.0,
        "errors": ["Course generation is blocked until source coverage meets the minimum policy."],
        "warnings": [],
        "metrics": {
            "currentSourceCount": int(gate.get("currentSourceCount") or 0),
            "minimumCourseSources": int(gate.get("minimumCourseSources") or SOURCE_COVERAGE_POLICY["minimumCourseSources"]),
        },
        "workflow": {"status": "needs_sources", "failedGate": "source_coverage"},
        "checkedAt": trace.get("checked_at") or trace.get("updated_at") or "",
        "contractVersion": "COURSE_AGENT_CONTRACT.md",
    }


def update_needs_sources_course_snapshot(
    snapshot: CourseSnapshot,
    *,
    source_urls: list[str] | None,
    source_gate: dict[str, Any] | None = None,
    source_packet: dict[str, Any] | None = None,
    generation_readiness: dict[str, Any] | None = None,
    session: Session | None = None,
) -> CourseSnapshot:
    title = snapshot.title
    clean_source_urls = _unique_source_urls(source_urls)
    current_count = len(clean_source_urls)
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    source_records = _source_records_from_input_urls(clean_source_urls, title)
    source_ids = [record["id"] for record in source_records]
    gap = _source_gap(title, current_count, source_gate)
    source_gap_suggestions = _attach_source_index_suggestions(session, title=title, gap=gap)
    if gap.get("conceptSourceNeeds"):
        gap["sourceResumeCoverage"] = summarize_concept_source_need_coverage(gap["conceptSourceNeeds"], clean_source_urls, source_packet)
    description = str(gap["description"])
    structure = dict(snapshot.structure or {})
    metadata = dict(structure.get("metadata") or {})
    metadata["status"] = "needs_sources"
    metadata["sourceCoveragePolicy"] = SOURCE_COVERAGE_POLICY
    metadata["sourceGaps"] = [gap]
    metadata["sourceGapSuggestions"] = source_gap_suggestions
    if isinstance(generation_readiness, dict):
        metadata["generationReadiness"] = generation_readiness
    metadata["generationPlan"] = {
        **(metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {}),
        "status": ["scoped", "needs_sources"],
        "mode": "source-gated-draft",
        "message": description,
    }
    structure.update(
        {
            "sourceIds": source_ids,
            "sourceRecords": source_records,
            "metadata": metadata,
            "modules": [
                {
                    "id": "source-planning",
                    "title": "Source planning",
                    "sourceIds": source_ids,
                    "learningObjectives": ["Attach enough relevant sources before course generation."],
                    "sections": [
                        {
                            "id": "source-planning-overview",
                            "title": "Add sources to continue",
                            "sectionType": "source-gap",
                            "pageType": "learn",
                            "sourceIds": source_ids,
                            "learningObjectives": ["Identify source gaps before generating course content."],
                            "estimatedMinutes": 5,
                            "content": _source_gap_content(description, gap),
                            "citations": [],
                        }
                    ],
                }
            ],
        }
    )
    snapshot.structure = structure
    snapshot.status = "needs_sources"
    snapshot.generation_trace = {
        **(snapshot.generation_trace if isinstance(snapshot.generation_trace, dict) else {}),
        "status": "needs_sources",
        "source_coverage_gate": {
            "passed": False,
            "currentSourceCount": current_count,
            "minimumCourseSources": minimum_count,
            "blockingGapIds": [gap["id"]],
            "failedGate": source_gate.get("gate") if source_gate else "source_coverage",
            "sourceAnalysis": source_gate,
        },
        "source_urls": clean_source_urls,
    }
    if isinstance(generation_readiness, dict):
        snapshot.generation_trace["generation_readiness"] = generation_readiness
    return snapshot


def create_needs_sources_course_snapshot(
    session: Session,
    *,
    prompt: str,
    learner_id: int | None,
    level: str | None,
    language: str,
    source_policy: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_urls: list[str] | None = None,
    source_packet: dict[str, Any] | None = None,
    category: str | None = None,
    department: str | None = None,
    source_gate: dict[str, Any] | None = None,
    generation_readiness: dict[str, Any] | None = None,
) -> CourseSnapshot:
    title = _title_from_prompt(prompt)
    clean_source_urls = _unique_source_urls(source_urls)
    effective_generation_readiness = (
        generation_readiness
        if isinstance(generation_readiness, dict)
        else build_generation_readiness_report(
            source_urls=clean_source_urls,
            source_packet=source_packet,
        )
    )
    current_count = len(clean_source_urls)
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    catalog_metadata = _catalog_metadata_from_prompt(prompt)
    course_category = category or catalog_metadata["category"]
    course_department = department or catalog_metadata["department"]
    source_records = _source_records_from_input_urls(clean_source_urls, title)
    source_ids = [record["id"] for record in source_records]
    gap = _source_gap(title, current_count, source_gate)
    source_gap_suggestions = _attach_source_index_suggestions(session, title=title, gap=gap)
    if gap.get("conceptSourceNeeds"):
        gap["sourceResumeCoverage"] = summarize_concept_source_need_coverage(gap["conceptSourceNeeds"], clean_source_urls, source_packet)
    gap_id = str(gap["id"])
    description = str(gap["description"])
    draft_outline = {
        "title": title,
        "shortDescription": f"Draft course waiting for source coverage: {prompt[:120].strip()}",
        "summary": "This course is scoped, but full generation is blocked until enough source evidence is attached.",
        "modules": [],
        "provenance": {"mode": "needs_sources", "source_urls": clean_source_urls},
    }
    draft = CourseDraft(
        learner_id=learner_id,
        title=title,
        prompt=prompt,
        target_audience=None,
        learning_goals=[],
        difficulty=level,
        expected_duration_minutes=expected_duration_minutes,
        language=language,
        constraints={
            "source_policy": source_policy,
            "source_urls": clean_source_urls,
            "source_coverage_policy": SOURCE_COVERAGE_POLICY,
            "desired_module_count": desired_module_count,
        },
        outline=draft_outline,
        status="needs_sources",
    )
    session.add(draft)
    session.flush()

    structure = {
        "title": title,
        "shortDescription": draft_outline["shortDescription"],
        "difficultyLevel": level or "undergrad",
        "category": course_category,
        "department": course_department,
        "tags": catalog_metadata["tags"],
        "learningTypes": [],
        "orderMandatory": False,
        "sourceIds": source_ids,
        "sourceRecords": source_records,
        "metadata": {
            "prompt": prompt,
            "pacingLabel": "Module",
            "status": "needs_sources",
            "version": 1,
            "durationMinutes": expected_duration_minutes,
            "sourceCoveragePolicy": SOURCE_COVERAGE_POLICY,
            "sourceGaps": [gap],
            "sourceGapSuggestions": source_gap_suggestions,
            "generationReadiness": effective_generation_readiness,
            "generationPlan": {
                "status": ["scoped", "needs_sources"],
                "mode": "source-gated-draft",
                "message": description,
            },
            "courseGenerationRules": [COURSE_GENERATION_RULES],
        },
        "modules": [
            {
                "id": "source-planning",
                "title": "Source planning",
                "sourceIds": source_ids,
                "learningObjectives": ["Attach enough relevant sources before course generation."],
                "sections": [
                    {
                        "id": "source-planning-overview",
                        "title": "Add sources to continue",
                        "sectionType": "source-gap",
                        "pageType": "learn",
                        "sourceIds": source_ids,
                        "learningObjectives": ["Identify source gaps before generating course content."],
                        "estimatedMinutes": 5,
                        "content": _source_gap_content(description, gap),
                        "citations": [],
                    }
                ],
            }
        ],
    }
    snapshot = CourseSnapshot(
        learner_id=learner_id,
        draft_id=draft.id,
        title=title,
        prompt=prompt,
        language=language,
        level=level,
        source_policy=source_policy,
        status="needs_sources",
        version=1,
        structure=structure,
        generation_trace={
            "status": "needs_sources",
            "source_coverage_gate": {
                "passed": False,
                "currentSourceCount": current_count,
                "minimumCourseSources": minimum_count,
                "blockingGapIds": [gap_id],
                "failedGate": source_gate.get("gate") if source_gate else "source_coverage",
                "sourceAnalysis": source_gate,
            },
            "generation_readiness": effective_generation_readiness,
            "source_urls": clean_source_urls,
        },
    )
    session.add(snapshot)
    session.flush()
    return snapshot
