from __future__ import annotations

import re
from collections import Counter
from urllib.parse import urlparse
from typing import Any

from app.curriculum_benchmark_extraction import extract_curriculum_benchmarks_from_sources


STOPWORDS = {
    "about",
    "after",
    "also",
    "and",
    "based",
    "before",
    "build",
    "course",
    "from",
    "into",
    "learn",
    "learning",
    "online",
    "resources",
    "that",
    "the",
    "this",
    "with",
}

SOURCE_TYPE_WEIGHTS = {
    "syllabus": 1.0,
    "university_catalog": 0.94,
    "certification_exam": 0.9,
    "employer_profile": 0.84,
    "expert_reference": 0.68,
}


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "item"


def _title(value: str) -> str:
    words = [word for word in re.split(r"[-_\s]+", value.strip()) if word]
    return " ".join(word.capitalize() for word in words) or "Curriculum Requirement"


def _keywords(prompt: str, source_urls: list[str] | None, limit: int = 8) -> list[str]:
    text = " ".join([prompt, *[urlparse(url).path for url in source_urls or []]])
    candidates = [
        word.lower()
        for word in re.findall(r"[A-Za-z][A-Za-z0-9+.#-]{2,}", text)
        if word.lower() not in STOPWORDS and len(word) > 3
    ]
    seen: set[str] = set()
    ordered: list[str] = []
    for word in candidates:
        normalized = word.strip("-").replace("fundamentals", "foundations")
        if normalized and normalized not in seen:
            seen.add(normalized)
            ordered.append(normalized)
        if len(ordered) >= limit:
            break
    return ordered or ["foundations", "practice", "assessment", "capstone"]


def _source_type(url: str) -> str:
    lowered = url.lower()
    if "syllabus" in lowered:
        return "syllabus"
    if any(token in lowered for token in ("catalog", "course", "university", ".edu")):
        return "university_catalog"
    if any(token in lowered for token in ("cert", "exam")):
        return "certification_exam"
    if any(token in lowered for token in ("job", "career", "employer", "hiring")):
        return "employer_profile"
    return "expert_reference"


def _institution(url: str) -> str:
    hostname = urlparse(url).hostname or "submitted source"
    return hostname.replace("www.", "")


def _requirement(keyword: str, *, benchmark_id: str, evidence_ref: str, index: int) -> dict[str, Any]:
    importance = "required" if index <= 4 else "recommended"
    return {
        "id": f"req-{_slug(keyword)}",
        "title": _title(keyword),
        "description": f"Learners must demonstrate working understanding of {_title(keyword)}.",
        "importance": importance,
        "topics": [keyword],
        "origin": {
            "originType": "common_academic_requirement",
            "evidenceRefs": [evidence_ref],
            "benchmarkIds": [benchmark_id],
            "frequency": 1,
        },
    }


def _clamped_score(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 2)


def _benchmark_source_weight(benchmark: dict[str, Any]) -> float:
    return SOURCE_TYPE_WEIGHTS.get(str(benchmark.get("sourceType") or "").strip(), 0.62)


def _benchmark_confidence(benchmark: dict[str, Any]) -> float:
    value = benchmark.get("confidence")
    return float(value) if isinstance(value, int | float) else 0.5


def _benchmark_review_weight(benchmark: dict[str, Any]) -> float:
    return 1.0 if benchmark.get("reviewedBy") else 0.58


def _review_status(review_weight: float, benchmark_count: int) -> str:
    if benchmark_count <= 0:
        return "unreviewed"
    if review_weight >= 0.95:
        return "reviewed"
    if review_weight > 0.58:
        return "mixed"
    return "unreviewed"


def _requirement_origin_score(
    *,
    frequency: float,
    source_confidence: float,
    source_type_weight: float,
    review_weight: float,
) -> float:
    return _clamped_score(
        frequency * 0.42
        + source_confidence * 0.26
        + source_type_weight * 0.22
        + review_weight * 0.1
    )


def _benchmark_from_url(
    *,
    prompt: str,
    url: str,
    index: int,
    category: str | None,
    department: str | None,
    keywords: list[str],
) -> dict[str, Any]:
    benchmark_id = f"benchmark-input-source-{index}"
    local_keywords = keywords[: min(5, max(3, len(keywords)))]
    return {
        "id": benchmark_id,
        "sourceType": _source_type(url),
        "title": f"Submitted curriculum benchmark {index}",
        "institution": _institution(url),
        "programName": category or None,
        "department": department or None,
        "url": url,
        "sourceRefs": [f"input-source-{index}"],
        "topics": local_keywords,
        "learningOutcomes": [
            f"Explain and apply {_title(keyword)} in the context of {prompt}."
            for keyword in local_keywords[:4]
        ],
        "extractedRequirements": [
            _requirement(keyword, benchmark_id=benchmark_id, evidence_ref=f"input-source-{index}", index=req_index)
            for req_index, keyword in enumerate(local_keywords, start=1)
        ],
        "confidence": 0.72 if _source_type(url) in {"university_catalog", "syllabus"} else 0.58,
    }


def _synthetic_benchmark(prompt: str, category: str | None, department: str | None, keywords: list[str]) -> dict[str, Any]:
    benchmark_id = "benchmark-generated-intake"
    return {
        "id": benchmark_id,
        "sourceType": "expert_reference",
        "title": "Generated intake benchmark",
        "institution": "Lycium generated intake",
        "programName": category or None,
        "department": department or None,
        "topics": keywords,
        "learningOutcomes": [
            f"Use {_title(keyword)} to satisfy the requested learning outcome."
            for keyword in keywords[:4]
        ],
        "extractedRequirements": [
            {
                **_requirement(keyword, benchmark_id=benchmark_id, evidence_ref=benchmark_id, index=index),
                "importance": "recommended" if index > 3 else "required",
                "origin": {
                    "originType": "generated_gap_fill",
                    "evidenceRefs": [benchmark_id],
                    "benchmarkIds": [benchmark_id],
                    "frequency": 1,
                },
            }
            for index, keyword in enumerate(keywords[:5], start=1)
        ],
        "confidence": 0.46,
    }


def _aggregate_requirement_origins(benchmarks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    total = max(len(benchmarks), 1)
    grouped: dict[str, dict[str, Any]] = {}
    counts: Counter[str] = Counter()
    score_inputs: dict[str, dict[str, float]] = {}

    for benchmark in benchmarks:
        benchmark_id = str(benchmark.get("id") or "")
        source_confidence = _benchmark_confidence(benchmark)
        source_type_weight = _benchmark_source_weight(benchmark)
        review_weight = _benchmark_review_weight(benchmark)
        for requirement in benchmark.get("extractedRequirements", []):
            if not isinstance(requirement, dict):
                continue
            key = _slug(str(requirement.get("title") or requirement.get("id") or "requirement"))
            counts[key] += 1
            metrics = score_inputs.setdefault(
                key,
                {"sourceConfidence": 0.0, "sourceTypeWeight": 0.0, "reviewWeight": 0.0},
            )
            metrics["sourceConfidence"] += source_confidence
            metrics["sourceTypeWeight"] += source_type_weight
            metrics["reviewWeight"] += review_weight
            row = grouped.setdefault(
                key,
                {
                    "requirementId": str(requirement.get("id") or f"req-{key}"),
                    "title": str(requirement.get("title") or _title(key)),
                    "importance": "optional",
                    "originType": "generated_gap_fill",
                    "evidenceRefs": [],
                    "benchmarkIds": [],
                    "frequency": 0,
                },
            )
            for evidence_ref in requirement.get("origin", {}).get("evidenceRefs", []):
                if evidence_ref not in row["evidenceRefs"]:
                    row["evidenceRefs"].append(evidence_ref)
            if benchmark_id and benchmark_id not in row["benchmarkIds"]:
                row["benchmarkIds"].append(benchmark_id)

    origins: list[dict[str, Any]] = []
    for key, row in grouped.items():
        frequency = round(counts[key] / total, 2)
        matched_count = max(counts[key], 1)
        metrics = score_inputs.get(key, {})
        source_confidence = _clamped_score(float(metrics.get("sourceConfidence", 0.5)) / matched_count)
        source_type_weight = _clamped_score(float(metrics.get("sourceTypeWeight", 0.62)) / matched_count)
        review_weight = _clamped_score(float(metrics.get("reviewWeight", 0.58)) / matched_count)
        row["frequency"] = frequency
        row["sourceConfidence"] = source_confidence
        row["sourceTypeWeight"] = source_type_weight
        row["reviewStatus"] = _review_status(review_weight, matched_count)
        row["score"] = _requirement_origin_score(
            frequency=frequency,
            source_confidence=source_confidence,
            source_type_weight=source_type_weight,
            review_weight=review_weight,
        )
        if frequency >= 0.67:
            row["importance"] = "required"
            row["originType"] = "common_academic_requirement"
        elif frequency >= 0.34:
            row["importance"] = "recommended"
            row["originType"] = "expert_review"
        origins.append(row)
    return origins


def _source_corpus_requirement_origins(source_corpus_synthesis: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(source_corpus_synthesis, dict):
        return []

    included_sources = source_corpus_synthesis.get("includedSources")
    common_themes = source_corpus_synthesis.get("commonThemes")
    metrics = source_corpus_synthesis.get("metrics") if isinstance(source_corpus_synthesis.get("metrics"), dict) else {}
    included_count = int(metrics.get("includedSourceCount") or 0)
    if not isinstance(included_sources, list) or not isinstance(common_themes, list) or included_count == 0:
        return []

    origins: list[dict[str, Any]] = []
    for theme in common_themes[:12]:
        if not isinstance(theme, dict):
            continue
        term = str(theme.get("term") or "").strip()
        source_count = int(theme.get("sourceCount") or 0)
        if not term or source_count < 2:
            continue
        matched_source_ids = [
            str(source.get("sourceId"))
            for source in included_sources
            if isinstance(source, dict)
            and source.get("sourceId")
            and term in [str(match) for match in source.get("matchedTerms", [])]
        ]
        frequency = round(source_count / included_count, 2)
        origins.append(
            {
                "requirementId": f"req-corpus-theme-{_slug(term)}",
                "title": _title(term),
                "importance": "required" if frequency >= 0.34 else "recommended",
                "originType": "common_academic_requirement" if frequency >= 0.34 else "expert_review",
                "evidenceRefs": matched_source_ids[:8],
                "benchmarkIds": ["source-corpus-preflight"],
                "frequency": frequency,
                "score": _requirement_origin_score(
                    frequency=frequency,
                    source_confidence=0.72,
                    source_type_weight=0.62,
                    review_weight=0.58,
                ),
                "sourceConfidence": 0.72,
                "sourceTypeWeight": 0.62,
                "reviewStatus": "unreviewed",
            }
        )
    return origins


def _evidence_refs(row: dict[str, Any]) -> list[str]:
    refs = row.get("evidenceRefs")
    return [str(ref) for ref in refs if isinstance(ref, str) and ref.strip()] if isinstance(refs, list) else []


def _origin_confidence(row: dict[str, Any]) -> float:
    for key in ("score", "sourceConfidence", "frequency"):
        value = row.get(key)
        if isinstance(value, int | float):
            return _clamped_score(float(value))
    return 0.0


def _coverage_status(primary_source_id: str | None, confidence: float, section_ids: list[str] | None = None) -> str:
    if not primary_source_id:
        return "missing"
    if confidence < 0.55:
        return "weak"
    if section_ids is not None and not section_ids:
        return "weak"
    return "covered"


def _concept_coverage_row(row: dict[str, Any]) -> dict[str, Any]:
    refs = _evidence_refs(row)
    primary = refs[0] if refs else None
    confidence = _origin_confidence(row)
    concept_id = str(row.get("requirementId") or row.get("id") or f"req-{_slug(str(row.get('title') or 'concept'))}")
    return {
        "conceptId": concept_id,
        "requirementOriginId": concept_id,
        "title": str(row.get("title") or _title(concept_id)),
        "importance": str(row.get("importance") or "recommended"),
        "primarySourceId": primary,
        "fallbackSourceIds": refs[1:],
        "evidenceRefs": refs,
        "confidence": confidence,
        "status": _coverage_status(primary, confidence),
        "sectionIds": [],
    }


def _concept_source_coverage_map(requirement_origins: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        _concept_coverage_row(row)
        for row in requirement_origins
        if str(row.get("importance") or "") == "required"
    ]


def _source_ids_from_value(value: Any) -> set[str]:
    if not isinstance(value, dict):
        return set()
    source_ids = value.get("sourceIds")
    return {str(source_id) for source_id in source_ids if isinstance(source_id, str) and source_id.strip()} if isinstance(source_ids, list) else set()


def _section_signal(section: dict[str, Any]) -> tuple[set[str], set[str]]:
    sources = _source_ids_from_value(section)
    text_parts = [section.get("id"), section.get("title")]
    content = section.get("content")
    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            sources.update(_source_ids_from_value(block))
            text_parts.extend([block.get("title"), block.get("heading"), block.get("value"), block.get("question")])
            concepts = block.get("concepts")
            if isinstance(concepts, list):
                for concept in concepts:
                    if isinstance(concept, dict):
                        text_parts.extend([concept.get("name"), concept.get("title"), concept.get("description")])
            questions = block.get("questions") or block.get("questionBank") or block.get("question_bank")
            if isinstance(questions, list):
                for question in questions:
                    if isinstance(question, dict):
                        text_parts.extend([question.get("question"), question.get("concept"), question.get("topic")])
    return sources, set(_keywords(" ".join(str(part) for part in text_parts if part), None, limit=24))


def _section_ids_for_concept(course: dict[str, Any], coverage: dict[str, Any]) -> list[str]:
    concept_tokens = _keywords(
        " ".join(str(value) for value in (coverage.get("title"), coverage.get("conceptId")) if value),
        None,
        limit=12,
    )
    evidence_sources = {
        str(source_id)
        for source_id in [coverage.get("primarySourceId"), *(coverage.get("fallbackSourceIds") or [])]
        if isinstance(source_id, str) and source_id.strip()
    }
    matched: list[str] = []
    course_modules = course.get("modules")
    if not isinstance(course_modules, list):
        return matched
    for module in course_modules:
        if not isinstance(module, dict):
            continue
        for section in module.get("sections", []):
            if not isinstance(section, dict):
                continue
            section_id = str(section.get("id") or "").strip()
            if not section_id:
                continue
            section_sources, section_tokens = _section_signal(section)
            source_match = bool(evidence_sources & section_sources)
            token_match = bool(set(concept_tokens) & section_tokens)
            if source_match or token_match:
                matched.append(section_id)
    return list(dict.fromkeys(matched))


def _coverage_map_with_section_mapping(course: dict[str, Any], coverage_map: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []
    for row in coverage_map:
        if not isinstance(row, dict):
            continue
        section_ids = _section_ids_for_concept(course, row)
        primary = row.get("primarySourceId") if isinstance(row.get("primarySourceId"), str) else None
        confidence = _origin_confidence(row)
        mapped.append(
            {
                **row,
                "sectionIds": section_ids,
                "status": _coverage_status(primary, confidence, section_ids),
            }
        )
    return mapped


def _source_slots_with_coverage(source_slots: list[dict[str, Any]], coverage_map: list[dict[str, Any]]) -> list[dict[str, Any]]:
    coverage_by_id = {str(row.get("conceptId") or row.get("requirementOriginId") or ""): row for row in coverage_map if isinstance(row, dict)}
    enriched: list[dict[str, Any]] = []
    for slot in source_slots:
        concept_id = str(slot.get("requiredConceptId") or "")
        coverage = coverage_by_id.get(concept_id, {})
        enriched.append(
            {
                **slot,
                "title": slot.get("title") or coverage.get("title"),
                "evidenceRefs": coverage.get("evidenceRefs", slot.get("evidenceRefs", [])),
                "confidence": coverage.get("confidence", slot.get("confidence", 0)),
                "coverageStatus": coverage.get("status", slot.get("coverageStatus", "missing")),
                "sectionIds": coverage.get("sectionIds", slot.get("sectionIds", [])),
            }
        )
    return enriched


def compile_curriculum_benchmark_context(
    *,
    prompt: str,
    source_urls: list[str] | None,
    category: str | None = None,
    department: str | None = None,
    fetch_sources: bool = False,
    source_documents: list[dict[str, Any]] | None = None,
    source_corpus_synthesis: dict[str, Any] | None = None,
) -> dict[str, Any]:
    keywords = _keywords(prompt, source_urls)
    benchmarks = extract_curriculum_benchmarks_from_sources(
        prompt=prompt,
        source_urls=source_urls,
        category=category,
        department=department,
        fetch_sources=fetch_sources,
        source_documents=source_documents,
    )
    if not benchmarks:
        benchmarks = [
            _benchmark_from_url(
                prompt=prompt,
                url=url,
                index=index,
                category=category,
                department=department,
                keywords=keywords,
            )
            for index, url in enumerate(source_urls or [], start=1)
        ]
    if not benchmarks:
        benchmarks.append(_synthetic_benchmark(prompt, category, department, keywords))

    requirement_origins = _aggregate_requirement_origins(benchmarks)
    existing_titles = {_slug(str(origin.get("title") or "")) for origin in requirement_origins}
    for origin in _source_corpus_requirement_origins(source_corpus_synthesis):
        if _slug(str(origin.get("title") or "")) not in existing_titles:
            requirement_origins.append(origin)
            existing_titles.add(_slug(str(origin.get("title") or "")))
    required_topics = [row["title"] for row in requirement_origins if row["importance"] == "required"]
    optional_topics = [row["title"] for row in requirement_origins if row["importance"] != "required"]
    evidence_refs = [ref for row in requirement_origins for ref in row["evidenceRefs"]]
    primary_source = evidence_refs[0] if evidence_refs else "benchmark-generated-intake"
    source_slots = [
        {
            "requiredConceptId": row["requirementId"],
            "title": row["title"],
            "primarySourceId": row["evidenceRefs"][0] if row["evidenceRefs"] else primary_source,
            "fallbackSourceIds": row["evidenceRefs"][1:] if len(row["evidenceRefs"]) > 1 else [],
            "replacementPolicy": "review_required",
            "evidenceRefs": row["evidenceRefs"],
            "confidence": row.get("score", row.get("sourceConfidence", row.get("frequency", 0))),
            "coverageStatus": _coverage_status(
                row["evidenceRefs"][0] if row["evidenceRefs"] else primary_source,
                _origin_confidence(row),
            ),
            "sectionIds": [],
        }
        for row in requirement_origins
        if row["importance"] == "required"
    ]
    concept_source_coverage_map = _concept_source_coverage_map(requirement_origins)

    context = {
        "workflowGates": ["benchmark_intake", "requirement_extraction", "commonality_analysis"],
        "curriculumBenchmarks": benchmarks,
        "requirementOrigins": requirement_origins,
        "courseParityProfile": {
            "id": f"parity-{_slug(prompt)[:48]}",
            "benchmarkInstitutions": [
                {
                    "institution": str(benchmark.get("institution") or "Unknown"),
                    "title": str(benchmark.get("title") or "Curriculum benchmark"),
                    "department": benchmark.get("department"),
                    "url": benchmark.get("url"),
                    "sourceIds": benchmark.get("sourceRefs") or [],
                }
                for benchmark in benchmarks
            ],
            "commonRequiredTopics": required_topics,
            "optionalTopics": optional_topics,
            "coveragePercent": 100 if required_topics else 0,
            "parityStatus": "strong" if len(benchmarks) >= 3 else "partial" if source_urls else "weak",
        },
        "sourceSlots": source_slots,
        "conceptSourceCoverageMap": concept_source_coverage_map,
    }
    if source_corpus_synthesis:
        context["sourceCorpusSynthesis"] = source_corpus_synthesis
        context["workflowGates"] = list(dict.fromkeys(["source_corpus_preflight", *context["workflowGates"]]))
    return context


def attach_curriculum_context(course: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if not context:
        return course
    metadata = dict(course.get("metadata") if isinstance(course.get("metadata"), dict) else {})
    metadata["curriculumBenchmarks"] = context.get("curriculumBenchmarks", [])
    metadata["requirementOrigins"] = context.get("requirementOrigins", [])
    metadata["courseParityProfile"] = context.get("courseParityProfile", {})
    concept_source_coverage_map = _coverage_map_with_section_mapping(
        course,
        [row for row in context.get("conceptSourceCoverageMap", []) if isinstance(row, dict)]
        if isinstance(context.get("conceptSourceCoverageMap"), list)
        else [],
    )
    metadata["conceptSourceCoverageMap"] = concept_source_coverage_map
    metadata["sourceSlots"] = _source_slots_with_coverage(
        [row for row in context.get("sourceSlots", []) if isinstance(row, dict)]
        if isinstance(context.get("sourceSlots"), list)
        else [],
        concept_source_coverage_map,
    )
    if context.get("sourceCorpusSynthesis"):
        metadata["sourceCorpusSynthesis"] = context["sourceCorpusSynthesis"]
    generation_plan = dict(metadata.get("generationPlan") if isinstance(metadata.get("generationPlan"), dict) else {})
    status = generation_plan.get("status") if isinstance(generation_plan.get("status"), list) else []
    generation_plan["status"] = list(dict.fromkeys([*status, *context.get("workflowGates", [])]))
    metadata["generationPlan"] = generation_plan
    return {**course, "metadata": metadata}
