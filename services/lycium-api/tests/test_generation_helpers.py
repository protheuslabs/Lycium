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
        (
            "Create a macroeconomics principles course covering economic measurement, gross domestic product, inflation, unemployment, aggregate demand, and monetary policy.",
            "Macroeconomics Principles Course",
        ),
        ("Create a course about public speaking and communication", "Public Speaking And Communication Course"),
        (
            "Create an undergraduate course based on the attached Machine Learning Systems PDF. Focus on architecture, data, training, and deployment.",
            "Machine Learning Systems",
        ),
    ],
)
def test_title_from_prompt_removes_commands_and_workflow_state(prompt: str, expected: str) -> None:
    assert _title_from_prompt(prompt) == expected
