from __future__ import annotations

import httpx

from app.source_corpus import compile_generation_source_corpus
from app.source_index_client import SourceIndexClient, normalize_remote_source_payload


REMOTE_SOURCE = {
    "id": 7,
    "public_id": "src_remote_chem105",
    "canonical_url": "https://example.edu/catalog/chem105",
    "normalized_domain": "example.edu",
    "submitted_urls": ["https://example.edu/catalog/chem105"],
    "title": "CHEM 105",
    "source_type": "catalog",
    "license": "cc-by",
    "is_free": True,
    "trust_baseline": 0.82,
    "link_health": "healthy",
    "created_at": "2026-05-30T00:00:00Z",
    "updated_at": "2026-05-30T00:00:00Z",
}

REMOTE_SNAPSHOT = {
    "id": 11,
    "public_id": "snap_remote_chem105",
    "source_id": 7,
    "fetched_at": "2026-05-30T00:01:00Z",
    "status": "provided",
    "content_hash": "abc123",
    "content_type": "text/html",
    "title": "CHEM 105",
    "text_digest": "Stoichiometry and bonding",
    "extracted_text": "CHEM 105 covers stoichiometry, atomic structure, bonding, and acids and bases.",
    "raw_storage_ref": None,
    "snapshot_metadata": {},
}

REMOTE_CORPUS_RUN = {
    "id": 3,
    "public_id": "corpus_remote_chem105",
    "consumer": "lycium",
    "context_id": "chem105",
    "prompt": "CHEM 105 general chemistry",
    "submitted_source_count": 2,
    "included_source_count": 1,
    "excluded_source_count": 1,
    "fetch_sources": True,
    "created_at": "2026-05-30T00:02:00Z",
    "decisions": [
        {
            "id": 21,
            "source_id": 7,
            "source_url": "https://example.edu/catalog/chem105",
            "decision": "included",
            "relevance_score": 0.9,
            "matched_terms": ["chem", "stoichiometry"],
            "rationale": "Matches the course prompt.",
            "failure_reason": None,
        },
        {
            "id": 22,
            "source_id": 8,
            "source_url": "https://example.com/pasta",
            "decision": "excluded",
            "relevance_score": 0.0,
            "matched_terms": [],
            "rationale": "Does not match the course prompt.",
            "failure_reason": None,
        },
    ],
}

REMOTE_SOURCE_PACKET = {
    "contract_version": "source-packet-v1",
    "packet_id": "source-packet-remote-chem105",
    "generated_at": "2026-05-30T00:00:00Z",
    "producer": {
        "service": "source-index",
        "version": "source-packet-v1",
        "schema_id": "https://protheuslabs.github.io/Lycium/schemas/lycium-source-packet.schema.json",
    },
    "consumer": "lycium-course-generation",
    "context_id": "chem105",
    "prompt": "CHEM 105 general chemistry",
    "source_urls": ["https://example.edu/catalog/chem105"],
    "corpus_run": REMOTE_CORPUS_RUN,
    "sources": [
        {
            "source": REMOTE_SOURCE,
            "decision": REMOTE_CORPUS_RUN["decisions"][0],
            "snapshots": [REMOTE_SNAPSHOT],
            "evidence_refs": ["src_remote_chem105", "snap_remote_chem105"],
            "source_document": {
                "url": "https://example.edu/catalog/chem105",
                "contentType": "text/html",
                "text": "CHEM 105 covers stoichiometry, atomic structure, bonding, and acids and bases.",
                "sourceId": "src_remote_chem105",
                "snapshotId": "snap_remote_chem105",
                "sourceIndexRef": {
                    "service": "source-index",
                    "sourcePublicId": "src_remote_chem105",
                    "snapshotPublicId": "snap_remote_chem105",
                    "sourceRemoteId": 7,
                    "snapshotRemoteId": 11,
                },
            },
        }
    ],
    "source_documents": [
        {
            "url": "https://example.edu/catalog/chem105",
            "contentType": "text/html",
            "text": "CHEM 105 covers stoichiometry, atomic structure, bonding, and acids and bases.",
            "sourceId": "src_remote_chem105",
            "snapshotId": "snap_remote_chem105",
            "sourceIndexRef": {
                "service": "source-index",
                "sourcePublicId": "src_remote_chem105",
                "snapshotPublicId": "snap_remote_chem105",
                "sourceRemoteId": 7,
                "snapshotRemoteId": 11,
            },
        }
    ],
    "synthesis": {"workflowGate": "source_corpus_preflight"},
    "warnings": [],
    "quality": {
        "status": "usable",
        "includedSourceCount": 1,
        "sourceDocumentCount": 1,
        "snapshotCoverageRatio": 1,
        "documentCoverageRatio": 1,
        "evidenceCoverageRatio": 1,
        "warningCount": 0,
    },
}

REMOTE_IMPORT_REPORT = {
    "contract_version": "source-import-batch-v1",
    "batch_id": "remote-chem105",
    "submitted_count": 1,
    "imported_count": 1,
    "snapshot_count": 1,
    "sources": [
        {
            "original_index": 1,
            "source": REMOTE_SOURCE,
            "snapshot": REMOTE_SNAPSHOT,
            "created_snapshot": True,
            "warnings": [],
        }
    ],
    "warnings": [],
}


def test_source_index_client_uses_http_contract_for_sources_and_snapshots() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/v1/index/sources":
            return httpx.Response(201, json=REMOTE_SOURCE)
        if request.method == "GET" and request.url.path == "/v1/index/sources":
            assert request.url.params["query"] == "chem105"
            return httpx.Response(200, json=[REMOTE_SOURCE])
        if request.method == "GET" and request.url.path == "/v1/index/sources/7/snapshots":
            assert request.url.params["limit"] == "10"
            return httpx.Response(200, json=[REMOTE_SNAPSHOT])
        return httpx.Response(404, json={"detail": "not found"})

    client = SourceIndexClient(base_url="http://source-index.test", transport=httpx.MockTransport(handler))

    created = client.create_source(url="https://example.edu/catalog/chem105", title="CHEM 105")
    listed = client.list_sources(query="chem105")
    snapshots = client.list_source_snapshots(7, limit=10)
    normalized = normalize_remote_source_payload(created)

    assert created["public_id"] == "src_remote_chem105"
    assert listed == [REMOTE_SOURCE]
    assert snapshots == [REMOTE_SNAPSHOT]
    assert normalized["archive_links"] == []
    assert normalized["last_verified_at"] == REMOTE_SOURCE["updated_at"]


def test_source_index_client_uses_http_contract_for_corpus_runs() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/v1/index/corpus-runs":
            return httpx.Response(201, json=REMOTE_CORPUS_RUN)
        if request.method == "GET" and request.url.path == "/v1/index/corpus-runs/3":
            return httpx.Response(200, json=REMOTE_CORPUS_RUN)
        return httpx.Response(404, json={"detail": "not found"})

    client = SourceIndexClient(base_url="http://source-index.test", transport=httpx.MockTransport(handler))

    created = client.create_corpus_run(
        consumer="lycium",
        context_id="chem105",
        prompt="CHEM 105 general chemistry",
        source_urls=["https://example.edu/catalog/chem105", "https://example.com/pasta"],
    )
    fetched = client.get_corpus_run(3)

    assert created["public_id"] == "corpus_remote_chem105"
    assert fetched["included_source_count"] == 1
    assert fetched["decisions"][0]["decision"] == "included"


def test_source_index_client_uses_http_contract_for_source_packets() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/v1/index/source-packets":
            return httpx.Response(201, json=REMOTE_SOURCE_PACKET)
        if request.method == "GET" and request.url.path == "/v1/index/source-packets/3":
            return httpx.Response(200, json=REMOTE_SOURCE_PACKET)
        return httpx.Response(404, json={"detail": "not found"})

    client = SourceIndexClient(base_url="http://source-index.test", transport=httpx.MockTransport(handler))

    packet = client.create_source_packet(
        consumer="lycium-course-generation",
        context_id="chem105",
        prompt="CHEM 105 general chemistry",
        source_urls=["https://example.edu/catalog/chem105"],
        source_documents=[
            {
                "url": "https://example.edu/catalog/chem105",
                "contentType": "text/html",
                "text": "CHEM 105 covers stoichiometry and bonding.",
            }
        ],
    )

    assert packet["contract_version"] == "source-packet-v1"
    assert packet["source_documents"][0]["snapshotId"] == "snap_remote_chem105"
    assert packet["quality"]["status"] == "usable"
    assert client.get_source_packet(3)["contract_version"] == "source-packet-v1"


def test_source_index_client_uses_http_contract_for_bulk_imports() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/v1/index/source-imports":
            return httpx.Response(201, json=REMOTE_IMPORT_REPORT)
        return httpx.Response(404, json={"detail": "not found"})

    client = SourceIndexClient(base_url="http://source-index.test", transport=httpx.MockTransport(handler))

    report = client.import_source_batch(
        batch_id="remote-chem105",
        sources=[
            {
                "url": "https://example.edu/catalog/chem105",
                "title": "CHEM 105",
                "raw_text": "CHEM 105 covers stoichiometry and bonding.",
            }
        ],
    )

    assert report["contract_version"] == "source-import-batch-v1"
    assert report["snapshot_count"] == 1


def test_generation_source_corpus_accepts_source_packet_payload() -> None:
    preflight = compile_generation_source_corpus(
        prompt="CHEM 105 general chemistry",
        source_urls=[],
        source_packet=REMOTE_SOURCE_PACKET,
    )

    assert preflight.source_urls == ["https://example.edu/catalog/chem105"]
    assert preflight.source_documents[0]["snapshotId"] == "snap_remote_chem105"
    assert preflight.synthesis["sourcePacket"]["contractVersion"] == "source-packet-v1"
    assert preflight.synthesis["sourcePacket"]["quality"]["status"] == "usable"


def test_index_source_upsert_canonicalizes_and_dedupes(client) -> None:
    first = client.post(
        "/v1/index/sources",
        json={
            "url": "https://example.edu/courses/chem105?utm_source=newsletter",
            "title": "CHEM 105",
            "source_type": "catalog",
        },
    )
    assert first.status_code == 201, first.text

    second = client.post(
        "/v1/index/sources",
        json={"url": "https://example.edu/courses/chem105"},
    )
    assert second.status_code == 201, second.text

    assert first.json()["id"] == second.json()["id"]
    assert second.json()["canonical_url"] == "https://example.edu/courses/chem105"


def test_index_corpus_run_persists_include_exclude_decisions(client) -> None:
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
    assert len(payload["decisions"]) == 2
    assert {decision["decision"] for decision in payload["decisions"]} == {"included", "excluded"}

    sources = client.get("/v1/index/sources")
    assert sources.status_code == 200, sources.text
    assert len(sources.json()) == 2

    fetched = client.get(f"/v1/index/corpus-runs/{payload['id']}")
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["context_id"] == "test-chem-corpus"


def test_index_bulk_import_feeds_generation_packet(client) -> None:
    import_response = client.post(
        "/v1/index/source-imports",
        json={
            "batch_id": "local-chem105-import",
            "sources": [
                {
                    "url": "https://chem.example.edu/chemistry/stoichiometry",
                    "title": "Stoichiometry Tutorial",
                    "source_type": "open_courseware",
                    "license": "cc-by",
                    "raw_text": "Stoichiometry connects balanced equations, mole ratios, limiting reactants, and yields.",
                },
                {
                    "url": "https://recipes.example.com/dinner/pasta",
                    "title": "Pasta Dinner",
                    "raw_text": "A pasta recipe with tomato sauce, basil, and garlic.",
                },
            ],
        },
    )
    assert import_response.status_code == 201, import_response.text
    import_report = import_response.json()

    assert import_report["contract_version"] == "source-import-batch-v1"
    assert import_report["snapshot_count"] == 2

    packet_response = client.post(
        "/v1/index/source-packets",
        json={
            "consumer": "lycium-course-generation",
            "context_id": "local-chem105-import-eval",
            "prompt": "CHEM 105 chemistry stoichiometry bonding acids bases",
            "fetch_sources": False,
            "source_urls": [row["source"]["canonical_url"] for row in import_report["sources"]],
        },
    )
    assert packet_response.status_code == 201, packet_response.text
    packet = packet_response.json()

    assert packet["corpus_run"]["included_source_count"] == 1
    assert packet["corpus_run"]["excluded_source_count"] == 1
    assert len(packet["source_documents"]) == 1
    assert packet["quality"]["status"] == "usable"
    assert packet["quality"]["documentCoverageRatio"] == 1
    assert packet["source_documents"][0]["snapshotId"]
    assert "Stoichiometry" in packet["source_documents"][0]["text"]

    fetched_packet = client.get(f"/v1/index/source-packets/{packet['corpus_run']['id']}")
    assert fetched_packet.status_code == 200, fetched_packet.text
    assert fetched_packet.json()["contract_version"] == "source-packet-v1"
