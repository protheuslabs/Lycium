from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import SETTINGS
from app.models import Claim, GraphEdge, KnowledgeObject, Snapshot, Source
from app.scoring import accessibility_score, baseline_trust, combine_scores, freshness_score, pedagogy_score

TRACKING_PREFIXES = (
    "utm_",
    "fbclid",
    "gclid",
    "mc_",
    "ref",
    "source",
    "igshid",
)

CLAIM_PATTERN = re.compile(r"[^.?!]+(?:is|are|can|must|should|does) [^.?!]+[.?!]", re.IGNORECASE)


@dataclass
class IngestionResult:
    source_id: int
    snapshot_id: int
    topic: str
    new_snapshot: bool
    knowledge_objects_created: int


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    clean_query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if not any(key.lower().startswith(prefix) for prefix in TRACKING_PREFIXES)
    ]
    normalized = parsed._replace(fragment="", query=urlencode(sorted(clean_query), doseq=True))
    return urlunparse(normalized)


def fetch_url(url: str) -> tuple[str, str]:
    headers = {"User-Agent": SETTINGS.user_agent}
    with httpx.Client(timeout=20.0, follow_redirects=True, headers=headers) as client:
        response = client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        return response.text, content_type


def extract_title_and_text(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.string.strip() if soup.title and soup.title.string else "Untitled Source")

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    text = "\n".join(chunk.strip() for chunk in soup.get_text(separator="\n").splitlines() if chunk.strip())
    return title, text


def extract_publish_year(text: str) -> int | None:
    candidates = re.findall(r"\b(19\d{2}|20\d{2})\b", text[:2500])
    if not candidates:
        return None
    value = int(candidates[-1])
    if 1950 <= value <= datetime.now(UTC).year + 1:
        return value
    return None


def infer_topic(title: str, text: str) -> str:
    title_tokens = [token for token in re.split(r"[^a-zA-Z0-9]+", title.lower()) if token]
    if title_tokens:
        return " ".join(title_tokens[:4]).title()

    words = [token for token in re.split(r"[^a-zA-Z0-9]+", text.lower()) if len(token) > 3]
    return " ".join(words[:4]).title() if words else "General Knowledge"


def infer_difficulty(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ("beginner", "introduction", "fundamentals", "getting started")):
        return "beginner"
    if any(token in lowered for token in ("advanced", "optimization", "research", "theorem")):
        return "advanced"
    return "intermediate"


def infer_object_type(chunk: str, content_type: str, url: str) -> tuple[str, str]:
    lowered = chunk.lower()
    if "quiz" in lowered or "question" in lowered:
        return "assessment", "quiz"
    if "exercise" in lowered or "practice" in lowered:
        return "practice", "lab"
    if "project" in lowered or "build" in lowered:
        return "project", "project"
    if "video" in content_type or any(host in url for host in ("youtube.com", "youtu.be", "vimeo.com")):
        return "lecture", "video"
    if any(token in lowered for token in ("dataset", "csv", "json data")):
        return "dataset", "dataset"
    if any(token in lowered for token in ("paper", "research", "study", "journal")):
        return "reference", "paper"
    if url.endswith(".pdf"):
        return "reference", "text"
    return "explanation", "text"


def chunk_text(text: str, max_chars: int = 800) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 1 <= max_chars:
            current = f"{current}\n{paragraph}".strip()
            continue

        if current:
            chunks.append(current)
        current = paragraph

    if current:
        chunks.append(current)

    return chunks[:12]


def enforce_reuse_policy(text: str, is_free: bool, license: str) -> str:
    if is_free or license.lower() in {"cc-by", "cc-by-sa", "mit", "apache-2.0", "public-domain"}:
        return text
    words = text.split()
    excerpt = " ".join(words[:140])
    return f"{excerpt} ... (excerpt-limited due to source licensing policy)"


def extract_claims(chunk: str, confidence: float) -> list[dict[str, Any]]:
    claims = [match.group(0).strip() for match in CLAIM_PATTERN.finditer(chunk)]
    return [
        {
            "claim_text": claim,
            "claim_type": "statement",
            "confidence_score": confidence,
            "supporting_objects": [],
            "conflicting_objects": [],
        }
        for claim in claims[:3]
    ]


def ingest_source(
    session: Session,
    *,
    url: str,
    source_type: str,
    license: str,
    is_free: bool,
    author: str | None,
    publisher: str | None,
    archive_requested: bool,
) -> IngestionResult:
    canonical_url = canonicalize_url(url)
    parsed = urlparse(canonical_url)
    normalized_domain = parsed.netloc.lower().replace("www.", "")

    html, content_type = fetch_url(canonical_url)
    title, text = extract_title_and_text(html)
    text = enforce_reuse_policy(text, is_free=is_free, license=license)
    topic = infer_topic(title, text)
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    publish_year = extract_publish_year(text)

    source = session.scalar(select(Source).where(Source.canonical_url == canonical_url))
    if source is None:
        source = Source(
            canonical_url=canonical_url,
            normalized_domain=normalized_domain,
            title=title,
            author=author,
            publisher=publisher,
            source_type=source_type,
            license=license,
            is_free=is_free,
            trust_baseline=baseline_trust(canonical_url),
            archive_links=[f"https://web.archive.org/web/*/{canonical_url}"] if archive_requested else [],
            last_verified_at=datetime.now(UTC),
        )
        session.add(source)
        session.flush()
    else:
        source.title = title
        source.author = author or source.author
        source.publisher = publisher or source.publisher
        source.source_type = source_type
        source.license = license
        source.is_free = is_free
        source.last_verified_at = datetime.now(UTC)
        if archive_requested and f"https://web.archive.org/web/*/{canonical_url}" not in source.archive_links:
            source.archive_links.append(f"https://web.archive.org/web/*/{canonical_url}")

    latest_snapshot = session.scalar(
        select(Snapshot)
        .where(Snapshot.source_id == source.id)
        .order_by(Snapshot.fetched_at.desc())
        .limit(1)
    )
    if latest_snapshot and latest_snapshot.content_hash == content_hash:
        return IngestionResult(
            source_id=source.id,
            snapshot_id=latest_snapshot.id,
            topic=topic,
            new_snapshot=False,
            knowledge_objects_created=0,
        )

    snapshot = Snapshot(
        source_id=source.id,
        content_hash=content_hash,
        extraction_status="processed",
        raw_text=text,
        cleaned_text=text,
        artifact_metadata={
            "content_type": content_type,
            "title": title,
            "word_count": len(text.split()),
            "publish_year": publish_year,
        },
    )
    session.add(snapshot)
    session.flush()

    chunks = chunk_text(text)
    created_objects = 0
    object_ids: list[int] = []

    for index, chunk in enumerate(chunks, start=1):
        pedagogical = pedagogy_score(chunk)
        accessibility = accessibility_score(chunk)
        freshness = freshness_score(snapshot.fetched_at)
        corroboration = 0.5
        trust = combine_scores(source.trust_baseline, freshness, pedagogical, accessibility, corroboration)
        object_type, modality = infer_object_type(chunk, content_type, canonical_url)

        knowledge_object = KnowledgeObject(
            source_id=source.id,
            snapshot_id=snapshot.id,
            title=f"{title} - Segment {index}",
            object_type=object_type,
            modality=modality,
            topic=topic,
            difficulty=infer_difficulty(chunk),
            audience="general",
            language="en",
            estimated_minutes=max(4, min(20, len(chunk.split()) // 45 + 4)),
            content=chunk,
            prerequisites=[],
            learning_outcomes=[f"Understand key concept from segment {index}"],
            trust_score=trust,
            freshness_score=freshness,
            pedagogy_score=pedagogical,
            accessibility_score=accessibility,
            corroboration_score=corroboration,
            object_metadata={
                "source_url": canonical_url,
                "sequence": index,
                "publish_year": publish_year,
            },
        )
        session.add(knowledge_object)
        session.flush()
        object_ids.append(knowledge_object.id)
        created_objects += 1

        for claim_data in extract_claims(chunk, trust):
            session.add(Claim(knowledge_object_id=knowledge_object.id, **claim_data))

    for idx in range(len(object_ids) - 1):
        session.add(
            GraphEdge(
                from_object_id=object_ids[idx],
                to_object_id=object_ids[idx + 1],
                edge_type="explains",
                weight=0.7,
            )
        )

    return IngestionResult(
        source_id=source.id,
        snapshot_id=snapshot.id,
        topic=topic,
        new_snapshot=True,
        knowledge_objects_created=created_objects,
    )
