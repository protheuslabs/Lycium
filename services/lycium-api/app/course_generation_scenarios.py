from __future__ import annotations

import re
from typing import Any, Literal

from app.course_generation_scenario_specs import COURSE_SCENARIOS, PROGRAM_SCENARIOS


ScenarioStatus = Literal["passed", "needs_review", "failed"]
FindingSeverity = Literal["warning", "error"]

SCENARIO_EVAL_VERSION = "course-generation-scenarios-v1"


def list_generation_eval_scenarios() -> dict[str, list[dict[str, str]]]:
    return {
        "courses": [{"id": scenario_id, "label": spec["label"]} for scenario_id, spec in COURSE_SCENARIOS.items()],
        "programs": [{"id": scenario_id, "label": spec["label"]} for scenario_id, spec in PROGRAM_SCENARIOS.items()],
    }


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9+#/]+", " ", value.lower()).strip()


def _keyword_present(blob: str, keyword: str) -> bool:
    normalized_blob = f" {_normalize(blob)} "
    normalized_keyword = _normalize(keyword)
    if f" {normalized_keyword} " in normalized_blob:
        return True
    tokens = [token for token in normalized_keyword.split() if len(token) > 2]
    return bool(tokens) and all(f" {token} " in normalized_blob for token in tokens)


def _finding(severity: FindingSeverity, message: str, location: str | None = None) -> dict[str, str]:
    payload = {"severity": severity, "message": message}
    if location:
        payload["location"] = location
    return payload


def _check(
    *,
    key: str,
    label: str,
    score: float,
    findings: list[dict[str, str]],
    metrics: dict[str, Any],
) -> dict[str, Any]:
    clipped = round(max(0.0, min(1.0, score)), 2)
    if any(finding["severity"] == "error" for finding in findings) or clipped < 0.55:
        status: ScenarioStatus = "failed"
    elif findings or clipped < 0.85:
        status = "needs_review"
    else:
        status = "passed"
    return {"key": key, "label": label, "score": clipped, "status": status, "findings": findings, "metrics": metrics}


def _block_text(block: dict[str, Any]) -> str:
    values = [_text(block.get(key)) for key in ("title", "heading", "value", "text", "body", "question", "description")]
    for concept in _items(block.get("concepts")):
        values.extend(_text(concept.get(key)) for key in ("name", "description"))
    for question in _items(block.get("questions") or block.get("questionBank")):
        values.append(_text(question.get("question")))
        options = question.get("options")
        if isinstance(options, list):
            values.extend(str(option) for option in options)
    return "\n".join(value for value in values if value)


def _course_metrics(course: dict[str, Any]) -> dict[str, Any]:
    modules = _items(course.get("modules"))
    learn_sections = 0
    quiz_blocks = 0
    quiz_blocks_with_min_questions = 0
    video_modules = 0
    summary_modules = 0
    full_text_parts = [
        _text(course.get("title")),
        _text(course.get("shortDescription")),
        _text(course.get("category")),
        _text(course.get("department")),
        " ".join(str(tag) for tag in course.get("tags", []) if isinstance(tag, str)),
    ]

    for module in modules:
        sections = _items(module.get("sections"))
        module_has_video = False
        module_has_summary = False
        full_text_parts.append(_text(module.get("title")))
        for section in sections:
            if section.get("pageType") == "learn":
                learn_sections += 1
            section_type = _normalize(_text(section.get("sectionType")) + " " + _text(section.get("title")))
            if "summary" in section_type or "concept review" in section_type:
                module_has_summary = True
            full_text_parts.extend([_text(section.get("title")), _text(section.get("sectionType"))])
            for block in _items(section.get("content")):
                full_text_parts.append(_block_text(block))
                if block.get("type") == "video":
                    module_has_video = True
                if block.get("type") == "quiz":
                    quiz_blocks += 1
                    questions = block.get("questions") or block.get("questionBank")
                    if isinstance(questions, list) and len(questions) >= 10:
                        quiz_blocks_with_min_questions += 1
        if module_has_video:
            video_modules += 1
        if module_has_summary:
            summary_modules += 1

    source_records = course.get("sourceRecords")
    source_record_count = len(source_records) if isinstance(source_records, list) else len(source_records or {}) if isinstance(source_records, dict) else 0
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    return {
        "moduleCount": len(modules),
        "learnSectionCount": learn_sections,
        "quizBlockCount": quiz_blocks,
        "quizBlocksWithMinQuestions": quiz_blocks_with_min_questions,
        "sourceRecordCount": source_record_count,
        "moduleVideoCoverage": round(video_modules / len(modules), 2) if modules else 0,
        "moduleSummaryCoverage": round(summary_modules / len(modules), 2) if modules else 0,
        "benchmarkCount": len(metadata.get("curriculumBenchmarks", [])) if isinstance(metadata.get("curriculumBenchmarks"), list) else 0,
        "requirementOriginCount": len(metadata.get("requirementOrigins", [])) if isinstance(metadata.get("requirementOrigins"), list) else 0,
        "textBlob": "\n".join(full_text_parts),
    }


def _coverage_check(text_blob: str, required_keywords: list[str], min_coverage: float) -> dict[str, Any]:
    covered = [keyword for keyword in required_keywords if _keyword_present(text_blob, keyword)]
    coverage = len(covered) / len(required_keywords) if required_keywords else 1.0
    findings = []
    if coverage < min_coverage:
        missing = [keyword for keyword in required_keywords if keyword not in covered]
        findings.append(_finding("error", f"Required topic coverage is too low. Missing examples: {', '.join(missing[:6])}."))
    return _check(
        key="required_topic_coverage",
        label="Required topic coverage",
        score=coverage,
        findings=findings,
        metrics={"requiredKeywordCount": len(required_keywords), "coveredRequiredKeywordCount": len(covered), "coverage": round(coverage, 2)},
    )


def evaluate_course_generation_scenario(course: dict[str, Any], scenario_id: str) -> dict[str, Any]:
    if scenario_id not in COURSE_SCENARIOS:
        raise ValueError(f"Unknown course generation scenario '{scenario_id}'")
    spec = COURSE_SCENARIOS[scenario_id]
    metrics = _course_metrics(course)
    checks = [
        _check(
            key="taxonomy",
            label="College and department placement",
            score=(
                0.5 * (course.get("category") == spec["expectedCategory"])
                + 0.5 * (course.get("department") == spec["expectedDepartment"])
            ),
            findings=[
                *([] if course.get("category") == spec["expectedCategory"] else [_finding("error", f"Expected category {spec['expectedCategory']}.", "category")]),
                *([] if course.get("department") == spec["expectedDepartment"] else [_finding("error", f"Expected department {spec['expectedDepartment']}.", "department")]),
            ],
            metrics={"category": course.get("category"), "department": course.get("department")},
        ),
        _coverage_check(metrics["textBlob"], spec["requiredKeywords"], float(spec["minRequiredKeywordCoverage"])),
        _check(
            key="course_structure",
            label="College-course structure",
            score=min(1.0, metrics["moduleCount"] / spec["minModules"]) * 0.55 + metrics["moduleSummaryCoverage"] * 0.45,
            findings=[
                *([] if metrics["moduleCount"] >= spec["minModules"] else [_finding("error", f"Expected at least {spec['minModules']} modules/weeks.", "modules")]),
                *([] if metrics["moduleSummaryCoverage"] >= 1 else [_finding("error", "Every module should end with a summary/concept review.")]),
            ],
            metrics={key: metrics[key] for key in ("moduleCount", "learnSectionCount", "moduleSummaryCoverage")},
        ),
        _check(
            key="assessment_depth",
            label="Assessment depth",
            score=min(1.0, metrics["quizBlockCount"] / spec["minQuizBlocks"]) * 0.45
            + min(1.0, metrics["quizBlocksWithMinQuestions"] / max(1, metrics["quizBlockCount"])) * 0.55,
            findings=[
                *([] if metrics["quizBlockCount"] >= spec["minQuizBlocks"] else [_finding("error", f"Expected at least {spec['minQuizBlocks']} quiz blocks.")]),
                *([] if metrics["quizBlocksWithMinQuestions"] == metrics["quizBlockCount"] else [_finding("error", "Each scenario quiz should include at least 10 questions.")]),
            ],
            metrics={key: metrics[key] for key in ("quizBlockCount", "quizBlocksWithMinQuestions")},
        ),
        _check(
            key="media_and_sources",
            label="Media and source grounding",
            score=min(1.0, metrics["sourceRecordCount"] / spec["minSourceRecords"]) * 0.45
            + min(1.0, metrics["moduleVideoCoverage"] / spec["minModuleVideoCoverage"]) * 0.35
            + min(1.0, metrics["requirementOriginCount"] / 6) * 0.2,
            findings=[
                *([] if metrics["sourceRecordCount"] >= spec["minSourceRecords"] else [_finding("error", f"Expected at least {spec['minSourceRecords']} source records.")]),
                *([] if metrics["moduleVideoCoverage"] >= spec["minModuleVideoCoverage"] else [_finding("warning", "Video coverage is below the scenario target.")]),
                *([] if metrics["requirementOriginCount"] else [_finding("warning", "Scenario course has no benchmark-derived requirement origins.")]),
            ],
            metrics={key: metrics[key] for key in ("sourceRecordCount", "moduleVideoCoverage", "benchmarkCount", "requirementOriginCount")},
        ),
    ]
    return _scenario_report(scenario_id=scenario_id, label=spec["label"], kind="course", checks=checks)


def _program_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("program") if isinstance(payload.get("program"), dict) else payload


def _program_text_and_metrics(payload: dict[str, Any]) -> dict[str, Any]:
    program = _program_from_payload(payload)
    groups = _items(program.get("requirementGroups"))
    requirements = [requirement for group in groups for requirement in _items(group.get("requirements"))]
    dependency_edges = _items((program.get("dependencyGraph") or {}).get("edges") if isinstance(program.get("dependencyGraph"), dict) else [])
    text_parts = [_text(program.get(key)) for key in ("title", "description", "field", "targetOutcome")]
    for group in groups:
        text_parts.extend(_text(group.get(key)) for key in ("displayName", "purpose", "groupKind"))
        for requirement in _items(group.get("requirements")):
            text_parts.extend(_text(requirement.get(key)) for key in ("title", "type", "courseId", "assessmentId", "projectId"))
            course_ids = requirement.get("courseIds")
            if isinstance(course_ids, list):
                text_parts.extend(str(course_id) for course_id in course_ids)
    return {
        "groupCount": len(groups),
        "courseRequirementCount": sum(1 for requirement in requirements if requirement.get("type") in {"complete_course", "complete_n_of_courses"}),
        "assessmentRequirementCount": sum(1 for requirement in requirements if requirement.get("type") == "pass_assessment"),
        "projectRequirementCount": sum(1 for requirement in requirements if requirement.get("type") == "submit_project"),
        "dependencyEdgeCount": len(dependency_edges),
        "textBlob": "\n".join(text_parts),
    }


def evaluate_program_generation_scenario(program_payload: dict[str, Any], scenario_id: str) -> dict[str, Any]:
    if scenario_id not in PROGRAM_SCENARIOS:
        raise ValueError(f"Unknown program generation scenario '{scenario_id}'")
    spec = PROGRAM_SCENARIOS[scenario_id]
    metrics = _program_text_and_metrics(program_payload)
    text_blob = metrics["textBlob"]
    covered_groups = [keyword for keyword in spec["requiredGroupKeywords"] if _keyword_present(text_blob, keyword)]
    covered_requirements = [keyword for keyword in spec["requiredRequirementKeywords"] if _keyword_present(text_blob, keyword)]
    requirement_coverage = len(covered_requirements) / len(spec["requiredRequirementKeywords"])

    checks = [
        _check(
            key="requirement_group_shape",
            label="Requirement-group shape",
            score=min(1.0, metrics["groupCount"] / spec["minRequirementGroups"]) * 0.45
            + min(1.0, len(covered_groups) / len(spec["requiredGroupKeywords"])) * 0.55,
            findings=[
                *([] if metrics["groupCount"] >= spec["minRequirementGroups"] else [_finding("error", f"Expected at least {spec['minRequirementGroups']} requirement groups.")]),
                *([] if len(covered_groups) / len(spec["requiredGroupKeywords"]) >= 0.7 else [_finding("error", "Program groups do not cover the expected full-stack domains.")]),
            ],
            metrics={"groupCount": metrics["groupCount"], "coveredGroupKeywordCount": len(covered_groups)},
        ),
        _check(
            key="requirement_coverage",
            label="Requirement coverage",
            score=requirement_coverage,
            findings=[
                *([] if metrics["courseRequirementCount"] >= spec["minCourseRequirements"] else [_finding("error", f"Expected at least {spec['minCourseRequirements']} course requirements.")]),
                *([] if requirement_coverage >= spec["minRequiredKeywordCoverage"] else [_finding("error", "Program course requirements miss core full-stack topics.")]),
            ],
            metrics={"courseRequirementCount": metrics["courseRequirementCount"], "coveredRequirementKeywordCount": len(covered_requirements), "coverage": round(requirement_coverage, 2)},
        ),
        _check(
            key="evidence_and_assessment",
            label="Assessment and portfolio evidence",
            score=min(1.0, metrics["assessmentRequirementCount"] / spec["minAssessmentRequirements"]) * 0.45
            + min(1.0, metrics["projectRequirementCount"] / spec["minProjectRequirements"]) * 0.55,
            findings=[
                *([] if metrics["assessmentRequirementCount"] >= spec["minAssessmentRequirements"] else [_finding("error", "Program needs more assessment requirements.")]),
                *([] if metrics["projectRequirementCount"] >= spec["minProjectRequirements"] else [_finding("error", "Program needs a project/capstone requirement.")]),
            ],
            metrics={key: metrics[key] for key in ("assessmentRequirementCount", "projectRequirementCount")},
        ),
        _check(
            key="dependency_graph",
            label="Prerequisite dependency graph",
            score=min(1.0, metrics["dependencyEdgeCount"] / spec["minDependencyEdges"]),
            findings=[] if metrics["dependencyEdgeCount"] >= spec["minDependencyEdges"] else [_finding("error", "Program dependency graph is too thin.")],
            metrics={"dependencyEdgeCount": metrics["dependencyEdgeCount"]},
        ),
    ]
    return _scenario_report(scenario_id=scenario_id, label=spec["label"], kind="program", checks=checks)


def _scenario_report(*, scenario_id: str, label: str, kind: str, checks: list[dict[str, Any]]) -> dict[str, Any]:
    score = round(sum(float(check["score"]) for check in checks) / max(1, len(checks)), 2)
    failed_count = sum(1 for check in checks if check["status"] == "failed")
    needs_review_count = sum(1 for check in checks if check["status"] == "needs_review")
    status: ScenarioStatus = "failed" if failed_count else "needs_review" if needs_review_count or score < 0.9 else "passed"
    return {
        "evalVersion": SCENARIO_EVAL_VERSION,
        "scenarioId": scenario_id,
        "scenarioLabel": label,
        "kind": kind,
        "status": status,
        "score": score,
        "checks": checks,
        "recommendations": [
            f"{check['label']}: {finding['message']}"
            for check in checks
            for finding in check["findings"]
        ][:12],
        "metrics": {
            "checkCount": len(checks),
            "failedCheckCount": failed_count,
            "needsReviewCheckCount": needs_review_count,
        },
    }
