from __future__ import annotations

from app.agent_model_records import normalize_model_records


def test_normalize_model_records_accepts_provider_shapes_and_deduplicates() -> None:
    models = [
        " model-a ",
        {"name": "model-b", "display_name": "Model B"},
        {"id": "model-a", "label": "Duplicate"},
        {"displayName": "Missing id"},
        None,
    ]

    assert normalize_model_records(models) == [
        {"id": "model-a", "label": "model-a"},
        {"id": "model-b", "label": "Model B"},
    ]


def test_normalize_model_records_keeps_selected_model_available() -> None:
    assert normalize_model_records([{"id": "model-a"}], "model-b") == [
        {"id": "model-b", "label": "model-b"},
        {"id": "model-a", "label": "model-a"},
    ]
