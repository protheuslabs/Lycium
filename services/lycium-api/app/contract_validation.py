from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, RefResolver


REPO_ROOT = Path(__file__).resolve().parents[3]
CONTRACT_SCHEMA_DIR = REPO_ROOT / "packages" / "contracts" / "schemas"
COURSE_SCHEMA_PATH = CONTRACT_SCHEMA_DIR / "lycium-course.schema.json"
SOURCE_RECORD_SCHEMA_PATH = CONTRACT_SCHEMA_DIR / "lycium-source-record.schema.json"


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def course_contract_validator() -> Draft202012Validator:
    course_schema = _load_json(COURSE_SCHEMA_PATH)
    source_record_schema = _load_json(SOURCE_RECORD_SCHEMA_PATH)
    resolver = RefResolver.from_schema(
        course_schema,
        store={
            source_record_schema.get("$id", "lycium-source-record.schema.json"): source_record_schema,
            "lycium-source-record.schema.json": source_record_schema,
        },
    )
    return Draft202012Validator(course_schema, resolver=resolver)


def validate_course_schema(course: dict[str, Any]) -> list[str]:
    validator = course_contract_validator()
    errors: list[str] = []

    for error in sorted(validator.iter_errors(course), key=lambda item: list(item.path)):
        location = ".".join(str(part) for part in error.path) or "course"
        errors.append(f"{location}: {error.message}")

    return errors
