from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any
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
    "schedule": "topics",
    "weekly schedule": "topics",
    "course schedule": "topics",
    "calendar": "topics",
    "prerequisites": "prerequisites",
    "required materials": "materials",
    "textbook": "materials",
    "assessment": "assessment",
    "assignments": "assessment",
}

ITEM_PREFIX_RE = re.compile(r"^\s*(?:[-*•]+|\(?\d{1,2}[\).:-]|\(?[a-zA-Z][\).:-])\s*")
COURSE_CODE_RE = re.compile(r"\b[A-Z]{2,6}\s*[- ]?\d{2,4}[A-Z]?\b")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")

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


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "requirement"


def _title(value: str) -> str:
    words = [word for word in re.split(r"[-_\s]+", value.strip()) if word]
    small_words = {"and", "for", "in", "of", "the", "to", "with"}
    titled = [
        word if index > 0 and word.lower() in small_words else word[:1].upper() + word[1:]
        for index, word in enumerate(words)
    ]
    return " ".join(titled) or "Curriculum Requirement"


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


def _fetch_source(url: str) -> tuple[str, str]:
    headers = {"User-Agent": SETTINGS.user_agent}
    with httpx.Client(timeout=6.0, follow_redirects=True, headers=headers) as client:
        response = client.get(url)
        response.raise_for_status()
        return response.text, response.headers.get("content-type", "")


def _html_to_title_text(raw: str, content_type: str) -> tuple[str | None, str]:
    if "html" not in content_type.lower() and "<html" not in raw[:500].lower():
        return None, raw

    soup = BeautifulSoup(raw, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else None
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    text = "\n".join(chunk.strip() for chunk in soup.get_text(separator="\n").splitlines() if chunk.strip())
    return title, text


def _lines(text: str) -> list[tuple[int, str]]:
    rows: list[tuple[int, str]] = []
    for index, raw_line in enumerate(text.splitlines(), start=1):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if line:
            rows.append((index, line))
    return rows


def _heading_key(line: str) -> str | None:
    normalized = re.sub(r"[:#]+$", "", line.lower()).strip()
    if normalized in HEADING_ALIASES:
        return HEADING_ALIASES[normalized]
    for heading, key in HEADING_ALIASES.items():
        if normalized.startswith(f"{heading}:"):
            return key
    return None


def _sectioned_lines(rows: list[tuple[int, str]]) -> dict[str, list[tuple[int, str]]]:
    sections: dict[str, list[tuple[int, str]]] = {}
    current = "general"
    for line_no, line in rows:
        heading = _heading_key(line)
        if heading:
            current = heading
            sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append((line_no, line))
    return sections


def _clean_item(line: str) -> str:
    cleaned = ITEM_PREFIX_RE.sub("", line).strip()
    cleaned = re.sub(
        r"^(?:students?|learners?)\s+(?:will|should|must|can)\s+(?:be able to\s+)?",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"^(?:upon completion,?\s*)", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip(" -:;.")
    return cleaned


def _looks_like_curriculum_item(line: str) -> bool:
    lowered = line.lower()
    if ITEM_PREFIX_RE.match(line):
        return True
    if any(f" {verb} " in f" {lowered} " or lowered.startswith(f"{verb} ") for verb in ACTION_VERBS):
        return True
    return any(
        phrase in lowered
        for phrase in (
            "students will",
            "student will",
            "learners will",
            "will be able to",
            "course covers",
            "topics include",
            "including",
        )
    )


def _candidate_items(section_rows: list[tuple[int, str]], *, allow_sentences: bool) -> list[tuple[int, str]]:
    items: list[tuple[int, str]] = []
    for line_no, line in section_rows:
        candidate_lines = [line]
        if allow_sentences and len(line) > 180:
            candidate_lines = SENTENCE_SPLIT_RE.split(line)
        for candidate in candidate_lines:
            cleaned = _clean_item(candidate)
            if 8 <= len(cleaned) <= 220 and _looks_like_curriculum_item(candidate):
                items.append((line_no, cleaned))
    return items


def _dedupe_items(items: list[tuple[int, str]], limit: int) -> list[tuple[int, str]]:
    seen: set[str] = set()
    deduped: list[tuple[int, str]] = []
    for line_no, item in items:
        key = _slug(item)[:80]
        if key in seen:
            continue
        seen.add(key)
        deduped.append((line_no, item))
        if len(deduped) >= limit:
            break
    return deduped


def _requirement_title(item: str) -> str:
    lowered = item.lower()
    for verb in ACTION_VERBS:
        if lowered.startswith(f"{verb} "):
            item = item[len(verb) :].strip()
            break
    words = [word for word in re.split(r"[^A-Za-z0-9+#.]+", item) if word]
    return _title(" ".join(words[:8]))


def _learning_outcome(item: str, prompt: str) -> str:
    lowered = item.lower()
    if lowered.startswith(ACTION_VERBS):
        return item[0].upper() + item[1:].rstrip(".") + "."
    return f"Explain and apply {_requirement_title(item)} in the context of {prompt}."


def _extract_title(rows: list[tuple[int, str]], html_title: str | None, prompt: str) -> str:
    if html_title and len(html_title) <= 180:
        return html_title
    for _, line in rows[:20]:
        if COURSE_CODE_RE.search(line) and len(line) <= 180:
            return line
        lowered = line.lower()
        if lowered.startswith(("course title", "title:")) and len(line) <= 180:
            return re.sub(r"^(course title|title)\s*:\s*", "", line, flags=re.IGNORECASE)
    return prompt[:160] or "Submitted curriculum benchmark"


def _requirements_from_items(
    items: list[tuple[int, str]],
    *,
    benchmark_id: str,
    evidence_ref: str,
    prompt: str,
) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    for index, (line_no, item) in enumerate(items, start=1):
        title = _requirement_title(item)
        importance = "required" if index <= 8 else "recommended"
        requirements.append(
            {
                "id": f"req-{_slug(title)}",
                "title": title,
                "description": _learning_outcome(item, prompt),
                "importance": importance,
                "topics": [_slug(title).replace("-", " ")],
                "origin": {
                    "originType": "common_academic_requirement",
                    "evidenceRefs": [f"{evidence_ref}#L{line_no}"],
                    "benchmarkIds": [benchmark_id],
                    "frequency": 1,
                },
            }
        )
    return requirements


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
            *_candidate_items(sections.get("general", [])[:30], allow_sentences=True),
        ],
        limit=12,
    )
    requirement_items = _dedupe_items([*outcome_items, *topic_items], limit=16)
    if len(requirement_items) < 2:
        return None

    title = _extract_title(rows, html_title, prompt)
    benchmark_id = f"benchmark-extracted-{index}-{_slug(title)[:48]}"
    evidence_ref = f"input-source-{index}"
    requirements = _requirements_from_items(
        requirement_items,
        benchmark_id=benchmark_id,
        evidence_ref=evidence_ref,
        prompt=prompt,
    )
    topics = [requirement["topics"][0] for requirement in requirements[:10]]
    confidence = 0.86 if len(requirements) >= 6 else 0.72

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
        "extractedRequirements": requirements,
        "confidence": confidence,
        "extraction": {
            "status": "parsed",
            "extractor": "curriculum-structure-v1",
            "contentType": content_type or "text/plain",
            "lineCount": len(rows),
            "requirementCount": len(requirements),
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
