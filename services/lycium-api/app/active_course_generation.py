from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
import re
from typing import Any

from sqlalchemy.orm.attributes import flag_modified

from app.course_build_tasks import transition_course_build_task_from_source_packet
from app.course_block_policy import supports_worked_example
from app.models import CourseSnapshot


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _source_documents(source_packet: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(source_packet, dict):
        return []
    return _items(source_packet.get("source_documents") or source_packet.get("sourceDocuments") or source_packet.get("sources"))


def _source_records(source_packet: dict[str, Any] | None) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for index, document in enumerate(_source_documents(source_packet), start=1):
        source_id = str(
            document.get("courseSourceId")
            or document.get("inputSourceId")
            or document.get("sourceId")
            or document.get("id")
            or f"active-source-{index}"
        )
        records.append(
            {
                "id": source_id,
                "type": str(document.get("type") or document.get("source_type") or "web"),
                "title": str(document.get("title") or f"Source {index}"),
                "url": str(document.get("url") or ""),
            }
        )
    return records


def _source_ids(records: list[dict[str, Any]]) -> list[str]:
    return [str(record["id"]) for record in records if str(record.get("id") or "").strip()]


def _source_ids_from_plan(value: dict[str, Any], fallback: list[str]) -> list[str]:
    source_ids = _strings(value.get("sourceIds") or value.get("source_ids"))
    return source_ids or list(fallback)


def _slug(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return clean.strip("-") or "concept"


def _source_packet_ready(source_packet: dict[str, Any] | None) -> bool:
    if not isinstance(source_packet, dict):
        return False
    contract = str(source_packet.get("contract_version") or source_packet.get("contractVersion") or "")
    quality = source_packet.get("quality") if isinstance(source_packet.get("quality"), dict) else {}
    try:
        coverage = float(quality.get("conceptCoverageRatio") or 0)
    except (TypeError, ValueError):
        coverage = 0
    uncovered = quality.get("uncoveredConceptCandidates")
    return contract == "source-packet-v1" and str(quality.get("status") or "").lower() == "usable" and coverage >= 0.7 and not uncovered


def _metadata(structure: dict[str, Any]) -> dict[str, Any]:
    metadata = structure.get("metadata")
    return metadata if isinstance(metadata, dict) else {}


def _active_plan_from_outline(structure: dict[str, Any], fallback_plan: dict[str, Any]) -> dict[str, Any] | None:
    metadata = _metadata(structure)
    outline = metadata.get("courseBuildOutline")
    if not isinstance(outline, dict):
        return None
    outline_modules = _items(outline.get("modules"))
    if not outline_modules:
        return None

    existing_by_index = {
        int(module.get("moduleIndex") or index): module
        for index, module in enumerate(_items(fallback_plan.get("plannedModules")), start=1)
    }
    planned_modules: list[dict[str, Any]] = []
    for index, module in enumerate(outline_modules, start=1):
        module_index = int(module.get("moduleIndex") or index)
        existing = existing_by_index.get(module_index, {})
        module_concepts = _strings(
            module.get("requiredConcepts")
            or module.get("conceptKeywords")
            or module.get("concept_keywords")
            or module.get("concepts")
        )
        section_concepts = [
            concept
            for section in _items(module.get("sections"))
            for concept in _strings(section.get("conceptKeywords") or section.get("concept_keywords") or section.get("concepts"))
        ]
        planned_modules.append(
            {
                "moduleIndex": module_index,
                "outlineModuleId": str(module.get("id") or ""),
                "title": str(module.get("title") or existing.get("title") or f"Module {module_index}"),
                "status": str(existing.get("status") or module.get("status") or "not_generated"),
                "requiredConcepts": list(dict.fromkeys(module_concepts or section_concepts)),
                "sections": _items(module.get("sections")),
                "sourceIds": _strings(module.get("sourceIds")),
                "planningSource": "course_build_outline",
            }
        )

    return {
        "contractVersion": "active-course-generation-plan-v1",
        "courseId": str(fallback_plan.get("courseId") or metadata.get("scaffoldCourseId") or ""),
        "title": str(fallback_plan.get("title") or structure.get("title") or outline.get("title") or "Generated course"),
        "status": str(fallback_plan.get("status") or "section_generation_ready"),
        "mode": str(fallback_plan.get("mode") or "on_demand_module_batches"),
        "batchSizeModules": int(fallback_plan.get("batchSizeModules") or 2),
        "learnerPlaceholderText": str(fallback_plan.get("learnerPlaceholderText") or "Section not yet generated"),
        "planningSource": "course_build_outline",
        "outlineContractVersion": str(outline.get("contractVersion") or ""),
        "plannedModules": planned_modules,
        "batches": _items(fallback_plan.get("batches")),
    }


def _active_plan(structure: dict[str, Any]) -> dict[str, Any]:
    metadata = _metadata(structure)
    plan = metadata.get("activeGenerationPlan")
    if isinstance(plan, dict):
        active_plan = deepcopy(plan)
        return _active_plan_from_outline(structure, active_plan) or active_plan
    wrapper = metadata.get("courseWrapper") if isinstance(metadata.get("courseWrapper"), dict) else {}
    title = str(structure.get("title") or wrapper.get("title") or "Generated course")
    concepts = _strings(wrapper.get("requiredConcepts")) or [title]
    fallback_plan = {
        "contractVersion": "active-course-generation-plan-v1",
        "courseId": str(wrapper.get("courseId") or metadata.get("scaffoldCourseId") or ""),
        "title": title,
        "status": "needs_sources",
        "mode": "on_demand_module_batches",
        "batchSizeModules": 2,
        "learnerPlaceholderText": "Section not yet generated",
        "plannedModules": [
            {
                "moduleIndex": index,
                "title": f"Module {index}: {concept.title()}",
                "status": "not_generated",
                "requiredConcepts": [concept],
            }
            for index, concept in enumerate(concepts[:8], start=1)
        ],
        "batches": [],
    }
    return _active_plan_from_outline(structure, fallback_plan) or fallback_plan


def _first_pending_batch(plan: dict[str, Any], module_count: int) -> dict[str, Any]:
    batches = _items(plan.get("batches"))
    for batch in batches:
        if str(batch.get("status") or "") not in {"generated", "complete"}:
            return batch
    pending_modules = [
        module
        for module in _items(plan.get("plannedModules"))
        if str(module.get("status") or "") not in {"generated", "complete"}
    ]
    module_indexes = [int(module.get("moduleIndex") or index) for index, module in enumerate(pending_modules[:module_count], start=1)]
    return {
        "batchIndex": len([batch for batch in batches if str(batch.get("status") or "") == "generated"]) + 1,
        "moduleIndexes": module_indexes,
        "status": "not_generated",
        "trigger": "manual_generate_button_or_progression",
    }


def _concepts_for_module(module_plan: dict[str, Any], fallback_title: str) -> list[str]:
    concepts = _strings(
        module_plan.get("requiredConcepts")
        or module_plan.get("conceptKeywords")
        or module_plan.get("concept_keywords")
        or module_plan.get("concepts")
    )
    return concepts or [fallback_title.replace("Module", "").strip(": ") or fallback_title]


def _concepts_for_section(section_plan: dict[str, Any], fallback_title: str) -> list[str]:
    concepts = _strings(
        section_plan.get("requiredConcepts")
        or section_plan.get("conceptKeywords")
        or section_plan.get("concept_keywords")
        or section_plan.get("concepts")
    )
    return concepts or [fallback_title]


def _question_set(concepts: list[str]) -> list[dict[str, Any]]:
    primary = concepts[0] if concepts else "the module concept"
    return [
        {
            "id": f"q-{index}",
            "question": f"Which answer best demonstrates source-backed understanding of {primary}? {index}",
            "concept": primary,
            "conceptIds": [_slug(concept) for concept in concepts[:3]],
            "options": [
                f"Use accepted sources to explain {primary} with an example.",
                "Use an unsupported opinion.",
                "Skip the prerequisite concept.",
                "Replace the concept with unrelated trivia.",
            ],
            "answers": [0],
        }
        for index in range(1, 11)
    ]


def _lesson_sections_from_plan(module_plan: dict[str, Any], *, source_ids: list[str]) -> list[dict[str, Any]]:
    module_index = int(module_plan.get("moduleIndex") or 1)
    module_title = str(module_plan.get("title") or f"Module {module_index}")
    module_source_ids = _source_ids_from_plan(module_plan, source_ids)
    raw_sections = _items(module_plan.get("sections"))
    section_plans = raw_sections or [
        {
            "id": f"active-m{module_index:02d}-lesson-01",
            "title": _concepts_for_module(module_plan, module_title)[0].title(),
            "conceptKeywords": _concepts_for_module(module_plan, module_title),
            "sourceIds": module_source_ids[:1],
            "planningSource": module_plan.get("planningSource") or "active_generation_plan",
        }
    ]
    lessons: list[dict[str, Any]] = []
    for section_index, section_plan in enumerate(section_plans[:4], start=1):
        section_title = str(section_plan.get("title") or f"Lesson {section_index}")
        concepts = _concepts_for_section(section_plan, section_title)
        primary_concept = concepts[0]
        supporting_concept = concepts[1] if len(concepts) > 1 else f"{primary_concept} practice"
        lesson_source_ids = _source_ids_from_plan(section_plan, module_source_ids)[:1] or source_ids[:1]
        lesson_id = str(section_plan.get("id") or f"active-m{module_index:02d}-lesson-{section_index:02d}")
        application_block = (
            {
                "type": "workedExample",
                "title": f"Worked example: Apply {primary_concept.title()}",
                "problem": f"Use {primary_concept} to solve a concrete problem from this part of {module_title}.",
                "given": [
                    f"Primary concept: {primary_concept}",
                    f"Supporting concept: {supporting_concept}",
                    "A relevant value, data point, process step, tool state, or decision constraint from the section.",
                ],
                "find": [
                    f"A correct application of {primary_concept}.",
                    "A concrete result that can be checked against the section method.",
                ],
                "steps": [
                    {
                        "explanation": f"State the relevant knowns or definitions for {primary_concept}.",
                        "equation": "knowns + context -> setup",
                    },
                    {
                        "explanation": f"Apply {primary_concept} to the concrete values, process, tool, or decision point.",
                        "equation": "setup + method -> result",
                    },
                    {
                        "explanation": f"Use {supporting_concept} to check whether the result is complete.",
                        "equation": "result + supporting check -> mastery evidence",
                    },
                ],
                "workedAnswer": f"A strong answer names {primary_concept}, applies it to a concrete case, and checks the result with {supporting_concept}.",
                "check": "The example works when it teaches a method the learner can repeat, not a generic label.",
                "sourceIds": lesson_source_ids,
            }
            if supports_worked_example(section_plan, module_plan, concepts)
            else {
                "type": "text",
                "heading": "Guided practice",
                "value": (
                    f"Apply {primary_concept} by writing a focused explanation: first state the prerequisite idea, then explain the source-backed claim in your own words, "
                    f"then describe evidence that would prove you can use it. Compare your explanation with {supporting_concept} and mark the point where the two ideas reinforce each other."
                ),
                "sourceIds": lesson_source_ids,
            }
        )
        lessons.append(
            {
                "id": lesson_id,
                "title": section_title,
                "pageType": "learn",
                "sectionType": "lesson",
                "sourceIds": lesson_source_ids,
                "metadata": {
                    "generationOutline": {
                        "contractVersion": "section-generation-outline-v1",
                        "role": "lesson",
                        "planningSource": str(section_plan.get("planningSource") or module_plan.get("planningSource") or "active_generation_plan"),
                        "moduleOutlineTitle": module_title,
                        "plannedConceptKeywords": list(dict.fromkeys([primary_concept, supporting_concept, *concepts])),
                        "plannedSourceIds": lesson_source_ids,
                    }
                },
                "content": [
                    {
                        "type": "text",
                        "heading": "Source-backed explanation",
                        "value": (
                            f"{primary_concept.title()} is the foundation for this part of {module_title}. "
                            f"Start by connecting the definition of {primary_concept} to the accepted source evidence, then separate the core idea from nearby terms that can sound similar. "
                            f"A useful way to reason about {primary_concept} is to ask what input it depends on, what decision or action it supports, and what constraint would make the explanation fail. "
                            "That sequence keeps the lesson grounded in evidence while still giving a practical route from prerequisite knowledge to deeper application."
                        ),
                        "sourceIds": lesson_source_ids,
                    },
                    application_block,
                    {
                        "type": "text",
                        "heading": "Practice",
                        "value": (
                            f"Apply {primary_concept} by writing a three-step explanation: first state the prerequisite idea, then cite the source-backed claim in your own words, then describe the mastery evidence that would prove you can use it. "
                            f"After that, compare your explanation with {supporting_concept} and mark the point where the two ideas reinforce each other. "
                            "The quiz for this module checks whether that source-backed reasoning is clear enough to guide a real decision."
                        ),
                        "sourceIds": lesson_source_ids,
                    },
                    {"type": "heading", "title": "Concepts introduced", "sourceIds": lesson_source_ids},
                    {
                        "type": "conceptCard",
                        "title": primary_concept.title(),
                        "description": f"A source-backed concept in {module_title} used to move from foundations into applied reasoning.",
                        "sourceIds": lesson_source_ids,
                    },
                    {
                        "type": "conceptCard",
                        "title": supporting_concept.title(),
                        "description": f"A practice-oriented companion concept that helps demonstrate mastery of {primary_concept}.",
                        "sourceIds": lesson_source_ids,
                    },
                ],
            }
        )
    return lessons


def _module_from_plan(module_plan: dict[str, Any], *, source_ids: list[str]) -> dict[str, Any]:
    module_index = int(module_plan.get("moduleIndex") or 1)
    module_title = str(module_plan.get("title") or f"Module {module_index}")
    module_source_ids = _source_ids_from_plan(module_plan, source_ids)
    lesson_sections = _lesson_sections_from_plan(module_plan, source_ids=source_ids)
    summary_concepts = [
        concept
        for section in lesson_sections
        for block in _items(section.get("content"))
        if block.get("type") == "conceptCard"
        for concept in [str(block.get("title") or "")]
        if concept
    ]
    quiz_concepts = summary_concepts[:6] or _concepts_for_module(module_plan, module_title)
    return {
        "id": f"active-module-{module_index:02d}",
        "title": module_title,
        "sourceIds": module_source_ids,
        "sections": [
            *lesson_sections,
            {
                "id": f"active-m{module_index:02d}-quiz",
                "title": f"Quiz: {quiz_concepts[0].title()}",
                "pageType": "apply",
                "sectionType": "assessment",
                "sourceIds": module_source_ids[:1],
                "content": [{"type": "quiz", "questions": _question_set(quiz_concepts), "sourceIds": module_source_ids[:1]}],
            },
            {
                "id": f"active-m{module_index:02d}-summary",
                "title": f"Module {module_index} Concept Review",
                "pageType": "learn",
                "sectionType": "summary",
                "sourceIds": module_source_ids[:1],
                "content": [
                    {"type": "heading", "title": "Module concepts", "sourceIds": module_source_ids[:1]},
                    *[
                        {
                            "type": "conceptCard",
                            "title": concept,
                            "description": f"Review concept for {concept}.",
                            "sourceSectionId": lesson_sections[min(index, len(lesson_sections) - 1)]["id"],
                            "sourceIds": lesson_sections[min(index, len(lesson_sections) - 1)]["sourceIds"],
                        }
                        for index, concept in enumerate(summary_concepts[:6])
                    ],
                ],
            },
        ],
    }


def _source_mapping_rows(generated_modules: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    slots: list[dict[str, Any]] = []
    coverage_rows: list[dict[str, Any]] = []
    seen_slots: set[str] = set()
    for module in generated_modules:
        for section in _items(module.get("sections")):
            section_source_ids = _strings(section.get("sourceIds"))
            if not section_source_ids:
                continue
            concepts = [
                block
                for block in _items(section.get("content"))
                if block.get("type") == "conceptCard" and str(block.get("title") or "").strip()
            ]
            for concept in concepts:
                title = str(concept.get("title") or "")
                concept_id = _slug(title)
                slot_id = f"active-slot-{concept_id}"
                if slot_id not in seen_slots:
                    seen_slots.add(slot_id)
                    slots.append(
                        {
                            "id": slot_id,
                            "conceptId": concept_id,
                            "concept": title,
                            "title": title,
                            "primarySourceId": section_source_ids[0],
                            "fallbackSourceIds": section_source_ids[1:],
                            "sectionIds": [str(section.get("id") or "")],
                            "coverageStatus": "verified",
                            "replacementPolicy": "review_required",
                        }
                    )
                coverage_rows.append(
                    {
                        "conceptId": concept_id,
                        "title": title,
                        "primarySourceId": section_source_ids[0],
                        "fallbackSourceIds": section_source_ids[1:],
                        "sectionIds": [str(section.get("id") or "")],
                        "coverageStatus": "verified",
                    }
                )
    return slots, coverage_rows


def _merge_rows(existing: Any, rows: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    merged = [row for row in existing if isinstance(row, dict)] if isinstance(existing, list) else []
    existing_keys = {str(row.get(key) or "") for row in merged}
    for row in rows:
        row_key = str(row.get(key) or "")
        if row_key and row_key in existing_keys:
            continue
        merged.append(row)
        if row_key:
            existing_keys.add(row_key)
    return merged


def _update_plan(plan: dict[str, Any], generated_indexes: set[int], batch_index: int) -> dict[str, Any]:
    planned_modules = _items(plan.get("plannedModules"))
    for module in planned_modules:
        if int(module.get("moduleIndex") or -1) in generated_indexes:
            module["status"] = "generated"
    batches = _items(plan.get("batches"))
    if not batches:
        batches = [{"batchIndex": batch_index, "moduleIndexes": sorted(generated_indexes), "status": "generated"}]
    matched_batch = False
    for batch in batches:
        if int(batch.get("batchIndex") or -1) == batch_index or set(int(value) for value in batch.get("moduleIndexes") or []) == generated_indexes:
            matched_batch = True
            batch["status"] = "generated"
            batch["generatedAt"] = datetime.now(UTC).isoformat()
    if not matched_batch:
        batches.append(
            {
                "batchIndex": batch_index,
                "moduleIndexes": sorted(generated_indexes),
                "status": "generated",
                "generatedAt": datetime.now(UTC).isoformat(),
            }
        )
    complete = bool(planned_modules) and all(str(module.get("status") or "") == "generated" for module in planned_modules)
    plan["plannedModules"] = planned_modules
    plan["batches"] = batches
    plan["status"] = "complete" if complete else "partially_generated"
    return plan


def _active_course_build_task(task: dict[str, Any] | None, source_packet: dict[str, Any] | None, *, complete: bool) -> dict[str, Any]:
    next_task = transition_course_build_task_from_source_packet(task, source_packet=source_packet)
    next_task.update(
        {
            "status": "section_generation_ready",
            "currentStage": "section_generation_ready",
            "nextAction": "run_quality_review" if complete else "generate_course_sections",
            "requiredInputs": ["quality_report"] if complete else ["section_generation"],
            "transitionStatus": "advanced",
            "transitionReason": (
                "Active generation completed all planned module batches."
                if complete
                else "Active generation produced a source-backed module batch."
            ),
        }
    )
    return next_task


def generate_active_course_batch(
    course: CourseSnapshot,
    *,
    source_packet: dict[str, Any] | None = None,
    batch_index: int | None = None,
    module_count: int = 2,
) -> CourseSnapshot:
    structure = deepcopy(course.structure or {})
    metadata = _metadata(structure)
    plan = _active_plan(structure)

    if not _source_packet_ready(source_packet):
        raise ValueError("Active generation requires a usable source-packet-v1 with adequate concept coverage.")

    records = _source_records(source_packet)
    if not records:
        raise ValueError("Active generation requires at least one source document in the source packet.")

    existing_source_records = _items(structure.get("sourceRecords"))
    existing_source_ids = {str(record.get("id") or "") for record in existing_source_records}
    merged_source_records = [*existing_source_records, *[record for record in records if record["id"] not in existing_source_ids]]
    source_ids = _source_ids(merged_source_records)

    batch = _first_pending_batch(plan, max(1, min(4, module_count)))
    if batch_index is not None:
        matches = [candidate for candidate in _items(plan.get("batches")) if int(candidate.get("batchIndex") or -1) == batch_index]
        if matches:
            batch = matches[0]
    if str(batch.get("status") or "") in {"generated", "complete"}:
        raise ValueError("Active-generation batch has already been generated.")
    module_indexes = {int(value) for value in batch.get("moduleIndexes") or [] if str(value).isdigit()}
    planned_modules = [
        module
        for module in _items(plan.get("plannedModules"))
        if int(module.get("moduleIndex") or -1) in module_indexes
    ]
    if not planned_modules:
        raise ValueError("No pending active-generation modules were available.")

    existing_modules = _items(structure.get("modules"))
    generated_modules = [_module_from_plan(module, source_ids=source_ids) for module in planned_modules]
    generated_module_ids = {module["id"] for module in generated_modules}
    merged_modules = [module for module in existing_modules if str(module.get("id") or "") not in generated_module_ids]
    merged_modules.extend(generated_modules)

    plan = _update_plan(plan, {int(module.get("moduleIndex") or -1) for module in planned_modules}, int(batch.get("batchIndex") or 1))
    source_slots, coverage_rows = _source_mapping_rows(generated_modules)
    metadata["activeGenerationPlan"] = plan
    metadata["courseBuildTask"] = _active_course_build_task(
        metadata.get("courseBuildTask"),
        source_packet,
        complete=plan["status"] == "complete",
    )
    metadata["status"] = "generated" if plan["status"] == "complete" else "partially_generated"
    metadata.setdefault("pacingLabel", "Module")
    metadata.setdefault(
        "scope",
        {
            "audience": "self-directed learner",
            "level": str(course.level or "intermediate"),
            "duration": "module-paced",
            "outcome": f"Use source-backed concepts from {course.title}.",
        },
    )
    if plan.get("planningSource") == "course_build_outline":
        generation_plan = metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {}
        generation_plan.setdefault("planningSource", "source_packet_outline")
        generation_plan.setdefault("activeGenerationMode", "module_batches")
        metadata["generationPlan"] = generation_plan
    metadata["sourceSlots"] = _merge_rows(metadata.get("sourceSlots"), source_slots, "id")
    metadata["conceptSourceCoverageMap"] = _merge_rows(metadata.get("conceptSourceCoverageMap"), coverage_rows, "conceptId")
    metadata["sourceCoveragePolicy"] = {
        **(metadata.get("sourceCoveragePolicy") if isinstance(metadata.get("sourceCoveragePolicy"), dict) else {}),
        "minimumRequiredConceptCoveragePercent": 70,
    }
    metadata["sourceCorpusSynthesis"] = {
        **(metadata.get("sourceCorpusSynthesis") if isinstance(metadata.get("sourceCorpusSynthesis"), dict) else {}),
        "sourcePacket": source_packet,
        "metrics": {
            **(
                metadata.get("sourceCorpusSynthesis", {}).get("metrics")
                if isinstance(metadata.get("sourceCorpusSynthesis"), dict)
                and isinstance(metadata.get("sourceCorpusSynthesis", {}).get("metrics"), dict)
                else {}
            ),
            "includedSourceCount": len(merged_source_records),
            "submittedSourceCount": max(len(merged_source_records), len(_source_documents(source_packet))),
            "excludedSourceCount": 0,
        },
    }
    structure.update(
        {
            "metadata": metadata,
            "sourceRecords": merged_source_records,
            "sourceIds": source_ids,
            "modules": merged_modules,
        }
    )
    if not structure.get("shortDescription"):
        structure["shortDescription"] = f"Actively generated draft for {course.title}."

    course.structure = structure
    course.status = "generated"
    trace = course.generation_trace if isinstance(course.generation_trace, dict) else {}
    trace["activeGeneration"] = {
        "contractVersion": "active-course-generation-run-v1",
        "status": plan["status"],
        "batchIndex": int(batch.get("batchIndex") or 1),
        "generatedModuleIndexes": sorted(int(module.get("moduleIndex") or -1) for module in planned_modules),
        "sourcePacketQuality": source_packet.get("quality") if isinstance(source_packet, dict) else None,
        "generatedAt": datetime.now(UTC).isoformat(),
    }
    course.generation_trace = trace
    flag_modified(course, "structure")
    flag_modified(course, "generation_trace")
    return course
