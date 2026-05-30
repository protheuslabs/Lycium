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


def baseline_trust(url: str) -> float:
    domain = normalized_domain(url)
    if domain.endswith(".edu") or "ocw.mit.edu" in domain:
        return 0.82
    if any(host in domain for host in ("openstax.org", "khanacademy.org", "libretexts.org")):
        return 0.78
    if any(host in domain for host in ("docs.python.org", "developer.mozilla.org", "react.dev")):
        return 0.74
    if any(host in domain for host in ("wikipedia.org", "gutenberg.org")):
        return 0.58
    return 0.4
