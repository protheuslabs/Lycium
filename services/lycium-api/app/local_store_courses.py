
from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.course_health import summarize_course_health
from app.local_store_core import _now, _read_json, _safe_key, _write_json, ensure_local_data_dirs

VALID_SECTION_STATUSES = {"completed", "locked", "seen", "timed"}
_PRESERVE_FEEDBACK_RATING = object()


def save_course_snapshot(course: Any) -> None:
    course_id = getattr(course, "id", None)
    if course_id is None:
        return

    payload = {
        "id": course.id,
        "title": course.title,
        "prompt": course.prompt,
        "language": course.language,
        "level": course.level,
        "source_policy": course.source_policy,
        "status": course.status,
        "version": course.version,
        "structure": course.structure,
        "generation_trace": course.generation_trace,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
        "saved_at": _now(),
    }
    _write_json(ensure_local_data_dirs() / "courses" / f"course-{course.id}.json", payload)


def save_learner_record(learner: Any) -> None:
    learner_id = getattr(learner, "id", None)
    if learner_id is None:
        return

    path = ensure_local_data_dirs() / "user" / "learners.json"
    payload = _read_json(path, {"learners": {}})
    payload.setdefault("learners", {})
    payload["learners"][str(learner.id)] = {
        "id": learner.id,
        "name": learner.name,
        "goal": learner.goal,
        "level": learner.level,
        "preferences": learner.preferences,
        "created_at": learner.created_at,
        "updated_at": _now(),
    }
    _write_json(path, payload)


def _bookmarks_path() -> Path:
    return ensure_local_data_dirs() / "user" / "course-bookmarks.json"


def _feedback_path() -> Path:
    return ensure_local_data_dirs() / "user" / "course-feedback.json"


def _normalize_completed_section_ids(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    completed_section_ids: list[str] = []
    seen: set[str] = set()
    for entry in value:
        if not isinstance(entry, str):
            continue
        section_id = entry.strip()
        if not section_id or section_id in seen:
            continue
        seen.add(section_id)
        completed_section_ids.append(section_id)
    return completed_section_ids


def _normalize_section_statuses(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}

    statuses: dict[str, str] = {}
    for section_id, status_value in value.items():
        if not isinstance(section_id, str):
            continue
        clean_section_id = section_id.strip()
        if not clean_section_id or not isinstance(status_value, str):
            continue
        clean_status = status_value.strip()
        if clean_status in VALID_SECTION_STATUSES:
            statuses[clean_section_id] = clean_status
    return statuses


def read_course_bookmark(course_key: str) -> dict[str, Any]:
    payload = _read_json(_bookmarks_path(), {"courses": {}})
    bookmark = payload.get("courses", {}).get(course_key)
    if not isinstance(bookmark, dict):
        return {
            "course_key": course_key,
            "course_title": None,
            "section_id": None,
            "section_title": None,
            "path": None,
            "updated_at": None,
        }

    return {
        "course_key": course_key,
        "course_title": bookmark.get("course_title"),
        "section_id": bookmark.get("section_id"),
        "section_title": bookmark.get("section_title"),
        "path": bookmark.get("path"),
        "updated_at": bookmark.get("updated_at"),
    }


def save_course_bookmark(
    *,
    course_key: str,
    course_title: str | None,
    section_id: str,
    section_title: str | None,
    path: str,
) -> dict[str, Any]:
    bookmarks_path = _bookmarks_path()
    payload = _read_json(bookmarks_path, {"courses": {}})
    payload.setdefault("courses", {})
    bookmark = {
        "course_key": course_key,
        "course_title": course_title,
        "section_id": section_id,
        "section_title": section_title,
        "path": path,
        "updated_at": _now(),
    }
    payload["courses"][course_key] = bookmark
    payload["last_course_key"] = course_key
    payload["updated_at"] = bookmark["updated_at"]
    _write_json(bookmarks_path, payload)
    return bookmark


def read_course_feedback(course_key: str) -> dict[str, Any]:
    payload = _read_json(_feedback_path(), {"courses": {}})
    feedback = payload.get("courses", {}).get(course_key)
    if not isinstance(feedback, dict):
        return {
            "course_key": course_key,
            "course_title": None,
            "rating": None,
            "rating_events": [],
            "feedback_notes": [],
            "source_suggestions": [],
            "updated_at": None,
        }
    suggestions = feedback.get("source_suggestions")
    notes = feedback.get("feedback_notes")
    rating_events = feedback.get("rating_events")
    return {
        "course_key": course_key,
        "course_title": feedback.get("course_title"),
        "rating": feedback.get("rating") if feedback.get("rating") in {"up", "down"} else None,
        "rating_events": rating_events if isinstance(rating_events, list) else [],
        "feedback_notes": notes if isinstance(notes, list) else [],
        "source_suggestions": suggestions if isinstance(suggestions, list) else [],
        "updated_at": feedback.get("updated_at"),
    }


def save_course_feedback(
    *,
    course_key: str,
    course_title: str | None,
    rating: str | None | object = _PRESERVE_FEEDBACK_RATING,
    feedback_text: str | None = None,
    feedback_magnitude: int | None = None,
    source_url: str | None = None,
    source_description: str | None = None,
) -> dict[str, Any]:
    feedback_path = _feedback_path()
    payload = _read_json(feedback_path, {"courses": {}})
    payload.setdefault("courses", {})
    current = read_course_feedback(course_key)
    next_feedback = {
        **current,
        "course_key": course_key,
        "course_title": course_title or current.get("course_title"),
        "updated_at": _now(),
    }
    clean_feedback_text = (feedback_text or "").strip()
    clean_feedback_magnitude = feedback_magnitude if feedback_magnitude in {1, 2, 3} else None
    if rating is None:
        next_feedback["rating"] = None
    elif rating in {"up", "down"}:
        next_feedback["rating"] = rating
        if not clean_feedback_text and clean_feedback_magnitude is None:
            rating_events = list(next_feedback.get("rating_events") or [])
            rating_events.append(
                {
                    "id": f"rating-event-{uuid4().hex}",
                    "rating": rating,
                    "created_at": next_feedback["updated_at"],
                }
            )
            next_feedback["rating_events"] = rating_events
    if clean_feedback_text or clean_feedback_magnitude is not None:
        notes = list(next_feedback.get("feedback_notes") or [])
        notes.append(
            {
                "id": f"feedback-note-{uuid4().hex}",
                "rating": rating if rating in {"up", "down"} else next_feedback.get("rating"),
                "feedback_magnitude": clean_feedback_magnitude,
                "text": clean_feedback_text or None,
                "created_at": next_feedback["updated_at"],
            }
        )
        next_feedback["feedback_notes"] = notes
    clean_url = (source_url or "").strip()
    if clean_url:
        suggestions = list(next_feedback.get("source_suggestions") or [])
        suggestions.append(
            {
                "id": f"source-suggestion-{uuid4().hex}",
                "url": clean_url,
                "description": (source_description or "").strip() or None,
                "created_at": next_feedback["updated_at"],
            }
        )
        next_feedback["source_suggestions"] = suggestions
    payload["courses"][course_key] = next_feedback
    payload["updated_at"] = next_feedback["updated_at"]
    _write_json(feedback_path, payload)
    return next_feedback


def read_course_health(course_key: str) -> dict[str, Any]:
    feedback = read_course_feedback(course_key)
    return summarize_course_health(course_key=course_key, feedback=feedback)


def read_completion(course_key: str) -> dict[str, Any]:
    path = ensure_local_data_dirs() / "completion" / f"{_safe_key(course_key)}.json"
    payload = _read_json(
        path,
        {
            "course_key": course_key,
            "course_title": None,
            "completed_section_ids": [],
            "section_statuses": {},
            "updated_at": None,
        },
    )
    section_statuses = _normalize_section_statuses(payload.get("section_statuses"))
    completed_section_ids: list[str] = []
    for section_id in _normalize_completed_section_ids(payload.get("completed_section_ids")):
        stored_status = section_statuses.get(section_id)
        if stored_status and stored_status != "completed":
            continue
        completed_section_ids.append(section_id)
        section_statuses[section_id] = "completed"

    return {
        "course_key": payload.get("course_key") or course_key,
        "course_title": payload.get("course_title"),
        "completed_section_ids": completed_section_ids,
        "section_statuses": section_statuses,
        "updated_at": payload.get("updated_at"),
    }


def save_completion(
    *,
    course_key: str,
    course_title: str | None,
    section_id: str | None,
    completed_section_ids: list[str],
    section_statuses: dict[str, str],
) -> dict[str, Any]:
    current = read_completion(course_key)
    merged_statuses = {
        **_normalize_section_statuses(current.get("section_statuses")),
        **_normalize_section_statuses(section_statuses),
    }
    completed = _normalize_completed_section_ids(
        [
            *current.get("completed_section_ids", []),
            *completed_section_ids,
            *[status_section_id for status_section_id, status in merged_statuses.items() if status == "completed"],
        ]
    )
    for completed_section_id in completed:
        merged_statuses[completed_section_id] = "completed"

    payload = {
        "course_key": course_key,
        "course_title": course_title or current.get("course_title"),
        "completed_section_ids": completed,
        "section_statuses": merged_statuses,
        "updated_at": _now(),
    }
    _write_json(ensure_local_data_dirs() / "completion" / f"{_safe_key(course_key)}.json", payload)
    return payload
