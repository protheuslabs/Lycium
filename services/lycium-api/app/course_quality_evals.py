from __future__ import annotations

import re
from typing import Any, Literal


EvalSeverity = Literal["warning", "error"]

GENERIC_CONTENT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bthe model should\b",
        r"\bthe agent should\b",
        r"\bwrite (?:a|the) lesson\b",
        r"\bgenerate (?:instructional )?content\b",
        r"\bcontent goes here\b",
        r"\btodo\b",
        r"\bplaceholder\b",
        r"\blearners? (?:define|study|will learn|connect|practice explaining)\b",
        r"\bstudents? should\b",
        r"\bthis lesson supports the module objective\b",
        r"\bworking model studies\b",
    ]
]


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _modules(course: dict[str, Any]) -> list[dict[str, Any]]:
    return _items(course.get("modules"))


def _sections(module: dict[str, Any]) -> list[dict[str, Any]]:
    return _items(module.get("sections"))


def _content(section: dict[str, Any]) -> list[dict[str, Any]]:
    return _items(section.get("content"))


def _is_quiz(block: dict[str, Any]) -> bool:
    return block.get("type") == "quiz"


def _is_concept_cards(block: dict[str, Any]) -> bool:
    return block.get("type") in {"conceptCards", "concept_cards"}


def _is_video(block: dict[str, Any]) -> bool:
    return block.get("type") == "video"


def _is_summary(section: dict[str, Any]) -> bool:
    section_type = str(section.get("sectionType") or section.get("section_type") or "").lower()
    title = str(section.get("title") or "").lower()
    return section_type == "summary" or "concept review" in title or "summary" in title


def _source_ids(value: dict[str, Any]) -> list[str]:
    ids = value.get("sourceIds") or value.get("source_ids") or []
    return [source_id for source_id in ids if isinstance(source_id, str) and source_id.strip()] if isinstance(ids, list) else []


def _block_text(block: dict[str, Any]) -> str:
    values: list[str] = []
    for key in ("heading", "title", "value", "text", "body", "question", "description"):
        value = block.get(key)
        if isinstance(value, str):
            values.append(value)
    if isinstance(block.get("concepts"), list):
        for concept in block["concepts"]:
            if isinstance(concept, dict):
                values.extend(str(concept.get(key) or "") for key in ("name", "description"))
    if isinstance(block.get("questions"), list):
        for question in block["questions"]:
            if isinstance(question, dict):
                values.append(str(question.get("question") or ""))
    return "\n".join(part for part in values if part)


def _section_text(section: dict[str, Any]) -> str:
    return "\n".join(_block_text(block) for block in _content(section))


def _word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text))


def _finding(severity: EvalSeverity, message: str, location: str | None = None) -> dict[str, str]:
    payload = {"severity": severity, "message": message}
    if location:
        payload["location"] = location
    return payload


def _dimension(
    *,
    key: str,
    label: str,
    weight: float,
    score: float,
    findings: list[dict[str, str]],
    metrics: dict[str, int | float],
) -> dict[str, Any]:
    clipped = round(max(0.0, min(1.0, score)), 2)
    if any(finding["severity"] == "error" for finding in findings) or clipped < 0.55:
        status = "failed"
    elif findings or clipped < 0.85:
        status = "needs_review"
    else:
        status = "passed"

    return {
        "key": key,
        "label": label,
        "weight": weight,
        "score": clipped,
        "status": status,
        "findings": findings,
        "metrics": metrics,
    }


def _source_record_ids(course: dict[str, Any]) -> set[str]:
    records = course.get("sourceRecords")
    if isinstance(records, dict):
        return {str(source_id) for source_id in records if source_id}
    if isinstance(records, list):
        return {str(record.get("id")) for record in records if isinstance(record, dict) and record.get("id")}
    return set()


def _eval_structure(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    modules = _modules(course)
    section_count = 0
    for module_index, module in enumerate(modules, start=1):
        sections = _sections(module)
        section_count += len(sections)
        if len(sections) < 3:
            findings.append(_finding("warning", "Module has fewer than three sections.", f"modules[{module_index}]"))
        if sections and not _is_summary(sections[-1]):
            findings.append(_finding("error", "Module does not end with a summary/concept review section.", f"modules[{module_index}]"))
    if not modules:
        findings.append(_finding("error", "Course has no modules.", "modules"))

    module_score = min(1.0, len(modules) / 3) if modules else 0.0
    section_score = min(1.0, section_count / max(1, len(modules) * 3)) if modules else 0.0
    score = (module_score * 0.45) + (section_score * 0.35) + (0.2 if not any(f["severity"] == "error" for f in findings) else 0)
    return _dimension(key="structure", label="Course structure", weight=0.16, score=score, findings=findings, metrics={"moduleCount": len(modules), "sectionCount": section_count})


def _eval_instructional_substance(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    learn_sections: list[dict[str, Any]] = []
    example_sections = 0
    practice_sections = 0
    word_counts: list[int] = []

    for module_index, module in enumerate(_modules(course), start=1):
        for section_index, section in enumerate(_sections(module), start=1):
            if section.get("pageType") != "learn" or _is_summary(section):
                continue
            learn_sections.append(section)
            location = f"modules[{module_index}].sections[{section_index}]"
            blocks = _content(section)
            text = _section_text(section)
            words = _word_count(text)
            word_counts.append(words)
            headings = " ".join(str(block.get("heading") or block.get("title") or "").lower() for block in blocks)
            if words < 90:
                findings.append(_finding("warning", "Learn section is thin; add fuller explanation, worked example, or practice.", location))
            if "example" in headings:
                example_sections += 1
            if "practice" in headings or "exercise" in headings or "studio" in headings:
                practice_sections += 1

    average_words = sum(word_counts) / len(word_counts) if word_counts else 0
    example_ratio = example_sections / len(learn_sections) if learn_sections else 0
    practice_ratio = practice_sections / len(learn_sections) if learn_sections else 0
    score = min(1.0, average_words / 180) * 0.5 + example_ratio * 0.25 + practice_ratio * 0.25
    if not learn_sections:
        findings.append(_finding("error", "Course has no instructional Learn sections."))
    return _dimension(
        key="instructional_substance",
        label="Instructional substance",
        weight=0.2,
        score=score,
        findings=findings,
        metrics={"learnSectionCount": len(learn_sections), "averageLearnWords": round(average_words, 1), "exampleSectionRatio": round(example_ratio, 2), "practiceSectionRatio": round(practice_ratio, 2)},
    )


def _eval_assessment(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    module_count = len(_modules(course))
    quiz_count = 0
    total_questions = 0
    valid_questions = 0

    for module_index, module in enumerate(_modules(course), start=1):
        module_quiz_count = 0
        for section_index, section in enumerate(_sections(module), start=1):
            blocks = _content(section)
            quiz_blocks = [block for block in blocks if _is_quiz(block)]
            if quiz_blocks and len(quiz_blocks) != len(blocks):
                findings.append(_finding("error", "Quiz section mixes assessment and instructional content.", f"modules[{module_index}].sections[{section_index}]"))
            for block_index, quiz in enumerate(quiz_blocks, start=1):
                quiz_count += 1
                module_quiz_count += 1
                questions = quiz.get("questions") or quiz.get("questionBank") or []
                if not isinstance(questions, list):
                    findings.append(_finding("error", "Quiz block questions must be a list.", f"modules[{module_index}].sections[{section_index}].content[{block_index}]"))
                    continue
                if len(questions) < 10:
                    findings.append(_finding("warning", "Quiz has fewer than 10 questions.", f"modules[{module_index}].sections[{section_index}].content[{block_index}]"))
                total_questions += len(questions)
                for question_index, question in enumerate(questions, start=1):
                    if not isinstance(question, dict):
                        continue
                    options = question.get("options")
                    answers = question.get("answers")
                    valid_answer_indexes = (
                        isinstance(options, list)
                        and len(options) >= 2
                        and len(set(str(option) for option in options)) == len(options)
                        and isinstance(answers, list)
                        and all(isinstance(answer, int) and 0 <= answer < len(options) for answer in answers)
                    )
                    if question.get("question") and valid_answer_indexes:
                        valid_questions += 1
                    else:
                        findings.append(_finding("error", "Quiz question is missing text, unique options, or valid answer indexes.", f"modules[{module_index}].sections[{section_index}].questions[{question_index}]"))
        if module_quiz_count == 0:
            findings.append(_finding("warning", "Module has no quiz assessment.", f"modules[{module_index}]"))

    quiz_coverage = quiz_count / module_count if module_count else 0
    valid_ratio = valid_questions / total_questions if total_questions else 0
    ten_question_ratio = min(1.0, total_questions / max(1, quiz_count * 10)) if quiz_count else 0
    score = min(1.0, quiz_coverage) * 0.35 + valid_ratio * 0.4 + ten_question_ratio * 0.25
    return _dimension(key="assessment", label="Assessment quality", weight=0.18, score=score, findings=findings, metrics={"quizCount": quiz_count, "questionCount": total_questions, "validQuestionRatio": round(valid_ratio, 2)})


def _eval_concepts(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    learn_count = 0
    learn_with_cards = 0
    concept_count = 0
    summary_concepts = 0

    for module_index, module in enumerate(_modules(course), start=1):
        for section_index, section in enumerate(_sections(module), start=1):
            blocks = _content(section)
            cards = [block for block in blocks if _is_concept_cards(block)]
            location = f"modules[{module_index}].sections[{section_index}]"
            if section.get("pageType") == "learn" and not _is_summary(section):
                learn_count += 1
                if cards:
                    learn_with_cards += 1
                else:
                    findings.append(_finding("warning", "Learn section has no conceptCards block.", location))
            for card in cards:
                concepts = card.get("concepts")
                if not isinstance(concepts, list) or not concepts:
                    findings.append(_finding("error", "conceptCards block has no concepts.", location))
                    continue
                concept_count += len(concepts)
                for concept_index, concept in enumerate(concepts, start=1):
                    if not isinstance(concept, dict) or not str(concept.get("name") or "").strip() or not str(concept.get("description") or "").strip():
                        findings.append(_finding("error", "Concept is missing a name or description.", f"{location}.concepts[{concept_index}]"))
                    if _is_summary(section):
                        summary_concepts += 1
                        if not str(concept.get("sourceSectionId") or "").strip():
                            findings.append(_finding("warning", "Summary concept should preserve sourceSectionId.", f"{location}.concepts[{concept_index}]"))

    card_ratio = learn_with_cards / learn_count if learn_count else 0
    concept_density = min(1.0, concept_count / max(1, learn_count * 2))
    summary_ratio = min(1.0, summary_concepts / max(1, len(_modules(course)) * 4))
    score = card_ratio * 0.45 + concept_density * 0.3 + summary_ratio * 0.25
    return _dimension(key="concepts", label="Concept-card integrity", weight=0.14, score=score, findings=findings, metrics={"conceptCount": concept_count, "learnConceptCardRatio": round(card_ratio, 2), "summaryConceptCount": summary_concepts})


def _eval_sources(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    declared = _source_record_ids(course)
    referenced: set[str] = set(_source_ids(course))
    sourced_sections = 0
    section_count = 0
    for module in _modules(course):
        referenced.update(_source_ids(module))
        for section in _sections(module):
            section_count += 1
            section_ids = set(_source_ids(section))
            if section_ids:
                sourced_sections += 1
            referenced.update(section_ids)
            for block in _content(section):
                referenced.update(_source_ids(block))

    if not declared:
        findings.append(_finding("error", "Course includes no sourceRecords."))
    if not referenced:
        findings.append(_finding("warning", "Course includes no sourceIds references."))
    missing = sorted(referenced - declared)
    if missing and declared:
        findings.append(_finding("error", f"Referenced sourceIds are missing sourceRecords: {', '.join(missing[:10])}."))
    source_ratio = sourced_sections / section_count if section_count else 0
    diversity_score = min(1.0, len(declared) / 3)
    score = source_ratio * 0.45 + diversity_score * 0.4 + (0.15 if not missing else 0)
    return _dimension(key="source_grounding", label="Source grounding", weight=0.16, score=score, findings=findings, metrics={"sourceRecordCount": len(declared), "referencedSourceIdCount": len(referenced), "sourcedSectionRatio": round(source_ratio, 2)})


def _eval_media(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    module_count = len(_modules(course))
    video_count = 0
    for module_index, module in enumerate(_modules(course), start=1):
        module_videos = sum(1 for section in _sections(module) for block in _content(section) if _is_video(block))
        video_count += module_videos
        if module_videos == 0:
            findings.append(_finding("warning", "Module has no video block; acceptable only if no reputable video source is available.", f"modules[{module_index}]"))
    coverage = video_count / module_count if module_count else 0
    score = 0.72 + min(0.28, coverage * 0.28)
    return _dimension(key="media", label="Media support", weight=0.06, score=score, findings=findings, metrics={"videoCount": video_count, "moduleVideoCoverage": round(coverage, 2)})


def _eval_specificity(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    text = "\n".join(_section_text(section) for module in _modules(course) for section in _sections(module))
    placeholder_hits = 0
    for pattern in GENERIC_CONTENT_PATTERNS:
        matches = pattern.findall(text)
        placeholder_hits += len(matches)
        if matches:
            findings.append(_finding("error", f"Prompt-like or placeholder prose detected: {pattern.pattern}"))
    repeated_titles = 0
    seen_titles: set[str] = set()
    for module in _modules(course):
        for section in _sections(module):
            title = str(section.get("title") or "").strip().lower()
            if not title:
                continue
            if title in seen_titles:
                repeated_titles += 1
            seen_titles.add(title)
    if repeated_titles:
        findings.append(_finding("warning", "Repeated section titles may indicate template-like course content."))
    score = 1.0 - min(0.85, placeholder_hits * 0.2 + repeated_titles * 0.03)
    return _dimension(key="specificity", label="Course specificity", weight=0.1, score=score, findings=findings, metrics={"placeholderHitCount": placeholder_hits, "repeatedSectionTitleCount": repeated_titles})


def run_course_quality_evals(course: dict[str, Any]) -> dict[str, Any]:
    dimensions = [
        _eval_structure(course),
        _eval_instructional_substance(course),
        _eval_assessment(course),
        _eval_concepts(course),
        _eval_sources(course),
        _eval_media(course),
        _eval_specificity(course),
    ]
    total_weight = sum(float(dimension["weight"]) for dimension in dimensions) or 1.0
    overall_score = round(
        sum(float(dimension["score"]) * float(dimension["weight"]) for dimension in dimensions) / total_weight,
        2,
    )
    failed_count = sum(1 for dimension in dimensions if dimension["status"] == "failed")
    needs_review_count = sum(1 for dimension in dimensions if dimension["status"] == "needs_review")
    status = "failed" if failed_count else "needs_review" if needs_review_count else "passed"
    recommendations = [
        f"{dimension['label']}: {finding['message']}"
        for dimension in dimensions
        for finding in dimension["findings"]
        if finding["severity"] in {"error", "warning"}
    ][:12]

    return {
        "evalVersion": "course-quality-evals-v1",
        "status": status,
        "overallScore": overall_score,
        "dimensions": dimensions,
        "recommendations": recommendations,
        "metrics": {
            "dimensionCount": len(dimensions),
            "failedDimensionCount": failed_count,
            "needsReviewDimensionCount": needs_review_count,
        },
    }
