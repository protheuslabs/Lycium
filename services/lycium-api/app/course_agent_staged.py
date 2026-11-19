from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable

from pydantic import ValidationError

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
from app.course_agent_prompting import _course_curriculum_messages, _module_section_plan_messages, _staged_plan_messages
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
from app.course_coverage_checklists import build_course_coverage_checklist_from_source_packet
from app.course_generation_readiness import build_generation_readiness_report
from app.course_generation_service import validate_generation_taxonomy_input
from app.course_generation_stage_workflows import (
    compact_module_apply_workflow_reports,
    compact_stage_workflow_report,
    run_course_module_outline_workflow,
    run_course_template_workflow,
    run_module_apply_section_workflow,
    run_module_assembly_workflow,
    run_module_section_plan_workflow,
    run_module_summary_section_workflow,
    run_section_fill_workflow,
)
from app.course_quality_evals import run_course_quality_evals
from app.course_planning_contracts import CourseCurriculum, CourseModulePlan, CourseSectionPlans
from app.curriculum_benchmarks import attach_curriculum_context, compile_curriculum_benchmark_context
from app.source_corpus import compile_generation_source_corpus
from app.course_agent_source_context import build_source_context_index, compact_source_context_for_stage, source_context_index_summary
from app.source_packet_quality_gate import source_packet_quality_gate

CourseGenerationWorkflowStatus = Callable[[dict], None]


def _emit_workflow_status(
    on_workflow_status: CourseGenerationWorkflowStatus | None,
    *,
    stage: str,
    trace: dict,
    progress: float | None = None,
    detail: str | None = None,
) -> None:
    if on_workflow_status is None:
        return
    payload: dict = {"stage": stage, "trace": trace}
    if progress is not None:
        payload["progress"] = progress
    if detail:
        payload["detail"] = detail
    on_workflow_status(payload)


def _list_items(value: object) -> list[dict]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _list_strings(value: object) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _unique_strings(values: list[object], *, limit: int | None = None) -> list[str]:
    rows: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = str(value or "").strip()
        key = clean.lower()
        if not clean or key in seen:
            continue
        rows.append(clean)
        seen.add(key)
        if limit is not None and len(rows) >= limit:
            break
    return rows


def _apply_course_template_coverage_to_modules(module_outlines: list[dict], course_template: dict | None) -> list[dict]:
    checklist = (
        course_template.get("courseCoverageChecklist")
        if isinstance(course_template, dict) and isinstance(course_template.get("courseCoverageChecklist"), dict)
        else {}
    )
    required_items = _list_items(checklist.get("requiredItems"))
    if not module_outlines or not required_items:
        return module_outlines

    required_ids = [str(item.get("id") or "").strip() for item in required_items if str(item.get("id") or "").strip()]
    assigned_ids = {
        item_id
        for module in module_outlines
        for item_id in _list_strings(module.get("assignedCoverageItemIds"))
    }
    missing_items = [item for item in required_items if str(item.get("id") or "").strip() and str(item.get("id")).strip() not in assigned_ids]
    if not missing_items:
        return module_outlines

    modules = [dict(module) for module in module_outlines]
    module_count = len(modules)
    for module_index, module in enumerate(modules):
        start = module_index * len(missing_items) // module_count
        end = (module_index + 1) * len(missing_items) // module_count
        bucket = missing_items[start:end]
        if not bucket:
            continue
        bucket_ids = [str(item.get("id")) for item in bucket if str(item.get("id") or "").strip()]
        bucket_terms = _unique_strings(
            [
                *(item.get("title") for item in bucket),
                *(
                    term
                    for item in bucket
                    for term in (item.get("mustTeach") if isinstance(item.get("mustTeach"), list) else [])
                ),
            ],
            limit=16,
        )
        module["assignedCoverageItemIds"] = _unique_strings([*_list_strings(module.get("assignedCoverageItemIds")), *bucket_ids])
        module["coverageMustTeach"] = _unique_strings([*_list_strings(module.get("coverageMustTeach")), *bucket_terms], limit=20)
        module["concept_keywords"] = _unique_strings([*_list_strings(module.get("concept_keywords") or module.get("conceptKeywords")), *bucket_terms], limit=20)
        module["coverageAllocationStatus"] = "assigned"
    if required_ids:
        for module in modules:
            module.setdefault("coverageChecklistContract", checklist.get("contractVersion"))
    return modules


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
    expected_duration_minutes: int | None = None,
    credits: float | None = None,
    credit_system: str | None = None,
    curriculum_context: dict | None = None,
    model: str | None = None,
    source_urls: list[str] | None = None,
    source_packet_id: int | str | None = None,
    source_packet: dict | None = None,
    input_artifacts: list[dict] | None = None,
    category: str | None = None,
    department: str | None = None,
    enforce_contract: bool = True,
    on_checkpoint: CourseGenerationCheckpoint | None = None,
    on_workflow_status: CourseGenerationWorkflowStatus | None = None,
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
    has_submitted_source_evidence = bool(
        effective_source_urls or source_corpus.source_documents or source_corpus.input_artifacts
    )
    packet_gate = source_packet_quality_gate(
        source_corpus.synthesis,
        require_source_strength=has_submitted_source_evidence,
        source_documents=source_corpus.source_documents,
        input_artifacts=source_corpus.input_artifacts,
        source_urls=effective_source_urls,
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
    if packet_gate:
        trace["source_packet_quality_gate"] = packet_gate
    if previous_media_logs:
        trace["media_logs"] = list(previous_media_logs)
    trace["plan_timeout_seconds"] = _bounded_timeout_seconds(
        _plan_timeout_seconds(desired_module_count),
        max_stage_timeout_seconds,
    )
    if max_stage_timeout_seconds is not None:
        trace["max_stage_timeout_seconds"] = max_stage_timeout_seconds

    def plan_with_model[T](stage: str, messages: list[dict[str, str]], validate: Callable[[dict], T]) -> T:
        messages = list(messages)
        for attempt in range(2):
            try:
                payload, response = _model_json(
                    provider=provider,
                    api_key=api_key,
                    adapter=adapter,
                    model=str(selected_model),
                    stage=stage,
                    timeout_seconds=trace["plan_timeout_seconds"],
                    messages=messages,
                )
            except CourseAgentError as exc:
                trace["stages"].append({"stage": stage, "status": "failed", "error": str(exc)})
                raise CourseAgentError(str(exc), trace={**trace, **exc.trace}) from exc
            try:
                result = validate(payload)
            except ValueError as exc:
                error = (
                    ". ".join(
                        f"{'.'.join(map(str, item['loc']))}: {item['msg']}"
                        for item in exc.errors(include_input=False, include_url=False)
                    )
                    if isinstance(exc, ValidationError) else str(exc)
                )[:1200]
                trace["stages"].append({"stage": stage, "status": "invalid_output", "error": error})
                if attempt == 0:
                    messages.append({
                        "role": "user",
                        "content": f"Return a corrected complete JSON response. The previous response failed validation: {error}",
                    })
                    continue
                raise CourseAgentError(
                    f"{stage} failed validation: {error}",
                    trace={**trace, "failed_stage": stage},
                ) from exc
            trace.setdefault("planning_usage", {})[stage] = {
                "input_characters": sum(len(message["content"]) for message in messages),
                **{key: response[key] for key in ("usage", "prompt_eval_count", "eval_count") if key in response},
            }
            return result
        raise AssertionError("Planning attempts exhausted")

    course_template = previous_trace.get("course_template") if isinstance(previous_trace.get("course_template"), dict) else None
    resumed_plan = previous_trace.get("plan") if isinstance(previous_trace.get("plan"), dict) else None
    saved_outline_plan = _course_build_outline_plan_from_resume_course(resume_course)
    outline_packet = _source_packet_for_outline(source_packet=source_packet, source_corpus=source_corpus)
    source_records = _input_source_records(
        effective_source_urls,
        "Generated course",
        source_documents=source_corpus.source_documents,
        source_corpus_synthesis=source_corpus.synthesis,
    )
    source_ids = [str(record["id"]) for record in source_records]
    source_context_index = build_source_context_index(
        source_documents=source_corpus.source_documents,
        source_records=source_records,
    )
    planning_request = {
        "prompt": prompt,
        "level": level,
        "language": language,
        "desired_module_count": desired_module_count,
        "expected_duration_minutes": expected_duration_minutes,
        "source_policy": source_policy,
        "category": category,
        "department": department,
    }
    if course_template is None:
        _emit_workflow_status(
            on_workflow_status,
            stage="course_template_generation",
            trace=trace,
            progress=0.04,
        )
        curriculum = None
        if not resumed_plan and not saved_outline_plan:
            document_checklist = build_course_coverage_checklist_from_source_packet(
                prompt=prompt, title=None, level=level, source_packet=outline_packet,
            )
            curriculum = plan_with_model(
                "course_template_generation",
                _course_curriculum_messages(
                    request={
                        **{key: value for key, value in planning_request.items() if key != "desired_module_count"},
                        "credits": credits,
                        "credit_system": credit_system,
                        "curriculum_context": curriculum_context,
                    },
                    evidence=compact_source_context_for_stage(
                        source_context_index=source_context_index,
                        source_ids=source_ids,
                        query_values=[prompt],
                        total_char_budget=2400,
                        per_source_char_budget=800,
                        max_sources=3,
                    ),
                    source_topics=[
                        {key: item[key] for key in ("title", "mustTeach", "sourceLocation") if key in item}
                        for item in (document_checklist or {}).get("requiredItems", [])
                    ],
                    benchmark_topics=[
                        str(item["title"]) for item in benchmark_context.get("requirementOrigins", [])
                        if item.get("importance") == "required" and item.get("title")
                    ],
                ),
                lambda payload: CourseCurriculum.model_validate(payload).preserve_workload(
                    minutes=expected_duration_minutes, credits=credits, credit_system=credit_system,
                ),
            )
        course_template_report = run_course_template_workflow(
            prompt=prompt,
            level=level,
            desired_module_count=desired_module_count,
            expected_duration_minutes=expected_duration_minutes,
            source_policy=source_policy,
            source_packet=outline_packet,
            category=category,
            department=department,
            curriculum=curriculum,
            available_source_ids=source_ids if curriculum else None,
        )
        course_template = course_template_report["artifacts"]["courseTemplate"]
        if not any(stage.get("stage") == "course_template_generation" for stage in trace["stage_workflows"] if isinstance(stage, dict)):
            trace["stage_workflows"].append(compact_stage_workflow_report(course_template_report))
        if course_template_report["status"] == "failed":
            reasons = [
                str(issue.get("message"))
                for issue in course_template_report.get("issues", [])
                if isinstance(issue, dict) and issue.get("severity") == "error"
            ]
            raise CourseAgentError(
                "Course template generation failed: " + "; ".join(reasons or ["template handoff did not pass validation"]),
                trace=trace,
            )
    trace["course_template"] = course_template

    course_build_outline_plan = saved_outline_plan
    coverage_checklist = course_template.get("courseCoverageChecklist")
    model_curriculum = isinstance(coverage_checklist, dict) and coverage_checklist.get("source") == "model_curriculum"
    if not resumed_plan and not saved_outline_plan and not model_curriculum:
        outline_planning_source = _outline_planning_source(source_packet, source_corpus)
        course_build_outline_plan = _course_build_outline_plan_from_source_packet(
            prompt=prompt,
            source_packet=outline_packet,
            desired_module_count=desired_module_count,
            coverage_checklist=coverage_checklist,
        )
        if course_build_outline_plan and course_build_outline_plan.get("planningSource") == "source_packet_outline":
            course_build_outline_plan["planningSource"] = outline_planning_source
    plan_usage = {}
    if resumed_plan:
        plan = resumed_plan
        trace["stages"].append({"stage": "course_plan", "status": "resumed"})
    elif course_build_outline_plan:
        plan = course_build_outline_plan
        planning_source = str(course_build_outline_plan.get("planningSource") or "course_build_outline")
        trace["stages"].append({
            "stage": "course_plan",
            "status": {
                "source_packet_outline": "derived_from_source_packet_outline",
                "source_corpus_outline": "derived_from_source_corpus_outline",
            }.get(planning_source, "resumed_from_course_build_outline"),
        })
        trace["course_build_outline"] = {
            "status": "used",
            "source": planning_source,
            "contractVersion": course_build_outline_plan.get("sourceOutlineContract"),
            "moduleCount": len(course_build_outline_plan.get("modules", [])),
        }
    else:
        _emit_workflow_status(
            on_workflow_status,
            stage="course_module_outline_generation",
            trace=trace,
            progress=0.08,
        )
        plan = plan_with_model(
            "course_plan",
            _staged_plan_messages(**planning_request, course_template=course_template),
            lambda payload: CourseModulePlan.model_validate(payload).materialize(
                course_template, module_limit=desired_module_count,
            ),
        )
        plan_usage = trace["planning_usage"]["course_plan"].get("usage", {})
        trace["stages"].append({"stage": "course_plan", "status": "passed"})

    template_title = str(course_template.get("title") or "").strip() if isinstance(course_template, dict) else ""
    prompt_title = prompt.strip().rstrip(".")
    plan_title = str(plan.get("title") or "").strip()
    if template_title and (
        not plan_title
        or plan_title.lower() == prompt_title.lower()
        or plan_title.lower() in {"generated course", "untitled course"}
    ):
        plan["title"] = template_title
    if isinstance(course_template, dict):
        if not str(plan.get("shortDescription") or "").strip() and str(course_template.get("shortDescription") or "").strip():
            plan["shortDescription"] = str(course_template["shortDescription"])
        if not isinstance(plan.get("scope"), dict) and isinstance(course_template.get("scope"), dict):
            plan["scope"] = course_template["scope"]
        plan["courseTemplate"] = course_template

    title = str(plan.get("title") or "Generated course")
    plan["sourceCorpusSynthesis"] = source_corpus.synthesis
    plan["inputArtifacts"] = source_corpus.input_artifacts
    pacing_label = _infer_pacing_label(plan)
    trace["plan"] = plan
    for record in source_records:
        record["usedByCourseTitles"] = [title]
    trace["source_context"] = {
        **source_context_index_summary(source_context_index),
        "selectionPolicy": "stage-relevant-bounded-excerpts",
    }
    module_outlines = _coerce_plan_modules(
        plan,
        desired_module_count,
        benchmark_context=None if course_build_outline_plan or model_curriculum else benchmark_context,
    )
    module_outlines = _apply_course_template_coverage_to_modules(module_outlines, course_template)
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
    if resumed_plan or course_build_outline_plan:
        _emit_workflow_status(
            on_workflow_status,
            stage="course_module_outline_generation",
            trace=trace,
            progress=0.08,
        )
    trace["stage_workflows"].append(
        compact_stage_workflow_report(
            run_course_module_outline_workflow(
                prompt=prompt,
                desired_module_count=desired_module_count,
                module_count_is_limit=module_planning_source == "model_plan",
                course_template=course_template,
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
            course_template=course_template,
        ),
    )

    pending_module_outlines = [(index, module_outline) for index, module_outline in enumerate(module_outlines, start=1) if index not in completed_modules]
    if pending_module_outlines:
        _emit_workflow_status(
            on_workflow_status,
            stage="module_section_plan_generation",
            trace=trace,
            progress=0.12,
        )
        unplanned = [
            module for _, module in pending_module_outlines
            if module.get("coverageItems") and not module.get("sectionPlanHints")
        ]
        if unplanned:
            section_plans = plan_with_model(
                "course_section_plan",
                _module_section_plan_messages(scope=course_template["scope"], modules=unplanned),
                lambda payload: CourseSectionPlans.model_validate(payload).materialize(unplanned),
            )
            for module in unplanned:
                outlines = section_plans[module["id"]]
                module.update({
                    "sectionPlanHints": outlines,
                    "lessonTitles": [outline["title"] for outline in outlines],
                    "targetSectionCount": len(outlines),
                })
            trace["stages"].append({"stage": "course_section_plan", "status": "passed"})
        _emit_workflow_status(
            on_workflow_status,
            stage="section_fill_generation",
            trace=trace,
            progress=0.16,
        )
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
                        course_template=course_template,
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
                        course_template=course_template,
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
                course_template=course_template,
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
                course_template=course_template,
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
    if isinstance(course_template, dict):
        course_payload["metadata"]["courseTemplate"] = course_template
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
    if not bool(generation_readiness.get("ready")):
        metadata["status"] = "needs_sources"
        course["status"] = "needs_sources"
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
            "usage": {"plan": plan_usage, "modules": module_usage},
        },
    )
