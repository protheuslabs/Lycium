from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, Literal

from app.course_agent_assembly import _coerce_generated_section, _module_lesson_outlines, _source_ids_from_outline
from app.course_agent_staged_support import _infer_pacing_label, _normalize_summary_for_pacing, _with_generation_outline_metadata
from app.course_outline_from_source_packet import (
    COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT,
    SOURCE_PACKET_OUTLINE_CONTRACT_VERSION,
    build_course_module_outline_quality_report,
    build_outline_from_source_packet,
)
from app.curriculum_assembly_policy import (
    cluster_generation_threshold_report,
    curriculum_assembly_threshold_policy,
    program_generation_threshold_report,
)
from app.program_contract_builder import build_program_brief, build_program_contract, build_requirement_group_plan
from app.program_course_scaffold import (
    COURSE_WRAPPER_QUALITY_REPORT_CONTRACT,
    build_course_scaffold_plan,
    build_course_wrapper_quality_report,
)
from app.program_validation import validate_program_contract

STAGE_WORKFLOW_VERSION = "course-generation-stage-workflows-v1"

StageStatus = Literal["passed", "needs_review", "failed"]

PROGRAM_BRIEF_CONTRACT = "program-brief-workflow-v1"
REQUIREMENT_GROUP_PLAN_CONTRACT = "requirement-group-plan-workflow-v1"
PROGRAM_GENERATION_CONTRACT = "program-generation-workflow-v1"
CLUSTER_GENERATION_CONTRACT = "cluster-generation-workflow-v1"
CLUSTER_PLAN_CONTRACT = "cluster-plan-v1"
CLUSTER_QUALITY_REPORT_CONTRACT = "cluster-quality-report-v1"
COURSE_WRAPPER_GENERATION_CONTRACT = "course-wrapper-generation-workflow-v1"
COURSE_MODULE_OUTLINE_CONTRACT = "course-module-outline-workflow-v1"
MODULE_SECTION_PLAN_CONTRACT = "module-section-plan-workflow-v1"
SECTION_FILL_CONTRACT = "section-fill-workflow-v1"
MODULE_APPLY_SECTION_CONTRACT = "module-apply-section-workflow-v1"
MODULE_SUMMARY_SECTION_CONTRACT = "module-summary-section-workflow-v1"
MODULE_ASSEMBLY_CONTRACT = "module-assembly-workflow-v1"


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _unique_strings(values: list[str], *, limit: int | None = None) -> list[str]:
    rows: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = str(value or "").strip()
        key = clean.lower()
        if not clean or key in seen:
            continue
        rows.append(clean)
        seen.add(key)
        if limit is not None and len(rows) >= limit:
            break
    return rows


def _workflow_result(
    *,
    stage: str,
    contract_version: str,
    status: StageStatus,
    artifacts: dict[str, Any],
    metrics: dict[str, Any] | None = None,
    issues: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "workflowVersion": STAGE_WORKFLOW_VERSION,
        "contractVersion": contract_version,
        "stage": stage,
        "status": status,
        "checkedAt": _now(),
        "metrics": metrics or {},
        "issues": issues or [],
        "artifacts": artifacts,
    }


def compact_stage_workflow_report(report: dict[str, Any]) -> dict[str, Any]:
    artifacts = report.get("artifacts") if isinstance(report.get("artifacts"), dict) else {}
    return {
        "workflowVersion": report.get("workflowVersion"),
        "contractVersion": report.get("contractVersion"),
        "stage": report.get("stage"),
        "status": report.get("status"),
        "metrics": report.get("metrics") if isinstance(report.get("metrics"), dict) else {},
        "issues": report.get("issues") if isinstance(report.get("issues"), list) else [],
        "artifactKeys": sorted(str(key) for key in artifacts),
    }


def _issue(severity: Literal["warning", "error"], message: str, location: str | None = None) -> dict[str, Any]:
    return {"severity": severity, "message": message, "location": location}


def _status_from_issues(issues: list[dict[str, Any]]) -> StageStatus:
    if any(issue.get("severity") == "error" for issue in issues):
        return "failed"
    return "needs_review" if issues else "passed"


def run_program_brief_workflow(
    *,
    goal: str,
    level: str | None = None,
    desired_course_count: int = 8,
    benchmark_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    brief = build_program_brief(
        goal=goal,
        level=level,
        desired_course_count=desired_course_count,
        benchmark_context=benchmark_context,
    )
    broad_groups = _items(brief.get("broadRequirementGroups"))
    learning_outcomes = _items(brief.get("learningOutcomes"))
    issues: list[dict[str, Any]] = []
    if not str(goal or "").strip():
        issues.append(_issue("error", "Program brief needs a non-empty user goal.", "goal"))
    for key in ("title", "description", "programType", "field", "level", "targetAudience", "targetOutcome"):
        if not str(brief.get(key) or "").strip():
            issues.append(_issue("error", f"Program brief is missing {key}.", key))
    if len(learning_outcomes) < 3:
        issues.append(_issue("error", "Program brief needs at least three learning outcomes.", "learningOutcomes"))
    if len(broad_groups) < 2:
        issues.append(_issue("warning", "Program brief has fewer than two broad requirement groups.", "broadRequirementGroups"))
    if any("courseId" in group or "courseWrapper" in group or "activeGenerationPlan" in group for group in broad_groups):
        issues.append(_issue("error", "Program brief should not materialize courses or wrappers.", "broadRequirementGroups"))

    evidence = brief.get("evidence") if isinstance(brief.get("evidence"), dict) else {}
    return _workflow_result(
        stage="program_brief",
        contract_version=PROGRAM_BRIEF_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "learningOutcomeCount": len(learning_outcomes),
            "broadRequirementGroupCount": len(broad_groups),
            "desiredCourseCount": brief.get("desiredCourseCount") or desired_course_count,
            "requirementOriginCount": evidence.get("requirementOriginCount") or 0,
            "courseSignalCount": evidence.get("courseSignalCount") or 0,
        },
        artifacts={"programBrief": brief},
    )


def _has_materialized_course_artifacts(value: Any) -> bool:
    if isinstance(value, dict):
        if any(key in value for key in ("courseId", "courseIds", "courseWrapper", "activeGenerationPlan", "courseBuildTask")):
            return True
        return any(_has_materialized_course_artifacts(child) for child in value.values())
    if isinstance(value, list):
        return any(_has_materialized_course_artifacts(item) for item in value)
    return False


def _has_course_materialization_payload(value: Any) -> bool:
    if isinstance(value, dict):
        if any(key in value for key in ("courseWrapper", "activeGenerationPlan", "courseBuildTask", "modules", "sections", "content")):
            return True
        return any(_has_course_materialization_payload(child) for child in value.values())
    if isinstance(value, list):
        return any(_has_course_materialization_payload(item) for item in value)
    return False


def run_requirement_group_plan_workflow(
    *,
    goal: str,
    level: str | None = None,
    desired_course_count: int = 8,
    benchmark_context: dict[str, Any] | None = None,
    program_brief: dict[str, Any] | None = None,
) -> dict[str, Any]:
    brief = (
        dict(program_brief)
        if isinstance(program_brief, dict)
        else run_program_brief_workflow(
            goal=goal,
            level=level,
            desired_course_count=desired_course_count,
            benchmark_context=benchmark_context,
        )["artifacts"]["programBrief"]
    )
    group_plan = build_requirement_group_plan(
        goal=goal,
        level=level,
        desired_course_count=desired_course_count,
        benchmark_context=benchmark_context,
        program_brief=brief,
    )
    groups = _items(group_plan.get("groups"))
    course_groups = [group for group in groups if group.get("groupKind") == "cluster"]
    capstone_groups = [group for group in groups if group.get("groupKind") == "capstone" or group.get("clusterType") == "capstone"]
    assessment_groups = [group for group in groups if group.get("clusterType") == "lab" or "assessment" in str(group.get("title") or "").lower()]
    titles = [str(group.get("title") or "").strip().lower() for group in groups if str(group.get("title") or "").strip()]
    issues: list[dict[str, Any]] = []
    if not str(goal or "").strip():
        issues.append(_issue("error", "Requirement group plan needs a non-empty user goal.", "goal"))
    if group_plan.get("contractVersion") != "requirement-group-plan-v1":
        issues.append(_issue("error", "Requirement group plan has the wrong contract version.", "contractVersion"))
    if len(groups) < 3:
        issues.append(_issue("error", "Requirement group plan needs at least three groups.", "groups"))
    if not course_groups:
        issues.append(_issue("error", "Requirement group plan needs at least one course-bearing cluster.", "groups"))
    if not capstone_groups:
        issues.append(_issue("error", "Requirement group plan needs a capstone or portfolio evidence group.", "groups"))
    if not assessment_groups:
        issues.append(_issue("warning", "Requirement group plan has no integrated assessment group.", "groups"))
    if len(titles) != len(set(titles)):
        issues.append(_issue("error", "Requirement group plan has duplicate group titles.", "groups[].title"))
    for index, group in enumerate(groups, start=1):
        location = f"groups[{index}]"
        if not str(group.get("title") or "").strip():
            issues.append(_issue("error", "Requirement group plan group is missing a title.", location))
        if not str(group.get("purpose") or group.get("description") or "").strip():
            issues.append(_issue("warning", "Requirement group plan group should explain its purpose.", location))
        if group.get("groupKind") == "cluster" and int(group.get("requirementThemeCount") or 0) == 0:
            issues.append(_issue("error", "Course-bearing cluster has no requirement themes.", location))
        if _has_materialized_course_artifacts(group):
            issues.append(_issue("error", "Requirement group plan must not materialize course IDs, wrappers, or build tasks.", location))

    return _workflow_result(
        stage="requirement_group_plan",
        contract_version=REQUIREMENT_GROUP_PLAN_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "groupCount": len(groups),
            "courseBearingGroupCount": len(course_groups),
            "capstoneGroupCount": len(capstone_groups),
            "assessmentGroupCount": len(assessment_groups),
            "requirementThemeCount": sum(int(group.get("requirementThemeCount") or 0) for group in groups),
            "estimatedHours": group_plan.get("estimatedHours") or 0,
        },
        artifacts={"programBrief": brief, "requirementGroupPlan": group_plan},
    )


def run_program_generation_workflow(
    *,
    goal: str,
    level: str | None = None,
    desired_course_count: int = 8,
    benchmark_context: dict[str, Any] | None = None,
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
    program_brief: dict[str, Any] | None = None,
    requirement_group_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    brief = (
        dict(program_brief)
        if isinstance(program_brief, dict)
        else run_program_brief_workflow(
            goal=goal,
            level=level,
            desired_course_count=desired_course_count,
            benchmark_context=benchmark_context,
        )["artifacts"]["programBrief"]
    )
    group_plan = (
        dict(requirement_group_plan)
        if isinstance(requirement_group_plan, dict)
        else run_requirement_group_plan_workflow(
            goal=goal,
            level=level,
            desired_course_count=desired_course_count,
            benchmark_context=benchmark_context,
            program_brief=brief,
        )["artifacts"]["requirementGroupPlan"]
    )
    program, course_requirements, synthesis = build_program_contract(
        goal=goal,
        level=level,
        desired_course_count=desired_course_count,
        benchmark_context=benchmark_context,
        known_course_ids=known_course_ids,
        known_courses=known_courses,
        program_brief=brief,
        requirement_group_plan=group_plan,
    )
    validation_errors = validate_program_contract(program)
    issues = [_issue("error", error) for error in validation_errors]
    groups = _items(program.get("requirementGroups"))
    if not groups:
        issues.append(_issue("error", "Program generation did not create requirement groups.", "requirementGroups"))

    return _workflow_result(
        stage="program_generation",
        contract_version=PROGRAM_GENERATION_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "requirementGroupCount": len(groups),
            "courseRequirementCount": len(course_requirements),
            "validationErrorCount": len(validation_errors),
            "estimatedHours": program.get("estimatedHours") or 0,
        },
        artifacts={
            "program": program,
            "courseRequirements": course_requirements,
            "programBrief": brief,
            "requirementGroupPlan": group_plan,
            "programSynthesis": synthesis,
        },
    )


CLUSTER_CONCEPT_STOPWORDS = {
    "and",
    "course",
    "complete",
    "develops",
    "for",
    "from",
    "into",
    "needed",
    "program",
    "source",
    "source-backed",
    "that",
    "the",
    "with",
}


def _concepts_for_course_kind(requirement: dict[str, Any], title: str, description: str) -> list[str]:
    origin = requirement.get("origin") if isinstance(requirement.get("origin"), dict) else {}
    origin_concepts = _strings(origin.get("concepts") or origin.get("topics") or origin.get("requiredConcepts"))
    if origin_concepts:
        return _unique_strings(origin_concepts, limit=8)

    title_concept = title.replace(" Course", "").strip()
    token_concepts = [
        token
        for token in re.split(r"[^A-Za-z0-9+#/.-]+", f"{title} {description}")
        if len(token) > 2 and token.lower() not in CLUSTER_CONCEPT_STOPWORDS
    ]
    return _unique_strings([title_concept, *token_concepts], limit=8)


def _cluster_course_kind_from_requirement(requirement: dict[str, Any], index: int) -> dict[str, Any]:
    title = str(requirement.get("title") or requirement.get("courseId") or f"Course {index}")
    description = str(requirement.get("description") or f"Complete a source-backed course covering {title}.")
    concepts = _concepts_for_course_kind(requirement, title, description)
    return {
        "contractVersion": "cluster-course-kind-v1",
        "kindId": str(requirement.get("id") or f"course-kind-{index}"),
        "courseId": str(requirement.get("courseId") or ""),
        "requirementId": str(requirement.get("id") or ""),
        "title": title,
        "description": description,
        "estimatedHours": requirement.get("estimatedHours") or 0,
        "importance": str(requirement.get("importance") or "required"),
        "requiredConcepts": concepts,
        "sourceStatus": "needs_sources",
        "planningRole": "abstract_course_kind",
    }


def _cluster_course_kinds(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    course_kinds: list[dict[str, Any]] = []
    for index, requirement in enumerate(requirements, start=1):
        requirement_type = requirement.get("type")
        if requirement_type == "complete_course":
            course_kinds.append(_cluster_course_kind_from_requirement(requirement, index))
        elif requirement_type == "complete_n_of_courses":
            for course_index, course_id in enumerate(requirement.get("courseIds") or [], start=1):
                if not isinstance(course_id, str) or not course_id.strip():
                    continue
                course_kinds.append(
                    _cluster_course_kind_from_requirement(
                        {
                            **requirement,
                            "id": f"{requirement.get('id') or 'requirement'}-{course_index}",
                            "title": course_id,
                            "courseId": course_id,
                        },
                        len(course_kinds) + 1,
                    )
                )
        elif requirement_type == "requirement_set":
            course_kinds.extend(_cluster_course_kinds(_items(requirement.get("requirements"))))
    return course_kinds


def _dependency_edges_for(program: dict[str, Any]) -> list[dict[str, Any]]:
    graph = program.get("dependencyGraph") if isinstance(program.get("dependencyGraph"), dict) else {}
    return _items(graph.get("edges"))


def _cluster_dependency_profile(group: dict[str, Any], edges: list[dict[str, Any]]) -> dict[str, Any]:
    group_id = str(group.get("id") or "")
    explicit_prerequisites = [
        str(row.get("nodeId") or row.get("groupId") or "")
        for row in _items(group.get("prerequisites"))
        if str(row.get("nodeId") or row.get("groupId") or "").strip()
    ]
    depends_on = [
        str(edge.get("fromNodeId") or "")
        for edge in edges
        if str(edge.get("toNodeId") or "") == group_id and str(edge.get("fromNodeId") or "").strip()
    ]
    unlocks = [
        str(edge.get("toNodeId") or "")
        for edge in edges
        if str(edge.get("fromNodeId") or "") == group_id and str(edge.get("toNodeId") or "").strip()
    ]
    return {
        "contractVersion": "cluster-dependency-profile-v1",
        "dependsOnClusterIds": _unique_strings([*explicit_prerequisites, *depends_on]),
        "unlocksClusterIds": _unique_strings(unlocks),
        "dependencyCount": len(_unique_strings([*explicit_prerequisites, *depends_on])),
        "unlockCount": len(_unique_strings(unlocks)),
    }


def _cluster_required_concepts(course_kinds: list[dict[str, Any]]) -> list[str]:
    return _unique_strings(
        [
            concept
            for kind in course_kinds
            for concept in _strings(kind.get("requiredConcepts"))
        ],
        limit=18,
    )


def _cluster_quality_profile(
    *,
    group: dict[str, Any],
    cluster_title: str,
    cluster_description: str,
    has_authored_title: bool,
    course_kinds: list[dict[str, Any]],
    dependency_profile: dict[str, Any],
    assembly_readiness: dict[str, Any],
) -> dict[str, Any]:
    group_kind = str(group.get("groupKind") or "cluster")
    cluster_type = str(group.get("clusterType") or "core")
    is_course_bearing = group_kind == "cluster" and cluster_type not in {"lab", "assessment", "capstone"}
    learning_outcomes = _items(group.get("learningOutcomes"))
    concept_count = len(_cluster_required_concepts(course_kinds))
    review_reasons: list[str] = []
    if not has_authored_title:
        review_reasons.append("missing_cluster_title")
    if not cluster_description.strip() and not str(group.get("purpose") or "").strip():
        review_reasons.append("missing_cluster_purpose")
    if is_course_bearing and not course_kinds:
        review_reasons.append("missing_course_kinds")
    if is_course_bearing and concept_count == 0:
        review_reasons.append("missing_required_concepts")
    if is_course_bearing and not learning_outcomes:
        review_reasons.append("missing_learning_outcomes")

    return {
        "contractVersion": "cluster-quality-profile-v1",
        "status": "needs_review" if review_reasons else "passed",
        "reviewReasons": review_reasons,
        "courseBearing": is_course_bearing,
        "titleReady": has_authored_title and bool(cluster_title.strip()),
        "scopeReady": bool(cluster_description.strip() or str(group.get("purpose") or "").strip()),
        "learningOutcomeCount": len(learning_outcomes),
        "courseKindCount": len(course_kinds),
        "requiredConceptCount": concept_count,
        "assemblyReadinessStatus": assembly_readiness.get("status"),
        "dependencyCount": dependency_profile.get("dependencyCount") or 0,
        "unlockCount": dependency_profile.get("unlockCount") or 0,
        "materializesCourses": False,
        "materializesCourseWrappers": False,
    }


def _cluster_quality_report(clusters: list[dict[str, Any]]) -> dict[str, Any]:
    profiles = [
        cluster.get("qualityProfile")
        for cluster in clusters
        if isinstance(cluster.get("qualityProfile"), dict)
    ]
    review_clusters = [cluster for cluster in clusters if cluster.get("qualityProfile", {}).get("status") != "passed"]
    course_bearing_clusters = [cluster for cluster in clusters if cluster.get("qualityProfile", {}).get("courseBearing")]
    return {
        "contractVersion": CLUSTER_QUALITY_REPORT_CONTRACT,
        "passed": not review_clusters,
        "clusterCount": len(clusters),
        "courseBearingClusterCount": len(course_bearing_clusters),
        "clustersNeedingReviewCount": len(review_clusters),
        "courseKindCount": sum(len(_items(cluster.get("courseKinds"))) for cluster in clusters),
        "requiredConceptCount": sum(int(profile.get("requiredConceptCount") or 0) for profile in profiles),
        "policy": {
            "materializesCourses": False,
            "materializesCourseWrappers": False,
            "courseWrappersCreatedBy": COURSE_WRAPPER_GENERATION_CONTRACT,
        },
    }


def run_cluster_generation_workflow(program: dict[str, Any]) -> dict[str, Any]:
    groups = _items(program.get("requirementGroups"))
    dependency_edges = _dependency_edges_for(program)
    clusters: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []

    for index, group in enumerate(groups, start=1):
        requirements = _items(group.get("requirements"))
        course_requirements = [requirement for requirement in requirements if requirement.get("type") == "complete_course"]
        course_kinds = _cluster_course_kinds(requirements)
        raw_title = str(group.get("displayName") or group.get("title") or "").strip()
        title = raw_title or f"Cluster {index}"
        description = str(group.get("description") or group.get("purpose") or "")
        assembly_readiness = cluster_generation_threshold_report(len(course_kinds))
        dependency_profile = _cluster_dependency_profile(group, dependency_edges)
        required_concepts = _cluster_required_concepts(course_kinds)
        quality_profile = _cluster_quality_profile(
            group=group,
            cluster_title=title,
            cluster_description=description,
            has_authored_title=bool(raw_title),
            course_kinds=course_kinds,
            dependency_profile=dependency_profile,
            assembly_readiness=assembly_readiness,
        )
        clusters.append(
            {
                "contractVersion": CLUSTER_PLAN_CONTRACT,
                "clusterId": str(group.get("id") or f"cluster-{index}"),
                "title": title,
                "description": description,
                "purpose": str(group.get("purpose") or description),
                "groupKind": str(group.get("groupKind") or "cluster"),
                "clusterType": str(group.get("clusterType") or "core"),
                "learningOutcomes": _items(group.get("learningOutcomes")),
                "requirementCount": len(requirements),
                "courseRequirementCount": len(course_kinds) or len(course_requirements),
                "estimatedHours": group.get("estimatedHours") or 0,
                "completionRule": group.get("completionRule") if isinstance(group.get("completionRule"), dict) else {},
                "courseKindCount": len(course_kinds),
                "courseKinds": course_kinds,
                "requiredConcepts": required_concepts,
                "dependencyProfile": dependency_profile,
                "assemblyReadiness": assembly_readiness,
                "qualityProfile": quality_profile,
                "policy": {
                    "materializesCourses": False,
                    "materializesCourseWrappers": False,
                    "nextWorkflow": COURSE_WRAPPER_GENERATION_CONTRACT,
                },
            }
        )

    if not clusters:
        issues.append(_issue("error", "Cluster generation has no requirement groups to inspect.", "requirementGroups"))
    if clusters and not any(cluster["courseRequirementCount"] for cluster in clusters):
        issues.append(_issue("warning", "Clusters contain no course requirements.", "requirementGroups"))
    titles = [str(cluster.get("title") or "").strip().lower() for cluster in clusters if str(cluster.get("title") or "").strip()]
    if len(titles) != len(set(titles)):
        issues.append(_issue("error", "Cluster generation produced duplicate cluster titles.", "clusters[].title"))
    for index, cluster in enumerate(clusters, start=1):
        location = f"clusters[{index}]"
        if not cluster.get("qualityProfile", {}).get("titleReady"):
            issues.append(_issue("error", "Cluster is missing a learner-facing title.", f"{location}.title"))
        if cluster.get("qualityProfile", {}).get("courseBearing") and not _items(cluster.get("courseKinds")):
            issues.append(_issue("error", "Course-bearing cluster has no abstract course kinds.", f"{location}.courseKinds"))
        if _has_course_materialization_payload(cluster):
            issues.append(_issue("error", "Cluster generation must not materialize course wrappers or active course plans.", location))
        for kind_index, course_kind in enumerate(_items(cluster.get("courseKinds")), start=1):
            kind_location = f"{location}.courseKinds[{kind_index}]"
            if not str(course_kind.get("title") or "").strip():
                issues.append(_issue("error", "Course kind is missing a title.", f"{kind_location}.title"))
            if not str(course_kind.get("description") or "").strip():
                issues.append(_issue("error", "Course kind is missing a description.", f"{kind_location}.description"))
            if not _strings(course_kind.get("requiredConcepts")):
                issues.append(_issue("error", "Course kind is missing required concepts.", f"{kind_location}.requiredConcepts"))
    program_candidate_cluster_count = sum(1 for cluster in clusters if cluster["courseKinds"])
    program_assembly_readiness = program_generation_threshold_report(program_candidate_cluster_count)
    quality_report = _cluster_quality_report(clusters)

    return _workflow_result(
        stage="cluster_generation",
        contract_version=CLUSTER_GENERATION_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "clusterCount": len(clusters),
            "courseRequirementCount": sum(cluster["courseRequirementCount"] for cluster in clusters),
            "clusterCourseKindCount": sum(len(cluster["courseKinds"]) for cluster in clusters),
            "programCandidateClusterCount": program_candidate_cluster_count,
            "clustersNeedingReviewCount": quality_report["clustersNeedingReviewCount"],
            "requiredConceptCount": quality_report["requiredConceptCount"],
            "assessmentClusterCount": sum(1 for cluster in clusters if cluster["groupKind"] in {"assessment", "capstone"}),
        },
        artifacts={
            "clusters": clusters,
            "clusterQualityReport": quality_report,
            "programAssemblyReadiness": program_assembly_readiness,
            "assemblyThresholdPolicy": curriculum_assembly_threshold_policy(),
        },
    )


def run_course_wrapper_generation_workflow(
    program: dict[str, Any],
    *,
    known_course_ids: set[str] | None = None,
    known_courses: list[dict[str, Any]] | None = None,
    course_scaffold_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    groups = _items(program.get("requirementGroups"))
    plan = (
        dict(course_scaffold_plan)
        if isinstance(course_scaffold_plan, dict)
        else build_course_scaffold_plan(groups, known_course_ids=known_course_ids, known_courses=known_courses)
    )
    courses = _items(plan.get("courses"))
    wrappers = [course for course in courses if course.get("action") == "create_empty_course"]
    linked_courses = [course for course in courses if course.get("action") == "link_existing_course"]
    quality_report = (
        dict(plan.get("courseWrapperQualityReport"))
        if isinstance(plan.get("courseWrapperQualityReport"), dict)
        else build_course_wrapper_quality_report(courses)
    )
    issues: list[dict[str, Any]] = []
    if not courses:
        issues.append(_issue("error", "Course wrapper generation did not produce course actions.", "courses"))
    if wrappers and not all(isinstance(course.get("courseBuildTask"), dict) for course in wrappers):
        issues.append(_issue("error", "Every wrapper course needs a courseBuildTask.", "courses[].courseBuildTask"))
    if quality_report.get("contractVersion") != COURSE_WRAPPER_QUALITY_REPORT_CONTRACT:
        issues.append(_issue("error", "Course wrapper quality report has the wrong contract version.", "courseWrapperQualityReport"))
    for profile in _items(quality_report.get("failedProfiles")):
        course_id = str(profile.get("courseId") or profile.get("title") or "unknown")
        reasons = ", ".join(_strings(profile.get("reasons"))) or "unknown wrapper quality failure"
        issues.append(_issue("error", f"Course wrapper '{course_id}' failed quality checks: {reasons}.", "courseWrapperQualityReport.failedProfiles"))

    return _workflow_result(
        stage="course_wrapper_generation",
        contract_version=COURSE_WRAPPER_GENERATION_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "clusterCount": plan.get("clusterCount") or 0,
            "courseCount": len(courses),
            "wrapperCourseCount": len(wrappers),
            "linkedExistingCourseCount": len(linked_courses),
            "failedWrapperQualityCount": quality_report.get("failedCourseCount") or 0,
            "sourceRequestCount": quality_report.get("sourceRequestCount") or 0,
            "activeGenerationPlanCount": quality_report.get("activeGenerationPlanCount") or 0,
        },
        artifacts={
            "courseScaffoldPlan": plan,
            "courses": courses,
            "wrapperCourses": wrappers,
            "courseWrapperQualityReport": quality_report,
        },
    )


def run_course_module_outline_workflow(
    *,
    prompt: str = "",
    source_packet: dict[str, Any] | None = None,
    desired_module_count: int = 4,
    sections_per_module: int = 2,
    outline: dict[str, Any] | None = None,
) -> dict[str, Any]:
    outline = (
        dict(outline)
        if isinstance(outline, dict)
        else build_outline_from_source_packet(
            prompt=prompt,
            source_packet=source_packet,
            desired_module_count=desired_module_count,
            sections_per_module=sections_per_module,
            include_section_outlines=False,
        )
    )
    modules = _items(outline.get("modules"))
    section_count = sum(len(_items(module.get("sections"))) for module in modules)
    quality_report = build_course_module_outline_quality_report(
        outline,
        source_packet=source_packet,
        desired_module_count=desired_module_count,
        sections_per_module=sections_per_module,
    )
    issues: list[dict[str, Any]] = []
    if not modules:
        issues.append(_issue("error", "Module outline generation did not create modules.", "modules"))
    if quality_report.get("contractVersion") != COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT:
        issues.append(_issue("error", "Module outline quality report has the wrong contract version.", "outlineQualityReport"))
    for reason in _strings(quality_report.get("reasons")):
        issues.append(_issue("error", f"Module outline quality check failed: {reason}.", "outlineQualityReport.reasons"))
    for warning in _strings(quality_report.get("warnings")):
        issues.append(_issue("warning", f"Module outline quality warning: {warning}.", "outlineQualityReport.warnings"))

    return _workflow_result(
        stage="course_module_outline_generation",
        contract_version=COURSE_MODULE_OUTLINE_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "moduleCount": len(modules),
            "sectionOutlineCount": section_count,
            "embeddedSectionOutlineCount": section_count,
            "sourceDocumentCount": outline.get("provenance", {}).get("sourceDocumentCount", 0)
            if isinstance(outline.get("provenance"), dict)
            else 0,
            "outlineQualityStatus": quality_report.get("status"),
            "outlineQualityReasonCount": len(_strings(quality_report.get("reasons"))),
            "sourceMappedModuleCount": quality_report.get("metrics", {}).get("sourceMappedModuleCount", 0)
            if isinstance(quality_report.get("metrics"), dict)
            else 0,
            "sourceMappedSectionCount": quality_report.get("metrics", {}).get("sourceMappedSectionCount", 0)
            if isinstance(quality_report.get("metrics"), dict)
            else 0,
        },
        artifacts={"outline": outline, "outlineQualityReport": quality_report},
    )


def run_module_section_plan_workflow(
    module_outline: dict[str, Any],
    *,
    course: dict[str, Any] | None = None,
    fallback_source_ids: list[str] | None = None,
    module_number: int = 1,
    desired_section_count: int | None = None,
) -> dict[str, Any]:
    module_source_ids = _source_ids_from_outline(module_outline, fallback_source_ids or _strings(module_outline.get("sourceIds")))
    has_embedded_sections = bool(_items(module_outline.get("sections")))
    planning_outline = dict(module_outline)
    if desired_section_count is not None and not has_embedded_sections:
        planning_outline["targetSectionCount"] = desired_section_count
    lesson_outlines = _module_lesson_outlines(planning_outline)
    target_count = len(lesson_outlines)
    generated_from_module_outline = not has_embedded_sections
    section_plans: list[dict[str, Any]] = []
    for index, lesson_outline in enumerate(lesson_outlines, start=1):
        title = str(lesson_outline.get("title") or f"Lesson {index}")
        source_ids = _source_ids_from_outline(lesson_outline, module_source_ids)
        description = str(
            lesson_outline.get("description")
            or f"Planning reference for content generation: fill {title} as a source-backed section."
        )
        section_plans.append(
            {
                "contractVersion": "section-generation-outline-v1",
                "id": str(lesson_outline.get("id") or f"module-{module_number}-section-{index}"),
                "title": title,
                "description": description,
                "role": "lesson",
                "pageType": "learn",
                "sectionType": "lesson",
                "sourceIds": source_ids,
                "conceptKeywords": _strings(lesson_outline.get("concept_keywords") or lesson_outline.get("conceptKeywords")),
                "learningObjectives": _strings(lesson_outline.get("learning_objectives") or lesson_outline.get("learningObjectives")),
                "planningSource": str(lesson_outline.get("planningSource") or module_outline.get("planningSource") or "module_outline"),
            }
        )
    issues: list[dict[str, Any]] = []
    if not section_plans:
        issues.append(_issue("error", "Module section planning did not produce lesson section plans.", "sections"))
    title_keys = [str(plan.get("title") or "").strip().lower() for plan in section_plans if str(plan.get("title") or "").strip()]
    if len(title_keys) != len(set(title_keys)):
        issues.append(_issue("error", "Module section planning produced duplicate lesson titles.", "sections[].title"))
    for index, section_plan in enumerate(section_plans, start=1):
        location = f"sectionPlans[{index}]"
        if not str(section_plan.get("title") or "").strip():
            issues.append(_issue("error", "Section plan is missing a title.", f"{location}.title"))
        if not str(section_plan.get("description") or "").strip():
            issues.append(_issue("warning", "Section plan has no planning description.", f"{location}.description"))
        if not _strings(section_plan.get("learningObjectives")):
            issues.append(_issue("error", "Section plan is missing learning objectives.", f"{location}.learningObjectives"))
        if not _strings(section_plan.get("conceptKeywords")):
            issues.append(_issue("error", "Section plan is missing concept keywords.", f"{location}.conceptKeywords"))
        if module_source_ids and not _strings(section_plan.get("sourceIds")):
            issues.append(_issue("error", "Section plan is missing source IDs.", f"{location}.sourceIds"))
    planned_sections = [
        _with_generation_outline_metadata(
            {
                "id": str(section_plan.get("id") or f"module-{module_number}-section-{index}"),
                "title": str(section_plan.get("title") or f"Lesson {index}"),
                "description": str(section_plan.get("description") or ""),
                "pageType": str(section_plan.get("pageType") or "learn"),
                "sectionType": str(section_plan.get("sectionType") or "lesson"),
                "sourceIds": _strings(section_plan.get("sourceIds")),
                "content": [],
            },
            module_outline=module_outline,
            section_outline={
                "id": section_plan.get("id"),
                "title": section_plan.get("title"),
                "description": section_plan.get("description"),
                "conceptKeywords": section_plan.get("conceptKeywords"),
                "learningObjectives": section_plan.get("learningObjectives"),
                "planningSource": section_plan.get("planningSource"),
            },
            source_ids=_strings(section_plan.get("sourceIds")),
            role=str(section_plan.get("role") or "lesson"),
        )
        for index, section_plan in enumerate(section_plans, start=1)
    ]
    planned_module = {
        **module_outline,
        "sections": planned_sections,
        "sectionPlanningStatus": "planned_empty_sections",
    }
    course_row = dict(course) if isinstance(course, dict) else {}
    course_modules = _items(course_row.get("modules"))
    planned_course_modules: list[dict[str, Any]] = []
    matched_module = False
    planned_module_id = str(planned_module.get("id") or "")
    for index, module in enumerate(course_modules, start=1):
        module_id = str(module.get("id") or "")
        if (planned_module_id and module_id == planned_module_id) or (not planned_module_id and index == module_number):
            planned_course_modules.append(planned_module)
            matched_module = True
        else:
            planned_course_modules.append(module)
    if not matched_module:
        planned_course_modules.append(planned_module)
    planned_course = {**course_row, "modules": planned_course_modules}

    return _workflow_result(
        stage="module_section_plan_generation",
        contract_version=MODULE_SECTION_PLAN_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "sectionPlanCount": len(section_plans),
            "targetSectionCount": target_count,
            "sourceIdCount": len(module_source_ids),
            "generatedFromModuleOutline": generated_from_module_outline,
            "plannedSectionCount": len(planned_sections),
        },
        artifacts={
            "moduleOutline": module_outline,
            "sectionPlans": section_plans,
            "plannedSections": planned_sections,
            "plannedModule": planned_module,
            "plannedCourse": planned_course,
        },
    )


def _section_source_ids(section_plan: dict[str, Any], fallback_source_ids: list[str] | None = None) -> list[str]:
    source_ids = _strings(section_plan.get("sourceIds"))
    return source_ids or list(fallback_source_ids or [])


def _source_ids_from_value(value: Any) -> list[str]:
    source_ids: list[str] = []
    if isinstance(value, dict):
        source_ids.extend(_strings(value.get("sourceIds")))
        for child in value.values():
            source_ids.extend(_source_ids_from_value(child))
    elif isinstance(value, list):
        for child in value:
            source_ids.extend(_source_ids_from_value(child))
    return _unique_strings(source_ids)


def _filter_source_id_refs(value: Any, allowed_source_ids: set[str]) -> Any:
    if isinstance(value, dict):
        filtered: dict[str, Any] = {}
        for key, child in value.items():
            if key == "sourceIds":
                source_ids = [source_id for source_id in _strings(child) if source_id in allowed_source_ids]
                if source_ids:
                    filtered[key] = _unique_strings(source_ids)
                continue
            filtered[key] = _filter_source_id_refs(child, allowed_source_ids)
        return filtered
    if isinstance(value, list):
        return [_filter_source_id_refs(child, allowed_source_ids) for child in value]
    return value


def _strip_source_id_refs(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _strip_source_id_refs(child) for key, child in value.items() if key != "sourceIds"}
    if isinstance(value, list):
        return [_strip_source_id_refs(child) for child in value]
    return value


def _normalize_explicit_source_refs(section: dict[str, Any], raw_section: dict[str, Any], planned_source_ids: list[str]) -> dict[str, Any]:
    allowed = set(planned_source_ids)
    explicit_ids = _source_ids_from_value(raw_section)
    local_ids = _unique_strings(
        [source_id for source_id in explicit_ids if not allowed or source_id in allowed]
    )
    filtered_section = _filter_source_id_refs(section, set(local_ids))
    section_source_ids = _source_ids_from_value(filtered_section)
    if section_source_ids:
        filtered_section["sourceIds"] = section_source_ids
    else:
        filtered_section.pop("sourceIds", None)
    return filtered_section


def _draft_section_from_plan(section_plan: dict[str, Any], source_ids: list[str]) -> dict[str, Any]:
    title = str(section_plan.get("title") or "Lesson")
    concepts = _strings(section_plan.get("conceptKeywords") or section_plan.get("concept_keywords")) or [title]
    objectives = _strings(section_plan.get("learningObjectives") or section_plan.get("learning_objectives"))
    objective_text = objectives[0] if objectives else f"Explain {concepts[0]} in context."
    concept_cards = [
        {
            "type": "conceptCard",
            "title": concept.title(),
            "description": f"{concept.title()} is a key idea learners use in this section.",
            "sourceIds": source_ids,
        }
        for concept in concepts[:6]
    ]
    return {
        "id": str(section_plan.get("id") or "generated-section"),
        "title": title,
        "pageType": str(section_plan.get("pageType") or "learn"),
        "sectionType": str(section_plan.get("sectionType") or "lesson"),
        "sourceIds": source_ids,
        "content": [
            {
                "type": "text",
                "value": f"{title} focuses on {concepts[0]}. {objective_text} Work through the idea by naming the concept, locating it in the evidence, and applying it to a realistic case.",
                "sourceIds": source_ids,
            },
            {"type": "heading", "title": "Concepts introduced"},
            *concept_cards,
        ],
    }


def run_section_fill_workflow(
    section_plan: dict[str, Any],
    *,
    planned_section: dict[str, Any] | None = None,
    generated_section: dict[str, Any] | None = None,
    module_outline: dict[str, Any] | None = None,
    fallback_source_ids: list[str] | None = None,
) -> dict[str, Any]:
    source_ids = _section_source_ids(section_plan, fallback_source_ids)
    role = str(section_plan.get("role") or "lesson")
    planned_section_row = planned_section if isinstance(planned_section, dict) else {}
    raw_section = generated_section if isinstance(generated_section, dict) else _draft_section_from_plan(section_plan, source_ids)
    if planned_section_row and not isinstance(generated_section, dict):
        raw_section = {**planned_section_row, **raw_section}
        raw_section.pop("description", None)
    section = _coerce_generated_section(
        raw_section,
        fallback_id=str(section_plan.get("id") or "generated-section"),
        fallback_title=str(section_plan.get("title") or "Generated section"),
        page_type=str(section_plan.get("pageType") or "learn"),
        section_type=str(section_plan.get("sectionType") or "lesson"),
        source_ids=source_ids,
    )
    if isinstance(generated_section, dict):
        section = _normalize_explicit_source_refs(section, raw_section, source_ids)
    section = _with_generation_outline_metadata(
        section,
        module_outline=module_outline or {},
        section_outline={
            "id": section_plan.get("id"),
            "title": section_plan.get("title"),
            "description": section_plan.get("description"),
            "concept_keywords": section_plan.get("conceptKeywords"),
            "learning_objectives": section_plan.get("learningObjectives"),
            "planningSource": section_plan.get("planningSource"),
        },
        source_ids=source_ids,
        role=role,
    )
    content_blocks = _items(section.get("content"))
    issues: list[dict[str, Any]] = []
    if not content_blocks:
        issues.append(_issue("error", "Section fill produced no content blocks.", "content"))
    if role == "lesson" and not any(block.get("type") == "conceptCard" for block in content_blocks):
        issues.append(_issue("warning", "Lesson section has no conceptCard blocks.", "content"))
    replaced_planned_empty_section = bool(planned_section_row and not _items(planned_section_row.get("content")) and content_blocks)

    return _workflow_result(
        stage="section_fill_generation",
        contract_version=SECTION_FILL_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "contentBlockCount": len(content_blocks),
            "sourceIdCount": len(_source_ids_from_value(section)),
            "plannedSourceIdCount": len(source_ids),
            "replacedPlannedEmptySection": replaced_planned_empty_section,
        },
        artifacts={"section": section, "sectionPlan": section_plan, "plannedSection": planned_section_row},
    )


def _concept_cards_from_sections(sections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    concepts: list[dict[str, Any]] = []
    seen: set[str] = set()
    for section in sections:
        section_id = str(section.get("id") or "")
        for block in _items(section.get("content")):
            if block.get("type") == "conceptCard":
                title = str(block.get("title") or block.get("name") or "").strip()
                if not title:
                    continue
                key = title.lower()
                if key in seen:
                    continue
                seen.add(key)
                concepts.append(
                    {
                        "title": title,
                        "description": str(block.get("description") or f"Use {title} in context."),
                        "sourceSectionId": section_id,
                        "sourceIds": _strings(block.get("sourceIds")) or _strings(section.get("sourceIds")),
                    }
                )
            elif block.get("type") == "conceptCards" and isinstance(block.get("cards"), list):
                for card in _items(block.get("cards")):
                    title = str(card.get("title") or card.get("name") or "").strip()
                    if not title:
                        continue
                    key = title.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    concepts.append(
                        {
                            "title": title,
                            "description": str(card.get("description") or f"Use {title} in context."),
                            "sourceSectionId": section_id,
                            "sourceIds": _strings(card.get("sourceIds")) or _strings(section.get("sourceIds")),
                        }
                    )
    return concepts


def _draft_module_apply_section(
    *,
    module_id: str,
    module_title: str,
    concepts: list[dict[str, Any]],
) -> dict[str, Any]:
    question_concepts = concepts or [
        {
            "title": module_title,
            "description": f"Use the core ideas from {module_title} in context.",
            "sourceSectionId": "",
        }
    ]
    questions: list[dict[str, Any]] = []
    for index in range(10):
        concept = question_concepts[index % len(question_concepts)]
        concept_title = str(concept.get("title") or module_title)
        questions.append(
            {
                "id": f"q{index + 1}",
                "question": f"Which answer best demonstrates mastery of {concept_title}?",
                "options": [
                    f"Explain {concept_title} with source-backed evidence and apply it to a realistic case.",
                    f"Memorize the label {concept_title} without connecting it to evidence.",
                    f"Use {concept_title} before prerequisite ideas have been introduced.",
                    "Assess an unrelated idea that was not taught in this module.",
                ],
                "answers": [0],
                "conceptIds": [concept_title],
                "sourceSectionId": concept.get("sourceSectionId"),
            }
        )
    return {
        "id": f"{module_id}-apply",
        "title": f"Apply: {module_title}",
        "pageType": "apply",
        "sectionType": "assessment",
        "content": [
            {
                "type": "quiz",
                "questions": questions,
            }
        ],
    }


def _quiz_questions(block: dict[str, Any]) -> list[dict[str, Any]]:
    raw_questions = block.get("questions") if isinstance(block.get("questions"), list) else block.get("questionBank")
    return _items(raw_questions)


def _valid_quiz_question_count(questions: list[dict[str, Any]]) -> int:
    valid_count = 0
    for question in questions:
        options = question.get("options")
        answers = question.get("answers")
        if (
            str(question.get("question") or "").strip()
            and isinstance(options, list)
            and len(options) >= 2
            and isinstance(answers, list)
            and answers
            and all(isinstance(answer, int) and 0 <= answer < len(options) for answer in answers)
        ):
            valid_count += 1
    return valid_count


def run_module_apply_section_workflow(
    module_outline: dict[str, Any],
    filled_lesson_sections: list[dict[str, Any]],
    *,
    module_number: int = 1,
    fallback_source_ids: list[str] | None = None,
    generated_section: dict[str, Any] | None = None,
) -> dict[str, Any]:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    module_source_ids = _source_ids_from_outline(module_outline, fallback_source_ids or _strings(module_outline.get("sourceIds")))
    lesson_sections = [
        section
        for section in filled_lesson_sections
        if isinstance(section, dict)
        and str(section.get("pageType") or "learn") == "learn"
        and str(section.get("sectionType") or "lesson").lower() not in {"summary", "assessment"}
    ]
    concepts = _concept_cards_from_sections(lesson_sections)
    raw_section = (
        generated_section
        if isinstance(generated_section, dict)
        else _draft_module_apply_section(
            module_id=module_id,
            module_title=module_title,
            concepts=concepts,
        )
    )
    section = _coerce_generated_section(
        raw_section,
        fallback_id=f"{module_id}-apply",
        fallback_title=f"Apply: {module_title}",
        page_type="apply",
        section_type="assessment",
        source_ids=[],
    )
    section = _strip_source_id_refs(section)
    content_blocks = _items(section.get("content"))
    quiz_blocks = [block for block in content_blocks if block.get("type") == "quiz"]
    project_blocks = [block for block in content_blocks if block.get("type") == "project"]
    if quiz_blocks and str(section.get("sectionType") or "").lower() in {"", "quiz", "practice"}:
        section = {**section, "sectionType": "assessment"}
    section = _with_generation_outline_metadata(
        section,
        module_outline=module_outline,
        section_outline={
            "id": section.get("id"),
            "title": section.get("title"),
            "description": f"Assess concepts taught in {module_title}.",
            "conceptKeywords": [concept["title"] for concept in concepts],
            "learningObjectives": [f"Demonstrate mastery of concepts taught in {module_title}."],
            "planningSource": "module_apply_section_workflow",
        },
        source_ids=[],
        role="assessment",
    )
    section = _strip_source_id_refs(section)

    question_count = sum(len(_quiz_questions(block)) for block in quiz_blocks)
    valid_question_count = sum(_valid_quiz_question_count(_quiz_questions(block)) for block in quiz_blocks)
    taught_concepts = [str(concept.get("title") or "") for concept in concepts if str(concept.get("title") or "").strip()]
    quiz_text_parts: list[str] = []
    for block in quiz_blocks:
        for question in _quiz_questions(block):
            quiz_text_parts.append(str(question.get("question") or ""))
            options = question.get("options")
            if isinstance(options, list):
                quiz_text_parts.extend(str(option) for option in options)
    quiz_text = " ".join(quiz_text_parts).lower()
    assessed_concepts = [
        concept
        for concept in taught_concepts
        if concept.lower() in quiz_text
    ]

    issues: list[dict[str, Any]] = []
    if not lesson_sections:
        issues.append(_issue("error", "Apply generation needs filled lesson sections before assessment can be created.", "filledLessonSections"))
    if not concepts:
        issues.append(_issue("error", "Apply generation needs taught concept cards from filled lesson sections.", "filledLessonSections[].content"))
    if str(section.get("pageType") or "") != "apply":
        issues.append(_issue("error", "Apply generation must create an Apply page.", "pageType"))
    if str(section.get("sectionType") or "") not in {"assessment", "project"}:
        issues.append(_issue("error", "Apply generation must create an assessment or project section.", "sectionType"))
    if not content_blocks:
        issues.append(_issue("error", "Apply generation produced no content blocks.", "content"))
    if not quiz_blocks and not project_blocks:
        issues.append(_issue("error", "Apply generation must create a quiz or project block.", "content"))
    if quiz_blocks and len(quiz_blocks) != len(content_blocks):
        issues.append(_issue("error", "Quiz Apply sections must contain quiz blocks only.", "content"))
    if quiz_blocks and question_count < 10:
        issues.append(_issue("error", "Quiz Apply sections need at least 10 questions.", "content[].questions"))
    if quiz_blocks and valid_question_count != question_count:
        issues.append(_issue("error", "Every quiz question needs question, options, and zero-based answer indexes.", "content[].questions"))

    return _workflow_result(
        stage="module_apply_section_generation",
        contract_version=MODULE_APPLY_SECTION_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "lessonSectionCount": len(lesson_sections),
            "taughtConceptCount": len(taught_concepts),
            "assessedConceptCount": len(assessed_concepts),
            "contentBlockCount": len(content_blocks),
            "quizBlockCount": len(quiz_blocks),
            "projectBlockCount": len(project_blocks),
            "questionCount": question_count,
            "validQuestionCount": valid_question_count,
            "sourceIdCount": len(_source_ids_from_value(section)),
            "generatedFromFilledLessons": not isinstance(generated_section, dict),
        },
        artifacts={"section": section, "filledLessonSections": lesson_sections, "taughtConcepts": concepts},
    )


def _summary_section_from_sections(
    *,
    module_id: str,
    module_title: str,
    module_number: int,
    pacing_label: str,
    source_ids: list[str],
    sections: list[dict[str, Any]],
) -> dict[str, Any]:
    concepts: list[dict[str, Any]] = []
    for section in sections:
        for block in _items(section.get("content")):
            if block.get("type") != "conceptCard":
                continue
            title = str(block.get("title") or block.get("name") or "").strip()
            if not title:
                continue
            concepts.append(
                {
                    "type": "conceptCard",
                    "title": title,
                    "description": str(block.get("description") or f"Review {title}."),
                    "sourceSectionId": section.get("id"),
                    "sourceIds": _strings(block.get("sourceIds")) or _strings(section.get("sourceIds")),
                }
            )
    summary = {
        "id": f"{module_id}-summary",
        "title": f"{pacing_label} {module_number} Concept Review",
        "pageType": "learn",
        "sectionType": "summary",
        "content": [{"type": "heading", "title": f"{pacing_label} concepts"}, *concepts[:16]],
    }
    summary_source_ids = _source_ids_from_value(summary)
    if summary_source_ids:
        summary["sourceIds"] = summary_source_ids
    return _normalize_summary_for_pacing(summary, pacing_label)


def run_module_summary_section_workflow(
    module_outline: dict[str, Any],
    filled_lesson_sections: list[dict[str, Any]],
    *,
    module_number: int = 1,
    fallback_source_ids: list[str] | None = None,
    pacing_label: str | None = None,
    generated_section: dict[str, Any] | None = None,
) -> dict[str, Any]:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    module_source_ids = _source_ids_from_outline(module_outline, fallback_source_ids or _strings(module_outline.get("sourceIds")))
    label = pacing_label or _infer_pacing_label({"modules": [module_outline]})
    lesson_sections = [
        section
        for section in filled_lesson_sections
        if isinstance(section, dict)
        and str(section.get("pageType") or "learn") == "learn"
        and str(section.get("sectionType") or "lesson").lower() not in {"summary", "assessment"}
    ]
    raw_section = (
        generated_section
        if isinstance(generated_section, dict)
        else _summary_section_from_sections(
            module_id=module_id,
            module_title=module_title,
            module_number=module_number,
            pacing_label=label,
            source_ids=module_source_ids,
            sections=lesson_sections,
        )
    )
    section = _coerce_generated_section(
        raw_section,
        fallback_id=f"{module_id}-summary",
        fallback_title=f"{label} {module_number} Concept Review",
        page_type="learn",
        section_type="summary",
        source_ids=module_source_ids,
    )
    if isinstance(generated_section, dict):
        section = _normalize_explicit_source_refs(section, raw_section, module_source_ids)
    else:
        summary_source_ids = _source_ids_from_value(section)
        if summary_source_ids:
            section["sourceIds"] = summary_source_ids
        else:
            section.pop("sourceIds", None)
    section = _with_generation_outline_metadata(
        section,
        module_outline=module_outline,
        section_outline={
            "id": section.get("id"),
            "title": section.get("title"),
            "description": f"Summarize concepts introduced in {module_title}.",
            "conceptKeywords": [concept["title"] for concept in _concept_cards_from_sections(lesson_sections)],
            "learningObjectives": [f"Review the raw concepts introduced in {module_title}."],
            "planningSource": "module_summary_section_workflow",
        },
        source_ids=_strings(section.get("sourceIds")),
        role="summary",
    )
    section = _normalize_summary_for_pacing(section, label)

    content_blocks = _items(section.get("content"))
    concept_blocks = [block for block in content_blocks if block.get("type") == "conceptCard"]
    quiz_blocks = [block for block in content_blocks if block.get("type") == "quiz"]
    issues: list[dict[str, Any]] = []
    if not lesson_sections:
        issues.append(_issue("error", "Summary generation needs filled lesson sections before a module concept inventory can be created.", "filledLessonSections"))
    if str(section.get("pageType") or "") != "learn":
        issues.append(_issue("error", "Summary generation must create a Learn page.", "pageType"))
    if str(section.get("sectionType") or "") != "summary":
        issues.append(_issue("error", "Summary generation must create a summary section.", "sectionType"))
    if not content_blocks:
        issues.append(_issue("error", "Summary generation produced no content blocks.", "content"))
    if quiz_blocks:
        issues.append(_issue("error", "Summary sections must not contain quiz blocks.", "content"))
    if not concept_blocks:
        issues.append(_issue("error", "Summary sections need conceptCard blocks copied from filled lessons.", "content"))

    return _workflow_result(
        stage="module_summary_section_generation",
        contract_version=MODULE_SUMMARY_SECTION_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "lessonSectionCount": len(lesson_sections),
            "conceptCardCount": len(concept_blocks),
            "contentBlockCount": len(content_blocks),
            "sourceIdCount": len(_source_ids_from_value(section)),
            "generatedFromFilledLessons": not isinstance(generated_section, dict),
        },
        artifacts={"section": section, "filledLessonSections": lesson_sections},
    )


def run_module_assembly_workflow(
    module_outline: dict[str, Any],
    filled_sections: list[dict[str, Any]],
    *,
    module_number: int = 1,
    fallback_source_ids: list[str] | None = None,
    pacing_label: str | None = None,
) -> dict[str, Any]:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    source_ids = _source_ids_from_outline(module_outline, fallback_source_ids or _strings(module_outline.get("sourceIds")))
    sections = [section for section in filled_sections if isinstance(section, dict)]
    module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
    issues: list[dict[str, Any]] = []
    if not sections:
        issues.append(_issue("error", "Module assembly produced no sections.", "sections"))
    if not any(str(section.get("sectionType") or "") == "summary" for section in sections):
        issues.append(_issue("error", "Module assembly must end with a summary section.", "sections"))
    if not any(str(section.get("pageType") or "") == "apply" for section in sections):
        issues.append(_issue("warning", "Module assembly has no apply/practice section yet.", "sections"))

    return _workflow_result(
        stage="module_assembly",
        contract_version=MODULE_ASSEMBLY_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "sectionCount": len(sections),
            "lessonSectionCount": sum(1 for section in sections if str(section.get("sectionType") or "") == "lesson"),
            "applySectionCount": sum(1 for section in sections if str(section.get("pageType") or "") == "apply"),
            "summarySectionCount": sum(1 for section in sections if str(section.get("sectionType") or "") == "summary"),
            "contentReadySectionCount": sum(1 for section in sections if _items(section.get("content"))),
            "sourceIdCount": len(source_ids),
        },
        artifacts={"module": module},
    )


__all__ = [
    "CLUSTER_GENERATION_CONTRACT",
    "CLUSTER_PLAN_CONTRACT",
    "CLUSTER_QUALITY_REPORT_CONTRACT",
    "COURSE_MODULE_OUTLINE_CONTRACT",
    "COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT",
    "COURSE_WRAPPER_GENERATION_CONTRACT",
    "COURSE_WRAPPER_QUALITY_REPORT_CONTRACT",
    "MODULE_APPLY_SECTION_CONTRACT",
    "MODULE_ASSEMBLY_CONTRACT",
    "MODULE_SECTION_PLAN_CONTRACT",
    "MODULE_SUMMARY_SECTION_CONTRACT",
    "PROGRAM_BRIEF_CONTRACT",
    "PROGRAM_GENERATION_CONTRACT",
    "REQUIREMENT_GROUP_PLAN_CONTRACT",
    "SECTION_FILL_CONTRACT",
    "SOURCE_PACKET_OUTLINE_CONTRACT_VERSION",
    "STAGE_WORKFLOW_VERSION",
    "compact_stage_workflow_report",
    "run_cluster_generation_workflow",
    "run_course_module_outline_workflow",
    "run_course_wrapper_generation_workflow",
    "run_module_apply_section_workflow",
    "run_module_assembly_workflow",
    "run_module_section_plan_workflow",
    "run_module_summary_section_workflow",
    "run_program_brief_workflow",
    "run_program_generation_workflow",
    "run_requirement_group_plan_workflow",
    "run_section_fill_workflow",
]
