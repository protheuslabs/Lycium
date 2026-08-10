from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.course_outline_from_source_packet import build_outline_from_source_packet
from app.course_coverage_checklists import build_outline_from_coverage_checklist
from app.course_generation_readiness import build_generation_readiness_report
from app.course_source_policy import SOURCE_COVERAGE_POLICY
from app.generation_helpers import (
    COURSE_GENERATION_RULES,
    _catalog_metadata_from_prompt,
    _title_from_prompt,
)
from app.generation_outline import build_outline
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


def _string_list(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


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


def _desired_module_count_from_snapshot(snapshot: CourseSnapshot) -> int:
    structure = snapshot.structure if isinstance(snapshot.structure, dict) else {}
    metadata = structure.get("metadata") if isinstance(structure.get("metadata"), dict) else {}
    generation_plan = metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {}
    raw_value = (
        generation_plan.get("desiredModuleCount")
        or metadata.get("desiredModuleCount")
        or (snapshot.generation_trace.get("desired_module_count") if isinstance(snapshot.generation_trace, dict) else None)
    )
    try:
        return max(1, min(20, int(raw_value)))
    except (TypeError, ValueError):
        return 12


def _source_gap_outline(
    session: Session | None,
    *,
    prompt: str,
    title: str,
    level: str | None,
    desired_module_count: int,
    source_packet: dict[str, Any] | None,
) -> dict[str, Any]:
    if isinstance(source_packet, dict):
        outline = build_outline_from_source_packet(
            prompt=prompt,
            source_packet=source_packet,
            desired_module_count=desired_module_count,
        )
        if isinstance(outline, dict) and isinstance(outline.get("modules"), list) and outline.get("modules"):
            return outline

    if session is not None:
        outline = build_outline(
            session,
            prompt=prompt,
            desired_module_count=desired_module_count,
            free_only=False,
            trust_min=0.0,
            level=level,
            learning_goals=[],
        )
        if isinstance(outline, dict) and isinstance(outline.get("modules"), list) and outline.get("modules"):
            return outline

    return build_outline_from_coverage_checklist(
        prompt=prompt or title,
        desired_module_count=desired_module_count,
        level=level,
    )


def _source_gap_sections_for_module(
    module: dict[str, Any],
    *,
    prompt: str,
    source_ids: list[str],
) -> list[dict[str, Any]]:
    sections = module.get("sections") if isinstance(module.get("sections"), list) else []
    planned_sections: list[dict[str, Any]] = []
    course_title = _title_from_prompt(prompt)
    module_id = str(module.get("id") or "")
    module_title = str(module.get("title") or "Planned module")

    for section_index, section in enumerate(sections, start=1):
        if not isinstance(section, dict):
            continue
        section_id = str(section.get("id") or f"{module_id or 'module'}-s{section_index:02d}")
        section_title = str(section.get("title") or f"Planned section {section_index}")
        coverage_item_ids = _string_list(section.get("assignedCoverageItemIds") or section.get("coverageItemIds"))
        coverage_item_id = str(section.get("coverageItemId") or (coverage_item_ids[0] if coverage_item_ids else "")).strip()
        if coverage_item_id and coverage_item_id not in coverage_item_ids:
            coverage_item_ids = [coverage_item_id, *coverage_item_ids]
        coverage_must_teach = _string_list(section.get("coverageMustTeach") or section.get("coverage_must_teach"))
        concept_keywords = (
            _string_list(section.get("concept_keywords") or section.get("conceptKeywords"))
            or coverage_must_teach
        )
        raw_section_source_ids = section.get("sourceIds") or section.get("source_ids") or []
        section_source_ids = [value for value in raw_section_source_ids if isinstance(value, str) and value in source_ids]
        learning_objectives = _string_list(section.get("learning_objectives") or section.get("learningObjectives"))
        primary_concept = (concept_keywords or [section_title])[0].replace("_", " ")
        learning_outcome = str(section.get("learningOutcome") or section.get("learning_outcome") or "").strip()
        if not learning_outcome:
            learning_outcome = f"Explain {primary_concept} and use it in the context of {course_title}."
        if not learning_objectives:
            learning_objectives = [learning_outcome]
        planned_description = str(section.get("description") or section.get("summary") or "").strip()
        if not planned_description:
            concept_text = ", ".join(concept.replace("_", " ") for concept in concept_keywords[:4])
            planned_description = (
                f"Planning reference for section fill: teach {section_title}"
                + (f" through {concept_text}" if concept_text else "")
                + f" as part of {module_title}."
            )
        planned_sections.append(
            {
                "id": section_id,
                "title": section_title,
                "sectionType": "lesson",
                "pageType": "learn",
                "sourceIds": [],
                "description": planned_description,
                "learningObjectives": learning_objectives,
                "estimatedMinutes": int(section.get("estimated_minutes") or 20),
                "assignedCoverageItemIds": coverage_item_ids,
                "coverageItemId": coverage_item_id,
                "coverageMustTeach": coverage_must_teach,
                "metadata": {
                    "generationOutline": {
                        "contractVersion": "section-generation-outline-v1",
                        "role": "section_plan",
                        "planningSource": "outline_before_sources",
                        "moduleOutlineId": module_id,
                        "moduleOutlineTitle": module_title,
                        "sectionOutlineId": section_id,
                        "sectionOutlineTitle": section_title,
                        "plannedDescription": planned_description,
                        "plannedLearningOutcome": learning_outcome,
                        "plannedConceptKeywords": concept_keywords,
                        "plannedLearningObjectives": learning_objectives,
                        "plannedSourceIds": section_source_ids,
                        "candidateSourceIds": section_source_ids,
                        "assignedCoverageItemIds": coverage_item_ids,
                        "coverageItemId": coverage_item_id,
                        "coverageMustTeach": coverage_must_teach,
                        "sourceNeeds": [
                            f"Add sources that can support learner-facing content for {concept}."
                            for concept in (concept_keywords or [section_title])[:4]
                        ],
                        "contentStatus": "planned_empty",
                        "nextWorkflow": "section_fill",
                        "rebuildScopes": ["section_plan", "section_content"],
                        "sourceReviewRequired": True,
                    }
                },
                "content": [],
                "citations": [],
            }
        )

    if planned_sections:
        return planned_sections

    section_id = f"{module_id or 'module'}-source-gap"
    section_title = f"Introduction to {module_title}"
    planned_description = f"Planning reference for section fill: introduce the main ideas in {module_title} and connect them to {course_title}."
    learning_outcome = f"Explain the main ideas in {module_title} and identify which source evidence is still needed."
    return [
        {
            "id": section_id,
            "title": section_title,
            "sectionType": "lesson",
            "pageType": "learn",
            "sourceIds": [],
            "description": planned_description,
            "learningObjectives": [learning_outcome],
            "estimatedMinutes": 20,
            "metadata": {
                "generationOutline": {
                    "contractVersion": "section-generation-outline-v1",
                    "role": "section_plan",
                    "planningSource": "outline_before_sources",
                    "moduleOutlineId": module_id,
                    "moduleOutlineTitle": module_title,
                    "sectionOutlineId": section_id,
                    "sectionOutlineTitle": section_title,
                    "plannedDescription": planned_description,
                    "plannedLearningOutcome": learning_outcome,
                    "plannedConceptKeywords": [],
                    "plannedLearningObjectives": [learning_outcome],
                    "plannedSourceIds": [],
                    "candidateSourceIds": [],
                    "sourceNeeds": [f"Add sources that can support learner-facing content for {module_title}."],
                    "contentStatus": "planned_empty",
                    "nextWorkflow": "section_fill",
                    "rebuildScopes": ["section_plan", "section_content"],
                    "sourceReviewRequired": True,
                }
            },
            "content": [],
            "citations": [],
        }
    ]


def _needs_sources_structure(
    *,
    title: str,
    prompt: str,
    level: str | None,
    expected_duration_minutes: int,
    category: str,
    department: str,
    source_ids: list[str],
    source_records: list[dict[str, Any]],
    gap: dict[str, Any],
    generation_readiness: dict[str, Any],
    outline: dict[str, Any],
) -> dict[str, Any]:
    modules = outline.get("modules") if isinstance(outline.get("modules"), list) else []
    structured_modules = [
        {
            "id": str(module.get("id") or f"source-gap-module-{index}"),
            "title": str(module.get("title") or f"Module {index}"),
            "sourceIds": source_ids,
            "learningObjectives": module.get("learning_objectives", []),
            "assignedCoverageItemIds": _string_list(module.get("assignedCoverageItemIds")),
            "coverageAllocationStatus": module.get("coverageAllocationStatus"),
            "sections": _source_gap_sections_for_module(module, prompt=prompt, source_ids=source_ids),
        }
        for index, module in enumerate(modules, start=1)
        if isinstance(module, dict)
    ]

    if not structured_modules:
        module_title = f"Module 1: Foundations of {title}"
        structured_modules = [
            {
                "id": "best-effort-foundations",
                "title": module_title,
                "sourceIds": source_ids,
                "learningObjectives": [f"Explain foundational ideas in {title}."],
                "sections": _source_gap_sections_for_module(
                    {
                        "id": "best-effort-foundations",
                        "title": module_title,
                        "sections": [
                            {
                                "id": "best-effort-foundations-overview",
                                "title": f"Foundational ideas in {title}",
                                "learning_objectives": [f"Explain foundational ideas in {title}."],
                                "concept_keywords": ["foundations"],
                                "estimated_minutes": 20,
                            }
                        ],
                    },
                    prompt=prompt,
                    source_ids=source_ids,
                ),
            }
        ]

    coverage_checklist = outline.get("coverageChecklist") if isinstance(outline.get("coverageChecklist"), dict) else {}
    coverage_report = (
        outline.get("coverageAllocationReport")
        if isinstance(outline.get("coverageAllocationReport"), dict)
        else {}
    )
    metadata: dict[str, Any] = {
        "prompt": prompt,
        "pacingLabel": "Week" if any(str(module.get("title") or "").startswith("Week ") for module in modules if isinstance(module, dict)) else "Module",
        "status": "needs_sources",
        "version": 1,
        "durationMinutes": expected_duration_minutes,
        "sourceCoveragePolicy": SOURCE_COVERAGE_POLICY,
        "sourceGaps": [gap],
        "generationReadiness": generation_readiness,
        "generationPlan": {
            "status": ["scoped", "outline_planned", "sections_planned", "needs_sources"],
            "mode": "outline_first_empty_section_plan",
            "message": str(gap.get("description") or ""),
            "desiredModuleCount": len(structured_modules),
            "moduleOutlines": modules,
            "planningSource": str(outline.get("provenance", {}).get("mode") or "outline"),
            "coverageChecklistContract": str(coverage_checklist.get("contractVersion") or ""),
            "coverageAllocationStatus": str(coverage_report.get("status") or ""),
            "nextWorkflow": "section_fill",
            "rebuildScopes": ["course_outline", "module_outline", "section_plan", "section_content"],
        },
        "courseBuildOutline": outline,
        "courseGenerationRules": [COURSE_GENERATION_RULES],
    }
    if coverage_checklist:
        metadata["courseCoverageChecklist"] = coverage_checklist
    if coverage_report:
        metadata["courseCoverageAllocationReport"] = coverage_report

    return {
        "title": title,
        "shortDescription": str(
            outline.get("shortDescription")
            or f"A best-effort course draft covering the foundations and applications of {title}."
        ),
        "difficultyLevel": level or "undergrad",
        "category": category,
        "department": department,
        "tags": _catalog_metadata_from_prompt(prompt)["tags"],
        "learningTypes": [],
        "orderMandatory": False,
        "sourceIds": source_ids,
        "sourceRecords": source_records,
        "metadata": metadata,
        "modules": structured_modules,
    }


def _source_gap_description(current_count: int, source_gate: dict[str, Any] | None = None) -> str:
    if source_gate:
        artifacts = _source_gate_artifacts(source_gate)
        strength = artifacts.get("sourceStrength") if isinstance(artifacts.get("sourceStrength"), dict) else {}
        score = strength.get("score")
        minimum = strength.get("minimumScore")
        score_text = f" Source strength is {score}/{minimum}." if score is not None and minimum is not None else ""
        return (
            f"This draft has {current_count} submitted source{'' if current_count == 1 else 's'}, "
            "but Lycium could not verify enough source strength for review-ready source grounding."
            f"{score_text} "
            "Add targeted benchmark, textbook, lecture, lab, video, simulation, or assignment sources for the uncovered concepts."
        )
    return (
        f"This draft has {current_count} submitted source"
        f"{'' if current_count == 1 else 's'}, but Lycium could not verify enough source strength "
        "for review-ready source grounding. Add benchmark, textbook, lecture, lab, video, simulation, or assignment sources."
    )


def _source_gap(title: str, current_count: int, source_gate: dict[str, Any] | None = None) -> dict[str, Any]:
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    concept_needs = _concept_source_needs(title, source_gate)
    gap_id = "concept-source-coverage" if concept_needs else "source-strength" if source_gate else "course-source-minimum"
    gap = {
        "id": gap_id,
        "scopeType": "course",
        "scopeId": "course",
        "title": "Add concept sources" if concept_needs else "Strengthen course sources" if source_gate else "Add course sources",
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
        "errors": ["Course publication is blocked until source coverage meets the minimum policy."],
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
    title = _title_from_prompt(snapshot.prompt)
    snapshot.title = title
    clean_source_urls = _unique_source_urls(source_urls)
    current_count = len(clean_source_urls)
    minimum_count = int(SOURCE_COVERAGE_POLICY["minimumCourseSources"])
    source_records = _source_records_from_input_urls(clean_source_urls, title)
    source_ids = [record["id"] for record in source_records]
    gap = _source_gap(title, current_count, source_gate)
    source_gap_suggestions = _attach_source_index_suggestions(session, title=title, gap=gap)
    if gap.get("conceptSourceNeeds"):
        gap["sourceResumeCoverage"] = summarize_concept_source_need_coverage(gap["conceptSourceNeeds"], clean_source_urls, source_packet)
    structure = dict(snapshot.structure or {})
    metadata = dict(structure.get("metadata") or {})
    outline = metadata.get("courseBuildOutline") if isinstance(metadata.get("courseBuildOutline"), dict) else None
    if outline is None:
        outline = _source_gap_outline(
            session,
            prompt=snapshot.prompt,
            title=title,
            level=snapshot.level,
            desired_module_count=_desired_module_count_from_snapshot(snapshot),
            source_packet=source_packet,
        )
    effective_generation_readiness = (
        generation_readiness
        if isinstance(generation_readiness, dict)
        else build_generation_readiness_report(
            source_urls=clean_source_urls,
            source_packet=source_packet,
        )
    )
    structure = _needs_sources_structure(
        title=title,
        prompt=snapshot.prompt,
        level=snapshot.level,
        expected_duration_minutes=int(metadata.get("durationMinutes") or 180),
        category=str(structure.get("category") or _catalog_metadata_from_prompt(snapshot.prompt)["category"]),
        department=str(structure.get("department") or _catalog_metadata_from_prompt(snapshot.prompt)["department"]),
        source_ids=source_ids,
        source_records=source_records,
        gap=gap,
        generation_readiness=effective_generation_readiness,
        outline=outline,
    )
    structure["metadata"]["sourceGapSuggestions"] = source_gap_suggestions
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
    snapshot.generation_trace["generation_readiness"] = effective_generation_readiness
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
    draft_outline = {
        "title": title,
        "shortDescription": f"A best-effort course draft covering the foundations and applications of {title}.",
        "summary": "This course has a complete outline and empty planned sections that still require source review and content generation.",
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

    outline = _source_gap_outline(
        session,
        prompt=prompt,
        title=title,
        level=level,
        desired_module_count=desired_module_count,
        source_packet=source_packet,
    )
    draft.outline = outline
    structure = _needs_sources_structure(
        title=title,
        prompt=prompt,
        level=level,
        expected_duration_minutes=expected_duration_minutes,
        category=course_category,
        department=course_department,
        source_ids=source_ids,
        source_records=source_records,
        gap=gap,
        generation_readiness=effective_generation_readiness,
        outline=outline,
    )
    structure["metadata"]["sourceGapSuggestions"] = source_gap_suggestions
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
