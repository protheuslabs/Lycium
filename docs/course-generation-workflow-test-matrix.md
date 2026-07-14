# Course Generation Workflow Test Matrix

Last updated: 2026-07-14

This document tracks the workflow-level tests for Lycium generation. Update it whenever a workflow stage is added, split, or promoted from smoke coverage to stronger integration coverage.

## Status Legend

- `Passing`: covered by focused tests and verified in the latest run.
- `Basic`: covered by smoke tests, but needs deeper product-shape assertions.
- `Next`: the next workflow layer to strengthen.
- `Planned`: not yet covered as an independent workflow test.

## Workflow Matrix

| Workflow level | Contract or report | Primary tests | Current status | Notes |
| --- | --- | --- | --- | --- |
| Curriculum assembly thresholds | `curriculum-assembly-policy-v1` | `test_curriculum_assembly_policy.py` | Passing | Cluster-from-courses requires 3, recommends 4. Program-from-clusters requires 2, recommends 3. |
| Program generation | `program-generation-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Validates domain fallback curricula, program contract, requirement groups, and scaffold handoff. |
| Cluster generation | `cluster-generation-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Clusters expose semantic `courseKinds` with title, description, source status, and assembly readiness. |
| Course-wrapper generation | `course-wrapper-v1`, `course-build-task-v1`, `active-course-generation-plan-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Verifies empty shell rows have source requests, build tasks, action/source-acquisition plans, active generation plans, and no fake generated content. |
| Source-packet transition to outline | `source-packet-transition-report-v1`, `course-outline-from-source-packet-v1` | `test_course_generation_stage_workflows.py`, `test_program_generation_eval_scenarios.py` | Passing | Verifies a wrapper task can advance from `source_gathering` to `outline_ready` and produce a source-packet-derived module outline. |
| Program scaffold materialization | `program-course-scaffold-plan-v1`, `program-course-shell-readiness-report-v1` | `test_program_generation_e2e.py`, `test_program_shell_staged_generation.py` | Passing | Verifies program shell handoff creates openable `needs_sources` course shells. |
| Course module outline generation | `course-module-outline-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Source-packet-backed outlines are independently testable. |
| Module section planning | `module-section-plan-workflow-v1` | `test_course_generation_stage_workflows.py` | Passing | Extracts lesson section plans from module outlines. |
| Section fill generation | `section-fill-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Produces editor-native sections with generation-outline metadata. |
| Module assembly | `module-assembly-workflow-v1` | `test_course_generation_stage_workflows.py`, `test_clean_start_generation_staged_outline.py` | Passing | Adds/validates summary sections and reports missing apply/practice coverage. |
| Full staged course generation | staged trace `stage_workflows` | `test_clean_start_generation_staged_outline.py`, `test_program_shell_staged_generation.py` | Passing | Real staged generator records outline, section-plan, section-fill, and module-assembly reports. |

## Latest Verification

Run on 2026-07-14:

```bash
python3 -m pytest \
  services/lycium-api/tests/test_curriculum_assembly_policy.py \
  services/lycium-api/tests/test_program_generation_eval_scenarios.py \
  services/lycium-api/tests/test_program_shell_staged_generation.py \
  services/lycium-api/tests/test_course_generation_stage_workflows.py \
  services/lycium-api/tests/test_program_generation_e2e.py \
  services/lycium-api/tests/test_program_source_acquisition_reports.py \
  services/lycium-api/tests/test_generation_eval_reports.py \
  services/lycium-api/tests/test_course_generation_gauntlet.py -q
```

Result: `42 passed`.

Additional checks:

```bash
python3 -m py_compile \
  services/lycium-api/app/curriculum_assembly_policy.py \
  services/lycium-api/app/program_course_scaffold.py \
  services/lycium-api/app/course_generation_stage_workflows.py

git diff --check
```

Result: passed.

## Next Workflow Target

Next target: outline transition into section generation.

Strengthen tests for:

- outline-ready tasks advance to `section_generation_ready`
- outline transition reports preserve module/section counts and blocking reasons
- generated outlines can feed staged course generation with wrapper lineage
- weak outlines stay blocked with explainable transition reports
