from __future__ import annotations

import re
from typing import Any

from app.contract_validation import validate_course_schema
from app.course_taxonomy import validate_course_taxonomy
from app.course_structure import concept_items as _concept_items
from app.course_structure import is_concept_block as _is_concept_block
from app.course_structure import is_concept_cards_block as _is_concept_cards_block
from app.course_structure import source_record_ids as _source_record_ids


def _slug(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or fallback


def normalize_course(course: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(course.get("shortDescription"), str) or not course["shortDescription"].strip():
        title = str(course.get("title") or "Generated course").strip()
        course["shortDescription"] = f"A structured Lycium course covering {title}."
    course.setdefault("orderMandatory", False)
    course.setdefault("sourceIds", [])
    course.setdefault("sourceRecords", [])
    course.setdefault("metadata", {})
    course.setdefault("difficultyLevel", str(course["metadata"].get("difficulty") or "Not set"))
    course.setdefault("category", "interdisciplinary-studies")
    if not isinstance(course.get("tags"), list):
        course["tags"] = []
    if not isinstance(course.get("learningTypes"), list):
        course["learningTypes"] = []
    course["metadata"].setdefault("scope", {})
    course["metadata"].setdefault("generationPlan", {})
    if not course["metadata"].get("pacingLabel"):
        module_titles = [str(module.get("title") or "") for module in course.get("modules", []) if isinstance(module, dict)]
        course["metadata"]["pacingLabel"] = "Week" if any(title.startswith("Week ") for title in module_titles) else "Module"

    for module_index, module in enumerate(course.get("modules", []), start=1):
        if not isinstance(module, dict):
            continue
        module.setdefault("id", _slug(str(module.get("title") or ""), f"module-{module_index}"))
        module.setdefault("sourceIds", course.get("sourceIds", []))
        for section_index, section in enumerate(module.get("sections", []), start=1):
            if not isinstance(section, dict):
                continue
            section.setdefault("id", _slug(str(section.get("title") or ""), f"{module['id']}-section-{section_index}"))
            section.setdefault("sourceIds", module.get("sourceIds", []))
            content = section.get("content", [])
            if isinstance(content, str) and content.strip():
                section["content"] = [{"type": "text", "value": content.strip(), "sourceIds": section.get("sourceIds", [])}]
                content = section["content"]
            elif isinstance(content, list) and content and all(
                isinstance(item, dict) and not item.get("type") and item.get("name") and item.get("description")
                for item in content
            ):
                pacing_label = course["metadata"].get("pacingLabel") if isinstance(course.get("metadata"), dict) else "Module"
                is_summary = str(section.get("sectionType") or "").lower() == "summary" or "concept" in str(section.get("title") or "").lower()
                section["content"] = [
                    {
                        "type": "heading",
                        "title": f"{pacing_label} concepts" if is_summary else "Concepts introduced",
                        "sourceIds": section.get("sourceIds", []),
                    }
                ]
                section["content"].extend(
                    {
                        "type": "conceptCard",
                        "title": str(item.get("name") or "Concept"),
                        "description": str(item.get("description") or ""),
                        "sourceSectionId": item.get("sourceSectionId"),
                        "sourceIds": section.get("sourceIds", []),
                    }
                    for item in content
                    if isinstance(item, dict)
                )
                content = section["content"]
            contains_quiz = any(isinstance(block, dict) and block.get("type") == "quiz" for block in content)
            if contains_quiz:
                section.setdefault("pageType", "apply")
                section.setdefault("sectionType", "assessment")
            else:
                section.setdefault("pageType", "learn")
                section.setdefault("sectionType", "lesson")
    return course


def _validate_concept_block(block: dict[str, Any], errors: list[str], location: str) -> None:
    concepts = _concept_items(block)
    if not concepts:
        errors.append(f"{location} concept block must include at least one concept.")
        return

    for concept_index, concept in enumerate(concepts, start=1):
        if not isinstance(concept, dict):
            errors.append(f"{location} concept {concept_index} must be an object.")
            continue
        if not concept.get("name"):
            errors.append(f"{location} concept {concept_index} is missing name.")
        if not concept.get("description"):
            errors.append(f"{location} concept {concept_index} is missing description.")


def _is_needs_sources_course(course: dict[str, Any]) -> bool:
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    readiness = metadata.get("generationReadiness") if isinstance(metadata.get("generationReadiness"), dict) else {}
    statuses = {
        str(course.get("status") or "").strip(),
        str(metadata.get("status") or "").strip(),
        str(readiness.get("status") or "").strip(),
    }
    return "needs_sources" in statuses


def _declared_source_ids(course: dict[str, Any], errors: list[str]) -> set[str]:
    declared_source_ids = _source_record_ids(course)
    if not declared_source_ids and not _is_needs_sources_course(course):
        errors.append("Course must include sourceRecords with at least one source.")
    return declared_source_ids


def validate_course_contract(course: dict[str, Any]) -> list[str]:
    errors: list[str] = validate_course_schema(course)
    if not isinstance(course.get("title"), str) or not course["title"].strip():
        errors.append("Course is missing title.")
    if not isinstance(course.get("shortDescription"), str) or not course["shortDescription"].strip():
        errors.append("Course is missing shortDescription.")
    errors.extend(validate_course_taxonomy(course))

    modules = course.get("modules")
    if not isinstance(modules, list) or not modules:
        errors.append("Course must include at least one module.")
        return errors

    pacing_label = course.get("metadata", {}).get("pacingLabel")
    if pacing_label not in {"Module", "Week"}:
        errors.append("Course metadata.pacingLabel must be Module or Week.")
        pacing_label = "Module"

    declared_source_ids = _declared_source_ids(course, errors)
    referenced_source_ids: set[str] = set(str(source_id) for source_id in course.get("sourceIds", []) if source_id)
    other_label = "Week" if pacing_label == "Module" else "Module"

    for module_index, module in enumerate(modules, start=1):
        location = f"module {module_index}"
        if not isinstance(module, dict):
            errors.append(f"{location} must be an object.")
            continue
        _validate_module(module, location, pacing_label, other_label, referenced_source_ids, errors)

    if referenced_source_ids and declared_source_ids:
        missing_sources = sorted(referenced_source_ids - declared_source_ids)
        if missing_sources:
            errors.append(f"Referenced sourceIds are missing from sourceRecords: {', '.join(missing_sources[:10])}.")
    elif referenced_source_ids:
        errors.append("Course references sourceIds but does not include sourceRecords.")

    return errors


def _validate_module(
    module: dict[str, Any],
    location: str,
    pacing_label: str,
    other_label: str,
    referenced_source_ids: set[str],
    errors: list[str],
) -> None:
    if not module.get("id"):
        errors.append(f"{location} is missing id.")
    if not module.get("title"):
        errors.append(f"{location} is missing title.")
    if str(module.get("title") or "").startswith(f"{other_label} "):
        errors.append(f"{location} title mixes {other_label} with course pacing label {pacing_label}.")
    referenced_source_ids.update(str(source_id) for source_id in module.get("sourceIds", []) if source_id)

    sections = module.get("sections")
    if not isinstance(sections, list) or not sections:
        errors.append(f"{location} must include sections.")
        return
    if not isinstance(sections[-1], dict) or sections[-1].get("sectionType") != "summary":
        errors.append(f"{location} must end with a summary section.")

    for section_index, section in enumerate(sections, start=1):
        _validate_section(section, f"{location} section {section_index}", pacing_label, other_label, referenced_source_ids, errors)


def _validate_section(
    section: Any,
    section_location: str,
    pacing_label: str,
    other_label: str,
    referenced_source_ids: set[str],
    errors: list[str],
) -> None:
    if not isinstance(section, dict):
        errors.append(f"{section_location} must be an object.")
        return
    if section.get("pageType") not in {"learn", "apply"}:
        errors.append(f"{section_location} must set pageType to learn or apply.")
    if section.get("sectionType") == "summary" and str(section.get("title") or "").startswith(f"{other_label} Summary"):
        errors.append(f"{section_location} summary title mixes {other_label} with course pacing label {pacing_label}.")
    if not isinstance(section.get("content"), list) or not section["content"]:
        errors.append(f"{section_location} must include content blocks.")
        return

    referenced_source_ids.update(str(source_id) for source_id in section.get("sourceIds", []) if source_id)
    content = section["content"]
    quiz_blocks = [block for block in content if isinstance(block, dict) and block.get("type") == "quiz"]
    concept_blocks = [block for block in content if isinstance(block, dict) and _is_concept_block(block)]
    for block in content:
        if isinstance(block, dict):
            referenced_source_ids.update(str(source_id) for source_id in block.get("sourceIds", []) if source_id)

    if quiz_blocks:
        _validate_quiz_section(section, quiz_blocks, content, section_location, errors)
    elif section.get("sectionType") == "summary":
        expected_summary_title = f"{pacing_label} concepts"
        if section.get("pageType") != "learn":
            errors.append(f"{section_location} summary must be a learn page.")
        if not concept_blocks:
            errors.append(f"{section_location} summary must include editable conceptCard blocks.")
        if _uses_editable_concept_cards(content) and not _has_heading(content, expected_summary_title):
            errors.append(f"{section_location} summary must include a heading block titled {expected_summary_title}.")
        legacy_stacks = [block for block in concept_blocks if _is_concept_cards_block(block)]
        if legacy_stacks and (len(legacy_stacks) != 1 or legacy_stacks[0].get("title") != expected_summary_title):
            errors.append(f"{section_location} legacy summary conceptCards block must be titled {expected_summary_title}.")
        for concept_block in concept_blocks:
            _validate_concept_block(concept_block, errors, section_location)
    elif section.get("pageType") == "learn":
        if not concept_blocks:
            errors.append(f"{section_location} learn page must include editable conceptCard blocks.")
        if _uses_editable_concept_cards(content) and not _has_heading(content, "Concepts introduced"):
            errors.append(f"{section_location} learn page must include a Concepts introduced heading before concept cards.")
        legacy_stacks = [block for block in concept_blocks if _is_concept_cards_block(block)]
        if legacy_stacks and legacy_stacks[-1].get("title") != "Concepts introduced":
            errors.append(f"{section_location} legacy learn page conceptCards title must be Concepts introduced.")
        for concept_block in concept_blocks:
            _validate_concept_block(concept_block, errors, section_location)


def _has_heading(content: list[Any], title: str) -> bool:
    return any(
        isinstance(block, dict)
        and block.get("type") == "heading"
        and str(block.get("title") or block.get("heading") or "").strip().lower() == title.lower()
        for block in content
    )


def _uses_editable_concept_cards(content: list[Any]) -> bool:
    return any(isinstance(block, dict) and block.get("type") in {"conceptCard", "concept_card"} for block in content)


def _validate_quiz_section(
    section: dict[str, Any],
    quiz_blocks: list[dict[str, Any]],
    content: list[Any],
    section_location: str,
    errors: list[str],
) -> None:
    if section.get("pageType") != "apply" or section.get("sectionType") != "assessment":
        errors.append(f"{section_location} quiz sections must be assessment apply pages.")
    if len(quiz_blocks) != len(content):
        errors.append(f"{section_location} mixes quiz blocks with non-quiz content.")
    for quiz_index, quiz in enumerate(quiz_blocks, start=1):
        questions = quiz.get("questions") or quiz.get("questionBank") or []
        if not isinstance(questions, list) or not questions:
            errors.append(f"{section_location} quiz {quiz_index} must include questions.")
        for question_index, question in enumerate(questions, start=1):
            if not isinstance(question, dict):
                errors.append(f"{section_location} question {question_index} must be an object.")
                continue
            if not isinstance(question.get("answers"), list):
                errors.append(f"{section_location} question {question_index} must use answers array.")
