from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from app.config import SETTINGS
from app.course_agent_assembly import (
    CourseGenerationCheckpoint,
    _base_agent_trace,
    _coerce_plan_modules,
    _emit_checkpoint,
    _input_source_records,
    _partial_course_from_stages,
)
from app.course_agent_contract import normalize_course, validate_course_contract
from app.course_agent_prompting import _staged_plan_messages
from app.course_agent_providers import assess_agent_model_capability, get_agent_provider
from app.course_agent_types import CourseAgentError, CourseAgentResult
from app.course_generation_service import validate_generation_taxonomy_input
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context
from app.source_corpus import compile_generation_source_corpus


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
    source_packet_id: int | str | None = None,
    source_packet: dict | None = None,
    category: str | None = None,
    department: str | None = None,
    enforce_contract: bool = True,
    on_checkpoint: CourseGenerationCheckpoint | None = None,
    resume_course: dict | None = None,
    resume_trace: dict | None = None,
) -> CourseAgentResult:
    taxonomy_errors = validate_generation_taxonomy_input(category, department)
    if taxonomy_errors:
        raise CourseAgentError("Invalid course generation taxonomy input: " + "; ".join(taxonomy_errors))

    source_corpus = compile_generation_source_corpus(
        prompt=prompt,
        source_urls=source_urls,
        fetch_sources=True,
        source_packet_id=source_packet_id,
        source_packet=source_packet,
    )
    effective_source_urls = source_corpus.source_urls
    benchmark_context = compile_curriculum_benchmark_context(
        prompt=prompt,
        source_urls=effective_source_urls,
        category=category,
        department=department,
        fetch_sources=False,
        source_documents=source_corpus.source_documents,
        source_corpus_synthesis=source_corpus.synthesis,
    )
    provider = get_agent_provider(provider_id)
    selected_model = model or provider.get("defaultModel") or SETTINGS.agent_model
    model_capability = assess_agent_model_capability(provider, str(selected_model))
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    previous_trace = _resume_trace(resume_trace)
    previous_stages = previous_trace.get("stages") if isinstance(previous_trace.get("stages"), list) else []
    previous_media_logs = previous_trace.get("media_logs") if isinstance(previous_trace.get("media_logs"), list) else []
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
        "stages": list(previous_stages),
        "curriculum_benchmark_context": benchmark_context,
        "source_corpus_synthesis": source_corpus.synthesis,
        "effective_source_urls": effective_source_urls,
        "source_packet_id": source_packet_id,
        "source_packet_contract": source_packet.get("contract_version") if isinstance(source_packet, dict) else None,
        "module_parallelism": min(DEFAULT_MODULE_PARALLELISM, max(1, desired_module_count)),
    }
    if previous_media_logs:
        trace["media_logs"] = list(previous_media_logs)

    resumed_plan = previous_trace.get("plan") if isinstance(previous_trace.get("plan"), dict) else None
    try:
        if resumed_plan:
            plan = resumed_plan
            plan_response = {"usage": {}, "resumed": True}
            trace["stages"].append({"stage": "course_plan", "status": "resumed"})
        else:
            plan, plan_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage="course_plan",
                timeout_seconds=_plan_timeout_seconds(desired_module_count),
                messages=_staged_plan_messages(
                    prompt=prompt,
                    level=level,
                    language=language,
                    desired_module_count=desired_module_count,
                    expected_duration_minutes=expected_duration_minutes,
                    source_policy=source_policy,
                    category=category,
                    department=department,
                    source_urls=effective_source_urls,
                    benchmark_context=benchmark_context,
                ),
            )
    except CourseAgentError as exc:
        trace["stages"].append({"stage": "course_plan", "status": "failed", "error": str(exc)})
        raise CourseAgentError(str(exc), trace={**trace, **getattr(exc, "trace", {})}) from exc
    if not resumed_plan:
        trace["stages"].append({"stage": "course_plan", "status": "passed"})

    title = str(plan.get("title") or "Generated course")
    pacing_label = _infer_pacing_label(plan)
    trace["plan_timeout_seconds"] = _plan_timeout_seconds(desired_module_count)
    trace["plan"] = plan
    source_records = _input_source_records(effective_source_urls, title)
    source_ids = [str(record["id"]) for record in source_records]
    module_outlines = _coerce_plan_modules(plan, desired_module_count)
    resume_modules = _resume_modules_from_course(resume_course, desired_module_count)
    completed_modules: dict[int, dict] = {index: module for index, module in enumerate(resume_modules, start=1)}
    if completed_modules:
        trace["resume"] = {"completedModuleCount": len(completed_modules)}
    modules: list[dict] = [completed_modules[index] for index in sorted(completed_modules)]
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

    pending_module_outlines = [(index, module_outline) for index, module_outline in enumerate(module_outlines, start=1) if index not in completed_modules]
    module_outlines_for_serial = pending_module_outlines
    if len(pending_module_outlines) > 1:
        module_outlines_for_serial = []
        parallelism = min(DEFAULT_MODULE_PARALLELISM, len(pending_module_outlines))
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
                    source_urls=effective_source_urls,
                    source_ids=source_ids,
                    source_records=source_records,
                    existing_modules=[completed_modules[key] for key in sorted(completed_modules)],
                    level=level,
                    pacing_label=pacing_label,
                ): index
                for index, module_outline in pending_module_outlines
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
                        category=category,
                        department=department,
                    )
                    failed_trace = getattr(exc, "trace", {})
                    trace["stages"].extend(failed_trace.get("stages", []) if isinstance(failed_trace, dict) else [])
                    raise CourseAgentError(str(exc), trace={**trace, **_failure_trace_context(exc), "partial_course": partial_course}) from exc

                completed_modules[index] = result["module"]
                module_usage.extend(result["usage"])
                trace["stages"].extend(result["stages"])
                if result["media_logs"]:
                    trace.setdefault("media_logs", []).extend(result["media_logs"])
                modules = [completed_modules[key] for key in sorted(completed_modules)]
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

    for index, module_outline in module_outlines_for_serial:
        try:
            result = _generate_module_bundle(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                selected_model=str(selected_model),
                plan=plan,
                module_outline=module_outline,
                module_number=index,
                source_urls=effective_source_urls,
                source_ids=source_ids,
                source_records=source_records,
                existing_modules=[completed_modules[key] for key in sorted(completed_modules)],
                level=level,
                pacing_label=pacing_label,
            )
        except CourseAgentError as exc:
            partial_modules = [completed_modules[key] for key in sorted(completed_modules)]
            partial_course = _partial_course_from_stages(
                plan=plan,
                source_records=source_records,
                modules=partial_modules,
                level=level,
                category=category,
                department=department,
            )
            failed_trace = getattr(exc, "trace", {})
            trace["stages"].extend(failed_trace.get("stages", []) if isinstance(failed_trace, dict) else [])
            raise CourseAgentError(str(exc), trace={**trace, **_failure_trace_context(exc), "partial_course": partial_course}) from exc

        completed_modules[index] = result["module"]
        module_usage.extend(result["usage"])
        trace["stages"].extend(result["stages"])
        if result["media_logs"]:
            trace.setdefault("media_logs", []).extend(result["media_logs"])
        modules = [completed_modules[key] for key in sorted(completed_modules)]
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
