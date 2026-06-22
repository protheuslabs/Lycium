from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm.attributes import flag_modified

from app.course_build_tasks import transition_course_build_task_from_source_packet
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
        source_id = str(document.get("id") or f"active-source-{index}")
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


def _active_plan(structure: dict[str, Any]) -> dict[str, Any]:
    metadata = _metadata(structure)
    plan = metadata.get("activeGenerationPlan")
    if isinstance(plan, dict):
        return deepcopy(plan)
    wrapper = metadata.get("courseWrapper") if isinstance(metadata.get("courseWrapper"), dict) else {}
    title = str(structure.get("title") or wrapper.get("title") or "Generated course")
    concepts = _strings(wrapper.get("requiredConcepts")) or [title]
    return {
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
    concepts = _strings(module_plan.get("requiredConcepts") or module_plan.get("concepts"))
    return concepts or [fallback_title.replace("Module", "").strip(": ") or fallback_title]


def _question_set(concept: str) -> list[dict[str, Any]]:
    return [
        {
            "id": f"q-{index}",
            "question": f"Which answer best demonstrates source-backed understanding of {concept}? {index}",
            "options": [
                f"Use accepted sources to explain {concept} with an example.",
                "Use an unsupported opinion.",
                "Skip the prerequisite concept.",
                "Replace the concept with unrelated trivia.",
            ],
            "answers": [0],
        }
        for index in range(1, 11)
    ]


def _module_from_plan(module_plan: dict[str, Any], *, source_ids: list[str]) -> dict[str, Any]:
    module_index = int(module_plan.get("moduleIndex") or 1)
    module_title = str(module_plan.get("title") or f"Module {module_index}")
    concepts = _concepts_for_module(module_plan, module_title)
    lesson_id = f"active-m{module_index:02d}-lesson"
    concept = concepts[0]
    return {
        "id": f"active-module-{module_index:02d}",
        "title": module_title,
        "sourceIds": source_ids,
        "sections": [
            {
                "id": lesson_id,
                "title": concept.title(),
                "pageType": "learn",
                "sectionType": "lesson",
                "sourceIds": source_ids[:1],
                "metadata": {
                    "generationOutline": {
                        "contractVersion": "section-generation-outline-v1",
                        "role": "lesson",
                        "planningSource": "active_generation_plan",
                        "moduleOutlineTitle": module_title,
                        "plannedConceptKeywords": concepts,
                        "plannedSourceIds": source_ids,
                    }
                },
                "content": [
                    {
                        "type": "text",
                        "heading": "Source-backed explanation",
                        "value": (
                            f"{concept} is introduced here as part of an actively generated module. "
                            "Use the accepted source packet to verify definitions, examples, constraints, and applications. [1]"
                        ),
                        "sourceIds": source_ids[:1],
                    },
                    {
                        "type": "text",
                        "heading": "Practice",
                        "value": f"Write a short explanation of {concept}, then identify which accepted source supports each claim. [1]",
                        "sourceIds": source_ids[:1],
                    },
                    {"type": "heading", "title": "Concepts introduced", "sourceIds": source_ids[:1]},
                    {
                        "type": "conceptCard",
                        "title": concept.title(),
                        "description": f"A required concept in {module_title} that must be supported by accepted course sources.",
                        "sourceIds": source_ids[:1],
                    },
                ],
            },
            {
                "id": f"active-m{module_index:02d}-quiz",
                "title": f"Quiz: {concept.title()}",
                "pageType": "apply",
                "sectionType": "assessment",
                "sourceIds": source_ids[:1],
                "content": [{"type": "quiz", "questions": _question_set(concept), "sourceIds": source_ids[:1]}],
            },
            {
                "id": f"active-m{module_index:02d}-summary",
                "title": f"Module {module_index} Concept Review",
                "pageType": "learn",
                "sectionType": "summary",
                "sourceIds": source_ids[:1],
                "content": [
                    {"type": "heading", "title": "Module concepts", "sourceIds": source_ids[:1]},
                    {
                        "type": "conceptCard",
                        "title": concept.title(),
                        "description": f"Review concept for {concept}.",
                        "sourceSectionId": lesson_id,
                        "sourceIds": source_ids[:1],
                    },
                ],
            },
        ],
    }


def _update_plan(plan: dict[str, Any], generated_indexes: set[int], batch_index: int) -> dict[str, Any]:
    planned_modules = _items(plan.get("plannedModules"))
    for module in planned_modules:
        if int(module.get("moduleIndex") or -1) in generated_indexes:
            module["status"] = "generated"
    batches = _items(plan.get("batches"))
    if not batches:
        batches = [{"batchIndex": batch_index, "moduleIndexes": sorted(generated_indexes), "status": "generated"}]
    for batch in batches:
        if int(batch.get("batchIndex") or -1) == batch_index or set(int(value) for value in batch.get("moduleIndexes") or []) == generated_indexes:
            batch["status"] = "generated"
            batch["generatedAt"] = datetime.now(UTC).isoformat()
    complete = bool(planned_modules) and all(str(module.get("status") or "") == "generated" for module in planned_modules)
    plan["plannedModules"] = planned_modules
    plan["batches"] = batches
    plan["status"] = "complete" if complete else "partially_generated"
    return plan


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
    module_indexes = {int(value) for value in batch.get("moduleIndexes") or [] if str(value).isdigit()}
    planned_modules = [
        module
        for module in _items(plan.get("plannedModules"))
        if int(module.get("moduleIndex") or -1) in module_indexes
    ]
    if not planned_modules:
        raise ValueError("No pending active-generation modules were available.")

    existing_modules = _items(structure.get("modules"))
    existing_module_ids = {str(module.get("id") or "") for module in existing_modules}
    generated_modules = [_module_from_plan(module, source_ids=source_ids) for module in planned_modules]
    merged_modules = [module for module in existing_modules if str(module.get("id") or "") not in {m["id"] for m in generated_modules}]
    merged_modules.extend(module for module in generated_modules if module["id"] not in existing_module_ids)
    if len(merged_modules) == len(existing_modules):
        merged_modules.extend(generated_modules)

    plan = _update_plan(plan, {int(module.get("moduleIndex") or -1) for module in planned_modules}, int(batch.get("batchIndex") or 1))
    metadata["activeGenerationPlan"] = plan
    metadata["courseBuildTask"] = transition_course_build_task_from_source_packet(metadata.get("courseBuildTask"), source_packet=source_packet)
    metadata["status"] = "generated" if plan["status"] == "complete" else "partially_generated"
    metadata.setdefault("pacingLabel", "Module")
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
