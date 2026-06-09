from __future__ import annotations

import re
from typing import Any, Literal

from app.course_generation_scenario_specs import COURSE_SCENARIOS, PROGRAM_SCENARIOS
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


def _source_gap_metrics(course: dict[str, Any]) -> dict[str, Any]:
    metadata = _metadata(course)
    source_gaps = _items(metadata.get("sourceGaps"))
    first_gap = source_gaps[0] if source_gaps else {}
    generation_plan = metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {}
    modules = _items(course.get("modules"))
    sections = [section for module in modules for section in _items(module.get("sections"))]
    planning_sections = [
        section
        for section in sections
        if section.get("sectionType") == "source-gap" or "source" in _normalize(_text(section.get("title")))
    ]
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
        "planningSectionCount": len(planning_sections),
        "sourceRecordCount": source_record_count,
    }


def _evaluate_needs_sources_scenario(course: dict[str, Any], scenario_id: str, spec: dict[str, Any]) -> dict[str, Any]:
    metrics = _source_gap_metrics(course)
    text_blob = _course_metrics(course)["textBlob"]
    expected_status = spec.get("expectedStatus", "needs_sources")
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
            key="no_hollow_course",
            label="No hollow generated course",
            score=(
                0.4 * (metrics["moduleCount"] <= int(spec["maxPlanningModules"]))
                + 0.3 * (metrics["planningSectionCount"] >= 1)
                + 0.3 * (metrics["sourceRecordCount"] <= int(spec["maxSourceRecords"]))
            ),
            findings=[
                *([] if metrics["moduleCount"] <= int(spec["maxPlanningModules"]) else [_finding("error", "Under-sourced prompts should not produce a full course module set.", "modules")]),
                *([] if metrics["planningSectionCount"] else [_finding("error", "Under-sourced drafts should show a source-planning section.")]),
                *([] if metrics["sourceRecordCount"] <= int(spec["maxSourceRecords"]) else [_finding("error", "Scenario draft appears to have enough sources but is still source-gated.")]),
            ],
            metrics={key: metrics[key] for key in ("moduleCount", "planningSectionCount", "sourceRecordCount", "generationPlanMode")},
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
