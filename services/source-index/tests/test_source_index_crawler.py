from __future__ import annotations

import json
from pathlib import Path

import httpx

from source_index.crawl.contracts import CrawlTask, CrawlWorkerResult, ExtractionResult, FetchResult, PageClassification
from source_index.crawl.policies import default_policy_payload, should_visit_url
from source_index.crawl.worker import run_crawl_task
from source_index.cli import service_contract_cli



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
    service_contract_path = tmp_path / "service-contract.json"
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
    service_contract_cli(["--output", str(service_contract_path)])

    import_report = json.loads(import_report_path.read_text(encoding="utf-8"))
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    openapi = json.loads(openapi_path.read_text(encoding="utf-8"))
    service_contract = json.loads(service_contract_path.read_text(encoding="utf-8"))

    assert import_report["contract_version"] == "source-import-batch-v1"
    assert packet["contract_version"] == "source-packet-v1"
    assert packet["corpus_run"]["included_source_count"] == 1
    assert packet["corpus_run"]["excluded_source_count"] == 1
    assert openapi["info"]["title"] == "Protheus Source Index API"
    assert "/v1/index/source-packets" in openapi["paths"]
    assert "/v1/index/source-packet-imports" in openapi["paths"]
    assert service_contract["contract_version"] == "source-index-service-v1"
    assert "source-index-openapi" in service_contract["cli_commands"]
