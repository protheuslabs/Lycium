# Course Generation Workflow Test Matrix

Last updated: 2026-07-16

This document tracks the workflow-level tests for Lycium generation. Update it whenever a workflow stage is added, split, or promoted from smoke coverage to stronger integration coverage.

## Status Legend

- `Passing`: covered by focused tests and verified in the latest run.
- `Basic`: covered by smoke tests, but needs deeper product-shape assertions.
- `Next`: the next workflow layer to strengthen.
- `Planned`: not yet covered as an independent workflow test.

## Generation Mode Boundaries

- Passive generation plans, organizes, links, or proposes curriculum. It emits program contracts, clusters, course wrappers, source requests, fit evidence, and review candidates. It should not create learner-facing lessons or silently attach parent structures when threshold or review gates are missing.
- Active generation materializes source-backed course content. It advances source packets into outlines, module plans, section plans, section content, module assembly, active batches, quality reports, and review promotion.
- Passive workflows hand off to active workflows through explicit artifacts: course wrappers, source requests, source packets, course build tasks, `metadata.activeGenerationPlan`, and `metadata.courseBuildOutline`.

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
| Source-packet transition to outline | `source-packet-transition-report-v1`, `course-outline-from-source-packet-v1`, `course-module-outline-quality-report-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Verifies a wrapper task can advance from `source_gathering` to `outline_ready` and produce a source-packet-derived outline with source mapping and quality checks before section planning. |
| Outline transition to section generation | `outline-transition-report-v1`, `course-build-resume-report-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py`, `test_clean_start_generation_contracts.py` | Passing | Verifies wrapper resumes advance from `outline_ready` to `section_generation_ready`, preserve valid explicit or derived outlines, and keep weak outlines blocked with reasons. |
| Course module outline generation | `course-module-outline-workflow-v1`, `course-module-outline-quality-report-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Validates source-packet quality, module titles, module objectives, module concepts, module source mapping, target section counts, duplicate titles, and no learner-facing content payload. |
| Module section planning | `module-section-plan-workflow-v1` | `test_course_generation_stage_workflows.py` | Passing | Expands one module outline into section-plan records and planned course/module sections with titles, planning descriptions, objectives, concepts, source IDs, and empty `content` arrays; covers target-count overrides, no learner-facing content payload, duplicate embedded lesson titles, and thin embedded lesson plans. |
| Section fill generation | `section-fill-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Replaces planned empty section shells with editor-native content blocks, preserves generation-outline metadata, records only explicitly used section/block source refs, and blocks unfilled shells from being treated as generated content. |
| Module Apply generation | `module-apply-section-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Creates or validates Apply sections after filled lessons exist, assesses taught concept cards, requires quiz/project assessment shape, requires quiz-based module assessments to have at least 10 valid questions, omits source refs/source footers, and blocks empty assessment payloads. |
| Module summary generation | `module-summary-section-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Creates or validates module concept inventories from filled Learn sections, preserves source section links, copies only local source refs from summarized concepts, and blocks heading-only summaries. |
| Module assembly | `module-assembly-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Assembles filled lesson, Apply, and summary sections; validates that summary and apply/practice coverage exist without generating them inside assembly. |
| Active course generation batches | `active-course-generation-plan-v1`, `active-course-generation-run-v1` | `test_active_course_generation.py` | Passing | Verifies batch progression, source-packet ID preservation, courseBuildOutline-derived batches, completed-batch protection, unusable source-packet rejection, endpoint behavior, and course-build task next actions. |
| Full staged course generation | staged trace `stage_workflows` | `test_clean_start_generation_staged_outline.py`, `test_program_shell_staged_generation.py` | Passing | Real staged generator records outline, section-plan, section-fill, module-Apply, module-summary, and module-assembly reports. |

## Review And Promotion Workflows

| Workflow level | Contract or report | Primary tests | Current status | Notes |
| --- | --- | --- | --- | --- |
| Active review promotion | `review-transition-report-v1`, `quality_report` | `test_active_course_generation.py`, `test_program_generation_eval_scenarios.py`, `test_clean_start_generation_contracts.py` | Passing | Verifies completed active-batch courses can pass quality and promote to `ready_for_review`, while partial active batches stay blocked with traceable quality-report reasons. |

## Latest Verification

Run on 2026-07-19:

```bash
python3 -m py_compile \
  services/lycium-api/app/course_generation_stage_workflows.py \
  services/lycium-api/app/course_agent_staged.py \
  services/lycium-api/app/course_agent_staged_support.py \
  services/lycium-api/app/course_agent_assessment_prompting.py

python3 -m pytest \
  services/lycium-api/tests/test_course_generation_stage_workflows.py \
  services/lycium-api/tests/test_clean_start_generation_staged_outline.py \
  services/lycium-api/tests/test_program_shell_staged_generation.py -q

python3 -m pytest services/lycium-api/tests -q

corepack pnpm --filter @lycium/web test -- sourceCitationUtils.test.ts

corepack pnpm --filter @lycium/web typecheck

corepack pnpm --filter @lycium/web build
```

Result: `py_compile` passed, focused workflow tests `37 passed`, broader API regression `253 passed`, web tests `53 passed`, web typecheck passed, and web build passed.

Additional checks:

```bash
git diff --check
```

Result: passed.

## Next Workflow Target

All active-generation workflow levels now have focused passing coverage.

Next target: real-model active-generation quality hardening.

Strengthen product behavior for:

- semantic source-to-concept mapping beyond deterministic source slots
- model prompts that produce less templated examples while preserving editor-native blocks
- UI affordances for partial batches, complete batches, and quality-repair actions
- regression fixtures from real generated active courses, not only deterministic test courses
