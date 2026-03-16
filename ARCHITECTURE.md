# Lyceum / Protheus Architecture

## Boundary

Lyceum and the Protheus platform should stay in the same repository for now, but they should not be treated as one application.

- `Lyceum` is the learner-facing product.
- `Protheus platform` is the knowledge and generation infrastructure.

That means:

- Lyceum owns the public web app, learner profile, course UX, AI classroom, progress, portfolio, and credentials.
- Protheus owns ingestion, extraction, cataloging, trust scoring, graph construction, hybrid retrieval, coverage maps, and generation orchestration.
- Shared contracts should live in internal packages and be consumed by both sides.

## Recommended Stack

### Monorepo and Tooling

- `pnpm` workspaces for package management
- `Turborepo` for task orchestration, caching, and monorepo ergonomics
- `TypeScript` for all JavaScript-facing apps and shared packages

### Learner-Facing App

- `Next.js` App Router
- `React 19`
- `TypeScript`
- `CSS Modules` or `Tailwind` for UI styling, but keep the UI package isolated either way

Reason:

- Next.js is a full-stack React framework with App Router support and strong server and client rendering patterns.
- Lyceum needs SEO-friendly public pages, authenticated app flows, and a rich interactive client surface.

### Platform APIs and Workers

- `Python 3.13`
- `FastAPI`
- `Pydantic v2`
- `SQLAlchemy 2`
- `Playwright` for browser-based extraction

Reason:

- The Protheus side is scraping, parsing, PDF handling, OCR, transcript work, extraction pipelines, ranking, and orchestration heavy. Python is the stronger language for that workload.
- FastAPI, Pydantic, and SQLAlchemy give you a fast API layer with strong typed contracts and mature Postgres support.

### Data Layer

- `PostgreSQL 17+` as the system of record
- `pgvector` for vector similarity search
- PostgreSQL full-text search for lexical retrieval
- `Redis` or `Valkey` for queues, caching, and rate limiting
- `S3-compatible object storage` such as Cloudflare R2, AWS S3, or MinIO for raw artifacts, cleaned text, screenshots, PDFs, and extraction outputs

Reason:

- Start with Postgres as the canonical database instead of introducing a graph database and a search cluster immediately.
- The repository needs transactional metadata, JSON payloads, graph-like edges, and hybrid search. Postgres handles all of that well enough at the early stage.
- `pgvector` explicitly supports hybrid search with Postgres full-text search, which fits Lyceum's retrieval needs.

### Search and Graph

- Start with `PostgreSQL + pgvector + full-text search`
- Keep graph relationships in relational tables first
- Add `OpenSearch` later only if catalog scale or retrieval latency outgrows Postgres

Reason:

- Do not start with a separate graph database or search cluster unless the product proves you need them.
- The hard part is the data model and retrieval logic, not adopting more infrastructure early.

### Jobs and Workflow Orchestration

- Start with a simple queue backed by `Redis` or `Valkey`
- Add durable workflow orchestration later if multi-step ingestion and generation flows become operationally painful

Reason:

- The scraping and generation workflows will be asynchronous, but the repo does not need maximum workflow complexity on day one.
- Keep the first version operationally simple.

### Observability

- `OpenTelemetry`
- structured logs
- metrics and traces for ingestion, retrieval, and generation pipelines

## Recommended Repository Shape

```text
/
  apps/
    lyceum-web/
  services/
    protheus-api/
    protheus-workers/
  packages/
    contracts/
    content-schema/
    ui/
    config/
    retrieval-sdk/
  docs/
    architecture/
  infra/
    docker/
    migrations/
    terraform/
```

For this repository specifically, the docs can remain at the root until there are enough of them to justify moving them under `docs/`.

## Recommended Application Architecture

### 1. Lyceum Web App

Responsibilities:

- landing pages and public product surface
- authentication and learner accounts
- learner profile and preferences
- course browsing and discovery
- course player and AI classroom UI
- progress, portfolio, transcripts, and credentials

This app should talk to platform APIs rather than reaching directly into ingestion or graph internals.

### 2. Protheus API

Responsibilities:

- course generation API
- retrieval API
- search and catalog API
- learner snapshot and citation API
- admin and curation endpoints

This is the control plane between the web app and the repository or generation system.

### 3. Protheus Workers

Responsibilities:

- source ingestion
- connector runs
- scraping fallback
- extraction and normalization
- trust scoring
- graph updates
- revalidation and freshness jobs
- generation pipeline jobs

These workers should be asynchronous and queue-driven.

### 4. Canonical Data Stores

Use separate logical storage layers:

- `Postgres`: canonical metadata, graph edges, learner state, generated course snapshots
- `Object storage`: raw HTML, PDFs, OCR outputs, transcripts, cleaned text blobs, extracted artifacts
- `Redis/Valkey`: queue, cache, rate limit, short-lived retrieval caches

## Recommended Data Flow

1. A connector or scraper discovers a source.
2. The source is canonicalized and stored as a `Source`.
3. A fetch produces a `Snapshot`.
4. Extraction creates cleaned artifacts and structured metadata.
5. The extractor emits `Knowledge Objects` and optional `Claims`.
6. Trust scoring and graph-building jobs enrich those objects.
7. Coverage-map jobs identify gaps and weak areas.
8. A learner request triggers retrieval over the graph and repository.
9. The generation pipeline assembles a course snapshot from knowledge objects.
10. Lyceum renders that snapshot and records learner progress.

## Recommended Design Principles

- The URL is not the primary product object. The knowledge object is.
- The learner-facing course is a generated snapshot, not the repository itself.
- Canonical URLs stay primary even if archive references exist.
- Prefer connector-based ingestion before generic scraping.
- Prefer one strong system of record before introducing many specialized datastores.
- Keep Lyceum and Protheus in one repo until the interfaces stabilize.

## What I Would Not Do Yet

- separate repos
- graph database first
- OpenSearch first
- full mirroring of third-party content
- too many microservices
- workflow engines with heavy operational overhead before queue-driven jobs become insufficient

## Short Recommendation

If you want one opinionated answer:

- Keep one monorepo.
- Make Lyceum a `Next.js` app.
- Make Protheus a `FastAPI` plus worker platform in Python.
- Use `Postgres + pgvector + full-text search + object storage + Redis`.
- Model the repository around knowledge objects, snapshots, claims, and graph edges.
- Delay extra infrastructure until scale forces it.

## References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js overview](https://nextjs.org/docs)
- [pnpm workspaces](https://pnpm.io/)
- [Turborepo docs](https://turborepo.com/repo/docs)
- [Turborepo package and task graphs](https://turborepo.com/repo/docs/core-concepts/package-and-task-graph)
- [FastAPI docs](https://fastapi.tiangolo.com/)
- [FastAPI tutorial](https://fastapi.tiangolo.com/tutorial/)
- [Pydantic docs](https://docs.pydantic.dev/)
- [SQLAlchemy 2.0 docs](https://docs.sqlalchemy.org/20/)
- [PostgreSQL full-text search](https://www.postgresql.org/docs/current/static/textsearch.html)
- [pgvector](https://github.com/pgvector/pgvector)
- [Playwright docs](https://playwright.dev/docs/intro)
- [OpenTelemetry docs](https://opentelemetry.io/docs/)
