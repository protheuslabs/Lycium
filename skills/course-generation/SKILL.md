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
   - separate program generation, cluster generation, course-wrapper generation, and active course-content generation
   - cluster generation should search existing courses and inspect internal fit evidence such as module titles, section titles, concept cards, tags, and descriptions before linking an existing course
   - missing or uncertain courses should become course wrappers with source needs and generation prompts rather than hollow full courses
   - use active generation for large paths: generate bottom-level prerequisite course wrappers first, then generate course modules or sections in small batches as needed
4. Determine course scope before writing lesson content:
   - learner level
   - prerequisites
   - target outcome
   - expected duration and depth
   - exclusions
   - assessment expectations
   - course short description for catalog cards
   - course type or purpose, such as academic course, practical training course, exam prep, self-study pathway, or program component
   - learning method profile, such as project-first, text-heavy, video-supported, flashcard-supported, tutor-guided, or assessment-heavy
   - generation input artifacts, including URLs, uploaded documents, PDFs, slide decks, notes, transcripts, media, source packets, or connector-provided source refs
   - any native Lycium primitive used for file reading, extraction, retrieval, tutoring, or grading must stay adapter-shaped and replaceable by Infring OS or other Protheus ecosystem primitives
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
   - record course purpose in `metadata.courseType` when known
   - record learning method preferences in `metadata.learningMethod` when known
   - record generation inputs in `metadata.inputArtifacts` when documents, media, source packets, or connector refs are used
   - record benchmark evidence in `metadata.curriculumBenchmarks`, `metadata.requirementOrigins`, `metadata.courseParityProfile`, and `metadata.sourceSlots` when applicable
   - record module, unit, idea, and source planning in `metadata.generationPlan`
   - record active generation state in `metadata.activeGenerationPlan` when a course is only partially materialized or should be generated in module batches
   - record wrapper lineage in `metadata.courseWrapper` when a catalog entry was created as a program or cluster course shell
   - preserve generated section planning evidence in `sections[].metadata.generationOutline` when content is created from source-packet, benchmark, or staged outline inputs
   - preserve `metadata.courseHealth` when backend review, generation, or source diagnostics have produced a course-health summary
   - record estimated learning time at the most specific reliable level available: prefer section-level `estimatedMinutes`, then course-level `estimatedMinutes` or `estimatedHours`, then requirement, cluster, and program `estimatedHours`
   - treat parent-level time estimates as authored fallbacks; when every child has an estimate, roll parent time up from children instead of manually duplicating totals
   - update progress markers as the plan becomes content
   - align progress markers with the backend gate names in `services/lycium-api/app/course_generation_gates.py`: `intake`, `source_corpus_preflight`, `benchmark_intake`, `requirement_extraction`, `commonality_analysis`, `source_analysis`, `source_enrichment`, `classification`, `scope`, `module_structure`, `section_structure`, `content_draft`, `assessment`, `projects`, `media`, `summary`, `validation`, `quality_eval`, and `review_publish`
   - inspect `quality_report.evals` after backend LLM generation experiments to tune prompts, source coverage, and course structure before review or publish
7. Build or revise the course around modules and sections, not a single long page.
   - write learner-facing instruction directly in the course, not prompts or directions for a future model to fill in later
   - sections should contain explanations, examples, activities, concept cards, or assessments that a learner can use immediately
8. Keep instruction and assessment separate:
   - Learn pages use `pageType: "learn"` and contain text, video, code, projects, labs, summaries, or other instructional blocks
   - Apply pages use `pageType: "apply"` and contain assessment or practice interactions
   - assessment means mastery evidence, not only quizzes; it may be a quiz, longer test, project, lab, simulation, portfolio task, or rubric-graded submission
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
   - use a `heading` block titled `{PacingLabel} concepts`, such as `Module concepts` or `Week concepts`
   - follow it with one `conceptCard` block per reviewed concept so humans can reorder, edit, or delete concepts one at a time
   - pull summary concepts from the concept cards on the module's prior Learn pages
   - preserve the originating `sourceSectionId` on each `conceptCard` when possible
   - do not invent interpretive categories such as "key concepts", "how the ideas connect", or "common pitfalls" as concept cards
   - do not include quiz blocks in summary sections
10. Add concept cards to Learn pages:
   - every Learn page should end with a `heading` block titled `Concepts introduced` followed by at least one `conceptCard` block
   - each card block should name one raw concept introduced on the page, not generic study tips or LLM interpretation
   - use simple card fields such as `title` and `description`
   - concept names should read like bullet-list terms: `HTTP request`, `Training-serving skew`, `Gradient synchronization`
   - descriptions should be concise definitions of the concept, not prose summaries of the page
11. Use editor-native content blocks for generated output:
   - generated sections must be easy for a human to tweak in the course editor
   - use atomic `text`, `heading`, `conceptCard`, `image`, `visual`, `video`, `iframe`, `quiz`, `flashcardSet`, `project`, `rubric`, and `submission` blocks or objects instead of monolithic markdown or large nested block payloads
   - use one `conceptCard` block per concept; do not generate a single `conceptCards` stack except when preserving or repairing a legacy course
   - video blocks should not include a filler title by default; use a separate `heading` block if the video needs a visible label
   - quiz questions should include `multiple: true` only when the UI should render checkboxes; single-answer questions should use `answers: [index]` and omit `multiple` or set it false
   - image and visual blocks should include `url` or `src`, `alt`, optional `caption`, source IDs or generation provenance, and license/provenance metadata when applicable
   - flashcard sets should use structured cards with prompt, answer, optional hint, explanation, concept tags, and source IDs
   - project blocks or project sections should include instructions, artifact type, required evidence, rubric reference, source IDs, one canonical submission type, optional submission methods, and grader workflow metadata when applicable
   - use project blocks for projects, labs, simulations, portfolio tasks, practical exams, or other non-quiz evidence that should be graded against a rubric
12. Record all sources centrally and reference them from the course:
   - add source records to `apps/lycium-web/src/courseData/sourceRecords/`
   - use `sourceIds` in course, module, section, and block records
   - when many sources are submitted, run source corpus preflight and use only included sources as course evidence unless a reviewer restores an excluded source
   - when source packets are available, prefer `source-packet-v1` evidence over loose URL lists so generation uses imported snapshots, source decisions, and evidence refs
   - during source enrichment, query Source Index search (`source-index-search-v1`) for missing concepts, replacement sources, benchmark evidence, and media candidates before asking the user for more sources
   - when a new source is submitted, use source-fit analysis against abstract course/program/concept descriptors to create review candidates; do not auto-attach the source to course sections
   - record source corpus evidence in `metadata.sourceCorpusSynthesis` when applicable
   - if source coverage or source strength is below policy, create or preserve a `needs_sources` draft with `metadata.sourceGaps` instead of drafting hollow learner-facing modules
   - preserve `metadata.generationReadiness` on source-ready generated courses and `needs_sources` drafts; full courses must carry a positive `course-generation-readiness-v1` report, while sparse drafts must carry the non-ready report
   - use `metadata.generationReadiness.sourceStrength` (`source-strength-v1`) as the readiness primitive; source count is not the readiness decision, and one comprehensive textbook, extracted file, or source packet can be enough when it covers the required concepts with strong depth, relevance, authority, and extractability
   - map sources to required concepts before writing learner-facing sections; a source can support many concepts, but required concepts should have at least one accepted source mapping
   - when uploaded files or long source documents are used, pass bounded, stage-relevant excerpts into lesson, quiz, media, and summary prompts; do not dump full extracted documents into every model call
   - scope `sourceIds` locally while numbering citations globally: course-level `sourceIds` are the full accepted inventory, module `sourceIds` support that module, and section/block `sourceIds` support only concepts taught or assessed there
   - text blocks may include inline citation markers such as `[1]`; these are 1-based indexes into the course-wide source index, while each section renders only the subset it uses sorted from lowest to highest citation number
   - for embedded videos, prefer source-record `embedUrl`; do not duplicate untracked raw video URLs in course blocks
   - video blocks may reuse a full video source with an optional `clip` object such as `{ "startSeconds": 185, "endSeconds": 420 }`; omit `clip` to play the whole video
   - for required concepts, prefer source slots with a primary source, fallback sources, and a replacement policy
13. If adding a local course, import it in `App.tsx` and add a `local-*` course entry.
14. Validate structure and coherence before finishing.
15. Treat validation as a catalog gate:
   - generated courses must not enter the catalog until structural validation passes
   - sparse-source drafts may appear only as incomplete `needs_sources` artifacts that collect missing sources before full generation resumes
   - copy readiness evidence into `generation_trace.generation_readiness` whenever backend generation or source-gap resume is involved so review, observability, and eval tools can explain the source-readiness decision
   - every referenced `sourceId` must resolve to a central or course-level source record
   - every section citation must point to a source that supports at least one concept taught or assessed in that section
   - every inline `[n]` citation marker in a text block must resolve to a course-wide source index entry that is also connected to the section or nearby block through `sourceIds`
   - validation failures should be reported as generation errors, not silently repaired after rendering
16. Treat publication as a separate lifecycle gate:
   - generated snapshots should start as reviewable artifacts, not automatically trusted catalog entries
   - create or preserve `generation_trace.quality_report` when backend generation is involved
   - use `generation_trace.quality_report.evals` to judge structure, instructional substance, assessment quality, concepts, source grounding, media, and specificity
   - media/video generation is best-effort: log skipped or failed media stages in generation trace, but do not fail an otherwise valid course solely because video discovery failed
   - keep only a small ring buffer of full course-generation job logs so recent runs are inspectable without creating unbounded local churn
   - publish only after the quality report passes or a reviewer explicitly records a force-publish reason
   - locked sections should be represented in review metadata rather than by mutating lesson content
17. Treat tutor, grader, and analytics support as explicit workflows:
   - tutor workflows should be grounded in the active course, current section, source records, source packets, curriculum benchmarks, learner progress, and explicitly allowed context
   - grader workflows should grade project or submission artifacts against a structured rubric, previous course material, expected outcomes, and supporting sources
   - analytics policy should distinguish private learner data, owner-visible aggregate metrics, public popularity metrics, and unique-view counting
   - course ownership metadata should support attribution, canonical drafts, forks, creator profiles, and owner-configured analytics permissions
18. Feed course-health records after learner use:
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
