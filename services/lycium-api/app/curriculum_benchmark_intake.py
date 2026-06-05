from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

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
