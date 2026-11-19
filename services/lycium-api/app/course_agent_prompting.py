
from __future__ import annotations

import json
from pathlib import Path

from app.course_planning_contracts import CourseCurriculum, CourseModulePlan, CourseSectionPlans
from app.course_content_formats import available_content_formats
from app.course_taxonomy import COURSE_TAXONOMY

CONTRACT_PATH = Path(__file__).resolve().parents[3] / "COURSE_AGENT_CONTRACT.md"


def load_behavioral_contract(workflow: str | None = None) -> str:
    formats = json.dumps(available_content_formats(workflow), ensure_ascii=False, separators=(",", ":"))
    return CONTRACT_PATH.read_text(encoding="utf-8") + "\n\nAvailable content formats:\n" + formats


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
            "Use the same editable blocks a human can add in the UI: text, heading, conceptCard, equation, workedExample, image/visual, video, iframe, quiz, and project.",
            "Use equation blocks for standalone formulas, symbolic relationships, or calculation lines.",
            "Use workedExample blocks only for quantitative, formal, technical, or procedural examples where learners need problem/given/find/steps/answer/check structure.",
            "Do not use workedExample blocks for interpretive humanities or social-science analysis, historical causation, literary interpretation, ethics discussion, or source-analysis prompts; use text practice blocks instead.",
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
                {"type": "text", "heading": "Guided practice", "value": "Ask the learner to apply the idea with evidence, reasoning, or a short activity."},
                {
                    "type": "heading",
                    "title": "Concepts introduced",
                },
                {"type": "conceptCard", "title": "Raw concept name", "description": "Concise definition."},
            ],
        },
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


def _course_curriculum_messages(
    *,
    request: dict,
    evidence: dict | None,
    source_topics: list[dict],
    benchmark_topics: list[str],
) -> list[dict[str, str]]:
    return _planning_messages(
        "Plan the scope and required coverage of one course. Resolve its role, learner, entry prerequisites, "
        "and main capability. For an ambiguous title, plan one coherent course unless the request or a "
        "supplied benchmark calls for a sequence. State which scope you chose and what belongs in a follow-on. "
        "Use supplied curriculum context to distinguish what prerequisites already teach from what this course "
        "must teach and what later courses own. Mark unconfirmed prerequisite coverage as an assumption.\n"
        "Preserve explicitly supplied study time, credits, and credit system, including constraints stated in "
        "the request text. Null or missing values are not constraints. Estimate the missing workload including "
        "instruction, independent study, practice, and assessment. Label what was requested versus estimated, "
        "and name the credit convention if proposing credits. Do not imply awarded credit. Report conflicts "
        "instead of silently changing requirements.\n"
        "Inventory the essential concepts, methods, and skills in prerequisite order. For each topic name "
        "specific mustTeach concepts, the expected depth, and a concrete observable outcome. Include practical "
        "and analytical methods where essential. Use supplied benchmarks and document structure as evidence; "
        "when absent, use disciplinary knowledge without inventing benchmarks. Reference source IDs only "
        "when the supplied evidence supports the topic.\n"
        "Check each outcome against its mustTeach list and expected depth. Make every required skill "
        "demonstrable through an observable learner action. Specify the conditions, precision, or evidence "
        "of success when those affect what counts as mastery. Combine related actions when useful, but do "
        "not promise a capability beyond the linked coverage or the course's scope. Check universal or exact "
        "claims against counterexamples. Restrict the inputs, state where the skill applies, or require an "
        "approximation when a general exact result is not realistic.\n"
        "Check for missing foundations and time for practice. List major deferred topics with reasons, and "
        "flag uncertainty. Give a resolved title and concise catalog description. Do not plan modules, "
        "sections, lesson titles, or assessments. Return only JSON matching the supplied schema.",
        {
            **request,
            "benchmark_topics": benchmark_topics,
            "document_topics": source_topics,
            "source_evidence": evidence,
            "response_schema": CourseCurriculum.model_json_schema(),
        },
    )


def _planning_messages(instructions: str, payload: dict) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": instructions},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False, separators=(",", ":"))},
    ]


def _staged_plan_messages(
    *,
    prompt: str,
    level: str | None,
    language: str,
    desired_module_count: int,
    expected_duration_minutes: int | None,
    source_policy: str,
    category: str | None,
    department: str | None,
    course_template: dict,
) -> list[dict[str, str]]:
    topics = course_template["courseCoverageChecklist"]["requiredItems"]
    return _planning_messages(
        "Sequence the approved coverage into modules within the module limit and the resolved workload in scope. "
        "Preserve the resolved interpretation, prerequisites, exclusions, and depth. "
        "Give each module a specific title, measurable learningObjectives and 3-8 concrete conceptKeywords. "
        "Assign every supplied coverage ID exactly once to the module that teaches it. Group related topics "
        "by prerequisites. Copy IDs exactly. Do not plan individual sections. "
        "Use only available source IDs that support the module. Choose category and department IDs from "
        "the supplied taxonomy and honor any explicitly requested classification. Use Module consistently "
        "in numbered titles. Return only the JSON module plan. Lesson planning is a later stage.",
        {
            "prompt": prompt,
            "level": level,
            "language": language,
            "desired_module_count": desired_module_count,
            "expected_duration_minutes": expected_duration_minutes,
            "source_policy": source_policy,
            "category": category,
            "department": department,
            "taxonomy": {
                key: sorted(departments) for key, departments in COURSE_TAXONOMY.items()
                if not category or category == key
            },
            "title": course_template["title"],
            "scope": course_template["scope"],
            "available_source_ids": course_template["sourceIds"],
            "required_topics": [
                {
                    key: item[key] for key in ("id", "title", "description", "depth", "mustTeach", "sourceIds") if key in item
                }
                for item in topics
            ],
            "response_schema": CourseModulePlan.model_json_schema(),
        },
    )


def _module_section_plan_messages(*, scope: dict, modules: list[dict]) -> list[dict[str, str]]:
    return _planning_messages(
        "Plan teaching sections for each supplied module ID. Split each module's required concepts into coherent sections in "
        "prerequisite order. Give each section a specific title and a measurable objective at the assigned "
        "depth. Copy the assigned coverage IDs and mustTeach terms exactly from the supplied coverage. "
        "Together the sections must cover every term of every assigned topic. "
        "Preserve every measurable action, condition, and precision requirement from the parent module "
        "objectives and assigned topic outcomes across the section objectives. Including a concept label "
        "does not preserve the skill. Before returning, compare the section objectives with each parent "
        "outcome and correct omissions without increasing the promised depth. "
        "Choose section boundaries for learnability, not one section per coverage item. Split a topic when "
        "its prerequisite ideas, procedures, or applications need separate explanation and practice. "
        "Preserve the parent skills across focused sections rather than combining them into one long objective. "
        "Use no more than six sections per module. "
        "Do not write lesson content, assessments, or summaries. Return only JSON matching the supplied schema.",
        {
            "scope": scope,
            "modules": [
                {key: module[key] for key in ("id", "title", "learningObjectives", "coverageItems") if key in module}
                for module in modules
            ],
            "response_schema": CourseSectionPlans.model_json_schema(),
        },
    )
