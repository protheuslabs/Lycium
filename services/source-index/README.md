# Protheus Source Index

The Protheus Source Index is a standalone FastAPI service for building a reusable source reference index that can be consumed by Lycium, InfRing, and future Protheus AI systems.

This service intentionally starts without a crawler. Its first job is to persist manually submitted or agent-submitted sources, source-corpus relevance decisions, and source metadata behind a neutral `/v1/index/*` API.

## Scope

Current foundation:

- canonical indexed sources
- source snapshots with manual or fetched text extraction
- policy-driven crawl configuration records
- queued crawl run records
- source corpus runs
- included/excluded source decisions
- source relevance preflight for large submitted source sets

Out of scope for this slice:

- executing broad web crawls
- embeddings/vector search
- claim extraction
- authentication/multi-tenant deployment
- crawler scheduling

## Run locally

```bash
cd services/source-index
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
source-index-api
```

Default URL:

```text
http://127.0.0.1:8100
```

## API

```http
GET  /health
POST /v1/index/sources
GET  /v1/index/sources
GET  /v1/index/sources/{source_id}
POST /v1/index/crawl-policies
GET  /v1/index/crawl-policies
GET  /v1/index/crawl-policies/{policy_id}
POST /v1/index/crawl-runs
GET  /v1/index/crawl-runs/{run_id}
GET  /v1/index/crawl-runs/{run_id}/tasks
POST /v1/index/sources/{source_id}/snapshots
GET  /v1/index/sources/{source_id}/snapshots
POST /v1/index/corpus-runs
GET  /v1/index/corpus-runs/{run_id}
```

Snapshot creation supports two modes:

- `fetch: true` fetches the source URL, extracts readable text, stores a hash, and records fetch metadata.
- `fetch: false` accepts provided `raw_text` for manual imports, tests, PDFs converted elsewhere, or future worker pipelines.

## Environment

```text
SOURCE_INDEX_DATABASE_URL=sqlite:///../.data/source-index.db
SOURCE_INDEX_USER_AGENT=ProtheusSourceIndex/0.1
```

## Relationship to Lycium

Lycium can keep using its internal adapter while this service matures. The long-term direction is for Lycium course generation and InfRing research tooling to write/read source evidence through this service instead of owning source-index state directly.

## Extraction boundary

This service is designed to be extractable into its own repository:

- it must not import Lycium app, course, or UI modules
- consumers should integrate through `/v1/index/*` APIs instead of database coupling
- crawl behavior should be policy-driven, not hardcoded to Lycium
- education-institution crawling is the first default policy, not the crawler's only possible mode
- source snapshots, crawl policies, crawl runs, and corpus decisions are owned by this service

## Worker boundary

Crawler execution is intentionally split from the API/control plane.

Stable contracts:

- `crawl-task-v1`: a worker input message containing crawl run, policy, URL, depth, and trace data
- `crawl-worker-result-v1`: a worker output message containing fetch result, extracted text, classification, discovered links, and acceptance status

Current Python modules define these contracts in `source_index.crawl.contracts`. Future workers can be Python, Go, Rust, or another implementation as long as they read and write the same JSON contract.

The API can expose initial seed tasks for a queued crawl run:

```http
GET /v1/index/crawl-runs/{run_id}/tasks
```

This endpoint is not a scheduler yet. It is the contract seam where future queue-backed workers can plug in without coupling worker code to Lycium or the API database internals.

The first Python worker implementation can execute a single task payload and emit a `crawl-worker-result-v1` JSON object:

```bash
source-index-crawl-task task.json
cat task.json | source-index-crawl-task
```

This worker is intentionally stateless. It fetches one URL, extracts readable text, classifies the page against the crawl policy, discovers policy-accepted links, and prints the result contract. Persistence, queue leasing, retries, and scheduling remain outside this worker seam.
