# CHEM 105 flagship generation target

CHEM 105 General Chemistry I is the first flagship proof target for Lycium's course-generation workflow. The goal is not to trust a model because it produced plausible chemistry prose. The goal is to require a generated course to satisfy institutional benchmark evidence, free-source coverage, course structure, assessment structure, and review gates before it can be considered ready for human review.

## Why CHEM 105

General Chemistry I is a good stress test because it is common, structured, and widely benchmarked. Real course catalogs and syllabi converge around a recognizable first-semester spine: measurement, atomic structure, periodic trends, stoichiometry, reactions, solutions, thermochemistry, bonding, molecular geometry, gases, kinetics, equilibrium, acid-base chemistry, and lab safety.

## Benchmark evidence

The flagship scenario records multiple institutional benchmarks:

| Benchmark | Why it matters |
| --- | --- |
| University of Alaska Fairbanks CHEM F105X syllabus | Gives a week-by-week college General Chemistry I structure and explicit learning outcomes. |
| Adrian College CHEM105 catalog entry | Confirms a three-credit General Chemistry I course with measurement, matter, atomic structure, stoichiometry, solutions, acids/bases, bonding, and Lewis structures. |
| University of Mississippi CHEM 105 catalog entry | Confirms the broader General Chemistry I scope including structure, stoichiometry, solutions, gases, bonding, kinetics, thermodynamics, and equilibrium. |
| USC CHEM 105aLg syllabus | Confirms bonding, stoichiometry, solutions, gases, thermochemistry, and atomic theory as college-level CHEM 105 content. |

## Free source plan

The scenario uses only free-access source targets:

| Source | Role |
| --- | --- |
| OpenStax Chemistry 2e | Primary textbook spine for readings, examples, exercises, and chapter sequence. |
| Chemistry LibreTexts: Chemistry 2e (OpenStax) | Web-native chapter access and fallback source mirror for OpenStax-aligned sections. |
| Khan Academy Chemistry archive | Short video and practice support for difficult conceptual/quantitative topics. |
| MIT OCW 5.111 Principles of Chemical Science | Supplemental college lecture notes and examples for higher-rigor explanation. |
| ChemCollective virtual labs | Practice, concept tests, and virtual laboratory activities for stoichiometry, thermochemistry, and equilibrium. |
| PhET chemistry simulations | Interactive support for molecule shapes, gases, solution behavior, and visual models. |

## Required generated course shape

- 14 weeks minimum.
- Exactly one learner-facing pacing label: `Week`.
- At least one Learn page per week.
- At least one quiz per week.
- At least 10 questions per quiz.
- At least one source slot per required week.
- Every generated Learn, Apply, and Summary section must carry local `sourceIds`.
- Instructional and assessment blocks must carry `sourceIds` so inline citations can be verified against the section's actual evidence.
- At least 80 percent module video/media coverage.
- Summary sections use concept-card inventories, not prose recaps.
- Course metadata records benchmark evidence, requirement origins, and source slots.

## Current gate represented in code

The implementation is centered on `chem-105-general-chemistry` in:

- `services/lycium-api/app/course_generation_flagships.py`
- `services/lycium-api/app/course_generation_scenarios.py`
- `services/lycium-api/tests/test_course_generation_scenarios.py`

This does not mean generated CHEM 105 courses are automatically excellent yet. It means Lycium now has a concrete target that future generator work can be measured against.

The current eval also rejects courses that rely only on a blanket course-level source list. A passing CHEM 105 draft must map sources to source slots, sections, and sourceable blocks so the renderer and review workflow can show only the citations that support the current page.

## What still needs deeper proof

- Real source retrieval should fetch, snapshot, and score the sources instead of relying on a static source plan.
- Benchmark extraction should parse multiple catalogs and syllabi into structured `CurriculumBenchmark` records automatically.
- The LLM harness should generate a full CHEM 105 draft from this blueprint and return a review report with failed/passed gates.
- Human review should be able to lock accepted weeks, replace weak sources, and republish a corrected snapshot.
