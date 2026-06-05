from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any
from app.curriculum_benchmark_extraction_helpers import (
    _assessment_types,
    _candidate_items,
    _clean_item,
    _dedupe_items,
    _extract_title,
    _fetch_source,
    _heading_key,
    _html_to_title_text,
    _institution,
    _item_importance,
    _learning_outcome,
    _lines,
    _looks_like_curriculum_item,
    _plain_items,
    _requirement_title,
    _requirements_from_items,
    _schedule_clues,
    _sectioned_lines,
    _slug,
    _source_type,
    _title,
    _topics_from_text,
)

from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.config import SETTINGS


CurriculumFetcher = Callable[[str], tuple[str, str]]

HEADING_ALIASES = {
    "course description": "description",
    "description": "description",
    "learning outcomes": "outcomes",
    "learning objectives": "outcomes",
    "student learning outcomes": "outcomes",
    "objectives": "outcomes",
    "course outcomes": "outcomes",
    "topics": "topics",
    "course topics": "topics",
    "outline": "topics",
    "required topics": "required",
    "core topics": "required",
    "required content": "required",
    "optional topics": "optional",
    "recommended topics": "optional",
    "supplemental topics": "optional",
    "schedule": "schedule",
    "weekly schedule": "schedule",
    "course schedule": "schedule",
    "calendar": "schedule",
    "prerequisites": "prerequisites",
    "prerequisite": "prerequisites",
    "recommended preparation": "prerequisites",
    "required materials": "materials",
    "textbook": "materials",
    "assessment": "assessment",
    "assessments": "assessment",
    "assignments": "assessment",
    "evaluation": "assessment",
    "grading": "assessment",
}

ITEM_PREFIX_RE = re.compile(r"^\s*(?:[-*•]+|\(?\d{1,2}[\).:-]|\(?[a-zA-Z][\).:-])\s*")
COURSE_CODE_RE = re.compile(r"\b[A-Z]{2,6}\s*[- ]?\d{2,4}[A-Z]?\b")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
SCHEDULE_LABEL_RE = re.compile(r"^\s*((?:week|module|unit|lesson|class|day)\s*\d{1,2})\s*[:\-.)]\s*(.+)$", re.IGNORECASE)

ACTION_VERBS = (
    "analyze",
    "apply",
    "build",
    "calculate",
    "compare",
    "create",
    "define",
    "describe",
    "design",
    "develop",
    "differentiate",
    "evaluate",
    "explain",
    "identify",
    "implement",
    "interpret",
    "model",
    "solve",
    "understand",
    "use",
)

ASSESSMENT_KEYWORDS = (
    ("quiz", ("quiz", "quizzes")),
    ("exam", ("exam", "midterm", "final")),
    ("lab", ("lab", "laboratory")),
    ("homework", ("homework", "problem set")),
    ("project", ("project", "capstone")),
    ("paper", ("paper", "essay", "report")),
    ("presentation", ("presentation", "present")),
    ("discussion", ("discussion", "participation")),
    ("assignment", ("assignment", "assignments")),
)

OPTIONAL_MARKERS = ("optional", "recommended", "supplemental", "additional", "enrichment", "extra credit")
REQUIRED_MARKERS = ("required", "must", "core", "mandatory")


def extract_benchmark_from_text(
    *,
    prompt: str,
    url: str,
    raw_text: str,
    content_type: str,
    index: int,
    category: str | None,
    department: str | None,
) -> dict[str, Any] | None:
    if "pdf" in content_type.lower():
        return None

    html_title, text = _html_to_title_text(raw_text, content_type)
    rows = _lines(text)
    if len(rows) < 4:
        return None

    sections = _sectioned_lines(rows)
    outcome_items = _dedupe_items(
        [
            *_candidate_items(sections.get("outcomes", []), allow_sentences=True),
            *_candidate_items(sections.get("description", []), allow_sentences=True),
        ],
        limit=12,
    )
    topic_items = _dedupe_items(
        [
            *_candidate_items(sections.get("topics", []), allow_sentences=False),
            *_candidate_items(sections.get("schedule", []), allow_sentences=False),
            *_candidate_items(sections.get("general", [])[:30], allow_sentences=True),
        ],
        limit=12,
    )
    required_items = _dedupe_items(
        [*_candidate_items(sections.get("required", []), allow_sentences=False), *_plain_items(sections.get("required", []), limit=12)],
        limit=12,
    )
    optional_items = _dedupe_items(
        [*_candidate_items(sections.get("optional", []), allow_sentences=False), *_plain_items(sections.get("optional", []), limit=12)],
        limit=12,
    )
    prerequisite_items = _plain_items(sections.get("prerequisites", []), limit=8)
    assessment_types = _assessment_types(sections)
    evidence_ref = f"input-source-{index}"
    schedule_rows = [
        *sections.get("schedule", []),
        *[row for row in sections.get("topics", []) if SCHEDULE_LABEL_RE.match(row[1])],
        *[row for row in sections.get("general", [])[:40] if SCHEDULE_LABEL_RE.match(row[1])],
    ]
    schedule_clues = _schedule_clues(schedule_rows, evidence_ref)
    requirement_items = _dedupe_items([*outcome_items, *required_items, *topic_items, *optional_items], limit=20)
    if len(requirement_items) < 2:
        return None

    title = _extract_title(rows, html_title, prompt)
    benchmark_id = f"benchmark-extracted-{index}-{_slug(title)[:48]}"
    required_keys = {_slug(item)[:80] for _, item in required_items}
    optional_keys = {_slug(item)[:80] for _, item in optional_items}
    requirements = _requirements_from_items(
        requirement_items,
        benchmark_id=benchmark_id,
        evidence_ref=evidence_ref,
        prompt=prompt,
        required_keys=required_keys,
        optional_keys=optional_keys,
    )
    topics = [requirement["topics"][0] for requirement in requirements[:10]]
    signal_count = sum(
        bool(value)
        for value in (
            outcome_items,
            topic_items,
            prerequisite_items,
            assessment_types,
            schedule_clues,
            required_items,
            optional_items,
        )
    )
    confidence = min(0.94, (0.66 if len(requirements) < 6 else 0.8) + signal_count * 0.025)

    return {
        "id": benchmark_id,
        "sourceType": _source_type(url),
        "title": title,
        "institution": _institution(url),
        "programName": category or None,
        "department": department or None,
        "url": url,
        "sourceRefs": [evidence_ref],
        "topics": topics,
        "learningOutcomes": [_learning_outcome(item, prompt) for _, item in requirement_items[:8]],
        "prerequisites": [item for _, item in prerequisite_items],
        "assessmentTypes": assessment_types,
        "scheduleClues": schedule_clues,
        "requiredCandidates": [item for _, item in required_items]
        or [requirement["title"] for requirement in requirements if requirement["importance"] == "required"],
        "optionalCandidates": [item for _, item in optional_items]
        or [requirement["title"] for requirement in requirements if requirement["importance"] == "optional"],
        "extractedRequirements": requirements,
        "confidence": confidence,
        "extraction": {
            "status": "parsed",
            "extractor": "curriculum-structure-v2",
            "contentType": content_type or "text/plain",
            "lineCount": len(rows),
            "requirementCount": len(requirements),
            "outcomeCandidateCount": len(outcome_items),
            "topicCandidateCount": len(topic_items),
            "prerequisiteCount": len(prerequisite_items),
            "assessmentTypeCount": len(assessment_types),
            "scheduleClueCount": len(schedule_clues),
            "requiredCandidateCount": len(required_items),
            "optionalCandidateCount": len(optional_items),
        },
    }


def extract_curriculum_benchmarks_from_sources(
    *,
    prompt: str,
    source_urls: list[str] | None,
    category: str | None = None,
    department: str | None = None,
    fetch_sources: bool = False,
    fetcher: CurriculumFetcher | None = None,
    source_documents: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    benchmarks: list[dict[str, Any]] = []
    source_documents = source_documents or []
    fetcher = fetcher or _fetch_source

    for index, document in enumerate(source_documents, start=1):
        url = str(document.get("url") or f"submitted-document-{index}")
        raw_text = str(document.get("text") or document.get("rawText") or document.get("content") or "")
        content_type = str(document.get("contentType") or document.get("content_type") or "text/plain")
        benchmark = extract_benchmark_from_text(
            prompt=prompt,
            url=url,
            raw_text=raw_text,
            content_type=content_type,
            index=index,
            category=category,
            department=department,
        )
        if benchmark:
            benchmarks.append(benchmark)

    if not fetch_sources:
        return benchmarks

    offset = len(source_documents)
    for index, url in enumerate(source_urls or [], start=1):
        try:
            raw_text, content_type = fetcher(url)
        except (httpx.HTTPError, OSError, ValueError):
            continue
        benchmark = extract_benchmark_from_text(
            prompt=prompt,
            url=url,
            raw_text=raw_text,
            content_type=content_type,
            index=offset + index,
            category=category,
            department=department,
        )
        if benchmark:
            benchmarks.append(benchmark)

    return benchmarks
