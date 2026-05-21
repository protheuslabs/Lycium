# Lyceum Course Generation Agent Workflow and Rules

These rules apply to generated Lyceum courses and agent-authored course JSON.

Use the repo-local course generation skill as the starting point:

`skills/course-generation/SKILL.md`

## Generation Workflow

1. Determine course scope.
   Define the learner level, prerequisites, course outcome, expected duration, depth, assessment style, source expectations, and what the course should explicitly not cover.

2. Divide the course into 10-20 modules.
   Each module should represent a major conceptual or practical arc. Modules should build progressively, like a real college or professional online course.

3. Divide each module into units.
   Default to 4-15 units per module unless the user asks for a shorter course. A unit should be teachable in one focused lesson page.

4. Divide each unit into sub-units for individual ideas.
   Each sub-unit should cover one teachable idea, technique, case study, source excerpt, example, or practice target. Avoid vague catch-all sub-units.

5. Find citations and sources for each idea.
   Use reputable sources, record them centrally, and map every sourced idea to source IDs before writing final content.

6. Generate instructional content for each idea.
   Teach the concept, connect it to prior units, include examples or practice where useful, and keep the pacing coherent.

7. Generate assessments separately.
   Quizzes must be their own assessment sections after the relevant lesson/unit content.

8. Generate module concept inventories.
   End every module with a summary section that aggregates the raw concept names introduced on that module's Learn pages. Do not turn the summary into interpretive prose categories.

9. Validate coherence.
   Check that modules progress logically, units are not redundant, prerequisites are introduced before use, and assessments only test taught or sourced material.

## JSON Progress Tracking

Agents should use the course JSON as a progress ledger while building. Add or preserve metadata that records planning state when useful:

- `metadata.scope`: audience, prerequisites, target outcome, duration, level, and exclusions.
- `metadata.generationPlan.modules`: planned module names and outcomes.
- `metadata.generationPlan.unitMap`: planned units for each module.
- `metadata.generationPlan.ideaMap`: sub-units or individual ideas for each unit.
- `metadata.generationPlan.sourceMap`: source IDs mapped to units or ideas.
- `metadata.generationPlan.status`: progress markers such as `scoped`, `modules_planned`, `units_planned`, `sources_mapped`, `content_drafted`, and `validated`.

Renderer-facing content still belongs in `modules[].sections[].content`; planning metadata should support agents without replacing the actual course structure.

## Coherence Constraints

- A course must have a clear through-line from first module to final outcome.
- Each module must have a distinct purpose and must not duplicate another module.
- Each unit must teach a bounded objective that supports its parent module.
- Each sub-unit or idea must be small enough to explain, source, and assess.
- Introduce prerequisite concepts before advanced applications.
- Keep terminology consistent across modules.
- Balance theory, examples, practice, and assessment.
- Prefer deeper coverage of fewer ideas over shallow lists of loosely related topics.
- Cite sources for claims, readings, videos, examples, and imported content.
- Do not let source availability alone dictate course structure; structure the course pedagogically, then find or create appropriate sourced content for each idea.

## Assessment Rules

- Quizzes must be assessment-only sections.
- A quiz section must contain quiz blocks only.
- Do not include instructional text, videos, readings, examples, source summaries, remediation, or project instructions inside a quiz section.
- Put instruction first in a lesson section, then put the quiz in its own following section.
- Use `pageType: "learn"` for instructional pages.
- Use `pageType: "apply"` for quiz, assessment, practice, or other learner-action pages.
- Quiz questions should assess concepts already taught or sourced in prior lesson sections.
- Treat `questions` or `questionBank` as the total question bank.
- Use `questionsPerAttempt` only when each attempt should display a subset of the bank. Omit it or leave it blank to display the full bank.
- Each new attempt should randomize question selection, question order, and answer order while keeping the current open attempt stable.
- Use `maxAttempts` only when attempts should be limited. Omit it or leave it blank for unlimited attempts.
- Use `timeLimitSeconds` only when time should be limited. Omit it or leave it blank for unlimited time.
- Use `passPercentage` only when the quiz should show pass/fail coloring. Omit it or leave it blank for neutral score display.
- Use `showAnswers: true` only when answers should be shown after each submitted attempt. Default is false.
- Always show answers after submission on the final allowed attempt when `maxAttempts` is set.
- When answers are shown, selected wrong answers should display a red x over the radio or checkbox, and correct answers should display a green check over the radio or checkbox.
- Quiz metadata should display current attempts over max attempts and elapsed time over max time.
- Submitted quiz attempts should display their score in the center of that attempt's metadata row.

## Concept Card Rules

- Use `conceptCards` blocks to make introduced raw concepts explicit and easy to render with CSS.
- Concept cards are raw concept inventories, not prose summaries, interpretations, advice, or explanations.
- A `conceptCards` block should contain a `title` and a `concepts` array.
- Each concept should be a simple object with `name` and `description`.
- Concept names should read like bullet-list terms: `HTTP request`, `CSS specificity`, `Training-serving skew`, `Gradient synchronization`.
- Concept descriptions should be concise definitions of the concept, not prose summaries of the page.
- Every non-assessment Learn page should end with at least one concept card naming the concept or concepts introduced on that page.
- Learn-page concept cards should use the title `Concepts introduced`.
- Concept cards should read like a bullet list of actual course concepts, not generated interpretation or study advice.
- Do not add concept cards to quiz-only Apply pages.
- Do not write paragraph-length teaching content in concept cards.

## Module Summary Rules

- Every module should end with a module concept inventory.
- Mark module summaries with `sectionType: "summary"` when authoring JSON or backend-generated sections.
- Mark module summaries with `pageType: "learn"`.
- Summary sections are instructional Learn pages, not assessments.
- Use one `conceptCards` block titled `Module concepts`.
- Pull the summary concepts from concept cards on the module's preceding Learn pages.
- Summary concept objects should preserve `name`, `description`, and `sourceSectionId` so the UI can show the definition and later link back to the originating page.
- Do not create summary cards named "Key concepts", "How the ideas connect", "Common pitfalls", or "What you can do now".
- Do not add new concepts on the summary page unless they were introduced on a prior Learn page in the same module.
- Do not mix quizzes into module summary sections.
