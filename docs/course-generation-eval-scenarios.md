# Course Generation Eval Scenarios

These scenarios define the minimum professional eval set for judging whether Lycium is actually compiling source-backed curricula rather than producing plausible outlines.

## Shared Pass Criteria

Each scenario should produce:

- A valid course or program contract.
- Source-corpus preflight evidence with included and excluded source decisions.
- Curriculum benchmark evidence when syllabi, catalogs, standards, or employer profiles are present.
- Required, recommended, optional, remedial, alternate, or enrichment classifications where benchmark comparison is possible.
- Source slots for required concepts with at least one primary source and a fallback policy.
- Assessment-only quiz sections with at least 10 questions for real module quizzes.
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

## Scenario 2: CHEM 105 College Course

Goal: prove Lycium can generate a real lower-division college course from open sources.

Inputs:

- OpenStax Chemistry 2e or comparable free textbook chapters.
- At least two public general chemistry syllabi or catalog descriptions.
- Reputable videos or simulations when available.

Assertions:

- Course level is undergraduate.
- College/category and department are selected from the taxonomy.
- Course has 10-20 modules or weeks.
- Each module has teachable Learn pages, at least one Apply/quiz page, media where appropriate, and a concept-card summary.
- Required topics reflect common general chemistry scope: measurement, atoms, stoichiometry, reactions, thermochemistry, electronic structure, bonding, gases, liquids/solids, solutions, equilibrium, acids/bases, and electrochemistry if in scope.

## Scenario 3: Intro Programming Course

Goal: prove Lycium can build an applied skill course with projects and practice.

Inputs:

- Open textbook or reputable tutorial sources.
- A representative intro programming syllabus.
- Project requirements or lab examples.

Assertions:

- Course includes code examples, practice tasks, quizzes, and a final project.
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
- The gap includes source type hints and suggested queries.
- The draft contains only source-planning scaffolding, not a full set of generated lessons, quizzes, or summaries.
- The draft can collect additional sources before generation resumes.

## Automated Coverage

The backend scenario checks live in `services/lycium-api/tests/test_course_generation_scenarios.py`.

Current automated coverage includes:

- Scenario registry checks for CHEM 105, intro programming, software engineering methods, under-sourced prompts, and full-stack program scenarios.
- CHEM 105 acceptance and rejection checks.
- CHEM 105 flagship benchmark/source/source-slot checks.
- Intro programming and software engineering methods source-backed fixture checks.
- Noisy source corpus exclusion checks.
- Full-stack program requirement-shape checks.
- Actual full-stack fixture scenario validation.
- Under-sourced prompt acceptance and hollow-course rejection checks.
- Publish-gate acceptance for a teachable source-backed course.
- Publish-gate rejection for placeholder or prompt-like generated content.

The source-index packet checks live in `services/source-index/tests/test_source_index_api.py` and `services/lycium-api/tests/test_source_index.py`.
