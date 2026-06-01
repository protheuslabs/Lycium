from __future__ import annotations

from typing import Any

from app.course_generation_scenario_specs import COURSE_SCENARIOS


def _questions(topic: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"q{index}",
            "question": f"Which answer best applies {topic} in a college course setting?",
            "options": [f"{topic} correct use {index}", "Unrelated distractor", "Unsafe shortcut", "Placeholder response"],
            "answers": [0],
        }
        for index in range(1, 11)
    ]
def source_backed_course_from_scenario(scenario_id: str) -> dict[str, Any]:
    spec = COURSE_SCENARIOS[scenario_id]
    keywords = list(spec["requiredKeywords"])
    source_records = [
        {"id": "source-primary", "type": "open_courseware", "title": "Primary open courseware", "url": "https://example.edu/courseware"},
        {"id": "source-video", "type": "video", "title": "Open lecture library", "url": "https://example.edu/videos"},
        {"id": "source-practice", "type": "practice", "title": "Practice archive", "url": "https://example.edu/practice"},
    ]
    modules = []
    for index in range(1, int(spec["minModules"]) + 1):
        topic = keywords[(index - 1) % len(keywords)]
        supporting = keywords[index % len(keywords)]
        section_id = f"{scenario_id}-m{index:02d}-lesson"
        modules.append(
            {
                "id": f"{scenario_id}-m{index:02d}",
                "title": f"Module {index}: {topic.title()}",
                "sourceIds": ["source-primary", "source-video"],
                "sections": [
                    {
                        "id": section_id,
                        "title": topic.title(),
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": ["source-primary"],
                        "content": [
                            {
                                "type": "text",
                                "heading": "Explanation",
                                "value": (
                                    f"Learners study {topic} with {supporting}, worked examples, practice, "
                                    "source-backed reasoning, and professional vocabulary for a college course."
                                ),
                                "sourceIds": ["source-primary"],
                            },
                            {"type": "video", "title": f"{topic.title()} lecture", "url": "https://example.edu/video", "sourceIds": ["source-video"]},
                            {
                                "type": "conceptCards",
                                "title": "Concepts introduced",
                                "sourceIds": ["source-primary"],
                                "concepts": [
                                    {"name": topic.title(), "description": f"A required concept covering {topic}.", "sourceSectionId": section_id},
                                    {"name": supporting.title(), "description": f"A related concept covering {supporting}.", "sourceSectionId": section_id},
                                ],
                            },
                        ],
                    },
                    {
                        "id": f"{section_id}-quiz",
                        "title": f"Quiz: {topic.title()}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": ["source-primary"],
                        "content": [{"type": "quiz", "questions": _questions(topic), "sourceIds": ["source-primary"]}],
                    },
                    {
                        "id": f"{section_id}-summary",
                        "title": f"Module {index} Summary",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": ["source-primary"],
                        "content": [
                            {
                                "type": "conceptCards",
                                "title": "Module concepts",
                                "sourceIds": ["source-primary"],
                                "concepts": [{"name": topic.title(), "description": f"Review definition for {topic}.", "sourceSectionId": section_id}],
                            }
                        ],
                    },
                ],
            }
        )
    return {
        "title": spec["label"],
        "shortDescription": f"A fixed source-backed scenario fixture for {spec['label']}.",
        "difficultyLevel": "undergrad",
        "category": spec["expectedCategory"],
        "department": spec["expectedDepartment"],
        "tags": keywords[:6],
        "sourceIds": [source["id"] for source in source_records],
        "sourceRecords": source_records,
        "metadata": {
            "pacingLabel": "Module",
            "curriculumBenchmarks": [{"id": f"benchmark-{scenario_id}", "title": spec["label"], "sourceType": "syllabus"}],
            "requirementOrigins": [
                {"requirementId": f"req-{index}", "originType": "common_academic_requirement", "evidenceRefs": ["source-primary"]}
                for index, _keyword in enumerate(keywords[:6], start=1)
            ],
            "sourceCorpusSynthesis": {
                "includedSources": ["source-primary", "source-video", "source-practice"],
                "excludedSources": [],
                "commonThemes": keywords[:8],
            },
        },
        "modules": modules,
    }
