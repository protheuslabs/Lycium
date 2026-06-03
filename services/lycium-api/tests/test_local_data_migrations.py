from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

import pytest

from app.config import SETTINGS
from app.local_store import ensure_local_data_dirs, local_data_migration_status
from app.local_store_core import LocalDataMigrationError, run_local_data_migrations


@pytest.fixture()
def isolated_local_data(tmp_path: Path) -> Iterator[Path]:
    original = SETTINGS.local_data_dir
    local_root = tmp_path / "lycium-local"
    object.__setattr__(SETTINGS, "local_data_dir", local_root)
    try:
        yield local_root
    finally:
        object.__setattr__(SETTINGS, "local_data_dir", original)


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_local_data_migrations_create_versioned_manifest(isolated_local_data: Path) -> None:
    root = ensure_local_data_dirs()
    manifest = _read(root / "manifest.json")
    status = local_data_migration_status()

    assert manifest["schema_version"] == 3
    assert manifest["target_schema_version"] == 3
    assert [row["id"] for row in manifest["migrations"]] == [
        "001_manifest_schema_version",
        "002_agent_key_profiles",
        "003_local_backups_directory",
    ]
    assert status["pending_migrations"] == []
    assert sorted(manifest["directories"]) == ["backups", "completion", "courses", "generation-runs", "links", "secrets", "user"]
    assert (root / "backups").is_dir()
    assert (root / "generation-runs").is_dir()


def test_local_data_migrations_upgrade_schema_two_manifest(isolated_local_data: Path) -> None:
    isolated_local_data.mkdir(parents=True)
    (isolated_local_data / "manifest.json").write_text(
        json.dumps(
            {
                "schema_version": 2,
                "target_schema_version": 2,
                "created_at": "2026-01-01T00:00:00+00:00",
                "migrations": [
                    {"id": "001_manifest_schema_version", "version": 1, "applied_at": "2026-01-01T00:00:00+00:00"},
                    {"id": "002_agent_key_profiles", "version": 2, "applied_at": "2026-01-01T00:00:00+00:00"},
                ],
            }
        ),
        encoding="utf-8",
    )

    status = run_local_data_migrations()
    manifest = _read(isolated_local_data / "manifest.json")

    assert manifest["schema_version"] == 3
    assert manifest["target_schema_version"] == 3
    assert [row["id"] for row in manifest["migrations"]] == [
        "001_manifest_schema_version",
        "002_agent_key_profiles",
        "003_local_backups_directory",
    ]
    assert status["pending_migrations"] == []
    assert (isolated_local_data / "backups").is_dir()
    assert (isolated_local_data / "generation-runs").is_dir()


def test_local_data_migration_normalizes_legacy_agent_secret(isolated_local_data: Path) -> None:
    (isolated_local_data / "secrets").mkdir(parents=True)
    (isolated_local_data / "secrets" / "agent.json").write_text(
        json.dumps({"agent_api_key": "sk-legacy", "model": "gpt-4.1-mini", "updated_at": "2026-01-01T00:00:00+00:00"}),
        encoding="utf-8",
    )

    ensure_local_data_dirs()

    secret = _read(isolated_local_data / "secrets" / "agent.json")
    assert secret["active_agent_key_id"] == "default"
    assert secret["agent_keys"][0]["provider_id"] == "openai"
    assert secret["agent_keys"][0]["agent_api_key"] == "sk-legacy"
    assert secret["agent_keys"][0]["model"] == "gpt-4.1-mini"
    assert secret["agent_keys"][0]["connection_status"] == "verified"


def test_local_data_migration_status_endpoint(client, isolated_local_data: Path) -> None:
    response = client.get("/v1/local/migrations")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["schema_version"] == 3
    assert payload["target_schema_version"] == 3
    assert payload["pending_migrations"] == []


def test_local_data_migration_fails_clearly_for_future_schema(isolated_local_data: Path) -> None:
    isolated_local_data.mkdir(parents=True)
    (isolated_local_data / "manifest.json").write_text(
        json.dumps({"schema_version": 999, "migrations": []}),
        encoding="utf-8",
    )

    status = local_data_migration_status()

    assert status["unsupported_schema_version"] is True
    assert "newer than supported" in status["error"]
    with pytest.raises(LocalDataMigrationError, match="newer than supported"):
        run_local_data_migrations()
