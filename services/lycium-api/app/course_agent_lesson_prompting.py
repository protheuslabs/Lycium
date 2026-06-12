
from __future__ import annotations

import json

from app.course_agent_prompting import _source_ids_for_input, load_behavioral_contract


def _staged_module_messages(
    *,
    plan: dict,
    module_outline: dict,
    module_number: int,
    source_urls: list[str] | None,
    source_context: dict | None = None,
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
                    "source_context": source_context or {},
                    "source_context_rule": (
                        "Use source_context.sources as the bounded source evidence for this stage. "
                        "Do not assume omitted parts of uploaded files are available to the learner-facing draft."
                    ),
                    "inline_citation_instruction": (
                        "When a text block makes a source-backed claim, you may add [1], [2], etc. after the sentence. "
                        "Those numbers are 1-based indexes into the course-wide source inventory; this section will render only its locally used sources sorted by that course-wide number. "
                        "Do not cite sources that are not assigned to the section."
                    ),
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
                                        "type": "heading",
                                        "title": "Concepts introduced",
                                    },
                                    {"type": "conceptCard", "title": "Concept", "description": "Concise definition."},
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
                                    {"type": "heading", "title": f"{pacing_label} concepts"},
                                    {
                                        "type": "conceptCard",
                                        "title": "Concept title copied from module Learn pages",
                                        "description": "Concise definition copied from module Learn pages",
                                        "sourceSectionId": "source section id",
                                    },
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
    source_urls: list[str] | None = None,
    lesson_outline: dict | None = None,
    available_source_ids: list[str] | None = None,
    source_context: dict | None = None,
) -> list[dict[str, str]]:
    source_ids = available_source_ids or _source_ids_for_input(source_urls)
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
                    "section_outline": lesson_outline or {},
                    "lesson_number": lesson_number,
                    "lesson_title": lesson_title,
                    "available_source_ids": source_ids,
                    "source_context": source_context or {},
                    "source_context_rule": (
                        "Use only these bounded excerpts as source evidence for this section. "
                        "If the excerpts do not support a claim, avoid the claim or frame it as a source gap."
                    ),
                    "section_evidence_rule": (
                        "Treat section_outline as binding when present. Teach section_outline.concept_keywords, "
                        "preserve section_outline.sourceIds as the section sourceIds, and only use inline citation markers for those assigned sources."
                    ),
                    "required_shape": {
                        "id": (lesson_outline or {}).get("id") or f"module-{module_number}-lesson-{lesson_number}",
                        "title": lesson_title,
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": source_ids,
                        "content": [
                            {"type": "text", "heading": "Explanation", "value": "Teach the core idea directly in learner-facing prose. Add [1] when the sentence is grounded in the first local source."},
                            {"type": "text", "heading": "Worked example", "value": "Show a concrete problem or classification example with reasoning. Use inline citation markers only when they resolve to course-wide source index entries also connected to this section or block through sourceIds."},
                            {"type": "text", "heading": "Practice", "value": "Give the learner a short action prompt or self-check."},
                            {
                                "type": "heading",
                                "title": "Concepts introduced",
                            },
                            {"type": "conceptCard", "title": "Specific course concept", "description": "Concise definition."},
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
    source_urls: list[str] | None = None,
    available_source_ids: list[str] | None = None,
    source_context: dict | None = None,
) -> list[dict[str, str]]:
    source_ids = available_source_ids or _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one JSON object for an optional source-backed media block. "
                "If no reputable source-backed video is available from the provided sources, return available:false with a reason. "
                "Do not invent a video URL. If only part of a video is relevant, add block.clip.startSeconds and block.clip.endSeconds as integer seconds."
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
                    "source_context": source_context or {},
                    "source_context_rule": (
                        "Use source_context only to decide whether a source-backed media candidate is available. "
                        "Do not invent a video or media URL from an uploaded document excerpt."
                    ),
                    "source_urls": source_urls or [],
                    "required_shape": {
                        "available": True,
                        "reason": "Why this video supports the module, or why no video is available.",
                        "block": {
                            "type": "video",
                            "url": "https://source-backed-video-url",
                            "sourceIds": source_ids,
                            "clip": {"startSeconds": 0, "endSeconds": 300},
                        },
                    },
                },
                indent=2,
            ),
        },
    ]
