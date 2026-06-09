from __future__ import annotations

import re
from typing import Any

from app.course_structure import content_blocks, modules, sections, source_ids

LABEL_STOP_TOKENS = {"quiz", "summary", "module", "week", "lesson", "review"}
INLINE_CITATION_PATTERN = re.compile(r"\[(\d+)\]")
SOURCE_BEARING_BLOCK_TYPES = {"text", "video", "iframe", "quiz", "conceptCard", "concept_card", "conceptCards", "concept_cards"}


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _tokens(value: Any) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", str(value or "").lower())
        if len(token) > 2 and token not in LABEL_STOP_TOKENS
    }


def _source_record_ids(course: dict[str, Any]) -> set[str]:
    records = course.get("sourceRecords")
    if isinstance(records, dict):
        return {str(source_id) for source_id in records if source_id}
    if isinstance(records, list):
        return {str(record.get("id")) for record in records if isinstance(record, dict) and record.get("id")}
    return set()


def _source_ref_ids(value: Any) -> set[str]:
    if not isinstance(value, str):
        return set()
    clean = value.strip()
    if not clean:
        return set()
    return {clean, clean.split("#", 1)[0]}


def _requirement_key(value: Any) -> str:
    return str(value or "").strip()


def _requirement_origin_context(metadata: dict[str, Any]) -> dict[str, dict[str, set[str]]]:
    context: dict[str, dict[str, set[str]]] = {}
    for origin in _items(metadata.get("requirementOrigins")):
        key = _requirement_key(origin.get("requirementId") or origin.get("id"))
        if not key:
            continue
        evidence_refs = origin.get("evidenceRefs")
        context[key] = {
            "tokens": _tokens(origin.get("title")) | _tokens(origin.get("description")) | _tokens(origin.get("requirementId")),
            "sources": {source_id for source_id in evidence_refs if isinstance(source_id, str) and source_id.strip()} if isinstance(evidence_refs, list) else set(),
        }
    return context


def _slot_requirement_key(slot: dict[str, Any]) -> str:
    return _requirement_key(slot.get("requiredConceptId") or slot.get("conceptId") or slot.get("requirementId") or slot.get("id"))


def _slot_sources(slot: dict[str, Any], requirement_context: dict[str, dict[str, set[str]]]) -> set[str]:
    sources: set[str] = set()
    primary = slot.get("primarySourceId")
    sources.update(_source_ref_ids(primary))
    fallback = slot.get("fallbackSourceIds")
    if isinstance(fallback, list):
        for source_id in fallback:
            sources.update(_source_ref_ids(source_id))
    sources.update(source_ids(slot))
    context = requirement_context.get(_slot_requirement_key(slot))
    if context:
        sources.update(context["sources"])
    return sources


def _slot_tokens(slot: dict[str, Any], requirement_context: dict[str, dict[str, set[str]]]) -> set[str]:
    values = [
        slot.get("requiredConceptId"),
        slot.get("conceptId"),
        slot.get("requirementId"),
        slot.get("title"),
        slot.get("name"),
        slot.get("concept"),
    ]
    token_set: set[str] = set()
    for value in values:
        token_set.update(_tokens(value))
    section_ids = slot.get("sectionIds")
    if isinstance(section_ids, list):
        for section_id in section_ids:
            token_set.update(_tokens(section_id))
    context = requirement_context.get(_slot_requirement_key(slot))
    if context:
        token_set.update(context["tokens"])
    return token_set


def _is_verified_source_mapping(row: dict[str, Any]) -> bool:
    return str(row.get("coverageStatus") or row.get("status") or "").lower() != "unverified"


def _source_slots(course: dict[str, Any]) -> list[dict[str, Any]]:
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    return [slot for slot in _items(metadata.get("sourceSlots")) if _is_verified_source_mapping(slot)]


def _concept_source_coverage(metadata: dict[str, Any]) -> list[dict[str, Any]]:
    return [row for row in _items(metadata.get("conceptSourceCoverageMap")) if _is_verified_source_mapping(row)]


def _matching_slot_sources(slots: list[dict[str, Any]], requirement_context: dict[str, dict[str, set[str]]], *labels: Any) -> set[str]:
    label_token_sets = [tokens for tokens in (_tokens(label) for label in labels) if tokens]
    if not label_token_sets:
        return set()
    matched: set[str] = set()
    for slot in slots:
        slot_tokens = _slot_tokens(slot, requirement_context)
        if not slot_tokens:
            continue
        if any(label_tokens.issubset(slot_tokens) or slot_tokens.issubset(label_tokens) for label_tokens in label_token_sets):
            matched.update(_slot_sources(slot, requirement_context))
    return matched


def _coverage_sources(row: dict[str, Any]) -> set[str]:
    sources: set[str] = set()
    primary = row.get("primarySourceId")
    sources.update(_source_ref_ids(primary))
    fallback = row.get("fallbackSourceIds")
    if isinstance(fallback, list):
        for source_id in fallback:
            sources.update(_source_ref_ids(source_id))
    evidence_refs = row.get("evidenceRefs")
    if isinstance(evidence_refs, list):
        for source_id in evidence_refs:
            sources.update(_source_ref_ids(source_id))
    sources.update(source_ids(row))
    return sources


def _coverage_tokens(row: dict[str, Any]) -> set[str]:
    token_set: set[str] = set()
    for key in ("conceptId", "requirementOriginId", "title", "name"):
        token_set.update(_tokens(row.get(key)))
    return token_set


def _sorted_sources(sources: set[str]) -> list[str]:
    return sorted(source for source in sources if source)


def _block_label(block: dict[str, Any], block_index: int) -> str:
    for key in ("heading", "title", "name", "type"):
        value = block.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return f"block {block_index}"


def _section_coverage_sources(
    coverage_map: list[dict[str, Any]],
    section: dict[str, Any],
    concepts: list[dict[str, Any]],
) -> set[str]:
    section_id = section.get("id")
    section_key = str(section_id).strip() if isinstance(section_id, str) else ""
    label_values: list[Any] = [section.get("title"), section.get("id")]
    for concept in concepts:
        label_values.append(_concept_name(concept))
        label_values.append(concept.get("sourceSectionId"))
    label_token_sets = [tokens for tokens in (_tokens(value) for value in label_values) if tokens]

    matched: set[str] = set()
    for row in coverage_map:
        row_sources = _coverage_sources(row)
        if not row_sources:
            continue
        row_section_ids = row.get("sectionIds")
        if section_key and isinstance(row_section_ids, list) and section_key in {str(value).strip() for value in row_section_ids}:
            matched.update(row_sources)
            continue
        row_tokens = _coverage_tokens(row)
        if row_tokens and any(label_tokens.issubset(row_tokens) or row_tokens.issubset(label_tokens) for label_tokens in label_token_sets):
            matched.update(row_sources)
    return matched


def _concepts_from_block(block: dict[str, Any]) -> list[dict[str, Any]]:
    concepts: list[dict[str, Any]] = []
    if block.get("type") == "conceptCard":
        concepts.append(block)
    parent_source_ids = source_ids(block)
    for concept in _items(block.get("concepts")):
        concept_sources = source_ids(concept)
        concepts.append(
            {
                **concept,
                "sourceIds": concept_sources or parent_source_ids,
            }
        )
    questions = block.get("questions") or block.get("questionBank") or block.get("question_bank")
    for question in _items(questions):
        for key in ("concept", "conceptId", "topic"):
            value = question.get(key)
            if isinstance(value, str) and value.strip():
                concepts.append({"name": value, "sourceIds": parent_source_ids})
        concept_ids = question.get("conceptIds")
        if isinstance(concept_ids, list):
            concepts.extend({"name": concept_id, "sourceIds": parent_source_ids} for concept_id in concept_ids if isinstance(concept_id, str))
        for concept in _items(question.get("concepts")):
            concept_sources = source_ids(concept)
            concepts.append(
                {
                    **concept,
                    "sourceIds": concept_sources or parent_source_ids,
                }
            )
    return concepts


def _concept_name(concept: dict[str, Any]) -> str:
    for key in ("id", "name", "title", "conceptId"):
        value = concept.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def _citation_source_ids(section: dict[str, Any]) -> set[str]:
    citations = section.get("citations")
    ids: set[str] = set()
    for citation in _items(citations):
        for key in ("sourceId", "source_id", "id"):
            source_id = citation.get(key)
            if isinstance(source_id, str) and source_id.strip():
                ids.add(source_id)
            elif isinstance(source_id, int):
                ids.add(f"source-{source_id}")
        ids.update(source_ids(citation))
    return ids


def _section_source_ids(section: dict[str, Any]) -> set[str]:
    ids = set(source_ids(section))
    for block in content_blocks(section):
        ids.update(source_ids(block))
    ids.update(_citation_source_ids(section))
    return ids


def _rendered_section_source_count(section: dict[str, Any]) -> int:
    ids = set(source_ids(section))
    for block in content_blocks(section):
        ids.update(source_ids(block))
    return len(ids)


def _inline_citation_indexes(section: dict[str, Any]) -> list[int]:
    indexes: list[int] = []
    for block in content_blocks(section):
        if block.get("type") != "text":
            continue
        for key in ("heading", "value", "text"):
            value = block.get(key)
            if not isinstance(value, str):
                continue
            indexes.extend(int(match.group(1)) for match in INLINE_CITATION_PATTERN.finditer(value))
    return indexes


def _section_location(module_index: int, section_index: int) -> str:
    return f"modules[{module_index}].sections[{section_index}]"


def assess_course_source_integrity(course: dict[str, Any]) -> dict[str, Any]:
    slots = _source_slots(course)
    course_sources = set(source_ids(course)) or _source_record_ids(course)
    course_source_by_number = {index: source_id for index, source_id in enumerate(source_ids(course) or sorted(_source_record_ids(course)), start=1)}
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    coverage_map = _concept_source_coverage(metadata)
    requirement_context = _requirement_origin_context(metadata)
    raw_policy = metadata.get("sourceCoveragePolicy")
    policy = raw_policy if isinstance(raw_policy, dict) else {}
    min_concept_coverage = float((policy or {}).get("minimumRequiredConceptCoveragePercent") or 70)
    require_direct_concept_coverage = policy.get("requireDirectConceptSourceMappings") is True
    warn_on_inherited_concept_coverage = policy.get("warnOnInheritedConceptSourceCoverage") is True
    require_direct_block_coverage = policy.get("requireDirectBlockSourceMappings") is True
    warn_on_inherited_block_coverage = policy.get("warnOnInheritedBlockSourceCoverage") is True
    issues: list[dict[str, str]] = []
    section_allowed: dict[str, set[str]] = {}
    concept_count = 0
    covered_concept_count = 0
    directly_covered_concept_count = 0
    section_count = 0
    blanket_section_count = 0
    citation_issue_count = 0
    unmapped_citation_count = 0
    inline_citation_issue_count = 0
    concept_coverage_rows: list[dict[str, Any]] = []
    block_coverage_rows: list[dict[str, Any]] = []
    source_bearing_block_count = 0
    directly_sourced_block_count = 0

    for module_index, module in enumerate(modules(course), start=1):
        module_sources = set(source_ids(module))
        for section_index, section in enumerate(sections(module), start=1):
            section_count += 1
            location = _section_location(module_index, section_index)
            concepts = [concept for block in content_blocks(section) for concept in _concepts_from_block(block)]
            label_sources = _matching_slot_sources(slots, requirement_context, section.get("title"), section.get("id"))
            inherited_sources: set[str] = set()
            for concept in concepts:
                origin_section_id = concept.get("sourceSectionId")
                if isinstance(origin_section_id, str):
                    inherited_sources.update(section_allowed.get(origin_section_id, set()))
            direct_concept_sources = set().union(
                *(_matching_slot_sources(slots, requirement_context, _concept_name(concept), concept.get("sourceSectionId")) for concept in concepts)
            ) if concepts else set()
            coverage_sources = _section_coverage_sources(coverage_map, section, concepts)
            allowed = label_sources | inherited_sources | direct_concept_sources | coverage_sources
            if not slots and not coverage_map and not allowed:
                allowed = set(source_ids(section)) or module_sources
            section_id = section.get("id")
            if isinstance(section_id, str):
                section_allowed[section_id] = allowed

            used = _section_source_ids(section)
            citation_ids = _citation_source_ids(section)
            inline_citation_indexes = _inline_citation_indexes(section)
            invalid_inline_citations = [
                index
                for index in inline_citation_indexes
                if index not in course_source_by_number or course_source_by_number[index] not in used
            ]
            if invalid_inline_citations:
                inline_citation_issue_count += len(invalid_inline_citations)
                citation_issue_count += len(invalid_inline_citations)
                issues.append({
                    "severity": "error",
                    "message": (
                        "Inline citation markers are outside the course-wide source index or missing local sourceId support: "
                        f"{', '.join(f'[{index}]' for index in invalid_inline_citations[:6])}."
                    ),
                    "location": location,
                })
            unmapped_citations: set[str] = set()
            if citation_ids and (slots or coverage_map):
                unmapped_citations = citation_ids - allowed
                if unmapped_citations:
                    citation_issue_count += len(unmapped_citations)
                    unmapped_citation_count += len(unmapped_citations)
                    issues.append({
                        "severity": "error",
                        "message": f"Section citations are not mapped to concepts in this section: {', '.join(sorted(unmapped_citations)[:6])}.",
                        "location": location,
                    })

            if course_sources and used == course_sources and len(course_sources) >= 4:
                blanket_section_count += 1
                issues.append({
                    "severity": "error",
                    "message": "Section appears to cite every course source instead of sources mapped to its concepts.",
                    "location": location,
                })
            if allowed:
                extra = sorted((used - allowed) - unmapped_citations)
                if extra:
                    citation_issue_count += len(extra)
                    issues.append({
                        "severity": "error",
                        "message": f"Section references sources not mapped to its concepts: {', '.join(extra[:6])}.",
                        "location": location,
                    })
            elif used and (slots or coverage_map) and not unmapped_citations:
                citation_issue_count += len(used)
                issues.append({
                    "severity": "error",
                    "message": "Section has source references but no matching concept source slot.",
                    "location": location,
                })

            for concept in concepts:
                concept_count += 1
                concept_name = _concept_name(concept)
                direct_concept_sources = (
                    set(source_ids(concept))
                    | _matching_slot_sources(slots, requirement_context, concept_name, concept.get("sourceSectionId"))
                    | _section_coverage_sources(coverage_map, section, [concept])
                )
                concept_sources = (
                    direct_concept_sources
                    | _matching_slot_sources(slots, requirement_context, concept_name, concept.get("sourceSectionId"))
                    | inherited_sources
                    | label_sources
                    | coverage_sources
                )
                if not slots and not coverage_map:
                    concept_sources.update(source_ids(section))
                if direct_concept_sources:
                    directly_covered_concept_count += 1
                if concept_sources:
                    covered_concept_count += 1
                elif slots:
                    issues.append({
                        "severity": "error",
                        "message": f"Concept has no accepted source mapping: {concept_name or 'unnamed concept'}.",
                        "location": location,
                    })
                concept_coverage_rows.append({
                    "concept": concept_name or "unnamed concept",
                    "location": location,
                    "sectionId": section.get("id"),
                    "sourceSectionId": concept.get("sourceSectionId"),
                    "status": "direct" if direct_concept_sources else "inherited" if concept_sources else "missing",
                    "sourceIds": _sorted_sources(concept_sources),
                    "directSourceIds": _sorted_sources(direct_concept_sources),
                    "inheritedSourceIds": _sorted_sources(concept_sources - direct_concept_sources),
                })
            for block_index, block in enumerate(content_blocks(section), start=1):
                if block.get("type") not in SOURCE_BEARING_BLOCK_TYPES:
                    continue
                source_bearing_block_count += 1
                direct_block_sources = set(source_ids(block))
                inherited_block_sources = (set(source_ids(section)) | module_sources) - direct_block_sources
                block_sources = direct_block_sources | inherited_block_sources
                if direct_block_sources:
                    directly_sourced_block_count += 1
                elif block_sources and (require_direct_block_coverage or warn_on_inherited_block_coverage):
                    issues.append({
                        "severity": "error" if require_direct_block_coverage else "warning",
                        "message": f"Instructional block relies on section/module source coverage instead of direct block sourceIds: {_block_label(block, block_index)}.",
                        "location": f"{location}.content[{block_index - 1}]",
                    })
                elif not block_sources and (require_direct_block_coverage or warn_on_inherited_block_coverage):
                    issues.append({
                        "severity": "error" if require_direct_block_coverage else "warning",
                        "message": f"Instructional block has no source coverage: {_block_label(block, block_index)}.",
                        "location": f"{location}.content[{block_index - 1}]",
                    })
                block_coverage_rows.append({
                    "block": _block_label(block, block_index),
                    "blockType": block.get("type"),
                    "location": f"{location}.content[{block_index - 1}]",
                    "sectionId": section.get("id"),
                    "status": "direct" if direct_block_sources else "inherited" if block_sources else "missing",
                    "sourceIds": _sorted_sources(block_sources),
                    "directSourceIds": _sorted_sources(direct_block_sources),
                    "inheritedSourceIds": _sorted_sources(inherited_block_sources),
                })

    if not slots and not coverage_map and concept_count:
        issues.append({
            "severity": "warning",
            "message": "Course has concepts but no metadata.sourceSlots; concept-level source support cannot be fully verified.",
            "location": "metadata.sourceSlots",
        })
    coverage_percent = round((covered_concept_count / concept_count) * 100, 2) if concept_count else 100.0
    direct_coverage_percent = round((directly_covered_concept_count / concept_count) * 100, 2) if concept_count else 100.0
    direct_block_coverage_percent = round((directly_sourced_block_count / source_bearing_block_count) * 100, 2) if source_bearing_block_count else 100.0
    if concept_count and coverage_percent < min_concept_coverage:
        issues.append({
            "severity": "error",
            "message": f"Required concept source coverage is {coverage_percent}%, below policy minimum {min_concept_coverage}%.",
            "location": "metadata.sourceCoveragePolicy.minimumRequiredConceptCoveragePercent",
        })
    if concept_count and directly_covered_concept_count < concept_count and (require_direct_concept_coverage or warn_on_inherited_concept_coverage):
        inherited_count = concept_count - directly_covered_concept_count
        issues.append({
            "severity": "error" if require_direct_concept_coverage else "warning",
            "message": f"{inherited_count} concepts rely on section-level or inherited source coverage instead of direct concept/block source mappings.",
            "location": "metadata.conceptSourceCoverageMap",
        })
    return {
        "issues": issues,
        "metrics": {
            "conceptCount": concept_count,
            "coveredConceptCount": covered_concept_count,
            "conceptSourceCoveragePercent": coverage_percent,
            "directlyCoveredConceptCount": directly_covered_concept_count,
            "directConceptSourceCoveragePercent": direct_coverage_percent,
            "sourceBearingBlockCount": source_bearing_block_count,
            "directlySourcedBlockCount": directly_sourced_block_count,
            "directBlockSourceCoveragePercent": direct_block_coverage_percent,
            "sourceSlotCount": len(slots),
            "conceptCoverageMapCount": len(coverage_map),
            "sectionCount": section_count,
            "blanketSourceSectionCount": blanket_section_count,
            "citationIssueCount": citation_issue_count,
            "unmappedCitationCount": unmapped_citation_count,
            "inlineCitationIssueCount": inline_citation_issue_count,
        },
        "conceptCoverage": concept_coverage_rows,
        "blockCoverage": block_coverage_rows,
    }
