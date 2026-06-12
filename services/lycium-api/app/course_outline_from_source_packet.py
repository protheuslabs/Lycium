from __future__ import annotations

import re
from collections import Counter
from typing import Any

SOURCE_PACKET_OUTLINE_CONTRACT_VERSION = "course-outline-from-source-packet-v1"
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
    "edu",
    "example",
    "exercise",
    "exercises",
    "fallacies",
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
    "purpose",
    "section",
    "sections",
    "self",
    "self-check",
    "source",
    "sources",
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


def build_outline_from_source_packet(
    *,
    prompt: str,
    source_packet: dict[str, Any] | None,
    desired_module_count: int = 4,
    sections_per_module: int = 2,
) -> dict[str, Any]:
    module_count = max(1, min(20, desired_module_count))
    section_count = max(2, min(6, sections_per_module))
    terms = _candidate_terms(prompt, source_packet, module_count)
    concept_candidates = _candidate_concepts(prompt, source_packet, max(module_count * section_count * 2, module_count))
    concept_chunks = _chunk_concepts(concept_candidates, module_count)
    source_inventory = _source_inventory(source_packet)
    modules: list[dict[str, Any]] = []

    for module_index, term in enumerate(terms, start=1):
        module_concepts = concept_chunks[module_index - 1] if module_index - 1 < len(concept_chunks) else [term]
        module_focus = module_concepts[0] if module_concepts else term
        module_title = f"Module {module_index}: {_title(module_focus)}"
        module_source_ids = _source_ids_for_term(module_focus, source_inventory)
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
        modules.append(
            {
                "id": f"source-packet-m{module_index:02d}",
                "title": module_title,
                "learning_objectives": [
                    f"Use source packet evidence to organize {_title(module_focus).lower()} into teachable lessons."
                ],
                "sections": sections,
                "concept_keywords": module_concepts,
                "sourceIds": module_source_ids,
                "planningSource": "source_packet",
            }
        )

    return {
        "contractVersion": SOURCE_PACKET_OUTLINE_CONTRACT_VERSION,
        "title": _title(prompt),
        "shortDescription": f"Draft outline derived from source packet evidence for: {prompt[:120].strip()}",
        "summary": "This is a planning outline derived from accepted source-packet evidence, not final learner-facing content.",
        "modules": modules,
        "provenance": {
            "mode": "source_packet",
            "sourceDocumentCount": len(_source_documents(source_packet)),
            "sourcePacketContract": source_packet.get("contract_version") if isinstance(source_packet, dict) else None,
            "conceptCandidateCount": len(concept_candidates),
            "conceptCandidates": concept_candidates[:40],
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
