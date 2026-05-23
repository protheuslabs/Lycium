from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.generation_helpers import _stable_id, _title_from_prompt
from app.models import CourseSnapshot, Learner, ProgramSnapshot
from app.retrieval import assemble_learning_packet, tokenize


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
) -> ProgramSnapshot:
    core_terms = [term for term in tokenize(goal) if len(term) > 3][:desired_course_count]
    if not core_terms:
        core_terms = ["foundation", "practice", "project"]

    courses = []
    for idx, term in enumerate(core_terms[:desired_course_count], start=1):
        packet = assemble_learning_packet(
            session,
            query=f"{goal} {term}",
            top_k=8,
            free_only=free_only,
            trust_min=trust_min,
            level=level,
        )
        courses.append(
            {
                "course_id": _stable_id("course", goal, term, str(idx)),
                "title": f"{term.title()} Track",
                "milestone_order": idx,
                "capstone": idx == len(core_terms[:desired_course_count]),
                "learning_packet": packet,
            }
        )

    structure = {
        "goal": goal,
        "level": level,
        "source_policy": source_policy,
        "courses": courses,
        "credential_checkpoints": [
            {"name": "Foundation checkpoint", "after_milestone": 1},
            {"name": "Capstone checkpoint", "after_milestone": len(courses)},
        ],
    }
    program = ProgramSnapshot(
        learner_id=learner_id,
        title=f"Program: {_title_from_prompt(goal)}",
        goal=goal,
        level=level,
        status="generated",
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
