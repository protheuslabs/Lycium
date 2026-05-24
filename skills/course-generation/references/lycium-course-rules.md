# Lycium Course Generation Rules

## Pseudo Workflow

Use the course JSON as both the output artifact and the progress tracker.

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

7. Draft instruction.
   Turn sub-units into teachable content blocks with examples, transitions, practice prompts, and source references.

8. Draft assessment.
   Create quiz-only assessment sections after relevant instruction. Questions must test previously taught or sourced ideas.

9. Draft module/week concept inventories.
   End every module/week with a summary section that aggregates the raw concept names introduced on that module/week's Learn pages. Do not turn the summary into interpretive prose categories.

10. Validate the course.
   Check continuity, source coverage, missing prerequisites, repetition, pacing, assessment alignment, and JSON validity.

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

- Course JSON must contain `title`, optional `shortDescription`, optional `difficultyLevel`, optional `category`, optional `tags`, optional `learningTypes`, optional `orderMandatory`, optional `metadata`, optional `sourceIds`, and `modules`.
- Generated courses should include `shortDescription`: a concise one-sentence course summary for catalog cards, ideally 80-160 characters.
- Use `category` for one broad university-style college or school category, and `tags` for more specific subject labels.
- Keep `learningTypes` as an array. Leave it empty until learning-type support is implemented.
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
- Prefer coherent depth over broad but shallow coverage.

## Content Blocks

- `text`: instructional prose in `value`.
- `video`: embedded material. Prefer `sourceIds` that resolve to a source record with `embedUrl`.
- `quiz`: assessment only. Use nested `questions` for multi-question quizzes.
- `game`: hands-on practice placeholder or project-like activity.
- `conceptCards`: renderable concept inventory data. Use a `title` and `concepts`, where each concept object has a `name` and `description`.
- `summary`: not a block type. Use a section marked `sectionType: "summary"` and represent reviewed concepts with `conceptCards`.

Canonical Learn-page concept-card block:

```json
{
  "type": "conceptCards",
  "title": "Concepts introduced",
  "concepts": [
    {
      "name": "Training-serving skew",
      "description": "A mismatch between data, features, or preprocessing used in training and those used during production inference."
    }
  ]
}
```

Canonical module/week-summary concept-card block:

```json
{
  "type": "conceptCards",
  "title": "{PacingLabel} concepts",
  "concepts": [
    {
      "name": "Training-serving skew",
      "description": "A mismatch between data, features, or preprocessing used in training and those used during production inference.",
      "sourceSectionId": "section-id"
    }
  ]
}
```

## Page Type Rules

- Learn pages use `pageType: "learn"`.
- Apply pages use `pageType: "apply"`.
- Learn pages contain instructional material, summaries, examples, readings, videos, labs, or projects.
- Apply pages contain quizzes, assessment, practice, or other learner action checkpoints.
- A page that contains quiz blocks should not also contain instructional blocks. Split mixed pages into a Learn page followed by an Apply page.
- Every non-assessment Learn page should end with at least one `conceptCards` block naming the raw concepts introduced on that page.
- Learn-page concept cards should use the title `Concepts introduced`.
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
- Use `questionsPerAttempt` only when each attempt should display a subset of the bank. Omit it or leave it blank to display the full bank.
- Each new attempt should randomize question selection, question order, and answer order.
- Keep a currently open attempt stable when the learner navigates away and returns.
- Use `answers` as an array of zero-based option indexes, even for single-answer items.
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
- Use one `conceptCards` block titled `{PacingLabel} concepts`, such as `Module concepts` or `Week concepts`.
- Pull the summary concepts from the `conceptCards` blocks in the module's preceding Learn pages.
- Summary concept objects should remain simple raw data, usually `{ "name": "Concept name", "description": "Concise definition.", "sourceSectionId": "section-id" }`.
- Do not include quiz blocks in module summary sections.
- Do not use interpretive prose headings such as "Key concepts", "How the ideas connect", "Common pitfalls", or "What you can do now" as concept cards.
- Do not add new concepts on the summary page unless they were introduced on a prior Learn page in the same module.

## Source Records

- Store reusable source metadata in `apps/lycium-web/src/courseData/sourceRecords.json`.
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
- If a block fetches or embeds material from a link, it must reference the source record for that link.

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
- Every summary section uses `conceptCards` to aggregate raw concepts from the module's Learn pages.
- Every non-assessment Learn page ends with at least one `conceptCards` block naming introduced raw concepts.
- Summary sections contain no quiz blocks.
- Every source ID referenced by a course exists in `sourceRecords.json`.
- Every quiz has the intended number of questions.
- Assessments test only previously taught or sourced material.
- The frontend build passes after TypeScript or JSON import changes.
