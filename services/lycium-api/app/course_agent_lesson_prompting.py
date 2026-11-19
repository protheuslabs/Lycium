
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
                    "assessment_instruction": (
                        "Assessment does not always mean quiz. Use quiz blocks for short or longer tests, and use project blocks for projects, labs, simulations, portfolio tasks, or rubric-graded applied evidence. "
                        "Project blocks must live in Apply sections and include instructions, requiredEvidence, rubric.criteria, submission.acceptedTypes, and graderWorkflow metadata."
                    ),
                    "block_selection_rule": (
                        "Default Learn sections should use explanation text, guided practice text, and concept cards. "
                        "Add equation blocks for standalone formulas or symbolic relationships. "
                        "Add workedExample blocks only for quantitative, formal, technical, or procedural problems where learners need repeatable problem/given/find/steps/answer/check work. "
                        "Do not use workedExample blocks for interpretive humanities or social-science analysis, historical causation, literary interpretation, ethics discussion, or source-analysis prompts."
                    ),
                    "optional_quantitative_or_procedural_blocks": [
                        {
                            "type": "equation",
                            "title": "Relationship",
                            "equations": ["target = known relationship"],
                            "notation": "ascii",
                            "caption": "Use readable ASCII math and include units when relevant.",
                        },
                        {
                            "type": "workedExample",
                            "title": "Worked example",
                            "problem": "Solve a concrete quantitative, formal, technical, or procedural problem.",
                            "given": ["Known value, condition, formula, or constraint."],
                            "find": ["Target value, classification, output, or procedure result."],
                            "steps": [
                                {"explanation": "Set up the relationship or procedure.", "equation": "target = known relationship"},
                                {"explanation": "Substitute, simplify, compute, or execute the rule.", "equation": "target = simplified result"},
                            ],
                            "workedAnswer": "Final answer with units or interpretation.",
                            "check": "Check the units, sign, direction, assumption, or practical meaning.",
                        },
                    ],
                    "project_section_shape_when_needed": {
                        "id": f"module-{module_number}-project",
                        "title": "Project: Applied module task",
                        "pageType": "apply",
                        "sectionType": "project",
                        "sourceIds": source_ids,
                        "content": [
                            {
                                "type": "project",
                                "instructions": "Concrete learner-facing project, lab, simulation, or portfolio task.",
                                "requiredEvidence": ["Submission artifact or answer evidence."],
                                "rubric": {
                                    "criteria": [
                                        {"id": "criterion-1", "label": "Criterion", "points": 4, "description": "What strong work demonstrates."}
                                    ]
                                },
                                "submission": {"acceptedTypes": ["text", "link"]},
                                "graderWorkflow": {"mode": "agent", "allowedContext": ["course", "sources", "rubric", "submission"]},
                            }
                        ],
                    },
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
                                    {"type": "text", "heading": "Guided practice", "value": "Learner action prompt, self-check, or evidence-based practice activity."},
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
    source_ids = available_source_ids if available_source_ids is not None else _source_ids_for_input(source_urls)
    has_excerpts = bool(source_context and source_context.get("sources"))
    uses_supplied_sources = bool(has_excerpts or source_ids or source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract('section_fill')}\n\n"
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
                        if uses_supplied_sources else
                        "No source excerpts support this lesson. Teach the established subject matter from your "
                        "own knowledge. Do not invent citations, reference markers, URLs, or source IDs. "
                        "Avoid uncertain claims and label invented scenarios or data as illustrative."
                    ),
                    "section_evidence_rule": (
                        "Treat section_outline as binding when present. Teach all of its required concepts and skills. "
                        "Reference only assigned sources actually used."
                    ),
                    "teaching_rule": (
                        "Explain the ideas and why they work. Include a concrete example, then give the learner "
                        "a related practice task with a way to check their work. Verify computations and answers. "
                        "Write the instruction itself, not learning goals or notes for a future writer."
                    ),
                    "block_selection_rule": (
                        "Choose and combine formats from the available content formats catalog to teach the "
                        "section's outcomes. Follow their use cases, constraints, and example fields. Do not "
                        "force a fixed sequence or include a format just for variety. Use only listed types "
                        "and actual available assets. Keep graded assessment in its separate workflow."
                    ),
                    "content_rule": (
                        "Fill the structural placeholder content array with non-empty instructional blocks. "
                        "The format examples show field shapes, not an ordered lesson template. Replace all "
                        "example values and never copy asset placeholders into the lesson."
                    ),
                    "required_shape": {
                        "id": (lesson_outline or {}).get("id") or f"module-{module_number}-lesson-{lesson_number}",
                        "title": lesson_title,
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": source_ids,
                        "content": [],
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
                f"{load_behavioral_contract('media')}\n\n"
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
