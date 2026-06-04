from __future__ import annotations

from typing import Any


SOURCE_INDEX_SERVICE_CONTRACT_VERSION = "source-index-service-v1"
SOURCE_IMPORT_BATCH_CONTRACT_VERSION = "source-import-batch-v1"
SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
SOURCE_PACKET_IMPORT_REPORT_VERSION = "source-packet-import-report-v1"
SOURCE_INDEX_SEARCH_CONTRACT_VERSION = "source-index-search-v1"
SOURCE_FIT_ANALYSIS_CONTRACT_VERSION = "source-fit-analysis-v1"
SOURCE_PACKET_SCHEMA_ID = "https://protheuslabs.github.io/Lycium/schemas/lycium-source-packet.schema.json"
SOURCE_IMPORT_BATCH_SCHEMA_ID = "https://protheuslabs.github.io/Lycium/schemas/lycium-source-import-batch.schema.json"


def source_index_service_contract() -> dict[str, Any]:
    return {
        "contract_version": SOURCE_INDEX_SERVICE_CONTRACT_VERSION,
        "service": "source-index",
        "api_version": "v1",
        "purpose": "Canonical public-source indexing, snapshotting, corpus preflight, source search, source-fit analysis, and source-packet exchange.",
        "portable_contracts": [
            {
                "name": "source-import-batch",
                "contract_version": SOURCE_IMPORT_BATCH_CONTRACT_VERSION,
                "schema_id": SOURCE_IMPORT_BATCH_SCHEMA_ID,
                "direction": "input",
            },
            {
                "name": "source-packet",
                "contract_version": SOURCE_PACKET_CONTRACT_VERSION,
                "schema_id": SOURCE_PACKET_SCHEMA_ID,
                "direction": "output",
            },
            {
                "name": "source-packet-import-report",
                "contract_version": SOURCE_PACKET_IMPORT_REPORT_VERSION,
                "schema_id": None,
                "direction": "output",
            },
            {
                "name": "source-index-search",
                "contract_version": SOURCE_INDEX_SEARCH_CONTRACT_VERSION,
                "schema_id": None,
                "direction": "output",
            },
            {
                "name": "source-fit-analysis",
                "contract_version": SOURCE_FIT_ANALYSIS_CONTRACT_VERSION,
                "schema_id": None,
                "direction": "output",
            },
        ],
        "stable_endpoints": [
            {"method": "GET", "path": "/health", "purpose": "service availability"},
            {"method": "GET", "path": "/v1/index/service-contract", "purpose": "portable service boundary"},
            {"method": "POST", "path": "/v1/index/sources", "purpose": "upsert canonical source"},
            {"method": "GET", "path": "/v1/index/sources", "purpose": "list/search canonical sources"},
            {"method": "POST", "path": "/v1/index/source-imports", "purpose": "import source batch"},
            {"method": "POST", "path": "/v1/index/search", "purpose": "search indexed sources for reusable evidence"},
            {"method": "POST", "path": "/v1/index/source-fit", "purpose": "analyze submitted sources against abstract target descriptors"},
            {"method": "POST", "path": "/v1/index/corpus-runs", "purpose": "run source-corpus preflight"},
            {"method": "POST", "path": "/v1/index/source-packets", "purpose": "emit source-packet-v1"},
            {"method": "POST", "path": "/v1/index/source-packet-imports", "purpose": "import or validate source-packet-v1"},
            {"method": "POST", "path": "/v1/index/crawl-policies", "purpose": "store crawl policy"},
            {"method": "POST", "path": "/v1/index/crawl-runs", "purpose": "create crawl run"},
        ],
        "cli_commands": [
            "source-index-api",
            "source-index-import-batch",
            "source-index-build-packet",
            "source-index-import-packet",
            "source-index-openapi",
            "source-index-service-contract",
            "source-index-crawl-task",
        ],
        "owns": [
            "canonical source records",
            "source snapshots and extracted text",
            "source-corpus preflight decisions",
            "source search and source-fit candidate scoring",
            "source packet assembly and import validation",
            "education-focused crawl policy and task records",
        ],
        "does_not_own": [
            "course planning",
            "lesson generation",
            "quiz generation",
            "learner progress",
            "review/publish state",
            "web UI behavior",
        ],
        "consumer_expectations": [
            "Consumers should use source-packet-v1 instead of copying untracked source text.",
            "Consumers should inspect packet quality before treating packets as generation-ready evidence.",
            "Consumers should preserve packet_id and evidence_refs in downstream traces.",
            "Consumers should pass abstract target descriptors to source-fit analysis rather than requiring Source Index to understand product-specific renderers.",
            "Consumers should treat source-fit candidates as review suggestions, not automatic source attachments.",
        ],
    }
