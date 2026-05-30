# Lycium Course Generation Agent Workflow and Rules

These rules apply to generated Lycium courses and agent-authored course JSON.

Use the repo-local course generation skill as the starting point:

`skills/course-generation/SKILL.md`

## Program and Cluster Model

- Treat `Program` as the top-level education path for career paths, certificates, degree-equivalent paths, skill paths, exam prep, and microcredentials.
- Treat user-facing clusters as internal `RequirementGroup` records.
- Do not model a program as a flat list of courses. A program is a structured set of requirements.
- Requirement groups may represent foundations, clusters, tracks, concentrations, elective pools, capstones, bridge work, remedial work, labs, or seminars.
- Requirements may be satisfied by courses, course choices, assessments, projects, demonstrated competencies, or learning-hour thresholds.
- Keep the learner-facing structure tree-shaped, but keep prerequisite correctness in a separate dependency graph.
- Use courses as reusable learning execution objects that can appear in multiple programs.
- Program validation must reject missing course, project, assessment, or competency references before a program is published.
- Catalog course categories must use the top-level university-style college or school taxonomy. Department metadata lives under those colleges for later classification and should not be invented as extra college names.
- Completion should roll upward from learning objects into requirement groups and then into programs using explicit completion rules.
- Course records may include an optional top-level `prerequisites` array.
- Course records may include an optional top-level `courseEquivalencies` array for parity with real or representative college catalog courses.
- Course equivalency records may include `institution`, `department`, `courseCode`, `title`, `url`, `catalogYear`, and `notes`.
- Use `courseEquivalencies` for reference/parity metadata only. Do not treat it as a formal credit-transfer or articulation agreement unless the source explicitly says so.
- Planned or wrapper courses should also record `metadata.prerequisiteCourseIds` so program/catalog tools can quickly inspect dependency shape.
- Empty planned courses may use `modules: []` only while they are explicitly planning placeholders. Catalog-visible teachable wrappers should be built into modules, sections, source references, concept cards, quizzes, and summaries before learner delivery.

## Curriculum Benchmark and Parity Model

- Treat real educational structures as the preferred skeleton for generated courses and programs.
- Use `CurriculumBenchmark` records for university catalogs, syllabi, certification outlines, employer skill profiles, and expert-reviewed references.
- Extract benchmark topics, learning outcomes, prerequisites, and requirements before drafting the course structure when benchmark sources are available.
- Compare similar benchmarks to classify material as `required`, `recommended`, `optional`, `remedial`, `alternate`, or `enrichment`.
- Record `RequirementOrigin` metadata on program and course requirements when a requirement is supported by benchmarks, certification standards, employer profiles, expert review, or generated gap filling.
- Do not treat source availability as the course skeleton. First decide the curriculum requirement, then map the best available source material to it.
- Use course equivalence groups when multiple course variants satisfy the same requirement through different modality, pacing, source sets, or pedagogy.
- Use source slots for required concepts: a primary source, fallback sources, and a replacement policy.
- Career-path and degree-equivalent programs should include portfolio artifact requirements unless a reviewer explicitly marks them not applicable.
- College-course parity metadata is not accreditation, credit transfer, or an articulation agreement unless the referenced institution explicitly says so.

## Model Capability Guidance

- Full course generation should use a high-capability model because the task requires source synthesis, curriculum structure, valid JSON, assessment design, and self-consistent summaries.
- For Ollama Local, use `kimi-k2.6:cloud` as the recommended default.
- Treat roughly 70B+ parameters, or an explicitly high-capability cloud model, as the recommended floor for full course generation.
- Smaller local models may be used for smoke tests and staged experiments, but they should not be expected to produce review-ready courses without repair.

## Generation Workflow

Course generation is a gated workflow. Each gate should produce inspectable artifacts and issues before the next stage is trusted:

- `intake`: parse the prompt, links, files, level, goals, constraints, and intended course type.
- `source_corpus_preflight`: score submitted sources against the course prompt, keep relevant sources, and exclude unrelated sources before benchmark extraction or course planning.
- `benchmark_intake`: identify university catalogs, syllabi, certification outlines, employer profiles, or expert references that can anchor the curriculum.
- `requirement_extraction`: extract benchmark requirements, topics, outcomes, prerequisites, and course-parity metadata.
- `commonality_analysis`: compare comparable benchmarks to separate required material from recommended, optional, remedial, alternate, or enrichment material.
- `source_analysis`: inspect provided sources and extract topics, claims, examples, media, exercises, prerequisites, and source metadata.
- `source_enrichment`: add reputable supplemental sources when coverage is weak.
- `classification`: assign college/school category, selected department metadata, tags, difficulty, parity metadata, and prerequisites.
  Select the college/category first, then select the department only from the departments nested under that college/category. Classify by the course's primary learning domain, learner purpose, and program role. Do not mechanically map `courseEquivalencies[].department` into top-level `category` or `department`; parity records are reference metadata and may describe a service department, cross-listed analogue, or catalog source rather than the best Lycium catalog home.
- `scope`: define audience, outcomes, duration, exclusions, workload, assessment model, and `Module` vs `Week` pacing.
- `module_structure`: create the module/week arc and make each module serve a distinct role.
- `section_structure`: create Learn and Apply sections, keeping instruction and assessment separate.
- `content_draft`: fill sections with actual learner-facing explanation, examples, practice, source references, and concept cards.
- `assessment`: create assessment-only quiz sections that test previously taught or sourced concepts.
- `media`: best-effort source-backed video/media discovery. Log skipped or failed media stages, but do not fail an otherwise valid course solely because reputable video support is unavailable.
- `summary`: end modules/weeks with concept-card summaries pulled from prior Learn pages.
- `validation`: run schema, source-reference, placeholder-prose, structure, assessment, and taxonomy checks.
- `quality_eval`: score course quality across structure, instructional substance, assessment, concept-card integrity, source grounding, media support, and course specificity.
- `review_publish`: keep generated courses in draft/review until quality gates pass or a reviewer explicitly force-publishes with a reason.

1. Determine course scope.
   Define the learner level, prerequisites, course outcome, expected duration, depth, assessment style, source expectations, what the course should explicitly not cover, and a short catalog description.

2. Divide the course into 10-20 modules.
   Each module should represent a major conceptual or practical arc. Modules should build progressively, like a real college or professional online course.

3. Choose the learner-facing pacing label.
   Select exactly one label for the whole course: `Module` or `Week`. Record it in `metadata.pacingLabel` and use it consistently in module titles, summary titles, progress-facing names, and summary concept-card titles. Do not mix `Module` and `Week` in learner-facing titles in the same course.

4. Divide each module/week into units.
   Default to 4-15 units per module unless the user asks for a shorter course. A unit should be teachable in one focused lesson page.

5. Divide each unit into sub-units for individual ideas.
   Each sub-unit should cover one teachable idea, technique, case study, source excerpt, example, or practice target. Avoid vague catch-all sub-units.

6. Find citations and sources for each idea.
   Use reputable sources, record them centrally, and map every sourced idea to source IDs before writing final content.
   If benchmark curricula are available, map sources to benchmark-derived requirements rather than letting the source list define the curriculum.
   When many sources are submitted, run source corpus preflight first and do not use excluded sources as course evidence unless a reviewer restores them.

7. Generate instructional content for each idea.
   Teach the concept, connect it to prior units, include examples or practice where useful, and keep the pacing coherent.
   Write learner-facing content directly. Do not write prompts, outlines, or instructions for a future model to fill in later.

8. Generate assessments separately.
   Quizzes must be their own assessment sections after the relevant lesson/unit content.

9. Generate module/week concept inventories.
   End every module/week with a summary section that aggregates the raw concept names introduced on that module/week's Learn pages. Do not turn the summary into interpretive prose categories.

10. Validate coherence.
   Check that modules progress logically, units are not redundant, prerequisites are introduced before use, and assessments only test taught or sourced material.

11. Gate catalog intake.
   A generated course must pass structural and source-reference validation before it can be added to the catalog. Invalid generated JSON should produce a visible generation error and remain outside learner-facing course lists.

12. Publish only after a quality report.
   The generation pipeline should produce a `quality_report` in the snapshot trace. A course can move to `published` only when the quality report passes the publish gate or an explicit force-publish review action records why the gate was overridden.

13. Experiment before publishing.
   LLM course generation experiments should use the non-persisting experiment path first. The experiment path returns the generated course, trace data, and `quality_report.evals` so prompts, sources, and gates can be tuned without adding weak drafts to the catalog.

14. Prefer staged generation for local or smaller models.
   When a model struggles to return one complete valid course JSON object, generate a compact course plan first, then draft one module at a time, assemble the course, and run the same quality evals on the assembled result.

## JSON Progress Tracking

Agents should use the course JSON as a progress ledger while building. Add or preserve metadata that records planning state when useful:

- `metadata.scope`: audience, prerequisites, target outcome, duration, level, and exclusions.
- `shortDescription`: a concise one-sentence course summary used on catalog cards, ideally 80-160 characters.
- `difficultyLevel`: a learner-facing difficulty label used in course info modals.
- `category`: one broad university-style college or school category.
- `department`: selected department classification nested under the selected college; generated courses should preserve the chosen department exactly and catalog search should include it. A department should not be used unless it belongs to the selected `category`.
- `courseEquivalencies[].department`: parity/reference department text only; do not treat it as the authoritative catalog classification when it conflicts with the course's primary subject, audience, or program role.
- `tags`: specific subject labels that are narrower than the category.
- `learningTypes`: an array reserved for future course modality metadata; leave empty for now.
- `courseEquivalencies`: optional real or representative college catalog parity records.
- `metadata.curriculumBenchmarks`: optional benchmark records or benchmark IDs used to derive course requirements.
- `metadata.requirementOrigins`: optional evidence records explaining whether requirements came from common academic requirements, certification requirements, employer requirements, expert review, or generated gap filling.
- `metadata.courseParityProfile`: optional summary of benchmark coverage, required topics, optional topics, and parity status.
- `metadata.sourceSlots`: optional primary/fallback source mappings for required concepts.
- `metadata.sourceCorpusSynthesis`: optional source corpus preflight evidence showing included sources, excluded sources, common themes, relevance scores, and source-count metrics.
- `prerequisites`: optional course, competency, assessment, program, or external prerequisites.
- `metadata.prerequisiteCourseIds`: optional fast-reference list for planned/wrapper courses.
- `metadata.pacingLabel`: exactly `Module` or `Week`, used consistently in learner-facing titles.
- `metadata.generationPlan.modules`: planned module names and outcomes.
- `metadata.generationPlan.unitMap`: planned units for each module.
- `metadata.generationPlan.ideaMap`: sub-units or individual ideas for each unit.
- `metadata.generationPlan.sourceMap`: source IDs mapped to units or ideas.
- `metadata.generationPlan.status`: progress markers such as `scoped`, `modules_planned`, `units_planned`, `sources_mapped`, `content_drafted`, and `validated`.
- `generation_trace.quality_report`: backend-generated validation, warning, metric, and score data used by review and publish gates.
- `generation_trace.quality_report.evals`: deterministic quality-eval dimensions and recommendations for judging course usefulness before review or publish.

Renderer-facing content still belongs in `modules[].sections[].content`; planning metadata should support agents without replacing the actual course structure.

## Coherence Constraints

- A course must have a clear through-line from first module to final outcome.
- Each module must have a distinct purpose and must not duplicate another module.
- Each unit must teach a bounded objective that supports its parent module.
- Each sub-unit or idea must be small enough to explain, source, and assess.
- Introduce prerequisite concepts before advanced applications.
- Keep terminology consistent across modules.
- Use either `Module` or `Week` consistently in learner-facing titles. If module titles use `Week 1: ...`, summary titles and summary concept-card titles should use `Week`; if module titles use `Module 1: ...`, they should use `Module`.
- Balance theory, examples, practice, and assessment.
- Catalog-visible courses must contain actual learner-facing explanations, examples, activities, concept cards, summaries, and assessment sections. They must not read like placeholders or model instructions.
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
- Real module quizzes should include at least 10 questions. More than 10 is acceptable when it improves concept coverage.
- Each quiz question must use `question`, `options`, and `answers`.
- `answers` must be an array of zero-based option indexes, such as `[0]`, not answer objects or answer IDs.
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

- Every module/week should end with a concept inventory using the course's selected pacing label.
- Mark module summaries with `sectionType: "summary"` when authoring JSON or backend-generated sections.
- Mark module summaries with `pageType: "learn"`.
- Summary sections are instructional Learn pages, not assessments.
- Use one `conceptCards` block titled `{PacingLabel} concepts`, such as `Module concepts` or `Week concepts`.
- Pull the summary concepts from concept cards on the module's preceding Learn pages.
- Summary concept objects should preserve `name`, `description`, and `sourceSectionId` so the UI can show the definition and later link back to the originating page.
- Do not create summary cards named "Key concepts", "How the ideas connect", "Common pitfalls", or "What you can do now".
- Do not add new concepts on the summary page unless they were introduced on a prior Learn page in the same module.
- Do not mix quizzes into module summary sections.

## Source Record Rules

- Store reusable source metadata in `apps/lycium-web/src/courseData/sourceRecords/`.
- Course records should reference sources using `sourceIds`.
- Use source IDs at the most helpful levels: course, module, section, and block.
- If a block fetches or embeds material from a link, it must reference the source record for that link.
- Generated courses must either reference existing central source records or include course-level `sourceRecords` for generated/local-only records.
- Do not let a generated course enter the catalog with unresolved `sourceIds`.

## MVP Validation Gate

- Backend agent generation must normalize and validate generated JSON before persistence.
- Backend LLM experiments should return rejected drafts with quality evals instead of hiding them behind a single failure string.
- Frontend catalog intake must validate generated and remote courses before adding them to the learner catalog.
- Backend publication must compute a quality report and set the snapshot to `published` only after the gate passes.
- Course creation UI should remain locked until an active AI provider key and selected model are available.
- Validation should reject missing modules, missing sections, missing `pageType`, mixed quiz/instruction sections, missing concept cards on Learn pages, missing summary sections, and unresolved source IDs.
- Validation errors should be surfaced as generation failures rather than silently accepting broken course data.

## Quality Eval Dimensions

- `structure`: modules, section counts, and terminal module concept reviews.
- `instructional_substance`: direct explanation, examples, practice prompts, and learn-page depth.
- `assessment`: quiz-only assessment sections, one quiz per module, at least 10 questions, and valid answer indexes.
- `concepts`: concept-card presence, concept descriptions, and summary concepts linked back to source sections.
- `source_grounding`: source records, source IDs, unresolved references, and section-level source coverage.
- `media`: source-backed video coverage when reputable video material is available.
- `specificity`: detection of placeholder prose, prompt-like instructions, repeated template titles, and generic course filler.

## Course Health Loop

- Treat course health as the shared review surface for learner feedback, source suggestions, deterministic quality evals, validation findings, and reviewer actions.
- Keep course-health data separate from course JSON. Course JSON is the learning artifact; health data is operational review evidence.
- Learner feedback records may include the latest rating, rating events, optional written feedback, feedback magnitude, source suggestions, and update timestamps.
- Store `feedback_magnitude` as a structured 1-3 signal. Emoji are UI presentation only and should not be used as stored contract data.
- Course health status should use `unknown`, `healthy`, `watch`, or `needs_review`.
- `unknown` means there is not enough feedback or eval evidence yet.
- `healthy` means current signals are positive and no obvious review trigger is present.
- `watch` means feedback, source suggestions, or quality findings should be reviewed but do not necessarily block the course.
- `needs_review` means negative feedback, failed gates, unresolved source problems, or poor evals should block publishing or trigger revision.
- Source suggestions should become review tasks before being accepted into central source records.
- Future eval work should write into the same course-health surface rather than creating disconnected dashboards.

## Generation Log Retention

- Keep full generation job logs in a small ring buffer.
- Default retention is the latest 5 course-generation job logs.
- Preserve the generated course snapshot separately from the job log so trimming logs does not delete learner-visible courses.
- Log nonfatal media failures in the generation trace under media stage records.
