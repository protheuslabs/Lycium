from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from app.config import SETTINGS
from app.course_agent_assembly import (
    CourseGenerationCheckpoint,
    _base_agent_trace,
    _coerce_generated_section,
    _coerce_media_block,
    _coerce_plan_modules,
    _emit_checkpoint,
    _input_source_records,
    _insert_media_block,
    _model_json,
    _module_lesson_titles,
    _partial_course_from_stages,
)
from app.course_agent_assessment_prompting import _staged_quiz_messages, _staged_summary_messages
from app.course_agent_contract import normalize_course, validate_course_contract
from app.course_agent_lesson_prompting import _staged_lesson_messages, _staged_media_messages
from app.course_agent_prompting import _staged_plan_messages
from app.course_agent_providers import assess_agent_model_capability, get_agent_provider
from app.course_agent_types import CourseAgentError, CourseAgentResult
from app.course_generation_service import validate_generation_taxonomy_input
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context


DEFAULT_MODULE_PARALLELISM = 2


def _infer_pacing_label(plan: dict) -> str:
    explicit = str(plan.get("pacingLabel") or "").strip()
    if explicit in {"Module", "Week"}:
        return explicit
    modules = plan.get("modules") if isinstance(plan.get("modules"), list) else []
    titles = [str(module.get("title") or "") for module in modules if isinstance(module, dict)]
    if any(title.startswith("Week ") for title in titles):
        return "Week"
    return "Module"


def _normalize_summary_for_pacing(summary_section: dict, pacing_label: str) -> dict:
    expected_title = f"{pacing_label} concepts"
    content = summary_section.get("content")
    if isinstance(content, list):
        for block in content:
            if isinstance(block, dict) and block.get("type") in {"conceptCards", "concept_cards"}:
                block["title"] = expected_title
    return summary_section


def _generate_module_bundle(
    *,
    provider: dict,
    api_key: str,
    adapter: str,
    selected_model: str,
    plan: dict,
    module_outline: dict,
    module_number: int,
    source_urls: list[str] | None,
    source_ids: list[str],
    source_records: list[dict[str, object]],
    existing_modules: list[dict],
    level: str | None,
    pacing_label: str,
) -> dict:
    module_id = str(module_outline.get("id") or f"module-{module_number}")
    module_title = str(module_outline.get("title") or f"Module {module_number}")
    sections: list[dict] = []
    module_usage: list[dict] = []
    stages: list[dict] = []
    media_logs: list[dict] = []

    for lesson_index, lesson_title in enumerate(_module_lesson_titles(module_outline), start=1):
        stage = f"module_{module_number}_lesson_{lesson_index}"
        try:
            section, section_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=selected_model,
                stage=stage,
                messages=_staged_lesson_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=module_number,
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
                modules=[*existing_modules, partial_module],
                level=level,
            )
            stages.append(
                {
                    "stage": stage,
                    "status": "failed",
                    "module_outline": module_outline,
                    "completed_section_count": len(sections),
                    "error": str(exc),
                }
            )
            raise CourseAgentError(str(exc), trace={**getattr(exc, "trace", {}), "stages": stages, "partial_course": partial_course}) from exc
        section = _coerce_generated_section(
            section,
            fallback_id=f"module-{module_number}-lesson-{lesson_index}",
            fallback_title=lesson_title,
            page_type="learn",
            section_type="lesson",
            source_ids=source_ids,
        )
        sections.append(section)
        module_usage.append({"stage": stage, "usage": section_response.get("usage", {})})
        stages.append({"stage": stage, "status": "passed", "section_id": section.get("id"), "section_title": section.get("title")})

    media_stage = f"module_{module_number}_media"
    try:
        media_payload, media_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=media_stage,
            messages=_staged_media_messages(
                plan=plan,
                module_outline=module_outline,
                module_number=module_number,
                lesson_sections=sections,
                source_urls=source_urls,
            ),
        )
        media_block, media_skip_reason = _coerce_media_block(media_payload, source_ids)
        if media_block and _insert_media_block(sections, media_block):
            module_usage.append({"stage": media_stage, "usage": media_response.get("usage", {})})
            stages.append({"stage": media_stage, "status": "passed", "block_title": media_block.get("title")})
        else:
            media_logs.append(
                {
                    "stage": media_stage,
                    "status": "skipped",
                    "module_id": module_id,
                    "module_title": module_title,
                    "reason": media_skip_reason or "Media block could not be inserted.",
                }
            )
            stages.append({"stage": media_stage, "status": "skipped", "reason": media_skip_reason})
    except CourseAgentError as exc:
        media_logs.append(
            {
                "stage": media_stage,
                "status": "failed_nonfatal",
                "module_id": module_id,
                "module_title": module_title,
                "error": str(exc),
                "trace": getattr(exc, "trace", {}),
            }
        )
        stages.append({"stage": media_stage, "status": "failed_nonfatal", "error": str(exc)})

    quiz_stage = f"module_{module_number}_quiz"
    try:
        quiz_section, quiz_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=quiz_stage,
            messages=_staged_quiz_messages(
                plan=plan,
                module_outline=module_outline,
                module_number=module_number,
                lesson_sections=sections,
                source_urls=source_urls,
            ),
        )
    except CourseAgentError as exc:
        partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
        partial_course = _partial_course_from_stages(
            plan=plan,
            source_records=source_records,
            modules=[*existing_modules, partial_module],
            level=level,
        )
        stages.append(
            {
                "stage": quiz_stage,
                "status": "failed",
                "module_outline": module_outline,
                "completed_section_count": len(sections),
                "error": str(exc),
            }
        )
        raise CourseAgentError(str(exc), trace={**getattr(exc, "trace", {}), "stages": stages, "partial_course": partial_course}) from exc
    quiz_section = _coerce_generated_section(
        quiz_section,
        fallback_id=f"module-{module_number}-quiz",
        fallback_title=f"Quiz: {module_title}",
        page_type="apply",
        section_type="assessment",
        source_ids=source_ids,
    )
    sections.append(quiz_section)
    module_usage.append({"stage": quiz_stage, "usage": quiz_response.get("usage", {})})
    stages.append({"stage": quiz_stage, "status": "passed", "section_id": quiz_section.get("id")})

    summary_stage = f"module_{module_number}_summary"
    try:
        summary_section, summary_response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=selected_model,
            stage=summary_stage,
                messages=_staged_summary_messages(
                    plan=plan,
                    module_outline=module_outline,
                    module_number=module_number,
                    lesson_sections=sections,
                    source_urls=source_urls,
                    pacing_label=pacing_label,
                ),
            )
    except CourseAgentError as exc:
        partial_module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
        partial_course = _partial_course_from_stages(
            plan=plan,
            source_records=source_records,
            modules=[*existing_modules, partial_module],
            level=level,
        )
        stages.append(
            {
                "stage": summary_stage,
                "status": "failed",
                "module_outline": module_outline,
                "completed_section_count": len(sections),
                "error": str(exc),
            }
        )
        raise CourseAgentError(str(exc), trace={**getattr(exc, "trace", {}), "stages": stages, "partial_course": partial_course}) from exc
    summary_section = _coerce_generated_section(
        summary_section,
        fallback_id=f"module-{module_number}-summary",
        fallback_title=f"{pacing_label} {module_number} Concept Review",
        page_type="learn",
        section_type="summary",
        source_ids=source_ids,
    )
    summary_section = _normalize_summary_for_pacing(summary_section, pacing_label)
    sections.append(summary_section)
    module_usage.append({"stage": summary_stage, "usage": summary_response.get("usage", {})})
    stages.append({"stage": summary_stage, "status": "passed", "section_id": summary_section.get("id")})

    module = {"id": module_id, "title": module_title, "sourceIds": source_ids, "sections": sections}
    stages.append({"stage": f"module_{module_number}", "status": "assembled", "module_id": module_id, "module_title": module_title})
    return {
        "module_number": module_number,
        "module": module,
        "usage": module_usage,
        "stages": stages,
        "media_logs": media_logs,
    }


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
        "module_parallelism": min(DEFAULT_MODULE_PARALLELISM, max(1, desired_module_count)),
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
    pacing_label = _infer_pacing_label(plan)
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

    module_outlines_for_serial = module_outlines
    if len(module_outlines) > 1:
        module_outlines_for_serial = []
        completed_modules: dict[int, dict] = {}
        parallelism = min(DEFAULT_MODULE_PARALLELISM, len(module_outlines))
        with ThreadPoolExecutor(max_workers=parallelism) as executor:
            futures = {
                executor.submit(
                    _generate_module_bundle,
                    provider=provider,
                    api_key=api_key,
                    adapter=adapter,
                    selected_model=str(selected_model),
                    plan=plan,
                    module_outline=module_outline,
                    module_number=index,
                    source_urls=source_urls,
                    source_ids=source_ids,
                    source_records=source_records,
                    existing_modules=[],
                    level=level,
                    pacing_label=pacing_label,
                ): index
                for index, module_outline in enumerate(module_outlines, start=1)
            }
            for future in as_completed(futures):
                index = futures[future]
                try:
                    result = future.result()
                except CourseAgentError as exc:
                    for pending in futures:
                        pending.cancel()
                    partial_modules = [completed_modules[key] for key in sorted(completed_modules)]
                    partial_course = _partial_course_from_stages(
                        plan=plan,
                        source_records=source_records,
                        modules=partial_modules,
                        level=level,
                    )
                    failed_trace = getattr(exc, "trace", {})
                    trace["stages"].extend(failed_trace.get("stages", []) if isinstance(failed_trace, dict) else [])
                    raise CourseAgentError(str(exc), trace={**trace, **failed_trace, "partial_course": partial_course}) from exc

                completed_modules[index] = result["module"]
                module_usage.extend(result["usage"])
                trace["stages"].extend(result["stages"])
                if result["media_logs"]:
                    trace.setdefault("media_logs", []).extend(result["media_logs"])
                modules = [completed_modules[key] for key in sorted(completed_modules)]
                _emit_checkpoint(
                    on_checkpoint,
                    trace=trace,
                    partial_course=_partial_course_from_stages(plan=plan, source_records=source_records, modules=modules, level=level),
                )

    for index, module_outline in enumerate(module_outlines_for_serial, start=1):
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
                partial_course = _partial_course_from_stages(plan=plan, source_records=source_records, modules=[*modules, partial_module], level=level)
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
                    pacing_label=pacing_label,
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
            fallback_title=f"{pacing_label} {index} Concept Review",
            page_type="learn",
            section_type="summary",
            source_ids=source_ids,
        )
        summary_section = _normalize_summary_for_pacing(summary_section, pacing_label)
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
            "pacingLabel": pacing_label,
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
