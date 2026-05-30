# Protheus Source Index

The Protheus Source Index is a standalone FastAPI service for building a reusable source reference index that can be consumed by Lycium, InfRing, and future Protheus AI systems.

This service intentionally starts without a crawler. Its first job is to persist manually submitted or agent-submitted sources, source-corpus relevance decisions, and source metadata behind a neutral `/v1/index/*` API.

## Scope

Current foundation:

- canonical indexed sources
- source snapshots with manual or fetched text extraction
- source corpus runs
- included/excluded source decisions
- source relevance preflight for large submitted source sets

Out of scope for this slice:

- broad web crawling
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
