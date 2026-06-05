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


def _plain_items(section_rows: list[tuple[int, str]], limit: int) -> list[tuple[int, str]]:
    items: list[tuple[int, str]] = []
    for line_no, line in section_rows:
        for chunk in re.split(r";|\s{2,}", line):
            cleaned = _clean_item(chunk)
            cleaned = re.sub(
                r"^(?:prerequisites?|required|optional|recommended preparation)\s*:\s*",
                "",
                cleaned,
                flags=re.IGNORECASE,
            )
            if 3 <= len(cleaned) <= 180:
                items.append((line_no, cleaned))
        if len(items) >= limit:
            break
    return _dedupe_items(items, limit=limit)


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


def _assessment_types(sections: dict[str, list[tuple[int, str]]]) -> list[str]:
    text = " ".join(line.lower() for rows in (sections.get("assessment", []), sections.get("general", [])[:40]) for _, line in rows)
    return [label for label, tokens in ASSESSMENT_KEYWORDS if any(token in text for token in tokens)]


def _topics_from_text(value: str) -> list[str]:
    cleaned = re.sub(r"^(?:topics?|includes?|covers?)\s*:\s*", "", value, flags=re.IGNORECASE)
    topics = [_clean_item(part) for part in re.split(r",|;|\band\b", cleaned)]
    return [topic for topic in topics if 3 <= len(topic) <= 80][:8]


def _schedule_clues(rows: list[tuple[int, str]], evidence_ref: str) -> list[dict[str, Any]]:
    clues: list[dict[str, Any]] = []
    for line_no, line in rows:
        match = SCHEDULE_LABEL_RE.match(line)
        label = match.group(1).title() if match else f"Schedule item {len(clues) + 1}"
        body = match.group(2) if match else line
        topics = _topics_from_text(body)
        if topics:
            clues.append({"label": label, "topics": topics, "evidenceRefs": [f"{evidence_ref}#L{line_no}"]})
        if len(clues) >= 16:
            break
    return clues


def _item_importance(item: str, index: int, required_keys: set[str], optional_keys: set[str]) -> str:
    lowered = item.lower()
    key = _slug(item)[:80]
    if key in optional_keys or any(marker in lowered for marker in OPTIONAL_MARKERS):
        return "optional"
    if key in required_keys or any(marker in lowered for marker in REQUIRED_MARKERS):
        return "required"
    return "required" if index <= 8 else "recommended"


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
    required_keys: set[str] | None = None,
    optional_keys: set[str] | None = None,
) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    required_keys = required_keys or set()
    optional_keys = optional_keys or set()
    for index, (line_no, item) in enumerate(items, start=1):
        title = _requirement_title(item)
        importance = _item_importance(item, index, required_keys, optional_keys)
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


