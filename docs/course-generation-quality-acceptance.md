# Course And Program Teaching Quality Acceptance

Updated 2026-11-13. These requirements extend FR-6 through FR-14, FR-29 through FR-33e, FR-67 through FR-80d, and FR-134.

## Product Standard

With adequate sources and stated prerequisites, Lycium should generate instruction from which a learner can acquire the knowledge and practical skills of the requested college course. Programs should build on those courses to teach and assess the outcomes of an entire curriculum. Benchmark the knowledge, practical work, and depth against relevant college syllabi. Represent completed pathways as self-study programs and describe the competencies they cover.

Assess teaching quality from actual model outputs and learner work. For failures with adequate sources, inspect curriculum planning, handoffs, retrieval, output budgets, lesson writing, and evaluation alongside model capability.

## Curriculum And Handoff Requirements

- CQ-01. Use the selected model to plan scope, prerequisites, measurable outcomes, required concepts and skills, depth, workload, exclusions, and assessment evidence from the request and available sources. Use extracted headings and keywords as planning inputs. Reuse an explicitly approved curriculum when available. Label heuristic fallbacks as draft plans that require curriculum review before publication.
- CQ-02. A short request naming a familiar subject shall produce a coherent draft curriculum. Record assumptions and missing evidence. Verify supporting sources before publication and cite only inspected evidence used in the lesson.
- CQ-03. Persist reusable handoffs with stable IDs, descriptions, outcomes, prerequisites, required coverage, depth, candidate evidence references, and unresolved gaps. Allocate course requirements to modules, then module requirements to empty section shells. Section fill writes the instruction. Keep planning descriptions in metadata. Assign each required item or record a deferral and its reason, including budget limits.
- CQ-04. Preserve coverage of the full document in the planning map. Use general structure and context to classify front and back matter. Retain source locations, flag missing extraction, and supply relevant passages to section fill. Use a shared planning contract for web sources and files. Judge source readiness by relevant evidence, depth, and coverage.
- CQ-05. Choose lesson count, sequence, format, and workload to fit the outcomes and subject. Treat module and section counts as planning defaults. Describe the actual scope and depth in the catalog, including whether the course covers a full semester.
- CQ-06. Keep subject-specific curricula, expected topics, and named book content in source data and evaluation fixtures. Use general curriculum and document processing rules in production.

## Instruction, Assessment, And Program Requirements

- CQ-07. Teach each assigned outcome at the specified depth. Explain the ideas, demonstrate reasoning or procedures where appropriate, address likely misconceptions, and give learners practice with feedback or solutions. Choose formats that fit the subject and task.
- CQ-08. Assess taught knowledge with correct answer keys, plausible distractors, feedback under the course policy, and links to outcomes. Projects require meaningful work and an assessable rubric. Apply the existing 70% default to the selected assessment scope and count coverage when an item requires applying the relevant knowledge. Assess every mandatory outcome somewhere in the course, with cumulative tasks where appropriate.
- CQ-09. Trace each outcome from planning through instruction, practice, and assessment. Where applicable, verify math, run code in an isolated environment, and check factual claims against independent references. Record the evidence and identify checks still pending.
- CQ-10. Connect benchmarked program outcomes to clusters, course outcomes, prerequisite sequencing, and integrative assessments. A complete program requires every required course to be generated or selected, materialized, and accepted. Check for uncovered outcomes, unsupported prerequisites, repeated material, and capstones disconnected from the curriculum. Provide a way to complete and assess required labs and tool work. Record missing modalities as gaps.
- CQ-11. Tie failed quality checks to requirement IDs and affected artifacts. Repair the smallest affected scope, preserve prior versions and authored edits, and revalidate dependent lessons and assessments. Record job completion, structural validation, source readiness, teaching quality, and publication approval independently.

## Evaluation Requirements

- CQ-12. Use unit and contract tests for software behavior. Review live outputs for correctness, depth, and learnability. Use word counts, headings, citation presence, and keyword overlap to flag items for inspection.
- CQ-13. Send ordinary user prompts and declared evidence through the real application workflow. Evaluate the original outputs and label any repairs. For isolated stage tests, identify upstream fixtures. Keep prompt, provider/model, configuration, workflow versions, versioned source and stage references, truncation decisions, timing, usage, and findings in the run record.
- CQ-14. Compare a direct model response with the same workflow stage using the same model, request, and supplied evidence. Record each path's actual context and output budget. Score both with the same rubric and blind the order where practical. Locate the earliest workflow stage that loses coverage or depth. When both paths fail, inspect model capability, request ambiguity, and source adequacy. Run source-free, adequate-source, and deliberately truncated-source cases as distinct conditions.
- CQ-15. Maintain the existing golden set with independently reviewed syllabus and outcome expectations. Start with chemistry, precalculus, and Python. Keep expected-topic lists in the evaluator. Include prose-heavy subjects, unfamiliar subject variants, long PDFs, and noisy corpora in broader testing.
- CQ-16. Have a human reviewer inspect each initial public course and assessment against the reference curriculum. In the beta, give target-level learners held-out tasks that exercise the skills they studied. Record prerequisite knowledge, completion, assessment performance, points of confusion, and resulting revisions.

## Initial Acceptance Rubric

Rate each dimension from 0 to 4. Use 0 for missing or incorrect, 1 for major gaps, 2 for partial, 3 for usable at the intended level, and 4 for strong. Cite outcome IDs and supporting lesson or assessment evidence. The proposed threshold is at least 3 in every applicable dimension and resolution of critical factual errors, incorrect answer keys, and mandatory coverage gaps.

| Dimension | Evidence needed |
| --- | --- |
| Curriculum | Scope, prerequisites, and depth match an independently reviewed syllabus and outcome map. A short prompt yields the essential topics. |
| Teaching | A learner with the stated prerequisites receives enough explanation and demonstrated reasoning to attempt the assigned tasks, without an instructor having to write missing lessons. |
| Practice and transfer | Practice develops the stated skills and later tasks require learners to apply them to new problems. Expected work fits the course workload. |
| Assessment | Questions and projects test taught outcomes at the right difficulty with validated answers and rubrics. The selected scope meets its coverage threshold and the course assesses every mandatory outcome. |
| Grounding and correctness | Relevant passages support attributed claims. Review records include calculation, code, and factual checks along with extraction gaps and pending checks. |
| Coherence and usability | Prerequisites are in place, lessons do not repeat filler, sources and blocks render correctly, and learners can complete the sequence. |
| Program integration, when applicable | All required courses exist and pass review. Their sequencing and cumulative work support the program outcomes. |

Apply the relevant dimensions at each stage. Review curriculum scope and outcomes at the template stage, coverage and sequencing at module and section planning, and instruction and assessment at section fill and Apply. Review the assembled course and program again.

For an initial repeatability study, aim for three independent runs per diagnostic scenario and one per remaining golden scenario. Report all attempts, failures, repairs, and reviewer disagreements. Set held-out task criteria before each learner pilot.

## Current Evidence And Next Work

Baseline findings at commit `9132ae8`. The workflow test matrix records the model-backed template trial and remaining coverage gaps.

| Observed limitation | Evidence | Required follow-up |
| --- | --- | --- |
| The template builds a checklist and stock outcomes without a model call. | `run_course_template_workflow` in `services/lycium-api/app/course_generation_stage_workflows.py` | Implement CQ-01 and compare ordinary short-prompt outputs before proceeding downstream. |
| The source-derived planning branch can bypass the model plan. Fallback lesson plans use fixed foundations, evidence, and application patterns. | `generate_course_with_agent_staged` in `services/lycium-api/app/course_agent_staged.py` and `_topic_section_plans` in `services/lycium-api/app/course_coverage_checklists.py` | Use source structure as planning context, preserve the modular contracts, and verify sequencing against the outcomes. |
| Golden template prompts explicitly include required topic keywords. | `_scenario_prompt` in `services/lycium-api/tests/test_course_template_generation_scenarios.py` | Keep these handoff tests, add organic short-prompt discovery tests with evaluator expectations withheld. |
| Instructional-substance scoring rewards word count and example or practice headings. | `_eval_instructional_substance` in `services/lycium-api/app/course_quality_evals.py` | Review teaching outcome by outcome. Use heuristic scores to identify material for inspection. |
| The PDF compaction fix includes a named book-companion filter, and downstream selection still caps coverage items. | `NON_COURSE_MAP_TITLE_PARTS` in `services/lycium-api/app/source_extraction/local.py` and `build_course_coverage_checklist_from_source_packet` in `services/lycium-api/app/course_coverage_checklists.py` | Use general context to identify front matter and verify that required late-document coverage survives compaction. |

Start by comparing the current template with a direct model plan. Use the result to improve the template, then verify module and section planning, lesson fill, assessments, and complete course and program quality in that order.

Record baseline and live evaluation results in the [workflow test matrix](course-generation-workflow-test-matrix.md).
