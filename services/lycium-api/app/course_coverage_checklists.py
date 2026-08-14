from __future__ import annotations

import math
import re
from typing import Any

from app.generation_helpers import _stable_id, _title_from_prompt
from app.retrieval import tokenize

COURSE_COVERAGE_CHECKLIST_CONTRACT = "course-coverage-checklist-v1"
COURSE_COVERAGE_ALLOCATION_REPORT_CONTRACT = "course-coverage-allocation-report-v1"
COURSE_COVERAGE_OUTLINE_CONTRACT = "course-outline-from-coverage-checklist-v1"

GENERIC_FILLER_TERMS = {
    "application",
    "approach",
    "beginner",
    "beginners",
    "build",
    "college",
    "concept",
    "concepts",
    "context",
    "course",
    "create",
    "design",
    "essential",
    "essentials",
    "foundational",
    "foundation",
    "foundations",
    "generate",
    "intro",
    "introductory",
    "learner",
    "learners",
    "level",
    "matter",
    "matters",
    "method",
    "methods",
    "orientation",
    "practice",
    "process",
    "student",
    "students",
    "subject",
    "tool",
    "tools",
    "undergrad",
    "undergraduate",
    "vocabulary",
}


def _slug(value: str) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return clean.strip("-") or "coverage-item"


def _unique(values: list[str], *, limit: int | None = None) -> list[str]:
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


def _section_plan(title: str, must_teach: list[str], objective: str | None = None) -> dict[str, Any]:
    return {
        "title": title,
        "mustTeach": must_teach,
        "learningObjective": objective or f"Explain {title.lower()} and use it in an intro-level problem.",
    }


def _coverage_item(
    item_id: str,
    title: str,
    *,
    description: str,
    must_teach: list[str],
    section_plans: list[dict[str, Any]],
    priority: str = "required",
    target_depth: str = "intro_college",
) -> dict[str, Any]:
    return {
        "id": item_id,
        "title": title,
        "description": description,
        "priority": priority,
        "targetDepth": target_depth,
        "mustTeach": must_teach,
        "sectionPlans": section_plans,
    }


TOPIC_CLAUSE_PATTERN = re.compile(
    r"\b(?:covering|including|includes|include|about|on|with)\b(?P<topics>.+)$",
    flags=re.IGNORECASE,
)
LEADING_GOAL_VERB_PATTERN = re.compile(
    r"^(?:understand|explain|apply|analyze|analyse|evaluate|describe|learn|use|identify|interpret|compare|create)\s+",
    flags=re.IGNORECASE,
)


def _clean_topic_phrase(value: str) -> str:
    clean = re.sub(r"\s+", " ", str(value or "")).strip(" -:;,.")
    clean = LEADING_GOAL_VERB_PATTERN.sub("", clean).strip(" -:;,.")
    clean = re.sub(
        r"\s+(?:for|to)\s+(?:first[- ]year|college|undergraduate|undergrad|students?|learners?|beginners?)\b.*$",
        "",
        clean,
        flags=re.IGNORECASE,
    ).strip(" -:;,.")
    return clean


def _topic_phrases_from_prompt(prompt: str) -> list[str]:
    match = TOPIC_CLAUSE_PATTERN.search(prompt)
    if not match:
        return []
    topic_clause = re.split(r"\b(?:for|to)\s+(?:first[- ]year|college|undergraduate|undergrad|students?|learners?|beginners?)\b", match.group("topics"), maxsplit=1, flags=re.IGNORECASE)[0]
    chunks = [chunk for chunk in re.split(r"\s*(?:,|;)\s*", topic_clause) if chunk.strip()]
    if len(chunks) <= 1:
        chunks = [chunk for chunk in re.split(r"\s+\band\b\s+", topic_clause, flags=re.IGNORECASE) if chunk.strip()]
    return _unique([_clean_topic_phrase(chunk) for chunk in chunks], limit=12)


def _phrase_is_specific(phrase: str) -> bool:
    tokens = [token for token in tokenize(phrase) if token not in GENERIC_FILLER_TERMS]
    return len(tokens) >= 2


def _goal_topics(goals: list[str]) -> list[str]:
    return _unique([_clean_topic_phrase(goal) for goal in goals], limit=12)


def _token_topics(prompt: str, title: str) -> list[str]:
    return _unique(
        [
            token
            for token in tokenize(f"{prompt} {title}")
            if len(token) > 3 and token not in GENERIC_FILLER_TERMS
        ],
        limit=8,
    )


def _topic_title(term: str) -> str:
    return " ".join(word.upper() if word.isupper() else word[:1].upper() + word[1:] for word in term.split())


def _topic_keywords(term: str) -> list[str]:
    tokens = [token for token in tokenize(term) if len(token) > 3 and token not in GENERIC_FILLER_TERMS]
    return _unique([term, *tokens], limit=6)


def _topic_section_plans(term: str) -> list[dict[str, Any]]:
    title = _topic_title(term)
    keywords = _topic_keywords(term)
    return [
        _section_plan(
            f"{title} foundations",
            keywords,
            f"Explain the core meaning, vocabulary, and boundaries of {term}.",
        ),
        _section_plan(
            f"Evidence and relationships for {title}",
            _unique([term, "evidence", "relationships", *keywords], limit=6),
            f"Analyze the evidence, variables, and relationships that make {term} usable.",
        ),
        _section_plan(
            f"Applied {title} analysis",
            _unique([term, "application", "analysis", *keywords], limit=6),
            f"Use {term} to reason through a realistic course-level case.",
        ),
    ]


def _generic_seed_terms(prompt: str, title: str, goals: list[str]) -> tuple[list[str], str]:
    goal_terms = _goal_topics(goals)
    prompt_terms = _topic_phrases_from_prompt(prompt)
    if goal_terms and any(_phrase_is_specific(term) for term in goal_terms):
        return goal_terms, "prompt_goals"
    if prompt_terms:
        return prompt_terms, "prompt_phrases"
    if goal_terms:
        return goal_terms, "prompt_goals"
    token_terms = _token_topics(prompt, title)
    if token_terms:
        return token_terms, "prompt_terms"
    return [title], "prompt_title"


def _coverage_item_id(term: str, used_ids: set[str]) -> str:
    base_id = _slug(term)
    item_id = base_id
    suffix = 2
    while item_id in used_ids:
        item_id = f"{base_id}-{suffix}"
        suffix += 1
    used_ids.add(item_id)
    return item_id


def _generic_items(seed_terms: list[str]) -> list[dict[str, Any]]:
    used_ids: set[str] = set()
    return [
        _coverage_item(
            _coverage_item_id(term, used_ids),
            _topic_title(term),
            description=f"Best-effort coverage item inferred from the course prompt: {term}.",
            must_teach=_topic_keywords(term),
            section_plans=_topic_section_plans(term),
        )
        for term in seed_terms
    ]


def build_course_coverage_checklist(
    *,
    prompt: str,
    title: str | None = None,
    level: str | None = None,
    goals: list[str] | None = None,
) -> dict[str, Any]:
    resolved_title = title or _title_from_prompt(prompt)
    seed_terms, source = _generic_seed_terms(prompt, resolved_title, goals or [])
    items = _generic_items(seed_terms)
    return {
        "contractVersion": COURSE_COVERAGE_CHECKLIST_CONTRACT,
        "courseKind": "prompt_inferred",
        "title": resolved_title,
        "level": level or "unspecified",
        "source": source,
        "requiredItems": items,
        "policy": {
            "mustAssignEveryRequiredItemToModule": True,
            "mustAssignEveryRequiredItemToSection": True,
            "genericTitleTokensAreNotCoverage": sorted(GENERIC_FILLER_TERMS),
        },
    }


def _allocate_items(items: list[dict[str, Any]], module_count: int) -> list[list[dict[str, Any]]]:
    if not items:
        return []
    bucket_count = max(1, min(module_count, len(items)))
    buckets: list[list[dict[str, Any]]] = []
    for index in range(bucket_count):
        start = math.floor(index * len(items) / bucket_count)
        end = math.floor((index + 1) * len(items) / bucket_count)
        buckets.append(items[start:end] or [items[min(index, len(items) - 1)]])
    return buckets


def _module_title(bucket: list[dict[str, Any]], module_number: int) -> str:
    if len(bucket) == 1:
        return f"Module {module_number}: {bucket[0]['title']}"
    return f"Module {module_number}: {bucket[0]['title']} through {bucket[-1]['title']}"


def _keywords_for_section(plan: dict[str, Any], item: dict[str, Any]) -> list[str]:
    return _unique([*plan.get("mustTeach", []), *item.get("mustTeach", [])], limit=8)


def _must_teach_for_section(plan: dict[str, Any], item: dict[str, Any]) -> list[str]:
    return _unique(plan.get("mustTeach", []) or item.get("mustTeach", []), limit=6)


def build_coverage_allocation_report(
    checklist: dict[str, Any],
    modules: list[dict[str, Any]],
) -> dict[str, Any]:
    required_ids = {
        str(item.get("id"))
        for item in checklist.get("requiredItems", [])
        if isinstance(item, dict) and item.get("id")
    }
    module_ids = {
        str(item_id)
        for module in modules
        for item_id in module.get("assignedCoverageItemIds", [])
        if str(item_id)
    }
    section_ids = {
        str(item_id)
        for module in modules
        for section in module.get("sections", [])
        if isinstance(section, dict)
        for item_id in section.get("assignedCoverageItemIds", [])
        if str(item_id)
    }
    unassigned_module_ids = sorted(required_ids - module_ids)
    unassigned_section_ids = sorted(required_ids - section_ids)
    duplicate_module_assignments = sorted(
        item_id
        for item_id in required_ids
        if sum(1 for module in modules if item_id in module.get("assignedCoverageItemIds", [])) > 1
    )
    return {
        "contractVersion": COURSE_COVERAGE_ALLOCATION_REPORT_CONTRACT,
        "status": "passed"
        if not unassigned_module_ids and not unassigned_section_ids and not duplicate_module_assignments
        else "failed",
        "requiredItemCount": len(required_ids),
        "moduleAssignedItemCount": len(module_ids),
        "sectionAssignedItemCount": len(section_ids),
        "unassignedModuleItemIds": unassigned_module_ids,
        "unassignedSectionItemIds": unassigned_section_ids,
        "duplicateModuleAssignmentIds": duplicate_module_assignments,
    }


def build_outline_from_coverage_checklist(
    *,
    prompt: str,
    desired_module_count: int,
    goals: list[str] | None = None,
    level: str | None = None,
    checklist: dict[str, Any] | None = None,
) -> dict[str, Any]:
    title = _title_from_prompt(prompt)
    checklist = checklist or build_course_coverage_checklist(
        prompt=prompt,
        title=title,
        level=level,
        goals=goals or [],
    )
    items = [item for item in checklist.get("requiredItems", []) if isinstance(item, dict)]
    modules: list[dict[str, Any]] = []
    for module_index, bucket in enumerate(_allocate_items(items, desired_module_count), start=1):
        assigned_ids = [str(item.get("id")) for item in bucket if item.get("id")]
        module_title = _module_title(bucket, module_index)
        module_id = _stable_id("m", title, module_title, str(module_index))
        sections: list[dict[str, Any]] = []
        for item in bucket:
            item_id = str(item.get("id") or _slug(str(item.get("title") or "coverage-item")))
            section_plans = [plan for plan in item.get("sectionPlans", []) if isinstance(plan, dict)]
            for section_index, plan in enumerate(section_plans or [_section_plan(str(item.get("title") or "Coverage item"), item.get("mustTeach", []))], start=1):
                section_title = str(plan.get("title") or item.get("title") or "Coverage section")
                section_id = _stable_id("s", module_id, item_id, section_title, str(section_index))
                keywords = _keywords_for_section(plan, item)
                must_teach = _must_teach_for_section(plan, item)
                sections.append(
                    {
                        "id": section_id,
                        "title": section_title,
                        "learning_objectives": [str(plan.get("learningObjective") or f"Explain {section_title.lower()}.")],
                        "concept_keywords": keywords,
                        "assignedCoverageItemIds": [item_id],
                        "coverageItemId": item_id,
                        "coverageMustTeach": must_teach,
                        "estimated_minutes": 20,
                    }
                )
        modules.append(
            {
                "id": module_id,
                "title": module_title,
                "learning_objectives": [
                    f"Teach {item.get('title')} at {checklist.get('level') or 'intro'} depth."
                    for item in bucket
                    if item.get("title")
                ],
                "assignedCoverageItemIds": assigned_ids,
                "coverageAllocationStatus": "assigned",
                "sections": sections,
            }
        )
    allocation_report = build_coverage_allocation_report(checklist, modules)
    return {
        "contractVersion": COURSE_COVERAGE_OUTLINE_CONTRACT,
        "title": title,
        "shortDescription": f"A best-effort course outline covering required {checklist.get('courseKind', 'course')} topics for {title}.",
        "summary": f"A coverage-checklist outline for {title}; source review is still required before publication.",
        "modules": modules,
        "coverageChecklist": checklist,
        "coverageAllocationReport": allocation_report,
        "provenance": {
            "mode": "coverage-checklist-fallback",
            "courseKind": checklist.get("courseKind"),
            "coverageChecklistContract": checklist.get("contractVersion"),
            "coverageAllocationStatus": allocation_report.get("status"),
            "object_ids": [],
        },
    }
