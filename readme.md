# Lycium

Lycium is a local-first learning platform for building, organizing, and studying structured online courses. Courses are represented as JSON, rendered dynamically in a Next.js learner experience, and backed by a FastAPI control plane for course generation, source records, local progress, and user-owned settings.

The project is designed around one core idea: high-quality courses should be portable, inspectable, and generated from explicit structure rather than hidden application state.

[Product Vision](./VISION.md) | [MVP Vertical Slice](./MVP_VERTICAL_SLICE.md) | [Contracts](./CONTRACTS.md) | [Architecture](./ARCHITECTURE.md) | [ADRs](./docs/adr) | [Software Requirements Specification](./SRS.md) | [Demo Video](https://youtu.be/FjGd8ojGa14)

## Current capabilities

- Course catalog with canonical route support at `/Lycium/catalog`
- Generated course and unit URLs with stable slugs
- JSON-driven course rendering for modules, units, text, videos, concept cards, quizzes, and source references
- Collapsible course sidebar with independent scrolling and section status indicators
- Persistent progress tracking for completion and viewed/interacted percentages
- Course cards with progress layers, active module/unit context, metadata modals, categories, and tags
- Quiz attempts with shuffled question/answer order, timers, pass percentages, max attempts, review flags, and attempt history
- Settings modal for local AI provider keys, model selection, and light/dark/auto display preferences
- Local user-data storage for completion, bookmarks, secrets, source links, and other machine-specific data
- Course-generation rules for agents, including source records, assessment-only quiz pages, Learn/Apply page types, concept cards, and module summaries

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
│   └── lycium-workers/    # Async worker entrypoints for ingestion and generation jobs
└── skills/
    └── course-generation/   # Canonical agent instructions for authoring Lycium courses
```

## Tech stack

| Area | Tools |
| --- | --- |
| Web app | React 19, TypeScript, Next.js, Vitest, ESLint |
| Monorepo | pnpm 10, Turborepo |
| API | Python 3.13, FastAPI, Pydantic, SQLAlchemy, Uvicorn |
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
pnpm install
pnpm dev
```

Next.js will print the local URL. The catalog route is:

```text
http://localhost:<next-port>/Lycium/catalog
```

For the local port commonly used during development:

```bash
NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium pnpm --filter @lycium/web dev
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
```

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

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the web app through the monorepo script |
| `pnpm dev:all` | Start the web app and local API together |
| `pnpm dev:api` | Start the local FastAPI service |
| `pnpm build` | Build the web app |
| `pnpm test:contracts` | Run shared contract fixture tests |
| `pnpm validate` | Run contract tests, web typecheck, and web build |
| `pnpm --filter @lycium/web test` | Run web tests |
| `pnpm --filter @lycium/web lint` | Run web linting |
| `pnpm --filter @lycium/web typecheck` | Run TypeScript checks |
| `cd services/lycium-api && pytest -q` | Run API tests |
| `cd services/lycium-workers && PYTHONPATH=src pytest -q` | Run worker tests |

## Course content model

Lycium courses are structured data. A course is composed of modules, sections, content blocks, source references, progress metadata, and assessment metadata.

Important conventions:

- Course-generation behavior is defined in [skills/course-generation/SKILL.md](./skills/course-generation/SKILL.md).
- Courses should choose either `Module` or `Week` pacing language, not both.
- Learn pages contain instructional content.
- Apply pages contain quizzes, exercises, or assessments.
- Quiz blocks should not include instructional teaching content.
- Concept cards should list real, raw concepts introduced on the page, with concise descriptions.
- Module summary pages should gather concept cards introduced by the module rather than invent broad interpretive summaries.
- Sources should be recorded centrally and referenced by course/module/section/content IDs.

Local course data currently lives under:

```text
apps/lycium-web/src/courseData/
```

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

Do not commit secrets or machine-local learner data.

## Development notes

- Use conventional commit prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, and `chore:`.
- Keep reusable UI behavior in components rather than duplicating markup in page shells.
- Keep course and source-record contracts centralized in `packages/contracts`.
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
- Add review, edit, and lock workflows for generated sections
- Add focused validation and generation-rejection tests
- Improve retrieval quality after the source-backed loop is reliable
