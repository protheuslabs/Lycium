from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.course_agent_contract import validate_course_contract
from app.course_generation_gates import COURSE_GENERATION_GATE_NAMES
from app.course_taxonomy import validate_course_taxonomy
from app.course_quality_evals import run_course_quality_evals
from app.course_structure import (
    content_blocks as _content,
    is_concept_cards_block as _is_concept_cards_block,
    is_quiz_block as _is_quiz_block,
    is_summary_section as _is_summary_section,
    is_video_block as _is_video_block,
    modules as _modules,
    question_count as _question_count,
    section_text as _section_text,
    sections as _sections,
    source_ids as _source_ids,
    source_record_count as _source_record_count,
)


WORKFLOW_VERSION = "course-generation-workflow-v1"

GateStatus = Literal["passed", "needs_review", "failed"]
IssueSeverity = Literal["warning", "error"]


class GateIssue(BaseModel):
    severity: IssueSeverity
    message: str
    location: str | None = None


class GateResult(BaseModel):
    gate: str
    status: GateStatus
    summary: str
    artifacts: dict[str, Any] = Field(default_factory=dict)
    issues: list[GateIssue] = Field(default_factory=list)


class CourseGenerationWorkflowReport(BaseModel):
    workflowVersion: str = WORKFLOW_VERSION
    status: GateStatus
    checkedAt: str
    gates: list[GateResult]
    metrics: dict[str, int | float] = Field(default_factory=dict)


PLACEHOLDER_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bthe model should\b",
        r"\bthe agent should\b",
        r"\bwrite (?:a|the) lesson\b",
        r"\bgenerate (?:instructional )?content\b",
        r"\bcontent goes here\b",
        r"\btodo\b",
        r"\bplaceholder\b",
        r"\blearners (?:define|study|will learn)\b",
        r"\bstudents should connect\b",
        r"\bthis lesson supports the module objective\b",
    ]
]


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _status(issues: list[GateIssue]) -> GateStatus:
    if any(issue.severity == "error" for issue in issues):
        return "failed"
    return "needs_review" if issues else "passed"


def _gate(gate: str, summary: str, issues: list[GateIssue] | None = None, artifacts: dict[str, Any] | None = None) -> GateResult:
    issue_list = issues or []
    return GateResult(
        gate=gate,
        status=_status(issue_list),
        summary=summary,
        artifacts=artifacts or {},
        issues=issue_list,
    )


def _issue(severity: IssueSeverity, message: str, location: str | None = None) -> GateIssue:
    return GateIssue(severity=severity, message=message, location=location)


def _gate_intake(course: dict[str, Any]) -> GateResult:
    issues: list[GateIssue] = []
    if not str(course.get("title") or "").strip():
        issues.append(_issue("error", "Course title is required.", "title"))
    if not str(course.get("shortDescription") or "").strip():
        issues.append(_issue("warning", "Course should include a shortDescription for catalog cards.", "shortDescription"))
    if not str(course.get("difficultyLevel") or "").strip():
        issues.append(_issue("warning", "Course should include a difficultyLevel.", "difficultyLevel"))
    return _gate("intake", "Course identity and learner-facing catalog metadata are present.", issues)


def _gate_benchmark_intake(course: dict[str, Any]) -> GateResult:
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    benchmarks = metadata.get("curriculumBenchmarks")
    issues: list[GateIssue] = []
    benchmark_count = len(benchmarks) if isinstance(benchmarks, list) else 0
    if benchmark_count == 0:
        issues.append(_issue("warning", "Course has no curriculum benchmark records.", "metadata.curriculumBenchmarks"))
    return _gate(
        "benchmark_intake",
        "Curriculum benchmark records were checked.",
        issues,
        {"benchmarkCount": benchmark_count},
    )


def _gate_requirement_extraction(course: dict[str, Any]) -> GateResult:
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    origins = metadata.get("requirementOrigins")
    benchmarks = metadata.get("curriculumBenchmarks")
    requirement_count = 0
    if isinstance(origins, list):
        requirement_count = len(origins)
    elif isinstance(benchmarks, list):
        for benchmark in benchmarks:
            if isinstance(benchmark, dict) and isinstance(benchmark.get("extractedRequirements"), list):
                requirement_count += len(benchmark["extractedRequirements"])
    issues: list[GateIssue] = []
    if requirement_count == 0:
        issues.append(_issue("warning", "No benchmark-derived requirements were extracted.", "metadata.requirementOrigins"))
    return _gate(
        "requirement_extraction",
        "Benchmark-derived requirements and origins were inspected.",
        issues,
        {"requirementOriginCount": requirement_count},
    )


def _gate_commonality_analysis(course: dict[str, Any]) -> GateResult:
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    parity = metadata.get("courseParityProfile") if isinstance(metadata.get("courseParityProfile"), dict) else {}
    source_slots = metadata.get("sourceSlots") if isinstance(metadata.get("sourceSlots"), list) else []
    required_topics = parity.get("commonRequiredTopics") if isinstance(parity.get("commonRequiredTopics"), list) else []
    issues: list[GateIssue] = []
    if not required_topics:
        issues.append(_issue("warning", "No common required topics were identified.", "metadata.courseParityProfile.commonRequiredTopics"))
    if required_topics and not source_slots:
        issues.append(_issue("warning", "Required topics should have source slots with fallback policy.", "metadata.sourceSlots"))
    return _gate(
        "commonality_analysis",
        "Required, optional, and fallback-source coverage were checked.",
        issues,
        {"requiredTopicCount": len(required_topics), "sourceSlotCount": len(source_slots)},
    )


def _gate_source_analysis(course: dict[str, Any]) -> GateResult:
    referenced = set(_source_ids(course))
    for module in _modules(course):
        referenced.update(_source_ids(module))
        for section in _sections(module):
            referenced.update(_source_ids(section))
            for block in _content(section):
                referenced.update(_source_ids(block))

    issues: list[GateIssue] = []
    if not referenced:
        issues.append(_issue("warning", "Course does not reference any sourceIds."))
    if _source_record_count(course) == 0 and referenced:
        issues.append(_issue("warning", "Course references sourceIds but does not include course-level sourceRecords."))
    return _gate(
        "source_analysis",
        "Source references and course-level source records were inspected.",
        issues,
        {"referencedSourceIdCount": len(referenced), "sourceRecordCount": _source_record_count(course)},
    )


def _gate_source_enrichment(course: dict[str, Any]) -> GateResult:
    source_record_count = _source_record_count(course)
    issues: list[GateIssue] = []
    if source_record_count < 2:
        issues.append(_issue("warning", "Course has fewer than two course-level source records; supplemental source coverage may be weak."))
    return _gate("source_enrichment", "Supplemental source coverage was checked for diversity.", issues, {"sourceRecordCount": source_record_count})


def _gate_classification(course: dict[str, Any]) -> GateResult:
    issues: list[GateIssue] = []
    for error in validate_course_taxonomy(course):
        location = "department" if "department" in error else "category"
        issues.append(_issue("error", error, location))
    tags = course.get("tags")
    if not isinstance(tags, list) or not any(isinstance(tag, str) and tag.strip() for tag in tags):
        issues.append(_issue("warning", "Course should include searchable tags.", "tags"))
    return _gate("classification", "College/school category, department, and searchable tags were checked.", issues)


def _gate_scope(course: dict[str, Any]) -> GateResult:
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    scope = metadata.get("scope") if isinstance(metadata.get("scope"), dict) else {}
    issues: list[GateIssue] = []
    if metadata.get("pacingLabel") not in {"Module", "Week"}:
        issues.append(_issue("warning", "metadata.pacingLabel should be exactly Module or Week.", "metadata.pacingLabel"))
    for key in ("audience", "level", "duration", "outcome"):
        if not str(scope.get(key) or "").strip():
            issues.append(_issue("warning", f"metadata.scope.{key} should be recorded.", f"metadata.scope.{key}"))
    return _gate("scope", "Course scope metadata was checked.", issues)


def _gate_module_structure(course: dict[str, Any]) -> GateResult:
    modules = _modules(course)
    issues: list[GateIssue] = []
    if not modules:
        issues.append(_issue("error", "Course must include at least one module.", "modules"))
    if len(modules) == 1:
        issues.append(_issue("warning", "Course has one module; confirm that the scope is intentionally compact.", "modules"))
    for index, module in enumerate(modules, start=1):
        sections = _sections(module)
        location = f"modules[{index}]"
        if not sections:
            issues.append(_issue("error", "Module must include sections.", location))
        if sections and not _is_summary_section(sections[-1]):
            issues.append(_issue("error", "Module must end with a summary/concept review section.", location))
    return _gate("module_structure", "Module count, sections, and terminal summaries were checked.", issues, {"moduleCount": len(modules)})


def _gate_section_structure(course: dict[str, Any]) -> GateResult:
    issues: list[GateIssue] = []
    for module_index, module in enumerate(_modules(course), start=1):
        sections = _sections(module)
        learn_count = sum(1 for section in sections if section.get("pageType") == "learn")
        apply_count = sum(1 for section in sections if section.get("pageType") == "apply")
        if learn_count == 0:
            issues.append(_issue("error", "Module must include at least one Learn section.", f"modules[{module_index}]"))
        if apply_count == 0:
            issues.append(_issue("warning", "Module should include at least one Apply section.", f"modules[{module_index}]"))
        for section_index, section in enumerate(sections, start=1):
            location = f"modules[{module_index}].sections[{section_index}]"
            blocks = _content(section)
            if not blocks:
                issues.append(_issue("error", "Section content must not be empty.", location))
            has_quiz = any(_is_quiz_block(block) for block in blocks)
            if has_quiz and any(not _is_quiz_block(block) for block in blocks):
                issues.append(_issue("error", "Quiz sections must not mix quiz blocks with instructional content.", location))
            if has_quiz and section.get("pageType") != "apply":
                issues.append(_issue("error", "Quiz sections must use pageType apply.", location))
    return _gate("section_structure", "Learn/Apply sections and quiz separation were checked.", issues)


def _gate_content_draft(course: dict[str, Any]) -> GateResult:
    issues: list[GateIssue] = []
    for module_index, module in enumerate(_modules(course), start=1):
        for section_index, section in enumerate(_sections(module), start=1):
            location = f"modules[{module_index}].sections[{section_index}]"
            text = _section_text(section)
            if section.get("pageType") == "learn" and not _is_summary_section(section):
                if not any(_is_concept_cards_block(block) for block in _content(section)):
                    issues.append(_issue("warning", "Learn sections should end with conceptCards.", location))
                if len(text.split()) < 40:
                    issues.append(_issue("warning", "Learn section appears thin; add direct explanation, example, or practice.", location))
            for pattern in PLACEHOLDER_PATTERNS:
                if pattern.search(text):
                    issues.append(_issue("error", f"Placeholder or model-instruction prose detected: {pattern.pattern}", location))
                    break
    return _gate("content_draft", "Instructional content was checked for learner-facing substance and placeholder prose.", issues)


def _gate_assessment(course: dict[str, Any]) -> GateResult:
    issues: list[GateIssue] = []
    quiz_count = 0
    for module_index, module in enumerate(_modules(course), start=1):
        module_quiz_count = 0
        for section_index, section in enumerate(_sections(module), start=1):
            for block_index, block in enumerate(_content(section), start=1):
                if not _is_quiz_block(block):
                    continue
                quiz_count += 1
                module_quiz_count += 1
                question_count = _question_count(block)
                if question_count == 0:
                    issues.append(_issue("error", "Quiz block must include questions.", f"modules[{module_index}].sections[{section_index}].content[{block_index}]"))
                elif question_count < 10:
                    issues.append(_issue("warning", "Quiz block has fewer than 10 questions.", f"modules[{module_index}].sections[{section_index}].content[{block_index}]"))
        if module_quiz_count == 0:
            issues.append(_issue("warning", "Module should include at least one quiz.", f"modules[{module_index}]"))
    return _gate("assessment", "Quiz presence, separation, and minimum question counts were checked.", issues, {"quizCount": quiz_count})


def _gate_media(course: dict[str, Any]) -> GateResult:
    issues: list[GateIssue] = []
    video_count = 0
    for module_index, module in enumerate(_modules(course), start=1):
        module_video_count = sum(1 for section in _sections(module) for block in _content(section) if _is_video_block(block))
        video_count += module_video_count
        if module_video_count == 0:
            issues.append(_issue("warning", "Module should include at least one source-backed video when reputable video material is available.", f"modules[{module_index}]"))
    return _gate("media", "Video coverage was checked as a tunable course-production minimum.", issues, {"videoCount": video_count})


def _gate_summary(course: dict[str, Any]) -> GateResult:
    issues: list[GateIssue] = []
    summary_count = 0
    for module_index, module in enumerate(_modules(course), start=1):
        summaries = [section for section in _sections(module) if _is_summary_section(section)]
        summary_count += len(summaries)
        if not summaries:
            issues.append(_issue("error", "Module must include a summary/concept review section.", f"modules[{module_index}]"))
        for summary_index, summary in enumerate(summaries, start=1):
            if not any(_is_concept_cards_block(block) for block in _content(summary)):
                issues.append(_issue("error", "Summary section must include conceptCards.", f"modules[{module_index}].summary[{summary_index}]"))
    return _gate("summary", "Module summary/concept review sections were checked.", issues, {"summaryCount": summary_count})


def _gate_validation(course: dict[str, Any]) -> GateResult:
    issues = [_issue("error", error) for error in validate_course_contract(course)]
    return _gate("validation", "Shared course contract validation was run.", issues, {"contractErrorCount": len(issues)})


def _gate_quality_eval(course: dict[str, Any]) -> GateResult:
    evals = run_course_quality_evals(course)
    issues: list[GateIssue] = []
    for dimension in evals["dimensions"]:
        if dimension["status"] == "failed":
            issues.append(_issue("error", f"{dimension['label']} failed with score {dimension['score']}."))
        elif dimension["status"] == "needs_review":
            issues.append(_issue("warning", f"{dimension['label']} needs review with score {dimension['score']}."))
    return _gate(
        "quality_eval",
        "Deterministic course-quality eval dimensions were scored.",
        issues,
        {
            "overallScore": evals["overallScore"],
            "status": evals["status"],
            "dimensionCount": evals["metrics"]["dimensionCount"],
            "failedDimensionCount": evals["metrics"]["failedDimensionCount"],
            "needsReviewDimensionCount": evals["metrics"]["needsReviewDimensionCount"],
        },
    )


def _gate_review_publish(gates: list[GateResult]) -> GateResult:
    failed_gate_names = [gate.gate for gate in gates if gate.status == "failed"]
    issues = [_issue("error", f"Failed gates must be resolved before publish: {', '.join(failed_gate_names)}.")] if failed_gate_names else []
    return _gate("review_publish", "Workflow gate status was summarized for review/publish readiness.", issues, {"failedGateCount": len(failed_gate_names)})


_COURSE_GATE_RUNNERS = {
    "intake": _gate_intake,
    "benchmark_intake": _gate_benchmark_intake,
    "requirement_extraction": _gate_requirement_extraction,
    "commonality_analysis": _gate_commonality_analysis,
    "source_analysis": _gate_source_analysis,
    "source_enrichment": _gate_source_enrichment,
    "classification": _gate_classification,
    "scope": _gate_scope,
    "module_structure": _gate_module_structure,
    "section_structure": _gate_section_structure,
    "content_draft": _gate_content_draft,
    "assessment": _gate_assessment,
    "media": _gate_media,
    "summary": _gate_summary,
    "validation": _gate_validation,
    "quality_eval": _gate_quality_eval,
}


def run_course_generation_workflow(course: dict[str, Any]) -> CourseGenerationWorkflowReport:
    gates = [_COURSE_GATE_RUNNERS[gate_name](course) for gate_name in COURSE_GENERATION_GATE_NAMES if gate_name != "review_publish"]
    gates.append(_gate_review_publish(gates))

    failed_count = sum(1 for gate in gates if gate.status == "failed")
    review_count = sum(1 for gate in gates if gate.status == "needs_review")
    status: GateStatus = "failed" if failed_count else "needs_review" if review_count else "passed"

    return CourseGenerationWorkflowReport(
        status=status,
        checkedAt=_now(),
        gates=gates,
        metrics={
            "gateCount": len(gates),
            "passedGateCount": sum(1 for gate in gates if gate.status == "passed"),
            "needsReviewGateCount": review_count,
            "failedGateCount": failed_count,
        },
    )
