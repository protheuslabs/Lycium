# Lycium Contracts

Lycium should use explicit contracts instead of ad hoc frontend/backend shape assumptions.

## Canonical Contract Package

The canonical content contract lives in:

```text
packages/contracts/
```

This package owns:

- TypeScript course and source-record types
- Course validation helpers
- JSON Schema files for cross-language validation
- Contract version metadata

## Contract Layers

1. Structural contract
   `packages/contracts` defines the valid shape of courses, modules, sections, blocks, quizzes, concept cards, and source records.

2. Behavioral generation contract
   `COURSE_AGENT_CONTRACT.md` defines how LLM agents should behave when producing course JSON.

3. Course-authoring rules
   `COURSE_GENERATION_RULES.md` and `skills/course-generation/` define the curriculum rules agents must follow.

4. Product slice contract
   `MVP_VERTICAL_SLICE.md` defines the current product boundary and what must be true before a generated course reaches learners.

## Frontend Rule

The web app should import course types and validation from `@lycium/contracts`.

It should not define independent course-shape validators except as thin compatibility wrappers.

## Backend Rule

The backend may use Pydantic and Python helpers internally, but backend validation must remain semantically aligned with `packages/contracts`.

The backend should load JSON Schema from `packages/contracts/schemas/` or generate Python validation from the same source so API, worker, web, and agents do not drift.

## Versioning Rule

Any breaking change to course JSON should update `LYCIUM_COURSE_CONTRACT_VERSION` in `@lycium/contracts` and include a migration note.

## Repository Adapter Contract

`packages/data-access` is the runtime data boundary. UI features should depend on repository interfaces for course lists, course snapshots, learner progress, and generation jobs. Local API, static JSON, cloud API, and future Infring adapters should implement those interfaces without changing course rendering components.
