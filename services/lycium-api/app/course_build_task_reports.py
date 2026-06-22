from __future__ import annotations

from typing import Any

def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _values(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


COURSE_BUILD_STAGE_ORDER = [
    "source_gathering",
    "outline_ready",
    "section_generation_ready",
    "ready_for_review",
]


def _count_by_key(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = str(row.get(key) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


def _stage_index(stage: str) -> int:
    try:
        return COURSE_BUILD_STAGE_ORDER.index(stage)
    except ValueError:
        return -1


def build_source_packet_transition_report(
    *,
    task: dict[str, Any] | None,
    source_packet: dict[str, Any] | None,
    minimum_concept_coverage_ratio: float,
) -> dict[str, Any]:
    packet = source_packet if isinstance(source_packet, dict) else {}
    quality = packet.get("quality") if isinstance(packet.get("quality"), dict) else {}
    if not quality:
        synthesis = packet.get("synthesis") if isinstance(packet.get("synthesis"), dict) else {}
        synthesis_packet = synthesis.get("sourcePacket") if isinstance(synthesis.get("sourcePacket"), dict) else {}
        quality = synthesis_packet.get("quality") if isinstance(synthesis_packet.get("quality"), dict) else {}
    if not quality:
        nested_packet = packet.get("sourcePacket") if isinstance(packet.get("sourcePacket"), dict) else {}
        quality = nested_packet.get("quality") if isinstance(nested_packet.get("quality"), dict) else {}

    contract_version = str(packet.get("contract_version") or packet.get("contractVersion") or "")
    try:
        concept_coverage_ratio = float(quality.get("conceptCoverageRatio") or 0)
    except (TypeError, ValueError):
        concept_coverage_ratio = 0.0
    uncovered = [
        str(value)
        for value in _values(quality.get("uncoveredConceptCandidates"))
        if str(value).strip()
    ]
    quality_status = str(quality.get("status") or "").lower()
    current_task = task if isinstance(task, dict) else {}
    current_stage = str(current_task.get("currentStage") or current_task.get("status") or "source_gathering")
    reasons: list[str] = []
    if contract_version != "source-packet-v1":
        reasons.append("source_packet_contract_missing")
    if quality_status != "usable":
        reasons.append("source_packet_not_usable")
    if concept_coverage_ratio < minimum_concept_coverage_ratio:
        reasons.append("concept_coverage_below_policy")
    if uncovered:
        reasons.append("uncovered_concepts_remaining")
    if current_stage != "source_gathering":
        reasons.append("task_not_in_source_gathering")
    passed = not reasons
    return {
        "contractVersion": "source-packet-transition-report-v1",
        "status": "outline_ready" if passed else "blocked",
        "passed": passed,
        "currentStage": current_stage,
        "nextStage": "outline_ready" if passed else current_stage,
        "nextAction": "generate_course_outline" if passed else "attach_source_packet",
        "reasons": reasons,
        "metrics": {
            "sourcePacketContractVersion": contract_version,
            "qualityStatus": quality.get("status"),
            "conceptCoverageRatio": concept_coverage_ratio,
            "minimumConceptCoverageRatio": minimum_concept_coverage_ratio,
            "uncoveredConceptCount": len(uncovered),
        },
        "uncoveredConceptCandidates": uncovered,
    }


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def build_outline_transition_report(
    *,
    task: dict[str, Any] | None,
    outline: dict[str, Any] | None,
    minimum_module_count: int,
    minimum_sections_per_module: int,
) -> dict[str, Any]:
    current_task = task if isinstance(task, dict) else {}
    current_stage = str(current_task.get("currentStage") or current_task.get("status") or "outline_ready")
    outline_row = outline if isinstance(outline, dict) else {}
    modules = _items(outline_row.get("modules"))
    reasons: list[str] = []
    section_count = 0
    objective_section_count = 0
    concept_section_count = 0
    titled_module_count = 0
    titled_section_count = 0

    if current_stage != "outline_ready":
        reasons.append("task_not_in_outline_ready")
    if len(modules) < minimum_module_count:
        reasons.append("module_count_below_policy")

    for module in modules:
        if _clean_text(module.get("title")):
            titled_module_count += 1
        else:
            reasons.append("module_title_missing")
        sections = _items(module.get("sections"))
        section_count += len(sections)
        if len(sections) < minimum_sections_per_module:
            reasons.append("section_count_below_policy")
        for section in sections:
            if _clean_text(section.get("title")):
                titled_section_count += 1
            else:
                reasons.append("section_title_missing")
            objectives = section.get("learning_objectives") or section.get("learningObjectives")
            if isinstance(objectives, list) and any(_clean_text(objective) for objective in objectives):
                objective_section_count += 1
            else:
                reasons.append("section_objectives_missing")
            concepts = section.get("concept_keywords") or section.get("conceptKeywords") or section.get("concepts")
            if isinstance(concepts, list) and any(_clean_text(concept) for concept in concepts):
                concept_section_count += 1
            else:
                reasons.append("section_concepts_missing")

    reasons = sorted(set(reasons))
    passed = not reasons
    return {
        "contractVersion": "outline-transition-report-v1",
        "status": "section_generation_ready" if passed else "blocked",
        "passed": passed,
        "currentStage": current_stage,
        "nextStage": "section_generation_ready" if passed else current_stage,
        "nextAction": "generate_course_sections" if passed else "revise_course_outline",
        "reasons": reasons,
        "metrics": {
            "moduleCount": len(modules),
            "sectionCount": section_count,
            "titledModuleCount": titled_module_count,
            "titledSectionCount": titled_section_count,
            "objectiveSectionCount": objective_section_count,
            "conceptSectionCount": concept_section_count,
            "minimumModuleCount": minimum_module_count,
            "minimumSectionsPerModule": minimum_sections_per_module,
        },
    }


def _quality_gate_failures(quality_report: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    gates = quality_report.get("gates")
    if isinstance(gates, list):
        for gate in gates:
            if isinstance(gate, dict) and str(gate.get("status") or "").lower() == "failed":
                failures.append(str(gate.get("gate") or gate.get("name") or "unnamed_gate"))
    workflow = quality_report.get("workflow")
    workflow_gates = workflow.get("gates") if isinstance(workflow, dict) else None
    if isinstance(workflow_gates, list):
        for gate in workflow_gates:
            if isinstance(gate, dict) and str(gate.get("status") or "").lower() == "failed":
                failures.append(str(gate.get("gate") or gate.get("name") or "unnamed_workflow_gate"))
    return sorted(set(failure for failure in failures if failure))


def _quality_eval_failures(quality_report: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    evals = quality_report.get("evals")
    dimensions = evals.get("dimensions") if isinstance(evals, dict) else None
    if isinstance(dimensions, list):
        for dimension in dimensions:
            if isinstance(dimension, dict) and str(dimension.get("status") or "").lower() == "failed":
                failures.append(str(dimension.get("key") or dimension.get("name") or "unnamed_eval_dimension"))
    return sorted(set(failure for failure in failures if failure))


def build_review_transition_report(
    *,
    task: dict[str, Any] | None,
    quality_report: dict[str, Any] | None,
) -> dict[str, Any]:
    current_task = task if isinstance(task, dict) else {}
    report = quality_report if isinstance(quality_report, dict) else {}
    current_stage = str(current_task.get("currentStage") or current_task.get("status") or "section_generation_ready")
    errors = [str(error) for error in _values(report.get("errors")) if str(error).strip()]
    warnings = [str(warning) for warning in _values(report.get("warnings")) if str(warning).strip()]
    failed_gates = _quality_gate_failures(report)
    failed_evals = _quality_eval_failures(report)
    quality_passed = report.get("passed") is True or str(report.get("status") or "").lower() == "passed"
    reasons: list[str] = []
    if current_stage != "section_generation_ready":
        reasons.append("task_not_in_section_generation_ready")
    if not quality_passed:
        reasons.append("quality_report_not_passed")
    if errors:
        reasons.append("quality_errors_present")
    if failed_gates:
        reasons.append("quality_gates_failed")
    if failed_evals:
        reasons.append("quality_evals_failed")
    reasons = sorted(set(reasons))
    passed = not reasons
    return {
        "contractVersion": "review-transition-report-v1",
        "status": "ready_for_review" if passed else "blocked",
        "passed": passed,
        "currentStage": current_stage,
        "nextStage": "ready_for_review" if passed else current_stage,
        "nextAction": "review_and_publish" if passed else "repair_generated_sections",
        "reasons": reasons,
        "failedGates": failed_gates,
        "failedEvalDimensions": failed_evals,
        "errors": errors[:10],
        "warnings": warnings[:10],
        "metrics": {
            "qualityPassed": quality_passed,
            "score": report.get("score") or report.get("overallScore"),
            "errorCount": len(errors),
            "warningCount": len(warnings),
            "failedGateCount": len(failed_gates),
            "failedEvalCount": len(failed_evals),
        },
    }


def _task_from_row(row: dict[str, Any]) -> dict[str, Any]:
    task = row.get("courseBuildTask")
    return task if isinstance(task, dict) else row


def summarize_course_build_task(row: dict[str, Any]) -> dict[str, Any]:
    task = _task_from_row(row)
    stage = str(task.get("currentStage") or task.get("status") or "unknown")
    stage_index = _stage_index(stage)
    stage_count = len(COURSE_BUILD_STAGE_ORDER)
    required_inputs = [str(value) for value in _values(task.get("requiredInputs")) if str(value).strip()]
    prerequisite_course_ids = [
        str(value)
        for value in _values(task.get("prerequisiteCourseIds") or row.get("prerequisiteCourseIds"))
        if str(value).strip()
    ]
    return {
        "contractVersion": "course-build-task-summary-v1",
        "courseId": str(task.get("courseId") or row.get("courseId") or ""),
        "title": str(task.get("title") or row.get("title") or ""),
        "status": str(task.get("status") or "unknown"),
        "currentStage": stage,
        "nextAction": str(task.get("nextAction") or ""),
        "transitionStatus": task.get("transitionStatus"),
        "transitionReason": task.get("transitionReason"),
        "requiredInputs": required_inputs,
        "prerequisiteCourseIds": prerequisite_course_ids,
        "stageIndex": stage_index,
        "stageCount": stage_count,
        "progressRatio": round((stage_index + 1) / stage_count, 4) if stage_index >= 0 and stage_count else 0.0,
        "blocked": str(task.get("transitionStatus") or "").lower() == "blocked",
    }


def build_course_build_task_report(course_rows: list[dict[str, Any]]) -> dict[str, Any]:
    courses = _items(course_rows)
    task_rows = [row for row in courses if isinstance(row.get("courseBuildTask"), dict)]
    summaries = [summarize_course_build_task(row) for row in task_rows]
    missing_task_course_ids = [
        str(row.get("courseId") or row.get("title") or "")
        for row in courses
        if not isinstance(row.get("courseBuildTask"), dict)
    ]
    source_packet_course_ids = [
        summary["courseId"]
        for summary in summaries
        if "source_packet" in summary["requiredInputs"]
    ]
    ready_count = sum(1 for summary in summaries if summary["currentStage"] == "ready_for_review")
    linked_count = sum(1 for summary in summaries if summary["status"] == "linked_existing_course")
    blocked_count = sum(1 for summary in summaries if summary["blocked"])
    if missing_task_course_ids:
        status = "invalid"
    elif source_packet_course_ids:
        status = "needs_sources"
    elif blocked_count:
        status = "blocked"
    elif ready_count + linked_count == len(courses) and courses:
        status = "ready_for_review"
    else:
        status = "in_progress"

    return {
        "contractVersion": "course-build-task-report-v1",
        "status": status,
        "courseCount": len(courses),
        "courseBuildTaskCount": len(task_rows),
        "missingCourseBuildTaskCount": len(missing_task_course_ids),
        "missingTaskCourseIds": [course_id for course_id in missing_task_course_ids if course_id],
        "sourcePacketRequiredCount": len(source_packet_course_ids),
        "sourcePacketRequiredCourseIds": [course_id for course_id in source_packet_course_ids if course_id],
        "blockedTaskCount": blocked_count,
        "readyForReviewTaskCount": ready_count,
        "linkedExistingCourseCount": linked_count,
        "statusCounts": _count_by_key(summaries, "status"),
        "stageCounts": _count_by_key(summaries, "currentStage"),
        "nextActionCounts": _count_by_key(summaries, "nextAction"),
        "actionCounts": _count_by_key(courses, "action"),
        "stageOrder": COURSE_BUILD_STAGE_ORDER,
    }


def _readiness_bucket(summary: dict[str, Any]) -> str:
    if summary["status"] == "linked_existing_course":
        return "linked_existing"
    if summary["blocked"]:
        return "blocked"
    stage = summary["currentStage"]
    if stage == "source_gathering":
        return "needs_sources" if "source_packet" in summary["requiredInputs"] else "source_gathering"
    if stage in {"outline_ready", "section_generation_ready", "ready_for_review"}:
        return stage
    return "unknown"


def _active_generation_status(course: dict[str, Any]) -> str:
    plan = course.get("activeGenerationPlan")
    if not isinstance(plan, dict):
        return "not_applicable"
    return str(plan.get("status") or "unknown")


def build_program_course_shell_readiness_report(
    *,
    clusters: list[dict[str, Any]],
    courses: list[dict[str, Any]],
) -> dict[str, Any]:
    cluster_rows = _items(clusters)
    course_rows = _items(courses)
    summaries = [
        {
            **summarize_course_build_task(course),
            "clusterId": str(course.get("clusterId") or ""),
            "requirementId": str(course.get("requirementId") or ""),
            "action": str(course.get("action") or ""),
        }
        for course in course_rows
        if isinstance(course.get("courseBuildTask"), dict)
    ]
    missing_task_course_ids = [
        str(course.get("courseId") or course.get("title") or "")
        for course in course_rows
        if not isinstance(course.get("courseBuildTask"), dict)
    ]
    buckets: dict[str, list[str]] = {
        "needs_sources": [],
        "source_gathering": [],
        "outline_ready": [],
        "section_generation_ready": [],
        "ready_for_review": [],
        "linked_existing": [],
        "blocked": [],
        "unknown": [],
    }
    for summary in summaries:
        bucket = _readiness_bucket(summary)
        buckets.setdefault(bucket, []).append(summary["courseId"])
    active_generation_counts = _count_by_key(
        [{"status": _active_generation_status(course)} for course in course_rows],
        "status",
    )

    cluster_summaries: list[dict[str, Any]] = []
    for cluster in cluster_rows:
        cluster_id = str(cluster.get("clusterId") or cluster.get("id") or "")
        cluster_courses = [summary for summary in summaries if summary["clusterId"] == cluster_id]
        cluster_buckets: dict[str, list[str]] = {key: [] for key in buckets}
        for summary in cluster_courses:
            cluster_buckets[_readiness_bucket(summary)].append(summary["courseId"])
        cluster_summaries.append(
            {
                "clusterId": cluster_id,
                "title": str(cluster.get("title") or cluster_id),
                "courseCount": len(cluster_courses),
                "readinessCounts": {key: len(value) for key, value in cluster_buckets.items() if value},
                "nextActionCounts": _count_by_key(cluster_courses, "nextAction"),
            }
        )

    if missing_task_course_ids:
        status = "invalid"
    elif buckets["blocked"]:
        status = "blocked"
    elif buckets["needs_sources"] or buckets["source_gathering"]:
        status = "needs_sources"
    elif buckets["outline_ready"]:
        status = "outline_ready"
    elif buckets["section_generation_ready"]:
        status = "section_generation_ready"
    elif course_rows and len(buckets["ready_for_review"]) + len(buckets["linked_existing"]) == len(course_rows):
        status = "ready_for_review"
    else:
        status = "in_progress"

    return {
        "contractVersion": "program-course-shell-readiness-report-v1",
        "status": status,
        "clusterCount": len(cluster_rows),
        "courseCount": len(course_rows),
        "trackedCourseCount": len(summaries),
        "missingCourseBuildTaskCount": len(missing_task_course_ids),
        "missingTaskCourseIds": [course_id for course_id in missing_task_course_ids if course_id],
        "readinessCounts": {key: len(value) for key, value in buckets.items() if value},
        "readinessCourseIds": {key: value for key, value in buckets.items() if value},
        "activeGenerationCounts": active_generation_counts,
        "clusterSummaries": cluster_summaries,
    }
