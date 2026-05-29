
from __future__ import annotations

from app.config import SETTINGS
from app.course_agent_assembly import (
    _base_agent_trace,
    _merge_input_sources,
)
from app.course_agent_contract import normalize_course, validate_course_contract
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context

from app.course_agent_prompting import _llm_messages, load_behavioral_contract
from app.course_generation_service import validate_generation_taxonomy_input
from app.course_agent_providers import (
    assess_agent_model_capability,
    call_agent_model,
    detect_local_agent_endpoint,
    get_agent_provider,
    list_agent_provider_summaries,
    looks_like_local_agent_endpoint,
    validate_agent_api_key,
)
from app.course_agent_response import extract_message_content, json_from_model_text
from app.course_agent_staged import generate_course_with_agent_staged
from app.course_agent_types import CourseAgentError, CourseAgentResult


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
    source_urls: list[str] | None = None,
    category: str | None = None,
    department: str | None = None,
    enforce_contract: bool = True,
) -> CourseAgentResult:
    taxonomy_errors = validate_generation_taxonomy_input(category, department)
    if taxonomy_errors:
        raise CourseAgentError("Invalid course generation taxonomy input: " + "; ".join(taxonomy_errors))

    benchmark_context = compile_curriculum_benchmark_context(
        prompt=prompt,
        source_urls=source_urls,
        category=category,
        department=department,
        fetch_sources=True,
    )
    messages = _llm_messages(
        prompt=prompt,
        level=level,
        language=language,
        source_policy=source_policy,
        category=category,
        department=department,
        desired_module_count=desired_module_count,
        expected_duration_minutes=expected_duration_minutes,
        source_urls=source_urls,
        benchmark_context=benchmark_context,
    )
    provider = get_agent_provider(provider_id)
    selected_model = model or provider.get("defaultModel") or SETTINGS.agent_model
    model_capability = assess_agent_model_capability(provider, str(selected_model))
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    base_trace = _base_agent_trace(
        provider=provider,
        adapter=adapter,
        selected_model=str(selected_model),
        model_capability=model_capability,
        mode="llm-agent",
        desired_module_count=desired_module_count,
        expected_duration_minutes=expected_duration_minutes,
        source_urls=source_urls,
    )
    base_trace["curriculum_benchmark_context"] = benchmark_context
    try:
        response = call_agent_model(provider, api_key, messages, selected_model)
    except CourseAgentError as exc:
        raise CourseAgentError(
            str(exc),
            trace={**base_trace, "status": "failed", **getattr(exc, "trace", {})},
        ) from exc
    try:
        raw_course = json_from_model_text(extract_message_content(response, adapter))
    except ValueError as exc:
        raise CourseAgentError(
            f"LLM response could not be parsed as course JSON: {exc}",
            trace={**base_trace, "status": "failed", "failed_stage": "course_generation"},
        ) from exc
    course = attach_curriculum_context(_merge_input_sources(normalize_course(raw_course), source_urls), benchmark_context)
    if category:
        course["category"] = category
    if department:
        course["department"] = department
    validation_errors = validate_course_contract(course)
    if validation_errors and enforce_contract:
        raise CourseAgentError("Generated course failed contract validation: " + "; ".join(validation_errors[:12]))

    return CourseAgentResult(
        course=course,
        trace={
            **base_trace,
            "validation": {"status": "failed" if validation_errors else "passed", "errors": validation_errors},
            "usage": response.get("usage", {}),
        },
    )


__all__ = [
    "CourseAgentError",
    "CourseAgentResult",
    "generate_course_with_agent",
    "generate_course_with_agent_staged",
    "get_agent_provider",
    "list_agent_provider_summaries",
    "load_behavioral_contract",
    "looks_like_local_agent_endpoint",
    "validate_agent_api_key",
]
