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

- Passive generation and active generation are separate modes.
  Passive generation plans, organizes, links, or proposes curriculum. It may create program contracts, cluster plans, course wrappers, source requests, fit evidence, and review candidates, but it should not generate learner-facing lessons or silently attach parent structures when threshold or review gates are missing.
  Active generation materializes source-backed course content. It advances source packets into outlines, module plans, section plans, section content, module Apply sections, module summaries, module assembly, active batches, quality reports, and review promotion.
- Program, cluster, course-wrapper, and course-content generation are separate workflows.
  Program generation creates the requirement graph and cluster plan. Cluster generation searches the available course inventory, inspects course titles plus internal evidence such as module titles, section titles, concept cards, tags, and descriptions, then links only courses with recorded fit evidence. If a needed course is missing or fit is uncertain, the workflow creates a course wrapper instead of generating a complete course immediately.
- Program brief generation is the topmost passive workflow.
  Before generating requirement groups, create an inspectable `program-brief-v1` artifact that captures the user goal, program title, program type, field, level, target audience, target outcome, short description, learning outcomes, broad requirement group plan, evidence mode, and assumptions. The brief must not materialize course IDs, wrappers, or active-generation plans.
- Cluster generation emits inspectable `cluster-plan-v1` artifacts and a `cluster-quality-report-v1` before course wrappers are created.
  A cluster plan should carry title, purpose, learning outcomes, dependency profile, assembly readiness, required concepts, and abstract `cluster-course-kind-v1` records. It may reference planned requirement/course identifiers, but it must not create course wrappers, active-generation plans, build tasks, modules, sections, or learner-facing content.
- Course-wrapper generation emits a `course-wrapper-quality-report-v1`.
  Wrapper rows should include source requests, active-generation plans, course-build tasks, prerequisite metadata, placeholder policy, and generation prompts that require source packets before outline/content generation. They must not contain modules, sections, or learner-facing content.
- Course module outline generation emits a `course-module-outline-quality-report-v1`.
  Source-packet module outlines should validate source-packet usability, module titles, module learning objectives, module concept keywords, module source IDs, duplicate module titles, target section counts, and the absence of learner-facing lesson content.
- Module section planning is a separate active workflow from module outline generation and section fill.
  It expands one module outline into section-plan records and adds planned empty section shells to the course/module structure with section titles, planning-only descriptions, learning objectives, concept keywords, source IDs, and empty `content` arrays before section fill starts.
- Section fill is the only active workflow that replaces planned empty section shells with learner-facing content blocks.
  It should preserve source IDs only for sources the generated section actually uses, resolving those IDs against the course source catalog. It should not auto-attach the full planned, module, or course source list just because sources were available.
- Module Apply generation is a separate active workflow after section fill and before module assembly.
  It should create or validate Apply sections from concepts taught in filled lesson sections, enforce quiz/project assessment shape, require real quiz banks to have at least 10 valid questions when quiz-based, omit section/block `sourceIds` so Apply pages do not render a source footer, and fail empty assessment payloads instead of hiding them in module assembly.
- Module summary generation is a separate active workflow after section fill and before module assembly.
  It should create or validate a concept-card inventory from filled Learn sections, preserve `sourceSectionId`, copy only source IDs already present on summarized concepts or lesson sections, and avoid adding the full module/course source list.
- Passive workflows should hand off to active workflows through explicit artifacts such as course wrappers, source requests, source packets, `metadata.activeGenerationPlan`, `metadata.courseBuildOutline`, and course build tasks.
- Curriculum assembly inference should use shared thresholds before generating or attaching parent structures: cluster generation from orphaned courses requires at least 3 related courses and treats 4+ as recommended; program generation from orphaned clusters requires at least 2 related clusters and treats 3+ as recommended. Below the minimum, surface fit candidates only.
- Course wrappers are real planning artifacts, not hollow learner pages.
  A wrapper should preserve the course title, cluster, requirement id, prerequisites, source needs, generation prompt, estimated time, and active-generation plan. Wrappers may appear as drafts or source-gapped shells, but they should not pretend to be complete courses.
- Active generation should generate course content in small batches.
  Prefer generating the bottom-level requisite courses first, then materialize course modules on demand, usually two modules at a time. Ungenerated sections should be represented as an explicit state such as `not_generated` with learner text like `Section not yet generated`, plus a generate action that opens the source/source-gap flow when source coverage is incomplete.
- `intake`: parse the prompt, links, files, level, goals, constraints, and intended course type.
  Course generation should accept source inputs beyond URLs, including uploaded documents, PDFs, slide decks, notes, transcripts, media, source packets, and connector-provided source refs. Preserve extraction status and inclusion/exclusion decisions for each input artifact.
  Native Lycium file-reading, extraction, retrieval, tutoring, grading, and other AI-adjacent primitives must stay adapter-shaped. They are temporary local implementations that should be replaceable by Infring OS or other Protheus ecosystem primitives without rewriting course-generation logic.
  Record course purpose separately from learning method. Course purpose may include academic course, practical training course, exam prep, self-study pathway, or program component. Learning method may include project-first, text-heavy, video-supported, flashcard-supported, tutor-guided, or assessment-heavy.
- `source_corpus_preflight`: score submitted sources against the course prompt, keep relevant sources, and exclude unrelated sources before benchmark extraction or course planning.
  Prefer `source-packet-v1` inputs when available because they preserve import decisions, snapshots, source documents, and evidence refs. Loose URL lists are fallback input, not the ideal generation evidence contract.
- `benchmark_intake`: identify university catalogs, syllabi, certification outlines, employer profiles, or expert references that can anchor the curriculum.
- `requirement_extraction`: extract benchmark requirements, topics, outcomes, prerequisites, and course-parity metadata.
- `commonality_analysis`: compare comparable benchmarks to separate required material from recommended, optional, remedial, alternate, or enrichment material.
- `source_analysis`: inspect provided sources, extract topics, claims, examples, media, exercises, prerequisites, and source metadata, then verify concept-level source coverage and section citation integrity.
- `source_enrichment`: query Source Index with `source-index-search-v1` before asking the user for more sources, then add reputable supplemental sources when coverage is weak.
- `source_coverage_gate`: when required concept coverage or source strength is below policy, emit structured `metadata.sourceGaps`, set lifecycle status `needs_sources`, and block review-ready or publishable claims. Still generate a coherent module and section outline plus distinct best-effort lesson scaffolds, and keep the draft openable. Do not repeat one source-gap placeholder across section bodies. Do not use raw source count as the readiness decision; one comprehensive textbook, syllabus packet, extracted document, or source packet may be enough when it covers the required concepts with strong depth, relevance, authority, and extractability.
- `generation_readiness_gate`: preserve a `course-generation-readiness-v1` report for every full source-backed generation attempt. Full learner-facing courses must carry `metadata.generationReadiness` with `status: "ready"`, `ready: true`, adequate `sourceStrength`, adequate concept coverage, and no blocking readiness issues. Sparse-source drafts must preserve the non-ready report in both `metadata.generationReadiness` and `generation_trace.generation_readiness`.
- `classification`: assign college/school category, selected department metadata, tags, difficulty, parity metadata, and prerequisites.
  Select the college/category first, then select the department only from the departments nested under that college/category. Classify by the course's primary learning domain, learner purpose, and program role. Do not mechanically map `courseEquivalencies[].department` into top-level `category` or `department`; parity records are reference metadata and may describe a service department, cross-listed analogue, or catalog source rather than the best Lycium catalog home.
- `scope`: define audience, outcomes, duration, exclusions, workload, assessment model, and `Module` vs `Week` pacing.
- `module_structure`: create the module/week arc and make each module serve a distinct role.
- `section_structure`: create Learn and Apply sections, keeping instruction and assessment separate.
- `content_draft`: fill sections with actual learner-facing explanation, examples, practice, source references, and editor-native concept card blocks.
  When uploaded files or long source documents are used, staged generation must pass bounded, stage-relevant excerpts into lesson, quiz, media, and summary prompts. Do not dump full extracted documents into every model call.
- `assessment`: create mastery-evidence sections that test or verify previously taught or sourced concepts. Evidence may be a quiz, longer test/exam-style question bank, project, lab, simulation, portfolio task, or rubric-graded submission. Quiz sections remain quiz-only.
- `projects`: create project, lab, simulation, portfolio, or practical-task sections when the course type, learning method, or program requirements call for applied evidence. Projects should include instructions, required evidence, source context, rubric criteria, one canonical submission type, optional submission methods, and grader workflow metadata.
- `tutor_grader`: when tutor or grader support is requested, define allowed context explicitly. Tutor and grader workflows should use course content, source records, source packets, learner progress, project submissions, and rubrics as bounded inputs rather than unrestricted web or model memory.
- `media`: best-effort source-backed video/media discovery. Log skipped or failed media stages, but do not fail an otherwise valid course solely because reputable video support is unavailable.
- Video sources should be recorded as full source records. Reuse a video in a section with a `video` block and optional `clip: { "startSeconds": n, "endSeconds": n }` when the learner should watch only the relevant slice. Omit `clip` to use the whole video.
- `summary`: end modules/weeks with concept-card summaries pulled from prior Learn pages.
- `validation`: run schema, source-reference, placeholder-prose, structure, assessment, and taxonomy checks.
- `quality_eval`: score course quality across structure, instructional substance, assessment, concept-card integrity, source grounding, media support, and course specificity.
- `review_publish`: keep generated courses in draft/review until quality gates pass or a reviewer explicitly force-publishes with a reason.

## Professional Eval Direction

- Maintain a small fixed eval suite before expanding generation features. The current minimum scenarios are documented in `docs/course-generation-eval-scenarios.md`.
- Treat eval scenarios as product contracts: a model/provider combination is not trusted for full course generation until it can pass the flagship scenarios with source evidence, benchmark evidence, valid contracts, assessments, summaries, and review/publish gates.
- Use local model capability sweeps before blaming or trusting a model. A model should first pass primitive `plan`, `section`, and `quiz` tasks, then a composed one-module benchmark, before being used for full-course generation confidence.
- Prefer validated primitive generation plus deterministic course assembly over monolithic long-running course generation calls when the task can be decomposed. If high-tier models pass primitives but fail full generation, treat the workflow, source packing, assembly, or gates as the likely bottleneck.
- The flagship software engineering program should remain the primary program-quality fixture because it exercises requirement groups, prerequisite graphs, capstones, portfolio evidence, source parity, and course wrappers.
- CHEM 105 should remain the primary full-course eval because it tests whether Lycium can generate a real undergraduate course from free reputable sources rather than a software-only demo.
- Messy source-corpus evals must prove that irrelevant or weak sources are excluded before generation. The generator should not silently use excluded sources.
- Review/publish evals must prove that weak generated courses remain drafts and expose gate evidence to reviewers.

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
   If submitted sources do not meet the course's source coverage and source-strength policy, create or preserve a `needs_sources` draft with structured `metadata.sourceGaps`, a real module and section outline, and distinct best-effort lesson scaffolds. Source readiness is based on concept coverage, depth, relevance, authority, extractability, and diversity, not on a simple minimum source count. Keep workflow labels such as `needs_sources` and `source gap` out of learner-facing titles.
   Preserve the source-readiness decision as `metadata.generationReadiness`. Full generated courses must keep the positive readiness report that allowed generation to proceed, and the same report should be copied into `generation_trace.generation_readiness` so review, observability, and eval tooling can explain why the course was considered source-ready.
   Source IDs should narrow as the course narrows: course-level `sourceIds` are the full accepted inventory, module-level `sourceIds` support the module, and section/block `sourceIds` should only be added for sources actually used by that section or block. Citation numbers are assigned from the course-wide source inventory.
   Text blocks may include inline citation markers such as `[1]`; each marker must be a 1-based index into the course-wide source inventory and must resolve to a supporting source for the nearby claim.

7. Generate instructional content for each idea.
   Teach the concept, connect it to prior units, include examples or practice where useful, and keep the pacing coherent.
   Write learner-facing content directly. Do not write prompts, outlines, or instructions for a future model to fill in later.

8. Generate assessments separately.
   Assessment means mastery evidence, not only quizzes. Quizzes and longer tests must be their own assessment sections after the relevant lesson/unit content. Projects, labs, simulations, portfolio tasks, and submissions should be their own Apply sections with project blocks, rubrics, submission policy, and grader workflow metadata. Apply sections assess the course content itself and should not include section/block `sourceIds` or render a source footer.

9. Generate module/week concept inventories.
   End every module/week with a summary section that aggregates the raw concept names introduced on that module/week's Learn pages. Use one heading block followed by one editable `conceptCard` block per concept. Do not turn the summary into interpretive prose categories.

10. Validate coherence.
   Check that modules progress logically, units are not redundant, prerequisites are introduced before use, and assessments only test taught or sourced material.

11. Gate catalog intake.
   A generated course must pass structural and source-reference validation before it can be added to the catalog. Invalid generated JSON should produce a visible generation error and remain outside learner-facing course lists.
   Source-gapped planning drafts may appear in the catalog as incomplete `needs_sources` artifacts and remain openable. Show an incomplete-source notice on section pages; source readiness gates review and publication rather than outline generation or course access.

12. Publish only after a quality report.
   The generation pipeline should produce a `quality_report` in the snapshot trace. A course can move to `published` only when the quality report passes the publish gate or an explicit force-publish review action records why the gate was overridden.

13. Experiment before publishing.
   LLM course generation experiments should use the non-persisting experiment path first. The experiment path returns the generated course, trace data, and `quality_report.evals` so prompts, sources, and gates can be tuned without adding weak drafts to the catalog.

14. Prefer staged generation for local or smaller models.
   When a model struggles to return one complete valid course JSON object, generate a compact course plan first, then draft one module at a time, assemble the course, and run the same quality evals on the assembled result.

## JSON Progress Tracking

Agents should use the course JSON as a progress ledger while building. Add or preserve metadata that records planning state when useful:

- `metadata.scope`: audience, prerequisites, target outcome, duration, level, and exclusions.
- `metadata.courseType`: optional course purpose such as `academic_course`, `practical_training`, `exam_prep`, `self_study_pathway`, or `program_component`.
- `metadata.learningMethod`: optional method profile that records modality preferences such as project-first, text-heavy, video-supported, flashcard-supported, tutor-guided, or assessment-heavy.
- `metadata.inputArtifacts`: optional source inputs used for generation, including uploaded docs, source packets, URL lists, transcripts, media, connector refs, extraction status, source-fit decisions, and exclusion decisions.
- `shortDescription`: a concise one-sentence course summary used on catalog cards, ideally 80-160 characters.
- `estimatedMinutes` or `estimatedHours`: optional learning-time estimates on courses, modules, and sections. Prefer section-level `estimatedMinutes` when enough detail is known.
- Program and cluster `estimatedHours` values are authored fallbacks. If every child section, course, or requirement has usable time data, renderers should derive the parent estimate from those children.
- If child time data is incomplete, use the closest authored parent estimate and label the estimate source as authored or mixed rather than pretending it was fully derived.
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
  When a source packet is used, this should include `sourcePacket.contractVersion`, packet context, packet warnings, source-document count, and included/excluded source metrics.
- `metadata.sourceCoveragePolicy`: optional minimum source policy for full course generation, including minimum course sources, per-module coverage, concept coverage percentage, benchmark evidence, and assessment coverage.
- `metadata.sourceGaps`: optional structured source requests attached to course, module, section, requirement, or assessment scopes. Blocking gaps should mark best-effort content incomplete and prevent publication, not prevent outline generation or learner access to the draft.
- `metadata.sourceGapSuggestions`: optional source URLs queued against `metadata.sourceGaps` for review before generation resumes.
- `metadata.generationReadiness.sourceStrength`: required source-strength report for backend-generated full courses and `needs_sources` drafts. It should use `source-strength-v1` and score concept coverage, depth, relevance, authority, extractability, and diversity so comprehensive documents can satisfy readiness even when source count is low.
- `metadata.courseHealth`: optional `course-health-v1` summary combining lifecycle status, generation quality, source integrity, source gaps, learner feedback, and source suggestions. Treat this as review/diagnostic metadata, not learner-facing lesson content.
- `metadata.generationReadiness`: required for full source-backed generated courses and `needs_sources` drafts. Ready courses must use `status: "ready"` and `ready: true`; under-sourced drafts must preserve a non-ready status with source evidence counts, concept coverage rows, uncovered concepts, and readiness issues.
- `metadata.tutorWorkflow`: optional tutor workflow contract, including allowed context, model/provider reference, section context, learner privacy policy, retention policy, and analytics permission.
- `metadata.graderWorkflows`: optional grader workflow contracts for projects or submissions, including rubric id, allowed source context, expected learning outcomes, feedback policy, override policy, and human review state.
- `metadata.analyticsPolicy`: optional owner-configurable analytics policy distinguishing private learner data, owner-visible aggregate metrics, public popularity metrics, and unique-view counting.
- `metadata.owner`: optional owner or creator identity reference for course lineage, attribution, forks, analytics permissions, and future creator profiles.
- `prerequisites`: optional course, competency, assessment, program, or external prerequisites.
- `metadata.prerequisiteCourseIds`: optional fast-reference list for planned/wrapper courses.
- `metadata.pacingLabel`: exactly `Module` or `Week`, used consistently in learner-facing titles.
- `metadata.generationPlan.modules`: planned module names and outcomes.
- `metadata.generationPlan.unitMap`: planned units for each module.
- `metadata.generationPlan.ideaMap`: sub-units or individual ideas for each unit.
- `metadata.generationPlan.sourceMap`: source IDs mapped to units or ideas.
- `metadata.generationPlan.status`: progress markers such as `scoped`, `modules_planned`, `units_planned`, `sources_mapped`, `content_drafted`, and `validated`.
- `sections[].metadata.generationOutline`: optional section-level planning evidence for generated content. When a section is generated from a source-packet or benchmark-derived outline, preserve the planned outline IDs, concept keywords, learning objectives, source IDs, planning source, and role so review/eval gates can compare intended coverage against final content.
- `generation_trace.generation_readiness`: backend-generated readiness evidence copied from the pre-generation source-readiness gate. It must stay in sync with `metadata.generationReadiness` for generated courses and source-gap drafts.
- `generation_trace.quality_report`: backend-generated validation, warning, metric, and score data used by review and publish gates.
- `generation_trace.quality_report.evals`: deterministic quality-eval dimensions and recommendations for judging course usefulness before review or publish. The `generation_outline_coverage` dimension should compare section `metadata.generationOutline.plannedConceptKeywords` against the final section text and concept cards when outline metadata exists.

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
- Generated courses must use the same atomic block format as the course editor: `text`, `heading`, `conceptCard`, `image`, `visual`, `video`, `iframe`, `quiz`, and `project`. Project blocks may include nested rubric, submission, and grader workflow objects. Do not generate monolithic markdown, plain-string section content, or large nested concept-card payloads when smaller editable blocks are possible.
- Prefer deeper coverage of fewer ideas over shallow lists of loosely related topics.
- Cite sources for claims, readings, videos, examples, and imported content.
- Do not blanket-cite the same full course source list on every section. Section source lists should be derived from that section's concept-source mapping, then sorted by course-wide citation number.
- Inline `[n]` citations in text blocks should be used for source-backed claims when helpful, and must point to course-wide source index entries connected to that page or block through local `sourceIds`.
- Do not let source availability alone dictate course structure; structure the course pedagogically, then find or create appropriate sourced content for each idea.

## Assessment Rules

- Assessment can be satisfied by quizzes, longer tests, projects, labs, simulations, portfolio tasks, or rubric-graded submissions.
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

## Editor-Native Content Block Rules

- Generated course content must be easy for a human to edit in the UI without structural repair.
- Use `text` blocks for learner-facing prose.
- Use `heading` blocks for visible labels such as `Concepts introduced`, `Module concepts`, and `Week concepts`.
- Use one `conceptCard` block per concept, with `title` or `name` and `description`.
- Use `video` blocks for source-backed videos and optional `clip` slices; do not add filler video titles by default.
- Use `iframe` blocks for generic embeds.
- Use `quiz` blocks only in assessment Apply sections.
- Use `image` or `visual` blocks for diagrams, images, charts, or AI-generated visuals. Image/visual blocks should include `url` or `src`, required `alt`, optional `caption`, source IDs or generation provenance, and license/provenance metadata when applicable.
- Use `flashcardSet` blocks for structured recall practice. Flashcards should include prompt, answer, optional hint, explanation, concept tags, and source IDs.
- Use `project` blocks or dedicated project sections for applied work, including projects, labs, simulations, portfolio tasks, and practical exams. Projects should include instructions, artifact type, required evidence, source IDs, a rubric object, a submission policy, and grader workflow metadata.
- Use rubric objects for project or non-quiz assessment grading. Rubrics should define criteria, performance levels, point or mastery rules, and feedback expectations.
- Use submission objects for learner artifacts that may later be graded by an agent or human reviewer. Submission policies should choose one canonical `submissionType`, such as `text`, `link`, `doc`, `image`, or `file`. If a type can be submitted through multiple methods, record those methods separately in `submissionMethods`; do not enable every possible input field for one project.
- Treat legacy `conceptCards` stacks as backward-compatible input only. New generated courses should prefer atomic `conceptCard` blocks so concepts can be dragged, edited, and deleted individually.

## Tutor, Grader, and Analytics Rules

- Tutor workflows should be grounded in the active course, current section, source records, source packets, curriculum benchmarks, learner progress state, and explicitly allowed context.
- Tutor workflows should not answer from unrestricted web context unless the course or deployment explicitly enables broader search mode.
- Grader workflows should grade against a structured rubric, the project instructions, expected outcomes, previous course material, and supporting sources.
- Submission grading should be represented as a bounded workflow request containing the project block, submission payload, rubric, required evidence, source records, learner/course identifiers when available, and explicit grader mode. The grader response should include criterion-level scores, evidence notes, feedback, next steps, bounded context, and human-review status without mutating course JSON.
- Agent grader feedback should be inspectable and overridable by authorized human graders when the deployment supports human grading.
- Analytics should be permissioned by course owner or deployment policy. Keep private learner progress, private submissions, and tutor conversations separate from aggregate course-health metrics.
- Creator-facing or public metrics should use aggregate and unique-view counts without exposing personally identifiable learner data.

## Concept Card Rules

- Use editable `conceptCard` blocks to make introduced raw concepts explicit and easy to render with CSS.
- Concept cards are raw concept inventories, not prose summaries, interpretations, advice, or explanations.
- Each `conceptCard` block should contain one simple concept using `title` or `name` plus `description`.
- Concept names should read like bullet-list terms: `HTTP request`, `CSS specificity`, `Training-serving skew`, `Gradient synchronization`.
- Concept descriptions should be concise definitions of the concept, not prose summaries of the page.
- Every non-assessment Learn page should end with a `heading` block titled `Concepts introduced`, followed by one `conceptCard` block per introduced concept.
- Concept cards should read like a bullet list of actual course concepts, not generated interpretation or study advice.
- Do not add concept cards to quiz-only Apply pages.
- Do not write paragraph-length teaching content in concept cards.

## Module Summary Rules

- Every module/week should end with a concept inventory using the course's selected pacing label.
- Mark module summaries with `sectionType: "summary"` when authoring JSON or backend-generated sections.
- Mark module summaries with `pageType: "learn"`.
- Summary sections are instructional Learn pages, not assessments.
- Use one `heading` block titled `{PacingLabel} concepts`, such as `Module concepts` or `Week concepts`, followed by one `conceptCard` block per reviewed concept.
- Pull the summary concepts from concept cards on the module's preceding Learn pages.
- Summary concept cards should preserve `title` or `name`, `description`, and `sourceSectionId` so the UI can show the definition and later link back to the originating page.
- Do not create summary cards named "Key concepts", "How the ideas connect", "Common pitfalls", or "What you can do now".
- Do not add new concepts on the summary page unless they were introduced on a prior Learn page in the same module.
- Do not mix quizzes into module summary sections.

## Source Record Rules

- Store reusable source metadata in `apps/lycium-web/src/courseData/sourceRecords/`.
- Course records should reference sources using `sourceIds`.
- Use source IDs at the most helpful levels: course and module for available/catalog evidence; section and block only for sources actually used in that learner-facing section.
- If a block fetches or embeds material from a link, it must reference the source record for that link.
- Do not blanket-cite the same full course source list on every page. Section source footers should resolve only local section/block refs through the course source catalog, and Apply sections should not render source footers.
- Generated courses must either reference existing central source records or include course-level `sourceRecords` for generated/local-only records.
- Course generation should accept source packets as the preferred source handoff. A source packet records the corpus run, inclusion/exclusion decisions, source documents, snapshots, and evidence refs that explain why a source was used.
- Course generation should use Source Index in reverse during enrichment: search the index for missing concepts, replacement sources, benchmark evidence, and media candidates before treating a course as blocked for lack of sources.
- Newly submitted sources should be checked with source-fit analysis against abstract course/program/concept descriptors. Fit results are review candidates only; they should not automatically attach a source to a course section without acceptance.
- Do not let a generated course enter the catalog with unresolved `sourceIds`.

## MVP Validation Gate

- Backend agent generation must normalize and validate generated JSON before persistence.
- Backend LLM experiments should return rejected drafts with quality evals instead of hiding them behind a single failure string.
- Frontend catalog intake must validate generated and remote courses before adding them to the learner catalog.
- Backend publication must compute a quality report and set the snapshot to `published` only after the gate passes.
- Course creation UI should remain locked until an active AI provider key and selected model are available.
- Validation should reject missing modules, missing sections, missing `pageType`, mixed quiz/instruction sections, malformed project/rubric/submission blocks, missing concept cards on Learn pages, missing summary sections, and unresolved source IDs.
- Validation errors should be surfaced as generation failures rather than silently accepting broken course data.

## Quality Eval Dimensions

- `structure`: modules, section counts, and terminal module concept reviews.
- `instructional_substance`: direct explanation, examples, practice prompts, and learn-page depth.
- `assessment`: mastery evidence per module through quiz-only question banks, longer tests, projects, labs, simulations, portfolio tasks, or rubric-graded submissions. Quiz-style assessments need at least 10 questions and valid answer indexes.
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
