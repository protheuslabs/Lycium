"""Renderer-backed format guidance shared by generation prompts."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

FORMAT_CATALOG_PATH = Path(__file__).resolve().parents[3] / "packages/contracts/course-content-formats.json"
FormatText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ContentFormat(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: FormatText
    label: FormatText
    workflows: list[FormatText] = Field(min_length=1)
    useWhen: list[FormatText] = Field(min_length=1)
    avoidWhen: list[FormatText] = Field(min_length=1)
    requirements: list[FormatText] = Field(min_length=1)
    example: dict[str, Any]

    @model_validator(mode="after")
    def matching_example(self) -> ContentFormat:
        if self.example.get("type") != self.type:
            raise ValueError("A format example must use its declared type.")
        return self


class ContentFormatCatalog(BaseModel):
    model_config = ConfigDict(extra="forbid")

    formats: list[ContentFormat] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_types(self) -> ContentFormatCatalog:
        types = [item.type for item in self.formats]
        if len(types) != len(set(types)):
            raise ValueError("Content format types must be unique.")
        return self


def available_content_formats(workflow: str | None = None) -> list[dict[str, Any]]:
    catalog = ContentFormatCatalog.model_validate_json(FORMAT_CATALOG_PATH.read_text(encoding="utf-8"))
    formats = [item.model_dump() for item in catalog.formats if workflow is None or workflow in item.workflows]
    if not formats:
        raise ValueError(f"No content formats are configured for workflow {workflow!r}.")
    return formats
