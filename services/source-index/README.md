# Source Index Service

Source Index is the durable boundary for public learning-source data. Lycium can run it inside this monorepo today, but Source Index should remain extractable into an independent service that can feed Lycium, InfRing, and other Protheus systems through the same API contracts.

## Responsibilities

- Store canonical source records separately from course JSON.
- Store snapshots and extracted text so course generation can use evidence, not loose links.
- Record source-corpus preflight decisions before generation uses a submitted source list.
- Search indexed records and analyze whether new sources may fit existing abstract learning targets.
- Emit `source-packet-v1` records that package source decisions, snapshots, source documents, warnings, and evidence refs.
- Support narrow crawl policies for education-focused indexing without coupling the crawler to Lycium UI code.

## Current API Surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check service availability. |
| `GET` | `/v1/index/service-contract` | Read the portable service boundary, stable contracts, endpoints, and ownership rules. |
| `POST` | `/v1/index/sources` | Upsert one indexed source. |
| `GET` | `/v1/index/sources` | Search/list indexed sources by query, domain, or source type. |
| `GET` | `/v1/index/sources/{source_id}` | Read one indexed source. |
| `POST` | `/v1/index/source-imports` | Import a manual source batch and optionally create snapshots. |
| `POST` | `/v1/index/search` | Search indexed source records and snapshots for reusable evidence. |
| `POST` | `/v1/index/source-fit` | Compare submitted/indexed sources against abstract target descriptors and return review candidates. |
| `POST` | `/v1/index/sources/{source_id}/snapshots` | Create a fetched or manually supplied snapshot. |
| `GET` | `/v1/index/sources/{source_id}/snapshots` | List snapshots for a source. |
| `POST` | `/v1/index/corpus-runs` | Run source-corpus preflight for a prompt and submitted URLs/documents. |
| `GET` | `/v1/index/corpus-runs/{run_id}` | Read source-corpus preflight output. |
| `POST` | `/v1/index/source-packets` | Create a generation-ready source packet. |
| `GET` | `/v1/index/source-packets/{run_id}` | Read a source packet by corpus run ID. |
| `POST` | `/v1/index/crawl-policies` | Save an education-focused crawl policy. |
| `GET` | `/v1/index/crawl-policies` | List crawl policies. |
| `POST` | `/v1/index/crawl-runs` | Create a crawl run and seed tasks. |
| `GET` | `/v1/index/crawl-runs/{run_id}/tasks` | Inspect crawl seed tasks. |

## Import Contract

Manual imports should use `source-import-batch-v1`.

```json
{
  "batch_id": "manual-software-engineering-001",
  "sources": [
    {
      "url": "https://example.edu/course/syllabus",
      "title": "Example Syllabus",
      "source_type": "syllabus",
      "license": "unknown",
      "is_free": true,
      "raw_text": "Extracted or pasted source text..."
    }
  ]
}
```

The service returns source IDs, snapshot IDs, row warnings, and batch-level warnings. Courses should reference returned evidence through source packets or benchmark records rather than copying untracked source text into course JSON.

## Direct Manual Import

Source Index is intentionally usable without a Lycium course context. Operators can submit sources directly through:

- the Source Index admin page at `/source-index`
- `POST /v1/index/source-imports`
- the `source-index-import-batch` CLI entrypoint

Direct imports should store source-level context in item `metadata`, such as:

```json
{
  "origin": "direct_source_index_admin",
  "intended_use": "curriculum_benchmark",
  "topic": "General Chemistry",
  "tags": ["chemistry", "open-courseware"],
  "notes": "Useful as benchmark evidence for first-semester chemistry."
}
```

This keeps Source Index detachable: a source may be indexed because it is broadly useful public knowledge, not because it already belongs to a course. Courses, programs, crawlers, and InfRing-style research tools should consume the indexed source records later through source packets, benchmark records, or stable source IDs.

## Reverse Lookup Primitives

Source Index supports two reverse lookup flows so consumers can draw from the index instead of only submitting to it.

### Search

`POST /v1/index/search` accepts a generic query, optional source-type/topic/domain/free filters, and a limit. It returns ranked source records, latest snapshot evidence when available, matched terms, summaries, and evidence refs. Course or program generators should use this during source enrichment, missing-concept coverage, and replacement-source discovery.

### Source Fit

`POST /v1/index/source-fit` accepts one or more submitted/indexed sources and a list of abstract target descriptors:

```json
{
  "sources": [{ "source_id": 12 }],
  "targets": [
    {
      "target_id": "course:chem-105",
      "target_type": "course",
      "title": "General Chemistry I",
      "description": "First-semester chemistry.",
      "concepts": ["stoichiometry", "atomic structure"],
      "requirements": ["balance chemical equations"]
    }
  ],
  "limit": 20
}
```

The response is a ranked candidate list. Source Index does not attach the source to a course or program. Consumers own review, acceptance, rejection, and downstream source-slot updates.

## Source Packet Contract

Course generation should prefer `source-packet-v1`.

```json
{
  "consumer": "lycium-course-generation",
  "context_id": "chem-105-2026-05",
  "prompt": "Create a first-semester general chemistry course.",
  "source_urls": ["https://openstax.org/books/chemistry-2e/pages/1-introduction"],
  "fetch_sources": true,
  "snapshot_limit": 1
}
```

The response packages included source decisions, snapshots, evidence refs, source documents, synthesis, and warnings. Generation gates should fail or request review when a packet has no included sources, no source documents, or warnings that undermine source coverage.

## Benchmark Ingestion Role

Curriculum benchmark extraction should treat the source index as the upstream evidence provider:

1. Import or fetch source records.
2. Create snapshots with extracted text.
3. Create a source packet for a course/program prompt.
4. Extract curriculum benchmarks from packet `source_documents`.
5. Convert benchmark requirements into requirement origins, source slots, course parity, and program/course requirements.

This keeps benchmark evidence reusable across courses and prevents generated courses from becoming isolated one-off artifacts.

## Extraction Boundary

The source index should not import Lycium course renderer code. It can know about source packets, snapshots, crawl policies, and generic corpus preflight. Lycium-specific course planning, module generation, quiz generation, and review/publish state should remain in Lycium services.

## Service Contract

`GET /v1/index/service-contract` and `source-index-service-contract` export `source-index-service-v1`, a small manifest for consumers and future repo extraction. The manifest declares:

- portable contracts emitted or accepted by the service
- stable endpoint paths
- standalone CLI commands
- data the service owns
- data and workflows the service explicitly does not own
- expectations for downstream consumers preserving packet IDs and evidence references

This keeps the service boundary explicit as Source Index grows from Lycium-local infrastructure into a reusable evidence service.
