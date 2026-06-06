
from __future__ import annotations

import json

from app.course_agent_prompting import _source_ids_for_input, load_behavioral_contract


def _concepts_from_sections(sections: list[dict]) -> list[dict[str, str]]:
    concepts: list[dict[str, str]] = []
    for section in sections:
        section_id = str(section.get("id") or "")
        content = section.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") in {"conceptCard", "concept_card"}:
                name = str(block.get("name") or block.get("title") or block.get("heading") or "").strip()
                description = str(block.get("description") or block.get("body") or block.get("value") or block.get("text") or "").strip()
                if name and description:
                    concepts.append({"name": name, "description": description, "sourceSectionId": section_id})
                continue
            if block.get("type") not in {"conceptCards", "concept_cards"}:
                continue
            raw_concepts = block.get("concepts")
            if not isinstance(raw_concepts, list):
                continue
            for concept in raw_concepts:
                if not isinstance(concept, dict):
                    continue
                name = str(concept.get("name") or "").strip()
                description = str(concept.get("description") or "").strip()
                if name and description:
                    concepts.append({"name": name, "description": description, "sourceSectionId": section_id})
    return concepts


def _staged_quiz_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    lesson_sections: list[dict],
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for one Apply quiz section. Do not include instructional prose outside the quiz block."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "quiz_draft",
                    "course": {"title": plan.get("title"), "scope": plan.get("scope")},
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "lesson_section_titles": [section.get("title") for section in lesson_sections],
                    "concepts_to_assess": _concepts_from_sections(lesson_sections),
                    "available_source_ids": source_ids,
                    "minimum_question_count": 10,
                    "required_shape": {
                        "id": f"module-{module_number}-quiz",
                        "title": f"Quiz: {module_outline.get('title') or f'Module {module_number}'}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": source_ids,
                        "content": [
                            {
                                "type": "quiz",
                                "question_count_rule": "Include at least 10 questions. More questions are acceptable for a real quiz.",
                                "questions": [
                                    {
                                        "id": "q1",
                                        "question": "Question text",
                                        "options": ["Correct option", "Distractor", "Distractor", "Distractor"],
                                        "answers": [0],
                                    }
                                ],
                                "maxAttempts": "",
                                "timeLimitSeconds": "",
                                "passPercentage": 70,
                            }
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


def _staged_summary_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    lesson_sections: list[dict],
    source_urls: list[str] | None,
    pacing_label: str = "Module",
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for one module summary section. The summary is a concept-card inventory, not a prose recap."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "summary_draft",
                    "course": {"title": plan.get("title"), "scope": plan.get("scope")},
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "concepts_to_include": _concepts_from_sections(lesson_sections),
                    "available_source_ids": source_ids,
                    "required_shape": {
                        "id": f"module-{module_number}-summary",
                        "title": f"{pacing_label} {module_number} Concept Review",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": source_ids,
                        "content": [
                            {"type": "heading", "title": f"{pacing_label} concepts"},
                            {
                                "type": "conceptCard",
                                "title": "Concept title copied from concepts_to_include",
                                "description": "Concise definition copied from concepts_to_include",
                                "sourceSectionId": "preserve sourceSectionId from concepts_to_include",
                            },
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]
