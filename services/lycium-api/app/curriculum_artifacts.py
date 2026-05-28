from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import CourseSnapshot, CurriculumBenchmarkRecord, RequirementOriginRecord, SourceSlotRecord


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _string(value: Any, fallback: str, *, limit: int | None = None) -> str:
    text = str(value or fallback)
    return text[:limit] if limit is not None else text


def _float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def curriculum_context_from_snapshot(snapshot: CourseSnapshot) -> dict[str, Any]:
    trace = _as_dict(snapshot.generation_trace)
    trace_context = _as_dict(trace.get("curriculum_benchmark_context"))
    if trace_context:
        return trace_context

    metadata = _as_dict(_as_dict(snapshot.structure).get("metadata"))
    metadata_context = {
        "curriculumBenchmarks": _as_list(metadata.get("curriculumBenchmarks")),
        "requirementOrigins": _as_list(metadata.get("requirementOrigins")),
        "courseParityProfile": _as_dict(metadata.get("courseParityProfile")),
        "sourceSlots": _as_list(metadata.get("sourceSlots")),
    }
    if any(metadata_context[key] for key in ("curriculumBenchmarks", "requirementOrigins", "sourceSlots")):
        return metadata_context
    return {}


def persist_curriculum_artifacts(
    session: Session,
    *,
    course_snapshot_id: int,
    context: dict[str, Any] | None,
) -> dict[str, list[int]]:
    context = _as_dict(context)
    benchmarks = [_as_dict(row) for row in _as_list(context.get("curriculumBenchmarks")) if isinstance(row, dict)]
    origins = [_as_dict(row) for row in _as_list(context.get("requirementOrigins")) if isinstance(row, dict)]
    source_slots = [_as_dict(row) for row in _as_list(context.get("sourceSlots")) if isinstance(row, dict)]

    for model in (CurriculumBenchmarkRecord, RequirementOriginRecord, SourceSlotRecord):
        session.execute(delete(model).where(model.course_snapshot_id == course_snapshot_id))

    created_benchmarks: list[CurriculumBenchmarkRecord] = []
    for index, benchmark in enumerate(benchmarks, start=1):
        created_benchmarks.append(
            CurriculumBenchmarkRecord(
                course_snapshot_id=course_snapshot_id,
                benchmark_id=_string(benchmark.get("id"), f"benchmark-{index}", limit=160),
                source_type=_string(benchmark.get("sourceType"), "expert_reference", limit=80),
                title=_string(benchmark.get("title"), f"Curriculum benchmark {index}", limit=512),
                institution=_string(benchmark.get("institution"), "", limit=255) or None,
                department=_string(benchmark.get("department"), "", limit=160) or None,
                url=_string(benchmark.get("url"), "", limit=2048) or None,
                confidence=_float(benchmark.get("confidence")),
                payload=benchmark,
            )
        )

    created_origins: list[RequirementOriginRecord] = []
    for index, origin in enumerate(origins, start=1):
        created_origins.append(
            RequirementOriginRecord(
                course_snapshot_id=course_snapshot_id,
                requirement_id=_string(origin.get("requirementId"), f"requirement-{index}", limit=160),
                title=_string(origin.get("title"), f"Requirement {index}", limit=512),
                importance=_string(origin.get("importance"), "optional", limit=40),
                origin_type=_string(origin.get("originType"), "generated_gap_fill", limit=80),
                frequency=_float(origin.get("frequency")),
                evidence_refs=[str(ref) for ref in _as_list(origin.get("evidenceRefs"))],
                benchmark_ids=[str(ref) for ref in _as_list(origin.get("benchmarkIds"))],
                payload=origin,
            )
        )

    created_slots: list[SourceSlotRecord] = []
    for index, slot in enumerate(source_slots, start=1):
        required_concept_id = _string(slot.get("requiredConceptId"), f"required-concept-{index}", limit=160)
        created_slots.append(
            SourceSlotRecord(
                course_snapshot_id=course_snapshot_id,
                slot_id=_string(slot.get("id"), f"slot-{required_concept_id}", limit=180),
                required_concept_id=required_concept_id,
                primary_source_id=_string(slot.get("primarySourceId"), "", limit=160) or None,
                fallback_source_ids=[str(ref) for ref in _as_list(slot.get("fallbackSourceIds"))],
                replacement_policy=_string(slot.get("replacementPolicy"), "review_required", limit=80),
                payload=slot,
            )
        )

    session.add_all([*created_benchmarks, *created_origins, *created_slots])
    session.flush()

    return {
        "curriculumBenchmarkRecordIds": [row.id for row in created_benchmarks],
        "requirementOriginRecordIds": [row.id for row in created_origins],
        "sourceSlotRecordIds": [row.id for row in created_slots],
    }


def _has_artifact_refs(refs: dict[str, list[int]]) -> bool:
    return any(bool(ids) for ids in refs.values())


def persist_curriculum_artifacts_for_snapshot(
    session: Session,
    snapshot: CourseSnapshot,
    *,
    context: dict[str, Any] | None = None,
) -> dict[str, list[int]]:
    artifact_context = _as_dict(context) or curriculum_context_from_snapshot(snapshot)
    refs = persist_curriculum_artifacts(session, course_snapshot_id=snapshot.id, context=artifact_context)
    if not _has_artifact_refs(refs):
        return refs

    trace = dict(snapshot.generation_trace or {})
    trace["curriculum_artifact_refs"] = refs
    snapshot.generation_trace = trace

    structure = dict(snapshot.structure or {})
    metadata = dict(structure.get("metadata") or {})
    metadata["curriculumArtifactRefs"] = refs
    snapshot.structure = {**structure, "metadata": metadata}
    return refs


def _payload_with_record_id(payload: Any, record_id: int) -> dict[str, Any]:
    payload_dict = dict(payload) if isinstance(payload, dict) else {}
    payload_dict["recordId"] = record_id
    return payload_dict


def curriculum_artifacts_for_course(session: Session, course_snapshot_id: int) -> dict[str, Any]:
    benchmarks = list(
        session.scalars(
            select(CurriculumBenchmarkRecord)
            .where(CurriculumBenchmarkRecord.course_snapshot_id == course_snapshot_id)
            .order_by(CurriculumBenchmarkRecord.id.asc())
        )
    )
    origins = list(
        session.scalars(
            select(RequirementOriginRecord)
            .where(RequirementOriginRecord.course_snapshot_id == course_snapshot_id)
            .order_by(RequirementOriginRecord.id.asc())
        )
    )
    source_slots = list(
        session.scalars(
            select(SourceSlotRecord)
            .where(SourceSlotRecord.course_snapshot_id == course_snapshot_id)
            .order_by(SourceSlotRecord.id.asc())
        )
    )
    return {
        "course_snapshot_id": course_snapshot_id,
        "artifactReferences": {
            "curriculumBenchmarkRecordIds": [row.id for row in benchmarks],
            "requirementOriginRecordIds": [row.id for row in origins],
            "sourceSlotRecordIds": [row.id for row in source_slots],
        },
        "curriculumBenchmarks": [_payload_with_record_id(row.payload, row.id) for row in benchmarks],
        "requirementOrigins": [_payload_with_record_id(row.payload, row.id) for row in origins],
        "sourceSlots": [_payload_with_record_id(row.payload, row.id) for row in source_slots],
    }
