from __future__ import annotations

import pytest

from app.source_url_utils import canonicalize_url, infer_source_type, normalized_domain


def test_canonicalize_url_removes_tracking_and_sorts_remaining_query() -> None:
    url = "https://Example.edu/course?utm_source=newsletter&b=2&ref=home&a=1#overview"

    assert canonicalize_url(url) == "https://Example.edu/course?a=1&b=2"


def test_normalized_domain_removes_www_and_normalizes_case() -> None:
    assert normalized_domain("https://WWW.Example.edu/course") == "example.edu"


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://example.edu/handout.pdf", "pdf"),
        ("https://youtube.com/watch?v=123", "video"),
        ("https://example.edu/course-syllabus", "syllabus"),
        ("https://example.edu/catalog/chemistry", "catalog"),
        ("https://docs.python.org/3/", "docs"),
        ("https://arxiv.org/abs/1234", "paper"),
        ("https://openstax.org/details/books/chemistry", "book"),
        ("https://example.org/article", "web"),
    ],
)
def test_infer_source_type(url: str, expected: str) -> None:
    assert infer_source_type(url) == expected
