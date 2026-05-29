
from __future__ import annotations

import json

from app.course_agent_prompting import _source_ids_for_input, load_behavioral_contract


def _staged_module_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    pacing_label = "Module"
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for this module. Do not return the whole course. "
                "Every section.content must be an array of typed block objects."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "module_draft",
                    "course": {
                        "title": plan.get("title"),
                        "shortDescription": plan.get("shortDescription"),
                        "scope": plan.get("scope"),
                    },
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "available_source_ids": source_ids,
                    "required_shape": {
                        "id": module_outline.get("id") or f"module-{module_number}",
                        "title": module_outline.get("title") or f"{pacing_label} {module_number}",
                        "sourceIds": source_ids,
                        "sections": [
                            {
                                "id": f"module-{module_number}-lesson-1",
                                "title": "Lesson title",
                                "pageType": "learn",
                                "sectionType": "lesson",
                                "sourceIds": source_ids,
                                "content": [
                                    {"type": "text", "heading": "Explanation", "value": "Direct learner-facing teaching prose."},
                                    {"type": "text", "heading": "Worked example", "value": "Concrete example."},
                                    {"type": "text", "heading": "Practice", "value": "Learner action prompt."},
                                    {
                                        "type": "conceptCards",
                                        "title": "Concepts introduced",
                                        "concepts": [{"name": "Concept", "description": "Concise definition."}],
                                    },
                                ],
                            },
                            {
                                "id": f"module-{module_number}-quiz",
                                "title": "Quiz: Module topic",
                                "pageType": "apply",
                                "sectionType": "assessment",
                                "sourceIds": source_ids,
                                "content": [
                                    {
                                        "type": "quiz",
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
                            {
                                "id": f"module-{module_number}-summary",
                                "title": f"{pacing_label} {module_number} Concept Review",
                                "pageType": "learn",
                                "sectionType": "summary",
                                "sourceIds": source_ids,
                                "content": [
                                    {
                                        "type": "conceptCards",
                                        "title": f"{pacing_label} concepts",
                                        "concepts": "concepts copied from the module Learn pages, with sourceSectionId",
                                    }
                                ],
                            },
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


def _staged_lesson_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    lesson_number: int,
    lesson_title: str,
    source_urls: list[str] | None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for one Learn section. Do not return the module or the whole course. "
                "Every section.content must be an array of typed block objects."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "lesson_draft",
                    "course": {
                        "title": plan.get("title"),
                        "shortDescription": plan.get("shortDescription"),
                        "scope": plan.get("scope"),
                    },
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "lesson_number": lesson_number,
                    "lesson_title": lesson_title,
                    "available_source_ids": source_ids,
                    "required_shape": {
                        "id": f"module-{module_number}-lesson-{lesson_number}",
                        "title": lesson_title,
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": source_ids,
                        "content": [
                            {"type": "text", "heading": "Explanation", "value": "Teach the core idea directly in learner-facing prose."},
                            {"type": "text", "heading": "Worked example", "value": "Show a concrete problem or classification example with reasoning."},
                            {"type": "text", "heading": "Practice", "value": "Give the learner a short action prompt or self-check."},
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "concepts": [{"name": "Specific course concept", "description": "Concise definition."}],
                            },
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]


def _staged_media_messages(
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
                "Return only one JSON object for an optional source-backed media block. "
                "If no reputable source-backed video is available from the provided sources, return available:false with a reason. "
                "Do not invent a video URL."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "media_draft",
                    "course": {"title": plan.get("title"), "scope": plan.get("scope")},
                    "module_number": module_number,
                    "module_outline": module_outline,
                    "lesson_section_titles": [section.get("title") for section in lesson_sections],
                    "available_source_ids": source_ids,
                    "source_urls": source_urls or [],
                    "required_shape": {
                        "available": True,
                        "reason": "Why this video supports the module, or why no video is available.",
                        "block": {
                            "type": "video",
                            "title": "Short video title",
                            "url": "https://source-backed-video-url",
                            "sourceIds": source_ids,
                            "description": "One sentence explaining why this video belongs in the module.",
                        },
                    },
                },
                indent=2,
            ),
        },
    ]
