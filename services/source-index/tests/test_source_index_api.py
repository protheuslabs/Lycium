from __future__ import annotations

import json
from pathlib import Path

import httpx

from source_index.crawl.contracts import CrawlTask, CrawlWorkerResult, ExtractionResult, FetchResult, PageClassification
from source_index.crawl.policies import default_policy_payload, should_visit_url
from source_index.crawl.worker import run_crawl_task


def test_health(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "source-index"}


def test_source_upsert_canonicalizes_and_dedupes(client) -> None:
    first = client.post(
        "/v1/index/sources",
        json={
            "url": "https://example.edu/courses/chem105?utm_source=newsletter",
            "title": "CHEM 105",
            "source_type": "catalog",
        },
    )
    assert first.status_code == 201, first.text

    second = client.post("/v1/index/sources", json={"url": "https://example.edu/courses/chem105"})
    assert second.status_code == 201, second.text

    assert first.json()["id"] == second.json()["id"]
    assert second.json()["canonical_url"] == "https://example.edu/courses/chem105"
    assert len(second.json()["submitted_urls"]) == 2


def test_corpus_run_persists_include_exclude_decisions(client) -> None:
    response = client.post(
        "/v1/index/corpus-runs",
        json={
            "consumer": "lycium",
            "context_id": "test-chem-corpus",
            "prompt": "CHEM 105 chemistry stoichiometry bonding acids bases",
            "fetch_sources": False,
            "source_urls": [
                "https://chem.example.edu/chemistry/stoichiometry",
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
    assert fetched.json()["context_id"] == "test-chem-corpus"


def test_source_packet_builds_generation_ready_evidence_from_documents(client) -> None:
    response = client.post(
        "/v1/index/source-packets",
        json={
            "consumer": "lycium-course-generation",
            "context_id": "packet-chem105",
            "prompt": "CHEM 105 chemistry stoichiometry bonding acids bases",
            "fetch_sources": False,
            "source_urls": [
                "https://chem.example.edu/chemistry/stoichiometry",
                "https://recipes.example.com/dinner/pasta",
            ],
            "source_documents": [
                {
                    "url": "https://chem.example.edu/chemistry/stoichiometry",
                    "contentType": "text/html",
                    "text": """
                        <html>
                            <body>
                                <h1>General Chemistry I</h1>
                                <p>Stoichiometry, atomic structure, bonding, and acids and bases.</p>
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
    assert packet["source_urls"] == ["https://chem.example.edu/chemistry/stoichiometry"]
    assert len(packet["sources"]) == 1
    assert len(packet["source_documents"]) == 1
    assert packet["quality"]["status"] == "usable"
    assert packet["quality"]["documentCoverageRatio"] == 1
    assert packet["quality"]["evidenceCoverageRatio"] == 1
    assert packet["sources"][0]["decision"]["decision"] == "included"
    assert packet["sources"][0]["snapshots"][0]["public_id"]
    assert packet["source_documents"][0]["sourceIndexRef"]["snapshotPublicId"]
    assert "Stoichiometry" in packet["source_documents"][0]["text"]

    fetched = client.get(f"/v1/index/source-packets/{packet['corpus_run']['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["contract_version"] == "source-packet-v1"
    assert fetched.json()["source_documents"][0]["snapshotId"]


def test_source_packet_import_validates_and_imports_packet_contract(client) -> None:
    packet_response = client.post(
        "/v1/index/source-packets",
        json={
            "consumer": "lycium-course-generation",
            "context_id": "packet-import-chem105",
            "prompt": "CHEM 105 chemistry stoichiometry bonding acids bases",
            "fetch_sources": False,
            "source_urls": ["https://chem.example.edu/chemistry/stoichiometry"],
            "source_documents": [
                {
                    "url": "https://chem.example.edu/chemistry/stoichiometry",
                    "contentType": "text/plain",
                    "text": "Stoichiometry, atomic structure, bonding, acids, bases, and thermochemistry.",
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


def test_bulk_source_import_feeds_generation_packet_eval(client) -> None:
    import_response = client.post(
        "/v1/index/source-imports",
        json={
            "batch_id": "chem105-seed-batch",
            "sources": [
                {
                    "url": "https://chem.example.edu/chemistry/stoichiometry",
                    "title": "Stoichiometry Tutorial",
                    "source_type": "open_courseware",
                    "license": "cc-by",
                    "raw_text": "Stoichiometry connects balanced equations, mole ratios, limiting reactants, and yields.",
                },
                {
                    "url": "https://chem.example.edu/chemistry/bonding-acids-bases",
                    "title": "Bonding and Acids/Bases",
                    "source_type": "open_courseware",
                    "license": "cc-by",
                    "raw_text": "General chemistry covers ionic bonding, covalent bonding, acids, bases, pH, and buffers.",
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
            "context_id": "chem105-import-eval",
            "prompt": "CHEM 105 chemistry stoichiometry bonding acids bases",
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
    assert all(document["snapshotId"] for document in packet["source_documents"])
    assert "pasta" not in " ".join(packet["source_urls"]).lower()
    assert {"stoichiometry", "bonding"}.issubset(
        set().union(*(set(decision["matched_terms"]) for decision in packet["corpus_run"]["decisions"]))
    )


def test_source_snapshot_extracts_provided_html(client) -> None:
    source_response = client.post(
        "/v1/index/sources",
        json={
            "url": "https://example.edu/courses/chem105",
            "title": "CHEM 105",
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
                    <head><title>General Chemistry I Syllabus</title></head>
                    <body>
                        <script>window.noise = true;</script>
                        <h1>General Chemistry I</h1>
                        <p>Stoichiometry, atomic structure, bonding, thermochemistry, and acids and bases.</p>
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
    assert snapshot["title"] == "CHEM 105"
    assert "Stoichiometry" in snapshot["extracted_text"]
    assert "window.noise" not in snapshot["extracted_text"]
    assert snapshot["snapshot_metadata"] == {"submitted_by": "test"}

    snapshots = client.get(f"/v1/index/sources/{source_id}/snapshots")
    assert snapshots.status_code == 200, snapshots.text
    assert len(snapshots.json()) == 1
    assert snapshots.json()[0]["content_hash"] == snapshot["content_hash"]


def test_crawl_policy_accepts_education_paths_and_rejects_noise() -> None:
    policy = default_policy_payload()
    policy["seed_domains"] = ["example.edu"]

    accepted, accepted_reason = should_visit_url("https://example.edu/catalog/courses/chem105", policy)
    rejected_domain, domain_reason = should_visit_url("https://other.edu/catalog/courses/chem105", policy)
    rejected_path, path_reason = should_visit_url("https://example.edu/news/athletics", policy)

    assert accepted is True
    assert accepted_reason == "accepted_by_policy"
    assert rejected_domain is False
    assert domain_reason == "outside_seed_domains"
    assert rejected_path is False
    assert path_reason == "denied_path_hint"


def test_crawl_policy_and_run_records_are_api_first(client) -> None:
    policy_response = client.post(
        "/v1/index/crawl-policies",
        json={
            "name": "education-institution-crawl-v1",
            "version": "test",
            "payload": {
                "seed_domains": ["example.edu"],
                "max_depth": 2,
                "max_pages_per_domain": 25,
            },
        },
    )
    assert policy_response.status_code == 201, policy_response.text
    policy = policy_response.json()

    assert policy["payload"]["seed_domains"] == ["example.edu"]
    assert policy["payload"]["max_depth"] == 2
    assert "catalog" in policy["payload"]["allowed_path_hints"]

    run_response = client.post(
        "/v1/index/crawl-runs",
        json={
            "policy_id": policy["id"],
            "seed_urls": ["https://example.edu/catalog/courses"],
            "max_pages": 10,
            "payload": {"reason": "smoke"},
        },
    )
    assert run_response.status_code == 201, run_response.text
    run = run_response.json()

    assert run["status"] == "queued"
    assert run["pages_queued"] == 1
    assert run["seed_urls"] == ["https://example.edu/catalog/courses"]
    assert run["payload"]["reason"] == "smoke"
    assert run["payload"]["task_contract_version"] == "crawl-task-v1"

    fetched = client.get(f"/v1/index/crawl-runs/{run['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["policy_id"] == policy["id"]

    task_response = client.get(f"/v1/index/crawl-runs/{run['id']}/tasks")
    assert task_response.status_code == 200, task_response.text
    tasks = task_response.json()
    assert len(tasks) == 1
    assert tasks[0]["contract_version"] == "crawl-task-v1"
    assert tasks[0]["url"] == "https://example.edu/catalog/courses"
    assert tasks[0]["policy"]["seed_domains"] == ["example.edu"]


def test_crawl_worker_result_contract_is_language_portable() -> None:
    task = CrawlTask(
        crawl_run_id=1,
        policy_id=2,
        url="https://example.edu/catalog/courses/chem105",
        policy={"seed_domains": ["example.edu"]},
    )
    result = CrawlWorkerResult(
        crawl_run_id=1,
        policy_id=2,
        task=task,
        fetch=FetchResult(
            url=task.url,
            final_url=task.url,
            status_code=200,
            content_type="text/html",
            content_hash="abc123",
        ),
        extraction=ExtractionResult(
            title="CHEM 105",
            extracted_text="General Chemistry I covers stoichiometry and bonding.",
            text_digest="General Chemistry I covers stoichiometry and bonding.",
        ),
        classification=PageClassification(label="syllabus", confidence=0.91),
        accepted=True,
    )

    payload = result.model_dump(mode="json")
    assert payload["contract_version"] == "crawl-worker-result-v1"
    assert payload["task"]["contract_version"] == "crawl-task-v1"
    assert payload["classification"]["label"] == "syllabus"


def test_crawl_worker_rejects_out_of_policy_url_without_fetching() -> None:
    task = CrawlTask(
        crawl_run_id=1,
        policy_id=2,
        url="https://other.edu/catalog/courses/chem105",
        policy={"seed_domains": ["example.edu"]},
    )

    result = run_crawl_task(task)

    assert result.accepted is False
    assert result.rejection_reason == "outside_seed_domains"
    assert result.fetch.error == "outside_seed_domains"


def test_crawl_worker_fetches_extracts_classifies_and_discovers_links(monkeypatch) -> None:
    html = """
        <html>
            <head><title>CHEM 105 Course Catalog</title></head>
            <body>
                <h1>CHEM 105 General Chemistry I</h1>
                <p>Course description: atomic structure, stoichiometry, bonding, and thermochemistry.</p>
                <p>Credits: 4. Prerequisite: placement into college algebra.</p>
                <a href="/catalog/courses/chem106">Next chemistry course</a>
                <a href="/news/athletics">Campus news</a>
                <script>window.noise = true;</script>
            </body>
        </html>
    """

    def fake_get(url, **_kwargs):
        request = httpx.Request("GET", url)
        return httpx.Response(
            200,
            request=request,
            headers={"content-type": "text/html"},
            content=html.encode("utf-8"),
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    task = CrawlTask(
        crawl_run_id=1,
        policy_id=2,
        url="https://example.edu/catalog/courses/chem105",
        policy={"seed_domains": ["example.edu"], "max_depth": 2},
    )

    result = run_crawl_task(task)

    assert result.accepted is True
    assert result.rejection_reason is None
    assert result.fetch.status_code == 200
    assert result.fetch.raw_storage_ref is None
    assert result.extraction is not None
    assert result.extraction.title == "CHEM 105 Course Catalog"
    assert "stoichiometry" in result.extraction.extracted_text
    assert "window.noise" not in result.extraction.extracted_text
    assert result.classification is not None
    assert result.classification.label == "course_catalog"
    assert [link.url for link in result.discovered_links] == ["https://example.edu/catalog/courses/chem106"]


def test_source_index_does_not_import_lycium_modules() -> None:
    source_root = Path(__file__).parents[1] / "src" / "source_index"
    for path in source_root.rglob("*.py"):
        for line in path.read_text().splitlines():
            stripped = line.strip().lower()
            if stripped.startswith(("import ", "from ")):
                assert "lycium" not in stripped


def test_source_index_cli_import_packet_and_openapi_exports(tmp_path: Path) -> None:
    from source_index.cli import build_packet_cli, import_batch_cli
    from source_index.openapi import export_cli

    batch_path = tmp_path / "batch.json"
    import_report_path = tmp_path / "import-report.json"
    packet_path = tmp_path / "packet.json"
    openapi_path = tmp_path / "openapi.json"
    batch_path.write_text(
        """
        {
          "batch_id": "cli-smoke-batch",
          "sources": [
            {
              "url": "https://example.edu/programming/variables-functions-testing",
              "title": "Course One",
              "source_type": "catalog",
              "raw_text": "Course One teaches variables, functions, testing, and programming practice."
            },
            {
              "url": "https://example.com/irrelevant",
              "title": "Irrelevant",
              "raw_text": "This page is about unrelated cooking notes."
            }
          ]
        }
        """,
        encoding="utf-8",
    )

    import_batch_cli([str(batch_path), "--output", str(import_report_path)])
    build_packet_cli(
        [
            "--consumer",
            "cli-smoke",
            "--context-id",
            "cli-smoke-context",
            "--prompt",
            "programming variables functions testing",
            "--source-url",
            "https://example.edu/programming/variables-functions-testing",
            "--source-url",
            "https://example.com/irrelevant",
            "--no-fetch",
            "--output",
            str(packet_path),
        ]
    )
    export_cli(["--output", str(openapi_path)])

    import_report = json.loads(import_report_path.read_text(encoding="utf-8"))
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    openapi = json.loads(openapi_path.read_text(encoding="utf-8"))

    assert import_report["contract_version"] == "source-import-batch-v1"
    assert packet["contract_version"] == "source-packet-v1"
    assert packet["corpus_run"]["included_source_count"] == 1
    assert packet["corpus_run"]["excluded_source_count"] == 1
    assert openapi["info"]["title"] == "Protheus Source Index API"
    assert "/v1/index/source-packets" in openapi["paths"]
    assert "/v1/index/source-packet-imports" in openapi["paths"]
