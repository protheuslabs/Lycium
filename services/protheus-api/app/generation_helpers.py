from __future__ import annotations

import hashlib
import re
from typing import Any


COURSE_GENERATION_RULES = (
    "Quizzes are assessment-only sections. Do not mix instructional content and quiz content "
    "inside the same generated section. Use pageType='learn' for instructional pages and "
    "pageType='apply' for assessment or practice pages. End every learn page with a conceptCards "
    "block that identifies concepts introduced on the page. Each concept object must include "
    "a raw name and a concise description. Module summaries must be learn pages with a conceptCards "
    "block titled according to the course pacing label, such as 'Module concepts' or 'Week concepts', "
    "that aggregates concept objects from the module or week learn pages. Choose exactly one learner-facing "
    "pacing label, 'Module' or 'Week', record it in metadata.pacingLabel, and do not mix the two labels "
    "in module titles, summary titles, or summary concept-card titles. "
    "Do not use interpretive prose categories as concept cards. Quiz blocks may include maxAttempts "
    "and timeLimitSeconds; omitted or blank values mean unlimited. showAnswers defaults to false, "
    "but answers are shown after submission on the final allowed attempt."
)


def _stable_id(prefix: str, *parts: str) -> str:
    seed = "::".join(parts)
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}-{digest}"


def _title_from_prompt(prompt: str) -> str:
    cleaned = re.sub(r"\s+", " ", prompt).strip()
    if len(cleaned) <= 64:
        return cleaned.title()
    return f"{cleaned[:61].strip().title()}..."


def _extract_goals(prompt: str, explicit_goals: list[str], tokens: list[str]) -> list[str]:
    if explicit_goals:
        return explicit_goals[:8]
    if not tokens:
        return ["Understand the topic fundamentals"]
    unique = list(dict.fromkeys(tokens))
    return [f"Understand {token}" for token in unique[:6]]


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
    return {
        "type": "quiz",
        "question": f"Which concept is most central to: {section_title}?",
        "options": [answer, distractor_1, distractor_2],
        "answer": 0,
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
            if block.get("type") != "conceptCards":
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
        "content": [{"type": "conceptCards", "title": f"{pacing_label} concepts", "concepts": summary_concepts}],
        "citations": citations[:5],
    }
