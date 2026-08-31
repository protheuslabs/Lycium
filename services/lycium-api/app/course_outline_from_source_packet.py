from __future__ import annotations

import re
from collections import Counter
from typing import Any

from app.generation_helpers import _title_from_prompt_or_source

SOURCE_PACKET_OUTLINE_CONTRACT_VERSION = "course-outline-from-source-packet-v1"
COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT = "course-module-outline-quality-report-v1"
TOKEN_RE = re.compile(r"[a-z][a-z0-9+#.-]{2,}")
STOPWORDS = {
    "about",
    "after",
    "also",
    "and",
    "answer",
    "answers",
    "appendix",
    "are",
    "attached",
    "before",
    "catalog",
    "chapter",
    "check",
    "course",
    "courses",
    "concept",
    "concepts",
    "content",
    "contents",
    "covers",
    "covering",
    "create",
    "document",
    "documents",
    "edu",
    "example",
    "exercise",
    "exercises",
    "fallacies",
    "file",
    "files",
    "focus",
    "focused",
    "from",
    "into",
    "learn",
    "learning",
    "lesson",
    "module",
    "modules",
    "open",
    "outline",
    "pitfall",
    "pitfalls",
    "preface",
    "practice",
    "program",
    "provided",
    "purpose",
    "section",
    "sections",
    "self",
    "self-check",
    "source",
    "sources",
    "uploaded",
    "student",
    "students",
    "study",
    "summary",
    "table",
    "that",
    "the",
    "this",
    "through",
    "toc",
    "topic",
    "topics",
    "unit",
    "units",
    "using",
    "with",
    "pdf",
}

GENERIC_BOOK_PHRASES = {
    "contents",
    "self-check",
    "self check",
    "self check answers",
    "table contents",
    "table of contents",
}


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text(value: Any) -> str:
    if isinstance(value, list):
        return " ".join(_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(_text(item) for item in value.values())
    return str(value or "")


def _tokens(value: Any) -> list[str]:
    return [
        token
        for token in TOKEN_RE.findall(_text(value).lower())
        if token not in STOPWORDS and len(token) >= 3
    ]


def _concept_phrase_candidates(value: Any, limit: int) -> list[str]:
    text = _text(value).lower()
    counter: Counter[str] = Counter()
    fragments = re.split(r"[\n.;:()]+", text)
    for fragment in fragments:
        for phrase in re.split(r",|\band\b|\bor\b|\bare\b|\bis\b|\binclude(?:s)?\b|\bcover(?:s)?\b", fragment):
            tokens = _tokens(phrase)
            if not tokens or len(tokens) > 4:
                continue
            if len(tokens) == 1 and len(tokens[0]) < 5:
                continue
            if " ".join(tokens) in GENERIC_BOOK_PHRASES:
                continue
            counter[" ".join(tokens)] += 3

    tokens = _tokens(text)
    for size in (3, 2):
        for index in range(0, max(0, len(tokens) - size + 1)):
            phrase_tokens = tokens[index : index + size]
            if len(set(phrase_tokens)) != len(phrase_tokens):
                continue
            counter[" ".join(phrase_tokens)] += 1
    for token in tokens:
        if len(token) >= 7:
            counter[token] += 1

    phrases: list[str] = []
    for phrase, _count in counter.most_common(max(limit * 3, limit)):
        if any(phrase in existing or existing in phrase for existing in phrases):
            continue
        phrases.append(phrase)
        if len(phrases) >= limit:
            break
    return phrases


def _source_documents(source_packet: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(source_packet, dict):
        return []
    documents = _items(source_packet.get("source_documents") or source_packet.get("sourceDocuments"))
    if documents:
        return documents
    sources = _items(source_packet.get("sources"))
    return [
        {
            "title": source.get("title") or source.get("source_title") or source.get("sourceTitle"),
            "url": source.get("url") or source.get("canonical_url") or source.get("canonicalUrl"),
            "text": source.get("text") or source.get("summary") or source.get("description"),
        }
        for source in sources
    ]


def _source_packet_contract(source_packet: dict[str, Any] | None) -> str:
    if not isinstance(source_packet, dict):
        return ""
    return str(source_packet.get("contract_version") or source_packet.get("contractVersion") or "")


def _source_packet_quality(source_packet: dict[str, Any] | None) -> dict[str, Any]:
    packet = source_packet if isinstance(source_packet, dict) else {}
    quality = packet.get("quality") if isinstance(packet.get("quality"), dict) else {}
    if quality:
        return quality
    synthesis = packet.get("synthesis") if isinstance(packet.get("synthesis"), dict) else {}
    synthesis_packet = synthesis.get("sourcePacket") if isinstance(synthesis.get("sourcePacket"), dict) else {}
    quality = synthesis_packet.get("quality") if isinstance(synthesis_packet.get("quality"), dict) else {}
    if quality:
        return quality
    nested_packet = packet.get("sourcePacket") if isinstance(packet.get("sourcePacket"), dict) else {}
    return nested_packet.get("quality") if isinstance(nested_packet.get("quality"), dict) else {}


def _course_source_id(document: dict[str, Any], index: int) -> str:
    explicit = str(document.get("courseSourceId") or document.get("inputSourceId") or "").strip()
    if explicit:
        return explicit
    return f"input-source-{index}"


def _source_inventory(source_packet: dict[str, Any] | None) -> list[dict[str, Any]]:
    return [
        {
            "sourceId": _course_source_id(document, index),
            "sourceRef": str(document.get("sourceId") or ""),
            "snapshotRef": str(document.get("snapshotId") or ""),
            "url": str(document.get("url") or ""),
            "tokens": set(_tokens(_document_text(document))),
        }
        for index, document in enumerate(_source_documents(source_packet), start=1)
    ]


def _source_ids_for_term(term: str, source_inventory: list[dict[str, Any]]) -> list[str]:
    term_tokens = set(_tokens(term))
    matched = [
        str(source["sourceId"])
        for source in source_inventory
        if term_tokens and term_tokens.intersection(source.get("tokens", set()))
    ]
    if matched:
        return list(dict.fromkeys(matched))
    return [str(source["sourceId"]) for source in source_inventory] or []


def _document_text(document: dict[str, Any]) -> str:
    return " ".join(
        [
            _text(document.get("title")),
            _text(document.get("url")),
            _text(document.get("text") or document.get("rawText") or document.get("content") or document.get("extracted_text")),
        ]
    )


def _section_outlines(module: dict[str, Any]) -> list[dict[str, Any]]:
    return _items(module.get("sections"))


def _outline_source_ids(value: dict[str, Any]) -> list[str]:
    return [
        str(source_id).strip()
        for source_id in value.get("sourceIds", [])
        if str(source_id).strip()
    ] if isinstance(value.get("sourceIds"), list) else []


def _outline_objectives(value: dict[str, Any]) -> list[str]:
    return [
        str(objective).strip()
        for objective in value.get("learning_objectives") or value.get("learningObjectives") or []
        if str(objective).strip()
    ] if isinstance(value.get("learning_objectives") or value.get("learningObjectives"), list) else []


def _outline_concepts(value: dict[str, Any]) -> list[str]:
    return [
        str(concept).strip()
        for concept in value.get("concept_keywords") or value.get("conceptKeywords") or value.get("concepts") or []
        if str(concept).strip()
    ] if isinstance(value.get("concept_keywords") or value.get("conceptKeywords") or value.get("concepts"), list) else []


def _has_materialized_outline_content(value: Any) -> bool:
    if isinstance(value, dict):
        if any(key in value for key in ("content", "blocks", "lessonText", "body", "markdown", "html")):
            return True
        return any(_has_materialized_outline_content(child) for child in value.values())
    if isinstance(value, list):
        return any(_has_materialized_outline_content(item) for item in value)
    return False


def _dedupe_count(values: list[str]) -> int:
    seen: set[str] = set()
    duplicate_count = 0
    for value in values:
        key = value.strip().lower()
        if not key:
            continue
        if key in seen:
            duplicate_count += 1
        seen.add(key)
    return duplicate_count


def build_course_module_outline_quality_report(
    outline: dict[str, Any] | None,
    *,
    source_packet: dict[str, Any] | None = None,
    desired_module_count: int = 4,
    sections_per_module: int = 2,
    coverage_checklist: dict[str, Any] | None = None,
) -> dict[str, Any]:
    outline_row = outline if isinstance(outline, dict) else {}
    modules = _items(outline_row.get("modules"))
    source_documents = _source_documents(source_packet)
    source_inventory = _source_inventory(source_packet)
    source_packet_present = isinstance(source_packet, dict)
    source_packet_contract = _source_packet_contract(source_packet)
    source_packet_quality = _source_packet_quality(source_packet)
    required_coverage_items = _coverage_items(coverage_checklist)
    required_coverage_ids = {
        _coverage_item_id(item, index)
        for index, item in enumerate(required_coverage_items, start=1)
    }
    source_quality_status = str(source_packet_quality.get("status") or "").lower()
    try:
        concept_coverage_ratio = float(source_packet_quality.get("conceptCoverageRatio") or 0)
    except (TypeError, ValueError):
        concept_coverage_ratio = 0.0
    uncovered_concepts = [
        str(concept).strip()
        for concept in source_packet_quality.get("uncoveredConceptCandidates", [])
        if str(concept).strip()
    ] if isinstance(source_packet_quality.get("uncoveredConceptCandidates"), list) else []

    minimum_modules = max(1, min(20, desired_module_count))
    minimum_sections = max(1, min(6, sections_per_module))
    reasons: list[str] = []
    warnings: list[str] = []
    module_profiles: list[dict[str, Any]] = []
    module_titles: list[str] = []
    section_titles: list[str] = []
    section_count = 0
    titled_module_count = 0
    titled_section_count = 0
    objective_module_count = 0
    concept_module_count = 0
    objective_section_count = 0
    concept_section_count = 0
    source_mapped_module_count = 0
    source_mapped_section_count = 0
    materialized_content_count = 0
    assigned_coverage_ids: list[str] = []

    if source_packet_present:
        if source_packet_contract != "source-packet-v1":
            reasons.append("source_packet_contract_missing")
        if not source_documents:
            reasons.append("source_documents_missing")
        if source_packet_quality and source_quality_status != "usable":
            reasons.append("source_packet_not_usable")
        if source_packet_quality and concept_coverage_ratio < 0.7:
            reasons.append("source_packet_concept_coverage_below_policy")
        if uncovered_concepts:
            reasons.append("uncovered_concepts_remaining")

    if source_packet_present and outline_row.get("contractVersion") != SOURCE_PACKET_OUTLINE_CONTRACT_VERSION:
        reasons.append("outline_contract_mismatch")
    if not modules:
        reasons.append("module_count_below_policy")
    elif len(modules) < minimum_modules:
        warnings.append("module_count_below_requested_count")

    for module_index, module in enumerate(modules, start=1):
        module_reasons: list[str] = []
        title = str(module.get("title") or "").strip()
        module_titles.append(title)
        if title:
            titled_module_count += 1
        else:
            module_reasons.append("module_title_missing")
        module_sources = _outline_source_ids(module)
        if module_sources:
            source_mapped_module_count += 1
        elif source_inventory:
            module_reasons.append("module_source_ids_missing")
        module_objectives = _outline_objectives(module)
        if module_objectives:
            objective_module_count += 1
        else:
            module_reasons.append("module_objectives_missing")
        module_concepts = _outline_concepts(module)
        if module_concepts:
            concept_module_count += 1
        else:
            module_reasons.append("module_concepts_missing")
        module_coverage_ids = [
            str(item_id).strip()
            for item_id in module.get("assignedCoverageItemIds", [])
            if str(item_id).strip()
        ] if isinstance(module.get("assignedCoverageItemIds"), list) else []
        assigned_coverage_ids.extend(module_coverage_ids)
        sections = _section_outlines(module)
        section_count += len(sections)
        if _has_materialized_outline_content(module):
            materialized_content_count += 1
            module_reasons.append("materialized_content_payload_present")

        section_profiles: list[dict[str, Any]] = []
        for section_index, section in enumerate(sections, start=1):
            section_reasons: list[str] = []
            section_title = str(section.get("title") or "").strip()
            section_titles.append(section_title)
            if section_title:
                titled_section_count += 1
            else:
                section_reasons.append("section_title_missing")
            if _outline_objectives(section):
                objective_section_count += 1
            else:
                section_reasons.append("section_objectives_missing")
            if _outline_concepts(section):
                concept_section_count += 1
            else:
                section_reasons.append("section_concepts_missing")
            if _outline_source_ids(section):
                source_mapped_section_count += 1
            elif source_inventory:
                section_reasons.append("section_source_ids_missing")
            if _has_materialized_outline_content(section):
                materialized_content_count += 1
                section_reasons.append("materialized_content_payload_present")
            section_profiles.append(
                {
                    "sectionIndex": section_index,
                    "title": section_title,
                    "status": "passed" if not section_reasons else "failed",
                    "reasons": sorted(set(section_reasons)),
                    "learningObjectiveCount": len(_outline_objectives(section)),
                    "conceptCount": len(_outline_concepts(section)),
                    "sourceIdCount": len(_outline_source_ids(section)),
                }
            )
            reasons.extend(f"module_{module_index}_section_{section_index}_{reason}" for reason in section_reasons)

        duplicate_section_count = _dedupe_count([profile["title"] for profile in section_profiles])
        if duplicate_section_count:
            module_reasons.append("duplicate_section_titles")
        module_profiles.append(
            {
                "moduleIndex": module_index,
                "title": title,
                "status": "passed" if not module_reasons and all(profile["status"] == "passed" for profile in section_profiles) else "failed",
                "reasons": sorted(set(module_reasons)),
                "sectionCount": len(sections),
                "targetSectionCount": int(module.get("targetSectionCount") or minimum_sections),
                "learningObjectiveCount": len(module_objectives),
                "conceptCount": len(module_concepts),
                "sourceIdCount": len(module_sources),
                "assignedCoverageItemIds": module_coverage_ids,
                "duplicateSectionTitleCount": duplicate_section_count,
                "sections": section_profiles,
            }
        )
        reasons.extend(f"module_{module_index}_{reason}" for reason in module_reasons)

    duplicate_module_title_count = _dedupe_count(module_titles)
    duplicate_section_title_count = _dedupe_count(section_titles)
    if duplicate_module_title_count:
        reasons.append("duplicate_module_titles")
    if duplicate_section_title_count:
        reasons.append("duplicate_section_titles")
    assigned_coverage_id_set = set(assigned_coverage_ids)
    unassigned_coverage_ids = sorted(required_coverage_ids - assigned_coverage_id_set)
    duplicate_coverage_assignment_count = sum(
        1
        for item_id in required_coverage_ids
        if assigned_coverage_ids.count(item_id) > 1
    )
    if unassigned_coverage_ids:
        reasons.append("coverage_items_unassigned_to_modules")
    if duplicate_coverage_assignment_count:
        warnings.append("duplicate_coverage_item_module_assignments")

    reasons = sorted(set(reasons))
    warnings = sorted(set(warnings))
    return {
        "contractVersion": COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT,
        "status": "failed" if reasons else "needs_review" if warnings else "passed",
        "passed": not reasons,
        "reasons": reasons,
        "warnings": warnings,
        "metrics": {
            "moduleCount": len(modules),
            "sectionCount": section_count,
            "minimumModuleCount": minimum_modules,
            "minimumSectionsPerModule": minimum_sections,
            "titledModuleCount": titled_module_count,
            "objectiveModuleCount": objective_module_count,
            "conceptModuleCount": concept_module_count,
            "titledSectionCount": titled_section_count,
            "objectiveSectionCount": objective_section_count,
            "conceptSectionCount": concept_section_count,
            "sourceMappedModuleCount": source_mapped_module_count,
            "sourceMappedSectionCount": source_mapped_section_count,
            "duplicateModuleTitleCount": duplicate_module_title_count,
            "duplicateSectionTitleCount": duplicate_section_title_count,
            "materializedContentPayloadCount": materialized_content_count,
            "sourcePacketContractVersion": source_packet_contract,
            "sourcePacketQualityStatus": source_packet_quality.get("status"),
            "sourcePacketConceptCoverageRatio": concept_coverage_ratio,
            "uncoveredConceptCount": len(uncovered_concepts),
            "sourceDocumentCount": len(source_documents),
            "requiredCoverageItemCount": len(required_coverage_ids),
            "moduleAssignedCoverageItemCount": len(assigned_coverage_id_set & required_coverage_ids),
            "unassignedCoverageItemCount": len(unassigned_coverage_ids),
            "duplicateCoverageAssignmentCount": duplicate_coverage_assignment_count,
        },
        "coverageAllocation": {
            "requiredCoverageItemIds": sorted(required_coverage_ids),
            "assignedCoverageItemIds": sorted(assigned_coverage_id_set & required_coverage_ids),
            "unassignedCoverageItemIds": unassigned_coverage_ids,
        },
        "moduleProfiles": module_profiles,
        "policy": {
            "materializesLearnerContent": False,
            "requiresSourcePacketWhenProvided": True,
            "createsSectionPlans": False,
            "sectionPlansCreatedBy": "module-section-plan-workflow-v1",
            "requiresModuleObjectives": True,
            "requiresModuleConcepts": True,
            "requiresSourceMappingWhenSourcePacketProvided": True,
            "requiresCoverageAssignmentWhenChecklistProvided": True,
        },
    }


def _document_body_text(document: dict[str, Any]) -> str:
    return _text(document.get("text") or document.get("rawText") or document.get("content") or document.get("extracted_text"))


def _title(value: str) -> str:
    clean = re.sub(r"[_\\/-]+", " ", value).strip()
    clean = re.sub(r"\s+", " ", clean)
    return clean.title() if clean else "Course Topic"


def _candidate_terms(prompt: str, source_packet: dict[str, Any] | None, limit: int) -> list[str]:
    counter: Counter[str] = Counter(_tokens(prompt))
    for document in _source_documents(source_packet):
        document_tokens = _tokens(_document_text(document))
        counter.update(document_tokens[:350])
    terms = [term for term, _count in counter.most_common(max(limit * 3, limit))]
    deduped: list[str] = []
    for term in terms:
        if any(term in existing or existing in term for existing in deduped):
            continue
        deduped.append(term)
        if len(deduped) >= limit:
            break
    return deduped or ["foundations", "methods", "application", "review"][:limit]


def _candidate_concepts(prompt: str, source_packet: dict[str, Any] | None, limit: int) -> list[str]:
    counter: Counter[str] = Counter()
    for document in _source_documents(source_packet):
        for phrase in _concept_phrase_candidates(_document_body_text(document), limit * 3):
            counter[phrase] += 3
    for phrase in _concept_phrase_candidates(prompt, limit):
        counter[phrase] += 1

    concepts: list[str] = []
    for concept, _count in counter.most_common(max(limit * 3, limit)):
        if any(concept in existing or existing in concept for existing in concepts):
            continue
        concepts.append(concept)
        if len(concepts) >= limit:
            break
    return concepts or _candidate_terms(prompt, source_packet, limit)


def _chunk_concepts(concepts: list[str], module_count: int) -> list[list[str]]:
    if not concepts:
        return []
    chunks: list[list[str]] = [[] for _ in range(max(1, module_count))]
    for index, concept in enumerate(concepts):
        chunks[index % len(chunks)].append(concept)
    return chunks


def _coverage_items(coverage_checklist: dict[str, Any] | None) -> list[dict[str, Any]]:
    checklist = coverage_checklist if isinstance(coverage_checklist, dict) else {}
    return [item for item in checklist.get("requiredItems", []) if isinstance(item, dict)]


def _coverage_item_id(item: dict[str, Any], index: int) -> str:
    clean = str(item.get("id") or "").strip()
    return clean or f"coverage-item-{index}"


def _coverage_item_title(item: dict[str, Any], index: int) -> str:
    return str(item.get("title") or item.get("name") or f"Coverage Item {index}").strip()


def _unique_strings(values: list[Any], *, limit: int | None = None) -> list[str]:
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


def _coverage_must_teach(items: list[dict[str, Any]]) -> list[str]:
    values: list[Any] = []
    for index, item in enumerate(items, start=1):
        values.append(_coverage_item_title(item, index))
        if isinstance(item.get("mustTeach"), list):
            values.extend(item["mustTeach"])
    return _unique_strings(values, limit=16)


def _coverage_buckets(items: list[dict[str, Any]], module_count: int) -> list[list[dict[str, Any]]]:
    if not items:
        return []
    bucket_count = max(1, min(module_count, len(items)))
    buckets: list[list[dict[str, Any]]] = []
    for index in range(bucket_count):
        start = index * len(items) // bucket_count
        end = (index + 1) * len(items) // bucket_count
        buckets.append(items[start:end] or [items[min(index, len(items) - 1)]])
    return buckets


def _coverage_module_focus(bucket: list[dict[str, Any]], module_index: int) -> str:
    titles = [_coverage_item_title(item, index) for index, item in enumerate(bucket, start=1)]
    if not titles:
        return f"Module {module_index}"
    if len(titles) == 1:
        return titles[0]
    return f"{titles[0]} through {titles[-1]}"


def _coverage_section_outlines(
    *,
    bucket: list[dict[str, Any]],
    module_index: int,
    module_source_ids: list[str],
    source_inventory: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    for item_index, item in enumerate(bucket, start=1):
        item_id = _coverage_item_id(item, item_index)
        item_title = _coverage_item_title(item, item_index)
        section_plans = _items(item.get("sectionPlans"))
        for section_index, section_plan in enumerate(section_plans or [{}], start=1):
            title = str(section_plan.get("title") or f"{item_title} foundations").strip()
            must_teach = _unique_strings(
                [
                    *(section_plan.get("mustTeach") if isinstance(section_plan.get("mustTeach"), list) else []),
                    *(item.get("mustTeach") if isinstance(item.get("mustTeach"), list) else []),
                    item_title,
                ],
                limit=8,
            )
            primary_term = " ".join(must_teach) or item_title
            sections.append(
                {
                    "id": f"course-template-m{module_index:02d}-i{item_index:02d}-s{section_index:02d}",
                    "title": title,
                    "learning_objectives": [
                        str(section_plan.get("learningObjective") or f"Explain {title.lower()} as part of {item_title.lower()}.")
                    ],
                    "concept_keywords": must_teach,
                    "assignedCoverageItemIds": [item_id],
                    "coverageItemId": item_id,
                    "coverageMustTeach": must_teach,
                    "sourceIds": _source_ids_for_term(primary_term, source_inventory) or module_source_ids,
                    "estimated_minutes": 25,
                    "planningSource": "course_template_coverage",
                }
            )
    return sections


def build_outline_from_source_packet(
    *,
    prompt: str,
    source_packet: dict[str, Any] | None,
    desired_module_count: int = 4,
    sections_per_module: int = 2,
    include_section_outlines: bool = True,
    coverage_checklist: dict[str, Any] | None = None,
) -> dict[str, Any]:
    module_count = max(1, min(20, desired_module_count))
    section_count = max(2, min(6, sections_per_module))
    resolved_title = _title_from_prompt_or_source(prompt, source_packet)
    coverage_items = _coverage_items(coverage_checklist)
    coverage_buckets = _coverage_buckets(coverage_items, module_count)
    terms = [_coverage_module_focus(bucket, index) for index, bucket in enumerate(coverage_buckets, start=1)] or _candidate_terms(prompt, source_packet, module_count)
    concept_candidates = _candidate_concepts(prompt, source_packet, max(module_count * section_count * 2, module_count))
    concept_chunks = _chunk_concepts(concept_candidates, module_count)
    source_inventory = _source_inventory(source_packet)
    modules: list[dict[str, Any]] = []

    for module_index, term in enumerate(terms, start=1):
        coverage_bucket = coverage_buckets[module_index - 1] if module_index - 1 < len(coverage_buckets) else []
        coverage_must_teach = _coverage_must_teach(coverage_bucket)
        assigned_coverage_ids = [_coverage_item_id(item, index) for index, item in enumerate(coverage_bucket, start=1)]
        fallback_concepts = concept_chunks[module_index - 1] if module_index - 1 < len(concept_chunks) else [term]
        module_concepts = coverage_must_teach or fallback_concepts
        module_focus = module_concepts[0] if module_concepts else term
        module_title = f"Module {module_index}: {_title(module_focus)}"
        module_source_ids = _source_ids_for_term(" ".join(module_concepts), source_inventory)
        if coverage_bucket:
            sections = _coverage_section_outlines(
                bucket=coverage_bucket,
                module_index=module_index,
                module_source_ids=module_source_ids,
                source_inventory=source_inventory,
            )
        else:
            sections = []
            for section_index in range(1, section_count + 1):
                focus = "Foundations" if section_index == 1 else "Applied Practice" if section_index == 2 else f"Extension {section_index}"
                concept_index = (section_index - 1) % max(1, len(module_concepts))
                primary_concept = module_concepts[concept_index] if module_concepts else term
                nearby_concepts = module_concepts[concept_index : concept_index + 2] or [primary_concept]
                section_title = f"{_title(primary_concept)} {focus}"
                section_concepts = list(dict.fromkeys(nearby_concepts))
                section_source_ids = _source_ids_for_term(primary_concept, source_inventory) or module_source_ids
                sections.append(
                    {
                        "id": f"source-packet-m{module_index:02d}-s{section_index:02d}",
                        "title": section_title,
                        "learning_objectives": [
                            f"Explain {_title(primary_concept).lower()} using the accepted source packet evidence.",
                            f"Identify source-backed concepts that belong in {section_title.lower()}.",
                        ],
                        "concept_keywords": section_concepts,
                        "sourceIds": section_source_ids,
                        "estimated_minutes": 25,
                        "planningSource": "source_packet",
                    }
                )
        module: dict[str, Any] = {
            "id": f"source-packet-m{module_index:02d}",
            "title": module_title,
            "learning_objectives": [
                f"Use source packet evidence to organize {_title(module_focus).lower()} into teachable lessons."
            ],
            "targetSectionCount": section_count,
            "sectionPlanPolicy": {
                "contractVersion": "module-section-plan-policy-v1",
                "defaultSectionCount": section_count,
                "nextWorkflow": "module-section-plan-workflow-v1",
            },
            "concept_keywords": module_concepts,
            "sourceIds": module_source_ids,
            "planningSource": "course_template_coverage" if coverage_bucket else "source_packet",
        }
        if assigned_coverage_ids:
            module["assignedCoverageItemIds"] = assigned_coverage_ids
            module["coverageMustTeach"] = coverage_must_teach
            module["coverageAllocationStatus"] = "assigned"
        if include_section_outlines:
            module["sections"] = sections
        modules.append(module)

    outline = {
        "contractVersion": SOURCE_PACKET_OUTLINE_CONTRACT_VERSION,
        "title": resolved_title,
        "shortDescription": f"Draft outline derived from source packet evidence for {resolved_title}.",
        "summary": "This is a planning outline derived from accepted source-packet evidence, not final learner-facing content.",
        "modules": modules,
        "provenance": {
            "mode": "source_packet",
            "sourceDocumentCount": len(_source_documents(source_packet)),
            "sourcePacketContract": source_packet.get("contract_version") if isinstance(source_packet, dict) else None,
            "conceptCandidateCount": len(concept_candidates),
            "conceptCandidates": concept_candidates[:40],
            "coverageChecklistContract": coverage_checklist.get("contractVersion") if isinstance(coverage_checklist, dict) else None,
            "coverageRequiredItemCount": len(coverage_items),
            "sourceIdMap": [
                {
                    "courseSourceId": source["sourceId"],
                    "sourceRef": source["sourceRef"],
                    "snapshotRef": source["snapshotRef"],
                    "url": source["url"],
                }
                for source in source_inventory
            ],
        },
    }
    if isinstance(coverage_checklist, dict):
        outline["courseCoverageChecklist"] = coverage_checklist
    return outline
