from __future__ import annotations

import hashlib
import re
from typing import Any

from app.course_block_policy import supports_worked_example


COURSE_GENERATION_RULES = (
    "Quizzes are assessment-only sections. Do not mix instructional content and quiz content "
    "inside the same generated section. Use pageType='learn' for instructional pages and "
    "pageType='apply' for assessment or practice pages. Generated content must use the same atomic "
    "editable blocks the UI creates: text, heading, conceptCard, equation, workedExample, video, iframe, and quiz. "
    "Use equation for standalone formulas or symbolic relationships. Use workedExample only for quantitative, formal, "
    "technical, or procedural problems where learners need repeatable work; do not use it for interpretive humanities "
    "or social-science analysis, historical causation, literary interpretation, ethics discussion, or source-analysis prompts. End every "
    "learn page with a heading block titled 'Concepts introduced' followed by one conceptCard block per "
    "raw concept. Each conceptCard must include a short title/name and concise description. Module "
    "summaries must be learn pages with a heading block titled according to the course pacing label, "
    "such as 'Module concepts' or 'Week concepts', followed by one conceptCard per reviewed concept. "
    "Choose exactly one learner-facing "
    "pacing label, 'Module' or 'Week', record it in metadata.pacingLabel, and do not mix the two labels "
    "in module titles, summary titles, or summary concept-card titles. "
    "Do not use interpretive prose categories as concept cards. Quiz blocks may include maxAttempts "
    "and timeLimitSeconds; omitted or blank values mean unlimited. showAnswers defaults to false, "
    "but answers are shown after submission on the final allowed attempt. If source coverage is below "
    "the course source policy, still generate a coherent module and section outline plus empty planned section "
    "shells with handoff metadata for section fill. Mark the draft needs_sources with metadata.sourceGaps, and reserve source readiness as "
    "a review and publication gate rather than an outline or course-access gate. Source IDs and citations must be scoped to the concepts actually "
    "taught or assessed in that section; do not blanket-cite the full course source list on every page."
)


def _stable_id(prefix: str, *parts: str) -> str:
    seed = "::".join(parts)
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}-{digest}"


SOURCE_TITLE_FILE_NOUNS = (
    "pdf",
    "document",
    "file",
    "book",
    "textbook",
    "source",
    "sources",
    "notes",
    "article",
    "paper",
    "slide deck",
    "slides",
)
GENERIC_SOURCE_TITLES = {
    "direct source",
    "input artifact",
    "provided source",
    "submitted source",
    "uploaded source",
}


def _smart_title(value: str) -> str:
    words = []
    for word in value.split():
        words.append(word if word.isupper() else word[:1].upper() + word[1:].lower())
    return " ".join(words)


def _clean_source_title(value: str) -> str:
    clean = re.sub(r"\s+", " ", str(value or "")).strip(" -:;,.")
    if not clean:
        return ""
    clean = clean.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    clean = re.sub(r"\.(?:pdf|txt|md|markdown|docx?|pptx?|html?)$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(
        r"\s+(?:pdf|document|file|book|textbook|source|notes?|article|paper|slide deck|slides)$",
        "",
        clean,
        flags=re.IGNORECASE,
    )
    clean = re.sub(r"\s+", " ", clean).strip(" -:;,.")
    if not clean:
        return ""
    if re.fullmatch(r"(?:submitted|provided|uploaded|input)\s+source\s+\d+", clean, flags=re.IGNORECASE):
        return ""
    if clean.lower() in GENERIC_SOURCE_TITLES:
        return ""
    return _smart_title(clean)


def _candidate_document_title(document: dict[str, Any]) -> str:
    citation = document.get("citation") if isinstance(document.get("citation"), dict) else {}
    source = document.get("source") if isinstance(document.get("source"), dict) else {}
    locator = source.get("locator") if isinstance(source.get("locator"), dict) else {}
    candidates = [
        document.get("title"),
        document.get("source_title"),
        document.get("sourceTitle"),
        document.get("filename"),
        document.get("fileName"),
        citation.get("title"),
        citation.get("filename"),
        locator.get("filename"),
        source.get("title"),
    ]
    for candidate in candidates:
        title = _clean_source_title(str(candidate or ""))
        if title:
            return title
    return ""


def _source_packet_documents(source_packet: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(source_packet, dict):
        return []
    for key in ("source_documents", "sourceDocuments", "sources"):
        value = source_packet.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _title_from_source_packet(source_packet: dict[str, Any] | None) -> str:
    for document in _source_packet_documents(source_packet):
        title = _candidate_document_title(document)
        if title:
            return title
    return ""


def _attachment_title_from_prompt(prompt: str) -> str:
    normalized = re.sub(r"\s+", " ", str(prompt or "")).strip()
    patterns = (
        r"\b(?:based\s+on|from|using)\s+(?:the\s+)?(?:attached|uploaded|provided)\s+(?P<title>.+?)(?:[.;,]|$)",
        r"\b(?:attached|uploaded|provided)\s+(?P<title>.+?)(?:[.;,]|$)",
    )
    for pattern in patterns:
        match = re.search(pattern, normalized, flags=re.IGNORECASE)
        if not match:
            continue
        raw_title = re.sub(
            rf"\b(?:{'|'.join(re.escape(noun) for noun in SOURCE_TITLE_FILE_NOUNS)})\b",
            " ",
            match.group("title"),
            flags=re.IGNORECASE,
        )
        title = _clean_source_title(raw_title)
        if title and len(title.split()) <= 8:
            return title
    return ""


def _prompt_references_attached_source(prompt: str) -> bool:
    return bool(
        re.search(
            r"\b(?:attached|uploaded|provided)\b.*\b(?:pdf|document|file|book|textbook|source|notes?|article|paper|slides?)\b",
            str(prompt or ""),
            flags=re.IGNORECASE,
        )
    )


def _title_from_prompt(prompt: str) -> str:
    cleaned = re.sub(r"\s+", " ", prompt).strip()
    cleaned = re.sub(
        r"\b(?:needs?|needing|missing|requires?|requiring)\s+sources?\b|\bsource[- ](?:gaps?|gated)\b",
        " ",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"^(?:please\s+)?(?:create|build|generate|make|design)(?:\s+me)?\s+(?:an?\s+|the\s+)?",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    attachment_title = _attachment_title_from_prompt(cleaned)
    if attachment_title:
        return attachment_title
    cleaned = re.sub(
        r"\s+(?:covering|including|that\s+covers|that\s+includes|with)\s+.+$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"^(?:course|class)\s+(?:about|on|covering|including|with)\s+(.+)$",
        r"\1 Course",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\s+for\s+(?:first[- ]year|college|undergraduate|undergrad|high[- ]school|postgraduate|postgrad|students?|learners?|beginners?|introductory)\b.*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -:,.\t") or "Untitled Course"
    if len(cleaned) <= 64:
        return cleaned.title()
    return f"{cleaned[:61].strip().title()}..."


def _title_from_prompt_or_source(prompt: str, source_packet: dict[str, Any] | None = None) -> str:
    source_title = _title_from_source_packet(source_packet)
    if source_title and _prompt_references_attached_source(prompt):
        return source_title
    prompt_title = _title_from_prompt(prompt)
    if prompt_title != "Untitled Course":
        return prompt_title
    return source_title or prompt_title


def _extract_goals(prompt: str, explicit_goals: list[str], tokens: list[str]) -> list[str]:
    if explicit_goals:
        return explicit_goals[:8]
    if not tokens:
        return ["Understand the topic fundamentals"]
    unique = list(dict.fromkeys(tokens))
    return [f"Understand {token}" for token in unique[:6]]


def _catalog_metadata_from_prompt(prompt: str) -> dict[str, Any]:
    tokens = [
        token
        for token in re.findall(r"[a-zA-Z][a-zA-Z0-9]+", _title_from_prompt(prompt).lower())
        if len(token) > 3
    ]
    tags = list(dict.fromkeys(tokens))[:6] or ["generated-course"]
    return {
        "category": "computing-information-sciences",
        "department": "computer-science",
        "tags": tags,
    }


def _build_instructional_blocks(section_title: str, prompt: str, source_excerpt: str | None = None) -> list[dict[str, Any]]:
    subject = section_title.strip() or prompt.strip() or "the topic"
    excerpt = (source_excerpt or "").strip()
    grounding = (
        f" The available source material says: {excerpt[:420]}"
        if excerpt
        else " The available source coverage is sparse, so this lesson uses a conservative scaffold that should be reviewed."
    )
    application_block = (
        {
            "type": "workedExample",
            "title": f"Worked example: {subject}",
            "problem": f"Use {subject} to solve a realistic problem under one constraint.",
            "given": [
                f"Topic or method: {subject}",
                "Known values, a concrete task, and one constraint.",
            ],
            "find": [
                "The selected method and the result it produces.",
                "A check on units, assumptions, or practical meaning.",
            ],
            "steps": [
                {
                    "explanation": "Name the known values and constraint.",
                    "equation": "knowns + constraint -> setup",
                },
                {
                    "explanation": "Apply the relevant formula, algorithm, or procedure.",
                    "equation": "setup + method -> result",
                },
                {
                    "explanation": "Check the result against units, assumptions, or practical consequences.",
                    "equation": "result check = units + assumptions + meaning",
                },
            ],
            "workedAnswer": "A strong answer states the result, method, and reasonableness check.",
            "check": "The example is credible when the method visibly controls the final answer.",
        }
        if supports_worked_example(section_title, prompt)
        else {
            "type": "text",
            "heading": "Guided practice",
            "value": (
                f"Use {subject} in a short learner exercise. Name the situation, identify the evidence or example that matters, "
                "explain the conclusion in your own words, and add one limitation that would need more support."
            ),
        }
    )
    return [
        {
            "type": "text",
            "heading": "Explanation",
            "value": (
                f"{subject} is introduced as a practical capability rather than a vocabulary item. "
                f"Learners identify what the idea is, why it matters, what problem it helps solve, and what signals show that it is being used correctly."
                f"{grounding} The goal is to connect the definition to decisions a practitioner would actually make."
            ),
        },
        application_block,
        {
            "type": "text",
            "heading": "Practice",
            "value": (
                f"Practice by writing a short decision note for {subject}. Define the situation, list two alternatives, choose one, and justify it with source-backed reasoning. "
                "Then revise the note by adding one limitation and one follow-up question that would improve confidence."
            ),
        },
    ]


def _concept_card_block(name: str, description: str, *, source_section_id: str | None = None) -> dict[str, Any]:
    block: dict[str, Any] = {
        "type": "conceptCard",
        "title": name,
        "description": description,
    }
    if source_section_id:
        block["sourceSectionId"] = source_section_id
    return block


def _ensure_minimum_outline_modules(raw_modules: Any) -> list[dict[str, Any]]:
    modules = [module for module in raw_modules if isinstance(module, dict)] if isinstance(raw_modules, list) else []
    if len(modules) != 1:
        return modules
    first = modules[0]
    first_section = next((section for section in first.get("sections", []) if isinstance(section, dict)), {})
    applied_title = f"Applied {first_section.get('title') or first.get('title') or 'practice'}"
    return [
        first,
        {
            "id": _stable_id("module", str(first.get("id") or "module"), "applied"),
            "title": "Module 2: Applied Practice",
            "learning_objectives": first.get("learning_objectives", []),
            "sections": [
                {
                    "id": _stable_id("sec", applied_title),
                    "title": applied_title,
                    "learning_objectives": first_section.get("learning_objectives", []),
                    "concept_keywords": first_section.get("concept_keywords", []),
                    "estimated_minutes": first_section.get("estimated_minutes", 20),
                }
            ],
        },
    ]


def _youtube_embed(url: str) -> str | None:
    if "youtube.com/watch?v=" in url:
        video_id = url.split("watch?v=")[-1].split("&", 1)[0]
        return f"https://www.youtube.com/embed/{video_id}"
    if "youtu.be/" in url:
        video_id = url.split("youtu.be/")[-1].split("?", 1)[0]
        return f"https://www.youtube.com/embed/{video_id}"
    if "youtube.com/embed/" in url:
        return url
    return None


def _build_quiz_for_section(section_title: str, concept_tokens: list[str]) -> dict[str, Any]:
    answer = concept_tokens[0].replace("_", " ").title() if concept_tokens else "Core Concept"
    distractor_1 = concept_tokens[1].replace("_", " ").title() if len(concept_tokens) > 1 else "Unrelated Detail"
    distractor_2 = concept_tokens[2].replace("_", " ").title() if len(concept_tokens) > 2 else "Advanced Edge Case"
    questions = [
        {
            "id": f"q{index}",
            "question": template.format(section=section_title, answer=answer),
            "options": [correct, distractor_1, distractor_2, "A memorized definition without context"],
            "answers": [0],
        }
        for index, (template, correct) in enumerate(
            [
                ("Which concept is most central to: {section}?", answer),
                ("What should a learner explain first when applying {section}?", "The practical purpose and constraint"),
                ("What makes an example of {section} stronger?", "It states evidence, tradeoffs, and risk"),
                ("Which action best shows understanding of {section}?", "Choosing an approach and justifying it under constraints"),
                ("What should be avoided when studying {section}?", "Treating the concept as isolated vocabulary"),
                ("What belongs in a practice note about {section}?", "Situation, alternatives, choice, and justification"),
                ("Why should alternatives be compared in {section}?", "Comparison makes the tradeoff explicit"),
                ("What evidence improves reasoning about {section}?", "Source-backed facts and observed constraints"),
                ("What follow-up strengthens work on {section}?", "Naming a limitation and a next question"),
                ("What is the best completion standard for {section}?", "Explaining the idea in a realistic decision"),
            ],
            start=1,
        )
    ]
    return {
        "type": "quiz",
        "questions": questions,
        "questionsPerAttempt": "",
        "maxAttempts": "",
        "timeLimitSeconds": "",
        "passPercentage": "",
        "showAnswers": False,
    }


def _build_module_summary_section(
    *,
    module_id: str,
    module_title: str,
    section_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    pacing_label = "Week" if module_title.startswith("Week ") else "Module"
    summary_subject = re.sub(r"^Week\s+\d+:\s*", "", module_title)
    summary_subject = re.sub(r"^Module\s+\d+:\s*", "", summary_subject)
    lesson_titles = [section["title"] for section in section_rows if section.get("sectionType") != "assessment"]
    summary_concepts: list[dict[str, str]] = []

    for section in section_rows:
        if section.get("sectionType") == "assessment":
            continue
        for block in section.get("content", []):
            if block.get("type") in {"conceptCard", "concept_card"}:
                name = block.get("title") or block.get("name") or block.get("heading")
                description = block.get("description") or block.get("body") or block.get("value") or block.get("text") or ""
                if name:
                    summary_concepts.append(
                        {
                            "name": str(name),
                            "description": str(description),
                            "sourceSectionId": section["id"],
                        }
                    )
                continue
            if block.get("type") not in {"conceptCards", "concept_cards"}:
                continue
            for concept in block.get("concepts", []):
                name = concept.get("name") if isinstance(concept, dict) else concept
                if name:
                    summary_concepts.append(
                        {
                            "name": str(name),
                            "description": concept.get("description", "") if isinstance(concept, dict) else "",
                            "sourceSectionId": section["id"],
                        }
                    )

    if not summary_concepts:
        summary_concepts = [
            {"name": title, "description": f"A core concept introduced in the lesson page titled {title}."}
            for title in lesson_titles[:5]
        ] or [{"name": module_title, "description": f"The main concept focus of {module_title}."}]

    citations: list[dict[str, Any]] = []
    seen_source_ids: set[int] = set()
    for section in section_rows:
        for citation in section.get("citations", []):
            source_id = citation.get("source_id")
            if source_id in seen_source_ids:
                continue
            citations.append(citation)
            if isinstance(source_id, int):
                seen_source_ids.add(source_id)

    return {
        "id": _stable_id("sum", module_id, module_title),
        "title": f"{pacing_label} Summary: {summary_subject}",
        "sectionType": "summary",
        "pageType": "learn",
        "learningObjectives": [],
        "estimatedMinutes": 10,
        "content": [
            {"type": "heading", "title": f"{pacing_label} concepts"},
            *[
                _concept_card_block(
                    str(concept["name"]),
                    str(concept.get("description") or ""),
                    source_section_id=str(concept.get("sourceSectionId") or "") or None,
                )
                for concept in summary_concepts
            ],
        ],
        "citations": citations[:5],
    }
