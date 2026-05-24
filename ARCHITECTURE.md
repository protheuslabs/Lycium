# Lycium Architecture

## Boundary

Lycium web and Lycium backend services should stay in the same repository for now, but they should not be treated as one application.

- `Lycium web` is the learner-facing product surface.
- `Lycium backend` is the knowledge and generation infrastructure.

That means:

- Lycium web owns the public app, learner profile, course UX, AI classroom, progress, portfolio, and credentials.
- Lycium backend owns ingestion, extraction, cataloging, trust scoring, graph construction, hybrid retrieval, coverage maps, and generation orchestration.
- Shared contracts should live in internal packages and be consumed by both sides.

## Recommended Stack

### Monorepo and Tooling

- `pnpm` workspaces for package management
- `Turborepo` for task orchestration, caching, and monorepo ergonomics
- `TypeScript` for all JavaScript-facing apps and shared packages

### Learner-Facing App

- Current MVP app: `Next.js`
- Possible later public app: `Next.js` App Router
- `React 19`
- `TypeScript`
- `CSS Modules` or `Tailwind` for UI styling, but keep the UI package isolated either way

Reason:

- The current Next.js app is sufficient while Lycium is proving the local-first course-generation and learning loop.
- Do not migrate to Next.js until public SEO course pages, authenticated server-rendered app flows, or server-first routing become immediate product requirements.
- Next.js remains a reasonable later target once the core source-backed generation loop is dependable.

### Backend APIs and Workers

- `Python 3.13`
- `FastAPI`
- `Pydantic v2`
- `SQLAlchemy 2`
- `Playwright` for browser-based extraction

Reason:

- The Lycium backend is scraping, parsing, PDF handling, OCR, transcript work, extraction pipelines, ranking, and orchestration heavy. Python is the stronger language for that workload.
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
- `pgvector` explicitly supports hybrid search with Postgres full-text search, which fits Lycium's retrieval needs.

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

### Shared Contracts

- `packages/contracts` is the canonical course/source contract package.
- Frontend course types and validation should import from `@lycium/contracts`.
- Backend Pydantic validation should stay aligned with the JSON Schema files in `packages/contracts/schemas/`.
- LLM behavior remains governed by `COURSE_AGENT_CONTRACT.md`, but structural course validity belongs to the shared schema package.

## Recommended Repository Shape

```text
/
  apps/
    lycium-web/
  services/
    lycium-api/
    lycium-workers/
  packages/
    contracts/
    contracts/
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

### 1. Lycium Web App

Responsibilities:

- landing pages and public product surface
- authentication and learner accounts
- learner profile and preferences
- course browsing and discovery
- course player and AI classroom UI
- progress, portfolio, transcripts, and credentials

This app should talk to platform APIs rather than reaching directly into ingestion or graph internals.

### 2. Lycium API

Responsibilities:

- course generation API
- retrieval API
- search and catalog API
- learner snapshot and citation API
- admin and curation endpoints

This is the control plane between the web app and the repository or generation system.

### 3. Lycium Workers

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
10. Lycium renders that snapshot and records learner progress.

## Recommended Design Principles

- The URL is not the primary product object. The knowledge object is.
- The learner-facing course is a generated snapshot, not the repository itself.
- Canonical URLs stay primary even if archive references exist.
- Prefer connector-based ingestion before generic scraping.
- Prefer one strong system of record before introducing many specialized datastores.
- Keep Lycium web and backend services in one repo until the interfaces stabilize.

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
- Keep Lycium on `Next.js` for the MVP; consider `Next.js` later for public/SEO-heavy surfaces.
- Make Lycium backend a `FastAPI` plus worker platform in Python.
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

## Long-Term Application Shell

Lycium now targets Next.js as the learner-facing shell so the same product can run as a hosted browser app, a local-first app backed by `services/lycium-api`, and eventually an Infring-backed surface. The UI should avoid binding feature logic directly to Next server components; course traversal, validation, progress, and quiz behavior belong in shared packages so adapters can swap between local, cloud, static JSON, and Infring data sources.

## Data Access Boundary

`packages/data-access` defines the repository boundary for courses, progress, and generation jobs. The web app should move toward those interfaces rather than calling storage or APIs directly from view components. This keeps cloud course JSON, local generated courses, and future Infring-backed courses interchangeable at the app layer.

Current browser runtime calls for local API access, progress persistence, quiz attempt history, bookmarks, settings, and theme state should stay centralized in `@lycium/data-access`. Feature components should consume repository/client helpers instead of binding directly to `fetch()` or `localStorage`.

`services/lycium-api/app/contract_validation.py` loads the shared JSON Schemas from `packages/contracts/schemas` so backend course generation and frontend rendering are anchored to the same structural contract. Pydantic models may still describe API payloads, but generated course snapshots should be checked against the shared schema before being treated as valid Lycium course artifacts.

The initial adapter implementations live in `@lycium/data-access`: static JSON course repositories for cloud-hosted course snapshots, generic HTTP repositories for cloud APIs, and an Infring repository set that can be pointed at the eventual Infring course/progress/generation API. Next.js handles route/layout ownership while the learner runtime stays adapter-driven.

Architecture decisions that should remain stable across pivots are recorded in `docs/adr/`. New major stack, contract, storage, or deployment decisions should add or update an ADR before broad implementation work.
