# Course Generation Eval Scenarios

These scenarios define the minimum professional eval set for judging whether Lycium is actually compiling source-backed curricula rather than producing plausible outlines.

## Shared Pass Criteria

Each scenario should produce:

- A valid course or program contract.
- Source-corpus preflight evidence with included and excluded source decisions.
- Curriculum benchmark evidence when syllabi, catalogs, standards, or employer profiles are present.
- Required, recommended, optional, remedial, alternate, or enrichment classifications where benchmark comparison is possible.
- Source slots for required concepts with at least one primary source and a fallback policy.
- Mastery-evidence sections that may use quiz-only question banks, longer tests, projects, labs, simulations, portfolio tasks, or rubric-graded submissions. Real quiz/test banks should include at least 10 questions.
- Module or week summaries made from raw concept cards, not prose recap categories.
- A quality report that explains pass/fail gate evidence.
- A review/publish decision that does not publish failed artifacts unless a reviewer records an explicit override reason.

## Scenario 1: Flagship Software Engineering Program

Goal: prove Lycium can represent a full education pathway, not only standalone courses.

Inputs:

- Software engineering curriculum benchmarks.
- SWEBOK or equivalent body-of-knowledge source.
- ACM/IEEE-style computing curriculum references.
- Local software engineering course wrappers.

Assertions:

- Output is a `LyciumProgram`.
- Program has requirement groups for foundations, programming core, engineering core, platforms, operations, specialization, and capstone.
- Completion rules include complete-all and choice/elective structures.
- Dependency graph has no cycles.
- Capstone and portfolio artifact requirements are present.
- Course prerequisites align with dependency edges.

## Scenario 2: Golden Course Templates

Goal: prove Lycium can generate real lower-division and professional courses from representative open-source inputs without domain-specific generator branches.

Inputs:

- A data-only course template from `services/lycium-api/app/course_generation_golden_dataset.json`.
- Open textbook, catalog, syllabus, public data, or comparable reputable sources appropriate to that template.
- The generated course artifact to score against the template.

Assertions:

- The first active workflow emits a passing `course-template-v1` artifact before module outline generation.
- The template handoff resolves a clean title, learner-facing short description, scope, learning outcomes, source/source-packet references, and coverage checklist without creating modules, sections, or learner-facing content.
- Course level is undergraduate.
- College/category and department are selected from the taxonomy.
- Course has 10-20 modules or weeks.
- Each module has teachable Learn pages, at least one Apply/quiz page, media where appropriate, and a concept-card summary.
- Required topics match the chosen golden template's `requiredKeywords`.

## Scenario 3: Intro Programming Course

Goal: prove Lycium can build an applied skill course with projects and practice.

Inputs:

- Open textbook or reputable tutorial sources.
- A representative intro programming syllabus.
- Project requirements or lab examples.

Assertions:

- Course includes code examples, practice tasks, mastery evidence, and a final project or equivalent rubric-graded applied submission.
- Concepts build from variables/control flow to functions, data structures, files/APIs, testing, and project structure.
- Assessments test taught concepts only.
- Portfolio artifact requirements are present when the course belongs to a career-path program.

## Scenario 4: Messy Source Corpus

Goal: prove source preflight filters irrelevant material before generation.

Inputs:

- 20-50 mixed sources on one broad subject.
- At least 25% intentionally irrelevant or weak sources.
- Some duplicate or near-duplicate sources.

Assertions:

- Source-corpus preflight excludes irrelevant sources with evidence.
- Weak one-term overlaps are excluded unless they have strong score, multiple subject anchors, or clear URL/path evidence.
- Included sources cluster around common themes.
- Generation uses included sources only unless a reviewer restores an excluded source.
- Quality report warns when source coverage is thin, duplicative, or too narrow.

## Scenario 5: Review/Publish Gate

Goal: prove weak generated courses are held for review instead of entering the catalog.

Inputs:

- A deliberately weak generated course with placeholder prose, missing sources, or mixed quiz/instruction pages.

Assertions:

- Validation catches structural issues.
- Quality eval catches placeholder or non-instructional content.
- Publish is blocked until gates pass or a reviewer records an override.
- Review UI can show gate evidence, source coverage, benchmark context, and source slots.

## Scenario 6: Under-Sourced Prompt

Goal: prove Lycium does not invent a hollow course when the prompt lacks enough relevant source coverage.

Inputs:

- A course prompt with fewer than the minimum required source records.
- No benchmark packet or weak concept-source coverage.

Assertions:

- Output remains a `needs_sources` draft.
- `metadata.sourceGaps` includes a blocking gap.
- `metadata.generationReadiness` preserves the non-ready source-readiness report with submitted evidence counts, uncovered concepts, and readiness issues.
- The gap includes source type hints and suggested queries.
- The draft contains only source-planning scaffolding, not a full set of generated lessons, quizzes, or summaries.
- The draft can collect additional sources before generation resumes.

## Automated Coverage

The backend scenario checks live in `services/lycium-api/tests/test_course_generation_scenarios.py` and `services/lycium-api/tests/test_course_template_generation_scenarios.py`.

Current automated coverage includes:

- Scenario registry checks for golden course templates, under-sourced prompts, and full-stack program scenarios.
- Golden course template workflow checks across all 10 dataset courses, including title cleanup, taxonomy preservation, first-stage handoff shape, required-topic coverage, and rejection of materialized payloads or workflow-facing catalog descriptions.
- Macroeconomics Principles acceptance and rejection checks through the generic golden-template path.
- Golden dataset checks that course-specific benchmark/source data lives in JSON rather than evaluator code.
- Intro programming and software engineering methods source-backed fixture checks.
- Noisy source corpus exclusion checks.
- Full-stack program requirement-shape checks.
- Actual full-stack fixture scenario validation.
- Under-sourced prompt acceptance and hollow-course rejection checks.
- Source-backed fixture checks require a positive `metadata.generationReadiness` report; evals fail if readiness is missing, non-ready, below concept coverage policy, or still contains blocking issues.
- Publish-gate acceptance for a teachable source-backed course.
- Publish-gate rejection for placeholder or prompt-like generated content.

The source-index packet checks live in `services/source-index/tests/test_source_index_api.py` and `services/lycium-api/tests/test_source_index.py`.

## Persistent Eval Run Reports

Generation evals also support a local run-report format so scores can be trended over time instead of only passing or failing inside pytest. The primitive lives in `services/lycium-api/app/generation_eval_reports.py`.

The report writer stores:

- `run-*.json` for each eval run.
- `latest.json` for the newest run.
- `index.json` as a bounded ring of recent run summaries.

The default storage location is `.lycium-local/eval-runs`, which is gitignored. Set `LYCIUM_EVAL_REPORT_DIR` to write reports somewhere else, such as a CI artifact directory.

Use:

```bash
corepack pnpm test:generation-evals
```

To write a real local report:

```bash
corepack pnpm report:generation-evals
```

The current persistent report test covers Macroeconomics Principles, Intro Programming, Full-Stack Software Engineer Program, multi-source noisy corpus, and under-sourced prompt scenarios.

## Native Generation Gauntlet

The native gauntlet primitive lives in `services/lycium-api/app/course_generation_gauntlet.py`.

It evaluates generated artifacts without caring whether they came from a human, Ollama, a cloud provider, a fixture, a source packet, or a future Infring primitive. The default gauntlet cases are:

- Macroeconomics Principles college course.
- Intro programming course.
- Software engineering methods course.
- Academic writing and research composition course.
- General biology foundations course.
- Introductory statistics course.
- Environmental science foundations course.
- Art history survey course.
- Financial accounting principles course.
- Public speaking and communication course.
- Under-sourced prompt lifecycle.
- Full-stack software engineer program.
- Chemistry foundations program.
- Data science analytics program.
- Public health foundations program.
- Pre-medical preparation program.

The default case list lives in `services/lycium-api/app/course_generation_gauntlet_manifest.json`. Course-template data lives in `services/lycium-api/app/course_generation_golden_dataset.json`; do not hardcode new course domains into the evaluator.

The report returns:

- `status`: `passed`, `needs_review`, or `failed`.
- `score`: average scenario score.
- `cases`: per-scenario reports.
- `metrics.kindCounts`, `metrics.domainCounts`, and `metrics.inputMixCounts`: coverage breadth across artifact types, learning domains, and input modes.
- `metrics.gapCounts`: classified gaps such as `missing_artifact`, `source_readiness`, `source_grounding`, `assessment_quality`, `curriculum_coverage`, `instructional_substance`, and `program_structure`.

This is the bridge between individual eval tests and the larger vision question: “Can Lycium repeatedly generate college-quality courses and programs from real inputs?” A local or CI run should treat missing artifacts as `needs_review`, not as silent success.

To evaluate artifacts from a real local/cloud generation attempt, write a bundle:

```json
{
  "contractVersion": "course-generation-gauntlet-input-v1",
  "metadata": {
    "provider": "ollama",
    "model": "kimi-k2.6:cloud",
    "prompt": "Generate Macroeconomics Principles from these sources",
    "inputMix": "prompt+urls+files"
  },
  "courses": {
    "macroeconomics-principles": {}
  },
  "programs": {
    "full-stack-software-engineer-program": {}
  }
}
```

Then run:

```bash
cd services/lycium-api
python3 scripts/write_generation_gauntlet_report.py --input path/to/gauntlet-input.json
```

The script writes the same persistent eval-run format as `corepack pnpm report:generation-evals`, but the reports are derived from the generated artifacts in the bundle. Missing gauntlet artifacts are recorded as `needs_review` with `missing_artifact` gap evidence.

A copyable starting point lives at `docs/examples/course-generation-gauntlet-input.example.json`.

To build that bundle from generated artifact files:

```bash
corepack pnpm build:generation-gauntlet-bundle -- \
  --course macroeconomics-principles=.lycium-local/generated/macroeconomics-principles.json \
  --program full-stack-software-engineer-program=.lycium-local/generated/full-stack-program.json \
  --provider ollama \
  --model kimi-k2.6:cloud \
  --input-mix prompt+urls+files \
  --manifest services/lycium-api/app/course_generation_gauntlet_manifest.json \
  --output .lycium-local/gauntlet-input.json
```

Then score it:

```bash
corepack pnpm report:generation-gauntlet -- \
  --input ../../.lycium-local/gauntlet-input.json
```

Or build and score in one step:

```bash
corepack pnpm run:generation-gauntlet -- \
  --course macroeconomics-principles=.lycium-local/generated/macroeconomics-principles.json \
  --program full-stack-software-engineer-program=.lycium-local/generated/full-stack-program.json \
  --provider ollama \
  --model kimi-k2.6:cloud \
  --input-mix prompt+urls+files \
  --manifest services/lycium-api/app/course_generation_gauntlet_manifest.json \
  --bundle-output .lycium-local/gauntlet-input.json
```

## Local Model Capability Sweeps

Use the local model sweep scripts when judging whether a provider/model combination is strong enough for course generation work. These scripts are intentionally local evidence-gathering tools rather than CI requirements because they may call local or paid external models.

The runner is:

```bash
python3 services/lycium-api/scripts/run_model_param_sweep.py
```

Supported task levels:

- `plan`: ask the model for a compact source-backed course plan.
- `section`: ask the model for one editor-native sourced Learn section.
- `quiz`: ask the model for one valid 10-question quiz section.
- `all-micro`: run `plan`, `section`, and `quiz` as the primitive capability gate.
- `one-module`: run `all-micro`, then deterministically compose a one-module course from the validated primitives and run the normal course quality gate.
- `full-course`: call the real staged course generation experiment path.

Recommended diagnostic order:

```bash
python3 services/lycium-api/scripts/run_model_param_sweep.py --task all-micro --models kimi-k2.6:cloud
python3 services/lycium-api/scripts/run_model_param_sweep.py --task one-module --models kimi-k2.6:cloud
python3 services/lycium-api/scripts/run_model_param_sweep.py --task full-course --models kimi-k2.6:cloud
```

Interpretation:

- If small local models fail `all-micro`, they are not suitable for review-ready course generation.
- If a high-tier model fails `plan`, `section`, or `quiz`, improve the prompt or contract.
- If a high-tier model passes `all-micro` but fails `one-module` or `full-course`, improve workflow orchestration, deterministic assembly, source scaffolding, or quality-gate alignment.
- The current preferred architecture is validated primitive generation followed by deterministic assembly, because the composed one-module benchmark can isolate model capability from orchestration overhead.
