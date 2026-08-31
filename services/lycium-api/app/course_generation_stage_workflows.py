"""Deterministic implementations for Lycium's generation stage workflows.

Contract metadata, public stage names, status messages, and stage order live in
`course_generation_stage_registry`; this module re-exports the legacy constants
while keeping the runner implementations in one place.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, Literal

from app.course_agent_assembly import _coerce_generated_section, _module_lesson_outlines, _source_ids_from_outline
from app.course_agent_staged_support import _infer_pacing_label, _normalize_summary_for_pacing, _with_generation_outline_metadata
from app.course_coverage_checklists import COURSE_COVERAGE_CHECKLIST_CONTRACT, build_course_coverage_checklist
from app.course_outline_from_source_packet import (
    COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT,
    SOURCE_PACKET_OUTLINE_CONTRACT_VERSION,
    build_course_module_outline_quality_report,
    build_outline_from_source_packet,
)
from app.course_block_policy import supports_worked_example
from app.course_generation_stage_registry import (
    APPLY_NESTED_REPORT_ARTIFACT_KEYS,
    CLUSTER_GENERATION_CONTRACT,
    CLUSTER_PLAN_CONTRACT,
    CLUSTER_QUALITY_REPORT_CONTRACT,
    COURSE_MODULE_OUTLINE_CONTRACT,
    COURSE_TEMPLATE_ARTIFACT_CONTRACT,
    COURSE_TEMPLATE_CONTRACT,
    COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT,
    COURSE_WRAPPER_GENERATION_CONTRACT,
    MODULE_ASSESSMENT_PLAN_CONTRACT,
    MODULE_APPLY_SECTION_CONTRACT,
    MODULE_ASSEMBLY_CONTRACT,
    MODULE_PROJECT_ASSESSMENT_CONTRACT,
    MODULE_QUIZ_ASSESSMENT_CONTRACT,
    MODULE_SECTION_PLAN_CONTRACT,
    MODULE_SUMMARY_SECTION_CONTRACT,
    PROGRAM_BRIEF_CONTRACT,
    PROGRAM_GENERATION_CONTRACT,
    REQUIREMENT_GROUP_PLAN_CONTRACT,
    SECTION_FILL_CONTRACT,
    STAGE_WORKFLOW_VERSION,
)
from app.generation_helpers import _stable_id, _title_from_prompt_or_source
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

StageStatus = Literal["passed", "needs_review", "failed"]


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


def compact_module_apply_workflow_reports(apply_report: dict[str, Any]) -> list[dict[str, Any]]:
    artifacts = apply_report.get("artifacts") if isinstance(apply_report.get("artifacts"), dict) else {}
    reports: list[dict[str, Any]] = []
    for report_key in APPLY_NESTED_REPORT_ARTIFACT_KEYS:
        nested_report = artifacts.get(report_key)
        if isinstance(nested_report, dict):
            reports.append(compact_stage_workflow_report(nested_report))
    reports.append(compact_stage_workflow_report(apply_report))
    return reports


def _issue(severity: Literal["warning", "error"], message: str, location: str | None = None) -> dict[str, Any]:
    return {"severity": severity, "message": message, "location": location}


def _status_from_issues(issues: list[dict[str, Any]]) -> StageStatus:
    if any(issue.get("severity") == "error" for issue in issues):
        return "failed"
    return "needs_review" if issues else "passed"


def _duration_label(minutes: int) -> str:
    if minutes <= 0:
        return "unspecified"
    hours = round(minutes / 60)
    return f"{hours} hours" if hours != 1 else "1 hour"


def _packet_quality_value(source_packet: dict[str, Any] | None, key: str) -> Any:
    if not isinstance(source_packet, dict):
        return None
    quality = source_packet.get("quality") if isinstance(source_packet.get("quality"), dict) else {}
    snake_key = re.sub(r"(?<!^)([A-Z])", r"_\1", key).lower()
    return quality.get(key) or quality.get(snake_key) or source_packet.get(key) or source_packet.get(snake_key)


def _source_ids_from_packet(source_packet: dict[str, Any] | None) -> list[str]:
    if not isinstance(source_packet, dict):
        return []
    source_ids: list[str] = []
    for document in _items(source_packet.get("source_documents")):
        for value in (
            document.get("courseSourceId"),
            document.get("sourceId"),
            document.get("source_public_id"),
            document.get("sourcePublicId"),
            document.get("id"),
        ):
            clean = str(value or "").strip()
            if clean:
                source_ids.append(clean)
    for source in _items(source_packet.get("sources")):
        for value in (
            source.get("courseSourceId"),
            source.get("sourceId"),
            source.get("source_public_id"),
            source.get("sourcePublicId"),
            source.get("id"),
        ):
            clean = str(value or "").strip()
            if clean:
                source_ids.append(clean)
    return _unique_strings(source_ids, limit=20)


def _topic_phrases_from_source_packet(source_packet: dict[str, Any] | None) -> list[str]:
    if not isinstance(source_packet, dict):
        return []
    snippets: list[str] = []
    for source in [*_items(source_packet.get("source_documents")), *_items(source_packet.get("sources"))]:
        for key in ("title", "description", "summary", "abstract", "text", "content"):
            value = source.get(key)
            if isinstance(value, str) and value.strip():
                snippets.append(value[:800])
    phrases: list[str] = []
    for snippet in snippets:
        clean = re.sub(r"https?://\S+", " ", snippet)
        clean = re.sub(r"\([^)]*\)", " ", clean)
        chunks = re.split(r"\s*(?:,|;|\n|\.|\band\b)\s*", clean, flags=re.IGNORECASE)
        for chunk in chunks:
            phrase = re.sub(r"\s+", " ", chunk).strip(" -:,.")
            words = phrase.split()
            if 1 <= len(words) <= 6:
                phrases.append(phrase)
    return _unique_strings(phrases, limit=12)


def _course_template_learning_outcomes(
    *,
    title: str,
    checklist: dict[str, Any],
    goals: list[str],
) -> list[dict[str, Any]]:
    items = _items(checklist.get("requiredItems"))
    outcomes: list[dict[str, Any]] = []
    for index, goal in enumerate(_unique_strings(goals, limit=4), start=1):
        outcomes.append(
            {
                "id": _stable_id("outcome", title, goal, str(index)),
                "outcome": goal,
                "coverageItemIds": [
                    str(item.get("id"))
                    for item in items[index - 1 : index]
                    if str(item.get("id") or "").strip()
                ],
            }
        )
    for item in items:
        if len(outcomes) >= 4:
            break
        item_title = str(item.get("title") or title).strip()
        item_id = str(item.get("id") or "").strip()
        outcome = f"Explain and apply {item_title.lower()} in course-level work."
        outcomes.append(
            {
                "id": _stable_id("outcome", title, item_title, str(len(outcomes) + 1)),
                "outcome": outcome,
                "coverageItemIds": [item_id] if item_id else [],
            }
        )
    if len(outcomes) < 3:
        fallback_outcomes = [
            f"Describe the core vocabulary and boundaries of {title}.",
            f"Use evidence to reason about realistic {title.lower()} problems.",
            f"Connect major ideas in {title} to assessment-ready examples.",
        ]
        for outcome in fallback_outcomes:
            if len(outcomes) >= 3:
                break
            outcomes.append(
                {
                    "id": _stable_id("outcome", title, outcome, str(len(outcomes) + 1)),
                    "outcome": outcome,
                    "coverageItemIds": [],
                }
            )
    return outcomes


def _course_template_topic_phrase(required_items: list[dict[str, Any]], fallback_title: str) -> str:
    titles = _unique_strings(
        [
            str(item.get("title") or "").strip().lower()
            for item in required_items
            if str(item.get("title") or "").strip()
        ],
        limit=3,
    )
    if len(titles) >= 3:
        return f"{titles[0]}, {titles[1]}, and {titles[2]}"
    if len(titles) == 2:
        return f"{titles[0]} and {titles[1]}"
    if len(titles) == 1:
        return titles[0]
    return fallback_title.lower()


def _course_template_short_description(title: str, required_items: list[dict[str, Any]], level: str | None) -> str:
    level_label = str(level or "introductory").strip().lower()
    topic_phrase = _course_template_topic_phrase(required_items, title)
    return f"An {level_label} course that builds working knowledge of {topic_phrase} through structured lessons and applied checks."


def _course_template_outcome(title: str, required_items: list[dict[str, Any]]) -> str:
    topic_phrase = _course_template_topic_phrase(required_items, title)
    return f"Use {topic_phrase} to explain core ideas, analyze realistic cases, and prepare for course-level assessments."


def _build_course_template_quality_report(
    template: dict[str, Any],
    *,
    source_packet: dict[str, Any] | None = None,
) -> dict[str, Any]:
    checklist = template.get("courseCoverageChecklist") if isinstance(template.get("courseCoverageChecklist"), dict) else {}
    required_items = _items(checklist.get("requiredItems"))
    learning_outcomes = _items(template.get("learningOutcomes"))
    scope = template.get("scope") if isinstance(template.get("scope"), dict) else {}
    issues: list[dict[str, Any]] = []
    if not str(template.get("title") or "").strip() or template.get("title") == "Untitled Course":
        issues.append(_issue("error", "Course template needs a resolved course title.", "title"))
    if not str(template.get("shortDescription") or "").strip():
        issues.append(_issue("error", "Course template needs a catalog shortDescription.", "shortDescription"))
    for key in ("audience", "level", "outcome", "duration", "assessmentExpectations"):
        if not str(scope.get(key) or "").strip():
            issues.append(_issue("error", f"Course template scope is missing {key}.", f"scope.{key}"))
    if len(learning_outcomes) < 3:
        issues.append(_issue("error", "Course template needs at least three learning outcomes.", "learningOutcomes"))
    if len(required_items) < 3:
        issues.append(_issue("warning", "Course template has fewer than three required coverage items.", "courseCoverageChecklist.requiredItems"))
    if any(not _strings(item.get("mustTeach")) for item in required_items):
        issues.append(_issue("error", "Every coverage item needs mustTeach terms.", "courseCoverageChecklist.requiredItems[].mustTeach"))
    if any(not _items(item.get("sectionPlans")) for item in required_items):
        issues.append(_issue("error", "Every coverage item needs downstream section-plan hints.", "courseCoverageChecklist.requiredItems[].sectionPlans"))
    if _has_course_materialization_payload(template):
        issues.append(_issue("error", "Course template workflow must not materialize modules, sections, build tasks, or content.", "courseTemplate"))

    packet_status = _packet_quality_value(source_packet, "status")
    if source_packet is not None and str(packet_status or "").lower() not in {"usable", "passed", "ready", ""}:
        issues.append(_issue("warning", "Source packet is not fully usable; template should be treated as prompt-inferred.", "sourcePacket.quality.status"))

    status = _status_from_issues(issues)
    return {
        "contractVersion": COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT,
        "status": status,
        "passed": status == "passed",
        "reasons": [issue["message"] for issue in issues if issue.get("severity") == "error"],
        "warnings": [issue["message"] for issue in issues if issue.get("severity") == "warning"],
        "metrics": {
            "learningOutcomeCount": len(learning_outcomes),
            "requiredCoverageItemCount": len(required_items),
            "sourceIdCount": len(_strings(template.get("sourceIds"))),
            "hasMaterializedCourseContent": _has_course_materialization_payload(template),
            "sourcePacketQualityStatus": packet_status,
            "sourcePacketConceptCoverageRatio": _packet_quality_value(source_packet, "conceptCoverageRatio"),
        },
        "policy": {
            "materializesLearnerContent": False,
            "createsModules": False,
            "requiresCoverageChecklist": True,
            "requiresLearningOutcomes": True,
            "nextWorkflow": COURSE_MODULE_OUTLINE_CONTRACT,
            "coverageChecklistContract": COURSE_COVERAGE_CHECKLIST_CONTRACT,
        },
    }


def run_course_template_workflow(
    *,
    prompt: str,
    level: str | None = None,
    target_audience: str | None = None,
    learning_goals: list[str] | None = None,
    desired_module_count: int = 8,
    expected_duration_minutes: int = 180,
    source_policy: str = "balanced",
    source_packet: dict[str, Any] | None = None,
    category: str | None = None,
    department: str | None = None,
) -> dict[str, Any]:
    title = _title_from_prompt_or_source(prompt, source_packet)
    goals = _strings(learning_goals or [])
    checklist = build_course_coverage_checklist(
        prompt=prompt,
        title=title,
        level=level,
        goals=goals,
    )
    source_packet_terms = _topic_phrases_from_source_packet(source_packet)
    if len(_items(checklist.get("requiredItems"))) < 3 and source_packet_terms and not goals:
        checklist = build_course_coverage_checklist(
            prompt=prompt,
            title=title,
            level=level,
            goals=source_packet_terms,
        )
        checklist["source"] = "source_packet_terms"
    required_items = _items(checklist.get("requiredItems"))
    source_ids = _source_ids_from_packet(source_packet)
    template = {
        "contractVersion": COURSE_TEMPLATE_ARTIFACT_CONTRACT,
        "title": title,
        "shortDescription": _course_template_short_description(title, required_items, level),
        "category": category,
        "department": department,
        "sourceIds": source_ids,
        "scope": {
            "audience": target_audience or f"{level or 'general'} learners",
            "level": level or "unspecified",
            "duration": _duration_label(expected_duration_minutes),
            "outcome": _course_template_outcome(title, required_items),
            "prerequisites": [],
            "exclusions": [],
            "assessmentExpectations": "Use Apply sections after lesson content is generated.",
            "sourcePolicy": source_policy,
            "evidenceMode": "source_packet" if source_packet else "prompt_inferred",
        },
        "learningOutcomes": _course_template_learning_outcomes(
            title=title,
            checklist=checklist,
            goals=goals,
        ),
        "courseCoverageChecklist": checklist,
        "handoff": {
            "nextWorkflow": COURSE_MODULE_OUTLINE_CONTRACT,
            "desiredModuleCount": desired_module_count,
            "coverageChecklistContract": checklist.get("contractVersion"),
            "requiredCoverageItemIds": [
                str(item.get("id"))
                for item in required_items
                if str(item.get("id") or "").strip()
            ],
            "mustPreserve": [
                "courseCoverageChecklist.requiredItems[].id",
                "courseCoverageChecklist.requiredItems[].mustTeach",
                "learningOutcomes[].coverageItemIds",
                "scope",
            ],
        },
        "sourcePacketHandoff": {
            "contractVersion": source_packet.get("contract_version") or source_packet.get("contractVersion"),
            "qualityStatus": _packet_quality_value(source_packet, "status"),
            "conceptCoverageRatio": _packet_quality_value(source_packet, "conceptCoverageRatio"),
            "sourceIds": source_ids,
        }
        if isinstance(source_packet, dict)
        else None,
    }
    if template["sourcePacketHandoff"] is None:
        template.pop("sourcePacketHandoff")
    quality_report = _build_course_template_quality_report(template, source_packet=source_packet)
    issues = [
        _issue("error" if reason in quality_report["reasons"] else "warning", reason)
        for reason in [*quality_report["reasons"], *quality_report["warnings"]]
    ]
    return _workflow_result(
        stage="course_template_generation",
        contract_version=COURSE_TEMPLATE_CONTRACT,
        status=quality_report["status"],
        issues=issues,
        metrics={
            "learningOutcomeCount": quality_report["metrics"]["learningOutcomeCount"],
            "requiredCoverageItemCount": quality_report["metrics"]["requiredCoverageItemCount"],
            "sourceIdCount": quality_report["metrics"]["sourceIdCount"],
            "desiredModuleCount": desired_module_count,
            "templateQualityStatus": quality_report["status"],
        },
        artifacts={"courseTemplate": template, "courseTemplateQualityReport": quality_report},
    )


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
    course_template: dict[str, Any] | None = None,
) -> dict[str, Any]:
    coverage_checklist = (
        course_template.get("courseCoverageChecklist")
        if isinstance(course_template, dict) and isinstance(course_template.get("courseCoverageChecklist"), dict)
        else None
    )
    outline = (
        dict(outline)
        if isinstance(outline, dict)
        else build_outline_from_source_packet(
            prompt=prompt,
            source_packet=source_packet,
            desired_module_count=desired_module_count,
            sections_per_module=sections_per_module,
            include_section_outlines=False,
            coverage_checklist=coverage_checklist,
        )
    )
    modules = _items(outline.get("modules"))
    section_count = sum(len(_items(module.get("sections"))) for module in modules)
    quality_report = build_course_module_outline_quality_report(
        outline,
        source_packet=source_packet,
        desired_module_count=desired_module_count,
        sections_per_module=sections_per_module,
        coverage_checklist=coverage_checklist,
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
            "requiredCoverageItemCount": quality_report.get("metrics", {}).get("requiredCoverageItemCount", 0)
            if isinstance(quality_report.get("metrics"), dict)
            else 0,
            "moduleAssignedCoverageItemCount": quality_report.get("metrics", {}).get("moduleAssignedCoverageItemCount", 0)
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
        coverage_item_ids = _strings(lesson_outline.get("assignedCoverageItemIds") or lesson_outline.get("coverageItemIds"))
        coverage_item_id = str(
            lesson_outline.get("coverageItemId")
            or (coverage_item_ids[0] if coverage_item_ids else "")
        ).strip()
        if coverage_item_id and coverage_item_id not in coverage_item_ids:
            coverage_item_ids = [coverage_item_id, *coverage_item_ids]
        coverage_must_teach = _strings(lesson_outline.get("coverageMustTeach"))
        concept_keywords = (
            _strings(lesson_outline.get("concept_keywords") or lesson_outline.get("conceptKeywords"))
            or coverage_must_teach
        )
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
                "conceptKeywords": concept_keywords,
                "learningObjectives": _strings(lesson_outline.get("learning_objectives") or lesson_outline.get("learningObjectives")),
                "planningSource": str(lesson_outline.get("planningSource") or module_outline.get("planningSource") or "module_outline"),
                "assignedCoverageItemIds": coverage_item_ids,
                "coverageItemId": coverage_item_id,
                "coverageMustTeach": coverage_must_teach,
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
                "sourceIds": [],
                "content": [],
                "assignedCoverageItemIds": _strings(section_plan.get("assignedCoverageItemIds")),
                "coverageItemId": str(section_plan.get("coverageItemId") or ""),
                "coverageMustTeach": _strings(section_plan.get("coverageMustTeach")),
            },
            module_outline=module_outline,
            section_outline={
                "id": section_plan.get("id"),
                "title": section_plan.get("title"),
                "description": section_plan.get("description"),
                "conceptKeywords": section_plan.get("conceptKeywords"),
                "learningObjectives": section_plan.get("learningObjectives"),
                "planningSource": section_plan.get("planningSource"),
                "assignedCoverageItemIds": section_plan.get("assignedCoverageItemIds"),
                "coverageItemId": section_plan.get("coverageItemId"),
                "coverageMustTeach": section_plan.get("coverageMustTeach"),
            },
            source_ids=_strings(section_plan.get("sourceIds")),
            role=str(section_plan.get("role") or "lesson"),
        )
        for index, section_plan in enumerate(section_plans, start=1)
    ]
    for planned_section, section_plan in zip(planned_sections, section_plans):
        metadata = planned_section.get("metadata") if isinstance(planned_section.get("metadata"), dict) else {}
        generation_outline = (
            metadata.get("generationOutline")
            if isinstance(metadata.get("generationOutline"), dict)
            else {}
        )
        planned_source_ids = _strings(section_plan.get("sourceIds"))
        source_needs = [
            f"Add or confirm sources that support learner-facing content for {concept}."
            for concept in _strings(section_plan.get("conceptKeywords"))[:6]
        ]
        generation_outline.update(
            {
                "plannedLearningOutcome": (
                    _strings(section_plan.get("learningObjectives"))[0]
                    if _strings(section_plan.get("learningObjectives"))
                    else ""
                ),
                "candidateSourceIds": planned_source_ids,
                "assignedCoverageItemIds": _strings(section_plan.get("assignedCoverageItemIds")),
                "coverageItemId": str(section_plan.get("coverageItemId") or ""),
                "coverageMustTeach": _strings(section_plan.get("coverageMustTeach")),
                "sourceNeeds": source_needs,
                "contentStatus": "planned_empty",
                "nextWorkflow": "section_fill",
                "rebuildScopes": ["section_plan", "section_content"],
            }
        )
        metadata["generationOutline"] = generation_outline
        planned_section["metadata"] = metadata
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
    if fallback_source_ids is None:
        return source_ids
    allowed = {str(source_id) for source_id in fallback_source_ids}
    if not allowed:
        return []
    filtered = [source_id for source_id in source_ids if source_id in allowed]
    return filtered or list(fallback_source_ids)


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


def _normalize_concept_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _concept_display_name(concept: str) -> str:
    return " ".join(word[:1].upper() + word[1:] for word in concept.split())


def _concept_definition(concept: str) -> str:
    title = _concept_display_name(concept)
    return (
        f"{title} is a specific course idea learners should define clearly, connect to prerequisite ideas, "
        "and apply in a realistic example."
    )


def _lesson_core_text(title: str, concepts: list[str], objective_text: str) -> str:
    concept_names = ", ".join(concepts[:6])
    definitions = " ".join(f"{_concept_display_name(concept)}: {_concept_definition(concept)}" for concept in concepts[:6])
    return f"{title} focuses on {concept_names}. {objective_text} {definitions}"


def _lesson_worked_example_block(concepts: list[str], source_ids: list[str]) -> dict[str, Any]:
    focus = _concept_display_name(concepts[0]) if concepts else "The Section Concept"
    supporting = _concept_display_name(concepts[1]) if len(concepts) > 1 else "the supporting idea"
    return {
        "type": "workedExample",
        "title": f"Worked example: Apply {focus}",
        "problem": (
            f"A learner is asked to use {focus} in a realistic course task. Decide what information matters, "
            "show the setup, and explain how the result should be checked."
        ),
        "given": [
            f"Primary concept: {focus}",
            f"Supporting concept or constraint: {supporting}",
            "A realistic case with known values, evidence, assumptions, or decision constraints.",
        ],
        "find": [
            f"The correct application of {focus}.",
            "A final answer, classification, decision, or interpretation that can be checked.",
        ],
        "steps": [
            {
                "explanation": f"Name the known quantities, definitions, or evidence that control {focus}.",
                "equation": "knowns + assumptions -> setup",
            },
            {
                "explanation": f"Apply {focus} while accounting for {supporting}.",
                "equation": "setup + method -> result",
            },
            {
                "explanation": "Check whether the result is reasonable before treating it as mastery evidence.",
                "equation": "result check = units/sign/assumption/meaning test",
            },
        ],
        "workedAnswer": f"The answer should state the result and explain how {focus} supports it.",
        "check": "A credible solution names assumptions, uses the right relationship, and checks the result against the problem context.",
        "sourceIds": source_ids,
    }


def _lesson_guided_practice_block(concepts: list[str], source_ids: list[str]) -> dict[str, Any]:
    focus = _concept_display_name(concepts[0]) if concepts else "the section concept"
    supporting = _concept_display_name(concepts[1]) if len(concepts) > 1 else "the supporting idea"
    return {
        "type": "text",
        "heading": "Guided practice",
        "value": (
            f"Apply {focus} by writing a short explanation that names a realistic case, identifies the evidence or example that matters, "
            f"and explains how {supporting} changes the interpretation. End by naming one limitation or unanswered question that would need more support."
        ),
        "sourceIds": source_ids,
    }


def _lesson_practice_text(concepts: list[str]) -> str:
    focus = concepts[0] if concepts else "the section concept"
    return (
        f"Quick check: explain {focus} in one sentence, identify the prior concept it depends on, "
        "then solve or outline a simple example without looking back at the definition."
    )


def _normalize_explicit_source_refs(section: dict[str, Any], raw_section: dict[str, Any], planned_source_ids: list[str]) -> dict[str, Any]:
    allowed = set(planned_source_ids)
    if not allowed:
        return _strip_source_id_refs(section)
    explicit_ids = _source_ids_from_value(raw_section)
    local_ids = _unique_strings(
        [source_id for source_id in explicit_ids if source_id in allowed]
    )
    filtered_section = _filter_source_id_refs(section, set(local_ids))
    section_source_ids = _source_ids_from_value(filtered_section)
    if section_source_ids:
        filtered_section["sourceIds"] = section_source_ids
    else:
        filtered_section.pop("sourceIds", None)
    return filtered_section


def _draft_section_from_plan(
    section_plan: dict[str, Any],
    source_ids: list[str],
    *,
    module_outline: dict[str, Any] | None = None,
) -> dict[str, Any]:
    title = str(section_plan.get("title") or "Lesson")
    coverage_must_teach = _strings(section_plan.get("coverageMustTeach"))
    concepts = _unique_strings(
        [
            *coverage_must_teach,
            *_strings(section_plan.get("conceptKeywords") or section_plan.get("concept_keywords")),
        ],
        limit=8,
    ) or [title]
    objectives = _strings(section_plan.get("learningObjectives") or section_plan.get("learning_objectives"))
    objective_text = objectives[0] if objectives else f"Explain {concepts[0]} in context."
    concept_cards = [
        {
            "type": "conceptCard",
            "title": _concept_display_name(concept),
            "description": _concept_definition(concept),
            "sourceIds": source_ids,
        }
        for concept in concepts[:6]
    ]
    application_block = (
        _lesson_worked_example_block(concepts, source_ids)
        if supports_worked_example(section_plan, module_outline or {}, concepts, objectives)
        else _lesson_guided_practice_block(concepts, source_ids)
    )
    return {
        "id": str(section_plan.get("id") or "generated-section"),
        "title": title,
        "pageType": str(section_plan.get("pageType") or "learn"),
        "sectionType": str(section_plan.get("sectionType") or "lesson"),
        "sourceIds": source_ids,
        "content": [
            {
                "type": "text",
                "heading": "Core explanation",
                "value": _lesson_core_text(title, concepts, objective_text),
                "sourceIds": source_ids,
            },
            application_block,
            {
                "type": "text",
                "heading": "Practice",
                "value": _lesson_practice_text(concepts),
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
    raw_section = (
        generated_section
        if isinstance(generated_section, dict)
        else _draft_section_from_plan(section_plan, source_ids, module_outline=module_outline)
    )
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
            "assignedCoverageItemIds": section_plan.get("assignedCoverageItemIds"),
            "coverageItemId": section_plan.get("coverageItemId"),
            "coverageMustTeach": section_plan.get("coverageMustTeach"),
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


BAD_QUIZ_TEMPLATE_PHRASES = (
    "which answer best demonstrates mastery",
    "source-backed evidence and apply it to a realistic case",
    "memorize the label",
    "before prerequisite ideas have been introduced",
    "assess an unrelated idea",
)

DEFAULT_ASSESSMENT_MIN_CONTENT_COVERAGE_RATIO = 0.7
ASSESSMENT_COVERAGE_SCOPE_ALIASES = {
    "current section": "current_section",
    "current sections": "current_section",
    "current module": "current_module",
    "current": "current_module",
    "current and previous section": "current_and_previous_sections",
    "current and previous sections": "current_and_previous_sections",
    "current previous sections": "current_and_previous_sections",
    "current and previous module": "current_and_previous_modules",
    "current and previous modules": "current_and_previous_modules",
    "current previous modules": "current_and_previous_modules",
    "all section": "entire_course",
    "all sections": "entire_course",
    "all module": "entire_course",
    "all modules": "entire_course",
    "entire course": "entire_course",
    "course": "entire_course",
}


def _bounded_ratio(value: Any, default: float) -> float:
    try:
        ratio = float(value)
    except (TypeError, ValueError):
        return default
    return min(1.0, max(0.0, ratio))


def _assessment_min_content_coverage_ratio(module_outline: dict[str, Any]) -> float:
    metadata = module_outline.get("metadata") if isinstance(module_outline.get("metadata"), dict) else {}
    candidates = [
        module_outline.get("minimumContentCoverageRatio"),
        module_outline.get("minContentCoverageRatio"),
        module_outline.get("assessmentCoverageRatio"),
        metadata.get("minimumContentCoverageRatio"),
        metadata.get("minContentCoverageRatio"),
        metadata.get("assessmentCoverageRatio"),
    ]
    for candidate in candidates:
        if candidate is not None:
            return _bounded_ratio(candidate, DEFAULT_ASSESSMENT_MIN_CONTENT_COVERAGE_RATIO)
    return DEFAULT_ASSESSMENT_MIN_CONTENT_COVERAGE_RATIO


def _normalize_assessment_coverage_scope(value: Any, *, scale: str) -> str:
    normalized = _normalize_concept_text(str(value or ""))
    if normalized in ASSESSMENT_COVERAGE_SCOPE_ALIASES:
        return ASSESSMENT_COVERAGE_SCOPE_ALIASES[normalized]
    if scale == "final":
        return "entire_course"
    if scale == "unit_test":
        return "current_and_previous_modules"
    return "current_module"


def _assessment_coverage_scope(module_outline: dict[str, Any], *, scale: str) -> str:
    metadata = module_outline.get("metadata") if isinstance(module_outline.get("metadata"), dict) else {}
    candidates = [
        module_outline.get("coverageScope"),
        module_outline.get("assessmentCoverageScope"),
        module_outline.get("applyCoverageScope"),
        metadata.get("coverageScope"),
        metadata.get("assessmentCoverageScope"),
        metadata.get("applyCoverageScope"),
    ]
    for candidate in candidates:
        if candidate is not None:
            return _normalize_assessment_coverage_scope(candidate, scale=scale)
    return _normalize_assessment_coverage_scope(None, scale=scale)


def _stable_concept_id(value: str) -> str:
    return _normalize_concept_text(value).replace(" ", "-")


def _section_ids(sections: list[dict[str, Any]]) -> list[str]:
    return _unique_strings([str(section.get("id") or "") for section in sections])


def _concept_ids(concepts: list[dict[str, Any]]) -> list[str]:
    return _unique_strings(
        [_stable_concept_id(_concept_title(concept, "concept")) for concept in concepts]
    )


def _coverage_item_ids_from_sections(sections: list[dict[str, Any]]) -> list[str]:
    values: list[str] = []
    for section in sections:
        values.extend(_strings(section.get("assignedCoverageItemIds")))
        coverage_item_id = str(section.get("coverageItemId") or "").strip()
        if coverage_item_id:
            values.append(coverage_item_id)
        outline = section.get("metadata", {}).get("generationOutline") if isinstance(section.get("metadata"), dict) else {}
        if isinstance(outline, dict):
            values.extend(_strings(outline.get("assignedCoverageItemIds") or outline.get("coverageItemIds")))
            outline_item_id = str(outline.get("coverageItemId") or "").strip()
            if outline_item_id:
                values.append(outline_item_id)
    return _unique_strings(values)


def _module_assessment_override(module_outline: dict[str, Any]) -> str | None:
    metadata = module_outline.get("metadata") if isinstance(module_outline.get("metadata"), dict) else {}
    candidates = [
        module_outline.get("assessmentKind"),
        module_outline.get("assessmentType"),
        module_outline.get("applyKind"),
        module_outline.get("applyType"),
        metadata.get("assessmentKind"),
        metadata.get("assessmentType"),
        metadata.get("applyKind"),
        metadata.get("applyType"),
    ]
    for candidate in candidates:
        normalized = _normalize_concept_text(str(candidate or ""))
        if normalized in {"quiz", "test", "exam", "checkpoint"}:
            return "quiz"
        if normalized in {"project", "lab", "capstone", "portfolio", "performance"}:
            return "project"
    return None


def _module_assessment_text(module_outline: dict[str, Any]) -> str:
    metadata = module_outline.get("metadata") if isinstance(module_outline.get("metadata"), dict) else {}
    rows = [
        module_outline.get("title"),
        module_outline.get("description"),
        module_outline.get("summary"),
        metadata.get("title"),
        metadata.get("description"),
        metadata.get("assessmentNotes"),
    ]
    rows.extend(_strings(module_outline.get("tags")))
    rows.extend(_strings(module_outline.get("learningObjectives") or module_outline.get("learning_objectives")))
    return " ".join(str(row or "") for row in rows).lower()


def _assessment_kind_for_module(module_outline: dict[str, Any]) -> str:
    override = _module_assessment_override(module_outline)
    if override:
        return override
    text = _module_assessment_text(module_outline)
    project_terms = {
        "project",
        "capstone",
        "portfolio",
        "lab",
        "laboratory",
        "design",
        "studio",
        "case study",
        "simulation",
        "field work",
        "practical",
    }
    return "project" if any(term in text for term in project_terms) else "quiz"


def _assessment_scale_for_module(module_title: str, module_number: int, total_module_count: int | None) -> str:
    normalized_title = _normalize_concept_text(module_title)
    if "final" in normalized_title or "capstone" in normalized_title:
        return "final"
    if total_module_count and module_number == total_module_count:
        return "final"
    if module_number > 0 and module_number % 4 == 0:
        return "unit_test"
    return "module_check"


def assessment_coverage_scope_for_module(
    module_outline: dict[str, Any],
    *,
    module_number: int = 1,
    total_module_count: int | None = None,
) -> str:
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    scale = _assessment_scale_for_module(module_title, module_number, total_module_count)
    return _assessment_coverage_scope(module_outline, scale=scale)


def _quiz_question_target(scale: str, taught_concept_count: int) -> int:
    floor = 20 if scale == "final" else 15 if scale == "unit_test" else 10
    return max(floor, taught_concept_count)


def run_module_assessment_plan_workflow(
    module_outline: dict[str, Any],
    filled_lesson_sections: list[dict[str, Any]],
    *,
    module_number: int = 1,
    total_module_count: int | None = None,
    coverage_lesson_sections: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    lesson_sections = [
        section
        for section in filled_lesson_sections
        if isinstance(section, dict)
        and str(section.get("pageType") or "learn") == "learn"
        and str(section.get("sectionType") or "lesson").lower() not in {"summary", "assessment"}
    ]
    assessment_kind = _assessment_kind_for_module(module_outline)
    scale = _assessment_scale_for_module(module_title, module_number, total_module_count)
    coverage_sections = [
        section
        for section in (coverage_lesson_sections if isinstance(coverage_lesson_sections, list) else lesson_sections)
        if isinstance(section, dict)
        and str(section.get("pageType") or "learn") == "learn"
        and str(section.get("sectionType") or "lesson").lower() not in {"summary", "assessment"}
    ]
    concepts = _concept_cards_from_sections(lesson_sections)
    target_concepts = _concept_cards_from_sections(coverage_sections) or concepts
    target_concept_ids = _concept_ids(target_concepts)
    target_coverage_item_ids = _coverage_item_ids_from_sections(coverage_sections)
    coverage_scope = assessment_coverage_scope_for_module(
        module_outline,
        module_number=module_number,
        total_module_count=total_module_count,
    )
    minimum_coverage_ratio = _assessment_min_content_coverage_ratio(module_outline)
    question_target = _quiz_question_target(scale, len(target_concepts)) if assessment_kind == "quiz" else 0
    quiz_spec = {
        "questionCount": question_target,
        "timeLimitSeconds": None,
        "multipleAnswerRatio": 0,
        "questionTypes": ["single_answer", "calculation", "classification", "interpretation", "prediction"],
    }
    project_spec = {
        "submissionType": "text",
        "requiredEvidenceCount": 4,
        "rubricCriterionCount": 3,
    }
    issues: list[dict[str, Any]] = []
    if not lesson_sections:
        issues.append(_issue("error", "Assessment planning needs filled lesson sections.", "filledLessonSections"))
    if not concepts:
        issues.append(_issue("error", "Assessment planning needs taught concept cards.", "filledLessonSections[].content"))
    if not target_concepts:
        issues.append(_issue("error", "Assessment planning needs target concepts for coverage.", "coverage.targetConcepts"))
    plan = {
        "contractVersion": "module-assessment-plan-v1",
        "moduleId": module_id,
        "moduleTitle": module_title,
        "assessmentKind": assessment_kind,
        "assessmentScale": scale,
        "coverageScope": coverage_scope,
        "minimumContentCoverageRatio": minimum_coverage_ratio,
        "targetSectionIds": _section_ids(coverage_sections),
        "targetConceptIds": target_concept_ids,
        "targetCoverageItemIds": target_coverage_item_ids,
        "targetConcepts": target_concepts,
        "coverageUniverse": {
            "sectionCount": len(coverage_sections),
            "conceptCount": len(target_concept_ids),
            "coverageItemCount": len(target_coverage_item_ids),
        },
        "questionTarget": question_target,
        "projectTarget": assessment_kind == "project",
        "quizSpec": quiz_spec if assessment_kind == "quiz" else None,
        "projectSpec": project_spec if assessment_kind == "project" else None,
        "taughtConcepts": concepts,
        "routingReason": (
            "Explicit or project-like module signals require applied work."
            if assessment_kind == "project"
            else "Default module Apply section should check taught concepts with realistic quiz items."
        ),
        "nextWorkflow": MODULE_PROJECT_ASSESSMENT_CONTRACT if assessment_kind == "project" else MODULE_QUIZ_ASSESSMENT_CONTRACT,
    }
    return _workflow_result(
        stage="module_assessment_planning",
        contract_version=MODULE_ASSESSMENT_PLAN_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "lessonSectionCount": len(lesson_sections),
            "taughtConceptCount": len(concepts),
            "targetSectionCount": len(coverage_sections),
            "targetConceptCount": len(target_concept_ids),
            "minimumContentCoverageRatio": minimum_coverage_ratio,
            "assessmentKind": assessment_kind,
            "assessmentScale": scale,
            "coverageScope": coverage_scope,
            "questionTarget": question_target,
        },
        artifacts={"assessmentPlan": plan, "filledLessonSections": lesson_sections, "taughtConcepts": concepts},
    )


def _concept_title(concept: dict[str, Any], fallback: str) -> str:
    return str(concept.get("title") or concept.get("name") or fallback).strip() or fallback


def _make_quiz_question(
    *,
    index: int,
    question: str,
    options: list[str],
    concept_title: str,
    source_section_id: str | None = None,
) -> dict[str, Any]:
    return {
        "id": f"q{index + 1}",
        "question": question,
        "options": options,
        "answers": [0],
        "conceptIds": [concept_title],
        "sourceSectionId": source_section_id,
    }


def _quiz_question_for_concept(concept: dict[str, Any], *, index: int, module_title: str) -> dict[str, Any]:
    concept_title = _concept_title(concept, module_title)
    display_title = _concept_display_name(concept_title)
    source_section_id = str(concept.get("sourceSectionId") or "") or None
    definition = str(concept.get("description") or _concept_definition(concept_title))
    variant = index % 4
    if variant == 0:
        return _make_quiz_question(
            index=index,
            concept_title=display_title,
            source_section_id=source_section_id,
            question=f"A learner is analyzing a realistic case in {module_title}. What is the best first use of {display_title}?",
            options=[
                f"Define the relevant variables, connect them to evidence, and apply {display_title} to the case.",
                f"Use {display_title} as a label before checking what the case actually says.",
                "Choose a conclusion first and then look for details that agree with it.",
                "Skip assumptions because the topic name already gives the answer.",
            ],
        )
    if variant == 1:
        return _make_quiz_question(
            index=index,
            concept_title=display_title,
            source_section_id=source_section_id,
            question=f"Which response would make work with {display_title} most reliable?",
            options=[
                "State assumptions, use the section definition, and test the idea against an example.",
                "Treat the term as self-explanatory and avoid checking edge cases.",
                "Focus only on wording and ignore the situation being analyzed.",
                "Use the same answer even when the evidence changes.",
            ],
        )
    if variant == 2:
        return _make_quiz_question(
            index=index,
            concept_title=display_title,
            source_section_id=source_section_id,
            question=f"A result changes after one assumption in the case changes. What should the learner do with {display_title}?",
            options=[
                "Re-evaluate the conclusion and explain how the changed assumption affects the concept.",
                "Keep the original answer because assumptions do not affect analysis.",
                "Remove the concept from the explanation instead of updating the reasoning.",
                "Report both answers without explaining why they differ.",
            ],
        )
    return _make_quiz_question(
        index=index,
        concept_title=display_title,
        source_section_id=source_section_id,
        question=f"In {module_title}, which statement correctly applies {display_title}?",
        options=[
            definition,
            f"{display_title} can be used without checking definitions, evidence, or assumptions.",
            f"{display_title} only matters as a standalone vocabulary word.",
            f"{display_title} should be ignored when solving module problems.",
        ],
    )


def _quiz_bad_template_phrase_count(questions: list[dict[str, Any]]) -> int:
    count = 0
    for question in questions:
        text = " ".join(
            [
                str(question.get("question") or ""),
                *[str(option) for option in question.get("options", []) if isinstance(question.get("options"), list)],
            ]
        ).lower()
        if any(phrase in text for phrase in BAD_QUIZ_TEMPLATE_PHRASES):
            count += 1
    return count


def _target_concepts_from_assessment_plan(assessment_plan: dict[str, Any]) -> list[dict[str, Any]]:
    target_concepts = _items(assessment_plan.get("targetConcepts"))
    return target_concepts or _items(assessment_plan.get("taughtConcepts"))


def _target_concept_ids_from_assessment_plan(assessment_plan: dict[str, Any]) -> list[str]:
    plan_ids = _strings(assessment_plan.get("targetConceptIds"))
    if plan_ids:
        return _unique_strings([_stable_concept_id(concept_id) for concept_id in plan_ids])
    return _concept_ids(_target_concepts_from_assessment_plan(assessment_plan))


def _concept_ids_from_quiz_questions(questions: list[dict[str, Any]]) -> list[str]:
    values: list[str] = []
    for question in questions:
        values.extend(_strings(question.get("conceptIds")))
        concept_id = str(question.get("conceptId") or "").strip()
        if concept_id:
            values.append(concept_id)
    return _unique_strings([_stable_concept_id(value) for value in values])


def _concept_ids_from_project_blocks(project_blocks: list[dict[str, Any]]) -> list[str]:
    values: list[str] = []
    for block in project_blocks:
        values.extend(_strings(block.get("coveredConceptIds")))
        values.extend(_strings(block.get("conceptIds")))
        values.extend(_strings(block.get("targetConceptIds")))
    return _unique_strings([_stable_concept_id(value) for value in values])


def _coverage_ratio(covered_ids: list[str], target_ids: list[str]) -> float:
    if not target_ids:
        return 1.0
    covered = {_stable_concept_id(value) for value in covered_ids if str(value or "").strip()}
    target = {_stable_concept_id(value) for value in target_ids if str(value or "").strip()}
    if not target:
        return 1.0
    return round(len(covered & target) / len(target), 4)


def _compact_assessment_target_concepts(assessment_plan: dict[str, Any]) -> list[dict[str, Any]]:
    compact: list[dict[str, Any]] = []
    seen: set[str] = set()
    for concept in _target_concepts_from_assessment_plan(assessment_plan):
        title = _concept_title(concept, "concept")
        concept_id = _stable_concept_id(title)
        if concept_id in seen:
            continue
        seen.add(concept_id)
        row: dict[str, Any] = {"id": concept_id, "title": title}
        source_section_id = str(concept.get("sourceSectionId") or "").strip()
        if source_section_id:
            row["sourceSectionId"] = source_section_id
        compact.append(row)
    return compact


def _compact_assessment_spec(spec: Any) -> dict[str, Any] | None:
    if not isinstance(spec, dict):
        return None
    return {
        key: value
        for key, value in spec.items()
        if value is not None or key in {"timeLimitSeconds"}
    }


def _section_assessment_plan_metadata(
    assessment_plan: dict[str, Any],
    *,
    assessed_concept_ids: list[str],
    content_coverage_ratio: float,
    assessment_subworkflow_report: dict[str, Any] | None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "contractVersion": "module-apply-assessment-plan-v1",
        "assessmentKind": assessment_plan.get("assessmentKind"),
        "assessmentScale": assessment_plan.get("assessmentScale"),
        "coverageScope": assessment_plan.get("coverageScope"),
        "minimumContentCoverageRatio": _bounded_ratio(
            assessment_plan.get("minimumContentCoverageRatio"),
            DEFAULT_ASSESSMENT_MIN_CONTENT_COVERAGE_RATIO,
        ),
        "contentCoverageRatio": content_coverage_ratio,
        "targetSectionIds": _strings(assessment_plan.get("targetSectionIds")),
        "targetConceptIds": _target_concept_ids_from_assessment_plan(assessment_plan),
        "targetCoverageItemIds": _strings(assessment_plan.get("targetCoverageItemIds")),
        "targetConcepts": _compact_assessment_target_concepts(assessment_plan),
        "assessedConceptIds": _unique_strings([_stable_concept_id(value) for value in assessed_concept_ids]),
    }
    quiz_spec = _compact_assessment_spec(assessment_plan.get("quizSpec"))
    if quiz_spec is not None:
        metadata["quizSpec"] = quiz_spec
    project_spec = _compact_assessment_spec(assessment_plan.get("projectSpec"))
    if project_spec is not None:
        metadata["projectSpec"] = project_spec
    if assessment_subworkflow_report is not None:
        metadata["subWorkflow"] = {
            "contractVersion": assessment_subworkflow_report.get("contractVersion"),
            "stage": assessment_subworkflow_report.get("stage"),
            "status": assessment_subworkflow_report.get("status"),
        }
    return metadata


def _draft_module_quiz_section(*, module_id: str, module_title: str, concepts: list[dict[str, Any]], question_target: int) -> dict[str, Any]:
    question_concepts = concepts or [
        {
            "title": module_title,
            "description": f"Use the core ideas from {module_title} in context.",
            "sourceSectionId": "",
        }
    ]
    questions = [
        _quiz_question_for_concept(question_concepts[index % len(question_concepts)], index=index, module_title=module_title)
        for index in range(max(10, question_target))
    ]
    return {
        "id": f"{module_id}-apply",
        "title": f"Apply: {module_title}",
        "pageType": "apply",
        "sectionType": "assessment",
        "content": [{"type": "quiz", "questions": questions}],
    }


def run_module_quiz_assessment_workflow(module_outline: dict[str, Any], assessment_plan: dict[str, Any]) -> dict[str, Any]:
    module_id = str(assessment_plan.get("moduleId") or module_outline.get("id") or "module")
    module_title = str(assessment_plan.get("moduleTitle") or module_outline.get("title") or "Module")
    concepts = _target_concepts_from_assessment_plan(assessment_plan)
    quiz_spec = assessment_plan.get("quizSpec") if isinstance(assessment_plan.get("quizSpec"), dict) else {}
    question_target = int(quiz_spec.get("questionCount") or assessment_plan.get("questionTarget") or max(10, len(concepts)))
    section = _draft_module_quiz_section(
        module_id=module_id,
        module_title=module_title,
        concepts=concepts,
        question_target=question_target,
    )
    quiz_blocks = [block for block in _items(section.get("content")) if block.get("type") == "quiz"]
    questions = [question for block in quiz_blocks for question in _quiz_questions(block)]
    valid_question_count = _valid_quiz_question_count(questions)
    bad_phrase_count = _quiz_bad_template_phrase_count(questions)
    target_concept_ids = _target_concept_ids_from_assessment_plan(assessment_plan)
    assessed_concept_ids = _concept_ids_from_quiz_questions(questions)
    content_coverage_ratio = _coverage_ratio(assessed_concept_ids, target_concept_ids)
    minimum_coverage_ratio = _bounded_ratio(
        assessment_plan.get("minimumContentCoverageRatio"),
        DEFAULT_ASSESSMENT_MIN_CONTENT_COVERAGE_RATIO,
    )
    issues: list[dict[str, Any]] = []
    if len(questions) < 10:
        issues.append(_issue("error", "Quiz generation produced fewer than 10 questions.", "content[].questions"))
    if valid_question_count != len(questions):
        issues.append(_issue("error", "Quiz generation produced invalid question payloads.", "content[].questions"))
    if bad_phrase_count:
        issues.append(_issue("error", "Quiz generation reused generic mastery-template wording.", "content[].questions"))
    if content_coverage_ratio < minimum_coverage_ratio:
        issues.append(_issue("error", "Quiz generation did not cover enough target content.", "assessmentPlan.minimumContentCoverageRatio"))
    return _workflow_result(
        stage="module_quiz_assessment_generation",
        contract_version=MODULE_QUIZ_ASSESSMENT_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "questionTarget": question_target,
            "questionCount": len(questions),
            "validQuestionCount": valid_question_count,
            "badTemplatePhraseCount": bad_phrase_count,
            "taughtConceptCount": len(concepts),
            "targetConceptCount": len(target_concept_ids),
            "assessedConceptCount": len(set(assessed_concept_ids) & set(target_concept_ids)),
            "contentCoverageRatio": content_coverage_ratio,
            "minimumContentCoverageRatio": minimum_coverage_ratio,
            "coverageScope": assessment_plan.get("coverageScope"),
        },
        artifacts={"section": section, "assessmentPlan": assessment_plan},
    )


def run_module_project_assessment_workflow(module_outline: dict[str, Any], assessment_plan: dict[str, Any]) -> dict[str, Any]:
    module_id = str(assessment_plan.get("moduleId") or module_outline.get("id") or "module")
    module_title = str(assessment_plan.get("moduleTitle") or module_outline.get("title") or "Module")
    concepts = _target_concepts_from_assessment_plan(assessment_plan)
    concept_titles = [_concept_title(concept, module_title) for concept in concepts[:6]]
    target_concept_ids = _target_concept_ids_from_assessment_plan(assessment_plan)
    project_spec = assessment_plan.get("projectSpec") if isinstance(assessment_plan.get("projectSpec"), dict) else {}
    submission_type = str(project_spec.get("submissionType") or "text").strip() or "text"
    focus = ", ".join(concept_titles) or module_title
    project_block = {
        "type": "project",
        "title": f"{module_title} applied project",
        "coveredConceptIds": target_concept_ids,
        "coverageScope": assessment_plan.get("coverageScope"),
        "instructions": (
            f"Create a short applied artifact that uses {focus}. State the problem, show the method, "
            "include the worked evidence or calculation, and explain what the result means."
        ),
        "artifactType": "written-response",
        "requiredEvidence": [
            "Problem statement or scenario",
            "Method, calculation, model, or design choice",
            "Result with interpretation",
            "Brief reflection on assumptions or limitations",
        ],
        "submission": {"submissionType": submission_type, "submissionMethods": [submission_type]},
        "rubric": {
            "title": f"{module_title} project rubric",
            "criteria": [
                {"id": "concept-use", "title": "Concept use", "description": "Uses the module concepts correctly.", "points": 4},
                {"id": "evidence", "title": "Evidence", "description": "Shows calculations, observations, or decisions that support the result.", "points": 4},
                {"id": "interpretation", "title": "Interpretation", "description": "Explains what the result means and names assumptions.", "points": 2},
            ],
        },
        "graderWorkflow": {
            "grader": "agent",
            "status": "ready",
            "allowedContext": ["course", "module", "filled_lesson_sections"],
            "feedbackPolicy": "Return criterion-level feedback and one next step.",
        },
    }
    section = {
        "id": f"{module_id}-apply",
        "title": f"Apply: {module_title}",
        "pageType": "apply",
        "sectionType": "project",
        "content": [project_block],
    }
    issues: list[dict[str, Any]] = []
    project_coverage_ratio = _coverage_ratio(_strings(project_block.get("coveredConceptIds")), target_concept_ids)
    minimum_coverage_ratio = _bounded_ratio(
        assessment_plan.get("minimumContentCoverageRatio"),
        DEFAULT_ASSESSMENT_MIN_CONTENT_COVERAGE_RATIO,
    )
    if not concepts:
        issues.append(_issue("error", "Project generation needs taught concepts from filled lessons.", "assessmentPlan.taughtConcepts"))
    if not project_block["requiredEvidence"]:
        issues.append(_issue("error", "Project generation must name required evidence.", "content[].requiredEvidence"))
    if project_coverage_ratio < minimum_coverage_ratio:
        issues.append(_issue("error", "Project generation did not cover enough target content.", "assessmentPlan.minimumContentCoverageRatio"))
    return _workflow_result(
        stage="module_project_assessment_generation",
        contract_version=MODULE_PROJECT_ASSESSMENT_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "projectBlockCount": 1,
            "requiredEvidenceCount": len(project_block["requiredEvidence"]),
            "rubricCriterionCount": len(project_block["rubric"]["criteria"]),
            "taughtConceptCount": len(concepts),
            "targetConceptCount": len(target_concept_ids),
            "coveredConceptCount": len(target_concept_ids),
            "contentCoverageRatio": project_coverage_ratio,
            "minimumContentCoverageRatio": minimum_coverage_ratio,
            "coverageScope": assessment_plan.get("coverageScope"),
        },
        artifacts={"section": section, "assessmentPlan": assessment_plan},
    )


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
    total_module_count: int | None = None,
    coverage_lesson_sections: list[dict[str, Any]] | None = None,
    fallback_source_ids: list[str] | None = None,
    generated_section: dict[str, Any] | None = None,
) -> dict[str, Any]:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    lesson_sections = [
        section
        for section in filled_lesson_sections
        if isinstance(section, dict)
        and str(section.get("pageType") or "learn") == "learn"
        and str(section.get("sectionType") or "lesson").lower() not in {"summary", "assessment"}
    ]
    concepts = _concept_cards_from_sections(lesson_sections)
    assessment_plan_report = run_module_assessment_plan_workflow(
        module_outline,
        lesson_sections,
        module_number=module_number,
        total_module_count=total_module_count,
        coverage_lesson_sections=coverage_lesson_sections,
    )
    assessment_plan = (
        assessment_plan_report.get("artifacts", {}).get("assessmentPlan")
        if isinstance(assessment_plan_report.get("artifacts"), dict)
        else None
    )
    assessment_plan = assessment_plan if isinstance(assessment_plan, dict) else {}
    assessment_subworkflow_report: dict[str, Any] | None = None
    raw_section = (
        generated_section
        if isinstance(generated_section, dict)
        else None
    )
    if raw_section is None:
        if assessment_plan.get("assessmentKind") == "project":
            assessment_subworkflow_report = run_module_project_assessment_workflow(module_outline, assessment_plan)
        else:
            assessment_subworkflow_report = run_module_quiz_assessment_workflow(module_outline, assessment_plan)
        raw_section = (
            assessment_subworkflow_report.get("artifacts", {}).get("section")
            if isinstance(assessment_subworkflow_report.get("artifacts"), dict)
            else None
        )
    if not isinstance(raw_section, dict):
        raw_section = {
            "id": f"{module_id}-apply",
            "title": f"Apply: {module_title}",
            "pageType": "apply",
            "sectionType": "assessment",
            "content": [],
        }
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
    quiz_questions = [question for block in quiz_blocks for question in _quiz_questions(block)]
    bad_template_phrase_count = _quiz_bad_template_phrase_count(quiz_questions)
    target_concept_ids = _target_concept_ids_from_assessment_plan(assessment_plan)
    quiz_assessed_concept_ids = _concept_ids_from_quiz_questions(quiz_questions)
    project_assessed_concept_ids = _concept_ids_from_project_blocks(project_blocks)
    assessed_concept_ids = _unique_strings([*quiz_assessed_concept_ids, *project_assessed_concept_ids])
    content_coverage_ratio = _coverage_ratio(assessed_concept_ids, target_concept_ids)
    minimum_coverage_ratio = _bounded_ratio(
        assessment_plan.get("minimumContentCoverageRatio"),
        DEFAULT_ASSESSMENT_MIN_CONTENT_COVERAGE_RATIO,
    )

    issues: list[dict[str, Any]] = []
    if not lesson_sections:
        issues.append(_issue("error", "Apply generation needs filled lesson sections before assessment can be created.", "filledLessonSections"))
    if not concepts:
        issues.append(_issue("error", "Apply generation needs taught concept cards from filled lesson sections.", "filledLessonSections[].content"))
    if assessment_plan_report.get("status") == "failed":
        issues.append(_issue("error", "Apply generation assessment planning failed.", "assessmentPlan"))
    if assessment_subworkflow_report is not None and assessment_subworkflow_report.get("status") == "failed":
        issues.append(_issue("error", "Apply generation routed sub-workflow failed.", "assessmentSubWorkflow"))
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
    if quiz_blocks and bad_template_phrase_count:
        issues.append(_issue("error", "Quiz Apply sections must ask realistic assessment questions, not generic mastery-template questions.", "content[].questions"))
    if (quiz_blocks or project_blocks) and content_coverage_ratio < minimum_coverage_ratio:
        issues.append(_issue("error", "Apply generation does not cover enough target content.", "assessmentPlan.minimumContentCoverageRatio"))

    section_metadata = section.get("metadata") if isinstance(section.get("metadata"), dict) else {}
    section = {
        **section,
        "metadata": {
            **section_metadata,
            "assessmentPlan": _section_assessment_plan_metadata(
                assessment_plan,
                assessed_concept_ids=assessed_concept_ids,
                content_coverage_ratio=content_coverage_ratio,
                assessment_subworkflow_report=assessment_subworkflow_report,
            ),
        },
    }
    section = _strip_source_id_refs(section)

    return _workflow_result(
        stage="module_apply_section_generation",
        contract_version=MODULE_APPLY_SECTION_CONTRACT,
        status=_status_from_issues(issues),
        issues=issues,
        metrics={
            "lessonSectionCount": len(lesson_sections),
            "taughtConceptCount": len(taught_concepts),
            "targetConceptCount": len(target_concept_ids),
            "assessedConceptCount": len(set(assessed_concept_ids) & set(target_concept_ids)),
            "contentCoverageRatio": content_coverage_ratio,
            "minimumContentCoverageRatio": minimum_coverage_ratio,
            "coverageScope": assessment_plan.get("coverageScope"),
            "contentBlockCount": len(content_blocks),
            "quizBlockCount": len(quiz_blocks),
            "projectBlockCount": len(project_blocks),
            "questionCount": question_count,
            "validQuestionCount": valid_question_count,
            "badTemplatePhraseCount": bad_template_phrase_count,
            "sourceIdCount": len(_source_ids_from_value(section)),
            "generatedFromFilledLessons": not isinstance(generated_section, dict),
            "assessmentKind": assessment_plan.get("assessmentKind"),
            "assessmentScale": assessment_plan.get("assessmentScale"),
            "assessmentPlanStatus": assessment_plan_report.get("status"),
            "assessmentSubWorkflowStatus": assessment_subworkflow_report.get("status") if assessment_subworkflow_report else None,
        },
        artifacts={
            "section": section,
            "filledLessonSections": lesson_sections,
            "taughtConcepts": concepts,
            "assessmentPlan": assessment_plan,
            "assessmentPlanReport": assessment_plan_report,
            "assessmentSubWorkflowReport": assessment_subworkflow_report,
        },
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
    "COURSE_TEMPLATE_ARTIFACT_CONTRACT",
    "COURSE_TEMPLATE_CONTRACT",
    "COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT",
    "COURSE_WRAPPER_GENERATION_CONTRACT",
    "COURSE_WRAPPER_QUALITY_REPORT_CONTRACT",
    "MODULE_ASSESSMENT_PLAN_CONTRACT",
    "MODULE_APPLY_SECTION_CONTRACT",
    "MODULE_ASSEMBLY_CONTRACT",
    "MODULE_PROJECT_ASSESSMENT_CONTRACT",
    "MODULE_QUIZ_ASSESSMENT_CONTRACT",
    "MODULE_SECTION_PLAN_CONTRACT",
    "MODULE_SUMMARY_SECTION_CONTRACT",
    "PROGRAM_BRIEF_CONTRACT",
    "PROGRAM_GENERATION_CONTRACT",
    "REQUIREMENT_GROUP_PLAN_CONTRACT",
    "SECTION_FILL_CONTRACT",
    "SOURCE_PACKET_OUTLINE_CONTRACT_VERSION",
    "STAGE_WORKFLOW_VERSION",
    "assessment_coverage_scope_for_module",
    "compact_module_apply_workflow_reports",
    "compact_stage_workflow_report",
    "run_cluster_generation_workflow",
    "run_course_module_outline_workflow",
    "run_course_template_workflow",
    "run_course_wrapper_generation_workflow",
    "run_module_assessment_plan_workflow",
    "run_module_apply_section_workflow",
    "run_module_assembly_workflow",
    "run_module_project_assessment_workflow",
    "run_module_quiz_assessment_workflow",
    "run_module_section_plan_workflow",
    "run_module_summary_section_workflow",
    "run_program_brief_workflow",
    "run_program_generation_workflow",
    "run_requirement_group_plan_workflow",
    "run_section_fill_workflow",
]
