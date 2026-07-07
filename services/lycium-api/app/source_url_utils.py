from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

TRACKING_PREFIXES = ("utm_", "fbclid", "gclid", "mc_", "ref", "source", "igshid")


def canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    clean_query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if not any(key.lower().startswith(prefix) for prefix in TRACKING_PREFIXES)
    ]
    normalized = parsed._replace(fragment="", query=urlencode(sorted(clean_query), doseq=True))
    return urlunparse(normalized)


def normalized_domain(url: str) -> str:
    parsed = urlparse(url)
    return (parsed.netloc or parsed.path).lower().replace("www.", "")


def infer_source_type(url: str) -> str:
    lowered = url.lower()
    if lowered.endswith(".pdf") or "/pdf" in lowered:
        return "pdf"
    if any(host in lowered for host in ("youtube.com", "youtu.be", "vimeo.com")):
        return "video"
    if any(token in lowered for token in ("syllabus", "course-outline")):
        return "syllabus"
    if any(token in lowered for token in ("catalog", ".edu/courses", "/courses/")):
        return "catalog"
    if any(token in lowered for token in ("docs.", "/docs/", "documentation")):
        return "docs"
    if any(token in lowered for token in ("arxiv.org", "doi.org", "pubmed", "journal")):
        return "paper"
    if any(token in lowered for token in ("openstax.org/details/books", "bookshelves")):
        return "book"
    return "web"
