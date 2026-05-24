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
3. Determine course scope before writing lesson content:
   - learner level
   - prerequisites
   - target outcome
   - expected duration and depth
   - exclusions
   - assessment expectations
   - course short description for catalog cards
4. Plan the course hierarchy before drafting content:
   - 10-20 modules for a full course unless the user requests a shorter course
   - choose exactly one learner-facing pacing label, `Module` or `Week`, record it in `metadata.pacingLabel`, and use it consistently in module titles, summary titles, and summary concept-card titles
   - 4-15 units per module/week by default
   - sub-units for individual ideas inside each unit
5. Use the JSON as a progress ledger:
   - record scope in `metadata.scope`
   - record a concise renderer-facing course summary in top-level `shortDescription`
   - record module, unit, idea, and source planning in `metadata.generationPlan`
   - update progress markers as the plan becomes content
6. Build or revise the course around modules and sections, not a single long page.
7. Keep instruction and assessment separate:
   - Learn pages use `pageType: "learn"` and contain text, video, code, projects, labs, summaries, or other instructional blocks
   - Apply pages use `pageType: "apply"` and contain assessment or practice interactions
   - quiz sections contain quiz blocks only and should be Apply pages
   - quiz blocks may use `maxAttempts` and `timeLimitSeconds`; omit or leave blank for unlimited attempts or unlimited time
   - quiz blocks may use `passPercentage`; omit or leave blank for neutral score display without pass/fail coloring
   - quiz blocks may use `showAnswers`; default false, but answers are always shown after the final allowed attempt
   - quiz `questions` or `questionBank` should be treated as the total bank; `questionsPerAttempt` may limit how many are displayed per attempt
   - each new quiz attempt should randomize question selection, question order, and answer order
8. End every module with a summary section:
   - use `sectionType: "summary"`
   - treat the summary as a module concept inventory, not a prose recap
   - use one `conceptCards` block titled `{PacingLabel} concepts`, such as `Module concepts` or `Week concepts`
   - list concept objects in a `concepts` array
   - pull summary concepts from the concept cards on the module's prior Learn pages
   - preserve the originating `sourceSectionId` when possible
   - do not invent interpretive categories such as "key concepts", "how the ideas connect", or "common pitfalls" as concept cards
   - do not include quiz blocks in summary sections
9. Add concept cards to Learn pages:
   - every Learn page should end with at least one `conceptCards` block
   - cards should name raw concepts introduced on the page, not generic study tips or LLM interpretation
   - use simple concept objects with `name` and `description`
   - concept names should read like bullet-list terms: `HTTP request`, `Training-serving skew`, `Gradient synchronization`
   - descriptions should be concise definitions of the concept, not prose summaries of the page
10. Record all sources centrally and reference them from the course:
   - add source records to `apps/lycium-web/src/courseData/sourceRecords/`
   - use `sourceIds` in course, module, section, and block records
   - for embedded videos, prefer source-record `embedUrl`; do not duplicate untracked raw video URLs in course blocks
11. If adding a local course, import it in `App.tsx` and add a `local-*` course entry.
12. Validate structure and coherence before finishing.
13. Treat validation as a catalog gate:
   - generated courses must not enter the catalog until structural validation passes
   - every referenced `sourceId` must resolve to a central or course-level source record
   - validation failures should be reported as generation errors, not silently repaired after rendering

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
