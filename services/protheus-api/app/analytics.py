from __future__ import annotations

from collections import Counter
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CourseSnapshot, LearnerSectionProgress, LearningEvent


def section_ids_from_structure(structure: dict[str, Any]) -> list[str]:
    section_ids: list[str] = []
    for module in structure.get("modules", []):
        for section in module.get("sections", []):
            if section.get("id"):
                section_ids.append(section["id"])
    return section_ids


def upsert_progress(
    session: Session,
    *,
    learner_id: int,
    course_snapshot_id: int,
    section_id: str,
    completion_state: str,
    mastery_score: float,
) -> LearnerSectionProgress:
    row = session.scalar(
        select(LearnerSectionProgress).where(
            LearnerSectionProgress.learner_id == learner_id,
            LearnerSectionProgress.course_snapshot_id == course_snapshot_id,
            LearnerSectionProgress.section_id == section_id,
        )
    )
    if row is None:
        row = LearnerSectionProgress(
            learner_id=learner_id,
            course_snapshot_id=course_snapshot_id,
            section_id=section_id,
            completion_state=completion_state,
            mastery_score=mastery_score,
            attempts=1,
        )
        session.add(row)
    else:
        row.completion_state = completion_state
        row.mastery_score = mastery_score
        row.attempts += 1
    session.flush()
    return row


def record_event(
    session: Session,
    *,
    learner_id: int | None,
    course_snapshot_id: int | None,
    section_id: str | None,
    event_type: str,
    payload: dict[str, Any],
) -> LearningEvent:
    event = LearningEvent(
        learner_id=learner_id,
        course_snapshot_id=course_snapshot_id,
        section_id=section_id,
        event_type=event_type,
        payload=payload,
    )
    session.add(event)
    session.flush()
    return event


def analytics_summary(
    session: Session,
    *,
    course_snapshot: CourseSnapshot,
    learner_id: int | None = None,
) -> dict[str, Any]:
    section_ids = set(section_ids_from_structure(course_snapshot.structure))
    if not section_ids:
        return {
            "course_snapshot_id": course_snapshot.id,
            "completion_rate": 0.0,
            "average_mastery": 0.0,
            "quiz_accuracy": 0.0,
            "most_questioned_sections": [],
            "event_counts": {},
        }

    progress_stmt = select(LearnerSectionProgress).where(
        LearnerSectionProgress.course_snapshot_id == course_snapshot.id
    )
    event_stmt = select(LearningEvent).where(LearningEvent.course_snapshot_id == course_snapshot.id)
    if learner_id is not None:
        progress_stmt = progress_stmt.where(LearnerSectionProgress.learner_id == learner_id)
        event_stmt = event_stmt.where(LearningEvent.learner_id == learner_id)

    progress_rows = list(session.scalars(progress_stmt))
    events = list(session.scalars(event_stmt))

    completed = [
        row
        for row in progress_rows
        if row.section_id in section_ids and row.completion_state in {"completed", "mastered"}
    ]
    completion_rate = round(len({row.section_id for row in completed}) / len(section_ids), 4)

    if progress_rows:
        avg_mastery = round(sum(row.mastery_score for row in progress_rows) / len(progress_rows), 4)
    else:
        avg_mastery = 0.0

    quiz_attempts = [event for event in events if event.event_type == "quiz_submitted"]
    quiz_correct = 0
    for event in quiz_attempts:
        if bool(event.payload.get("is_correct")):
            quiz_correct += 1
    quiz_accuracy = round(quiz_correct / len(quiz_attempts), 4) if quiz_attempts else 0.0

    section_question_counts = Counter(
        event.section_id for event in events if event.event_type == "question_asked" and event.section_id
    )
    most_questioned_sections = [
        {"section_id": section_id, "questions": count}
        for section_id, count in section_question_counts.most_common(5)
    ]

    event_counts = Counter(event.event_type for event in events)
    return {
        "course_snapshot_id": course_snapshot.id,
        "completion_rate": completion_rate,
        "average_mastery": avg_mastery,
        "quiz_accuracy": quiz_accuracy,
        "most_questioned_sections": most_questioned_sections,
        "event_counts": dict(event_counts),
    }


def count_course_events(session: Session, *, course_snapshot_id: int) -> int:
    return int(
        session.scalar(
            select(func.count()).select_from(LearningEvent).where(LearningEvent.course_snapshot_id == course_snapshot_id)
        )
        or 0
    )
