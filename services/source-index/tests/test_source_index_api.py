from __future__ import annotations

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
    assert packet["sources"][0]["decision"]["decision"] == "included"
    assert packet["sources"][0]["snapshots"][0]["public_id"]
    assert packet["source_documents"][0]["sourceIndexRef"]["snapshotPublicId"]
    assert "Stoichiometry" in packet["source_documents"][0]["text"]


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
