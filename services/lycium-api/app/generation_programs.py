from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.generation_helpers import _stable_id, _title_from_prompt
from app.models import CourseSnapshot, Learner, ProgramSnapshot
from app.course_generation_stage_workflows import (
    compact_stage_workflow_report,
    run_cluster_generation_workflow,
    run_course_wrapper_generation_workflow,
    run_program_generation_workflow,
)
from app.program_contract_builder import build_program_contract
from app.program_course_materialization import materialize_program_course_scaffold
from app.curriculum_benchmarks import compile_curriculum_benchmark_context
from app.program_generation_timeline import build_program_generation_timeline
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

PROGRAM_GROUP_RULES = [
    (
        "group-foundations",
        "Foundations",
        "foundation",
        ["foundation", "intro", "basics", "overview", "history", "ethics", "measurement", "matter", "command", "git"],
    ),
    (
        "group-programming",
        "Programming Core",
        "cluster",
        ["programming", "python", "javascript", "typescript", "algorithm", "function", "variable", "control flow", "data structure"],
    ),
    (
        "group-frontend",
        "Frontend Engineering",
        "cluster",
        ["html", "css", "react", "frontend", "browser", "accessibility", "responsive"],
    ),
    (
        "group-backend",
        "Backend Systems",
        "cluster",
        ["backend", "server", "http", "api", "authentication", "authorization", "security"],
    ),
    (
        "group-data",
        "Data and Analysis",
        "cluster",
        ["data", "database", "sql", "postgres", "statistics", "visualization", "analytics", "biostatistics"],
    ),
    (
        "group-modeling",
        "Modeling and Inference",
        "cluster",
        ["model", "modeling", "machine learning", "regression", "classification", "kinetics", "equilibrium", "thermodynamics"],
    ),
    (
        "group-chemistry-core",
        "Chemistry Core",
        "cluster",
        ["atomic", "periodic", "bonding", "stoichiometry", "reaction", "molecular", "acid", "base", "gas", "solution"],
    ),
    (
        "group-health-systems",
        "Health Systems and Policy",
        "cluster",
        ["epidemiology", "population", "policy", "health system", "community", "intervention", "surveillance"],
    ),
    (
        "group-delivery",
        "Delivery and Operations",
        "cluster",
        ["deployment", "docker", "ci/cd", "cloud", "operations", "maintenance", "monitoring"],
    ),
    (
        "group-professional",
        "Professional Practice",
        "cluster",
        ["communication", "review", "team", "professional", "portfolio", "documentation", "law", "equity"],
    ),
    (
        "group-lab-practice",
        "Lab and Applied Practice",
        "lab",
        ["lab", "laboratory", "simulation", "experiment", "field", "practice", "project"],
    ),
]


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


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _origin_title(origin: dict[str, Any]) -> str:
    for key in ("title", "name", "requirementId", "id"):
        value = origin.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Required topic"


def _origin_sort_key(origin: dict[str, Any]) -> tuple[int, float, float, str]:
    importance = str(origin.get("importance") or "")
    importance_rank = {"required": 0, "recommended": 1, "optional": 2}.get(importance, 3)
    score = origin.get("score")
    frequency = origin.get("frequency")
    return (
        importance_rank,
        -float(score if isinstance(score, int | float) else 0),
        -float(frequency if isinstance(frequency, int | float) else 0),
        _origin_title(origin).lower(),
    )


def _benchmark_requirements(goal: str, benchmark_context: dict[str, Any] | None, desired_course_count: int) -> list[dict[str, Any]]:
    if not isinstance(benchmark_context, dict):
        return []

    origins = sorted(_items(benchmark_context.get("requirementOrigins")), key=_origin_sort_key)
    if not origins:
        return []

    max_requirements = max(desired_course_count, min(24, len(origins)))
    requirements: list[dict[str, Any]] = []
    used_titles: set[str] = set()

    for index, origin in enumerate(origins, start=1):
        title = _origin_title(origin)
        title_key = title.lower()
        if title_key in used_titles:
            continue
        used_titles.add(title_key)
        course_id = _stable_id("course", goal, title, str(index))
        requirements.append(
            {
                "id": _stable_id("req", course_id),
                "type": "complete_course",
                "title": f"{title} Course",
                "courseId": course_id,
                "estimatedHours": 30,
                "required": str(origin.get("importance") or "required") != "optional",
                "importance": str(origin.get("importance") or "required"),
                "origin": origin,
            }
        )
        if len(requirements) >= max_requirements:
            break

    return requirements


def _program_field(goal: str, requirements: list[dict[str, Any]]) -> str:
    blob = " ".join([goal, *(str(requirement.get("title") or "") for requirement in requirements)]).lower()
    if any(term in blob for term in ("software", "full stack", "frontend", "backend", "api", "react")):
        return "Software Engineering"
    if any(term in blob for term in ("data science", "statistics", "analytics", "visualization", "modeling")):
        return "Data Science"
    if any(term in blob for term in ("chemistry", "chemical", "stoichiometry", "atomic", "bonding")):
        return "Chemistry"
    if any(term in blob for term in ("public health", "epidemiology", "population health", "health policy")):
        return "Public Health"
    return "Interdisciplinary Learning"


def _program_type(goal: str, field: str) -> str:
    blob = f"{goal} {field}".lower()
    if any(term in blob for term in ("engineer", "developer", "career", "professional")):
        return "career_path"
    if any(term in blob for term in ("degree", "college", "chemistry", "public health")):
        return "degree_equivalent"
    return "certificate"


def _group_key_for_requirement(requirement: dict[str, Any]) -> str:
    title = str(requirement.get("title") or "").lower()
    for group_id, _display_name, _kind, keywords in PROGRAM_GROUP_RULES:
        if any(keyword in title for keyword in keywords):
            return group_id
    return "group-core"


def _fallback_group_plan(requirements: list[dict[str, Any]]) -> list[tuple[str, str, str, list[dict[str, Any]]]]:
    foundation, core, elective = _split_requirements(requirements)
    return [
        ("group-foundations", "Foundations", "foundation", foundation),
        ("group-core", "Core Requirements", "cluster", core),
        ("group-applied-practice", "Applied Practice", "cluster", elective),
    ]


def _group_requirements(requirements: list[dict[str, Any]]) -> list[tuple[str, str, str, list[dict[str, Any]]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for requirement in requirements:
        grouped.setdefault(_group_key_for_requirement(requirement), []).append(requirement)

    ordered_groups: list[tuple[str, str, str, list[dict[str, Any]]]] = []
    for group_id, display_name, kind, _keywords in PROGRAM_GROUP_RULES:
        rows = grouped.pop(group_id, [])
        if rows:
            ordered_groups.append((group_id, display_name, kind, rows))
    if grouped.get("group-core"):
        ordered_groups.append(("group-core", "Core Requirements", "cluster", grouped["group-core"]))
    if len(ordered_groups) < 3:
        return _fallback_group_plan(requirements)
    return ordered_groups


def _group_outcome(group_id: str, display_name: str) -> dict[str, str]:
    return {
        "id": f"{group_id}-outcome",
        "statement": f"Complete the {display_name.lower()} requirements and explain how they support the program outcome.",
    }


def _requirement_group(group_id: str, display_name: str, kind: str, requirements: list[dict[str, Any]], prerequisite_group_id: str | None = None) -> dict[str, Any]:
    group: dict[str, Any] = {
        "id": group_id,
        "displayName": display_name,
        "groupKind": kind,
        "purpose": f"Build capability in {display_name.lower()} through source-backed requirements.",
        "learningOutcomes": [_group_outcome(group_id, display_name)],
        "requirements": requirements,
        "completionRule": {"type": "complete_all"},
        "estimatedHours": sum(float(req.get("estimatedHours") or 0) for req in requirements),
    }
    if prerequisite_group_id:
        group["prerequisites"] = [{"nodeId": prerequisite_group_id, "type": "required"}]
    return group


def _split_requirements(requirements: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    foundation = requirements[:2]
    core = requirements[2:4] or requirements[:2]
    elective = requirements[4:] or requirements[-2:]
    return foundation, core, elective


def _build_program(goal: str, level: str | None, desired_course_count: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    program, course_requirements, _synthesis = build_program_contract(goal, level, desired_course_count)
    return program, course_requirements


def _known_course_records(session: Session) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for snapshot in session.query(CourseSnapshot).limit(500).all():
        structure = snapshot.structure if isinstance(snapshot.structure, dict) else {}
        course_id = structure.get("courseId") or structure.get("id") or structure.get("key")
        modules = structure.get("modules") if isinstance(structure.get("modules"), list) else []
        module_titles: list[str] = []
        section_titles: list[str] = []
        concept_titles: list[str] = []
        for module in modules:
            if not isinstance(module, dict):
                continue
            if isinstance(module.get("title"), str):
                module_titles.append(module["title"])
            sections = module.get("sections") if isinstance(module.get("sections"), list) else []
            for section in sections:
                if not isinstance(section, dict):
                    continue
                if isinstance(section.get("title"), str):
                    section_titles.append(section["title"])
                content = section.get("content") if isinstance(section.get("content"), list) else []
                for block in content:
                    if not isinstance(block, dict) or block.get("type") != "conceptCard":
                        continue
                    concept_title = block.get("title") or block.get("name")
                    if isinstance(concept_title, str):
                        concept_titles.append(concept_title)
        records.append({
            "courseId": str(course_id or f"snapshot-{snapshot.id}"),
            "title": snapshot.title,
            "snapshotId": snapshot.id,
            "status": snapshot.status,
            "shortDescription": structure.get("shortDescription"),
            "category": structure.get("category"),
            "department": structure.get("department"),
            "tags": structure.get("tags") if isinstance(structure.get("tags"), list) else [],
            "moduleTitles": module_titles[:40],
            "sectionTitles": section_titles[:120],
            "conceptTitles": concept_titles[:120],
        })
    return records


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
    indexed_source_documents = source_documents_from_index_snapshots(session, source_urls=source_urls or []) if source_urls else []
    benchmark_context = compile_curriculum_benchmark_context(
        prompt=goal,
        source_urls=source_urls or [],
        fetch_sources=False,
        source_documents=indexed_source_documents,
    )
    known_courses = _known_course_records(session)
    program_stage = run_program_generation_workflow(
        goal=goal,
        level=level,
        desired_course_count=desired_course_count,
        benchmark_context=benchmark_context,
        known_courses=known_courses,
    )
    program = program_stage["artifacts"]["program"]
    course_requirements = program_stage["artifacts"]["courseRequirements"]
    program_synthesis = program_stage["artifacts"]["programSynthesis"]
    cluster_stage = run_cluster_generation_workflow(program)
    wrapper_stage = run_course_wrapper_generation_workflow(
        program,
        known_courses=known_courses,
        course_scaffold_plan=program_synthesis.get("courseScaffoldPlan")
        if isinstance(program_synthesis.get("courseScaffoldPlan"), dict)
        else None,
    )
    program_synthesis["courseScaffoldPlan"] = wrapper_stage["artifacts"]["courseScaffoldPlan"]
    stage_workflows = [
        compact_stage_workflow_report(program_stage),
        compact_stage_workflow_report(cluster_stage),
        compact_stage_workflow_report(wrapper_stage),
    ]
    if program_stage["status"] == "failed":
        validation_errors = [issue["message"] for issue in program_stage["issues"] if issue.get("severity") == "error"]
    else:
        validation_errors = validate_program_contract(program)
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
            "programSynthesis": program_synthesis,
            "stageWorkflows": stage_workflows,
        },
        "contractValidation": {
            "passed": len(validation_errors) == 0,
            "errors": validation_errors,
        },
    }
    quality_report = assess_program_quality(structure)
    structure["qualityReport"] = quality_report
    structure["generationTrace"]["timeline"] = build_program_generation_timeline(structure)
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
    materialize_program_course_scaffold(
        session,
        program=program,
        structure=structure,
        learner_id=learner_id,
        level=level,
        source_policy=source_policy,
    )
    session.flush()
    return program


def validate_learner_exists(session: Session, learner_id: int | None) -> None:
    if learner_id is None:
        return
    learner = session.get(Learner, learner_id)
    if learner is None:
        raise ValueError(f"learner_id '{learner_id}' does not exist")
