from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.generation_helpers import _stable_id, _title_from_prompt
from app.models import CourseSnapshot, Learner, ProgramSnapshot
from app.curriculum_benchmarks import compile_curriculum_benchmark_context
from app.program_quality import assess_program_quality
from app.program_validation import validate_program_contract
from app.retrieval import assemble_learning_packet, tokenize
from app.source_index import source_documents_from_index_snapshots

PROGRAM_TOPIC_STOPWORDS = {
    "become",
    "build",
    "course",
    "free",
    "from",
    "learn",
    "learning",
    "online",
    "path",
    "program",
    "resources",
    "study",
    "with",
}


def ask_instructor(
    course: CourseSnapshot,
    *,
    section_id: str,
    question: str,
    response_mode: str,
) -> dict[str, Any]:
    modules = course.structure.get("modules", [])
    section: dict[str, Any] | None = None
    for module in modules:
        for row in module.get("sections", []):
            if row.get("id") == section_id:
                section = row
                break
        if section is not None:
            break

    if section is None:
        raise ValueError(f"section_id '{section_id}' not found")

    text_blocks = [block.get("value", "") for block in section.get("content", []) if block.get("type") == "text"]
    context = " ".join(text_blocks).strip()
    context_excerpt = context[:500] if context else "No section context was available."

    if response_mode == "concise":
        answer = (
            f"{section['title']}: {context_excerpt[:220]} "
            f"Focus answer to your question ({question}): review the core concept and its quiz checkpoint."
        )
    elif response_mode == "deep":
        answer = (
            f"{section['title']} detailed walkthrough: {context_excerpt} "
            f"To answer '{question}', connect the definition, why it matters, and how to apply it in practice. "
            "Use the cited sources for verification and compare at least two perspectives."
        )
    else:
        answer = (
            f"Example for '{question}': take the concept in '{section['title']}', "
            "build a tiny scenario where you apply it, verify with the section quiz, "
            "then extend the scenario one level harder."
        )

    return {
        "section_id": section_id,
        "answer": answer.strip(),
        "citations": section.get("citations", []),
        "mode": response_mode,
    }


def _program_level(level: str | None) -> str:
    if level == "advanced":
        return "professional"
    if level == "intermediate":
        return "undergraduate"
    return "foundational"


def _course_requirement(goal: str, term: str, index: int, *, title_prefix: str = "") -> dict[str, Any]:
    course_id = _stable_id("course", goal, term, str(index))
    title = f"{title_prefix}{term.title()}".strip()
    return {
        "id": _stable_id("req", course_id),
        "type": "complete_course",
        "title": f"{title} Course",
        "courseId": course_id,
        "estimatedHours": 30,
    }


def _split_requirements(requirements: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    foundation = requirements[:2]
    core = requirements[2:4] or requirements[:2]
    elective = requirements[4:] or requirements[-2:]
    return foundation, core, elective


def _build_program(goal: str, level: str | None, desired_course_count: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    terms = [term for term in tokenize(goal) if len(term) > 3 and term not in PROGRAM_TOPIC_STOPWORDS]
    defaults = ["foundation", "programming", "systems", "practice", "deployment", "capstone"]
    course_terms = list(dict.fromkeys([*terms, *defaults]))[: max(4, desired_course_count)]
    course_requirements = [_course_requirement(goal, term, index) for index, term in enumerate(course_terms, start=1)]
    foundation, core, elective = _split_requirements(course_requirements)
    capstone_project_id = _stable_id("project", goal, "capstone")
    portfolio_assessment_id = _stable_id("assessment", goal, "portfolio")
    program_id = _stable_id("program", goal, level or "foundational")
    groups = [
        {
            "id": "group-foundations",
            "displayName": "Foundations",
            "groupKind": "foundation",
            "purpose": "Establish the shared concepts and setup needed before deeper work.",
            "learningOutcomes": [{"id": "group-foundations-outcome", "statement": "Explain the core vocabulary and baseline workflow for the program."}],
            "requirements": foundation,
            "completionRule": {"type": "complete_all"},
            "estimatedHours": sum(req.get("estimatedHours", 0) for req in foundation),
        },
        {
            "id": "group-core",
            "displayName": "Core Practice",
            "groupKind": "cluster",
            "purpose": "Build the central course sequence that makes the goal actionable.",
            "learningOutcomes": [{"id": "group-core-outcome", "statement": "Apply the main concepts to realistic practice tasks."}],
            "requirements": [
                *core,
                {
                    "id": "req-core-checkpoint",
                    "type": "pass_assessment",
                    "title": "Core checkpoint",
                    "assessmentId": _stable_id("assessment", goal, "core"),
                    "minScore": 0.8,
                    "estimatedHours": 4,
                },
            ],
            "completionRule": {"type": "complete_all"},
            "estimatedHours": sum(req.get("estimatedHours", 0) for req in core) + 4,
            "prerequisites": [{"nodeId": "group-foundations", "type": "required"}],
        },
        {
            "id": "group-electives",
            "displayName": "Elective Depth",
            "groupKind": "elective_pool",
            "purpose": "Allow depth choices while preserving a coherent program path.",
            "learningOutcomes": [{"id": "group-electives-outcome", "statement": "Choose related areas that deepen the learner's target outcome."}],
            "requirements": [
                {
                    "id": "req-elective-choice",
                    "type": "complete_n_of_courses",
                    "title": "Choose elective courses",
                    "count": min(2, len(elective)),
                    "courseIds": [str(req["courseId"]) for req in elective],
                    "estimatedHours": 60,
                }
            ],
            "completionRule": {"type": "complete_all"},
            "estimatedHours": 60,
            "prerequisites": [{"nodeId": "group-core", "type": "required"}],
        },
        {
            "id": "group-capstone",
            "displayName": "Capstone Evidence",
            "groupKind": "capstone",
            "purpose": "Turn learning into a reviewable artifact and credential checkpoint.",
            "learningOutcomes": [{"id": "group-capstone-outcome", "statement": "Demonstrate the program outcome with a project and review checkpoint."}],
            "requirements": [
                {
                    "id": "req-capstone-project",
                    "type": "submit_project",
                    "title": "Capstone project",
                    "projectId": capstone_project_id,
                    "estimatedHours": 40,
                },
                {
                    "id": "req-portfolio-review",
                    "type": "pass_assessment",
                    "title": "Portfolio review",
                    "assessmentId": portfolio_assessment_id,
                    "minScore": 0.85,
                    "estimatedHours": 6,
                },
            ],
            "completionRule": {"type": "complete_all"},
            "estimatedHours": 46,
            "prerequisites": [
                {"nodeId": "group-core", "type": "required"},
                {"nodeId": "group-electives", "type": "recommended"},
            ],
        },
    ]
    program = {
        "id": program_id,
        "title": f"Program: {_title_from_prompt(goal)}",
        "description": f"A structured Lycium program for: {goal}.",
        "programType": "career_path",
        "field": "Interdisciplinary Learning",
        "level": _program_level(level),
        "targetOutcome": f"Complete a coherent learning path for {goal}.",
        "learningOutcomes": [
            {"id": "outcome-foundations", "statement": "Build the foundations needed for the path."},
            {"id": "outcome-practice", "statement": "Apply the core concepts in realistic work."},
            {"id": "outcome-capstone", "statement": "Produce reviewable evidence of learning."},
        ],
        "entryRequirements": [],
        "requirementGroups": groups,
        "estimatedHours": sum(group.get("estimatedHours", 0) for group in groups),
        "masteryPolicy": {
            "minimumMasteryPercent": 85,
            "minimumAssessmentPercent": 80,
            "requiresCapstone": True,
            "remediationPolicy": "recommended",
        },
        "credentialPolicy": {
            "credentialType": "certificate",
            "title": f"{_title_from_prompt(goal)} Certificate",
            "issuer": "Lycium",
            "requiresHumanReview": True,
        },
        "dependencyGraph": {
            "edges": [
                {"fromNodeId": "group-foundations", "toNodeId": "group-core", "type": "required"},
                {"fromNodeId": "group-core", "toNodeId": "group-electives", "type": "recommended"},
                {"fromNodeId": "group-core", "toNodeId": "group-capstone", "type": "required"},
                {"fromNodeId": "group-electives", "toNodeId": "group-capstone", "type": "recommended"},
            ]
        },
        "version": "0.1.0",
        "reviewStatus": "draft",
    }
    return program, course_requirements


def _assemble_program_packet(
    session: Session,
    *,
    query: str,
    free_only: bool,
    trust_min: float,
    level: str | None,
) -> dict[str, Any]:
    packet = assemble_learning_packet(
        session,
        query=query,
        top_k=8,
        free_only=free_only,
        trust_min=trust_min,
        level=level,
    )
    if packet.get("object_ids") or not level:
        packet["retrievalLevelPolicy"] = "strict" if level else "any"
        return packet

    fallback = assemble_learning_packet(
        session,
        query=query,
        top_k=8,
        free_only=free_only,
        trust_min=trust_min,
        level=None,
    )
    fallback["retrievalLevelPolicy"] = "fallback_any_level"
    fallback["strictLevelAttempt"] = packet
    return fallback


def generate_program(
    session: Session,
    *,
    goal: str,
    learner_id: int | None,
    level: str | None,
    free_only: bool,
    source_policy: str,
    trust_min: float,
    desired_course_count: int,
    source_urls: list[str] | None = None,
) -> ProgramSnapshot:
    program, course_requirements = _build_program(goal, level, desired_course_count)
    indexed_source_documents = source_documents_from_index_snapshots(session, source_urls=source_urls or []) if source_urls else []
    benchmark_context = compile_curriculum_benchmark_context(
        prompt=goal,
        source_urls=source_urls or [],
        fetch_sources=False,
        source_documents=indexed_source_documents,
    )
    course_packets = []
    for requirement in course_requirements:
        term = str(requirement["title"]).replace(" Course", "")
        packet = _assemble_program_packet(
            session,
            query=f"{goal} {term}",
            free_only=free_only,
            trust_min=trust_min,
            level=level,
        )
        course_packets.append(
            {
                "courseId": requirement["courseId"],
                "requirementId": requirement["id"],
                "title": requirement["title"],
                "learningPacket": packet,
            }
        )
    validation_errors = validate_program_contract(program)
    structure = {
        "contractVersion": "0.1.0",
        "program": program,
        "generationTrace": {
            "goal": goal,
            "level": level,
            "sourcePolicy": source_policy,
            "freeOnly": free_only,
            "trustMin": trust_min,
            "coursePackets": course_packets,
            "sourceUrls": source_urls or [],
            "sourceIndexSnapshotDocumentCount": len(indexed_source_documents),
            "curriculumBenchmarkContext": benchmark_context,
        },
        "contractValidation": {
            "passed": len(validation_errors) == 0,
            "errors": validation_errors,
        },
    }
    quality_report = assess_program_quality(structure)
    structure["qualityReport"] = quality_report
    program = ProgramSnapshot(
        learner_id=learner_id,
        title=structure["program"]["title"],
        goal=goal,
        level=level,
        status="ready_for_review" if quality_report["passed"] and not validation_errors else "needs_revision",
        structure=structure,
    )
    session.add(program)
    session.flush()
    return program


def validate_learner_exists(session: Session, learner_id: int | None) -> None:
    if learner_id is None:
        return
    learner = session.get(Learner, learner_id)
    if learner is None:
        raise ValueError(f"learner_id '{learner_id}' does not exist")
