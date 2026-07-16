from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.course_build_tasks import transition_course_build_task_in_structure_from_quality_report
from app.course_generation_workflow import run_course_generation_workflow
from app.course_quality_evals import run_course_quality_evals
from app.course_structure import concept_items as _concept_items
from app.course_structure import is_concept_block as _is_concept_block


COURSE_CONTRACT_VERSION = "0.1.0"
MINIMUM_PUBLISH_SCORE = 0.85


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _source_record_count(course: dict[str, Any]) -> int:
    source_records = course.get("sourceRecords")
    if isinstance(source_records, list):
        return len(source_records)
    if isinstance(source_records, dict):
        return len(source_records)
    return 0


def _iter_sections(course: dict[str, Any]):
    for module in course.get("modules", []):
        if not isinstance(module, dict):
            continue
        for section in module.get("sections", []):
            if isinstance(section, dict):
                yield section


def _concept_count(course: dict[str, Any]) -> int:
    count = 0
    for section in _iter_sections(course):
        for block in section.get("content", []):
            if isinstance(block, dict) and _is_concept_block(block):
                count += len(_concept_items(block))
    return count


def assess_course_quality(course: dict[str, Any], *, gate: str = "publish") -> dict[str, Any]:
    workflow_report = run_course_generation_workflow(course)
    workflow = workflow_report.model_dump(mode="json")
    eval_report = run_course_quality_evals(course)
    errors = [
        f"{gate_result['gate']}: {issue['message']}"
        for gate_result in workflow["gates"]
        for issue in gate_result["issues"]
        if issue["severity"] == "error"
    ]
    errors.extend(
        f"{dimension['label']}: {finding['message']}"
        for dimension in eval_report["dimensions"]
        for finding in dimension["findings"]
        if finding["severity"] == "error"
    )
    warnings: list[str] = []
    sections = list(_iter_sections(course))
    modules = [module for module in course.get("modules", []) if isinstance(module, dict)]
    learn_sections = [section for section in sections if section.get("pageType") == "learn"]
    apply_sections = [section for section in sections if section.get("pageType") == "apply"]
    quiz_sections = [
        section
        for section in sections
        if any(isinstance(block, dict) and block.get("type") == "quiz" for block in section.get("content", []))
    ]
    source_record_count = _source_record_count(course)

    if not quiz_sections:
        warnings.append("Course does not include a quiz assessment section.")
    if source_record_count < 2:
        warnings.append("Course has fewer than two source records; source diversity may be weak.")
    if len(modules) < 2:
        warnings.append("Course has fewer than two modules; confirm that the scope is intentionally compact.")
    warnings.extend(
        f"{gate_result['gate']}: {issue['message']}"
        for gate_result in workflow["gates"]
        for issue in gate_result["issues"]
        if issue["severity"] == "warning"
    )
    warnings.extend(
        f"{dimension['label']}: {finding['message']}"
        for dimension in eval_report["dimensions"]
        for finding in dimension["findings"]
        if finding["severity"] == "warning"
    )

    metrics = {
        "moduleCount": len(modules),
        "sectionCount": len(sections),
        "learnSectionCount": len(learn_sections),
        "applySectionCount": len(apply_sections),
        "quizSectionCount": len(quiz_sections),
        "conceptCount": _concept_count(course),
        "sourceRecordCount": source_record_count,
        "workflowGateCount": workflow_report.metrics["gateCount"],
        "workflowNeedsReviewGateCount": workflow_report.metrics["needsReviewGateCount"],
        "workflowFailedGateCount": workflow_report.metrics["failedGateCount"],
        "qualityEvalScore": eval_report["overallScore"],
        "qualityEvalFailedDimensionCount": eval_report["metrics"]["failedDimensionCount"],
        "qualityEvalNeedsReviewDimensionCount": eval_report["metrics"]["needsReviewDimensionCount"],
    }
    score = 1.0
    score -= min(0.72, len(errors) * 0.18)
    score -= min(0.1, len(warnings) * 0.015)
    score = round(max(0.0, min(1.0, score, eval_report["overallScore"])), 2)
    passed = not errors and eval_report["status"] != "failed" and score >= MINIMUM_PUBLISH_SCORE

    return {
        "gate": gate,
        "passed": passed,
        "score": score,
        "errors": errors,
        "warnings": warnings,
        "metrics": metrics,
        "evals": eval_report,
        "workflow": workflow,
        "checkedAt": _now(),
        "contractVersion": COURSE_CONTRACT_VERSION,
    }


def apply_course_quality_gate(course_snapshot: Any, *, gate: str = "review") -> dict[str, Any]:
    report = assess_course_quality(course_snapshot.structure, gate=gate)
    if isinstance(course_snapshot.structure, dict):
        course_snapshot.structure = transition_course_build_task_in_structure_from_quality_report(
            course_snapshot.structure,
            quality_report=report,
        )
    trace = dict(course_snapshot.generation_trace or {})
    trace["quality_report"] = report
    course_snapshot.generation_trace = trace

    if report["passed"]:
        course_snapshot.status = "published" if gate == "publish" else "ready_for_review"
    else:
        course_snapshot.status = "needs_revision"

    return report
