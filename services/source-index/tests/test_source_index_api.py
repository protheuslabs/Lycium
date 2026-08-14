from __future__ import annotations

import json
from pathlib import Path

import httpx

from source_index.crawl.contracts import CrawlTask, CrawlWorkerResult, ExtractionResult, FetchResult, PageClassification
from source_index.crawl.policies import default_policy_payload, should_visit_url
from source_index.crawl.worker import run_crawl_task
from source_index.cli import build_packet_cli, import_packet_cli
from source_index.db import reset_db


def test_health(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "source-index"}


def test_service_contract_declares_independent_boundary(client) -> None:
    response = client.get("/v1/index/service-contract")
    assert response.status_code == 200
    payload = response.json()

    assert payload["contract_version"] == "source-index-service-v1"
    assert payload["service"] == "source-index"
    assert "source-index-build-packet" in payload["cli_commands"]
    assert any(row["path"] == "/v1/index/source-packets" for row in payload["stable_endpoints"])
    assert "web UI behavior" in payload["does_not_own"]


def test_source_upsert_canonicalizes_and_dedupes(client) -> None:
    first = client.post(
        "/v1/index/sources",
        json={
            "url": "https://example.edu/courses/macroeconomics?utm_source=newsletter",
            "title": "Macroeconomics Principles",
            "source_type": "catalog",
        },
    )
    assert first.status_code == 201, first.text

    second = client.post("/v1/index/sources", json={"url": "https://example.edu/courses/macroeconomics"})
    assert second.status_code == 201, second.text

    assert first.json()["id"] == second.json()["id"]
    assert second.json()["canonical_url"] == "https://example.edu/courses/macroeconomics"
    assert len(second.json()["submitted_urls"]) == 2


def test_corpus_run_persists_include_exclude_decisions(client) -> None:
    response = client.post(
        "/v1/index/corpus-runs",
        json={
            "consumer": "lycium",
            "context_id": "test-macro-corpus",
            "prompt": "macroeconomics GDP inflation unemployment monetary policy",
            "fetch_sources": False,
            "source_urls": [
                "https://econ.example.edu/macroeconomics/inflation",
                "https://recipes.example.com/dinner/pasta",
            ],
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()

    assert payload["submitted_source_count"] == 2
    assert payload["included_source_count"] == 1
    assert payload["excluded_source_count"] == 1
    assert {decision["decision"] for decision in payload["decisions"]} == {"included", "excluded"}

    sources = client.get("/v1/index/sources")
    assert sources.status_code == 200, sources.text
    assert len(sources.json()) == 2

    fetched = client.get(f"/v1/index/corpus-runs/{payload['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["context_id"] == "test-macro-corpus"


def test_source_packet_builds_generation_ready_evidence_from_documents(client) -> None:
    response = client.post(
        "/v1/index/source-packets",
        json={
            "consumer": "lycium-course-generation",
            "context_id": "packet-macroeconomics",
            "prompt": "macroeconomics GDP inflation unemployment monetary policy",
            "fetch_sources": False,
            "source_urls": [
                "https://econ.example.edu/macroeconomics/inflation",
                "https://recipes.example.com/dinner/pasta",
            ],
            "source_documents": [
                {
                    "url": "https://econ.example.edu/macroeconomics/inflation",
                    "contentType": "text/html",
                    "text": """
                        <html>
                            <body>
                                <h1>Macroeconomics Principles</h1>
                                <p>GDP, inflation, unemployment, price indexes, monetary policy, and macroeconomic reasoning.</p>
                            </body>
                        </html>
                    """,
                },
                {
                    "url": "https://recipes.example.com/dinner/pasta",
                    "contentType": "text/plain",
                    "text": "Pasta dinner recipes with tomatoes and basil.",
                },
            ],
        },
    )
    assert response.status_code == 201, response.text
    packet = response.json()

    assert packet["contract_version"] == "source-packet-v1"
    assert packet["corpus_run"]["included_source_count"] == 1
    assert packet["corpus_run"]["excluded_source_count"] == 1
    assert packet["source_urls"] == ["https://econ.example.edu/macroeconomics/inflation"]
    assert len(packet["sources"]) == 1
    assert len(packet["source_documents"]) == 1
    assert packet["quality"]["status"] == "usable"
    assert packet["quality"]["documentCoverageRatio"] == 1
    assert packet["quality"]["evidenceCoverageRatio"] == 1
    assert packet["quality"]["duplicateSourceCount"] == 0
    assert packet["quality"]["brokenUrlCount"] == 0
    assert packet["quality"]["sourceTypeMix"]
    assert "averageTrustScore" in packet["quality"]
    assert "benchmarkUsefulnessRatio" in packet["quality"]
    assert packet["quality"]["conceptCandidateCount"] >= 3
    assert packet["quality"]["conceptCoverageRatio"] >= 0.7
    assert packet["quality"]["uncoveredConceptCandidates"] == []
    assert packet["sources"][0]["decision"]["decision"] == "included"
    assert packet["sources"][0]["snapshots"][0]["public_id"]
    assert packet["source_documents"][0]["sourceIndexRef"]["snapshotPublicId"]
    assert "inflation" in packet["source_documents"][0]["text"].lower()

    fetched = client.get(f"/v1/index/source-packets/{packet['corpus_run']['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["contract_version"] == "source-packet-v1"
    assert fetched.json()["source_documents"][0]["snapshotId"]


def test_source_packet_import_validates_and_imports_packet_contract(client) -> None:
    packet_response = client.post(
        "/v1/index/source-packets",
        json={
            "consumer": "lycium-course-generation",
            "context_id": "packet-import-macroeconomics",
            "prompt": "macroeconomics GDP inflation unemployment monetary policy",
            "fetch_sources": False,
            "source_urls": ["https://econ.example.edu/macroeconomics/inflation"],
            "source_documents": [
                {
                    "url": "https://econ.example.edu/macroeconomics/inflation",
                    "contentType": "text/plain",
                    "text": "Macroeconomics connects GDP, inflation, unemployment, monetary policy, price indexes, and purchasing power.",
                }
            ],
        },
    )
    assert packet_response.status_code == 201, packet_response.text
    packet = packet_response.json()

    dry_run = client.post("/v1/index/source-packet-imports", json={"packet": packet, "dry_run": True})
    assert dry_run.status_code == 201, dry_run.text
    assert dry_run.json()["valid"] is True
    assert dry_run.json()["imported_source_count"] == 0

    imported = client.post("/v1/index/source-packet-imports", json={"packet": packet})
    assert imported.status_code == 201, imported.text
    report = imported.json()

    assert report["contract_version"] == "source-packet-import-report-v1"
    assert report["packet_id"] == packet["packet_id"]
    assert report["valid"] is True
    assert report["imported_source_count"] == 1
    assert report["imported_snapshot_count"] == 1
    assert report["errors"] == []

    invalid = client.post("/v1/index/source-packet-imports", json={"packet": {"contract_version": "bad"}})
    assert invalid.status_code == 201, invalid.text
    assert invalid.json()["valid"] is False
    assert invalid.json()["errors"]


def test_source_packet_cli_exports_and_imports_portable_packet(client, tmp_path: Path) -> None:
    import_response = client.post(
        "/v1/index/source-imports",
        json={
            "batch_id": "portable-packet-batch",
            "sources": [
                {
                    "url": "https://econ.example.edu/macroeconomics/inflation",
                    "title": "Inflation Tutorial",
                    "source_type": "open_courseware",
                    "license": "cc-by",
                    "raw_text": "Inflation connects price indexes, purchasing power, nominal income, real income, and policy responses.",
                }
            ],
        },
    )
    assert import_response.status_code == 201, import_response.text

    packet_path = tmp_path / "source-packet.json"
    dry_run_report_path = tmp_path / "packet-dry-run-report.json"
    no_snapshot_report_path = tmp_path / "packet-no-snapshot-report.json"
    import_report_path = tmp_path / "packet-import-report.json"

    build_packet_cli(
        [
            "--consumer",
            "lycium-course-generation",
            "--context-id",
            "portable-packet-export",
            "--prompt",
            "macroeconomics inflation price indexes purchasing power",
            "--source-url",
            "https://econ.example.edu/macroeconomics/inflation",
            "--no-fetch",
            "--output",
            str(packet_path),
        ]
    )
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    assert packet["contract_version"] == "source-packet-v1"
    assert packet["source_documents"][0]["snapshotId"]
    assert "Inflation" in packet["source_documents"][0]["text"]

    reset_db()
    import_packet_cli([str(packet_path), "--dry-run", "--output", str(dry_run_report_path)])
    dry_run_report = json.loads(dry_run_report_path.read_text(encoding="utf-8"))
    assert dry_run_report["valid"] is True
    assert dry_run_report["dry_run"] is True
    assert dry_run_report["imported_source_count"] == 0
    assert dry_run_report["imported_snapshot_count"] == 0

    import_packet_cli([str(packet_path), "--no-snapshots", "--output", str(no_snapshot_report_path)])
    no_snapshot_report = json.loads(no_snapshot_report_path.read_text(encoding="utf-8"))
    assert no_snapshot_report["valid"] is True
    assert no_snapshot_report["import_snapshots"] is False
    assert no_snapshot_report["imported_source_count"] == 1
    assert no_snapshot_report["imported_snapshot_count"] == 0

    reset_db()
    import_packet_cli([str(packet_path), "--output", str(import_report_path)])
    import_report = json.loads(import_report_path.read_text(encoding="utf-8"))
    assert import_report["valid"] is True
    assert import_report["packet_id"] == packet["packet_id"]
    assert import_report["imported_source_count"] == 1
    assert import_report["imported_snapshot_count"] == 1
    assert import_report["source_refs"][0]["snapshots"][0]["snapshot_metadata"]["imported_from_packet_id"] == packet["packet_id"]


def test_bulk_source_import_feeds_generation_packet_eval(client) -> None:
    import_response = client.post(
        "/v1/index/source-imports",
        json={
            "batch_id": "macroeconomics-seed-batch",
            "sources": [
                {
                    "url": "https://econ.example.edu/macroeconomics/inflation",
                    "title": "Inflation Tutorial",
                    "source_type": "open_courseware",
                    "license": "cc-by",
                    "raw_text": "Inflation connects price indexes, purchasing power, nominal income, real income, and policy responses.",
                },
                {
                    "url": "https://econ.example.edu/macroeconomics/gdp-unemployment",
                    "title": "GDP and Unemployment Guide",
                    "source_type": "open_courseware",
                    "license": "cc-by",
                    "raw_text": "Macroeconomics covers GDP, national income accounting, unemployment, labor force participation, and monetary policy.",
                },
                {
                    "url": "https://recipes.example.com/dinner/pasta",
                    "title": "Pasta Dinner",
                    "source_type": "web",
                    "raw_text": "A pasta recipe with tomato sauce, basil, and garlic.",
                },
            ],
        },
    )
    assert import_response.status_code == 201, import_response.text
    import_report = import_response.json()

    assert import_report["contract_version"] == "source-import-batch-v1"
    assert import_report["submitted_count"] == 3
    assert import_report["snapshot_count"] == 3

    packet_response = client.post(
        "/v1/index/source-packets",
        json={
            "consumer": "lycium-course-generation",
            "context_id": "macroeconomics-import-eval",
            "prompt": "macroeconomics GDP inflation unemployment monetary policy",
            "fetch_sources": False,
            "source_urls": [row["source"]["canonical_url"] for row in import_report["sources"]],
        },
    )
    assert packet_response.status_code == 201, packet_response.text
    packet = packet_response.json()

    assert packet["contract_version"] == "source-packet-v1"
    assert packet["corpus_run"]["included_source_count"] == 2
    assert packet["corpus_run"]["excluded_source_count"] == 1
    assert len(packet["source_documents"]) == 2
    assert packet["quality"]["status"] == "usable"
    assert packet["quality"]["includedSourceCount"] == 2
    assert packet["quality"]["sourceDocumentCount"] == 2
    assert packet["quality"]["duplicateSourceCount"] == 0
    assert packet["quality"]["sourceTypeMix"]
    assert "qualityWarnings" in packet["quality"]
    assert all(document["snapshotId"] for document in packet["source_documents"])
    assert "pasta" not in " ".join(packet["source_urls"]).lower()
    assert {"gdp", "inflation"}.issubset(
        set().union(*(set(decision["matched_terms"]) for decision in packet["corpus_run"]["decisions"]))
    )


def test_source_snapshot_extracts_provided_html(client) -> None:
    source_response = client.post(
        "/v1/index/sources",
        json={
            "url": "https://example.edu/courses/macroeconomics",
            "title": "Macroeconomics Principles",
            "source_type": "syllabus",
        },
    )
    assert source_response.status_code == 201, source_response.text
    source_id = source_response.json()["id"]

    snapshot_response = client.post(
        f"/v1/index/sources/{source_id}/snapshots",
        json={
            "fetch": False,
            "content_type": "text/html",
            "raw_text": """
                <html>
                    <head><title>Macroeconomics Principles Syllabus</title></head>
                    <body>
                        <script>window.noise = true;</script>
                        <h1>Macroeconomics Principles</h1>
                        <p>GDP, inflation, unemployment, aggregate demand, fiscal policy, and monetary policy.</p>
                    </body>
                </html>
            """,
            "metadata": {"submitted_by": "test"},
        },
    )
    assert snapshot_response.status_code == 201, snapshot_response.text
    snapshot = snapshot_response.json()

    assert snapshot["status"] == "provided"
    assert snapshot["content_hash"]
    assert snapshot["title"] == "Macroeconomics Principles"
    assert "inflation" in snapshot["extracted_text"].lower()
    assert "window.noise" not in snapshot["extracted_text"]
    assert snapshot["snapshot_metadata"] == {"submitted_by": "test"}

    snapshots = client.get(f"/v1/index/sources/{source_id}/snapshots")
    assert snapshots.status_code == 200, snapshots.text
    assert len(snapshots.json()) == 1
    assert snapshots.json()[0]["content_hash"] == snapshot["content_hash"]
