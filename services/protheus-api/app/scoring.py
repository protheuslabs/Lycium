from __future__ import annotations

from datetime import UTC, datetime
from statistics import mean
from urllib.parse import urlparse

TRUSTED_DOMAINS: dict[str, float] = {
    "ocw.mit.edu": 0.93,
    "khanacademy.org": 0.9,
    "coursera.org": 0.86,
    "edx.org": 0.86,
    "open.edu": 0.82,
    "docs.python.org": 0.92,
    "developer.mozilla.org": 0.91,
    "wikipedia.org": 0.75,
    "youtube.com": 0.65,
}


def baseline_trust(url: str) -> float:
    domain = urlparse(url).netloc.lower().replace("www.", "")
    score = TRUSTED_DOMAINS.get(domain, 0.5)
    return clamp(score)


def freshness_score(reference_time: datetime | None = None) -> float:
    now = datetime.now(UTC)
    then = reference_time or now
    age_days = max((now - then).days, 0)

    if age_days <= 30:
        return 0.95
    if age_days <= 180:
        return 0.8
    if age_days <= 365:
        return 0.65
    if age_days <= 730:
        return 0.5
    return 0.35


def pedagogy_score(text: str) -> float:
    lowered = text.lower()
    markers = [
        "example",
        "exercise",
        "practice",
        "step",
        "learn",
        "objective",
        "quiz",
        "project",
    ]
    hits = sum(1 for marker in markers if marker in lowered)
    length_signal = min(len(text) / 3000, 1.0)

    return clamp(0.25 + 0.08 * hits + 0.35 * length_signal)


def accessibility_score(text: str) -> float:
    words = [token for token in text.split() if token.strip()]
    if not words:
        return 0.2

    avg_word_length = mean(len(word) for word in words)
    score = 0.85 if avg_word_length <= 7 else 0.65

    sentence_breaks = text.count(".") + text.count("!") + text.count("?")
    if sentence_breaks < 3:
        score -= 0.1

    return clamp(score)


def combine_scores(
    trust_baseline: float,
    freshness: float,
    pedagogy: float,
    accessibility: float,
    corroboration: float,
) -> float:
    score = (
        trust_baseline * 0.35
        + freshness * 0.2
        + pedagogy * 0.2
        + accessibility * 0.15
        + corroboration * 0.1
    )
    return clamp(score)


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, round(value, 4)))
