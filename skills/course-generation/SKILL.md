---
name: course-generation
description: Build, revise, or review Lycium course JSON and course-generation behavior. Use when an agent is asked to create a course, convert source material into a course, add course-generation rules, review course structure, wire course data into the Lycium catalog, or enforce source records and assessment-only quiz sections.
---

# Lycium Course Generation Agent Skill

Use this skill to make Lycium courses that are teachable, source-backed, and renderer-compatible.

## Workflow

1. Read the existing course shape before editing:
   - `apps/lycium-web/src/courseData/*.json`
   - `apps/lycium-web/src/App.tsx`
   - `apps/lycium-web/src/components/ContentView/ContentView.tsx`
2. Load `references/lycium-course-rules.md` before authoring or reviewing course JSON.
3. When the request is larger than one course, model the curriculum as a program:
   - use `Program` for the complete pathway or credential-like outcome
   - use `RequirementGroup` for learner-facing clusters, tracks, foundations, electives, capstones, bridge work, or remediation
   - use explicit requirements instead of a flat course list
   - keep prerequisite correctness in a dependency graph, not only the display tree
   - prefer benchmark-derived requirements over topic-prompt outlines when catalogs, syllabi, certification outlines, or employer profiles are available
   - record requirement origins so generated paths can explain why a requirement exists
   - validate missing course, assessment, project, or competency references before publishing program data
4. Determine course scope before writing lesson content:
   - learner level
   - prerequisites
   - target outcome
   - expected duration and depth
   - exclusions
   - assessment expectations
   - course short description for catalog cards
5. Plan the course hierarchy before drafting content:
   - 10-20 modules for a full course unless the user requests a shorter course
   - choose exactly one learner-facing pacing label, `Module` or `Week`, record it in `metadata.pacingLabel`, and use it consistently in module titles, summary titles, and summary concept-card titles
   - 4-15 units per module/week by default
   - sub-units for individual ideas inside each unit
6. Use the JSON as a progress ledger:
   - record scope in `metadata.scope`
   - record a concise renderer-facing course summary in top-level `shortDescription`
   - record the university-style college in top-level `category`, then select top-level `department` only from the departments nested under that selected category
   - record college catalog parity references in top-level `courseEquivalencies` when applicable
   - record course prerequisites in top-level `prerequisites` when applicable
   - record planned/wrapper course prerequisite IDs in `metadata.prerequisiteCourseIds`
   - record benchmark-derived requirements and their origins in program/course metadata when applicable
   - record benchmark evidence in `metadata.curriculumBenchmarks`, `metadata.requirementOrigins`, `metadata.courseParityProfile`, and `metadata.sourceSlots` when applicable
   - record module, unit, idea, and source planning in `metadata.generationPlan`
   - update progress markers as the plan becomes content
   - align progress markers with the backend gate names: `intake`, `benchmark_intake`, `requirement_extraction`, `commonality_analysis`, `source_analysis`, `source_enrichment`, `classification`, `scope`, `module_structure`, `section_structure`, `content_draft`, `assessment`, `media`, `summary`, `validation`, `quality_eval`, and `review_publish`
   - inspect `quality_report.evals` after backend LLM generation experiments to tune prompts, source coverage, and course structure before review or publish
7. Build or revise the course around modules and sections, not a single long page.
   - write learner-facing instruction directly in the course, not prompts or directions for a future model to fill in later
   - sections should contain explanations, examples, activities, concept cards, or assessments that a learner can use immediately
8. Keep instruction and assessment separate:
   - Learn pages use `pageType: "learn"` and contain text, video, code, projects, labs, summaries, or other instructional blocks
   - Apply pages use `pageType: "apply"` and contain assessment or practice interactions
   - quiz sections contain quiz blocks only and should be Apply pages
   - quiz blocks may use `maxAttempts` and `timeLimitSeconds`; omit or leave blank for unlimited attempts or unlimited time
   - quiz blocks may use `passPercentage`; omit or leave blank for neutral score display without pass/fail coloring
   - quiz blocks may use `showAnswers`; default false, but answers are always shown after the final allowed attempt
   - quiz `questions` or `questionBank` should be treated as the total bank; `questionsPerAttempt` may limit how many are displayed per attempt
   - real module quizzes should include at least 10 questions; more than 10 is acceptable when it improves coverage
   - quiz questions must use `question`, `options`, and `answers`; `answers` is an array of zero-based option indexes such as `[0]`, not answer objects or answer IDs
   - each new quiz attempt should randomize question selection, question order, and answer order
9. End every module with a summary section:
   - use `sectionType: "summary"`
   - treat the summary as a module concept inventory, not a prose recap
   - use one `conceptCards` block titled `{PacingLabel} concepts`, such as `Module concepts` or `Week concepts`
   - list concept objects in a `concepts` array
   - pull summary concepts from the concept cards on the module's prior Learn pages
   - preserve the originating `sourceSectionId` when possible
   - do not invent interpretive categories such as "key concepts", "how the ideas connect", or "common pitfalls" as concept cards
   - do not include quiz blocks in summary sections
10. Add concept cards to Learn pages:
   - every Learn page should end with at least one `conceptCards` block
   - cards should name raw concepts introduced on the page, not generic study tips or LLM interpretation
   - use simple concept objects with `name` and `description`
   - concept names should read like bullet-list terms: `HTTP request`, `Training-serving skew`, `Gradient synchronization`
   - descriptions should be concise definitions of the concept, not prose summaries of the page
11. Record all sources centrally and reference them from the course:
   - add source records to `apps/lycium-web/src/courseData/sourceRecords/`
   - use `sourceIds` in course, module, section, and block records
   - for embedded videos, prefer source-record `embedUrl`; do not duplicate untracked raw video URLs in course blocks
   - for required concepts, prefer source slots with a primary source, fallback sources, and a replacement policy
12. If adding a local course, import it in `App.tsx` and add a `local-*` course entry.
13. Validate structure and coherence before finishing.
14. Treat validation as a catalog gate:
   - generated courses must not enter the catalog until structural validation passes
   - every referenced `sourceId` must resolve to a central or course-level source record
   - validation failures should be reported as generation errors, not silently repaired after rendering
15. Treat publication as a separate lifecycle gate:
   - generated snapshots should start as reviewable artifacts, not automatically trusted catalog entries
   - create or preserve `generation_trace.quality_report` when backend generation is involved
   - use `generation_trace.quality_report.evals` to judge structure, instructional substance, assessment quality, concepts, source grounding, media, and specificity
   - media/video generation is best-effort: log skipped or failed media stages in generation trace, but do not fail an otherwise valid course solely because video discovery failed
   - keep only a small ring buffer of full course-generation job logs so recent runs are inspectable without creating unbounded local churn
   - publish only after the quality report passes or a reviewer explicitly records a force-publish reason
   - locked sections should be represented in review metadata rather than by mutating lesson content
16. Feed course-health records after learner use:
   - combine learner ratings, feedback notes, source suggestions, quality evals, validation issues, and reviewer actions into course health
   - keep health data separate from course JSON
   - store feedback magnitude as a numeric 1-3 signal; emoji are presentation only
   - use `unknown`, `healthy`, `watch`, and `needs_review` as the coarse status language
   - treat `needs_review` as a revision trigger before publishing or republishing
   - treat suggested sources as review candidates before promoting them into central source records

## Validation

Run a JSON integrity check for authored course files. For web app changes, run:

```bash
corepack pnpm --filter @lycium/web build
```

For backend course generator changes, run focused API tests when practical:

```bash
cd services/lycium-api && pytest tests/test_api_end_to_end.py -q
```

## Rule Updates

When the user adds a new course-generation rule:

1. Add the rule to this skill/reference if it affects future agent behavior.
2. Add or update the repo policy in `COURSE_GENERATION_RULES.md`.
3. If the backend generator is affected, update `services/lycium-api/app/generation.py`.
4. If existing local courses violate the rule, migrate them.
