from __future__ import annotations

import re
from typing import Any, Literal

from app.course_generation_scenario_specs import COURSE_SCENARIOS, PROGRAM_SCENARIOS
from app.course_generation_stage_workflows import (
    COURSE_MODULE_OUTLINE_CONTRACT,
    COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT,
    COURSE_TEMPLATE_ARTIFACT_CONTRACT,
    COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT,
)
from app.course_source_integrity import assess_course_source_integrity
from app.course_quality import assess_course_quality


ScenarioStatus = Literal["passed", "needs_review", "failed"]
FindingSeverity = Literal["warning", "error"]

SCENARIO_EVAL_VERSION = "course-generation-scenarios-v1"
SCENARIO_PROMPT_FILLER_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bthe model should\b",
        r"\bthe agent should\b",
        r"\bwrite (?:a|the) lesson\b",
        r"\bgenerate (?:instructional )?content\b",
        r"\bcontent goes here\b",
        r"\btodo\b",
        r"\bthis lesson supports the module objective\b",
        r"\bworking model studies\b",
    ]
]


def list_generation_eval_scenarios() -> dict[str, list[dict[str, str]]]:
    return {
        "courses": [{"id": scenario_id, "label": spec["label"]} for scenario_id, spec in COURSE_SCENARIOS.items()],
        "programs": [{"id": scenario_id, "label": spec["label"]} for scenario_id, spec in PROGRAM_SCENARIOS.items()],
    }


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _has_items(value: Any) -> bool:
    return isinstance(value, list) and bool(value)


def _text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


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
    source_integrity = assess_course_source_integrity(course)
    source_integrity_metrics = source_integrity["metrics"]
    modules = _items(course.get("modules"))
    learn_sections = 0
    sourced_sections = 0
    sourceable_blocks = 0
    sourced_blocks = 0
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
            if _has_items(section.get("sourceIds")):
                sourced_sections += 1
            section_type = _normalize(_text(section.get("sectionType")) + " " + _text(section.get("title")))
            if "summary" in section_type or "concept review" in section_type:
                module_has_summary = True
            full_text_parts.extend([_text(section.get("title")), _text(section.get("sectionType"))])
            for block in _items(section.get("content")):
                full_text_parts.append(_block_text(block))
                if block.get("type") in {"text", "video", "iframe", "conceptCard", "conceptCards", "quiz"}:
                    sourceable_blocks += 1
                    if _has_items(block.get("sourceIds")):
                        sourced_blocks += 1
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
    source_slots = _items(metadata.get("sourceSlots"))
    slots_with_primary = sum(1 for slot in source_slots if isinstance(slot.get("primarySourceId"), str) and slot["primarySourceId"])
    total_sections = sum(len(_items(module.get("sections"))) for module in modules)
    return {
        "moduleCount": len(modules),
        "learnSectionCount": learn_sections,
        "sectionSourceCoverage": round(sourced_sections / total_sections, 2) if total_sections else 0,
        "quizBlockCount": quiz_blocks,
        "quizBlocksWithMinQuestions": quiz_blocks_with_min_questions,
        "sourceRecordCount": source_record_count,
        "sourceSlotCount": len(source_slots),
        "sourceSlotPrimaryCoverageRatio": round(slots_with_primary / len(source_slots), 2) if source_slots else 0,
        "blockSourceCoverage": round(sourced_blocks / sourceable_blocks, 2) if sourceable_blocks else 0,
        "directConceptSourceCoverage": round(float(source_integrity_metrics.get("directConceptSourceCoveragePercent") or 0) / 100, 2),
        "directBlockSourceCoverage": round(float(source_integrity_metrics.get("directBlockSourceCoveragePercent") or 0) / 100, 2),
        "moduleVideoCoverage": round(video_modules / len(modules), 2) if modules else 0,
        "moduleSummaryCoverage": round(summary_modules / len(modules), 2) if modules else 0,
        "benchmarkCount": len(metadata.get("curriculumBenchmarks", [])) if isinstance(metadata.get("curriculumBenchmarks"), list) else 0,
        "requirementOriginCount": len(metadata.get("requirementOrigins", [])) if isinstance(metadata.get("requirementOrigins"), list) else 0,
        "textBlob": "\n".join(full_text_parts),
    }


def _metadata(course: dict[str, Any]) -> dict[str, Any]:
    return course.get("metadata") if isinstance(course.get("metadata"), dict) else {}


def _contains_materialization_payload(value: Any) -> bool:
    if isinstance(value, dict):
        if any(key in value for key in ("courseWrapper", "activeGenerationPlan", "courseBuildTask", "modules", "sections", "content")):
            return True
        return any(_contains_materialization_payload(child) for child in value.values())
    if isinstance(value, list):
        return any(_contains_materialization_payload(item) for item in value)
    return False


def _contains_module_outline_materialization_payload(value: Any) -> bool:
    if isinstance(value, dict):
        if any(key in value for key in ("sections", "content", "blocks", "lessonText", "body", "markdown", "html")):
            return True
        return any(_contains_module_outline_materialization_payload(child) for child in value.values())
    if isinstance(value, list):
        return any(_contains_module_outline_materialization_payload(item) for item in value)
    return False


def _course_template_from_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    artifacts = payload.get("artifacts") if isinstance(payload.get("artifacts"), dict) else {}
    if isinstance(artifacts.get("courseTemplate"), dict):
        quality = artifacts.get("courseTemplateQualityReport") if isinstance(artifacts.get("courseTemplateQualityReport"), dict) else {}
        return artifacts["courseTemplate"], quality
    if payload.get("contractVersion") == COURSE_TEMPLATE_ARTIFACT_CONTRACT:
        return payload, {}
    if isinstance(payload.get("courseTemplate"), dict):
        quality = payload.get("courseTemplateQualityReport") if isinstance(payload.get("courseTemplateQualityReport"), dict) else {}
        return payload["courseTemplate"], quality
    return {}, {}


def _module_outline_from_payload(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    artifacts = payload.get("artifacts") if isinstance(payload.get("artifacts"), dict) else {}
    if isinstance(artifacts.get("outline"), dict):
        quality = artifacts.get("outlineQualityReport") if isinstance(artifacts.get("outlineQualityReport"), dict) else {}
        return artifacts["outline"], quality
    if isinstance(payload.get("outline"), dict):
        quality = payload.get("outlineQualityReport") if isinstance(payload.get("outlineQualityReport"), dict) else {}
        return payload["outline"], quality
    if isinstance(payload.get("modules"), list):
        return payload, {}
    return {}, {}


def _template_text_blob(template: dict[str, Any]) -> str:
    parts = [
        _text(template.get("title")),
        _text(template.get("shortDescription")),
        _text(template.get("category")),
        _text(template.get("department")),
    ]
    scope = template.get("scope") if isinstance(template.get("scope"), dict) else {}
    parts.extend(str(value) for value in scope.values() if isinstance(value, str))
    for outcome in _items(template.get("learningOutcomes")):
        parts.append(_text(outcome.get("outcome")))
    checklist = template.get("courseCoverageChecklist") if isinstance(template.get("courseCoverageChecklist"), dict) else {}
    for item in _items(checklist.get("requiredItems")):
        parts.extend(_text(item.get(key)) for key in ("title", "description"))
        parts.extend(str(value) for value in item.get("mustTeach", []) if isinstance(value, str))
        for section_plan in _items(item.get("sectionPlans")):
            parts.extend(_text(section_plan.get(key)) for key in ("title", "learningObjective"))
            parts.extend(str(value) for value in section_plan.get("mustTeach", []) if isinstance(value, str))
    return "\n".join(part for part in parts if part)


def _module_outline_text_blob(outline: dict[str, Any]) -> str:
    parts = [
        _text(outline.get("title")),
        _text(outline.get("shortDescription")),
        _text(outline.get("summary")),
    ]
    for module in _items(outline.get("modules")):
        parts.extend(_text(module.get(key)) for key in ("title", "description", "summary", "objective"))
        parts.extend(_strings(module.get("learning_objectives") or module.get("learningObjectives")))
        parts.extend(_strings(module.get("concept_keywords") or module.get("conceptKeywords") or module.get("concepts")))
        parts.extend(_strings(module.get("coverageMustTeach")))
    checklist = outline.get("courseCoverageChecklist") if isinstance(outline.get("courseCoverageChecklist"), dict) else {}
    for item in _items(checklist.get("requiredItems")):
        parts.extend(_text(item.get(key)) for key in ("title", "description"))
        parts.extend(_strings(item.get("mustTeach")))
    return "\n".join(part for part in parts if part)


def _template_title_check(template: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
    title = str(template.get("title") or "").strip()
    normalized_title = _normalize(title)
    label_tokens = [token for token in _normalize(str(spec.get("label") or "")).split() if len(token) > 3]
    matched_tokens = [token for token in label_tokens if f" {token} " in f" {normalized_title} "]
    banned_fragments = ("covering", "including", "source gap", "needs sources")
    findings = [
        *([] if title else [_finding("error", "Course template must resolve a non-empty title.", "title")]),
        *(
            []
            if len(matched_tokens) >= max(1, min(2, len(label_tokens)))
            else [_finding("error", "Resolved title does not preserve enough of the requested course identity.", "title")]
        ),
        *(
            []
            if not any(fragment in normalized_title for fragment in banned_fragments)
            else [_finding("error", "Resolved title still contains prompt or workflow-state wording.", "title")]
        ),
    ]
    return _check(
        key="template_title",
        label="Resolved course title",
        score=0.4 * bool(title)
        + 0.4 * (len(matched_tokens) >= max(1, min(2, len(label_tokens))))
        + 0.2 * (not any(fragment in normalized_title for fragment in banned_fragments)),
        findings=findings,
        metrics={"title": title, "matchedLabelTokenCount": len(matched_tokens), "labelTokenCount": len(label_tokens)},
    )


def _template_handoff_check(template: dict[str, Any], quality: dict[str, Any]) -> dict[str, Any]:
    checklist = template.get("courseCoverageChecklist") if isinstance(template.get("courseCoverageChecklist"), dict) else {}
    required_items = _items(checklist.get("requiredItems"))
    learning_outcomes = _items(template.get("learningOutcomes"))
    handoff = template.get("handoff") if isinstance(template.get("handoff"), dict) else {}
    scope = template.get("scope") if isinstance(template.get("scope"), dict) else {}
    required_ids = [str(item.get("id")) for item in required_items if str(item.get("id") or "").strip()]
    handoff_ids = [str(item) for item in handoff.get("requiredCoverageItemIds", []) if str(item).strip()]
    has_scope = all(str(scope.get(key) or "").strip() for key in ("audience", "level", "duration", "outcome", "assessmentExpectations"))
    coverage_handoff_matches = bool(required_ids) and handoff_ids == required_ids
    no_materialization = not _contains_materialization_payload(template)
    quality_passed = quality.get("contractVersion") == COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT and bool(quality.get("passed"))
    findings = [
        *([] if template.get("contractVersion") == COURSE_TEMPLATE_ARTIFACT_CONTRACT else [_finding("error", "Template artifact contract is missing or wrong.", "contractVersion")]),
        *([] if str(template.get("shortDescription") or "").strip() else [_finding("error", "Template needs a learner-facing shortDescription.", "shortDescription")]),
        *([] if has_scope else [_finding("error", "Template scope is missing required handoff fields.", "scope")]),
        *([] if len(learning_outcomes) >= 3 else [_finding("error", "Template needs at least three learning outcomes.", "learningOutcomes")]),
        *([] if all(_items(item.get("sectionPlans")) and _strings(item.get("mustTeach")) for item in required_items) else [_finding("error", "Coverage items need mustTeach values and section-plan hints.", "courseCoverageChecklist.requiredItems")]),
        *([] if handoff.get("nextWorkflow") == COURSE_MODULE_OUTLINE_CONTRACT else [_finding("error", "Template handoff must point to module outline generation.", "handoff.nextWorkflow")]),
        *([] if coverage_handoff_matches else [_finding("error", "Handoff coverage item IDs must exactly match checklist item IDs.", "handoff.requiredCoverageItemIds")]),
        *([] if no_materialization else [_finding("error", "Template workflow must not materialize modules, sections, build tasks, or content.")]),
        *([] if quality_passed else [_finding("error", "Template quality report must pass.", "courseTemplateQualityReport")]),
    ]
    return _check(
        key="template_handoff",
        label="First-stage handoff shape",
        score=(
            0.1 * (template.get("contractVersion") == COURSE_TEMPLATE_ARTIFACT_CONTRACT)
            + 0.1 * bool(str(template.get("shortDescription") or "").strip())
            + 0.15 * has_scope
            + 0.15 * (len(learning_outcomes) >= 3)
            + 0.15 * all(_items(item.get("sectionPlans")) and _strings(item.get("mustTeach")) for item in required_items)
            + 0.1 * (handoff.get("nextWorkflow") == COURSE_MODULE_OUTLINE_CONTRACT)
            + 0.1 * coverage_handoff_matches
            + 0.1 * no_materialization
            + 0.05 * quality_passed
        ),
        findings=findings,
        metrics={
            "learningOutcomeCount": len(learning_outcomes),
            "requiredCoverageItemCount": len(required_items),
            "handoffCoverageItemCount": len(handoff_ids),
            "materializedPayloadPresent": int(not no_materialization),
            "qualityPassed": int(quality_passed),
        },
    )


def _template_taxonomy_check(template: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
    return _check(
        key="template_taxonomy",
        label="Template taxonomy preservation",
        score=(
            0.5 * (template.get("category") == spec["expectedCategory"])
            + 0.5 * (template.get("department") == spec["expectedDepartment"])
        ),
        findings=[
            *([] if template.get("category") == spec["expectedCategory"] else [_finding("error", f"Expected category {spec['expectedCategory']}.", "category")]),
            *([] if template.get("department") == spec["expectedDepartment"] else [_finding("error", f"Expected department {spec['expectedDepartment']}.", "department")]),
        ],
        metrics={"category": template.get("category"), "department": template.get("department")},
    )


def _template_description_check(template: dict[str, Any]) -> dict[str, Any]:
    description = str(template.get("shortDescription") or "")
    normalized = _normalize(description)
    meta_terms = ("template", "handoff", "workflow", "staged module", "generated artifact")
    findings = [
        *([] if 60 <= len(description) <= 180 else [_finding("warning", "Catalog description should be concise but substantial.", "shortDescription")]),
        *([] if not any(term in normalized for term in meta_terms) else [_finding("error", "Catalog description should describe the course, not the workflow artifact.", "shortDescription")]),
    ]
    return _check(
        key="template_description",
        label="Learner-facing catalog description",
        score=0.55 * (60 <= len(description) <= 180) + 0.45 * (not any(term in normalized for term in meta_terms)),
        findings=findings,
        metrics={"descriptionLength": len(description), "metaTermCount": sum(1 for term in meta_terms if term in normalized)},
    )


def evaluate_course_template_generation_scenario(template_payload: dict[str, Any], scenario_id: str) -> dict[str, Any]:
    if scenario_id not in COURSE_SCENARIOS:
        raise ValueError(f"Unknown course generation scenario '{scenario_id}'")
    spec = COURSE_SCENARIOS[scenario_id]
    template, quality = _course_template_from_payload(template_payload)
    text_blob = _template_text_blob(template)
    min_coverage = float(spec.get("minTemplateRequiredKeywordCoverage") or 0.95)
    checks = [
        _template_title_check(template, spec),
        _template_taxonomy_check(template, spec),
        _template_handoff_check(template, quality),
        _template_description_check(template),
        _coverage_check(text_blob, spec["requiredKeywords"], min_coverage),
        _specificity_check(text_blob),
    ]
    return _scenario_report(scenario_id=scenario_id, label=spec["label"], kind="course_template", checks=checks)


def _module_outline_shape_check(payload: dict[str, Any], outline: dict[str, Any], quality: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
    modules = _items(outline.get("modules"))
    quality_metrics = quality.get("metrics") if isinstance(quality.get("metrics"), dict) else {}
    no_materialization = not _contains_module_outline_materialization_payload(outline)
    titled_modules = [module for module in modules if str(module.get("title") or "").strip()]
    objective_modules = [
        module
        for module in modules
        if _strings(module.get("learning_objectives") or module.get("learningObjectives"))
    ]
    concept_modules = [
        module
        for module in modules
        if _strings(module.get("concept_keywords") or module.get("conceptKeywords") or module.get("concepts"))
    ]
    sourced_modules = [module for module in modules if _strings(module.get("sourceIds"))]
    target_section_modules = [module for module in modules if int(module.get("targetSectionCount") or 0) >= 2]
    quality_passed = quality.get("contractVersion") == COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT and bool(quality.get("passed"))
    findings = [
        *([] if payload.get("contractVersion") in {None, COURSE_MODULE_OUTLINE_CONTRACT} else [_finding("error", "Module outline workflow contract is wrong.", "contractVersion")]),
        *([] if len(modules) >= int(spec["minModules"]) else [_finding("error", f"Expected at least {spec['minModules']} module outlines.", "modules")]),
        *([] if len(titled_modules) == len(modules) else [_finding("error", "Every module outline needs a title.", "modules[].title")]),
        *([] if len(objective_modules) == len(modules) else [_finding("error", "Every module outline needs learning objectives.", "modules[].learning_objectives")]),
        *([] if len(concept_modules) == len(modules) else [_finding("error", "Every module outline needs concept keywords.", "modules[].concept_keywords")]),
        *([] if len(sourced_modules) == len(modules) else [_finding("error", "Every source-backed module outline needs source IDs.", "modules[].sourceIds")]),
        *([] if len(target_section_modules) == len(modules) else [_finding("error", "Every module outline needs a target section count.", "modules[].targetSectionCount")]),
        *([] if no_materialization else [_finding("error", "Module outline workflow must not create section plans, sections, or learner-facing content.")]),
        *([] if quality_passed else [_finding("error", "Module outline quality report must pass.", "outlineQualityReport")]),
    ]
    return _check(
        key="module_outline_shape",
        label="Module outline handoff shape",
        score=(
            0.1 * (payload.get("contractVersion") in {None, COURSE_MODULE_OUTLINE_CONTRACT})
            + 0.15 * min(1.0, len(modules) / max(1, int(spec["minModules"])))
            + 0.1 * (len(titled_modules) == len(modules))
            + 0.1 * (len(objective_modules) == len(modules))
            + 0.1 * (len(concept_modules) == len(modules))
            + 0.1 * (len(sourced_modules) == len(modules))
            + 0.1 * (len(target_section_modules) == len(modules))
            + 0.15 * no_materialization
            + 0.1 * quality_passed
        ),
        findings=findings,
        metrics={
            "moduleCount": len(modules),
            "minimumModuleCount": int(spec["minModules"]),
            "titledModuleCount": len(titled_modules),
            "objectiveModuleCount": len(objective_modules),
            "conceptModuleCount": len(concept_modules),
            "sourcedModuleCount": len(sourced_modules),
            "targetSectionModuleCount": len(target_section_modules),
            "materializedPayloadPresent": int(not no_materialization),
            "qualityPassed": int(quality_passed),
            "qualityRequiredCoverageItemCount": quality_metrics.get("requiredCoverageItemCount", 0),
        },
    )


def _module_outline_coverage_assignment_check(outline: dict[str, Any], quality: dict[str, Any]) -> dict[str, Any]:
    modules = _items(outline.get("modules"))
    checklist = outline.get("courseCoverageChecklist") if isinstance(outline.get("courseCoverageChecklist"), dict) else {}
    required_ids = {
        str(item.get("id"))
        for item in _items(checklist.get("requiredItems"))
        if str(item.get("id") or "").strip()
    }
    assigned_ids = {
        str(item_id)
        for module in modules
        for item_id in _strings(module.get("assignedCoverageItemIds"))
    }
    quality_metrics = quality.get("metrics") if isinstance(quality.get("metrics"), dict) else {}
    quality_unassigned = int(quality_metrics.get("unassignedCoverageItemCount") or 0)
    unassigned_ids = sorted(required_ids - assigned_ids)
    findings = [
        *([] if required_ids else [_finding("error", "Module outline should preserve the course coverage checklist.", "courseCoverageChecklist")]),
        *([] if not unassigned_ids else [_finding("error", f"Coverage items were not assigned to modules: {', '.join(unassigned_ids[:6])}.", "modules[].assignedCoverageItemIds")]),
        *([] if quality_unassigned == 0 else [_finding("error", "Module outline quality report found unassigned coverage items.", "outlineQualityReport.coverageAllocation")]),
    ]
    return _check(
        key="module_outline_coverage_assignment",
        label="Required coverage assigned to modules",
        score=0.35 * bool(required_ids)
        + 0.45 * (not unassigned_ids)
        + 0.2 * (quality_unassigned == 0),
        findings=findings,
        metrics={
            "requiredCoverageItemCount": len(required_ids),
            "assignedCoverageItemCount": len(assigned_ids & required_ids),
            "unassignedCoverageItemCount": len(unassigned_ids),
            "qualityUnassignedCoverageItemCount": quality_unassigned,
        },
    )


def evaluate_course_module_outline_generation_scenario(outline_payload: dict[str, Any], scenario_id: str) -> dict[str, Any]:
    if scenario_id not in COURSE_SCENARIOS:
        raise ValueError(f"Unknown course generation scenario '{scenario_id}'")
    spec = COURSE_SCENARIOS[scenario_id]
    outline, quality = _module_outline_from_payload(outline_payload)
    text_blob = _module_outline_text_blob(outline)
    min_coverage = float(spec.get("minModuleOutlineRequiredKeywordCoverage") or 0.95)
    checks = [
        _module_outline_shape_check(outline_payload, outline, quality, spec),
        _module_outline_coverage_assignment_check(outline, quality),
        _coverage_check(text_blob, spec["requiredKeywords"], min_coverage),
        _specificity_check(text_blob),
    ]
    return _scenario_report(scenario_id=scenario_id, label=spec["label"], kind="course_module_outline", checks=checks)


def _source_gap_metrics(course: dict[str, Any]) -> dict[str, Any]:
    metadata = _metadata(course)
    source_gaps = _items(metadata.get("sourceGaps"))
    first_gap = source_gaps[0] if source_gaps else {}
    generation_plan = metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {}
    modules = _items(course.get("modules"))
    sections = [section for module in modules for section in _items(module.get("sections"))]
    lesson_sections = [section for section in sections if section.get("sectionType") == "lesson"]
    placeholder_sections = [
        section for section in sections if section.get("sectionType") == "source-gap"
        or "section not yet generated" in _normalize(str(section.get("content") or ""))
    ]
    lesson_bodies = {
        _text(block.get("value")).strip() for section in lesson_sections
        for block in _items(section.get("content"))
        if block.get("type") == "text" and _text(block.get("value")).strip()
    }
    planned_empty_sections = []
    handoff_sections = []
    content_bearing_lesson_sections = []
    for section in lesson_sections:
        content = section.get("content")
        if _items(content):
            content_bearing_lesson_sections.append(section)
        section_metadata = section.get("metadata") if isinstance(section.get("metadata"), dict) else {}
        generation_outline = (
            section_metadata.get("generationOutline")
            if isinstance(section_metadata.get("generationOutline"), dict)
            else {}
        )
        if content == [] and generation_outline.get("contentStatus") == "planned_empty":
            planned_empty_sections.append(section)
        if (
            generation_outline.get("plannedDescription")
            and (
                generation_outline.get("plannedLearningOutcome")
                or _has_items(generation_outline.get("plannedLearningObjectives"))
            )
            and _has_items(generation_outline.get("sourceNeeds"))
        ):
            handoff_sections.append(section)
    source_records = course.get("sourceRecords")
    source_record_count = len(source_records) if isinstance(source_records, list) else len(source_records or {}) if isinstance(source_records, dict) else 0
    return {
        "status": course.get("status") or metadata.get("status"),
        "metadataStatus": metadata.get("status"),
        "sourceGapCount": len(source_gaps),
        "blockingSourceGapCount": sum(1 for gap in source_gaps if gap.get("severity") == "blocking"),
        "suggestedQueryCount": len(first_gap.get("suggestedQueries", [])) if isinstance(first_gap.get("suggestedQueries"), list) else 0,
        "sourceTypeHintCount": len(first_gap.get("sourceTypeHints", [])) if isinstance(first_gap.get("sourceTypeHints"), list) else 0,
        "currentSourceCount": int(first_gap.get("currentSourceCount") or 0) if isinstance(first_gap, dict) else 0,
        "minimumSourceCount": int(first_gap.get("minimumSourceCount") or 0) if isinstance(first_gap, dict) else 0,
        "generationPlanMode": generation_plan.get("mode"),
        "moduleCount": len(modules),
        "bestEffortLessonSectionCount": len(lesson_sections),
        "plannedEmptySectionCount": len(planned_empty_sections),
        "handoffMetadataSectionCount": len(handoff_sections),
        "contentBearingLessonSectionCount": len(content_bearing_lesson_sections),
        "distinctLessonBodyCount": len(lesson_bodies),
        "placeholderSectionCount": len(placeholder_sections),
        "sourceRecordCount": source_record_count,
    }


def _evaluate_needs_sources_scenario(course: dict[str, Any], scenario_id: str, spec: dict[str, Any]) -> dict[str, Any]:
    metrics = _source_gap_metrics(course)
    text_blob = _course_metrics(course)["textBlob"]
    expected_status = spec.get("expectedStatus", "needs_sources")
    min_planned_sections = int(spec.get("minPlannedLessonSections") or spec.get("minBestEffortLessonSections") or 0)
    checks = [
        _check(
            key="source_gap_lifecycle",
            label="Needs-sources lifecycle",
            score=(
                0.4 * (metrics["status"] == expected_status)
                + 0.3 * (metrics["metadataStatus"] == expected_status)
                + 0.3 * (metrics["sourceGapCount"] >= int(spec["minSourceGaps"]))
            ),
            findings=[
                *([] if metrics["status"] == expected_status else [_finding("error", f"Expected course status {expected_status}.", "status")]),
                *([] if metrics["metadataStatus"] == expected_status else [_finding("error", f"Expected metadata status {expected_status}.", "metadata.status")]),
                *([] if metrics["sourceGapCount"] >= int(spec["minSourceGaps"]) else [_finding("error", "Expected at least one metadata.sourceGaps entry.", "metadata.sourceGaps")]),
            ],
            metrics={key: metrics[key] for key in ("status", "metadataStatus", "sourceGapCount")},
        ),
        _check(
            key="source_gap_actionability",
            label="Actionable source gap",
            score=(
                0.35 * (metrics["blockingSourceGapCount"] >= 1)
                + 0.25 * (metrics["suggestedQueryCount"] >= int(spec["minSuggestedQueries"]))
                + 0.25 * (metrics["sourceTypeHintCount"] >= int(spec["minSourceTypeHints"]))
                + 0.15 * (metrics["minimumSourceCount"] > metrics["currentSourceCount"])
            ),
            findings=[
                *([] if metrics["blockingSourceGapCount"] else [_finding("error", "Source gap must be blocking.")]),
                *([] if metrics["suggestedQueryCount"] >= int(spec["minSuggestedQueries"]) else [_finding("error", "Source gap should include suggested queries.")]),
                *([] if metrics["sourceTypeHintCount"] >= int(spec["minSourceTypeHints"]) else [_finding("error", "Source gap should include source type hints.")]),
                *([] if metrics["minimumSourceCount"] > metrics["currentSourceCount"] else [_finding("error", "Source gap should explain the missing source count.")]),
            ],
            metrics={key: metrics[key] for key in ("blockingSourceGapCount", "suggestedQueryCount", "sourceTypeHintCount", "currentSourceCount", "minimumSourceCount")},
        ),
        _check(
            key="planned_empty_outline",
            label="Outline with planned empty section handoffs",
            score=(
                0.25 * (metrics["moduleCount"] >= int(spec["minOutlineModules"]))
                + 0.25 * (metrics["plannedEmptySectionCount"] >= min_planned_sections)
                + 0.25 * (metrics["handoffMetadataSectionCount"] >= min_planned_sections)
                + 0.15 * (metrics["placeholderSectionCount"] == 0)
                + 0.10 * (metrics["contentBearingLessonSectionCount"] == 0)
            ),
            findings=[
                *([] if metrics["moduleCount"] >= int(spec["minOutlineModules"]) else [_finding("error", "Under-sourced prompts should still produce a coherent module outline.", "modules")]),
                *([] if metrics["plannedEmptySectionCount"] >= min_planned_sections else [_finding("error", "Under-sourced drafts should include planned empty lesson sections.")]),
                *([] if metrics["handoffMetadataSectionCount"] >= min_planned_sections else [_finding("error", "Planned lesson sections should include hidden descriptions, outcomes, source needs, and rebuild handoff metadata.")]),
                *([] if metrics["placeholderSectionCount"] == 0 else [_finding("error", "Under-sourced drafts should not repeat source-gap placeholders as lesson content.")]),
                *([] if metrics["contentBearingLessonSectionCount"] == 0 else [_finding("error", "Under-sourced section planning should not write learner-facing lesson content before section fill.")]),
            ],
            metrics={key: metrics[key] for key in ("moduleCount", "plannedEmptySectionCount", "handoffMetadataSectionCount", "contentBearingLessonSectionCount", "placeholderSectionCount", "generationPlanMode")},
        ),
        _specificity_check(text_blob),
    ]
    return _scenario_report(scenario_id=scenario_id, label=spec["label"], kind="course", checks=checks)


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


def _specificity_check(text_blob: str) -> dict[str, Any]:
    hits = []
    for pattern in SCENARIO_PROMPT_FILLER_PATTERNS:
        if pattern.search(text_blob):
            hits.append(pattern.pattern)
    return _check(
        key="specificity",
        label="No prompt-like filler",
        score=1.0 - min(1.0, len(hits) * 0.25),
        findings=[
            _finding("error", f"Prompt-like or placeholder prose detected: {pattern}.")
            for pattern in hits[:6]
        ],
        metrics={"placeholderPatternHitCount": len(hits)},
    )


def _source_mapping_check(metrics: dict[str, Any], spec: dict[str, Any]) -> dict[str, Any]:
    min_slot_count = int(spec.get("minSourceSlotCount") or 0)
    min_slot_primary_coverage = float(spec.get("minSourceSlotPrimaryCoverageRatio") or 0)
    min_section_source_coverage = float(spec.get("minSectionSourceCoverage") or 0)
    min_block_source_coverage = float(spec.get("minBlockSourceCoverage") or 0)
    min_direct_concept_source_coverage = float(spec.get("minDirectConceptSourceCoverage") or min_block_source_coverage)
    min_direct_block_source_coverage = float(spec.get("minDirectBlockSourceCoverage") or min_block_source_coverage)
    slot_score = min(1.0, metrics["sourceSlotCount"] / max(1, min_slot_count))
    primary_score = min(1.0, metrics["sourceSlotPrimaryCoverageRatio"] / max(0.01, min_slot_primary_coverage))
    section_score = min(1.0, metrics["sectionSourceCoverage"] / max(0.01, min_section_source_coverage))
    block_score = min(1.0, metrics["blockSourceCoverage"] / max(0.01, min_block_source_coverage))
    direct_concept_score = min(1.0, metrics["directConceptSourceCoverage"] / max(0.01, min_direct_concept_source_coverage))
    direct_block_score = min(1.0, metrics["directBlockSourceCoverage"] / max(0.01, min_direct_block_source_coverage))
    return _check(
        key="source_mapping",
        label="Concept and block source mapping",
        score=slot_score * 0.2 + primary_score * 0.15 + section_score * 0.15 + block_score * 0.2 + direct_concept_score * 0.15 + direct_block_score * 0.15,
        findings=[
            *([] if metrics["sourceSlotCount"] >= min_slot_count else [_finding("error", f"Expected at least {min_slot_count} source slots.", "metadata.sourceSlots")]),
            *([] if metrics["sourceSlotPrimaryCoverageRatio"] >= min_slot_primary_coverage else [_finding("error", "Every source slot should name a primary source.", "metadata.sourceSlots")]),
            *([] if metrics["sectionSourceCoverage"] >= min_section_source_coverage else [_finding("error", "Sections should carry local sourceIds instead of only course-level sources.")]),
            *([] if metrics["blockSourceCoverage"] >= min_block_source_coverage else [_finding("error", "Instructional and assessment blocks should carry sourceIds for citation grounding.")]),
            *([] if metrics["directConceptSourceCoverage"] >= min_direct_concept_source_coverage else [_finding("error", "Concept cards should carry direct source mappings, not only inherited section sources.")]),
            *([] if metrics["directBlockSourceCoverage"] >= min_direct_block_source_coverage else [_finding("error", "Source-bearing blocks should carry direct source mappings, not only inherited section sources.")]),
        ],
        metrics={
            key: metrics[key]
            for key in ("sourceSlotCount", "sourceSlotPrimaryCoverageRatio", "sectionSourceCoverage", "blockSourceCoverage", "directConceptSourceCoverage", "directBlockSourceCoverage")
        },
    )


def _generation_readiness_check(course: dict[str, Any]) -> dict[str, Any]:
    readiness = _metadata(course).get("generationReadiness")
    if not isinstance(readiness, dict):
        return _check(
            key="generation_readiness",
            label="Generation readiness consistency",
            score=0.0,
            findings=[_finding("error", "Source-backed full course scenario must include metadata.generationReadiness.", "metadata.generationReadiness")],
            metrics={"present": 0},
        )
    coverage = readiness.get("conceptCoverage") if isinstance(readiness.get("conceptCoverage"), dict) else {}
    ratio = coverage.get("coverageRatio")
    minimum = coverage.get("minimumCoverageRatio")
    try:
        coverage_ratio = float(ratio) if ratio is not None else 1.0
        minimum_ratio = float(minimum) if minimum is not None else 0.0
    except (TypeError, ValueError):
        coverage_ratio = 0.0
        minimum_ratio = 0.0
    ready_claimed = bool(readiness.get("ready")) or str(readiness.get("status") or "").lower() == "ready"
    issues = readiness.get("issues") if isinstance(readiness.get("issues"), list) else []
    findings = [
        *([] if ready_claimed else [_finding("error", "Full course scenario still carries a non-ready generation readiness report.", "metadata.generationReadiness")]),
        *([] if coverage_ratio >= minimum_ratio else [_finding("error", "Generation readiness claims ready but concept coverage is below policy.", "metadata.generationReadiness.conceptCoverage")]),
        *([] if not issues else [_finding("error", "Generation readiness still has blocking issues.", "metadata.generationReadiness.issues")]),
    ]
    return _check(
        key="generation_readiness",
        label="Generation readiness consistency",
        score=0.34 * ready_claimed + 0.33 * (coverage_ratio >= minimum_ratio) + 0.33 * (not issues),
        findings=findings,
        metrics={"present": 1, "readyClaimed": int(ready_claimed), "coverageRatio": coverage_ratio, "minimumCoverageRatio": minimum_ratio, "issueCount": len(issues)},
    )


def _publish_quality_check(course: dict[str, Any]) -> dict[str, Any]:
    quality = assess_course_quality(course, gate="publish")
    findings = [_finding("error", message) for message in quality.get("errors", [])[:8]]
    return _check(
        key="publish_quality_gate",
        label="Publish quality gate",
        score=float(quality.get("score") or 0),
        findings=findings,
        metrics={
            "passed": int(bool(quality.get("passed"))),
            "errorCount": len(quality.get("errors", [])),
            "warningCount": len(quality.get("warnings", [])),
            "qualityEvalFailedDimensionCount": quality.get("metrics", {}).get("qualityEvalFailedDimensionCount", 0),
            "workflowFailedGateCount": quality.get("metrics", {}).get("workflowFailedGateCount", 0),
        },
    )


def evaluate_course_generation_scenario(course: dict[str, Any], scenario_id: str) -> dict[str, Any]:
    if scenario_id not in COURSE_SCENARIOS:
        raise ValueError(f"Unknown course generation scenario '{scenario_id}'")
    spec = COURSE_SCENARIOS[scenario_id]
    if spec.get("expectsNeedsSourcesDraft"):
        return _evaluate_needs_sources_scenario(course, scenario_id, spec)
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
            score=min(1.0, metrics["moduleCount"] / spec["minModules"]) * 0.4
            + min(1.0, metrics["learnSectionCount"] / spec["minLearnSections"]) * 0.2
            + metrics["moduleSummaryCoverage"] * 0.4,
            findings=[
                *([] if metrics["moduleCount"] >= spec["minModules"] else [_finding("error", f"Expected at least {spec['minModules']} modules/weeks.", "modules")]),
                *([] if metrics["learnSectionCount"] >= spec["minLearnSections"] else [_finding("error", f"Expected at least {spec['minLearnSections']} Learn sections.")]),
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
        _specificity_check(metrics["textBlob"]),
        _generation_readiness_check(course),
        _publish_quality_check(course),
    ]
    if any(
        key in spec
        for key in (
            "minSourceSlotCount",
            "minSourceSlotPrimaryCoverageRatio",
            "minSectionSourceCoverage",
            "minBlockSourceCoverage",
            "minDirectConceptSourceCoverage",
            "minDirectBlockSourceCoverage",
        )
    ):
        checks.insert(-1, _source_mapping_check(metrics, spec))
    return _scenario_report(scenario_id=scenario_id, label=spec["label"], kind="course", checks=checks)


def evaluate_program_generation_scenario(program_payload: dict[str, Any], scenario_id: str) -> dict[str, Any]:
    from app.program_generation_scenarios import evaluate_program_generation_scenario as _evaluate_program_generation_scenario

    return _evaluate_program_generation_scenario(program_payload, scenario_id)

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
