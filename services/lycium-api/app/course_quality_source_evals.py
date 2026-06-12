from __future__ import annotations

import re
from typing import Any, Literal

from app.course_source_integrity import assess_course_source_integrity
from app.course_structure import (
    block_text as _block_text,
    content_blocks as _content,
    modules as _modules,
    section_text as _section_text,
    sections as _sections,
    source_ids as _source_ids,
    source_record_ids as _source_record_ids,
)

EvalSeverity = Literal["warning", "error"]

OUTLINE_GENERIC_CONCEPTS = {
    "application",
    "applications",
    "applied_practice",
    "core",
    "core_concepts",
    "extension",
    "foundations",
    "practice",
    "review",
    "summary",
}


def _finding(severity: EvalSeverity, message: str, location: str | None = None) -> dict[str, str]:
    payload = {"severity": severity, "message": message}
    if location:
        payload["location"] = location
    return payload


def _dimension(
    *,
    key: str,
    label: str,
    weight: float,
    score: float,
    findings: list[dict[str, str]],
    metrics: dict[str, int | float],
) -> dict[str, Any]:
    clipped = round(max(0.0, min(1.0, score)), 2)
    if any(finding["severity"] == "error" for finding in findings) or clipped < 0.55:
        status = "failed"
    elif findings or clipped < 0.85:
        status = "needs_review"
    else:
        status = "passed"

    return {
        "key": key,
        "label": label,
        "weight": weight,
        "score": clipped,
        "status": status,
        "findings": findings,
        "metrics": metrics,
    }


def _normalize_outline_term(value: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[_\\/-]+", " ", str(value or "").strip().lower())).strip()


def _meaningful_outline_keywords(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    keywords: list[str] = []
    for item in value:
        normalized = _normalize_outline_term(item)
        compact = normalized.replace(" ", "_")
        if not normalized or compact in OUTLINE_GENERIC_CONCEPTS or normalized in OUTLINE_GENERIC_CONCEPTS:
            continue
        if len(normalized) < 3:
            continue
        keywords.append(normalized)
    return list(dict.fromkeys(keywords))


def _outline_keyword_is_covered(keyword: str, section_text: str) -> bool:
    if keyword in section_text:
        return True
    tokens = [token for token in re.findall(r"[a-z0-9+#.-]{3,}", keyword) if token not in OUTLINE_GENERIC_CONCEPTS]
    if not tokens:
        return True
    return all(token in section_text for token in tokens)


def _outline_source_ids(value: Any) -> set[str]:
    if isinstance(value, list):
        return {
            source_id
            for item in value
            for source_id in _outline_source_ids(item)
        }
    if not isinstance(value, dict):
        return set()
    source_ids = {
        str(source_id)
        for source_id in value.get("sourceIds", [])
        if str(source_id).strip()
    } if isinstance(value.get("sourceIds"), list) else set()
    for child_key in ("modules", "sections"):
        children = value.get(child_key)
        if isinstance(children, list):
            source_ids.update(_outline_source_ids(children))
    return source_ids


def _eval_generation_outline_coverage(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    outlined_section_count = 0
    planned_keyword_count = 0
    covered_keyword_count = 0
    planned_source_section_count = 0
    aligned_source_section_count = 0
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    generation_plan = metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {}
    course_build_outline = metadata.get("courseBuildOutline") if isinstance(metadata.get("courseBuildOutline"), dict) else {}
    planning_source = str(generation_plan.get("planningSource") or "")
    course_outline_modules = course_build_outline.get("modules") if isinstance(course_build_outline.get("modules"), list) else []
    outline_source_ids = _outline_source_ids(course_build_outline)
    declared_source_ids = set(_source_record_ids(course))
    missing_outline_source_ids = sorted(outline_source_ids - declared_source_ids)

    if planning_source in {"source_packet_outline", "source_corpus_outline"}:
        if not course_build_outline:
            findings.append(
                _finding(
                    "error",
                    "Course was planned from a source-derived outline but does not preserve metadata.courseBuildOutline.",
                    "metadata.courseBuildOutline",
                )
            )
        if missing_outline_source_ids:
            findings.append(
                _finding(
                    "error",
                    "Course source-packet outline references sourceIds missing from sourceRecords: "
                    + ", ".join(missing_outline_source_ids[:10])
                    + ".",
                    "metadata.courseBuildOutline",
                )
            )
        elif not course_outline_modules:
            findings.append(
                _finding(
                    "error",
                    "Course source-derived outline has no module plan to support review or regeneration.",
                    "metadata.courseBuildOutline.modules",
                )
            )

    for module_index, module in enumerate(_modules(course), start=1):
        for section_index, section in enumerate(_sections(module), start=1):
            metadata = section.get("metadata") if isinstance(section.get("metadata"), dict) else {}
            generation_outline = metadata.get("generationOutline") if isinstance(metadata.get("generationOutline"), dict) else {}
            planned_keywords = _meaningful_outline_keywords(generation_outline.get("plannedConceptKeywords"))
            planned_source_ids = {
                str(source_id)
                for source_id in generation_outline.get("plannedSourceIds", [])
                if str(source_id).strip()
            } if isinstance(generation_outline.get("plannedSourceIds"), list) else set()
            if not generation_outline and not planned_keywords:
                continue
            outlined_section_count += 1
            location = f"modules[{module_index}].sections[{section_index}]"
            if planned_source_ids:
                planned_source_section_count += 1
                section_source_ids = set(_source_ids(section))
                if planned_source_ids.issubset(section_source_ids):
                    aligned_source_section_count += 1
                elif planning_source in {"source_packet_outline", "source_corpus_outline"}:
                    missing_section_source_ids = sorted(planned_source_ids - section_source_ids)
                    findings.append(
                        _finding(
                            "error",
                            "Generated section is missing planned sourceIds: "
                            + ", ".join(missing_section_source_ids[:10])
                            + ".",
                            location,
                        )
                    )
            if not planned_keywords:
                continue

            text = _normalize_outline_term(_section_text(section))
            missing: list[str] = []
            for keyword in planned_keywords:
                planned_keyword_count += 1
                if _outline_keyword_is_covered(keyword, text):
                    covered_keyword_count += 1
                else:
                    missing.append(keyword)
            if missing:
                findings.append(
                    _finding(
                        "error",
                        "Generated section does not visibly cover planned outline concepts: " + ", ".join(missing[:6]) + ".",
                        location,
                    )
                )

    coverage_ratio = covered_keyword_count / planned_keyword_count if planned_keyword_count else 1.0
    source_alignment_ratio = (
        aligned_source_section_count / planned_source_section_count
        if planned_source_section_count
        else 1.0
    )
    if outlined_section_count and planned_keyword_count == 0:
        findings.append(_finding("warning", "Generated sections have outline metadata but no meaningful planned concept keywords."))
    return _dimension(
        key="generation_outline_coverage",
        label="Generation outline coverage",
        weight=0.1,
        score=coverage_ratio,
        findings=findings,
        metrics={
            "outlinedSectionCount": outlined_section_count,
            "plannedKeywordCount": planned_keyword_count,
            "coveredKeywordCount": covered_keyword_count,
            "coverageRatio": round(coverage_ratio, 2),
            "plannedSourceSectionCount": planned_source_section_count,
            "alignedSourceSectionCount": aligned_source_section_count,
            "sourceAlignmentRatio": round(source_alignment_ratio, 2),
            "hasCourseBuildOutline": int(bool(course_build_outline)),
            "courseBuildOutlineModuleCount": len(course_outline_modules),
            "outlineSourceIdCount": len(outline_source_ids),
            "missingOutlineSourceIdCount": len(missing_outline_source_ids),
        },
    )


def _eval_sources(course: dict[str, Any]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    integrity = assess_course_source_integrity(course)
    integrity_metrics = integrity["metrics"]
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    generation_plan = metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {}
    source_policy = metadata.get("sourceCoveragePolicy") if isinstance(metadata.get("sourceCoveragePolicy"), dict) else {}
    synthesis = metadata.get("sourceCorpusSynthesis") if isinstance(metadata.get("sourceCorpusSynthesis"), dict) else {}
    source_packet = synthesis.get("sourcePacket") if isinstance(synthesis.get("sourcePacket"), dict) else {}
    declared = _source_record_ids(course)
    referenced: set[str] = set(_source_ids(course))
    sourced_sections = 0
    section_count = 0
    for module in _modules(course):
        referenced.update(_source_ids(module))
        for section in _sections(module):
            section_count += 1
            section_ids = set(_source_ids(section))
            if section_ids:
                sourced_sections += 1
            referenced.update(section_ids)
            for block in _content(section):
                referenced.update(_source_ids(block))

    if not declared:
        findings.append(_finding("error", "Course includes no sourceRecords."))
    if not referenced:
        findings.append(_finding("warning", "Course includes no sourceIds references."))
    missing = sorted(referenced - declared)
    if missing and declared:
        findings.append(_finding("error", f"Referenced sourceIds are missing sourceRecords: {', '.join(missing[:10])}."))
    direct_concept_ratio = float(integrity_metrics.get("directConceptSourceCoveragePercent") or 0) / 100
    direct_block_ratio = float(integrity_metrics.get("directBlockSourceCoveragePercent") or 0) / 100
    if integrity_metrics.get("conceptCount", 0) and direct_concept_ratio < 0.85:
        findings.append(_finding("warning", "Concept source coverage relies too heavily on inherited section/module sources."))
    if integrity_metrics.get("sourceBearingBlockCount", 0) and direct_block_ratio < 0.6:
        findings.append(_finding("warning", "Instructional blocks should carry more direct sourceIds."))
    if source_policy.get("requireSourcePacketForPublishableCourses") is True and not source_packet.get("quality"):
        findings.append(
            _finding(
                "error",
                "Publishable source-backed courses require source-packet evidence; keep this artifact as a draft or add a source packet.",
                "metadata.sourceCorpusSynthesis.sourcePacket",
            )
        )
    if generation_plan.get("planningSource") == "source_packet_outline" and not source_packet.get("quality"):
        findings.append(
            _finding(
                "error",
                "Courses planned from a source-packet outline must preserve source-packet quality evidence.",
                "metadata.sourceCorpusSynthesis.sourcePacket.quality",
            )
        )
    source_ratio = sourced_sections / section_count if section_count else 0
    diversity_score = min(1.0, len(declared) / 3)
    score = source_ratio * 0.25 + diversity_score * 0.25 + direct_concept_ratio * 0.25 + direct_block_ratio * 0.15 + (0.1 if not missing else 0)
    return _dimension(key="source_grounding", label="Source grounding", weight=0.16, score=score, findings=findings, metrics={"sourceRecordCount": len(declared), "referencedSourceIdCount": len(referenced), "sourcedSectionRatio": round(source_ratio, 2), "directConceptSourceCoveragePercent": integrity_metrics.get("directConceptSourceCoveragePercent"), "directBlockSourceCoveragePercent": integrity_metrics.get("directBlockSourceCoveragePercent")})


