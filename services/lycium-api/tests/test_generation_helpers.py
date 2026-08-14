from __future__ import annotations

import pytest

from app.generation_helpers import _title_from_prompt


@pytest.mark.parametrize(
    ("prompt", "expected"),
    [
        ("Lifecycle Needs Sources Course", "Lifecycle Course"),
        ("Create a lifecycle source-gap course", "Lifecycle Course"),
        ("Build an undergraduate materials science course", "Undergraduate Materials Science Course"),
        (
            "Create a macroeconomics principles course for first-year college students.",
            "Macroeconomics Principles Course",
        ),
    ],
)
def test_title_from_prompt_removes_commands_and_workflow_state(prompt: str, expected: str) -> None:
    assert _title_from_prompt(prompt) == expected
