from __future__ import annotations

import json
from pathlib import Path

from app.config import SETTINGS
from app.course_agent_contract import normalize_course, validate_course_contract
from app.course_agent_providers import (
    call_agent_model,
    get_agent_provider,
    list_agent_provider_summaries,
    validate_agent_api_key,
)
from app.course_agent_response import extract_message_content, json_from_model_text
from app.course_agent_types import CourseAgentError, CourseAgentResult

CONTRACT_PATH = Path(__file__).resolve().parents[3] / "COURSE_AGENT_CONTRACT.md"


def load_behavioral_contract() -> str:
    return CONTRACT_PATH.read_text(encoding="utf-8")


def _llm_messages(
    *,
    prompt: str,
    level: str | None,
    language: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    source_policy: str,
) -> list[dict[str, str]]:
    user_contract = {
        "prompt": prompt,
        "level": level,
        "language": language,
        "desired_module_count": desired_module_count,
        "expected_duration_minutes": expected_duration_minutes,
        "source_policy": source_policy,
        "course_short_description": "Return a top-level shortDescription: one concise sentence for catalog cards.",
        "course_shape": "Lycium course JSON with learn/apply pages, conceptCards, sourceRecords, and quiz-only assessment pages.",
    }

    return [
        {
            "role": "system",
            "content": (
                f"{load_behavioral_contract()}\n\n"
                "Return only one valid JSON object. Do not wrap it in markdown. "
                "Prefer 2-4 learn sections, 1 quiz-only apply section, and 1 summary section per module unless the prompt requires more."
            ),
        },
        {"role": "user", "content": json.dumps(user_contract, indent=2)},
    ]


def generate_course_with_agent(
    *,
    prompt: str,
    api_key: str,
    provider_id: str,
    level: str | None,
    language: str,
    source_policy: str,
    desired_module_count: int,
    expected_duration_minutes: int,
    model: str | None = None,
) -> CourseAgentResult:
    messages = _llm_messages(
        prompt=prompt,
        level=level,
        language=language,
        source_policy=source_policy,
        desired_module_count=desired_module_count,
        expected_duration_minutes=expected_duration_minutes,
    )
    provider = get_agent_provider(provider_id)
    selected_model = model or provider.get("defaultModel") or SETTINGS.agent_model
    response = call_agent_model(provider, api_key, messages, selected_model)
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    raw_course = json_from_model_text(extract_message_content(response, adapter))
    course = normalize_course(raw_course)
    validation_errors = validate_course_contract(course)
    if validation_errors:
        raise CourseAgentError("Generated course failed contract validation: " + "; ".join(validation_errors[:12]))

    return CourseAgentResult(
        course=course,
        trace={
            "mode": "llm-agent",
            "provider": provider.get("id"),
            "provider_label": provider.get("label"),
            "generation_adapter": adapter,
            "model": selected_model,
            "behavioral_contract": "COURSE_AGENT_CONTRACT.md",
            "desired_module_count": desired_module_count,
            "expected_duration_minutes": expected_duration_minutes,
            "validation": {"status": "passed"},
            "usage": response.get("usage", {}),
        },
    )


__all__ = [
    "CourseAgentError",
    "CourseAgentResult",
    "generate_course_with_agent",
    "get_agent_provider",
    "list_agent_provider_summaries",
    "load_behavioral_contract",
    "validate_agent_api_key",
]
