from __future__ import annotations

from typing import Any

from app.course_structure import source_record_count


def has_unverified_submitted_source_coverage(course: dict[str, Any], integrity_metrics: dict[str, Any]) -> bool:
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    trace = metadata.get("sourceCoverageTrace") if isinstance(metadata.get("sourceCoverageTrace"), dict) else {}
    section_map = trace.get("sectionSourceMap") if isinstance(trace.get("sectionSourceMap"), dict) else {}
    knowledge_map = trace.get("knowledgeObjectMap") if isinstance(trace.get("knowledgeObjectMap"), dict) else {}
    verified_section_sources = any(isinstance(value, list) and value for value in section_map.values())
    verified_knowledge_sources = any(isinstance(value, list) and value for value in knowledge_map.values())
    return (
        source_record_count(course) > 0
        and integrity_metrics.get("sourceSlotCount") == 0
        and integrity_metrics.get("conceptCoverageMapCount") == 0
        and not verified_section_sources
        and not verified_knowledge_sources
    )
