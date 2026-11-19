# Course Generation Workflow Test Matrix

Last updated: 2026-11-13

This document tracks the workflow-level tests for Lycium generation. Update it whenever a workflow stage is added, split, or promoted from smoke coverage to stronger integration coverage. The contract tests verify artifact shape and handoff behavior. Live teaching quality is tracked below.

## Status Legend

- `Passing`: covered by focused tests in the recorded verification.
- `Basic`: covered by smoke tests, but needs deeper product-shape assertions.
- `Next`: the next workflow layer to strengthen.
- `Planned`: not yet covered as an independent workflow test.

## Generation Mode Boundaries

- Passive generation plans, organizes, links, or proposes curriculum. It emits program contracts, clusters, course wrappers, source requests, fit evidence, and review candidates. It should not create learner-facing lessons or silently attach parent structures when threshold or review gates are missing.
- Active generation materializes source-backed course content. It advances source packets into outlines, module plans, section plans, section content, module assembly, active batches, quality reports, and review promotion.
- Passive workflows hand off to active workflows through explicit artifacts: course wrappers, source requests, source packets, course build tasks, `metadata.activeGenerationPlan`, and `metadata.courseBuildOutline`.
- Stage workflow keys, contract versions, public stage names, UI status messages, passive/active ordering, and next-workflow handoffs live in `services/lycium-api/app/course_generation_stage_registry.py`. The large stage implementation module re-exports the contract constants for backward-compatible imports.

## Passive Planning Workflows

| Workflow level | Contract or report | Primary tests | Current status | Notes |
| --- | --- | --- | --- | --- |
| Curriculum assembly thresholds | `curriculum-assembly-policy-v1` | `test_curriculum_assembly_policy.py` | Passing | Cluster-from-courses requires 3, recommends 4. Program-from-clusters requires 2, recommends 3. |
| Program brief generation | `program-brief-v1`, `program-brief-workflow-v1` | `test_course_generation_stage_workflows.py` | Passing | Validates title, type, field, level, audience, outcome, learning outcomes, broad group plan, benchmark-vs-prompt evidence mode, empty-goal blocking, and no course/wrapper materialization. |
| Requirement-group plan generation | `requirement-group-plan-v1`, `requirement-group-plan-workflow-v1` | `test_course_generation_stage_workflows.py` | Passing | Validates group titles, purposes, themes, dependency plan, checkpoint/capstone planning, and no course/wrapper materialization before program generation. |
| Program generation | `program-generation-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Validates domain fallback curricula, program contract, requirement groups, and scaffold handoff. |
| Cluster generation | `cluster-generation-workflow-v1`, `cluster-plan-v1`, `cluster-quality-report-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Clusters expose abstract `courseKinds`, required concepts, purposes, outcomes, dependency profiles, assembly readiness, and materialization-boundary checks before wrappers are created. |
| Course-wrapper generation | `course-wrapper-v1`, `course-wrapper-quality-report-v1`, `course-build-task-v1`, `active-course-generation-plan-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Verifies empty shell rows have source requests, wrapper quality profiles, build tasks, action/source-acquisition plans, active generation plans, and no fake generated content. |
| Catalog/course-fit linking | `course-fit-evidence-v1`, `program-course-scaffold-plan-v1` | `test_program_course_scaffold_fit.py`, `test_program_generation_eval_scenarios.py` | Passing | Verifies title-only matches, content-backed matches, exact-title false positives, and near-title false positives before auto-linking existing courses. |
| Program scaffold materialization | `program-course-scaffold-plan-v1`, `program-course-shell-readiness-report-v1` | `test_program_generation_e2e.py`, `test_program_shell_staged_generation.py` | Passing | Verifies program shell handoff creates openable `needs_sources` course shells without pretending the course content is complete. |

## Active Content Workflows

| Workflow level | Contract or report | Primary tests | Current status | Notes |
| --- | --- | --- | --- | --- |
| Course template generation | `course-template-v1`, `course-template-workflow-v1`, `course-template-quality-report-v1` | `test_course_generation_stage_workflows.py`, `test_course_template_generation_scenarios.py`, `test_clean_start_generation_staged_outline.py` | Passing | Validates title, scope, outcomes, source refs, coverage checklist, and the template-to-outline handoff. Golden scenario prompts supply expected topic keywords, so curriculum discovery still needs live evaluation. |
| Source-packet transition to outline | `source-packet-transition-report-v1`, `course-outline-from-source-packet-v1`, `course-module-outline-quality-report-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Verifies a wrapper task can advance from `source_gathering` to `outline_ready` and produce a source-packet-derived outline with source mapping and quality checks before section planning. |
| Outline transition to section generation | `outline-transition-report-v1`, `course-build-resume-report-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py`, `test_clean_start_generation_contracts.py` | Passing | Verifies wrapper resumes advance from `outline_ready` to `section_generation_ready`, preserve valid explicit or derived outlines, and keep weak outlines blocked with reasons. |
| Course coverage checklist | `course-coverage-checklist-v1`, `course-outline-from-coverage-checklist-v1`, `course-coverage-allocation-report-v1` | `test_course_coverage_checklists.py`, `test_source_gap_resume.py` | Passing | Verifies fallback or under-sourced courses start from a concrete required-topic inventory, assign every item to modules and planned sections, and preserve coverage handoff metadata for later rebuilds. |
| Course module outline generation | `course-module-outline-workflow-v1`, `course-module-outline-quality-report-v1` | `test_course_generation_stage_workflows.py`, `test_course_module_outline_generation_scenarios.py`, `test_clean_start_generation_staged_outline.py` | Passing | Validates source-packet quality, module titles, module objectives, module concepts, module source mapping, target section counts, duplicate titles, no section/content payload, course-template coverage assignment, and all 10 golden dataset scenarios. |
| Module section planning | `module-section-plan-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_module_section_plan_generation_scenarios.py` | Passing | Expands one module outline into section-plan records and planned course/module sections with titles, planning descriptions, objectives, concepts, candidate source IDs, coverage handoff IDs, hidden generation metadata, and empty `content` arrays; covers all 10 golden dataset scenarios plus target-count overrides, no learner-facing content payload, duplicate embedded lesson titles, and thin embedded lesson plans. |
| Section fill generation | `section-fill-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Replaces planned empty section shells with editor-native content blocks, preserves generation-outline metadata, records only explicitly used section/block source refs, and blocks unfilled shells from being treated as generated content. |
| Module assessment planning | `module-assessment-plan-workflow-v1` | `test_course_generation_stage_workflows.py` | Passing | Inspects filled lesson concepts and module requirements to route Apply sections to quiz/test or project-style evidence, including assessment kind, scale, coverage scope, 70% default minimum coverage, target section IDs, target concept IDs, target coverage item IDs, and inherited quiz/project specs. |
| Module quiz/test assessment generation | `module-quiz-assessment-workflow-v1` | `test_course_generation_stage_workflows.py` | Passing | Generates realistic quiz/test questions from taught concepts, blocks the old generic mastery-question template, requires at least 10 valid questions for module quizzes, enforces minimum target-content coverage, and omits source refs/source footers. |
| Module project assessment generation | `module-project-assessment-workflow-v1` | `test_course_generation_stage_workflows.py` | Passing | Generates project Apply sections for capstone/lab/design/project-style modules with instructions, required evidence, rubric criteria, canonical submission type, grader workflow metadata, and inherited minimum target-content coverage. |
| Module Apply generation | `module-apply-section-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Orchestrates assessment planning plus routed quiz/project generation after filled lessons exist, persists compact `metadata.assessmentPlan`, validates Apply section shape, omits source refs/source footers, and blocks empty assessment payloads. |
| Module summary generation | `module-summary-section-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Creates or validates module concept inventories from filled Learn sections, preserves source section links, copies only local source refs from summarized concepts, and blocks heading-only summaries. |
| Module assembly | `module-assembly-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Assembles filled lesson, Apply, and summary sections; validates that summary and apply/practice coverage exist without generating them inside assembly. |
| Active course generation batches | `active-course-generation-plan-v1`, `active-course-generation-run-v1` | `test_active_course_generation.py` | Passing | Verifies batch progression, source-packet ID preservation, courseBuildOutline-derived batches, completed-batch protection, unusable source-packet rejection, endpoint behavior, and course-build task next actions. |
| Full staged course generation | staged trace `stage_workflows` | `test_clean_start_generation_staged_outline.py`, `test_program_shell_staged_generation.py` | Passing | Real staged generator records outline, section-plan, section-fill, module assessment planning, module Apply, module-summary, and module-assembly reports. |

## Review And Promotion Workflows

| Workflow level | Contract or report | Primary tests | Current status | Notes |
| --- | --- | --- | --- | --- |
| Active review promotion | `review-transition-report-v1`, `quality_report` | `test_active_course_generation.py`, `test_program_generation_eval_scenarios.py`, `test_clean_start_generation_contracts.py` | Passing | Verifies completed active-batch courses can pass quality and promote to `ready_for_review`, while partial active batches stay blocked with traceable quality-report reasons. |

## Latest Verification

Run on 2026-08-26:

```bash
python3 -m py_compile \
  services/lycium-api/app/course_generation_stage_registry.py \
  services/lycium-api/app/course_generation_stage_workflows.py \
  services/lycium-api/app/course_generation_status.py

python3 -m pytest \
  services/lycium-api/tests/test_course_generation_stage_registry.py \
  services/lycium-api/tests/test_course_generation_status.py \
  services/lycium-api/tests/test_course_generation_stage_workflows.py \
  -q

python3 -m pytest services/lycium-api/tests -q

python3 -m ruff check \
  services/lycium-api/app/course_generation_stage_registry.py \
  services/lycium-api/app/course_generation_stage_workflows.py \
  services/lycium-api/app/course_generation_status.py \
  services/lycium-api/tests/test_course_generation_stage_registry.py \
  services/lycium-api/tests/test_course_generation_status.py

git diff --check
```

Result: `py_compile` passed, focused registry/workflow tests `42 passed`, broader API regression `311 passed`, ruff passed on touched files, and `git diff --check` passed.

## Curriculum Baseline

On 2026-11-13, the existing `run_course_template_workflow` received each prompt below at `level="undergrad"` with default settings and no supplied sources. This isolated stage used the deterministic `prompt_terms` path.

| Prompt | Required topic labels returned | Status |
| --- | --- | --- |
| Create a college general chemistry course. | General, Chemistry | `needs_review` |
| Create a college precalculus course. | Precalculus | `needs_review` |
| Create an introductory college Python programming course. | Python, Programming | `needs_review` |

All three returned empty prerequisite lists. Each result needs a subject-specific concept inventory and measurable outcomes before it can guide module planning.

### Live Planning Comparison, 2026-11-13

At commit `9132ae8`, each prompt above went through a direct model call and the production staged generator with the same model, 12 target modules, 60 hours, undergraduate level, and no supplied sources. Source Index was disabled for this diagnostic. The direct prompt used the same plan output shape with brief curriculum instructions. The staged run used Lycium's normal prompts and stopped at the first checkpoint after module outline validation.

Ollama Cloud rejected all Kimi K2.6 calls with HTTP 402. The six comparison calls completed using the installed `qwen2.5-coder:14b` model with JSON output and temperature 0.2. Both paths used the local runner's default 4,096-token context. Ollama logs recorded staged input truncation, shown below. Each model response ended normally and returned 12 modules.

| Subject | Direct input/output tokens and seconds | Staged input before/after truncation, output tokens, and seconds | Staged outline validation |
| --- | --- | --- | --- |
| Chemistry | 294 / 998, 103.67s | 4,853 / 2,050, 1,229, 142.54s | Failed, 22 reasons |
| Precalculus | 295 / 1,065, 102.32s | 4,538 / 2,050, 1,040, 120.04s | Failed, 23 reasons |
| Python | 295 / 957, 88.74s | 4,865 / 2,050, 1,270, 140.36s | Failed, 22 reasons |

The scores below use the 0-4 rubric for core coverage, sequencing, and scope/outcomes, in that order. The review covers plans only. The references were used for scoring after generation.

| Subject | Direct plan | Staged plan | Review reference |
| --- | --- | --- | --- |
| Chemistry | **2 / 2 / 1.** Covered measurement, atomic structure, bonding, stoichiometry, gases, and acids/bases. Omitted kinetics and equilibrium. Its stated workload was six hours. | **2 / 1 / 1.** Used two modules on generic foundations and omitted acid-base chemistry, kinetics, and equilibrium. Retained a generic outcome and empty prerequisites. | [MIT Principles of Chemical Science](https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/pages/syllabus/), [OpenStax Chemistry 2e](https://openstax.org/books/chemistry-2e/pages/preface) |
| Precalculus | **3 / 3 / 2.** Sequenced algebra, functions, trigonometry, and systems. Stated Algebra II and geometry prerequisites. Listed calculus in the plan despite excluding it in scope. | **0 / 0 / 1.** Repeated foundations, review, and exam preparation. The titles and objectives gave no specific function families or trigonometric skills. | [OpenStax Precalculus 2e](https://openstax.org/books/precalculus-2e/pages/preface) |
| Python | **2 / 3 / 1.** Sequenced control flow, functions, collections, files, and exceptions into a project. Needed explicit testing and debugging practice and a realistic workload. | **1 / 1 / 1.** Repeated variables, control flow, and functions across Python and programming modules. Introduced web frameworks, data science, and ML before establishing a strong beginner core. | [MIT Intro to CS and Programming using Python](https://ocw.mit.edu/courses/6-100l-introduction-to-cs-and-programming-using-python-fall-2022/pages/calendar/) |

The initial template supplied the same one or two generic coverage labels seen in the isolated baseline. Those labels and the fixed lesson patterns reappeared in the staged outputs. The outline prompt also asked for a scalar `objective` and omitted concept keywords from its example, while the validator requires objective and concept lists. The resulting failures appear in all three staged traces. The experiment establishes template, prompt, and validation problems with this configuration. It leaves the individual effect of prompt truncation and the quality of source-backed courses open for follow-up.

Raw prompts, responses, checkpoints, and the diagnostic script are saved locally in the ignored `services/.data/course-planning-eval/2026-11-13/` directory. The next run should compare a model-backed template with the current baseline and use a shared prompt and validator schema plus an explicit context budget.

### Kimi K2.6 Rerun, 2026-11-13

After Ollama Cloud access was restored, all six calls completed with `kimi-k2.6:cloud`. The prompts, course constraints, output shape, and checkpoint were the same as in the Qwen comparison. Each response ended normally and returned 12 modules. The provider reported 4,519-4,845 input tokens on the staged calls, and the local Ollama log showed no prompt truncation for those calls.

| Subject | Direct input/output tokens and seconds | Staged input/output tokens and seconds | Staged outline validation |
| --- | --- | --- | --- |
| Chemistry | 294 / 4,686, 20.00s | 4,832 / 7,154, 32.83s | Failed, 22 reasons |
| Precalculus | 295 / 5,850, 40.05s | 4,519 / 10,020, 44.19s | Failed, 23 reasons |
| Python | 295 / 3,609, 17.57s | 4,845 / 3,658, 19.17s | Failed, 22 reasons |

| Subject | Direct plan | Staged plan |
| --- | --- | --- |
| Chemistry | **3 / 3 / 3.** Sequenced measurement and stoichiometry through bonding, kinetics, and equilibrium. Stated prerequisites and retained the requested 60 hours. | **3 / 3 / 1.** Covered stoichiometry, thermochemistry, bonding, kinetics, and acid-base equilibrium. The course-level scope retained a generic outcome and empty prerequisites. |
| Precalculus | **3 / 3 / 3.** Specified measurable work with function transformations, logarithms, identities, and equations. Stated prerequisites and bounded its calculus preview. | **3 / 3 / 2.** Sequenced functions and trigonometry coherently and added an Algebra II prerequisite to the model plan. The persisted template still held generic outcomes and an empty prerequisite list. |
| Python | **3 / 3 / 3.** Sequenced fundamentals, data structures, error handling, and algorithms into a tested command-line capstone. Specified a beginner scope. | **3 / 2 / 1.** Included control flow, functions, collections, testing, and a capstone. Added a data science module and repeated template wording in otherwise specific objectives. |

Kimi recovered substantive module plans even with the weak template. The template still reported `needs_review` for all three subjects, and each module plan used the scalar objectives requested by the prompt. The validator continued to require objective lists and concept lists. These runs establish stronger planning in this configuration. The comparison with Qwen also changes the effective prompt length, so it cannot isolate model capability from context size. Lesson generation, source grounding, and learner outcomes remain outside this planning diagnostic.

The same local directory holds the rerun artifacts as `*-kimi-k2.6-cloud.json`.

### Model-Backed Template Trial, 2026-11-13

The staged generator now calls the selected model for curriculum planning, then sends the validated topic IDs, scope, and workload to the module planner. The response schema comes from the same model used to validate the outline. Each topic must be allocated once, and its lesson objectives are preserved in the section planning handoff.

The same three short prompts and 60-hour scope were run with Kimi K2.6 on the new code. These runs stopped before lesson fill and supplied no source documents.

| Subject | Template and module validation | Required topics / planned lessons | Curriculum review |
| --- | --- | --- | --- |
| Chemistry | Passed after one outline retry | 12 / 48 | Concrete prerequisites, measurement, stoichiometry, bonding, and solution chemistry. Reaction kinetics and chemical equilibrium were absent from the required topics. The earlier Kimi plan included them. |
| Precalculus | Passed after one outline retry | 12 / 48 | Preserved prerequisites and specific objectives for functions, logarithms, and trigonometry. Some late modules combined several substantial topics. |
| Python | Passed after one outline retry | 12 / 36 | Preserved beginner scope, added explicit testing and debugging, and excluded web frameworks and data science pipelines. |

The template inputs used 747-748 reported tokens. Initial outline inputs used 2,446-2,665 tokens, compared with 4,519-4,845 in the prior Kimi trial. All three initial outlines exceeded the concept keyword limit and passed the bounded correction call. The next prompt revision explicitly asks for 3-8 concept keywords per module.

The structured handoff passed for these runs. Chemistry still needs a benchmarked curriculum check before module planning. Teaching depth and assessment quality require reviewing filled lessons and Apply sections. The source-gap draft path that stops before calling the provider still uses its deterministic planner.

Raw artifacts are stored as `*-kimi-model-curriculum.json` in the same local evaluation directory.

### Manual Curriculum Trial: Concept Inventory, 2026-11-15

The first isolated call used `kimi-k2.6:cloud` at temperature 0.2. No source documents, example syllabus, or topic hints were supplied. The model completed the call in 89 seconds. No downstream stages were run.

> A learner asks: "Create a college general chemistry course." The target is undergraduate self-study with 60 hours total. Identify the specific concepts and skills the course needs to cover. First state what course scope you infer from the request. Then list the required concepts and skills, grouped by topic for readability. Use concrete names a reviewer could check. Separately name any major topics normally taught in the broader subject that you would defer, and say why. Work from your own knowledge. This step is the coverage inventory only.

Kimi chose a **compressed one-term survey**, not a conventional General Chemistry I course. Its 11 groups included rate laws, half-life, activation energy, equilibrium constants, reaction quotients, ICE tables, buffers, titrations, and electrochemical cells. Kinetics and equilibrium were both absent from the earlier structured template despite its passing validation.

**Review: promising draft, not yet an accepted handoff.** The scope is plausible as a survey, but 60 hours is tight if all the listed skills are treated as required. For comparison, the [Jacksonville State catalog](https://catalog.jsu.edu/undergraduate/courses/cy/) spreads much of this material across General Chemistry I and II, and [MIT's introductory chemistry syllabus](https://ocw.mit.edu/courses/5-111sc-principles-of-chemical-science-fall-2014/pages/syllabus/) estimates about 150 hours for its course. The response says the solubility product (Ksp) is included, but does not list it in the inventory. Chemical nomenclature and interpretation of measurement uncertainty are also not explicit. The next isolated call should reconcile those omissions and rank core skills versus optional depth for the stated scope and time limit. Only then should the inventory feed an outcomes prompt.

The standalone call shows the model can name the topics without hints. It does not isolate whether the earlier omissions came from the template prompt, the schema, or variation between calls. The clean prompt and answer are in the local evaluation artifact `services/.data/course-planning-eval/2026-11-15/chemistry-step-1.md`.

### Subject-Neutral Coverage Prompt Trial, 2026-11-15

Test only the scope and required-coverage step before wiring it into the template workflow. This prompt does not depend on a subject-specific topic list or on a module count.

```text
Plan the scope and coverage of one college course from the request and any supplied curriculum requirements. This is a coverage inventory for a later planner.

1. Resolve the scope. Identify the course's role and level, its intended learner and entry prerequisites, and the main capability it should develop. For a broad or ambiguous title, choose a coherent interpretation and state it. Distinguish an introduction, one part of a sequence, and a full survey when that distinction affects what belongs.
2. Resolve the workload. Preserve explicitly supplied credits, credit system, and study time. Estimate whatever is missing: use a named academic convention to propose credits when appropriate, and estimate total learner hours including instruction, independent study, practice, and assessment. Label estimates and assumptions. Credits describe intended academic scale, not awarded credit. If explicit constraints conflict, report the conflict and the scope you can responsibly recommend. Do not silently change a requirement or treat a generic app default as a user constraint.
3. Inventory the essential concepts, methods, and skills for that scope. Use any supplied benchmark requirements and say when the plan is based on disciplinary knowledge instead. Group related items in prerequisite order, independently of any module count. Name specific concepts and the tasks learners should be able to perform; mark what only needs recognition or explanation. Include the discipline's practical or analytical methods where essential. Separate prerequisites from material that must be taught.
4. Check coverage against what a comparable course would normally teach. List significant optional or deferred material and why. Check that every concept you say is required appears in the inventory and that learners have time to practice the required skills. If the scope is too large, narrow it explicitly or flag a conflict with the requirements. Do not replace specific concepts with vague headings.

Return four labeled parts: Scope and Prerequisites; Workload and Assumptions; Required Coverage; Optional or Deferred Coverage and Open Issues. Do not generate modules, lesson titles, course content, or assessments. Do not invent benchmarks or claim institutional equivalence.
```

**Trial input:** `{"prompt":"Create a college general chemistry course.","audience":"undergraduate self-study"}`. Model: `kimi-k2.6:cloud` at temperature 0.2. Credits, hours, sources, and benchmarks were omitted. Both the prompt and the workload input changed from the earlier chemistry trial, so this does not isolate the effect of workload.

**Result:** Kimi inferred a first-semester, lecture-only course, estimated four U.S. semester credits and 180 total hours, and gave ten groups of specific concepts and skills with expected depth. It added nomenclature and moved kinetics and equilibrium explicitly to the second term. The response is useful as a first draft. The hours are internally consistent with its chosen [U.S. planning convention](https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-600/subpart-A/section-600.2), but four credits is not a universal lecture standard: [Jacksonville State](https://catalog.jsu.edu/undergraduate/courses/cy/) lists three for lecture plus a separate one-credit lab. It also incorrectly treats equilibrium as a prerequisite for introductory kinetics. [OpenStax covers rates, rate laws, and catalysis in its kinetics chapter](https://openstax.org/books/chemistry-2e/pages/12-introduction), before the equilibrium chapter. The clean prompt and answer are in the local artifact `services/.data/course-planning-eval/2026-11-15/chemistry-generic-coverage-no-workload.md`.

**Next check:** Run this unchanged prompt on a different discipline with a supplied workload. Check whether the model preserves that workload, identifies discipline-specific skills, and grounds exclusions without inventing dependencies. Do not advance to module planning on this result alone.

**Integration note:** The app currently sends a fixed 2,700 minutes, the full-course API defaults to 180 if omitted and caps input at 4,000, and the request has no credit field. Before using this prompt in-app, distinguish an omitted workload from a user constraint. Keep the credit basis and total learner time separate and carry both forward with their provenance. Do not make a template's workload depend on an arbitrary module count.

### Same Prompt, Different Discipline: English Composition I, 2026-11-15

**Trial input:** `{"prompt":"Create a college English Composition I course.","audience":"undergraduate self-study","credits":3,"credit_system":"U.S. semester credits"}`. Same system prompt, model, and temperature as above. No supplied hours, syllabus, sources, or topic hints. The model completed the call in 21 seconds.

**Result:** Kimi preserved the three requested U.S. semester credits and estimated 135 learner hours, including 70 for writing, revision, and editing. Its six coverage groups included rhetorical choices for audience and purpose, critical reading of nonfiction, thesis and evidence, global versus local revision, source credibility and attribution, and sentence clarity. It retained introductory source-based writing and deferred extended research. That is a plausible first-year scope alongside [ASU's online ENG 101](https://courses.ulc.asu.edu/english-composition-eng-101/) and [BMCC's ENG 101](https://bmcc.catalog.cuny.edu/courses/0883611). Both catalogs were used only to review the answer.

**Review:** Pass for an initial scope and coverage draft. Retain draft feedback as an explicit practical requirement for the handoff: the response flags a need for a feedback mechanism but leaves it unspecified. Make reflection on why revisions improve the writing explicit if it is required, rather than treating it as an optional end-of-course activity. The next workflow should preserve repeat writing and revision cycles rather than translating all six groups into isolated lecture modules. This trial does not test the production template or downstream planning. The full prompt and response are in `services/.data/course-planning-eval/2026-11-15/english-composition-i-coverage.md`.

### Same Prompt, Third Discipline: College Trigonometry, 2026-11-15

**Trial input:** `{"prompt":"Create a college trigonometry course.","audience":"undergraduate self-study"}`. Same system prompt, model, and temperature as above. No supplied credits, hours, syllabus, sources, or topic hints. The model completed the call in 38 seconds.

**Result:** Kimi chose a standalone lower-division plane trigonometry course, assumed intermediate algebra, and estimated three U.S. semester credits and 135 total hours. Nine coverage groups included radians and circular measurement, exact unit-circle values, transformed graphs, identity proofs, principal inverse values, complete equation solutions, oblique triangles including the ambiguous SSA case, and introductory polar and complex-number work. It included applied practice in sinusoidal modeling, surveying, and navigation.

**Review:** Pass for an initial scope and coverage draft. The core aligns with [Community College of Rhode Island's MATH 2110](https://www.ccri.edu/math/learning_outcomes/pdfs/MATH2110.pdf) and [Butte College's MATH 20](https://www.butte.edu/student-resources/academic-resources/curriculum-tools/course-outlines/2026-2027/html/MATH-20-course-outline.html), consulted only after submission. Both include vectors, whereas Kimi made vectors optional and required powers and roots of complex numbers. This is a scope choice, not a mathematical error, but vector components and addition deserve consideration when the stated purpose includes physics and engineering preparation. A required institutional syllabus would settle that choice. The clean prompt and answer are in `services/.data/course-planning-eval/2026-11-15/college-trigonometry-coverage.md`. No downstream stages were run.

### Same Prompt, Fourth Discipline: Introduction to Business, 2026-11-15

**Trial input:** `{"prompt":"Create a college Introduction to Business course.","audience":"undergraduate self-study"}`. Same system prompt, model, and temperature as above. No supplied credits, hours, syllabus, sources, or topic hints. The model completed the call in 35 seconds.

**Result:** Kimi chose a lower-division survey with no prior business coursework, assumed a U.S. regulatory context, and estimated three semester credits and 135 total hours. It covered the economy and ownership, ethics and law, management and HR, marketing, accounting, finance, operations and supply chain, information systems, and strategy. Applied work included setting a marketing mix, calculating ratios and break-even, and using a decision framework in a case. The breadth aligns with [Penn State's BA 100](https://courses.worldcampus.psu.edu/welcome/ba100/001/common/syllabus.html) and [Schoolcraft's BUS 101](https://home.schoolcraft.edu/academics/widgets/course-description/BUS/101), consulted only after submission.

**Review:** Pass for an initial scope and coverage draft, with a correction before handoff. The outline groups franchising with legal forms of ownership. Separate the [franchise business model](https://www.ftc.gov/business-guidance/resources/consumers-guide-buying-franchise) from the [legal structure](https://www.sba.gov/counseling/launch-your-business/). Preserve at least one applied decision that ties together functions, such as tracing how a pricing choice changes demand, inventory, and cash needs. The clean prompt and answer are in `services/.data/course-planning-eval/2026-11-15/introduction-to-business-coverage.md`. No downstream stages were run.

### Coverage Prompt Repeatability, 2026-11-15

Repeated each of the four requests twice in fresh Kimi K2.6 conversations, preserving the exact system message, request, and temperature (0.2). No hints, sources, or benchmarks went into the prompt. Compared the eight repeats with the four original answers using the same institutional outlines linked above. The earlier 60-hour chemistry experiment used a different prompt and is not counted.

**Acceptance criteria:** All four parts, a defensible single-course scope, explicit versus inferred workload correctly distinguished, and the main competencies expressed as concrete concepts and skills. Legitimate differences in electives and depth do not fail a draft. Separately note scope changes, omissions, and incorrect claims that would matter to the next stage.

| Course | Workload in runs 1 / 2 / 3 | Repeatability and review |
| --- | --- | --- |
| General Chemistry | 4 credits / 180 h; 6 / 270 h; 4 / 180 h | Core stoichiometry, bonding, gases, and thermochemistry persisted. Run 2 chose the full two-semester sequence and offered 8 credits / 360 h as a deeper alternative. Runs 1 and 3 chose only General Chemistry I. Nomenclature was explicit in run 1 but not consistently retained. |
| English Composition I | 3 supplied credits / 135 h in all three | Stable first-year writing scope: rhetorical analysis, thesis-driven writing, revision, and source use. Introductory citation held. Source-finding and draft feedback varied in how explicitly they were required. |
| College Trigonometry | 3 inferred credits / 135 h in all three | Stable unit circle, graphs, inverses, identities, equations, and triangle solving. Two required polar/complex work and one deferred it; all left vectors optional. Run 2 also described all six functions as coordinates; only cosine and sine give the two unit-circle coordinates. |
| Introduction to Business | 3 inferred credits / 135 h in all three | Stable functional survey and applied work in marketing, financial interpretation, and decision-making. Required depth varied: break-even appeared only in run 1; coverage of international trade was thinner in run 3. Run 2 properly separated franchising from legal entity structure, unlike run 1. |

**Decision:** All 12 runs returned a complete, concrete, reviewable inventory with the requested four parts. Eleven fit one course without a scope correction; the two-semester chemistry plan is useful as an alternative, not a direct handoff for that one-course request. The three English runs all preserved the supplied credits. The prompt is ready for the next manual experiment as a draft generator, not for unattended handoff. Tighten the ambiguous-title rule and retest without adding subject-specific requirements. Persist the resolved scope and workload when moving to outcomes so downstream stages do not reinterpret the request.

Suggested rule to test: "When a title could mean either one course or a multi-course sequence, plan one coherent course unless the request or a provided benchmark calls for the sequence. State which portion you chose and name material that belongs in a follow-on course."

This sample does not establish performance with hard study-hour limits, benchmark-led inputs, other models, or the production schema and downstream workflows. Original and repeat transcripts are in the local evaluation directory listed above, with the readable repeat pairs in `*-repeatability.md`.

### Coverage Prompt With Program Context, 2026-11-15

Reused the exact system prompt, Kimi K2.6 at temperature 0.2, and the original request to create a college general chemistry course for undergraduate self-study. The only addition was the course's role between two existing neighbors, with summaries of what each neighbor teaches. Used [Jacksonville State's actual CY 105 and CY 231 catalog entries](https://catalog.jsu.edu/undergraduate/courses/cy/) to model the prerequisite and follow-on. The target title, its own curriculum, credits, and learner hours were not supplied. This was a standalone model call, not a test of app-side retrieval or integration.

**Result:** Kimi inferred General Chemistry II, lecture-only, and estimated three semester credits and 135 hours. It treated stoichiometry, atomic structure, and bonding as prior knowledge, and deferred organic nomenclature, isomerism, synthesis, and mechanisms. Its inventory included the main areas named in the held-out CY 106 catalog entry: states of matter and solutions, kinetics, equilibrium, acid-base, thermodynamics, and electrochemistry. It gave concrete tasks such as finding a rate law from data, calculating solubility, designing a buffer, and finding cell potential. By comparison, the three standalone calls chose either General Chemistry I or the entire sequence.

**Review:** Pass for course positioning and a draft inventory. The model assumed basic thermochemistry and Hess's law under CY 105 even though the supplied summary did not confirm them. It mentioned the uncertainty later, but the prerequisite listing should distinguish verified from unverified coverage before downstream planning. Likewise, nuclear chemistry was made required despite not being named in the target catalog entry; consider it enrichment unless the program requires it. When actual approved learning outcomes or module coverage are available, pass that concise evidence along with the neighbor titles and course role. No modules, lessons, or production workflow changes were made. The complete prompt and answer are in `services/.data/course-planning-eval/2026-11-15/chemistry-program-context-coverage.md`.

### Integrated Coverage-First Planning, 2026-11-15

The staged generator now resolves a course interpretation, workload, prerequisites, required coverage, expected depth, and topic outcomes before module planning. The web create request no longer supplies a fixed duration. The API preserves requested credits and minutes, accepts optional curriculum context, and labels estimates in the persisted course scope. The template does not contain lesson hints. A separate planning pass allocates the module's required concepts into section outlines before section fill. Legacy saved outlines and the source-gap fallback retain their existing paths.

Ran the requested general chemistry program-slot case through the actual staged planner and Ollama JSON adapter with Kimi K2.6. The call supplied the two neighboring courses, no target syllabus, hours, or credits, and stopped before lesson fill. The template inferred a 135-hour, three-credit General Chemistry II course, explicitly marked prior Hess's law coverage as an assumption, and produced seven required topic groups. Module and section planning validated seven modules, 28 section outlines, and the assignment of all 47 required terms.

This verifies the production planning handoff, not full syllabus completeness or teaching quality. For example, the manual response named the solubility product explicitly, while this template listed solubility rules and heterogeneous equilibria without naming it. Allocation checks cannot find concepts that never entered the inventory.

### Prompt-Only Course Through the API Queue, 2026-11-16

Submitted "Create a short college algebra course on solving two-variable systems of linear equations." through the normal background generation endpoint, with one module and a 90-minute workload. Used Kimi K2.6 through the actual Ollama adapter and isolated the test database. No sources, benchmark, or neighboring curriculum were supplied, and Source Index was disabled.

The run saved an openable `needs_sources` snapshot with five filled lessons, a 12-question quiz, a summary, and no source records. It taught classification, graphing, substitution, elimination, and modeling. Worked examples included solving `2x + 3y = 12` and `x - y = 1` by substitution to get `(3, 2)`, checking both equations, and showing how `0 = 2` and `0 = 0` lead to different outcomes in elimination. The draft contained instructional prose and practice, not source-gap placeholders.

The quality report did not pass. Its outline coverage check scored 0.71 and flagged, among other things, parallel and coincident lines and elimination's contradiction/identity cases, all explicitly taught in the lesson text and examples. This is evidence of false negatives in the wording-based coverage check. The quiz also had a real wording issue: one distractor in the gym-membership intersection question could be read as saying both memberships cost the same. Keep source verification and teaching quality separate; this smoke test does not establish correctness for a full term or a different discipline.

### Isolated Learning Outcome Review, 2026-11-16

Ran the current staged course-template prompt and Ollama JSON adapter with Kimi K2.6 on English Composition I (three supplied semester credits) and College Trigonometry (no supplied workload). No sources, benchmarks, or neighboring curriculum were supplied. Stopped before module planning. Reviewed whether each outcome describes observable performance, matches the depth and concepts in its linked item, and stays within scope.

- **Composition:** Seven observable outcomes, seven valid coverage links, and validation on the first response. Strong examples included responding to at least one counterargument and correctly integrating at least two external sources. Peer review is listed in the coverage, but no outcome explicitly requires responding to feedback when revising. That skill would not reliably be assessed from the outcome alone.
- **Trigonometry:** Thirteen observable outcomes and thirteen valid coverage links. The model passed after a bounded retry for a scope description exceeding 500 characters. Solving oblique triangles including the ambiguous case is a concrete outcome. "Evaluate exact trigonometric function values for any angle" overstates the intended skill: exact evaluation for special angles and approximate evaluation for other numerical angles should be distinct. The polar/complex item names De Moivre's theorem, but its outcome stops at representing complex numbers in polar form.

**Decision:** Keep outcomes in the course template. The current prompt produces usable first drafts across both subjects, but the link to a topic does not ensure that every required skill has a measurable outcome at the right depth. Test a focused alignment instruction: state the observable performance and conditions, check that essential skills are represented, and do not promise more than the linked coverage supports. Use more than one outcome for a topic only when it has genuinely distinct required performances. Production code was unchanged in this trial. Outputs are in `services/.data/course-planning-eval/2026-11-16/learning-outcomes-template-trial.md`.

### Outcome Alignment Prompt Retest, 2026-11-16

Added instructions to compare every topic outcome with its required skills and depth, state the conditions or evidence of mastery, and check strong universal or exact claims before returning. The template schema and workflow stages did not change.

The first retest used identical requests to the baseline. Composition now required providing structured peer feedback, though using feedback to revise was still not explicit. Trigonometry required using De Moivre's theorem to compute powers and roots but still claimed exact evaluation for any angle. A second trigonometry retest with the added applicability check limited exact evaluation to multiples of pi/6 or pi/4 and retained computing powers as a required performance. It did not explicitly say to identify undefined values at some angles, so the bounded wording improved without eliminating the need for review. All three templates passed structural validation on the first response of their respective runs.

The live calls stopped before module planning and did not supply sources or course-specific hints. The focused workflow suite passed 47 tests. Full outputs are in `services/.data/course-planning-eval/2026-11-16/learning-outcomes-alignment-retest.md`.

### Isolated Module Planning Review, 2026-11-16

Ran the current Kimi K2.6 module prompt through the staged generator, resuming from three unchanged templates made in the outcome trials. Held the module cap at 12, disabled Source Index, and stopped before section planning. No template was regenerated or patched for these runs. Compared module order and objectives against the scope, expected depth, and required outcomes in each handoff.

| Saved handoff | Modules / required topics | Review |
| --- | --- | --- |
| English Composition I, revised | 7 / 7 | Coherent order from audience and critical reading to thesis, evidence, argument, and revision. Concrete objectives included MLA in-text citations and Works Cited entries, responding to a counterargument, and giving structured feedback. Revision had its own module, but the plan did not explicitly carry the same draft through multiple modules. The workflow incorrectly warned that seven was below the requested count, although the planner treats 12 as a cap. |
| College Trigonometry, baseline | 12 / 13 | Coherent progression from foundations to functions, identities, equations, and applications. It combined triangle-solving and area in one module and narrowed exact unit-circle evaluation to special angles in the objectives, even though the original overbroad wording remained in the stored handoff. |
| College Trigonometry, revised | 12 / 12 | Preserved the ambiguous SSA case, expected exact/approximate precision for inverse trig, and a concrete De Moivre powers outcome. Added plane vectors only in the run whose handoff required them, including resultant force or velocity problems. One objective expanded applying sum/difference formulas into deriving them, which is a deeper task than the linked outcome specified. |

All three model calls passed the module schema and allocation validation on the first response. All 32 required items were assigned exactly once and their stored outcomes, depth, and terms were preserved verbatim. No plan contained sections. In 30 of 31 modules, one topic became one module; that can be appropriate, but these results give limited evidence that the prompt chooses groups intentionally. The template workload was preserved, but the module output does not estimate time per module, so workload fit cannot be checked here.

**Decision:** Promising for sequencing and preserving coverage. Before refining the prompts further, align the count warning with the existing cap and test a lower cap on the same handoff to see whether grouped modules remain coherent without losing depth. Consider a lightweight way to review proportional time and cumulative practice. This was a module-only review with no production edits. The frozen inputs and full outputs are in `services/.data/course-planning-eval/2026-11-16/module-planning-template-trial.json`.

### Module Grouping Under a Six-Module Cap, 2026-11-16

Fixed the staged module report to treat the specified count as a maximum for model plans. A plan below its cap no longer produces the below-requested-count warning. Exceeding the cap remains invalid; callers that plan toward a target retain their existing warning.

Reran only module planning on the exact revised trig template from the preceding trial, with Kimi K2.6 and Source Index disabled. The only change to the model input was the cap from 12 to six. The first response produced six modules, two topics per module, and the workflow reported `passed`. All 12 topic IDs appeared exactly once and all linked coverage, outcomes, and depth were preserved. No section planning or writing was run.

- The first pairings were coherent: angle measure with right triangles, the unit circle with sinusoidal graphs, and fundamental identities with equation solving. The order still progressed from foundations to applications.
- The later pairings made more of a tradeoff. Advanced angle formulas and oblique triangle solving sat in the same module, with little explicit connection between them. The final module combined polar graphing, complex powers, and vector applications. Required performances still survived, including the ambiguous SSA case, De Moivre powers, and vector force/velocity problems.

**Decision:** The module prompt can consolidate related work under a tighter cap in this case. That does not establish that six is preferable to 12: the output still cannot show how much teaching and practice time each group receives. Use this denser outline to test whether section planning preserves both topics in each module. The full run is in `services/.data/course-planning-eval/2026-11-16/module-planning-trig-six-cap.json`.

### Section Planning From the Six-Module Outline, 2026-11-17

Resumed the exact saved six-module trig plan and its original template through the actual staged generator. Kimi K2.6 received the current section-planning prompt, all six module handoffs, and the 135-hour scope. No upstream regeneration, subject-specific hints, sources, or Source Index were used. Stopped at the section-fill boundary without generating content.

The first model response passed. It produced **23 section outlines** (4, 3, 4, 4, 4, 4 by module) with all **67 required topic-term assignments** present. The upstream template and assigned module coverage remained unchanged. The six module section workflows also passed: all 23 IDs were unique, every shell had empty content and planning metadata with an objective and concept list, and no sources were invented. Provider timing was about 127 seconds, with 2,682 input tokens and 14,080 reported output tokens.

**Teaching-plan review:** The denser final module became four coherent sections: polar conversions and graphs, complex powers, vector operations, and dot products with force/velocity applications. Formula work and oblique-triangle work were also separated in Module 5. Some concerns remain:

- The parent inverse-trig outcome requires approximate evaluation with technology as well as exact special values. The section objectives only preserve exact evaluation and compositions. The exact term-allocation check cannot detect this outcome-level loss.
- The SSA case is assigned, but its section objective says to identify it without explicitly retaining the parent's requirement to determine the number of valid triangles.
- Unit-circle coordinates recur in Modules 1 and 2. The later section adds real material, but the planner does not identify the overlap as recall versus new instruction.

**Decision:** Adequate structure for a first draft. Before relying on this prompt, test an instruction to preserve every measurable action and relevant condition from the parent outcomes, not just the must-teach labels. Lesson depth and practice time remain untested because no content was filled and no section times were estimated. The focused workflow suite passed 48 tests. No production code was changed in this trial.

Full request messages, model output, and frozen-plan references are in `services/.data/course-planning-eval/2026-11-17/trig-six-modules-section-planning.json`; the adjacent Markdown report lists every section title and objective.

### Section Outcome Preservation Retest, 2026-11-17

Added a subject-neutral instruction to preserve measurable actions, conditions, and precision from both the parent module objectives and topic outcomes. Reused the exact saved six-module trig outline, its 135-hour template, Kimi K2.6, and the runtime adapter. No sources, subject hints, upstream regeneration, or content fill were used.

| Run | Sections | Model attempts | Required assignments |
| --- | --- | --- | --- |
| Original section prompt | 23 | 1 | 67 / 67 |
| Preserve parent actions and conditions | 12 | 1 | 67 / 67 |
| Also split for focused learning | 17 | 2 | 67 / 67 |

The first retest restored approximate inverse evaluation with technology and counting possible SSA triangles, but compressed the material into one section per topic. Added a general lesson-boundary instruction to split prerequisite ideas, procedures, and applications when they need separate explanation and practice. The final plan kept the restored skills and separated polar work, complex powers, and vector applications. Right-triangle precision and graph intercepts also appeared explicitly in objectives.

The final run needed its normal bounded retry: the first response replaced a curly apostrophe with a straight apostrophe in a must-teach term. Exact-copy validation was unchanged. Every final shell had empty content and the original concept assignments. Some outlines remain broad, especially triangle laws with area and the applied vector section; teaching and practice depth still require a filled lesson review. All 339 API tests passed, including the new parent-outcome input regression check. Full outputs and both model attempts are in `services/.data/course-planning-eval/2026-11-17/section-outcome-alignment-retest.json`, with a readable final outline in `services/.data/course-planning-eval/2026-11-17/section-outcome-alignment-retest.md`.

### Catalog-Driven Format Selection, 2026-11-18

Added a shared `packages/contracts/course-content-formats.json` catalog containing renderer-backed types, teaching use cases, avoidance cases, field/asset constraints, examples, and workflow eligibility. Section fill, quiz, summary, and media prompts load the appropriate entries at runtime. The shared behavioral contract no longer duplicates the catalog's examples, and section fill no longer hardcodes a text/practice/card sequence. Quizzes and projects remain outside lesson writing.

Sent the saved inverse-trig section handoff from the six-module trial through the actual section-fill prompt and Ollama adapter with Kimi K2.6, no source IDs, and no extra topic hints. It produced 17 blocks using only advertised formats: headings, text, equations, worked examples, and concept cards. No media placeholders or source IDs were invented. Structural section-fill validation passed on the first call (about 51 seconds, 5,253 input tokens and 6,544 reported output tokens).

**Quality limit:** The lesson explained principal ranges and correctly worked exact special values, but it did not teach the required approximate evaluation with technology. That remains a content-fill outcome-coverage issue; the passing structural report is not a teaching-quality pass. The full prompt, source handoff, and output are in `services/.data/course-planning-eval/2026-11-18/format-catalog-section-fill.json`.

Tests verify live catalog updates without prompt edits, duplicate/example validation, workflow filtering, and renderer support for every catalog type. All 351 API tests, 67 web tests, 23 shared contract tests, and the web build passed. See [the catalog guide](course-content-formats.md) for the update procedure.

## Live Teaching Quality

Use the [teaching quality rubric](course-generation-quality-acceptance.md) to record live runs. Each result should link the prompt, provider/model, source versions, stage artifacts, and findings.

| Stage | Live check | Status |
| --- | --- | --- |
| Course template | Review missing required concepts against a syllabus, then run the adequate-source condition. | Live handoff verified. Curriculum review open. |
| Module and section planning | Trace course outcomes into sequenced modules and empty lesson shells. Test that late-book requirements survive compaction and that the selected source passages support them. | Planned |
| Section fill and Apply | Inspect one representative module per subject. Check whether lessons teach their outcomes, learners can practice them, and assessments use correct answers and cover the intended material. | Planned |
| Full course | Review the complete curriculum, lessons, and assessments from ordinary prompts with sufficient evidence. Record teaching rubric results and pilot observations. | Planned |
| Program, cluster, and course wrapper | Inspect benchmarked outcomes, course scope, dependencies, and source needs for each planning handoff. | Planned |
| Complete program | Evaluate prerequisite continuity, materialized course quality, and cumulative assessment against program outcomes. | Planned |

Hold the model, request, and supplied evidence constant for each comparison. Record the planning context each path actually receives and locate the first loss in coverage or depth.
