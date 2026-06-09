# Lycium v1 Vision Todo

This todo list tracks the work needed to move Lycium from a strong local MVP toward the v1 vision: a local-first learning platform that turns source-backed internet knowledge into editable, reviewable, complete learning paths.

The operating principle is:

```text
source index -> curriculum evidence -> program/course generation -> editable learning artifact -> learner progress -> feedback/evals
```

## 1. Complete the generate-review-edit-publish loop

Status: In progress

Goal: A user should be able to generate a course or program, review the evidence and quality gates, edit the artifact safely, and publish only when it passes.

Todo:

- Add a unified generation run detail view for inputs, accepted/rejected sources, gates, model/provider, and final quality report.
- Make generated drafts appear in a consistent draft state with clear source gaps and review actions.
- Add publish readiness reasons when publishing is blocked.
- Add review checklist state so users can mark evidence, structure, quizzes, sources, and citations as reviewed.
- Ensure generated courses and manual/forked courses share the same editable block schema.
- Add an explicit artifact lifecycle: draft, needs_sources, ready_for_review, published, archived.

Acceptance:

- A generated course cannot silently enter the normal catalog unless its lifecycle state allows it.
- A reviewer can see why a course is blocked or publishable.
- Editing a generated course uses the same UI primitives as editing a manual course.

## 2. Strengthen source-to-concept coverage

Status: Partial

Goal: Each lesson block and concept should be traceable to sources that actually support that content.

Progress:

- Started direct concept source coverage metrics in the backend source-integrity gate.
- Added per-concept coverage rows to source-analysis artifacts so reviewers and future UI can see direct, inherited, and missing concept coverage.
- Added per-block source coverage rows and opt-in direct block source mapping enforcement for instructional blocks.
- Fed direct concept and block source coverage into the deterministic source-grounding quality eval.
- Legacy `conceptCards` stacks now inherit parent block `sourceIds` for direct concept coverage accounting.
- `metadata.sourceCoveragePolicy.requireDirectConceptSourceMappings` can make inherited-only concept coverage a source-analysis error.
- Source-gated drafts now preserve `conceptSourceNeeds` from failed source-analysis gates so users and agents can add targeted sources instead of guessing.
- Source-gap resume now checks concept-need relevance before queuing generation instead of unlocking solely from source URL count.
- Source-gap resume can now use `source-packet-v1` URLs and extracted document text when checking whether added sources satisfy missing concepts.
- The course source-gap modal now surfaces concept coverage, covered/uncovered concept chips, and normalized source-gap descriptions for local and API-backed drafts.
- Added helper-level web tests for source-gap concept coverage and backend/local source-gap field normalization.
- Source packets now report primitive concept usefulness metrics, including concept candidate count, covered candidate count, coverage ratio, and uncovered candidates.
- Deterministic course generation now blocks low concept-coverage source packets into `needs_sources` drafts instead of treating enough source URLs as sufficient.
- LLM and staged LLM course generation now reject low concept-coverage source packets before calling a model provider.

Todo:

- Require generated sections to cite only sources connected to that section's concepts.
- Add warnings for uncited instructional blocks.
- Add warnings for section citations that point to unrelated or unused sources.
- Add source coverage scoring per section, module, course, cluster, and program.
- Add fallback source slots for required concepts.

Acceptance:

- A course quality report can identify concepts with no source coverage.
- Section source lists only show sources used by that section.
- Course-wide source indexes preserve stable citation numbers without duplicating sources.

## 3. Expand realistic generation eval scenarios

Status: Partial

Goal: Course and program generation should be judged against repeatable scenarios that resemble real user inputs.

Todo:

- Add full-course eval scenarios for CHEM 105, Intro Programming, Software Architecture, and Pre-Med preparation.
- Add noisy multi-source corpus scenarios with irrelevant sources that must be rejected.
- Add under-sourced prompt scenarios that must produce source-gated drafts instead of weak full courses.
- Add program-generation evals that verify clusters, requirements, prerequisites, capstones, and course placeholders.
- Record eval trend artifacts for every CI run.
- Add pass/fail thresholds for source coverage, quiz density, citation quality, and prompt-like filler.

Acceptance:

- Fixed eval scenarios can detect course-generation regressions.
- Under-sourced generations become drafts with source needs instead of fake-complete courses.
- Program generations produce valid requirement-group structures, not ad hoc track lists.

## 4. Make program and pathway UX first-class

Status: Partial

Goal: Lycium should feel like a program/pathway platform, not only a course catalog.

Todo:

- Improve program, cluster, and course navigation so hierarchy is always visible.
- Add breadcrumb/path navigation for program -> cluster -> course routes.
- Add program and cluster progress rollups with completion and viewed/interacted layers.
- Show requirements inside clusters, including required, optional, elective, capstone, and project requirements.
- Add prerequisite visibility and direct navigation to prerequisite course searches.
- Add locked/editable controls for course groups so published clusters cannot be accidentally changed.

Acceptance:

- A learner can understand where a course sits inside a larger program.
- Program progress rolls up from course, project, assessment, and requirement completion.
- Cluster pages clearly explain what requirements are satisfied and what remains.

## 5. Improve source-index ingestion, search, and extraction

Status: Early

Goal: Source Index should become a durable, detachable evidence service that Lycium and other Protheus systems can use.

Todo:

- Add direct source submission UI/API independent of course creation.
- Add source-index search tooling that course generation can call before asking users for more sources.
- Add source candidate matching so new sources can be suggested for existing courses, concepts, or source gaps.
- Add extraction support for syllabus/catalog-like HTML, PDFs, and structured academic pages.
- Add source packet quality scoring for relevance, freshness, trust, accessibility, duplicates, and broken links.
- Add import/export formats that can move source-index records to a future standalone database.

Acceptance:

- Source Index can accept sources without going through the course modal.
- A generation workflow can search Source Index for relevant sources.
- Source packets are stable, serializable, and not coupled to Lycium UI assumptions.

## 6. Polish local authoring for non-dev users

Status: In progress

Goal: A user should be able to create, edit, fork, cite, save, cancel, import, and export courses without understanding the underlying JSON.

Todo:

- Improve edit-mode visual clarity for text, concept cards, video, iframe, heading, quiz, and source blocks.
- Add richer block insertion options without overloading the modal.
- Add drag-and-drop E2E coverage for block and section reorder behavior.
- Add course settings coverage for order enforcement and fork permissions.
- Add safer delete/revert UX for modules, sections, blocks, questions, and answers.
- Add import/export validation messaging for local drafts.

Acceptance:

- Manual course editing is covered by Playwright for save, cancel, citations, quizzes, sidebar edits, and source attachments.
- Users can recover from accidental edits before saving.
- Imported drafts fail clearly when invalid.

## 7. Build a course health dashboard

Status: Not started

Goal: Course health should combine generation quality, source coverage, learner feedback, source gaps, stale links, and review state.

Todo:

- Add a course health summary object to course metadata or local diagnostics.
- Surface source gaps, missing citations, low quiz density, stale links, and negative feedback.
- Combine thumbs up/down feedback with optional written feedback and source suggestions.
- Add source replacement status for broken or low-quality sources.
- Add review/publish status into the health summary.
- Add health badges on catalog cards for drafts, source gaps, review-ready, published, and needs attention.

Acceptance:

- A course owner can see what makes a course weak or strong.
- Feedback and eval data influence course health without exposing private learner data by default.
- Course cards can communicate incomplete, draft, or needs-review states clearly.

## 8. Strengthen import/export and versioning

Status: Partial

Goal: Courses, programs, source packets, and local user data should be portable and version-aware.

Todo:

- Add versioned migration tests for course, program, progress, provider, source packet, and draft schemas.
- Add local draft import/export schema validation.
- Add source packet import/export tests.
- Add conflict-safe restore behavior for imported drafts.
- Add user-facing version and migration messages when local data changes.
- Keep generated content, seed content, source-index data, and private user data clearly separated.

Acceptance:

- Old compatible fixtures migrate or fail clearly.
- Local data can be exported and restored without hidden app-state assumptions.
- Generated artifacts can move toward real database storage without contract rewrites.

## 9. Increase provenance visibility

Status: Partial

Goal: Learners and reviewers should understand why each requirement, module, lesson, source, and citation exists.

Todo:

- Display curriculum benchmark origins for course requirements.
- Show requirement origin frequency when derived from common academic benchmarks.
- Add source rationale to section source lists.
- Add course parity information to course detail modals.
- Connect program requirements to course, assessment, project, and source evidence.
- Add provenance summaries to generated review pages.

Acceptance:

- A reviewer can trace course structure back to sources and benchmark requirements.
- A learner can see why a course or requirement belongs in a program.
- Generated artifacts do not feel like unsupported model output.

## 10. Prove one full end-to-end path repeatedly

Status: Not complete

Goal: The system should repeatedly generate and validate a serious full path using repo mechanics, not hand-authored shortcuts.

Todo:

- Use the repo workflow to generate a full Pre-Med preparation program.
- Use the repo workflow to generate a full Software Engineering program.
- For each program, create clusters, course shells, prerequisites, source needs, and capstone/project evidence.
- Build at least one full course inside each generated program.
- Run quality gates and eval scenarios against the generated artifacts.
- Document what failed, what required manual intervention, and what should be automated next.

Acceptance:

- Lycium can generate a full program skeleton with valid clusters and course placeholders.
- The workflow can identify source gaps rather than hallucinating complete courses.
- At least one generated course can pass review-quality gates after source-backed editing.

## Near-term execution order

Recommended next sequence:

1. Complete source-to-concept coverage checks.
2. Add source-index search into generation preflight.
3. Add generation run detail records and a basic run detail UI.
4. Strengthen source-gated drafts and catalog health states.
5. Run a full Pre-Med program generation through repo mechanics.
6. Add drag-and-drop edit-mode E2E coverage.
7. Add course health summary objects.
8. Add source packet import/export tests.
9. Improve program/cluster requirement UX.
10. Repeat generation evals with messy source corpora.
