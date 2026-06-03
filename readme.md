# Lycium

Lycium is an internet curriculum compiler for turning scattered free knowledge into structured, source-backed learning pathways. It is built for real skill development and vertical understanding: prerequisites, concepts, practice, assessment, projects, provenance, and mastery evidence.

Courses and programs are represented as portable JSON snapshots, rendered dynamically in a Next.js learner experience, and backed by a FastAPI control plane for generation, source records, local progress, and user-owned settings.

The project is designed around one core idea: the internet already has enough educational information, but learners need coherent pathways, source evidence, and feedback loops to turn that information into capability.

[Product Vision](./VISION.md) | [Product Principles](./docs/product-principles.md) | [Data Boundaries](./docs/data-boundaries.md) | [Data Use and Trust](./docs/data-use-and-trust.md) | [MVP Vertical Slice](./MVP_VERTICAL_SLICE.md) | [Contracts](./CONTRACTS.md) | [Architecture](./ARCHITECTURE.md) | [Professional Readiness](./docs/professional-readiness.md) | [Deployment](./docs/deployment.md) | [ADRs](./docs/adr) | [Software Requirements Specification](./SRS.md) | [Demo Video](https://youtu.be/FjGd8ojGa14)

## Mission and trust model

Lycium should make public internet knowledge usable for building real skills. The reusable data flywheel should come primarily from public source and curriculum infrastructure:

- source records and snapshots
- curriculum benchmarks
- requirement origins
- source slots and fallback evidence
- concept and prerequisite graphs
- course/program quality signals
- rubrics and portfolio requirements

Private learner data is a separate trust zone. Progress, quiz attempts, goals, notes, feedback linked to identity, and local provider secrets should remain user-owned, exportable, deletable, and protected from silent repurposing.

## Current capabilities

- Course catalog with canonical route support at `/Lycium/catalog`
- Generated course and unit URLs with stable slugs
- JSON-driven course rendering for modules, units, text, videos, concept cards, quizzes, and source references
- Collapsible course sidebar with independent scrolling and section status indicators
- Persistent progress tracking for completion and viewed/interacted percentages
- Course cards with progress layers, active module/unit context, metadata modals, categories, and tags
- Catalog search, pagination, sorting, college and department filters, and an internal college-to-department taxonomy for course classification
- Program and cluster catalog views with requirement-based progress rollups, prerequisite continuity, requirement detail panels, and portfolio/capstone evidence records
- Quiz attempts with shuffled question/answer order, timers, pass percentages, max attempts, review flags, and attempt history
- Settings modal for local AI provider keys, model selection, and light/dark/auto display preferences
- Course creation modal that stays locked until a valid active AI provider key and model are connected
- Local user-data storage for completion, bookmarks, secrets, source links, and other machine-specific data
- Course-generation rules for agents, including source records, assessment-only quiz pages, Learn/Apply page types, concept cards, and module summaries
- Software engineering program/catalog scaffolds with prerequisite metadata, college-course parity metadata, requirement origins, portfolio artifacts, and generated module/quiz/summary structure
- Course quality reports and a review/publish lifecycle so generated snapshots can be gated before catalog visibility
- Course-generation eval scenarios for CHEM 105, intro programming, software engineering methods, noisy source corpora, under-sourced prompts, and full-stack program paths
- Retrieval quality reports for source-backed search and learning-packet assembly
- Professional readiness guardrails for review/publish, benchmarks, extraction, evals, providers, observability, contracts, migrations, secrets, and deployment
- Playwright E2E coverage for catalog views, program/cluster navigation, search/filter/sort behavior, locked courses, settings, and course-opening flow

## Repository structure

```text
.
├── apps/
│   └── lycium-web/          # Next.js learner-facing web app
├── packages/
│   ├── config/              # Shared configuration package stub
│   ├── contracts/           # Shared Lycium contracts, schemas, and validation helpers
│   ├── data-access/         # Runtime adapters for local, static, cloud, and Infring modes
│   ├── retrieval-sdk/       # Shared retrieval SDK package stub
│   └── ui/                  # Shared UI package stub
├── services/
│   ├── lycium-api/        # FastAPI API for local data, generation, analytics, and course snapshots
│   ├── lycium-workers/    # Async worker entrypoints for ingestion and generation jobs
│   └── source-index/      # Standalone Protheus source reference index service
└── skills/
    └── course-generation/   # Canonical agent instructions for authoring Lycium courses
```

## Tech stack

| Area | Tools |
| --- | --- |
| Web app | React 19, TypeScript, Next.js, Vitest, ESLint |
| Monorepo | pnpm 10, Turborepo |
| API | Python 3.13, FastAPI, Pydantic, SQLAlchemy, Uvicorn |
| Source index | Python 3.13, FastAPI, Pydantic, SQLAlchemy, HTTPX, BeautifulSoup |
| Workers | Python 3.13, HTTPX, Pydantic |
| Course content | JSON course records with centralized source records |

## Quick start

### Prerequisites

- Node.js with Corepack enabled
- pnpm 10
- Python 3.13 for API and worker development

### Web app

```bash
corepack enable
corepack pnpm install
corepack pnpm dev:all
```

Next.js will print the local URL. The catalog route is:

```text
http://localhost:<next-port>/Lycium/catalog
```

For the local port commonly used during development:

```bash
NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium corepack pnpm dev:web
```

Then open:

```text
http://localhost:5001/Lycium/catalog
```

Runtime mode is configured with public environment variables:

```text
NEXT_PUBLIC_LYCIUM_RUNTIME=local|static|cloud|infring
NEXT_PUBLIC_LYCIUM_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_LYCIUM_COURSE_CATALOG_URL=https://example.com/catalog.json
NEXT_PUBLIC_LYCIUM_COURSE_BASE_URL=https://example.com/courses
LYCIUM_API_TOKEN=optional-bearer-token-for-non-public-API-runtimes
LYCIUM_SOURCE_INDEX_API_URL=http://127.0.0.1:8100
LYCIUM_SOURCE_INDEX_TIMEOUT_SECONDS=20
```

If `LYCIUM_API_TOKEN` is set, callers must send `Authorization: Bearer <token>` for protected API paths.

### API service

```bash
cd services/lycium-api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
lycium-api
```

The API defaults to:

```text
http://127.0.0.1:8000
```

### Worker service

Run this in a separate shell while the API is available:

```bash
cd services/lycium-workers
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
LYCIUM_API_URL=http://127.0.0.1:8000 lycium-worker --once
```

### Source index service

The source index is a neutral Protheus service boundary intended to be reusable by Lycium, InfRing, and future AI systems. It starts with canonical source records, source snapshots, crawl policy contracts, corpus runs, and include/exclude source decisions.

```bash
cd services/source-index
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
source-index-api
```

The source index defaults to:

```text
http://127.0.0.1:8100
```

When `LYCIUM_SOURCE_INDEX_API_URL` is set on the Lycium API, Lycium routes `/v1/index/*` requests to this standalone service and uses its snapshots as upstream evidence for curriculum benchmark extraction. When the variable is unset, Lycium uses its transitional internal source tables for local development.

## Useful commands

| Command | Description |
| --- | --- |
| `corepack pnpm dev` | Start the web app through the monorepo script |
| `corepack pnpm dev:all` | Start the web app and local API together |
| `corepack pnpm dev:api` | Start the local FastAPI service |
| `corepack pnpm dev:source-index` | Start the standalone source index service |
| `corepack pnpm build` | Build the web app |
| `corepack pnpm test:contracts` | Run shared contract fixture tests |
| `corepack pnpm validate` | Run contract tests, web typecheck, and web build |
| `corepack pnpm --filter @lycium/web test` | Run web tests |
| `corepack pnpm --filter @lycium/web e2e` | Run Playwright catalog/course smoke tests |
| `corepack pnpm --filter @lycium/web lint` | Run web linting |
| `corepack pnpm --filter @lycium/web typecheck` | Run TypeScript checks |
| `cd services/lycium-api && pytest -q` | Run API tests |
| `cd services/source-index && pytest -q` | Run source index tests |
| `cd services/lycium-workers && PYTHONPATH=src pytest -q` | Run worker tests |

## Course content model

Lycium courses are structured data. A course is composed of modules, sections, content blocks, source references, progress metadata, and assessment metadata.

Important conventions:

- Course-generation behavior is defined in [skills/course-generation/SKILL.md](./skills/course-generation/SKILL.md).
- Generated course snapshots should move through quality-report, review, and publish gates before being listed as catalog-ready.
- Courses should choose either `Module` or `Week` pacing language, not both.
- Learn pages contain instructional content.
- Apply pages contain quizzes, exercises, or assessments.
- Quiz blocks should not include instructional teaching content.
- Concept cards should list real, raw concepts introduced on the page, with concise descriptions.
- Module summary pages should gather concept cards introduced by the module rather than invent broad interpretive summaries.
- Sources should be recorded centrally and referenced by course/module/section/content IDs.
- Catalog categories are university-style colleges/schools. Department data lives under each college in `courseTaxonomy.ts`, and the catalog filter panel exposes department filtering after a college is selected.

Local course data currently lives under:

```text
apps/lycium-web/src/courseData/
```

The hosted static app is deployed through GitHub Pages at:

```text
https://protheuslabs.github.io/Lycium/
```

The Pages workflow builds the Next.js static export with `NEXT_OUTPUT=export`, `NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium`, and `NEXT_PUBLIC_LYCIUM_RUNTIME=static`.

## Local data and secrets

Lycium keeps user-specific data out of source control. The repo ignores local data directories such as:

```text
.data/
.lycium-local/
```

These are intended for data such as:

- API keys and provider settings
- local progress records
- course bookmarks
- generated course snapshots
- source links and local source metadata
- source index SQLite databases and source-corpus decision records

Do not commit secrets or machine-local learner data.

## Development notes

- Use conventional commit prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, and `chore:`.
- Keep reusable UI behavior in components rather than duplicating markup in page shells.
- Keep course and source-record contracts centralized in `packages/contracts`.
- Treat `packages/contracts` lifecycle and quality-report schemas as the canonical gate between generated drafts and catalog-published courses.
- Keep browser storage, local API access, progress, quiz attempts, settings, bookmarks, and generation calls behind `packages/data-access`.
- Use `@lycium/data-access` repository factories for static JSON, local API, cloud API, and future Infring-backed runtimes instead of branching learner UI logic.
- Keep course progress logic centralized in `apps/lycium-web/src/utils/courseProgress.ts`.
- Keep course route and slug behavior centralized in `apps/lycium-web/src/utils/courseRouting.ts`.
- Prefer explicit source records over free-floating URLs in course JSON.
- Preserve ignored local-data directories so the app can be cloned and run without personal state.

## Roadmap

The next phase is intentionally constrained by the [MVP vertical slice](./MVP_VERTICAL_SLICE.md): topic and sources in, validated source-backed course snapshot out.

- Connect catalog source links and files to source-record creation
- Generate courses from source records, not prompt text alone
- Reject invalid generated course JSON before catalog insertion
- Deepen review, edit, and lock workflows for generated sections
- Add focused validation, source-ingestion, and generation-rejection tests
- Expand E2E coverage into generated-course review and source-index flows
- Improve retrieval quality after the source-backed loop is reliable
