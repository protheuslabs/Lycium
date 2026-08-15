from __future__ import annotations

from typing import Any


WORKED_EXAMPLE_POSITIVE_TERMS = {
    "accounting",
    "algorithm",
    "algebra",
    "analytics",
    "balance",
    "budget",
    "calculate",
    "calculation",
    "calculus",
    "chemistry",
    "code",
    "conversion",
    "debug",
    "derive",
    "data cleaning",
    "database",
    "dimensional analysis",
    "equation",
    "equilibrium",
    "force",
    "formula",
    "function",
    "geometry",
    "graph",
    "hybridization",
    "matrix",
    "molarity",
    "physics",
    "probability",
    "programming",
    "proof",
    "python",
    "query",
    "regression",
    "solve",
    "sql",
    "statistics",
    "statics",
    "stoichiometry",
    "technical",
    "trigonometry",
    "unit conversion",
    "vector",
    "workflow",
}

WORKED_EXAMPLE_HUMANITIES_TERMS = {
    "abolition",
    "civics",
    "civil war",
    "colonial",
    "constitution",
    "culture",
    "ethics",
    "fugitive slave act",
    "history",
    "historical",
    "literary",
    "literature",
    "philosophy",
    "primary source",
    "rhetoric",
    "slavery",
}


def _flatten_text(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [text for child in value.values() for text in _flatten_text(child)]
    if isinstance(value, list):
        return [text for child in value for text in _flatten_text(child)]
    return []


def supports_worked_example(*values: Any) -> bool:
    text = " ".join(_flatten_text(list(values))).lower()
    if not text:
        return False

    has_positive_signal = any(term in text for term in WORKED_EXAMPLE_POSITIVE_TERMS)
    if has_positive_signal:
        return True

    if any(term in text for term in WORKED_EXAMPLE_HUMANITIES_TERMS):
        return False

    return False
