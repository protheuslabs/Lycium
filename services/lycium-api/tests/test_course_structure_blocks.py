from __future__ import annotations

from app.course_structure import block_text


def test_worked_example_block_text_includes_nested_math_fields() -> None:
    text = block_text(
        {
            "type": "workedExample",
            "title": "Worked example: resultant force",
            "problem": "Find the resultant of two perpendicular forces.",
            "given": ["F_x = 3 N", "F_y = 4 N"],
            "find": ["Magnitude R"],
            "steps": [
                {
                    "explanation": "Use the Pythagorean relationship.",
                    "equation": "R = sqrt(F_x^2 + F_y^2)",
                },
                {
                    "explanation": "Substitute the known values.",
                    "equations": ["R = sqrt(3^2 + 4^2)", "R = 5 N"],
                },
            ],
            "workedAnswer": "R = 5 N",
            "check": "The magnitude is larger than either component.",
        }
    )

    assert "Find the resultant" in text
    assert "F_x = 3 N" in text
    assert "R = sqrt(F_x^2 + F_y^2)" in text
    assert "R = 5 N" in text
    assert "larger than either component" in text


def test_equation_block_text_includes_standalone_equation_fields() -> None:
    text = block_text(
        {
            "type": "equation",
            "title": "Newton's second law",
            "equations": ["F_net = m a", "a = F_net / m"],
            "caption": "Use consistent SI units before solving.",
            "notation": "ascii",
        }
    )

    assert "Newton's second law" in text
    assert "F_net = m a" in text
    assert "a = F_net / m" in text
    assert "consistent SI units" in text
