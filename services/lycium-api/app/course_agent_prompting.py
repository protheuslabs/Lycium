
from __future__ import annotations

import json
from pathlib import Path

CONTRACT_PATH = Path(__file__).resolve().parents[3] / "COURSE_AGENT_CONTRACT.md"


def load_behavioral_contract() -> str:
    return CONTRACT_PATH.read_text(encoding="utf-8")


def _llm_messages(
    *,
    prompt: str,
    level: str | None,
    language: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_policy: str,
    category: str | None = None,
    department: str | None = None,
    source_urls: list[str] | None = None,
    benchmark_context: dict | None = None,
) -> list[dict[str, str]]:
    user_contract = {
        "prompt": prompt,
        "level": level,
        "language": language,
        "category": category,
        "department": department,
        "desired_module_count": desired_module_count,
        "expected_duration_minutes": expected_duration_minutes,
        "source_policy": source_policy,
        "source_urls": source_urls or [],
        "curriculum_benchmark_context": benchmark_context or {},
        "curriculum_benchmark_rule": (
            "Use curriculum_benchmark_context as the requirement skeleton when present. "
            "Required topics must appear in module objectives, concept cards, assessments, and source mappings. "
            "Optional topics may be enrichment, alternate paths, or later modules."
        ),
        "course_short_description": "Return a top-level shortDescription: one concise sentence for catalog cards.",
        "classification_rule": (
            "If category and department are provided, preserve them exactly as top-level course.category and course.department. "
            "If they are not provided, classify by the course's primary learning domain, learner purpose, and program role. "
            "Always choose the college/category first, then choose a department contained inside that category. "
            "Do not mechanically copy courseEquivalencies[].department into top-level category or department."
        ),
        "course_shape": "Lycium course JSON with learn/apply pages, editor-native atomic blocks, sourceRecords, and quiz-only assessment pages.",
        "critical_renderer_rules": [
            "Every section.content MUST be an array of block objects, never a plain string.",
            "Text blocks use {\"type\":\"text\",\"heading\":\"...\",\"value\":\"...\"}.",
            "Use the same editable blocks a human can add in the UI: text, heading, conceptCard, image/visual, video, iframe, quiz, and project.",
            "Every non-summary Learn section ends with {\"type\":\"heading\",\"title\":\"Concepts introduced\"} followed by one {\"type\":\"conceptCard\",\"title\":\"...\",\"description\":\"...\"} block per concept.",
            "Every module has one Apply assessment section containing only one quiz block.",
            "Each quiz block contains at least 10 questions.",
            "Quiz questions MUST use {\"id\":\"q1\",\"question\":\"...\",\"options\":[\"...\"],\"answers\":[0],\"multiple\":false}; answers are zero-based option indexes, not answer objects.",
            "Every module ends with one summary section containing a heading titled \"Module concepts\" or \"Week concepts\" followed by one conceptCard block per reviewed concept.",
        ],
        "minimal_section_example": {
            "id": "module-1-section-1",
            "title": "Focused lesson title",
            "pageType": "learn",
            "sectionType": "lesson",
            "sourceIds": ["source-1"],
            "content": [
                {"type": "text", "heading": "Explanation", "value": "Teach the idea directly in learner-facing prose."},
                {"type": "text", "heading": "Worked example", "value": "Show the idea in a concrete situation."},
                {"type": "text", "heading": "Practice", "value": "Ask the learner to apply the idea."},
                {
                    "type": "heading",
                    "title": "Concepts introduced",
                },
                {"type": "conceptCard", "title": "Raw concept name", "description": "Concise definition."},
            ],
        },
    }

    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one valid JSON object. Do not wrap it in markdown. "
                "Prefer 2-4 learn sections, 1 quiz-only apply section, and 1 summary section per module unless the prompt requires more. "
                "If section.content is a string instead of an array of typed block objects, the output fails."
            ),
        },
        {"role": "user", "content": json.dumps(user_contract, indent=2)},
    ]


def _source_ids_for_input(source_urls: list[str] | None) -> list[str]:
    return [f"input-source-{index}" for index, _ in enumerate(source_urls or [], start=1)]


def _staged_plan_messages(
    *,
    prompt: str,
    level: str | None,
    language: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_policy: str,
    category: str | None,
    department: str | None,
    source_urls: list[str] | None,
    benchmark_context: dict | None = None,
) -> list[dict[str, str]]:
    source_ids = _source_ids_for_input(source_urls)
    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only JSON. This stage returns a compact course plan, not full lessons."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "stage": "course_plan",
                    "prompt": prompt,
                    "level": level,
                    "language": language,
                    "desired_module_count": desired_module_count,
                    "expected_duration_minutes": expected_duration_minutes,
                    "source_policy": source_policy,
                    "category": category,
                    "department": department,
                    "source_urls": source_urls or [],
                    "available_source_ids": source_ids,
                    "curriculum_benchmark_context": benchmark_context or {},
                    "benchmark_instruction": (
                        "Use curriculum_benchmark_context.requirementOrigins to build the course skeleton. "
                        "Do not let source availability alone decide the curriculum sequence."
                    ),
                    "source_corpus_instruction": (
                        "If curriculum_benchmark_context.sourceCorpusSynthesis is present, use includedSources as the trusted source corpus. "
                        "Do not use excludedSources for course requirements, lessons, quizzes, or citations unless a reviewer later restores them. "
                        "Use commonThemes to identify recurring source themes, but still prioritize the requested course prompt and benchmark-derived requirements."
                    ),
                    "inline_citation_instruction": (
                        "Text block values may include inline citation markers like [1]. "
                        "Each marker is a 1-based index into the course-wide source inventory; section source lists render only locally used sources sorted by that course-wide number. "
                        "Only add markers next to claims supported by sources assigned to that section."
                    ),
                    "required_json_shape": {
                        "title": "Course title",
                        "shortDescription": "One catalog sentence.",
                        "difficultyLevel": level or "undergrad",
                        "category": category or "university-style college category id or label",
                        "department": department or "department id nested under category",
                        "tags": ["specific", "searchable", "tags"],
                        "scope": {
                            "audience": "target learner",
                            "level": level or "undergrad",
                            "duration": "duration",
                            "outcome": "course outcome",
                            "prerequisites": [],
                            "exclusions": [],
                        },
                        "modules": [
                            {
                                "id": "module-1",
                                "title": "Module 1: ...",
                                "objective": "What learners can do.",
                                "lessonTitles": ["Lesson 1", "Lesson 2"],
                                "sourceIds": source_ids,
                            }
                        ],
                    },
                },
                indent=2,
            ),
        },
    ]
