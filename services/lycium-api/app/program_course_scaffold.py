from __future__ import annotations

import re
from typing import Any

from app.course_build_task_reports import build_course_build_task_report, build_program_course_shell_readiness_report
from app.curriculum_assembly_policy import (
    cluster_generation_threshold_report,
    curriculum_assembly_threshold_policy,
    program_generation_threshold_report,
)
from app.program_course_shell_actions import build_program_course_shell_action_plan
from app.program_source_acquisition import build_program_source_acquisition_plan


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "program"


def _tokens(value: str) -> set[str]:
    return {
        token
        for token in re.split(r"[^a-z0-9+#]+", value.lower())
        if len(token) >= 3 and token not in {"course", "module", "section", "intro", "introduction", "foundations"}
    }


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _content_text(course: dict[str, Any]) -> str:
    fields = [
        str(course.get("title") or ""),
        str(course.get("shortDescription") or ""),
        str(course.get("category") or ""),
        str(course.get("department") or ""),
        " ".join(_strings(course.get("tags"))),
        " ".join(_strings(course.get("moduleTitles"))),
        " ".join(_strings(course.get("sectionTitles"))),
        " ".join(_strings(course.get("conceptTitles"))),
    ]
    return " ".join(fields)


def _overlap_ratio(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / max(1, len(left))


def _known_course_index(
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for course_id in known_course_ids or set():
        index[_slugify(course_id)] = {"courseId": course_id, "title": course_id, "matchSource": "course_id"}
    for course in known_courses or []:
        course_id = str(course.get("courseId") or course.get("id") or course.get("key") or "").strip()
        title = str(course.get("title") or course_id).strip()
        row = {**course, "courseId": course_id or _slugify(title), "title": title}
        if course_id:
            index[_slugify(course_id)] = {**row, "matchSource": "course_id"}
        if title:
            index[_slugify(title)] = {**row, "matchSource": "title"}
    return index


def _course_fit_evidence(
    *,
    course_id: str,
    title: str,
    group: dict[str, Any],
    candidate: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not candidate:
        return None
    title_slug_match = _slugify(title) == _slugify(str(candidate.get("title") or ""))
    course_id_match = _slugify(course_id) == _slugify(str(candidate.get("courseId") or ""))
    requirement_terms = _tokens(" ".join([
        title,
        str(group.get("title") or ""),
        str(group.get("displayName") or ""),
        str(group.get("purpose") or ""),
    ]))
    module_terms = _tokens(" ".join(_strings(candidate.get("moduleTitles"))))
    section_terms = _tokens(" ".join(_strings(candidate.get("sectionTitles"))))
    concept_terms = _tokens(" ".join(_strings(candidate.get("conceptTitles"))))
    catalog_terms = _tokens(_content_text(candidate))
    module_score = _overlap_ratio(requirement_terms, module_terms)
    section_score = _overlap_ratio(requirement_terms, section_terms)
    concept_score = _overlap_ratio(requirement_terms, concept_terms)
    catalog_score = _overlap_ratio(requirement_terms, catalog_terms)
    reverse_catalog_score = _overlap_ratio(catalog_terms, requirement_terms)
    has_content_evidence = bool(module_terms or section_terms or concept_terms)
    fit_score = max(
        0.95 if course_id_match else 0.0,
        0.82 if title_slug_match and has_content_evidence else 0.0,
        0.72 if title_slug_match else 0.0,
        module_score,
        section_score,
        concept_score,
        catalog_score * 0.86,
        reverse_catalog_score * 0.68,
    )
    if has_content_evidence and title_slug_match and max(module_score, section_score, concept_score, catalog_score) < 0.2:
        fit_score = 0.58
    status = "accepted" if fit_score >= 0.7 else "needs_review"
    return {
        "contractVersion": "course-fit-evidence-v1",
        "status": status,
        "fitScore": round(fit_score, 4),
        "candidateCourseId": str(candidate.get("courseId") or ""),
        "candidateTitle": str(candidate.get("title") or ""),
        "candidateStatus": str(candidate.get("status") or ""),
        "matchSource": str(candidate.get("matchSource") or ""),
        "signals": {
            "courseIdMatch": course_id_match,
            "titleMatch": title_slug_match,
            "contentEvidenceAvailable": has_content_evidence,
            "moduleTitleOverlap": round(module_score, 4),
            "sectionTitleOverlap": round(section_score, 4),
            "conceptTitleOverlap": round(concept_score, 4),
            "catalogOverlap": round(catalog_score, 4),
            "reverseCatalogOverlap": round(reverse_catalog_score, 4),
        },
        "inspectedFields": ["title", "shortDescription", "tags", "moduleTitles", "sectionTitles", "conceptTitles"],
    }


def _unique_known_course_candidates(known_index: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: dict[str, dict[str, Any]] = {}
    for course in known_index.values():
        course_id = str(course.get("courseId") or course.get("title") or "").strip()
        title = str(course.get("title") or course_id).strip()
        key = _slugify(course_id or title)
        if key and key not in candidates:
            candidates[key] = course
    return list(candidates.values())


def _best_known_course_match(
    *,
    course_id: str,
    title: str,
    group: dict[str, Any],
    known_index: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    exact = known_index.get(_slugify(course_id)) or known_index.get(_slugify(title))
    if exact:
        return exact, _course_fit_evidence(course_id=course_id, title=title, group=group, candidate=exact)

    best_candidate: dict[str, Any] | None = None
    best_evidence: dict[str, Any] | None = None
    best_score = 0.0
    for candidate in _unique_known_course_candidates(known_index):
        evidence = _course_fit_evidence(course_id=course_id, title=title, group=group, candidate=candidate)
        if not evidence:
            continue
        score = float(evidence.get("fitScore") or 0)
        if score > best_score:
            best_candidate = candidate
            best_evidence = evidence
            best_score = score
    return best_candidate, best_evidence


def _requirement_course_ids(requirements: list[dict[str, Any]]) -> list[str]:
    course_ids: list[str] = []

    def add_course_id(course_id: Any) -> None:
        clean = str(course_id or "").strip()
        if clean and clean not in course_ids:
            course_ids.append(clean)

    def visit(requirement: dict[str, Any]) -> None:
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            add_course_id(requirement.get("courseId"))
        elif requirement_type == "complete_n_of_courses":
            for course_id in requirement.get("courseIds") or []:
                add_course_id(course_id)
        elif requirement_type == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested)

    for requirement in requirements:
        visit(requirement)
    return course_ids


def _course_build_task(
    *,
    course_id: str,
    title: str,
    action: str,
    status: str,
    prerequisite_course_ids: list[str],
    importance: str,
) -> dict[str, Any]:
    if action == "link_existing_course":
        return {
            "contractVersion": "course-build-task-v1",
            "courseId": course_id,
            "title": title,
            "status": "linked_existing_course",
            "nextAction": "review_existing_course_fit",
            "requiredInputs": [],
            "prerequisiteCourseIds": prerequisite_course_ids,
            "importance": importance,
        }
    return {
        "contractVersion": "course-build-task-v1",
        "courseId": course_id,
        "title": title,
        "status": "source_gathering",
        "nextAction": "attach_source_packet",
        "requiredInputs": ["source_packet", "concept_source_coverage"],
        "prerequisiteCourseIds": prerequisite_course_ids,
        "importance": importance,
        "stageOrder": ["source_gathering", "outline_ready", "section_generation_ready", "ready_for_review"],
        "currentStage": "source_gathering" if status == "needs_course_buildout" else status,
    }


def _course_wrapper(
    *,
    course_id: str,
    title: str,
    group: dict[str, Any],
    requirement: dict[str, Any],
    source_request: dict[str, Any],
) -> dict[str, Any]:
    cluster_title = str(group.get("displayName") or group.get("title") or group.get("id") or "")
    return {
        "contractVersion": "course-wrapper-v1",
        "courseId": course_id,
        "title": title,
        "status": "wrapper",
        "clusterId": str(group.get("id") or ""),
        "clusterTitle": cluster_title,
        "requirementId": str(requirement.get("id") or ""),
        "generationPrompt": (
            f"Generate an editor-native, source-backed course for '{title}' inside the '{cluster_title}' cluster. "
            "Use the attached source packet and concept coverage map before drafting learner-facing content."
        ),
        "requiredConcepts": source_request.get("requiredConcepts") or [],
        "generationMode": "active_generation",
        "batchSizeModules": 2,
        "learnerPlaceholderText": "Section not yet generated",
    }


def _active_generation_plan(
    *,
    course_id: str,
    title: str,
    source_request: dict[str, Any],
    status: str,
) -> dict[str, Any]:
    concepts = _strings(source_request.get("requiredConcepts")) or [title.replace(" Course", "").strip()]
    module_count = max(4, min(12, len(concepts) + 2))
    planned_modules = [
        {
            "moduleIndex": index,
            "title": f"Module {index}: {concepts[(index - 1) % len(concepts)].title()}",
            "status": "not_generated",
            "requiredConcepts": [concepts[(index - 1) % len(concepts)]],
        }
        for index in range(1, module_count + 1)
    ]
    batches = [
        {
            "batchIndex": (index // 2) + 1,
            "moduleIndexes": [module["moduleIndex"] for module in planned_modules[index : index + 2]],
            "status": "blocked_by_sources" if status == "needs_course_buildout" else "not_generated",
            "trigger": "manual_generate_button_or_progression",
        }
        for index in range(0, len(planned_modules), 2)
    ]
    return {
        "contractVersion": "active-course-generation-plan-v1",
        "courseId": course_id,
        "title": title,
        "status": "needs_sources" if status == "needs_course_buildout" else "ready",
        "mode": "on_demand_module_batches",
        "batchSizeModules": 2,
        "materializationPolicy": "generate_bottom_level_requisite_courses_first",
        "sourcePolicy": "open_source_popup_before_generation_when_coverage_is_incomplete",
        "learnerPlaceholderText": "Section not yet generated",
        "plannedModuleCount": len(planned_modules),
        "plannedModules": planned_modules,
        "batches": batches,
    }


def _source_request_for_requirement(
    *,
    goal_title: str,
    requirement: dict[str, Any],
    course_id: str,
    title: str,
) -> dict[str, Any]:
    origin = requirement.get("origin") if isinstance(requirement.get("origin"), dict) else {}
    evidence_refs = [
        str(value)
        for value in origin.get("evidenceRefs", [])
        if isinstance(value, str) and value.strip()
    ] if isinstance(origin.get("evidenceRefs"), list) else []
    required_concepts = [
        str(value)
        for value in (
            origin.get("concepts")
            or origin.get("topics")
            or origin.get("requiredConcepts")
            or []
        )
        if isinstance(value, str) and value.strip()
    ] if isinstance(origin.get("concepts") or origin.get("topics") or origin.get("requiredConcepts"), list) else []
    if not required_concepts:
        required_concepts = [title.replace(" Course", "").strip()]
    queries: list[str] = []
    for concept in required_concepts[:4]:
        queries.extend(
            [
                f"{goal_title} {concept} syllabus",
                f"{concept} open educational resource",
                f"{concept} lecture notes",
            ]
        )
    return {
        "contractVersion": "course-source-request-v1",
        "courseId": course_id,
        "title": title,
        "requirementId": str(requirement.get("id") or ""),
        "importance": str(requirement.get("importance") or "required"),
        "requiredConcepts": required_concepts[:12],
        "suggestedQueries": queries[:12],
        "sourceTypeHints": ["syllabus", "open_textbook", "lecture_notes", "video", "practice"],
        "minimumConceptCoverageRatio": 0.7,
        "evidenceRefs": evidence_refs[:10],
    }


def _requirement_description(requirement: dict[str, Any], title: str) -> str:
    description = str(requirement.get("description") or "").strip()
    if description:
        return description
    return f"Complete a source-backed course covering {title}."


def _course_kind_summary(
    *,
    course_id: str,
    title: str,
    requirement: dict[str, Any],
    action: dict[str, Any],
    source_request: dict[str, Any],
    course_build_task: dict[str, Any],
    prerequisite_course_ids: list[str],
    importance: str,
) -> dict[str, Any]:
    creates_empty_shell = action.get("action") == "create_empty_course"
    return {
        "contractVersion": "cluster-course-kind-v1",
        "courseId": course_id,
        "requirementId": str(requirement.get("id") or ""),
        "title": title,
        "description": _requirement_description(requirement, title),
        "action": str(action.get("action") or ""),
        "status": "empty_course_shell" if creates_empty_shell else "linked_existing_course",
        "sourceStatus": "needs_sources" if creates_empty_shell else "existing_course_available",
        "estimatedHours": requirement.get("estimatedHours"),
        "importance": importance,
        "prerequisiteCourseIds": list(prerequisite_course_ids),
        "requiredConcepts": source_request.get("requiredConcepts") if creates_empty_shell else [],
        "courseBuildTaskStatus": str(course_build_task.get("status") or ""),
    }


def build_course_scaffold_plan(
    groups: list[dict[str, Any]],
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    known_index = _known_course_index(known_course_ids, known_courses)
    clusters: list[dict[str, Any]] = []
    cluster_course_kinds: dict[str, list[dict[str, Any]]] = {}
    courses: list[dict[str, Any]] = []
    prior_group_course_ids: list[str] = []

    def course_action(course_id: str, title: str, group: dict[str, Any]) -> dict[str, Any]:
        existing, fit_evidence = _best_known_course_match(
            course_id=course_id,
            title=title,
            group=group,
            known_index=known_index,
        )
        if existing and fit_evidence and fit_evidence["fitScore"] >= 0.7:
            return {
                "action": "link_existing_course",
                "status": "existing_course_available",
                "existingCourseId": str(existing.get("courseId") or course_id),
                "courseFitEvidence": fit_evidence,
            }
        if fit_evidence:
            return {"action": "create_empty_course", "status": "needs_course_buildout", "courseFitEvidence": fit_evidence}
        return {"action": "create_empty_course", "status": "needs_course_buildout", "courseFitEvidence": None}

    def visit(requirement: dict[str, Any], group: dict[str, Any], prerequisite_course_ids: list[str]) -> None:
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            course_id = str(requirement.get("courseId") or "")
            title = str(requirement.get("title") or course_id)
            action = course_action(course_id, title, group)
            importance = str(requirement.get("importance") or "required")
            prerequisite_ids = list(prerequisite_course_ids)
            source_request = _source_request_for_requirement(
                goal_title=str(group.get("title") or group.get("displayName") or title),
                requirement=requirement,
                course_id=course_id,
                title=title,
            )
            course_build_task = _course_build_task(
                course_id=course_id,
                title=title,
                action=action["action"],
                status=action["status"],
                prerequisite_course_ids=prerequisite_ids,
                importance=importance,
            )
            cluster_course_kinds.setdefault(str(group.get("id") or ""), []).append(
                _course_kind_summary(
                    course_id=course_id,
                    title=title,
                    requirement=requirement,
                    action=action,
                    source_request=source_request,
                    course_build_task=course_build_task,
                    prerequisite_course_ids=prerequisite_ids,
                    importance=importance,
                )
            )
            courses.append({
                "clusterId": group["id"],
                "requirementId": requirement["id"],
                "courseId": course_id,
                "title": title,
                "description": _requirement_description(requirement, title),
                **action,
                "estimatedHours": requirement.get("estimatedHours"),
                "importance": importance,
                "prerequisiteCourseIds": prerequisite_ids,
                "sourceRequest": source_request if action["action"] == "create_empty_course" else None,
                "courseWrapper": _course_wrapper(
                    course_id=course_id,
                    title=title,
                    group=group,
                    requirement=requirement,
                    source_request=source_request,
                ) if action["action"] == "create_empty_course" else None,
                "activeGenerationPlan": _active_generation_plan(
                    course_id=course_id,
                    title=title,
                    source_request=source_request,
                    status=action["status"],
                ) if action["action"] == "create_empty_course" else None,
                "courseBuildTask": course_build_task,
            })
        elif requirement_type == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested, group, prerequisite_course_ids)
        elif requirement_type == "complete_n_of_courses":
            for course_id in requirement.get("courseIds") or []:
                if isinstance(course_id, str) and course_id:
                    action = course_action(course_id, course_id, group)
                    importance = str(requirement.get("importance") or "required")
                    prerequisite_ids = list(prerequisite_course_ids)
                    source_request = _source_request_for_requirement(
                        goal_title=str(group.get("title") or group.get("displayName") or course_id),
                        requirement=requirement,
                        course_id=course_id,
                        title=course_id,
                    )
                    course_build_task = _course_build_task(
                        course_id=course_id,
                        title=course_id,
                        action=action["action"],
                        status=action["status"],
                        prerequisite_course_ids=prerequisite_ids,
                        importance=importance,
                    )
                    cluster_course_kinds.setdefault(str(group.get("id") or ""), []).append(
                        _course_kind_summary(
                            course_id=course_id,
                            title=course_id,
                            requirement=requirement,
                            action=action,
                            source_request=source_request,
                            course_build_task=course_build_task,
                            prerequisite_course_ids=prerequisite_ids,
                            importance=importance,
                        )
                    )
                    courses.append({
                        "clusterId": group["id"],
                        "requirementId": requirement["id"],
                        "courseId": course_id,
                        "title": course_id,
                        "description": _requirement_description(requirement, course_id),
                        **action,
                        "estimatedHours": requirement.get("estimatedHours"),
                        "importance": importance,
                        "prerequisiteCourseIds": prerequisite_ids,
                        "sourceRequest": source_request if action["action"] == "create_empty_course" else None,
                        "courseWrapper": _course_wrapper(
                            course_id=course_id,
                            title=course_id,
                            group=group,
                            requirement=requirement,
                            source_request=source_request,
                        ) if action["action"] == "create_empty_course" else None,
                        "activeGenerationPlan": _active_generation_plan(
                            course_id=course_id,
                            title=course_id,
                            source_request=source_request,
                            status=action["status"],
                        ) if action["action"] == "create_empty_course" else None,
                        "courseBuildTask": course_build_task,
                    })

    for group in groups:
        group_requirements = _items(group.get("requirements"))
        prerequisite_course_ids = list(prior_group_course_ids)
        cluster_id = str(group["id"])
        course_kinds = cluster_course_kinds.setdefault(cluster_id, [])
        cluster_row = {
            "clusterId": cluster_id,
            "title": str(group.get("displayName") or group.get("title") or group["id"]),
            "description": str(group.get("description") or group.get("purpose") or ""),
            "action": "create_cluster",
            "workflow": {
                "contractVersion": "cluster-generation-workflow-v1",
                "status": "planned",
                "courseFitPolicy": "inspect_existing_course_titles_modules_sections_and_concepts_before_linking",
                "missingCoursePolicy": "create_course_wrappers_not_full_courses",
            },
            "locked": False,
            "estimatedHours": group.get("estimatedHours"),
            "prerequisiteCourseIds": prerequisite_course_ids,
            "courseKinds": course_kinds,
        }
        clusters.append(cluster_row)
        for requirement in group_requirements:
            visit(requirement, group, prerequisite_course_ids)
        cluster_row["courseKindCount"] = len(course_kinds)
        cluster_row["assemblyReadiness"] = cluster_generation_threshold_report(len(course_kinds))
        group_course_ids = _requirement_course_ids(group_requirements)
        if group_course_ids:
            prior_group_course_ids = group_course_ids
    program_candidate_cluster_count = sum(1 for cluster in clusters if cluster.get("courseKinds"))

    return {
        "version": "program-course-scaffold-plan-v1",
        "workflowContracts": {
            "programGeneration": "program-generation-workflow-v1",
            "clusterGeneration": "cluster-generation-workflow-v1",
            "courseWrapperGeneration": "course-wrapper-v1",
            "activeCourseGeneration": "active-course-generation-plan-v1",
        },
        "generationPolicy": {
            "mode": "active_generation",
            "courseMaterialization": "create_wrappers_first",
            "contentMaterialization": "generate_modules_on_demand_in_batches",
            "defaultModuleBatchSize": 2,
            "placeholderText": "Section not yet generated",
            "assemblyThresholds": curriculum_assembly_threshold_policy()["thresholds"],
        },
        "clusterCount": len(clusters),
        "courseCount": len(courses),
        "activeGenerationCourseCount": sum(1 for course in courses if isinstance(course.get("activeGenerationPlan"), dict)),
        "programAssemblyReadiness": program_generation_threshold_report(program_candidate_cluster_count),
        "clusters": clusters,
        "courses": courses,
        "courseBuildTaskReport": build_course_build_task_report(courses),
        "courseShellReadinessReport": build_program_course_shell_readiness_report(
            clusters=clusters,
            courses=courses,
        ),
        "courseShellActionPlan": build_program_course_shell_action_plan(
            clusters=clusters,
            courses=courses,
        ),
        "sourceAcquisitionPlan": build_program_source_acquisition_plan(
            clusters=clusters,
            courses=courses,
        ),
    }


def apply_existing_course_links(
    groups: list[dict[str, Any]],
    scaffold_plan: dict[str, Any],
) -> int:
    link_targets = {
        str(course.get("courseId")): str(course.get("existingCourseId"))
        for course in _items(scaffold_plan.get("courses"))
        if course.get("action") == "link_existing_course"
        and course.get("courseId")
        and course.get("existingCourseId")
    }
    if not link_targets:
        return 0

    linked_count = 0

    def visit(requirement: dict[str, Any]) -> None:
        nonlocal linked_count
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            course_id = str(requirement.get("courseId") or "")
            existing_course_id = link_targets.get(course_id)
            if existing_course_id:
                requirement["generatedCourseId"] = course_id
                requirement["linkedExistingCourseId"] = existing_course_id
                requirement["courseId"] = existing_course_id
                linked_count += 1
        elif requirement_type == "complete_n_of_courses":
            next_course_ids: list[str] = []
            for course_id in requirement.get("courseIds") or []:
                if not isinstance(course_id, str):
                    continue
                existing_course_id = link_targets.get(course_id)
                next_course_ids.append(existing_course_id or course_id)
                if existing_course_id:
                    linked_count += 1
            requirement["courseIds"] = next_course_ids
        elif requirement_type == "requirement_set":
            for nested in _items(requirement.get("requirements")):
                visit(nested)

    for group in groups:
        for requirement in _items(group.get("requirements")):
            visit(requirement)

    return linked_count
