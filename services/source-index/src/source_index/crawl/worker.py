from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from source_index.config import SETTINGS
from source_index.crawl.contracts import (
    CrawlTask,
    CrawlWorkerResult,
    DiscoveredLink,
    ExtractionResult,
    FetchResult,
    PageClassification,
)
from source_index.crawl.policies import normalize_policy_payload, should_visit_url


def run_crawl_task(task: CrawlTask) -> CrawlWorkerResult:
    policy = normalize_policy_payload(task.policy)
    accepted_by_policy, rejection_reason = should_visit_url(task.url, policy)
    if not accepted_by_policy:
        return _rejected_result(task, rejection_reason)

    fetch = _fetch(task.url)
    if fetch.error:
        return CrawlWorkerResult(
            crawl_run_id=task.crawl_run_id,
            policy_id=task.policy_id,
            task=task,
            fetch=fetch,
            accepted=False,
            rejection_reason="fetch_failed",
        )

    raw_text = fetch.raw_storage_ref or ""
    title, extracted_text, discovered_links = _extract_page(raw_text, task.url, task.depth, policy)
    extraction = ExtractionResult(
        title=title,
        extracted_text=extracted_text,
        text_digest=extracted_text[:1200],
        metadata={"extraction_method": "beautifulsoup-html-v1"},
    )
    classification = _classify(task.url, title, extracted_text, policy)
    accepted = classification.label in policy["classifiers"] and classification.confidence >= 0.35

    return CrawlWorkerResult(
        crawl_run_id=task.crawl_run_id,
        policy_id=task.policy_id,
        task=task,
        fetch=fetch.model_copy(update={"raw_storage_ref": None}),
        extraction=extraction,
        classification=classification,
        discovered_links=discovered_links,
        accepted=accepted,
        rejection_reason=None if accepted else "classification_below_policy_threshold",
    )


def run_cli(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run one source-index crawl-task-v1 payload.")
    parser.add_argument("task_json", nargs="?", help="Path to a crawl-task-v1 JSON file. Reads stdin when omitted.")
    args = parser.parse_args(argv)

    if args.task_json:
        with open(args.task_json, "r", encoding="utf-8") as file:
            payload = file.read()
    else:
        payload = sys.stdin.read()

    task = CrawlTask.model_validate_json(payload)
    result = run_crawl_task(task)
    sys.stdout.write(json.dumps(result.model_dump(mode="json"), indent=2))
    sys.stdout.write("\n")


def _rejected_result(task: CrawlTask, reason: str) -> CrawlWorkerResult:
    return CrawlWorkerResult(
        crawl_run_id=task.crawl_run_id,
        policy_id=task.policy_id,
        task=task,
        fetch=FetchResult(url=task.url, error=reason),
        accepted=False,
        rejection_reason=reason,
    )


def _fetch(url: str) -> FetchResult:
    try:
        response = httpx.get(
            url,
            follow_redirects=True,
            timeout=20.0,
            headers={"User-Agent": SETTINGS.user_agent},
        )
        raw_text = response.text
        return FetchResult(
            url=url,
            final_url=str(response.url),
            status_code=response.status_code,
            content_type=response.headers.get("content-type"),
            content_hash=hashlib.sha256(response.content).hexdigest(),
            raw_storage_ref=raw_text,
            fetched_at=datetime.now(UTC).isoformat(),
            error=None if response.is_success else f"http_status_{response.status_code}",
        )
    except httpx.HTTPError as exc:
        return FetchResult(url=url, error=str(exc), fetched_at=datetime.now(UTC).isoformat())


def _extract_page(raw_text: str, base_url: str, depth: int, policy: dict[str, Any]) -> tuple[str | None, str, list[DiscoveredLink]]:
    content_hint = raw_text[:1000].lower()
    if "<html" not in content_hint and "<body" not in content_hint:
        return None, _normalize_text(raw_text), []

    soup = BeautifulSoup(raw_text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    title = None
    if soup.title and soup.title.string:
        title = _normalize_text(soup.title.string)

    max_depth = int(policy.get("max_depth") or 0)
    links: list[DiscoveredLink] = []
    if depth < max_depth:
        for anchor in soup.find_all("a", href=True):
            href = str(anchor.get("href") or "").strip()
            if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
                continue
            resolved = _normalize_url(urljoin(base_url, href))
            accepted, reason = should_visit_url(resolved, policy)
            if accepted:
                links.append(
                    DiscoveredLink(
                        url=resolved,
                        depth=depth + 1,
                        anchor_text=_normalize_text(anchor.get_text(" ")) or None,
                        reason=reason,
                    )
                )

    return title, _normalize_text(soup.get_text(" ")), _dedupe_links(links)


def _classify(url: str, title: str | None, extracted_text: str, policy: dict[str, Any]) -> PageClassification:
    haystack = f"{url} {title or ''} {extracted_text[:5000]}".lower()
    candidates = [
        ("syllabus", ["syllabus", "syllabi", "course schedule", "grading policy"]),
        ("course_catalog", ["course catalog", "catalog", "course description", "credits", "prerequisite"]),
        ("program_requirement", ["degree requirement", "program requirement", "required courses", "electives"]),
        ("department_page", ["department", "faculty", "chair", "undergraduate program"]),
        ("degree_plan", ["degree plan", "four-year plan", "major requirements", "curriculum map"]),
        ("learning_material", ["lecture", "notes", "textbook", "assignment", "problem set"]),
    ]
    allowed = set(policy["classifiers"])
    best_label = "unknown"
    best_score = 0.0
    best_evidence: list[str] = []

    for label, terms in candidates:
        if allowed and label not in allowed:
            continue
        evidence = [term for term in terms if term in haystack]
        score = min(1.0, 0.25 + (0.22 * len(evidence))) if evidence else 0.0
        if score > best_score:
            best_label = label
            best_score = score
            best_evidence = evidence

    return PageClassification(label=best_label, confidence=round(best_score, 3), evidence=best_evidence[:5])


def _dedupe_links(links: list[DiscoveredLink]) -> list[DiscoveredLink]:
    seen: set[str] = set()
    deduped: list[DiscoveredLink] = []
    for link in links:
        if link.url in seen:
            continue
        seen.add(link.url)
        deduped.append(link)
    return deduped


def _normalize_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed._replace(fragment="").geturl()


def _normalize_text(value: str) -> str:
    return " ".join(value.split())


if __name__ == "__main__":
    run_cli()
