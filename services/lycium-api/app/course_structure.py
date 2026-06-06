from __future__ import annotations

import re
from typing import Any, Iterator


def items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def modules(course: dict[str, Any]) -> list[dict[str, Any]]:
    return items(course.get("modules"))


def sections(module: dict[str, Any]) -> list[dict[str, Any]]:
    return items(module.get("sections"))


def content_blocks(section: dict[str, Any]) -> list[dict[str, Any]]:
    return items(section.get("content"))


def iter_sections(course: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for module in modules(course):
        yield from sections(module)


def source_ids(value: dict[str, Any]) -> list[str]:
    ids = value.get("sourceIds") or value.get("source_ids") or []
    return [source_id for source_id in ids if isinstance(source_id, str) and source_id.strip()] if isinstance(ids, list) else []


def source_record_ids(course: dict[str, Any]) -> set[str]:
    records = course.get("sourceRecords")
    if isinstance(records, dict):
        return {str(source_id) for source_id in records if source_id}
    if isinstance(records, list):
        return {str(record.get("id")) for record in records if isinstance(record, dict) and record.get("id")}
    return set()


def source_record_count(course: dict[str, Any]) -> int:
    return len(source_record_ids(course))


def is_quiz_block(block: dict[str, Any]) -> bool:
    return block.get("type") == "quiz"


def is_concept_cards_block(block: dict[str, Any]) -> bool:
    return block.get("type") in {"conceptCards", "concept_cards"}


def is_single_concept_card_block(block: dict[str, Any]) -> bool:
    return block.get("type") in {"conceptCard", "concept_card"}


def is_concept_block(block: dict[str, Any]) -> bool:
    return is_concept_cards_block(block) or is_single_concept_card_block(block)


def concept_items(block: dict[str, Any]) -> list[dict[str, Any]]:
    if is_concept_cards_block(block):
        concepts = block.get("concepts")
        return [concept for concept in concepts if isinstance(concept, dict)] if isinstance(concepts, list) else []
    if is_single_concept_card_block(block):
        name = block.get("name") or block.get("title") or block.get("heading")
        description = block.get("description") or block.get("body") or block.get("value") or block.get("text")
        return [
            {
                "name": name,
                "description": description,
                "sourceSectionId": block.get("sourceSectionId"),
                "sourceIds": block.get("sourceIds"),
            }
        ]
    return []


def is_video_block(block: dict[str, Any]) -> bool:
    return block.get("type") == "video"


def is_summary_section(section: dict[str, Any]) -> bool:
    section_type = str(section.get("sectionType") or section.get("section_type") or "").lower()
    title = str(section.get("title") or "").lower()
    return section_type == "summary" or "summary" in title or "concept review" in title


def question_count(block: dict[str, Any]) -> int:
    questions = block.get("questions") or block.get("questionBank") or block.get("question_bank") or []
    return len(questions) if isinstance(questions, list) else 0


def block_text(block: dict[str, Any]) -> str:
    values: list[str] = []
    for key in ("heading", "title", "value", "text", "body", "question", "description"):
        value = block.get(key)
        if isinstance(value, str):
            values.append(value)
    if isinstance(block.get("concepts"), list):
        for concept in block["concepts"]:
            if isinstance(concept, dict):
                values.extend(str(concept.get(key) or "") for key in ("name", "description"))
    if is_single_concept_card_block(block):
        values.extend(str(block.get(key) or "") for key in ("name", "description"))
    if isinstance(block.get("questions"), list):
        for question in block["questions"]:
            if isinstance(question, dict):
                values.append(str(question.get("question") or ""))
    if isinstance(block.get("questionBank"), list):
        for question in block["questionBank"]:
            if isinstance(question, dict):
                values.append(str(question.get("question") or ""))
    return "\n".join(part for part in values if part)


def section_text(section: dict[str, Any]) -> str:
    return "\n".join(block_text(block) for block in content_blocks(section))


def word_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text))
