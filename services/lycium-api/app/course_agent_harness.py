
from __future__ import annotations

from app.config import SETTINGS
from app.course_agent_assembly import (
    CourseGenerationCheckpoint,
_input_source_records,
_merge_input_sources,
_model_json,
_base_agent_trace,
_partial_course_from_stages,
_emit_checkpoint,
_module_lesson_titles,
_coerce_generated_section,
_coerce_media_block,
_insert_media_block,
_coerce_plan_modules,
)
from app.course_agent_contract import normalize_course, validate_course_contract
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context

from app.course_agent_assessment_prompting import _staged_quiz_messages, _staged_summary_messages
from app.course_agent_lesson_prompting import _staged_lesson_messages, _staged_media_messages
from app.course_agent_prompting import _llm_messages, _staged_plan_messages, load_behavioral_contract
from app.course_agent_providers import (
    assess_agent_model_capability,
    call_agent_model,
    detect_local_agent_endpoint,
    get_agent_provider,
    list_agent_provider_summaries,
    validate_agent_api_key,
)
from app.course_agent_response import extract_message_content, json_from_model_text
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


def generate_course_with_agent_staged(
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
    on_checkpoint: CourseGenerationCheckpoint | None = None,
) -> CourseAgentResult:
    benchmark_context = compile_curriculum_benchmark_context(
        prompt=prompt,
        source_urls=source_urls,
        category=category,
        department=department,
        fetch_sources=True,
    )
    provider = get_agent_provider(provider_id)
    selected_model = model or provider.get("defaultModel") or SETTINGS.agent_model
    model_capability = assess_agent_model_capability(provider, str(selected_model))
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    trace = {
        **_base_agent_trace(
            provider=provider,
            adapter=adapter,
            selected_model=str(selected_model),
            model_capability=model_capability,
            mode="staged-llm-agent",
            desired_module_count=desired_module_count,
            expected_duration_minutes=expected_duration_minutes,
            source_urls=source_urls,
        ),
        "stages": [],
        "curriculum_benchmark_context": benchmark_context,
    }
    try:
        plan, plan_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=str(selected_model),
            stage="course_plan",
            messages=_staged_plan_messages(
                prompt=prompt,
                level=level,
                language=language,
                desired_module_count=desired_module_count,
                expected_duration_minutes=expected_duration_minutes,
                source_policy=source_policy,
                category=category,
                department=department,
                source_urls=source_urls,
                benchmark_context=benchmark_context,
            ),
        )
    except CourseAgentError as exc:
        trace["stages"].append({"stage": "course_plan", "status": "failed", "error": str(exc)})
        raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {})}) from exc
    trace["stages"].append({"stage": "course_plan", "status": "passed"})

    title = str(plan.get("title") or "Generated course")
    source_records = _input_source_records(source_urls, title)
    source_ids = [str(record["id"]) for record in source_records]
    module_outlines = _coerce_plan_modules(plan, desired_module_count)
    modules: list[dict] = []
    module_usage: list[dict] = []
    _emit_checkpoint(
        on_checkpoint,
        trace=trace,
        partial_course=_partial_course_from_stages(
            plan=plan,
            source_records=source_records,
            modules=modules,
            level=level,
            category=category,
            department=department,
        ),
    )

    for index, module_outline in enumerate(module_outlines, start=1):
        module_id = str(module_outline.get("id") or f"module-{index}")
        module_title = str(module_outline.get("title") or f"Module {index}")
        sections: list[dict] = []

        for lesson_index, lesson_title in enumerate(_module_lesson_titles(module_outline), start=1):
            stage = f"module_{index}_lesson_{lesson_index}"
            try:
                section, section_response = _model_json(
                    provider=provider,
                    api_key=api_key,
                    adapter=adapter,
                    model=str(selected_model),
                    stage=stage,
                    messages=_staged_lesson_messages(
                        plan=plan,
                        module_outline=module_outline,
                        module_number=index,
                        lesson_number=lesson_index,
                        lesson_title=lesson_title,
                        source_urls=source_urls,
                    ),
                )
            except CourseAgentError as exc:
                partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
                partial_course = _partial_course_from_stages(
                    plan=plan,
                    source_records=source_records,
                    modules=[*modules, partial_module],
                    level=level,
                )
                trace["stages"].append(
                    {
                        "stage": stage,
                        "status": "failed",
                        "module_outline": module_outline,
                        "completed_module_count": len(modules),
                        "completed_section_count": len(sections),
                        "error": str(exc),
                    }
                )
                raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {}), "partial_course": partial_course}) from exc
            section = _coerce_generated_section(
                section,
                fallback_id=f"module-{index}-lesson-{lesson_index}",
                fallback_title=lesson_title,
                page_type="learn",
                section_type="lesson",
                source_ids=source_ids,
            )
            sections.append(section)
            module_usage.append({"stage": stage, "usage": section_response.get("usage", {})})
            trace["stages"].append({"stage": stage, "status": "passed", "section_id": section.get("id"), "section_title": section.get("title")})
            _emit_checkpoint(
                on_checkpoint,
                trace=trace,
                partial_course=_partial_course_from_stages(
                    plan=plan,
                    source_records=source_records,
                    modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                    level=level,
                ),
            )

        media_stage = f"module_{index}_media"
        try:
            media_payload, media_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage=media_stage,
                messages=_staged_media_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=index,
                    lesson_sections=sections,
                    source_urls=source_urls,
                ),
            )
            media_block, media_skip_reason = _coerce_media_block(media_payload, source_ids)
            if media_block and _insert_media_block(sections, media_block):
                module_usage.append({"stage": media_stage, "usage": media_response.get("usage", {})})
                trace["stages"].append({"stage": media_stage, "status": "passed", "block_title": media_block.get("title")})
            else:
                trace.setdefault("media_logs", []).append(
                    {
                        "stage": media_stage,
                        "status": "skipped",
                        "module_id": module_id,
                        "module_title": module_title,
                        "reason": media_skip_reason or "Media block could not be inserted.",
                    }
                )
                trace["stages"].append({"stage": media_stage, "status": "skipped", "reason": media_skip_reason})
        except CourseAgentError as exc:
            trace.setdefault("media_logs", []).append(
                {
                    "stage": media_stage,
                    "status": "failed_nonfatal",
                    "module_id": module_id,
                    "module_title": module_title,
                    "error": str(exc),
                    "trace": getattr(exc, "trace", {}),
                }
            )
            trace["stages"].append({"stage": media_stage, "status": "failed_nonfatal", "error": str(exc)})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                level=level,
            ),
        )

        quiz_stage = f"module_{index}_quiz"
        try:
            quiz_section, quiz_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage=quiz_stage,
                messages=_staged_quiz_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=index,
                    lesson_sections=sections,
                    source_urls=source_urls,
                ),
            )
        except CourseAgentError as exc:
            partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
            partial_course = _partial_course_from_stages(plan=plan, source_records=source_records, modules=[*modules, partial_module], level=level)
            trace["stages"].append(
                {
                    "stage": quiz_stage,
                    "status": "failed",
                    "module_outline": module_outline,
                    "completed_module_count": len(modules),
                    "completed_section_count": len(sections),
                    "error": str(exc),
                }
            )
            raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {}), "partial_course": partial_course}) from exc
        quiz_section = _coerce_generated_section(
            quiz_section,
            fallback_id=f"module-{index}-quiz",
            fallback_title=f"Quiz: {module_title}",
            page_type="apply",
            section_type="assessment",
            source_ids=source_ids,
        )
        sections.append(quiz_section)
        module_usage.append({"stage": quiz_stage, "usage": quiz_response.get("usage", {})})
        trace["stages"].append({"stage": quiz_stage, "status": "passed", "section_id": quiz_section.get("id")})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                level=level,
            ),
        )

        summary_stage = f"module_{index}_summary"
        try:
            summary_section, summary_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage=summary_stage,
                messages=_staged_summary_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=index,
                    lesson_sections=sections,
                    source_urls=source_urls,
                ),
            )
        except CourseAgentError as exc:
            partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
            partial_course = _partial_course_from_stages(plan=plan, source_records=source_records, modules=[*modules, partial_module], level=level)
            trace["stages"].append(
                {
                    "stage": summary_stage,
                    "status": "failed",
                    "module_outline": module_outline,
                    "completed_module_count": len(modules),
                    "completed_section_count": len(sections),
                    "error": str(exc),
                }
            )
            raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {}), "partial_course": partial_course}) from exc
        summary_section = _coerce_generated_section(
            summary_section,
            fallback_id=f"module-{index}-summary",
            fallback_title=f"Module {index} Concept Review",
            page_type="learn",
            section_type="summary",
            source_ids=source_ids,
        )
        sections.append(summary_section)
        module_usage.append({"stage": summary_stage, "usage": summary_response.get("usage", {})})
        trace["stages"].append({"stage": summary_stage, "status": "passed", "section_id": summary_section.get("id")})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=[*modules, {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}],
                level=level,
            ),
        )

        module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
        modules.append(module)
        trace["stages"].append({"stage": f"module_{index}", "status": "assembled", "module_id": module_id, "module_title": module_title})
        _emit_checkpoint(
            on_checkpoint,
            trace=trace,
            partial_course=_partial_course_from_stages(plan=plan, source_records=source_records, modules=modules, level=level),
        )

    resolved_department = str(department or plan.get("department") or "").strip()
    course_payload = {
        "title": title,
        "shortDescription": str(plan.get("shortDescription") or f"A structured Lycium course for {title}."),
        "difficultyLevel": str(plan.get("difficultyLevel") or level or "undergrad"),
        "category": str(category or plan.get("category") or "interdisciplinary-studies"),
        "tags": plan.get("tags") if isinstance(plan.get("tags"), list) else [],
        "learningTypes": [],
        "orderMandatory": False,
        "sourceIds": source_ids,
        "sourceRecords": source_records,
        "metadata": {
            "pacingLabel": "Module",
            "scope": plan.get("scope") if isinstance(plan.get("scope"), dict) else {},
            "generationPlan": {
                "status": ["scope_drafted", "modules_drafted"],
                "mode": "staged-llm-agent",
                "moduleOutlines": module_outlines,
            },
        },
        "modules": modules,
    }
    if resolved_department:
        course_payload["department"] = resolved_department
    course = attach_curriculum_context(normalize_course(course_payload), benchmark_context)
    validation_errors = validate_course_contract(course)
    if validation_errors and enforce_contract:
        raise CourseAgentError(
            "Generated course failed contract validation: " + "; ".join(validation_errors[:12]),
            trace={**trace, "partial_course": course},
        )

    return CourseAgentResult(
        course=course,
        trace={
            **trace,
            "validation": {"status": "failed" if validation_errors else "passed", "errors": validation_errors},
            "usage": {"plan": plan_response.get("usage", {}), "modules": module_usage},
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
    "validate_agent_api_key",
]
