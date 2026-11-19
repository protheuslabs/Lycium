from __future__ import annotations

import json

import pytest

from app import course_content_formats
from app.course_agent_assessment_prompting import _staged_quiz_messages, _staged_summary_messages
from app.course_agent_lesson_prompting import _staged_lesson_messages, _staged_media_messages
from app.course_content_formats import available_content_formats


def _lesson_formats() -> tuple[list[dict], dict]:
    messages = _staged_lesson_messages(
        plan={"title": "An Introductory Course"},
        module_outline={"title": "A Module"},
        module_number=1,
        lesson_number=1,
        lesson_title="A Lesson",
        available_source_ids=[],
    )
    catalog_text = messages[0]["content"].split("\n\nAvailable content formats:\n", 1)[1]
    formats, _ = json.JSONDecoder().raw_decode(catalog_text)
    return formats, json.loads(messages[1]["content"])


def test_lesson_receives_catalog_guidance_without_a_fixed_block_recipe() -> None:
    formats, request = _lesson_formats()
    assert formats == available_content_formats("section_fill")
    assert {"quiz", "project"}.isdisjoint(item["type"] for item in formats)
    assert "optional_quantitative_or_procedural_blocks" not in request
    assert request["required_shape"]["content"] == []
    assert "not an ordered lesson template" in request["content_rule"]
    assert all(item["useWhen"] and item["avoidWhen"] and item["requirements"] for item in formats)


@pytest.mark.parametrize(
    ("workflow", "types"),
    [
        ("module_quiz_assessment", {"quiz"}),
        ("module_project_assessment", {"project"}),
        ("module_summary_section", {"heading", "conceptCard"}),
        ("media", {"video"}),
    ],
)
def test_available_formats_are_scoped_to_workflow(workflow, types) -> None:
    assert {item["type"] for item in available_content_formats(workflow)} == types


@pytest.mark.parametrize(
    ("builder", "workflow"),
    [
        (_staged_quiz_messages, "module_quiz_assessment"),
        (_staged_summary_messages, "module_summary_section"),
        (_staged_media_messages, "media"),
    ],
)
def test_other_active_writers_receive_only_their_formats(builder, workflow) -> None:
    messages = builder(
        plan={"title": "A Course"}, module_outline={"title": "A Module"},
        module_number=1, lesson_sections=[], available_source_ids=[],
    )
    catalog_text = messages[0]["content"].split("\n\nAvailable content formats:\n", 1)[1]
    formats, _ = json.JSONDecoder().raw_decode(catalog_text)
    assert formats == available_content_formats(workflow)


def test_catalog_changes_reach_prompt_without_prompt_edits_or_stale_cache(tmp_path, monkeypatch) -> None:
    formats = available_content_formats()
    added = {
        **formats[0],
        "type": "newDemonstration",
        "example": {"type": "newDemonstration", "value": "A demonstration."},
        "useWhen": ["Use the newly implemented demonstration format."],
    }
    document = {"formats": [*formats, added]}
    path = tmp_path / "formats.json"
    path.write_text(json.dumps(document), encoding="utf-8")
    monkeypatch.setattr(course_content_formats, "FORMAT_CATALOG_PATH", path)

    first, _ = _lesson_formats()
    assert first[-1] == added
    added["useWhen"] = ["Updated use case from the catalog."]
    path.write_text(json.dumps(document), encoding="utf-8")
    second, _ = _lesson_formats()
    assert second[-1]["useWhen"] == added["useWhen"]
    assert first[-1]["useWhen"] != second[-1]["useWhen"]


@pytest.mark.parametrize("invalid", ["duplicate", "example"])
def test_invalid_catalog_fails_before_model_call(tmp_path, monkeypatch, invalid) -> None:
    formats = available_content_formats()
    if invalid == "duplicate":
        formats.append(formats[0])
    else:
        formats[0]["example"]["type"] = "mismatch"
    path = tmp_path / "formats.json"
    path.write_text(json.dumps({"formats": formats}), encoding="utf-8")
    monkeypatch.setattr(course_content_formats, "FORMAT_CATALOG_PATH", path)

    with pytest.raises(ValueError):
        _lesson_formats()


def test_unknown_format_workflow_does_not_silently_advertise_every_format() -> None:
    with pytest.raises(ValueError, match="No content formats"):
        available_content_formats("unknown")
