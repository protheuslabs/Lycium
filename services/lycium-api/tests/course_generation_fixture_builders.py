from __future__ import annotations

from typing import Any

from app.course_generation_flagships import CHEM_105_FLAGSHIP_BLUEPRINT, chem_105_source_slots
from app.course_generation_scenario_specs import COURSE_SCENARIOS


def _questions(topic: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"q{index}",
            "question": f"Which answer best applies {topic} in a college course setting?",
            "options": [f"{topic} correct use {index}", "Unrelated distractor", "Unsafe shortcut", "Placeholder response"],
            "answers": [0],
            "concepts": [{"name": topic.title()}],
        }
        for index in range(1, 11)
    ]


def _lesson_text(topic: str, supporting: str, discipline: str) -> str:
    return (
        f"{topic.title()} is introduced as a foundation for deeper {discipline} reasoning. "
        f"The section starts from observable evidence, names the key quantities or representations, "
        f"and then connects those representations to {supporting}. A reliable explanation separates the "
        "given information from the inference being made, checks units or definitions, and states the "
        "constraint that controls the result. This creates a foundation for later modules because the same "
        "pattern recurs with more variables, less obvious evidence, and stronger expectations for justification. "
        "Mastery evidence comes from a worked solution, a short explanation of why the method fits, and a quiz "
        "response that applies the concept without relying on memorized wording."
    )


def _example_text(topic: str, supporting: str) -> str:
    return (
        f"Example: compare two claims about {topic}. First identify the data, symbol, structure, or observation "
        f"that each claim uses. Next connect that evidence to {supporting}, then explain which claim is better "
        "supported and what additional evidence would change the conclusion. The answer is strongest when it "
        "shows the reasoning path, not only the final label."
    )


def _practice_text(topic: str) -> str:
    return (
        f"Practice: solve one applied {topic} problem, mark the step where an assumption enters, and write a "
        "two-sentence reflection naming the prerequisite idea that made the solution possible. Then compare the "
        "answer with the source example and revise any step that skipped evidence."
    )


def _concept_card(name: str, description: str, section_id: str, source_ids: list[str]) -> dict[str, Any]:
    return {
        "type": "conceptCard",
        "name": name,
        "description": description,
        "sourceSectionId": section_id,
        "sourceIds": source_ids,
    }


def _summary_blocks(topic: str, supporting: str, section_id: str, source_ids: list[str], pacing_label: str) -> list[dict[str, Any]]:
    return [
        {"type": "heading", "title": f"{pacing_label} concepts", "sourceIds": source_ids},
        _concept_card(topic.title(), f"Review definition and application pattern for {topic}.", section_id, source_ids),
        _concept_card(supporting.title(), f"Related concept that extends or constrains {topic}.", section_id, source_ids),
        _concept_card("Mastery evidence", "A source-backed work product showing accurate application under constraints.", section_id, source_ids),
        _concept_card("Foundation relationship", "A prerequisite idea that must be understood before the next concept can be used well.", section_id, source_ids),
    ]


def source_backed_course_from_scenario(scenario_id: str) -> dict[str, Any]:
    spec = COURSE_SCENARIOS[scenario_id]
    keywords = list(spec["requiredKeywords"])
    discipline = str(spec.get("discipline") or "the course")
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
                                "value": _lesson_text(topic, supporting, discipline),
                                "sourceIds": ["source-primary"],
                            },
                            {"type": "text", "heading": "Example", "value": _example_text(topic, supporting), "sourceIds": ["source-primary"]},
                            {"type": "text", "heading": "Practice", "value": _practice_text(topic), "sourceIds": ["source-practice"]},
                            {"type": "video", "title": f"{topic.title()} lecture", "url": "https://example.edu/video", "sourceIds": ["source-video"]},
                            {"type": "heading", "title": "Concepts introduced", "sourceIds": ["source-primary"]},
                            _concept_card(topic.title(), f"A required concept covering {topic}.", section_id, ["source-primary"]),
                            _concept_card(supporting.title(), f"A related concept covering {supporting}.", section_id, ["source-primary"]),
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
                        "content": _summary_blocks(topic, supporting, section_id, ["source-primary"], "Module"),
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
                "metrics": {"submittedSourceCount": 3, "includedSourceCount": 3, "excludedSourceCount": 0},
                "includedSources": ["source-primary", "source-video", "source-practice"],
                "excludedSources": [],
                "commonThemes": keywords[:8],
            },
            "courseParityProfile": {"commonRequiredTopics": keywords[:8], "coveragePercent": 90, "parityStatus": "strong"},
            "generationReadiness": {
                "contractVersion": "course-generation-readiness-v1",
                "status": "ready",
                "ready": True,
                "sourceEvidence": {
                    "sourceUrlCount": 3,
                    "usableInputArtifactCount": 0,
                    "submittedEvidenceCount": 3,
                    "minimumCourseSources": 3,
                },
                "conceptCoverage": {
                    "status": "ready",
                    "coverageRatio": 1,
                    "minimumCoverageRatio": 0.7,
                    "requiredConceptCount": len(keywords),
                    "coveredConceptCount": len(keywords),
                    "uncoveredConcepts": [],
                },
                "issues": [],
            },
            "sourceSlots": [
                {
                    "requiredConceptId": f"{scenario_id}-{keyword.replace(' ', '-')}",
                    "title": keyword.title(),
                    "primarySourceId": "source-primary",
                    "fallbackSourceIds": ["source-video", "source-practice"],
                    "replacementPolicy": "review_required",
                }
                for keyword in keywords
            ],
            "scope": {
                "audience": "College learners building foundational skill.",
                "level": "undergraduate",
                "duration": f"{spec['minModules']} modules",
                "outcome": f"Apply core {spec['label']} concepts with source-backed reasoning and mastery evidence.",
            },
        },
        "modules": modules,
    }


def chem_105_flagship_course_from_scenario() -> dict[str, Any]:
    topics = list(CHEM_105_FLAGSHIP_BLUEPRINT["scenario"]["requiredKeywords"])
    source_records = [
        {
            "id": source["id"],
            "type": source["type"],
            "title": source["title"],
            "url": source["url"],
        }
        for source in CHEM_105_FLAGSHIP_BLUEPRINT["freeSourceRecords"]
    ]
    source_ids = [source["id"] for source in source_records]
    modules = []
    for index, topic in enumerate(topics, start=1):
        section_id = f"chem-105-{index:02d}-lesson"
        topic_source_ids = source_ids[:2]
        modules.append(
            {
                "id": f"chem-105-week-{index:02d}",
                "title": f"Week {index}: {topic.title()}",
                "sourceIds": topic_source_ids,
                "sections": [
                    {
                        "id": section_id,
                        "title": topic.title(),
                        "pageType": "learn",
                        "sectionType": "lesson",
                        "sourceIds": topic_source_ids,
                        "content": [
                            {
                                "type": "text",
                                "heading": "Explanation",
                                "value": _lesson_text(topic, "chemical evidence and quantitative constraints", "chemistry"),
                                "sourceIds": [topic_source_ids[0]],
                            },
                            {
                                "type": "text",
                                "heading": "Example",
                                "value": _example_text(topic, "chemical evidence and quantitative constraints"),
                                "sourceIds": [topic_source_ids[0]],
                            },
                            {"type": "text", "heading": "Practice", "value": _practice_text(topic), "sourceIds": [topic_source_ids[0]]},
                            {
                                "type": "video",
                                "title": f"{topic.title()} lecture",
                                "url": "https://example.edu/chemistry-video",
                                "sourceIds": [topic_source_ids[1]],
                            },
                            {"type": "heading", "title": "Concepts introduced", "sourceIds": [topic_source_ids[0]]},
                            _concept_card(topic.title(), f"A required general chemistry concept covering {topic}.", section_id, [topic_source_ids[0]]),
                            _concept_card(
                                "Chemical evidence",
                                "Observations, measurements, or models used to justify a chemical claim.",
                                section_id,
                                [topic_source_ids[0]],
                            ),
                        ],
                    },
                    {
                        "id": f"{section_id}-quiz",
                        "title": f"Quiz: {topic.title()}",
                        "pageType": "apply",
                        "sectionType": "assessment",
                        "sourceIds": [topic_source_ids[0]],
                        "content": [{"type": "quiz", "questions": _questions(topic), "sourceIds": [topic_source_ids[0]]}],
                    },
                    {
                        "id": f"{section_id}-summary",
                        "title": f"Week {index} Summary",
                        "pageType": "learn",
                        "sectionType": "summary",
                        "sourceIds": [topic_source_ids[0]],
                        "content": _summary_blocks(topic, "chemical evidence", section_id, [topic_source_ids[0]], "Week"),
                    },
                ],
            }
        )
    return {
        "title": CHEM_105_FLAGSHIP_BLUEPRINT["title"],
        "shortDescription": "A first-semester general chemistry course aligned to college CHEM 105 expectations.",
        "difficultyLevel": "undergrad",
        "category": "natural-sciences-mathematics",
        "department": "chemistry",
        "tags": ["chemistry", "stoichiometry", "thermochemistry", "equilibrium"],
        "sourceIds": source_ids,
        "sourceRecords": source_records,
        "metadata": {
            "pacingLabel": "Week",
            "curriculumBenchmarks": CHEM_105_FLAGSHIP_BLUEPRINT["benchmarkSources"],
            "requirementOrigins": [
                {
                    "requirementId": f"req-{index}",
                    "title": topic.title(),
                    "originType": "common_academic_requirement",
                    "evidenceRefs": [source_ids[0]],
                }
                for index, topic in enumerate(topics, start=1)
            ],
            "sourceCorpusSynthesis": {
                "metrics": {
                    "submittedSourceCount": len(source_records),
                    "includedSourceCount": len(source_records),
                    "excludedSourceCount": 0,
                },
                "includedSources": source_ids,
                "excludedSources": [],
                "commonThemes": topics[:8],
            },
            "courseParityProfile": {
                "commonRequiredTopics": topics,
                "coveragePercent": 92,
                "parityStatus": "strong",
            },
            "generationReadiness": {
                "contractVersion": "course-generation-readiness-v1",
                "status": "ready",
                "ready": True,
                "sourceEvidence": {
                    "sourceUrlCount": len(source_records),
                    "usableInputArtifactCount": 0,
                    "submittedEvidenceCount": len(source_records),
                    "minimumCourseSources": 3,
                },
                "conceptCoverage": {
                    "status": "ready",
                    "coverageRatio": 1,
                    "minimumCoverageRatio": 0.7,
                    "requiredConceptCount": len(topics),
                    "coveredConceptCount": len(topics),
                    "uncoveredConcepts": [],
                },
                "issues": [],
            },
            "sourceSlots": chem_105_source_slots(),
            "scope": {
                "audience": "College learners taking a first-semester general chemistry sequence.",
                "level": "undergraduate",
                "duration": f"{len(topics)} weeks",
                "outcome": "Use core chemistry models, measurements, and source-backed reasoning to solve CHEM 105 problems.",
            },
        },
        "modules": modules,
    }


def under_sourced_course_draft_from_scenario() -> dict[str, Any]:
    spec = COURSE_SCENARIOS["under-sourced-course-prompt"]
    modules = []
    for module_index, focus in enumerate(("Foundations", "Core Concepts", "Applied Practice", "Integration"), start=1):
        sections = []
        for section_index, section_focus in enumerate(("Explanation", "Guided Practice"), start=1):
            section_title = f"{focus}: {section_focus}"
            planned_description = f"Planning reference for section fill: teach {section_title.lower()} once stronger sources are available."
            planned_outcome = f"Explain {section_title.lower()} and connect it to the course outcome."
            sections.append(
                {
                    "id": f"best-effort-m{module_index:02d}-s{section_index:02d}",
                    "title": section_title,
                    "sectionType": "lesson",
                    "pageType": "learn",
                    "description": planned_description,
                    "learningObjectives": [planned_outcome],
                    "sourceIds": [],
                    "metadata": {
                        "generationOutline": {
                            "contractVersion": "section-generation-outline-v1",
                            "role": "section_plan",
                            "planningSource": "outline_before_sources",
                            "moduleOutlineId": f"best-effort-m{module_index:02d}",
                            "moduleOutlineTitle": f"Module {module_index}: {focus}",
                            "sectionOutlineId": f"best-effort-m{module_index:02d}-s{section_index:02d}",
                            "sectionOutlineTitle": section_title,
                            "plannedDescription": planned_description,
                            "plannedLearningOutcome": planned_outcome,
                            "plannedConceptKeywords": [focus.lower(), section_focus.lower()],
                            "plannedLearningObjectives": [planned_outcome],
                            "plannedSourceIds": [],
                            "candidateSourceIds": [],
                            "sourceNeeds": [f"Add sources that support {section_title.lower()}."],
                            "contentStatus": "planned_empty",
                            "nextWorkflow": "section_fill",
                            "rebuildScopes": ["section_plan", "section_content"],
                            "sourceReviewRequired": True,
                        }
                    },
                    "content": [],
                }
            )
        modules.append(
            {
                "id": f"best-effort-m{module_index:02d}",
                "title": f"Module {module_index}: {focus}",
                "sections": sections,
            }
        )
    return {
        "title": spec["label"],
        "shortDescription": "A best-effort course draft with planned empty sections awaiting source review and section fill.",
        "status": "needs_sources",
        "difficultyLevel": "undergrad",
        "category": "computing-information-sciences",
        "department": "computer-science",
        "tags": ["source gaps", "draft"],
        "sourceIds": ["submitted-source-1"],
        "sourceRecords": [
            {"id": "submitted-source-1", "type": "web", "title": "Submitted source 1", "url": "https://example.edu/source"}
        ],
        "metadata": {
            "status": "needs_sources",
            "sourceGaps": [
                {
                    "id": "course-source-minimum",
                    "scopeType": "course",
                    "scopeId": "course",
                    "title": "Add course sources",
                    "description": "This draft has 1 submitted source, but Lycium requires more course-level sources before full course generation.",
                    "severity": "blocking",
                    "minimumSourceCount": 3,
                    "currentSourceCount": 1,
                    "sourceTypeHints": ["university_catalog", "syllabus", "open_textbook", "video"],
                    "suggestedQueries": ["under sourced course syllabus", "under sourced course open textbook"],
                }
            ],
            "generationPlan": {
                "status": ["scoped", "outline_planned", "sections_planned", "needs_sources"],
                "mode": "outline_first_empty_section_plan",
                "message": "Review and strengthen the planned course structure with relevant sources before section fill.",
            },
        },
        "modules": modules,
    }
