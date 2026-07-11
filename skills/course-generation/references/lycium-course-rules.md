# Lycium Course Generation Rules

## Program and Cluster Rules

- Use `Program` for complete pathways such as career paths, certificates, degree-equivalent paths, skill paths, exam prep, or microcredentials.
- Use internal `RequirementGroup` records for learner-facing clusters, tracks, foundations, elective pools, capstones, bridge work, remedial work, labs, and seminars.
- A program is not a flat course list. It is a structured set of requirements that may be satisfied by courses, assessments, projects, competencies, or learning-hour thresholds.
- Keep the display hierarchy tree-shaped for learners, but keep prerequisites in a separate dependency graph so prerequisites can cross clusters and courses.
- Courses are reusable learning execution objects. Do not duplicate a course just because two programs need it.
- Program completion rolls up from requirement satisfaction into requirement groups and then into the program.
- Validate every course, assessment, project, and competency reference before publishing program data.
- Course records may include an optional top-level `prerequisites` array.
- Course records may include an optional top-level `courseEquivalencies` array for real or representative college catalog parity.
- Course equivalency records may include `institution`, `department`, `courseCode`, `title`, `url`, `catalogYear`, and `notes`.
- Treat course equivalency records as reference/parity metadata, not as formal transfer credit or articulation agreements unless the source explicitly supports that claim.
- Planned catalog-visible course wrappers should also include `metadata.prerequisiteCourseIds`.
- Empty planned course wrappers may use `modules: []` until the course is built out.
- Program generation, cluster generation, course-wrapper generation, and course-content generation should be separate workflows.
- Cluster generation should search existing courses and inspect internal fit evidence such as module titles, section titles, concept cards, tags, descriptions, and taxonomy before linking an existing course to a requirement.
- Missing or uncertain courses should become explicit wrappers with source needs, prerequisite metadata, generation prompts, and active-generation plans instead of hollow full courses.
- Active generation may materialize large courses in module batches, usually two modules at a time, while ungenerated sections remain explicit `not_generated` states with learner-facing placeholder text such as `Section not yet generated`.

## Pseudo Workflow

Use the course JSON as both the output artifact and the progress tracker.

Course generation should move through named gates that can be checked by deterministic validators and later by LLM-assisted evals. The backend source of truth for gate names is `services/lycium-api/app/course_generation_gates.py`: `intake`, `source_corpus_preflight`, `benchmark_intake`, `requirement_extraction`, `commonality_analysis`, `source_analysis`, `source_enrichment`, `classification`, `scope`, `module_structure`, `section_structure`, `content_draft`, `assessment`, `media`, `summary`, `validation`, `quality_eval`, and `review_publish`.

The `source_enrichment` gate should use Source Index in reverse before treating source coverage as blocked: search indexed records for missing concepts, replacement sources, benchmark evidence, and media candidates, then record accepted results as source-packet or source-slot evidence. Newly submitted sources should also run through source-fit analysis against abstract course/program/concept descriptors so reviewers can decide whether a source should improve existing content.

Backend LLM experiments should return `quality_report.evals` before persistence. Use those deterministic eval dimensions to judge structure, instructional substance, assessment quality, concept-card integrity, source grounding, media support, and course specificity before a generated course is accepted for review.

1. Scope the course.
   Define audience, level, prerequisites, desired outcome, duration, expected workload, source standards, assessment style, exclusions, and a short catalog description.

2. Plan 10-20 modules.
   Each module should represent a major arc in the course. Use fewer only for an explicitly short course.

3. Choose the learner-facing pacing label.
   Select exactly one label for the whole course: `Module` or `Week`. Record it in `metadata.pacingLabel` and use it consistently in module titles, summary titles, progress-facing names, and summary concept-card titles. Do not mix `Module` and `Week` in learner-facing titles in the same course.

4. Plan 4-15 units per module/week.
   A unit is one focused learner-facing lesson or assessment target. Units should be ordered by prerequisite relationship and conceptual difficulty.

5. Break each unit into sub-units.
   Each sub-unit should represent one individual idea, pattern, case, worked example, procedure, source excerpt, or practice target.

6. Source each idea.
   Find reputable sources for the idea level, not only the course level. Prefer primary docs, textbooks, academic sources, standards bodies, established university material, and reputable technical talks.
   When many sources are submitted, first run source corpus preflight. Use included sources as the course corpus and exclude irrelevant sources from requirements, lessons, quizzes, and citations unless a reviewer restores them.
   If submitted sources do not satisfy the course's source coverage and source-strength policy, create or preserve a `needs_sources` draft with structured `metadata.sourceGaps`, but still generate a coherent module and section outline plus distinct best-effort lesson scaffolds. Do not repeat a source-gap placeholder as every section body. Do not gate outline generation by raw source count; one comprehensive textbook, extracted document, or source packet may be sufficient when it covers the required concepts with strong depth, relevance, authority, and extractability.
   Map accepted sources to required concepts before drafting. Course-level source records are the full inventory, but section and block `sourceIds` should only include sources supporting concepts taught or assessed on that page.
   For uploaded files or long source documents, use bounded, stage-relevant excerpts for lesson, quiz, media, and summary prompts. Do not pass full extracted documents into every staged model call.

7. Draft instruction.
   Turn sub-units into teachable content blocks with examples, transitions, practice prompts, and source references.
   Use the same atomic block grammar the editor creates so generated courses are easy for humans to tweak later.
   Do not write lesson pages as prompts, outlines, or instructions for a future model. The rendered course must teach the learner directly.

8. Draft assessment.
   Create quiz-only assessment sections after relevant instruction. Questions must test previously taught or sourced ideas.

9. Draft module/week concept inventories.
   End every module/week with a summary section that aggregates the raw concept names introduced on that module/week's Learn pages. Do not turn the summary into interpretive prose categories.

10. Validate the course.
   Check continuity, source coverage, missing prerequisites, repetition, pacing, assessment alignment, and JSON validity.

11. Gate catalog intake.
   Generated courses must pass structural validation and source-reference validation before appearing in the learner catalog.
   Source-gapped planning drafts may appear as incomplete `needs_sources` artifacts and remain openable. Show source notices at the section level; source readiness gates review and publication rather than outline generation or course access.

12. Use quality evals before review.
   LLM-generated drafts should be inspected through `quality_report.evals`; rejected drafts should remain available for prompt/source/gate tuning rather than being silently discarded.

## Progress Metadata

Use metadata to keep work structured while generating.

```json
{
  "metadata": {
    "scope": {
      "audience": "junior CS students",
      "level": "intermediate",
      "duration": "14 weeks",
      "outcome": "design and evaluate production ML systems",
      "prerequisites": ["Python", "basic machine learning"],
      "exclusions": ["full derivations of every optimizer"]
    },
    "generationPlan": {
      "status": ["scoped", "modules_planned"],
      "modules": [],
      "unitMap": {},
      "ideaMap": {},
      "sourceMap": {}
    }
  }
}
```

The renderer can ignore planning metadata. It exists so agents do not lose the structure while filling in large courses.

## Required Course Shape

- Course JSON must contain `title`, optional `shortDescription`, optional `difficultyLevel`, optional `category`, optional `department`, optional `tags`, optional `learningTypes`, optional `courseEquivalencies`, optional `orderMandatory`, optional `prerequisites`, optional `metadata`, optional `sourceIds`, and `modules`.
- Generated courses should include `shortDescription`: a concise one-sentence course summary for catalog cards, ideally 80-160 characters.
- Use `category` for one broad university-style college or school category, then choose `department` only from the departments nested under that selected category. Use `tags` for more specific subject labels.
- Classify by the course's primary learning domain, learner purpose, and program role. Do not mechanically map `courseEquivalencies[].department` into top-level `category` or `department`; parity records are reference metadata and may describe a service department, cross-listed analogue, or catalog source rather than the best Lycium catalog home.
- Keep `learningTypes` as an array. Leave it empty until learning-type support is implemented.
- Use `courseEquivalencies` for college catalog parity references while keeping the Lycium course title independent.
- Use `prerequisites` for course, competency, assessment, program, or external prerequisites.
- Use `metadata.prerequisiteCourseIds` on planned/wrapper courses for fast catalog and program tooling.
- Substantial generated courses should set `metadata.pacingLabel` to exactly `Module` or `Week`.
- Each module must contain `id`, `title`, optional `sourceIds`, and `sections`.
- Each section must contain `id`, `title`, optional `sectionType`, optional `pageType`, optional `sourceIds`, and `content`.
- Use `pageType: "learn"` for instructional pages and `pageType: "apply"` for quiz, assessment, or practice pages.
- Prefer stable readable IDs for local courses and stable generated IDs for backend-generated courses.

## Structure Constraints

- The course must have a clear through-line from first module to final outcome.
- Each module must have a distinct role in that through-line.
- Use either `Module` or `Week` consistently in learner-facing titles. If module titles use `Week 1: ...`, summary titles and summary concept-card titles should use `Week`; if module titles use `Module 1: ...`, they should use `Module`.
- Each unit must teach one bounded objective.
- Each sub-unit must be small enough to source, teach, and assess.
- Advanced ideas must not appear before prerequisite ideas.
- Reuse terms consistently across the course.
- Avoid modules that are only lists of topics; every module needs a learning arc.
- Include examples, practice, and assessment often enough for a real online course experience.
- Do not allow catalog-visible courses to contain placeholder prose such as "learners should study", "the model should explain", or section text that merely describes what content should be generated later.
- Prefer coherent depth over broad but shallow coverage.

## Content Blocks

- `text`: instructional prose in `value`, optionally with `heading`.
- `heading`: standalone section/block label such as `Concepts introduced`.
- `conceptCard`: one raw concept card with `title` or `name`, `description`, optional `sourceSectionId`, and local `sourceIds`.
- `image` / `visual`: instructional image, chart, or diagram. Use `url` or `src`, required `alt`, optional `caption`, optional `credit`, optional `license`, optional `generatedBy`, and local `sourceIds`.
- `video`: embedded material. Prefer `sourceIds` that resolve to a source record with `embedUrl`. Use optional `clip.startSeconds` and `clip.endSeconds` when only a slice of the video supports the section; omit `clip` for the full video. Do not add filler video titles; use a separate `heading` block if a visible title is needed.
- `iframe`: generic embedded web resource for interactive or external material.
- `quiz`: assessment only. Use nested `questions` for multi-question quizzes.
- `project`: applied work such as a project, lab, simulation, portfolio task, or practical exam. Use one canonical `submissionType`, such as `text`, `link`, `doc`, `image`, or `file`; if that type supports multiple methods, record those separately as `submissionMethods`.
- `game`: hands-on practice placeholder or project-like activity.
- `conceptCards`: legacy render-compatible concept stack. Do not generate this for new courses unless preserving or repairing a legacy course.
- `summary`: not a block type. Use a section marked `sectionType: "summary"` and represent reviewed concepts with `heading` plus one `conceptCard` block per concept.

Canonical Learn-page concept-card block:

```json
{
  "type": "heading",
  "title": "Concepts introduced"
},
{
  "type": "conceptCard",
  "title": "Training-serving skew",
  "description": "A mismatch between data, features, or preprocessing used in training and those used during production inference."
}
```

Canonical module/week-summary concept-card block:

```json
{
  "type": "heading",
  "title": "{PacingLabel} concepts"
},
{
  "type": "conceptCard",
  "title": "Training-serving skew",
  "description": "A mismatch between data, features, or preprocessing used in training and those used during production inference.",
  "sourceSectionId": "section-id"
}
```

## Page Type Rules

- Learn pages use `pageType: "learn"`.
- Apply pages use `pageType: "apply"`.
- Learn pages contain instructional material, summaries, examples, readings, videos, labs, or projects.
- Apply pages contain quizzes, assessment, practice, or other learner action checkpoints.
- A page that contains quiz blocks should not also contain instructional blocks. Split mixed pages into a Learn page followed by an Apply page.
- Every non-assessment Learn page should end with a `heading` block titled `Concepts introduced`, followed by at least one `conceptCard` block naming the raw concepts introduced on that page.
- Do not add concept cards to quiz-only Apply pages.
- Concept cards are raw concept inventories, not prose summaries, interpretations, advice, or explanations.
- Concept names should read like bullet-list terms: `HTTP request`, `CSS specificity`, `Training-serving skew`, `Gradient synchronization`.
- Concept descriptions should be concise definitions of the concept, not prose summaries of the page.
- Do not put paragraph-length teaching content in concept cards.

## Assessment Rules

- Quizzes must be assessment-only sections.
- A quiz section must contain quiz blocks only.
- Do not include instructional text, readings, videos, source summaries, examples, labs, or remediation inside a quiz section.
- Put the lesson section first, then add a following `Quiz: ...` section.
- Mark quiz-only sections with `sectionType: "assessment"` when authoring new JSON or backend-generated sections.
- Mark quiz-only sections with `pageType: "apply"`.
- Quiz questions should assess concepts taught or sourced in prior lesson sections.

## Quiz Item Rules

- Use `questions` for quizzes that contain more than one question.
- Treat `questions` or `questionBank` as the total question bank.
- Real module quizzes should include at least 10 questions. More than 10 is acceptable when it improves coverage.
- Use `questionsPerAttempt` only when each attempt should display a subset of the bank. Omit it or leave it blank to display the full bank.
- Each new attempt should randomize question selection, question order, and answer order.
- Keep a currently open attempt stable when the learner navigates away and returns.
- Each quiz question must use `question`, `options`, and `answers`.
- Use `answers` as an array of zero-based option indexes, even for single-answer items.
- Do not model answers as answer objects or answer IDs.
- Use `timed: "f"` unless the user explicitly asks for timed assessment.
- Use `maxAttempts` only when attempts should be limited. Omit it or leave it blank for unlimited attempts.
- Use `timeLimitSeconds` only when time should be limited. Omit it or leave it blank for unlimited time.
- Use `passPercentage` only when the quiz should show pass/fail coloring. Omit it or leave it blank for neutral score display.
- Use `showAnswers: true` only when answers should be shown after each submitted attempt. Default is false.
- Always show answers after submission on the final allowed attempt when `maxAttempts` is set.
- When answers are shown, selected wrong answers should display a red x over the radio or checkbox, and correct answers should display a green check over the radio or checkbox.
- Quiz UI displays attempts as current attempts over max attempts and time as elapsed time over max time.
- Submitted quiz attempts should display their score in the center of that attempt's metadata row.
- Do not put explanations or instructional paragraphs inside quiz prompts.
- Keep one submit button per quiz block; do not model submit controls in JSON.

## Module/Week Summary Rules

- Every module should end with a summary section that aggregates the module's raw concepts.
- Mark module summaries with `sectionType: "summary"` when authoring JSON or backend-generated sections.
- Mark module summaries with `pageType: "learn"`.
- Summary sections are instructional Learn pages, not assessments.
- Use one `heading` block titled `{PacingLabel} concepts`, such as `Module concepts` or `Week concepts`, followed by one `conceptCard` block per reviewed concept.
- Pull the summary concepts from the `conceptCard` blocks in the module's preceding Learn pages.
- Summary concept card objects should remain simple raw data, usually `{ "type": "conceptCard", "title": "Concept name", "description": "Concise definition.", "sourceSectionId": "section-id" }`.
- Do not include quiz blocks in module summary sections.
- Do not use interpretive prose headings such as "Key concepts", "How the ideas connect", "Common pitfalls", or "What you can do now" as concept cards.
- Do not add new concepts on the summary page unless they were introduced on a prior Learn page in the same module.

## Source Records

- Store reusable source metadata in `apps/lycium-web/src/courseData/sourceRecords/`.
- Each source record should include:
  - `id`
  - `type`
  - `title`
  - `url` when public
  - `embedUrl` for embeddable videos
  - `localPath` for local-only material, when relevant
  - `usedByCourseIds`
  - `usedByCourseTitles`
- Course records should reference sources using `sourceIds`.
- Use source IDs at the most helpful levels: course, module, section, and block.
- Narrow source IDs as the content narrows. Course-level source IDs are the full accepted inventory, module-level source IDs support that module, and section/block source IDs must only reference sources connected to concepts in that section.
- Text blocks may include inline citation markers such as `[1]`. Citation numbers are 1-based positions in the course-wide source inventory. Sections render only the sources used locally, sorted by those course-wide citation numbers.
- Do not blanket-cite the same full course source list on every page.
- If a block fetches or embeds material from a link, it must reference the source record for that link.
- Generated courses must include course-level `sourceRecords` for generated/local-only sources or reference existing central source records.
- Do not accept unresolved `sourceIds` in generated courses.

## Course Health Rules

- Course health is the shared review surface for learner feedback, source suggestions, deterministic quality evals, validation findings, and reviewer decisions.
- Do not store health state inside course JSON. Store it in separate operational records so the course artifact stays portable and stable.
- Feedback records may include the latest rating, rating events, optional written notes, feedback magnitude, source suggestions, and timestamps.
- Store magnitude as a numeric 1-3 value; UI emoji are only presentation.
- Use `unknown`, `healthy`, `watch`, and `needs_review` as the coarse health statuses.
- Treat `watch` as a reviewer queue signal and `needs_review` as a revision or publish blocker unless an explicit reviewer override is recorded.
- Suggested sources should be reviewed before they become central source records or cited course material.
- Future LLM evals should write into or be summarized by the same course-health mechanism rather than becoming disconnected quality artifacts.

## Local Catalog Rules

- Add new local courses in `apps/lycium-web/src/courseData/`.
- Import the course in `apps/lycium-web/src/App.tsx`.
- Add a `CourseEntry` with a stable `local-*` key.
- The app will generate a URL with `/courses/{slug}-{key}`.

## Validation Checklist

- Scope metadata exists for substantial generated courses.
- Modules, units, and ideas have been planned before full content is drafted.
- No section mixes quiz blocks with non-quiz blocks.
- Every assessment section contains quiz blocks only.
- Every section has a clear `pageType` of `learn` or `apply`.
- Every quiz-only assessment section is an Apply page.
- Every instructional section is a Learn page.
- Every module ends with a summary section.
- Every summary section uses editable `conceptCard` blocks to aggregate raw concepts from the module's Learn pages.
- Every non-assessment Learn page ends with `Concepts introduced` plus at least one `conceptCard` block naming introduced raw concepts.
- Summary sections contain no quiz blocks.
- Every source ID referenced by a course exists in `sourceRecords/`.
- Generated and remote course entries are rejected before catalog insertion if referenced source IDs do not resolve.
- Sparse-source drafts use `metadata.sourceCoveragePolicy`, `metadata.sourceGaps`, optional `metadata.sourceGapSuggestions`, and lifecycle status `needs_sources`.
- Blocking source gaps require review notices and prevent publication, but they do not prevent a best-effort outline, distinct incomplete lesson scaffolds, or learner access to the draft.
- Every quiz has the intended number of questions.
- Assessments test only previously taught or sourced material.
- The frontend build passes after TypeScript or JSON import changes.
