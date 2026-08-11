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
            "Create a CHEM 105 general chemistry course for first-year college students.",
            "Chem 105 General Chemistry Course",
        ),
    ],
)
def test_title_from_prompt_removes_commands_and_workflow_state(prompt: str, expected: str) -> None:
    assert _title_from_prompt(prompt) == expected
