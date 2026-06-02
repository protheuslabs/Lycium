from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.generation_helpers import COURSE_GENERATION_RULES, _catalog_metadata_from_prompt, _title_from_prompt
from app.models import CourseDraft, CourseSnapshot


SOURCE_COVERAGE_POLICY: dict[str, Any] = {
    "minimumCourseSources": 3,
    "minimumSourcesPerModule": 1,
    "minimumRequiredConceptCoveragePercent": 70,
    "requireBenchmarkEvidence": False,
    "requireAssessmentCoverage": True,
}


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


def _source_gap_description(current_count: int) -> str:
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    return (
        f"This draft has {current_count} submitted source"
        f"{'' if current_count == 1 else 's'}, but Lycium requires at least {minimum_count} course-level sources "
        "before full course generation. Add benchmark, textbook, lecture, lab, video, simulation, or assignment sources."
    )


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
) -> CourseSnapshot:
    title = snapshot.title
    clean_source_urls = _unique_source_urls(source_urls)
    current_count = len(clean_source_urls)
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    source_records = _source_records_from_input_urls(clean_source_urls, title)
    source_ids = [record["id"] for record in source_records]
    description = _source_gap_description(current_count)
    gap = {
        "id": "course-source-minimum",
        "scopeType": "course",
        "scopeId": "course",
        "title": "Add course sources",
        "description": description,
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
    structure = dict(snapshot.structure or {})
    metadata = dict(structure.get("metadata") or {})
    metadata["status"] = "needs_sources"
    metadata["sourceCoveragePolicy"] = SOURCE_COVERAGE_POLICY
    metadata["sourceGaps"] = [gap]
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
                            "content": [{"type": "text", "heading": "Course generation is paused", "value": description}],
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
            "blockingGapIds": ["course-source-minimum"],
        },
        "source_urls": clean_source_urls,
    }
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
    category: str | None = None,
    department: str | None = None,
) -> CourseSnapshot:
    title = _title_from_prompt(prompt)
    clean_source_urls = _unique_source_urls(source_urls)
    current_count = len(clean_source_urls)
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    catalog_metadata = _catalog_metadata_from_prompt(prompt)
    course_category = category or catalog_metadata["category"]
    course_department = department or catalog_metadata["department"]
    gap_id = "course-source-minimum"
    source_records = _source_records_from_input_urls(clean_source_urls, title)
    source_ids = [record["id"] for record in source_records]
    description = _source_gap_description(current_count)
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
            "sourceGaps": [
                {
                    "id": gap_id,
                    "scopeType": "course",
                    "scopeId": "course",
                    "title": "Add course sources",
                    "description": description,
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
            ],
            "sourceGapSuggestions": [],
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
                        "content": [{"type": "text", "heading": "Course generation is paused", "value": description}],
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
            },
            "source_urls": clean_source_urls,
        },
    )
    session.add(snapshot)
    session.flush()
    return snapshot
