# Lycium

Lycium is a source-backed learning platform for building coherent courses, practicing concepts, and measuring progress. It combines a learner-facing Next.js application with portable course data, local-first learner state, source records, and services for course generation and retrieval.

The project is built around a simple idea: information is abundant, but learning needs structure. Lycium turns goals and evidence into pathways with prerequisites, explanations, practice, assessments, citations, and reviewable quality signals.

[Product vision](./VISION.md) · [Architecture](./ARCHITECTURE.md) · [Contracts](./CONTRACTS.md) · [Deployment](./docs/deployment.md) · [Course generation skill](./skills/course-generation/SKILL.md)

## Product areas

`apps/lycium-web` is the React and Next.js learner application. It provides the course catalog, course reader, progress tracking, settings, local course editing, and standalone learning tools.

Current tools include:

- **Orvane** — an interactive graphing workspace for functions, parameters, restrictions, piecewise expressions, datasets, regression, intersections, tangents, tables, integrals, annotations, import/export, and editable share links.
- **Flashcards** — local-first decks with card editing, import/export, audio, study sessions, keyboard and touch interactions, color customization, and agent-generated deck documents.

Both tools use isolated workspaces so they can later be embedded in courses, presentations, and assessments.

The repository also contains:

- `services/lycium-api` — FastAPI service for local data, generation runs, source records, course snapshots, and learner integrations.
- `services/lycium-workers` — asynchronous ingestion and generation jobs.
- `services/source-index` — reusable source records, snapshots, crawl decisions, corpus runs, and evidence quality.
- `packages/contracts` — shared schemas and validation helpers.
- `packages/data-access` — runtime adapters for local, static, cloud, and InfRing modes.
- `skills/course-generation` — the canonical workflow for agent-authored Lycium courses.

## Course generation loop

1. A learner or author provides a goal, source links, pasted material, or a source packet.
2. Source Index imports evidence, creates snapshots, and reports coverage, freshness, duplicates, broken links, and source types.
3. Lycium extracts benchmarks, requirements, concepts, prerequisites, and source relationships.
4. If evidence is insufficient, the system records source gaps and keeps the draft reviewable.
5. If coverage is sufficient, generation creates a structured course or program snapshot with lessons, Learn and Apply sections, concept cards, quizzes, summaries, citations, and metadata.
6. Validation and quality gates decide whether the snapshot is ready for review or catalog publication.
7. Learner progress, attempts, notes, bookmarks, and feedback remain separate from portable course and source artifacts.

Course content is represented as portable JSON. Course-generation behavior is defined by [skills/course-generation/SKILL.md](./skills/course-generation/SKILL.md).

- Learn pages teach the material.
- Apply pages contain quizzes, exercises, or assessments.
- Quiz pages should not contain instructional teaching content.
- Concept cards should contain concepts introduced on the page.
- Module summaries should gather concepts introduced by the module.
- Sources are recorded centrally and referenced by course, module, section, and content IDs.
- Generated snapshots should pass quality, review, and publish gates before becoming catalog-ready.

Local course data is stored under `apps/lycium-web/src/courseData/`.

## Agent interfaces

Lycium exposes reusable, deterministic TypeScript contracts for its interactive tools.

Orvane’s shared interface is in `apps/lycium-web/src/components/Tools/graphAgent.ts` and supports `createGraph`, `analyzeGraph`, editable graph-link serialization, and framework-neutral HTTP handling.

Flashcards’ shared interface is in `apps/lycium-web/src/components/Flashcards/flashcardAgent.ts` and supports `createFlashcardDeck`, `validateFlashcardDeck`, and output in the existing `lycium-flashcard-deck-v1` import format. Its HTTP handler exposes `create_deck` and `validate_deck` operations.

These contracts allow course tooling to generate a graph or deck that a learner can open and continue editing. GitHub Pages hosts the current frontend as a static export, so it cannot execute public server endpoints. The handlers are ready to be mounted by a Node, Vercel, Cloudflare, or MCP adapter without creating a second content or mathematical engine. Authentication and rate limiting belong at that adapter boundary.

See [`apps/lycium-web/public/llms.txt`](./apps/lycium-web/public/llms.txt) for concise product documentation intended for language-model discovery.

## Repository layout

```text
.
├── apps/
│   └── lycium-web/          # Next.js learner application
├── packages/
│   ├── config/              # Shared configuration
│   ├── contracts/           # Schemas and validation
│   ├── data-access/         # Runtime data adapters
│   ├── retrieval-sdk/       # Retrieval foundations
│   └── ui/                  # Shared UI foundations
├── services/
│   ├── lycium-api/          # FastAPI application
│   ├── lycium-workers/      # Background jobs
│   └── source-index/        # Source evidence service
├── skills/
│   └── course-generation/   # Course authoring workflow
└── docs/                    # Product, deployment, trust, and architecture docs
```

## Technology

| Area | Technology |
| --- | --- |
| Web | React 19, TypeScript, Next.js, Vitest, Playwright |
| Monorepo | pnpm 10, Turborepo |
| API | Python 3.13, FastAPI, Pydantic, SQLAlchemy, Uvicorn |
| Source Index | FastAPI, SQLAlchemy, HTTPX, BeautifulSoup |
| Graphing | `function-plot`, TypeScript mathematical utilities |
| Flashcards | Browser storage, `ts-fsrs`, validated JSON import/export |

## Quick start

### Requirements

- Node.js with Corepack enabled
- pnpm 10
- Python 3.13 for API, worker, and Source Index development

### Web app

```bash
corepack enable
corepack pnpm install
NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium corepack pnpm dev:web
```

Open `http://localhost:5001/Lycium/`.

The web app can also run through:

```bash
corepack pnpm dev:all
```

Useful public environment variables include:

```text
NEXT_PUBLIC_LYCIUM_RUNTIME=local|static|cloud|infring
NEXT_PUBLIC_LYCIUM_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium
NEXT_PUBLIC_SITE_URL=https://example.com
```

### API

```bash
cd services/lycium-api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
lycium-api
```

The API defaults to `http://127.0.0.1:8000`.

### Worker

```bash
cd services/lycium-workers
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
LYCIUM_API_URL=http://127.0.0.1:8000 lycium-worker --once
```

### Source Index

```bash
cd services/source-index
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e '.[test]'
source-index-api
```

The Source Index defaults to `http://127.0.0.1:8100`.

## Development commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Start the web app through the monorepo script |
| `corepack pnpm dev:all` | Start the web app and local API |
| `corepack pnpm build` | Build the web app |
| `corepack pnpm validate` | Run the main validation workflow |
| `corepack pnpm validate:mvp` | Run the broader MVP validation sweep |
| `corepack pnpm --filter @lycium/web test` | Run web unit tests |
| `corepack pnpm --filter @lycium/web typecheck` | Run TypeScript checks |
| `corepack pnpm --filter @lycium/web e2e` | Run Playwright tests |
| `corepack pnpm --filter @lycium/web lint` | Run web linting |
| `cd services/lycium-api && pytest -q` | Run API tests |
| `cd services/source-index && pytest -q` | Run Source Index tests |
| `cd services/lycium-workers && PYTHONPATH=src pytest -q` | Run worker tests |

When changing local course authoring, run:

```bash
corepack pnpm test:e2e:manual-editing
```

## Trust and data boundaries

Lycium treats reusable educational infrastructure and private learner data as separate zones.

Reusable infrastructure includes source records, snapshots, curriculum benchmarks, requirement origins, concept graphs, course quality reports, and publication metadata. Learner state includes progress, quiz attempts, goals, notes, feedback, local drafts, and provider secrets. Learner data should remain user-owned, exportable, deletable, and protected from silent reuse.

See [data boundaries](./docs/data-boundaries.md), [data use and trust](./docs/data-use-and-trust.md), and [professional readiness](./docs/professional-readiness.md).

## Deployment

The learner application is configured for a static GitHub Pages export under `/Lycium`. API and worker deployments require a runtime capable of executing Python services. See the [deployment documentation](./docs/deployment.md) for environment variables, static-export behavior, and service configuration.

Lycium is under active development. Interfaces and schemas may evolve, while portable course data, explicit source evidence, local learner ownership, and reviewable generation remain core design commitments.
