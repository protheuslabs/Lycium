from __future__ import annotations

from copy import deepcopy
from typing import Any
from urllib.parse import urlparse

DEFAULT_EDUCATION_INSTITUTION_POLICY: dict[str, Any] = {
    "name": "education-institution-crawl-v1",
    "description": "General crawler policy tuned toward institutional curriculum evidence.",
    "seed_domains": [],
    "allowed_path_hints": [
        "academic",
        "academics",
        "catalog",
        "course",
        "courses",
        "curriculum",
        "degree",
        "department",
        "program",
        "requirements",
        "syllabus",
        "syllabi",
    ],
    "denied_path_hints": [
        "alumni",
        "athletics",
        "donate",
        "events",
        "giving",
        "jobs",
        "news",
        "press",
    ],
    "accepted_content_types": ["text/html", "application/pdf", "text/plain"],
    "max_depth": 3,
    "max_pages_per_domain": 250,
    "rate_limit_per_domain_seconds": 2.0,
    "respect_robots_txt": True,
    "classifiers": [
        "course_catalog",
        "syllabus",
        "program_requirement",
        "department_page",
        "degree_plan",
        "learning_material",
    ],
}

DEFAULT_CRAWL_POLICY_TEMPLATES: dict[str, dict[str, Any]] = {
    DEFAULT_EDUCATION_INSTITUTION_POLICY["name"]: DEFAULT_EDUCATION_INSTITUTION_POLICY,
}


def default_policy_payload(template_name: str = "education-institution-crawl-v1") -> dict[str, Any]:
    template = DEFAULT_CRAWL_POLICY_TEMPLATES.get(template_name)
    if template is None:
        raise KeyError(f"Unknown crawl policy template: {template_name}")
    return deepcopy(template)


def normalize_policy_payload(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    normalized = default_policy_payload()
    if payload:
        normalized.update(payload)

    normalized["seed_domains"] = _normalize_string_list(normalized.get("seed_domains"))
    normalized["allowed_path_hints"] = _normalize_string_list(normalized.get("allowed_path_hints"))
    normalized["denied_path_hints"] = _normalize_string_list(normalized.get("denied_path_hints"))
    normalized["accepted_content_types"] = _normalize_string_list(normalized.get("accepted_content_types"))
    normalized["classifiers"] = _normalize_string_list(normalized.get("classifiers"))
    normalized["max_depth"] = max(0, int(normalized.get("max_depth") or 0))
    normalized["max_pages_per_domain"] = max(1, int(normalized.get("max_pages_per_domain") or 1))
    normalized["rate_limit_per_domain_seconds"] = max(0.0, float(normalized.get("rate_limit_per_domain_seconds") or 0.0))
    normalized["respect_robots_txt"] = bool(normalized.get("respect_robots_txt", True))
    return normalized


def should_visit_url(url: str, policy: dict[str, Any]) -> tuple[bool, str]:
    normalized_policy = normalize_policy_payload(policy)
    parsed = urlparse(url)
    domain = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.lower()

    seed_domains = normalized_policy["seed_domains"]
    if seed_domains and domain not in seed_domains:
        return False, "outside_seed_domains"

    for hint in normalized_policy["denied_path_hints"]:
        if hint and hint in path:
            return False, "denied_path_hint"

    allowed_hints = normalized_policy["allowed_path_hints"]
    if allowed_hints and not any(hint in path for hint in allowed_hints):
        return False, "missing_allowed_path_hint"

    return True, "accepted_by_policy"


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return sorted({str(item).strip().lower() for item in value if str(item).strip()})
