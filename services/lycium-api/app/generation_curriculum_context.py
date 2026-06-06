from __future__ import annotations

from typing import Any

from app.curriculum_benchmarks import compile_curriculum_benchmark_context


def _merge_source_slots(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for slot in [*existing, *incoming]:
        if not isinstance(slot, dict):
            continue
        key = str(slot.get("requiredConceptId") or slot.get("conceptId") or slot.get("sourceSectionId") or slot.get("title") or "")
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        merged.append(slot)
    return merged


def _source_id_remap_for_urls(structure: dict[str, Any], source_urls: list[str]) -> dict[str, str]:
    source_records = structure.get("sourceRecords") if isinstance(structure.get("sourceRecords"), list) else []
    records_by_url = {
        str(record.get("url") or "").strip(): str(record.get("id") or "").strip()
        for record in source_records
        if isinstance(record, dict) and str(record.get("url") or "").strip() and str(record.get("id") or "").strip()
    }
    return {
        f"input-source-{index}": records_by_url[url]
        for index, url in enumerate(source_urls, start=1)
        if url in records_by_url
    }


def _remap_source_ref(value: Any, source_id_remap: dict[str, str]) -> Any:
    if isinstance(value, str):
        return source_id_remap.get(value, value)
    return value


def _remap_curriculum_context_source_ids(value: Any, source_id_remap: dict[str, str]) -> Any:
    if not source_id_remap:
        return value
    if isinstance(value, list):
        return [_remap_curriculum_context_source_ids(item, source_id_remap) for item in value]
    if not isinstance(value, dict):
        return value

    remapped: dict[str, Any] = {}
    for key, item in value.items():
        if key in {"primarySourceId", "sourceId"}:
            remapped[key] = _remap_source_ref(item, source_id_remap)
        elif key in {"fallbackSourceIds", "evidenceRefs", "sourceRefs", "sourceIds"} and isinstance(item, list):
            remapped[key] = [_remap_source_ref(ref, source_id_remap) for ref in item]
        else:
            remapped[key] = _remap_curriculum_context_source_ids(item, source_id_remap)
    return remapped


def _refresh_source_coverage_trace(metadata: dict[str, Any]) -> None:
    trace = dict(metadata.get("sourceCoverageTrace") if isinstance(metadata.get("sourceCoverageTrace"), dict) else {})
    source_slots = metadata.get("sourceSlots") if isinstance(metadata.get("sourceSlots"), list) else []
    trace["sourceSlotCount"] = len(source_slots)
    metadata["sourceCoverageTrace"] = trace


def with_generated_curriculum_context(
    structure: dict[str, Any],
    *,
    prompt: str,
    source_urls: list[str],
    category: str | None,
    department: str | None,
) -> dict[str, Any]:
    context = compile_curriculum_benchmark_context(
        prompt=prompt,
        source_urls=source_urls,
        category=category,
        department=department,
        fetch_sources=False,
    )
    context = _remap_curriculum_context_source_ids(context, _source_id_remap_for_urls(structure, source_urls))
    metadata = dict(structure.get("metadata") if isinstance(structure.get("metadata"), dict) else {})
    existing_slots = metadata.get("sourceSlots") if isinstance(metadata.get("sourceSlots"), list) else []
    incoming_slots = context.get("sourceSlots") if isinstance(context.get("sourceSlots"), list) else []
    metadata["curriculumBenchmarks"] = context.get("curriculumBenchmarks", [])
    metadata["requirementOrigins"] = context.get("requirementOrigins", [])
    metadata["courseParityProfile"] = context.get("courseParityProfile", {})
    metadata["conceptSourceCoverageMap"] = context.get("conceptSourceCoverageMap", [])
    metadata["sourceSlots"] = _merge_source_slots(existing_slots, incoming_slots)
    _refresh_source_coverage_trace(metadata)
    generation_plan = dict(metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {})
    existing_status = generation_plan.get("status") if isinstance(generation_plan.get("status"), list) else []
    generation_plan["status"] = list(dict.fromkeys([*existing_status, *context.get("workflowGates", [])]))
    metadata["generationPlan"] = generation_plan
    prerequisites = structure.get("prerequisites")
    if not isinstance(prerequisites, list) or not prerequisites:
        prerequisites = ["No formal prerequisites; foundational concepts are introduced before applied practice."]
    return {**structure, "metadata": metadata, "prerequisites": prerequisites}
