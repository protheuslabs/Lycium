# Lycium v1 Vision Todo

This todo list tracks the work needed to move Lycium from a strong local MVP toward the v1 vision: a local-first learning platform that turns source-backed internet knowledge into editable, reviewable, complete learning paths.

The operating principle is:

```text
source index -> curriculum evidence -> program/course generation -> editable learning artifact -> learner progress -> feedback/evals
```

Long-term product direction:

- Lycium may eventually replace Canvas-like course software for compatible learning environments.
- Lycium may also become program planning and registration-adjacent software, including programs, requirement groups, electives, prerequisites, sections, cohorts, schedules, and transcript-like records.
- Do not build institution-style bureaucracy early. Build the open education and pathway compiler first, then add LMS and registration primitives only when they help learners access free education and complete real learning paths.
- The strategic shape is documented in `VISION.md` under "Long-Term Product Shape: Learning Operating System."

## Clean-start rebuild guardrails

Status: Active

Context: Seed sample courses and sample programs were removed so Lycium can rebuild catalog content through the actual manual-authoring, source-index, and generation workflows instead of carrying hand-authored demo artifacts as product truth.

Rule:

- Do not add new seeded catalog courses or seeded programs unless they are explicitly marked as test fixtures, generated artifacts, or user-created local drafts.
- Do not implement UI changes from this todo list without explicit user approval.
- Keep source-index records separate from course/program seed content so the evidence layer can remain useful even when the learning catalog is reset.
- Prefer generic primitives over course-specific hardcoding.

Clean-start todo:

- Define a `test-fixture` versus `catalog-content` policy so CI can use fixtures without polluting the learner catalog. Done: see `docs/catalog-content-policy.md` and `pnpm check:seed-content`.
- Make source packets the required input for any generated full course that claims source-backed completeness. Partial: strict packet gating now exists and quality evals can block publishability when `metadata.sourceCoveragePolicy.requireSourcePacketForPublishableCourses` is enabled.
- Require every generated course to report source gaps by concept before it can become publishable. Partial: source-packet quality gate reports uncovered concept candidates as source-gap rows.
- Ensure under-sourced generation creates a draft shell with missing-source needs instead of weak lesson filler. Done as a tested generation-contract expectation.
- Generate program skeletons from requirement groups, prerequisites, capstone/project requirements, and course shells before generating full course content. Partial: scaffold plans now carry prerequisite course IDs into later course shells, and materialized draft courses store those IDs in course metadata/top-level prerequisites.
- Add explicit course-build tasks to generated program course shells so every shell records whether it needs source gathering, existing-course fit review, outline generation, section generation, or review.
- Add a formal course-build task report to generated program scaffold plans so shell state, next actions, missing source packets, linked existing courses, and blocked tasks are auditable before course content exists. Done as `course-build-task-report-v1`.
- Add a program-level course-shell readiness report so a generated pathway can summarize which course shells need sources, are outline-ready, section-generation-ready, review-ready, linked existing courses, blocked, or invalid. Done as `program-course-shell-readiness-report-v1`.
- Add an agent-facing program course-shell action plan so generated pathways can deterministically list the next source, outline, section-generation, review, existing-course-fit, or repair action for each shell. Done as `program-course-shell-action-plan-v1`.
- Add structured source requests to generated course shells so `attach_source_packet` actions carry required concepts, suggested queries, source type hints, coverage policy, and benchmark evidence refs. Done as `course-source-request-v1`.
- Add a program-level source acquisition plan so generated pathways aggregate all course-shell source requests into prioritized requests, concepts, and suggested search queries before source packets are attached. Done as `program-source-acquisition-plan-v1`.
- Add a Source Index batch search plan to source acquisition artifacts so generated pathways can hand primitive query tasks to the detachable index service before asking users for more sources. Done as `program-source-index-search-plan-v1`.
- Add source request fulfillment reports so Source Index search results can be judged against `course-source-request-v1` concept coverage before a source packet is attached. Done as `course-source-request-fulfillment-report-v1` and `program-source-acquisition-fulfillment-report-v1`.
- Add course-build task transitions so shells can advance from `source_gathering` to `outline_ready` when a usable source packet satisfies concept coverage policy.
- Add a formal source-packet transition report so course shells explain why they can advance to `outline_ready` or remain blocked in `source_gathering`. Done as `source-packet-transition-report-v1`.
- Add outline readiness transitions so shells can advance from `outline_ready` to `section_generation_ready` when an outline has module, section, objective, and concept structure.
- Add a formal outline transition report so course shells explain why an outline can advance to `section_generation_ready` or remains blocked for missing module, section, objective, or concept structure. Done as `outline-transition-report-v1`.
- Add review readiness transitions so shells can advance from `section_generation_ready` to `ready_for_review` only when generated sections pass quality, source, citation, and eval gates. Partial: deterministic course generation now records this transition from the generated quality report.
- Add a formal review transition report so course shells explain why generated sections can advance to `ready_for_review` or remain blocked for quality, source, citation, or eval issues. Done as `review-transition-report-v1`.
- Mirror course-build task state into generation run summaries and timeline events so source gathering, outline readiness, section generation readiness, and review readiness are auditable. Partial: program generation traces now include `program-generation-timeline-v1` events for benchmark context, contract validation, quality gates, scaffold planning, and course-build task summaries.
- Centralize course-shell resume behavior so source packets, outlines, and quality reports advance build-task state through one backend primitive instead of scattered caller-specific transitions.
- Add a formal course-build resume report so every resumed shell records the final stage, next action, transition counts, and compact transition reports in one metadata artifact. Done as `course-build-resume-report-v1`.
- Add a source-packet-to-outline bridge so usable source packets can derive a non-learner-facing course outline and advance shells toward section generation without a separate manual outline step.
- Add a source-index search step before asking the user for more sources. Partial: source-gap metadata now queries Source Index for missing-concept candidates and stores `sourceIndexCandidates` plus `metadata.sourceGapSuggestions`.
- Keep manual course creation as a blank editable draft path, separate from AI-generated drafts.
- Add repeatable eval scenarios that start from zero seeded courses and prove the system can create usable courses/programs through repo mechanics. Partial: clean-start generation contract tests now avoid catalog seeds.
- Add reusable full-path program-generation drills that start from scenario sources, produce a valid `LyciumProgram`, verify quality gates, and confirm course-shell build tasks/source-packet handoff before catalog content exists. Done as `program-generation-drill-v1`.
- Keep generated courses editable through the same block structure that manual authors use. Partial: generation contract tests now assert editor-native block types.
- Add a clean-catalog smoke fixture that verifies the app behaves correctly when `localCourses` and `localPrograms` are empty. Done: see `apps/lycium-web/src/courseData/cleanCatalog.test.ts`.

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
- Add full-path program-generation drills that verify program envelopes, quality gates, scenario expectations, course-shell build tasks, source-packet handoff, and prerequisite wiring.
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

Status: Partial

Goal: Course health should combine generation quality, source coverage, learner feedback, source gaps, stale links, and review state.

Todo:

- Add a course health summary object to course metadata or local diagnostics. Done for backend snapshots and local diagnostics with `course-health-v1`.
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

1. Complete source-to-concept coverage checks. Done for source-gated course drafts and section citation validation.
2. Add source-index search into generation preflight. Done for source gap suggestions and replacement candidates.
3. Add generation run detail records and a basic run detail UI. Partially done for structured backend run/task events; UI remains explicit-permission only.
4. Strengthen source-gated drafts and catalog health states. Done for needs-sources drafts, course-build tasks, and source-packet resume state transitions.
5. Let staged generation consume source-packet-derived outlines. Done: resumed shells can use `metadata.courseBuildOutline` as the staged course plan.
6. Preserve source-packet outline constraints during section generation. Done: outline concept keywords and scoped source IDs now flow into lesson prompts and section coercion.
7. Persist section-level generation-outline evidence. Done: generated sections now carry `metadata.generationOutline` with planned concepts, objectives, source IDs, and outline IDs for review/eval comparison.
8. Gate generated content against planned concepts. Done: course quality evals now include `generation_outline_coverage`, which compares section `metadata.generationOutline.plannedConceptKeywords` against final section text/concept cards.
9. Derive real concept phrases from source packets before section generation. Done: source-packet outlines now extract reusable concept candidates from accepted source text and distribute them into modules/sections with scoped source IDs.
10. Add source packet import/export tests. Done: Source Index now has CLI-level coverage for exported packet JSON, dry-run import, no-snapshot import, full snapshot import, and imported packet provenance after storage reset.
11. Add course health summary objects. Done: backend generation snapshots and local diagnostics now use `course-health-v1` to combine quality, source integrity, lifecycle, feedback, and source suggestions.
12. Run a full Pre-Med program generation through repo mechanics.
13. Add drag-and-drop edit-mode E2E coverage.
14. Improve program/cluster requirement UX only with explicit UI approval.
15. Repeat generation evals with messy source corpora.
