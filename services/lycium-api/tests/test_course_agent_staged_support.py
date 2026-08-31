from __future__ import annotations

from app.course_agent_staged_support import _resume_modules_from_course


def test_resume_modules_ignore_empty_planning_shells() -> None:
    resume_course = {
        "modules": [
            {
                "id": "module-empty",
                "title": "Planning shell",
                "sections": [
                    {"id": "section-empty", "title": "Outline only", "content": []},
                ],
            },
            {
                "id": "module-filled",
                "title": "Generated module",
                "sections": [
                    {"id": "section-filled", "title": "Lesson", "content": [{"type": "paragraph", "value": "Real content."}]},
                ],
            },
        ],
    }

    resumed = _resume_modules_from_course(resume_course, desired_module_count=2)

    assert resumed == []


def test_resume_modules_keep_filled_prefix() -> None:
    resume_course = {
        "modules": [
            {
                "id": "module-filled",
                "title": "Generated module",
                "sections": [
                    {"id": "section-filled", "title": "Lesson", "content": [{"type": "paragraph", "value": "Real content."}]},
                ],
            },
            {
                "id": "module-empty",
                "title": "Planning shell",
                "sections": [
                    {"id": "section-empty", "title": "Outline only", "content": []},
                ],
            },
        ],
    }

    resumed = _resume_modules_from_course(resume_course, desired_module_count=2)

    assert [module["id"] for module in resumed] == ["module-filled"]
