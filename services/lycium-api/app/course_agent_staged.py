from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from app.config import SETTINGS
from app.course_agent_assembly import (
    CourseGenerationCheckpoint,
    _base_agent_trace,
    _coerce_plan_modules,
    _emit_checkpoint,
    _input_source_records,
    _model_json,
    _partial_course_from_stages,
)
from app.course_agent_contract import normalize_course, validate_course_contract
from app.course_agent_prompting import _staged_plan_messages
from app.course_agent_providers import assess_agent_model_capability, get_agent_provider
from app.course_agent_staged_support import (
    DEFAULT_MODULE_PARALLELISM,
    _bounded_timeout_seconds,
    _failure_trace_context,
    _generate_module_bundle,
    _infer_pacing_label,
    _plan_timeout_seconds,
    _resume_modules_from_course,
    _resume_trace,
)
from app.course_agent_staged_outline import (
    _course_build_outline_plan_from_resume_course,
    _course_build_outline_plan_from_source_packet,
    _outline_planning_source,
    _source_packet_for_outline,
)
from app.course_agent_types import CourseAgentError, CourseAgentResult
from app.course_generation_readiness import build_generation_readiness_report
from app.course_generation_service import validate_generation_taxonomy_input
from app.course_generation_stage_workflows import (
    compact_module_apply_workflow_reports,
    compact_stage_workflow_report,
    run_course_module_outline_workflow,
    run_module_apply_section_workflow,
    run_module_assembly_workflow,
    run_module_section_plan_workflow,
    run_module_summary_section_workflow,
    run_section_fill_workflow,
)
from app.course_quality_evals import run_course_quality_evals
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context
from app.source_corpus import compile_generation_source_corpus
from app.course_agent_source_context import build_source_context_index, source_context_index_summary
from app.source_packet_quality_gate import source_packet_gate_message, source_packet_quality_gate


def _lesson_sections_for_stage_reports(module: dict) -> list[dict]:
    sections = module.get("sections") if isinstance(module.get("sections"), list) else []
    return [
        section
        for section in sections
        if isinstance(section, dict)
        and str(section.get("pageType") or "learn") == "learn"
        and str(section.get("sectionType") or "lesson") != "summary"
    ]


def _apply_sections_for_stage_reports(module: dict) -> list[dict]:
    sections = module.get("sections") if isinstance(module.get("sections"), list) else []
    return [
        section
        for section in sections
        if isinstance(section, dict)
        and (
            str(section.get("pageType") or "") == "apply"
            or str(section.get("sectionType") or "").lower() in {"assessment", "quiz", "project"}
        )
    ]


def _summary_sections_for_stage_reports(module: dict) -> list[dict]:
    sections = module.get("sections") if isinstance(module.get("sections"), list) else []
    return [
        section
        for section in sections
        if isinstance(section, dict) and str(section.get("sectionType") or "").lower() == "summary"
    ]


def _module_stage_workflow_reports(
    *,
    module_outline: dict,
    generated_module: dict,
    module_number: int,
    source_ids: list[str],
    pacing_label: str,
) -> list[dict]:
    section_plan_report = run_module_section_plan_workflow(
        module_outline,
        fallback_source_ids=source_ids,
        module_number=module_number,
    )
    reports = [compact_stage_workflow_report(section_plan_report)]
    section_plans = section_plan_report["artifacts"]["sectionPlans"]
    lesson_sections = _lesson_sections_for_stage_reports(generated_module)
    for section_plan, generated_section in zip(section_plans, lesson_sections, strict=False):
        reports.append(
            compact_stage_workflow_report(
                run_section_fill_workflow(
                    section_plan,
                    generated_section=generated_section,
                    module_outline=module_outline,
                )
            )
        )
    generated_apply_sections = _apply_sections_for_stage_reports(generated_module)
    apply_report = run_module_apply_section_workflow(
        module_outline,
        lesson_sections,
        generated_section=generated_apply_sections[0] if generated_apply_sections else {},
        module_number=module_number,
        fallback_source_ids=source_ids,
    )
    reports.extend(compact_module_apply_workflow_reports(apply_report))
    generated_summary_sections = _summary_sections_for_stage_reports(generated_module)
    reports.append(
        compact_stage_workflow_report(
            run_module_summary_section_workflow(
                module_outline,
                lesson_sections,
                generated_section=generated_summary_sections[0] if generated_summary_sections else None,
                module_number=module_number,
                fallback_source_ids=source_ids,
                pacing_label=pacing_label,
            )
        )
    )
    reports.append(
        compact_stage_workflow_report(
            run_module_assembly_workflow(
                module_outline,
                generated_module.get("sections") if isinstance(generated_module.get("sections"), list) else [],
                module_number=module_number,
                fallback_source_ids=source_ids,
                pacing_label=pacing_label,
            )
        )
    )
    return reports


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
    input_artifacts: list[dict] | None = None,
    category: str | None = None,
    department: str | None = None,
    enforce_contract: bool = True,
    on_checkpoint: CourseGenerationCheckpoint | None = None,
    resume_course: dict | None = None,
    resume_trace: dict | None = None,
    max_stage_timeout_seconds: float | None = None,
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
        input_artifacts=input_artifacts,
    )
    effective_source_urls = source_corpus.source_urls
    packet_gate = source_packet_quality_gate(
        source_corpus.synthesis,
        require_source_strength=True,
        source_documents=source_corpus.source_documents,
        input_artifacts=source_corpus.input_artifacts,
        source_urls=effective_source_urls,
    )
    if packet_gate:
        raise CourseAgentError(
            source_packet_gate_message(
                packet_gate,
                "Source evidence is below policy; add stronger or more relevant sources before staged LLM course generation.",
            ),
            trace={
                "status": "failed",
                "failed_stage": packet_gate.get("gate") or "source_strength",
                "source_corpus_synthesis": source_corpus.synthesis,
                "effective_source_urls": effective_source_urls,
                "source_packet_quality_gate": packet_gate,
                "source_strength": packet_gate.get("artifacts", {}).get("sourceStrength") if isinstance(packet_gate.get("artifacts"), dict) else None,
                "source_packet_id": source_packet_id,
                "source_packet_contract": source_packet.get("contract_version") if isinstance(source_packet, dict) else None,
            },
        )
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
    previous_stage_workflows = previous_trace.get("stage_workflows") if isinstance(previous_trace.get("stage_workflows"), list) else []
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
        "input_artifacts": source_corpus.input_artifacts,
        "module_parallelism": min(DEFAULT_MODULE_PARALLELISM, max(1, desired_module_count)),
        "stage_workflows": list(previous_stage_workflows),
    }
    if previous_media_logs:
        trace["media_logs"] = list(previous_media_logs)
    trace["plan_timeout_seconds"] = _bounded_timeout_seconds(
        _plan_timeout_seconds(desired_module_count),
        max_stage_timeout_seconds,
    )
    if max_stage_timeout_seconds is not None:
        trace["max_stage_timeout_seconds"] = max_stage_timeout_seconds

    resumed_plan = previous_trace.get("plan") if isinstance(previous_trace.get("plan"), dict) else None
    course_build_outline_plan = None
    if not resumed_plan:
        outline_packet = _source_packet_for_outline(source_packet=source_packet, source_corpus=source_corpus)
        outline_planning_source = _outline_planning_source(source_packet, source_corpus)
        course_build_outline_plan = _course_build_outline_plan_from_resume_course(
            resume_course
        ) or _course_build_outline_plan_from_source_packet(
            prompt=prompt,
            source_packet=outline_packet,
            desired_module_count=desired_module_count,
        )
        if course_build_outline_plan and course_build_outline_plan.get("planningSource") == "source_packet_outline":
            course_build_outline_plan["planningSource"] = outline_planning_source
    try:
        if resumed_plan:
            plan = resumed_plan
            plan_response = {"usage": {}, "resumed": True}
            trace["stages"].append({"stage": "course_plan", "status": "resumed"})
        elif course_build_outline_plan:
            plan = course_build_outline_plan
            planning_source = str(course_build_outline_plan.get("planningSource") or "course_build_outline")
            plan_response = {"usage": {}, "resumed": True, "source": planning_source}
            trace["stages"].append(
                {
                    "stage": "course_plan",
                    "status": "derived_from_source_packet_outline"
                    if planning_source == "source_packet_outline"
                    else "derived_from_source_corpus_outline"
                    if planning_source == "source_corpus_outline"
                    else "resumed_from_course_build_outline",
                }
            )
            trace["course_build_outline"] = {
                "status": "used",
                "source": planning_source,
                "contractVersion": course_build_outline_plan.get("sourceOutlineContract"),
                "moduleCount": len(course_build_outline_plan.get("modules", [])),
            }
        else:
            plan, plan_response = _model_json(
                provider=provider,
                api_key=api_key,
                adapter=adapter,
                model=str(selected_model),
                stage="course_plan",
                timeout_seconds=_bounded_timeout_seconds(
                    _plan_timeout_seconds(desired_module_count),
                    max_stage_timeout_seconds,
                ),
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
    if not resumed_plan and not course_build_outline_plan:
        trace["stages"].append({"stage": "course_plan", "status": "passed"})

    title = str(plan.get("title") or "Generated course")
    plan["sourceCorpusSynthesis"] = source_corpus.synthesis
    plan["inputArtifacts"] = source_corpus.input_artifacts
    pacing_label = _infer_pacing_label(plan)
    trace["plan"] = plan
    source_records = _input_source_records(effective_source_urls, title)
    source_ids = [str(record["id"]) for record in source_records]
    source_context_index = build_source_context_index(
        source_documents=source_corpus.source_documents,
        source_records=source_records,
    )
    trace["source_context"] = {
        **source_context_index_summary(source_context_index),
        "selectionPolicy": "stage-relevant-bounded-excerpts",
    }
    module_outlines = _coerce_plan_modules(
        plan,
        desired_module_count,
        benchmark_context=None if course_build_outline_plan else benchmark_context,
    )
    module_planning_source = (
        str(course_build_outline_plan.get("planningSource") or "course_build_outline")
        if course_build_outline_plan
        else "benchmark_requirements"
        if any(str(module.get("planningSource") or "") == "benchmark_requirements" for module in module_outlines)
        else "model_plan"
    )
    trace["module_planning"] = {
        "source": module_planning_source,
        "moduleCount": len(module_outlines),
        "requirementOriginCount": len(benchmark_context.get("requirementOrigins", []))
        if isinstance(benchmark_context.get("requirementOrigins"), list)
        else 0,
    }
    trace["stage_workflows"].append(
        compact_stage_workflow_report(
            run_course_module_outline_workflow(
                prompt=prompt,
                desired_module_count=desired_module_count,
                outline={
                    **plan,
                    "modules": module_outlines,
                    "planningSource": module_planning_source,
                    "sourceOutline": plan.get("sourceOutline"),
                },
            )
        )
    )
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
                    max_stage_timeout_seconds=max_stage_timeout_seconds,
                    source_context_index=source_context_index,
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
                trace["stage_workflows"].extend(
                    _module_stage_workflow_reports(
                        module_outline=module_outlines[index - 1],
                        generated_module=result["module"],
                        module_number=index,
                        source_ids=source_ids,
                        pacing_label=pacing_label,
                    )
                )
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
                max_stage_timeout_seconds=max_stage_timeout_seconds,
                source_context_index=source_context_index,
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
        trace["stage_workflows"].extend(
            _module_stage_workflow_reports(
                module_outline=module_outline,
                generated_module=result["module"],
                module_number=index,
                source_ids=source_ids,
                pacing_label=pacing_label,
            )
        )
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
                "planningSource": module_planning_source,
            },
            "sourceCorpusSynthesis": source_corpus.synthesis,
        },
        "modules": modules,
    }
    if source_corpus.input_artifacts:
        course_payload["metadata"]["inputArtifacts"] = source_corpus.input_artifacts
    if isinstance(plan.get("sourceOutline"), dict):
        course_payload["metadata"]["courseBuildOutline"] = plan["sourceOutline"]
    if resolved_department:
        course_payload["department"] = resolved_department
    course = attach_curriculum_context(normalize_course(course_payload), benchmark_context)
    generation_readiness = build_generation_readiness_report(
        source_urls=effective_source_urls,
        input_artifacts=source_corpus.input_artifacts,
        source_packet=source_packet,
        source_corpus_synthesis=source_corpus.synthesis,
    )
    metadata = dict(course.get("metadata") if isinstance(course.get("metadata"), dict) else {})
    metadata["generationReadiness"] = generation_readiness
    course["metadata"] = metadata
    quality_evals = run_course_quality_evals(course)
    validation_errors = validate_course_contract(course)
    if validation_errors and enforce_contract:
        raise CourseAgentError(
            "Generated course failed contract validation: " + "; ".join(validation_errors[:12]),
            trace={
                **trace,
                "generation_readiness": generation_readiness,
                "quality_evals": quality_evals,
                "partial_course": course,
            },
        )

    return CourseAgentResult(
        course=course,
        trace={
            **trace,
            "generation_readiness": generation_readiness,
            "quality_evals": quality_evals,
            "validation": {"status": "failed" if validation_errors else "passed", "errors": validation_errors},
            "usage": {"plan": plan_response.get("usage", {}), "modules": module_usage},
        },
    )
