# Catalog Content Policy

Lycium now treats the learner catalog as a generated, imported, or user-authored artifact surface rather than a place for permanent sample content.

## Content classes

`catalog-content`

Courses and programs that appear in the learner catalog. These should come from one of three paths:

- Manual local draft creation.
- Source-backed generation through Lycium's course/program workflow.
- Import of a validated course/program artifact.

`test-fixture`

Static data used only by tests, evals, schema examples, and local developer checks. Fixtures may be hand-authored, but they must not be imported into the learner catalog registry.

`source-index-record`

Canonical source records, source snapshots, source packets, source decisions, and benchmark evidence. These are not catalog seeds. They can exist independently so Source Index can become a detachable Protheus service.

`user-local-data`

Progress, settings, provider keys, bookmarks, feedback, source suggestions, drafts, forks, and generated artifacts owned by the user's local workspace. These should stay out of committed catalog seed files.

## Guardrails

- `apps/lycium-web/src/courseData/localCourses.ts` starts empty.
- `apps/lycium-web/src/courseData/programs/index.ts` starts with no local programs.
- Tests that need courses or programs should define inline fixtures or use files under fixture-only roots.
- New visible seed courses or programs require an explicit product decision before implementation.
- Generated full courses that claim source-backed completeness should preserve source packet evidence or remain in a review/draft state.
- Under-sourced generation should create a `needs_sources` artifact with concept/source needs instead of weak learner-facing filler.
- Manual course creation should create a blank editable draft, not a hidden sample course.

## Enforcement

`pnpm check:seed-content` verifies that committed local course and program seed registries remain empty.

This lets the app reset cleanly while preserving the source-index and generation infrastructure needed to rebuild the catalog through real Lycium mechanics.
