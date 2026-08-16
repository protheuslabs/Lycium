from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

from app.routes.course_generation_responses import course_generation_job_response


def _job(
    result: dict,
    payload: dict | None = None,
    *,
    status: str = "running",
    error: str | None = None,
) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=1,
        status=status,
        payload=payload or {"prompt": "Generate me a course about macroeconomics"},
        result=result,
        error=error,
        created_at=now,
        updated_at=now,
    )


def test_course_generation_job_response_exposes_plan_title_as_working_title() -> None:
    response = course_generation_job_response(
        _job(
            {
                "current_stage": "course_module_outline_generation",
                "progress": 0.08,
                "trace": {"plan": {"title": "Principles of Macroeconomics"}},
            }
        )
    )

    assert response["working_title"] == "Principles of Macroeconomics"


def test_course_generation_job_response_does_not_use_prompt_as_working_title() -> None:
    response = course_generation_job_response(
        _job(
            {
                "current_stage": "course_template_generation",
                "progress": 0.0,
                "trace": {"mode": "staged-llm-agent", "stages": []},
            }
        )
    )

    assert response["working_title"] is None


def test_course_generation_job_response_prefers_partial_course_title() -> None:
    response = course_generation_job_response(
        _job(
            {
                "current_stage": "module_section_plan_generation",
                "progress": 0.16,
                "course": {"title": "Microeconomics: Choice and Markets"},
                "trace": {"plan": {"title": "Fallback Plan Title"}},
            }
        )
    )

    assert response["working_title"] == "Microeconomics: Choice and Markets"


def test_course_generation_job_response_humanizes_provider_errors() -> None:
    response = course_generation_job_response(
        _job(
            {"current_stage": "section_fill_generation", "progress": 0.45, "message": "Course generation failed."},
            status="failed",
            error="LLM API rejected the request after 1 attempt(s): 402 Payment Required: this model uses extra usage only and your extra usage balance is empty.",
        )
    )

    assert response["error"].startswith("LLM API rejected")
    assert response["user_error"] == (
        "The selected model needs extra credits or billing before it can generate this course. "
        "Choose another model or add credits, then try again."
    )
    assert response["message"] == response["user_error"]
