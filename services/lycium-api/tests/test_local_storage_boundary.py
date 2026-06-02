from __future__ import annotations


def test_local_storage_status_export_and_backup(client) -> None:
    status_response = client.get("/v1/local/storage")
    assert status_response.status_code == 200, status_response.text
    status = status_response.json()
    assert status["schema_version"] == status["target_schema_version"]
    assert {directory["name"] for directory in status["directories"]} >= {
        "courses",
        "completion",
        "generation-runs",
        "links",
        "secrets",
        "user",
        "backups",
    }
    assert status["json_error_count"] == 0

    export_response = client.get("/v1/local/export")
    assert export_response.status_code == 200, export_response.text
    local_export = export_response.json()
    assert local_export["format"] == "lycium-local-data-export-v1"
    assert local_export["include_secrets"] is False
    assert all(not file["path"].startswith("secrets/") for file in local_export["files"])
    assert any(file["path"] == "manifest.json" for file in local_export["files"])

    backup_response = client.post("/v1/local/backups")
    assert backup_response.status_code == 200, backup_response.text
    backup = backup_response.json()
    assert backup["path"].endswith(".json")
    assert backup["include_secrets"] is False
    assert backup["file_count"] >= 1
    assert backup["byte_count"] > 0
