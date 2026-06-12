from __future__ import annotations

from typing import Any

from app.course_generation_scenarios import evaluate_program_generation_scenario
from app.course_generation_scenario_specs import PROGRAM_SCENARIOS
from app.course_build_tasks import (
    transition_course_build_task_from_outline,
    transition_course_build_task_from_quality_report,
    transition_course_build_task_from_source_packet,
)
from app.curriculum_benchmarks import compile_curriculum_benchmark_context
from app.program_contract_builder import build_program_contract
from app.program_generation_drills import build_program_generation_drill
from app.program_quality import assess_program_quality
from app.program_validation import validate_program_contract
from app.source_request_fulfillment import (
    build_course_source_request_fulfillment_report,
    build_program_source_acquisition_fulfillment_report,
)


BENCHMARK_FIRST_PROGRAM_SCENARIOS = (
    "chemistry-foundations-program",
    "data-science-analytics-program",
    "public-health-foundations-program",
    "pre-medical-preparation-program",
)


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _flatten_requirements(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flattened: list[dict[str, Any]] = []
    for requirement in requirements:
        flattened.append(requirement)
        if requirement.get("type") == "requirement_set":
            flattened.extend(_flatten_requirements(_items(requirement.get("requirements"))))
    return flattened


def _course_requirements(program: dict[str, Any]) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    for group in _items(program.get("requirementGroups")):
        requirements.extend(_flatten_requirements(_items(group.get("requirements"))))
    return [requirement for requirement in requirements if requirement.get("type") == "complete_course"]


def _generated_program_from_scenario(scenario_id: str) -> dict[str, Any]:
    spec = PROGRAM_SCENARIOS[scenario_id]
    source_documents = _items(spec.get("sourceDocuments"))
    benchmark_context = compile_curriculum_benchmark_context(
        prompt=spec["generationGoal"],
        source_urls=[str(document["url"]) for document in source_documents if isinstance(document.get("url"), str)],
        source_documents=source_documents,
    )
    program, course_requirements, synthesis = build_program_contract(
        spec["generationGoal"],
        spec.get("level"),
        int(spec.get("desiredCourseCount") or 12),
        benchmark_context=benchmark_context,
    )
    known_requirements = _course_requirements(program)
    if not course_requirements:
        course_requirements = known_requirements
    course_packets = [
        {
            "courseId": str(requirement.get("courseId") or ""),
            "requirementId": str(requirement.get("id") or ""),
            "title": str(requirement.get("title") or ""),
            "learningPacket": {
                "object_ids": [f"object-{requirement.get('courseId') or requirement.get('id')}"]
            },
        }
        for requirement in known_requirements
    ]
    envelope = {
        "contractVersion": "0.1.0",
        "program": program,
        "generationTrace": {
            "goal": spec["generationGoal"],
            "curriculumBenchmarkContext": benchmark_context,
            "programSynthesis": synthesis,
            "coursePackets": course_packets,
        },
    }
    validation_errors = validate_program_contract(program)
    envelope["contractValidation"] = {"passed": not validation_errors, "errors": validation_errors}
    envelope["qualityReport"] = assess_program_quality(envelope)
    return envelope


def test_benchmark_first_program_generation_scenarios_pass_contract_quality_and_eval() -> None:
    for scenario_id in BENCHMARK_FIRST_PROGRAM_SCENARIOS:
        generated = _generated_program_from_scenario(scenario_id)

        assert generated["contractValidation"]["passed"], scenario_id
        assert generated["qualityReport"]["passed"], scenario_id
        report = evaluate_program_generation_scenario(generated, scenario_id)
        scaffold_plan = generated["generationTrace"]["programSynthesis"]["courseScaffoldPlan"]
        assert report["status"] == "passed", (scenario_id, report["recommendations"])
        assert report["metrics"]["failedCheckCount"] == 0
        assert scaffold_plan["clusterCount"] >= 3
        assert scaffold_plan["courseCount"] >= len(course_requirements := _course_requirements(generated["program"]))
        assert {course["action"] for course in scaffold_plan["courses"]} <= {"create_empty_course", "link_existing_course"}


def test_program_builder_falls_back_to_valid_generic_contract_without_benchmarks() -> None:
    program, course_requirements, synthesis = build_program_contract(
        "creative writing portfolio pathway",
        "undergraduate",
        6,
        benchmark_context={},
    )

    assert validate_program_contract(program) == []
    assert synthesis["mode"] == "goal_token_fallback"
    assert len(course_requirements) >= 6
    assert synthesis["courseScaffoldPlan"]["courseCount"] >= len(course_requirements)


def test_program_scaffold_plan_links_known_courses_by_title() -> None:
    _program, _course_requirements, synthesis = build_program_contract(
        "biology portfolio pathway",
        "undergraduate",
        6,
        benchmark_context={},
        known_courses=[{"courseId": "local-existing-biology", "title": "Biology"}],
    )
    plan = synthesis["courseScaffoldPlan"]

    assert any(course["action"] == "link_existing_course" for course in plan["courses"])
    linked = next(course for course in plan["courses"] if course["action"] == "link_existing_course")
    assert linked["existingCourseId"] == "local-existing-biology"
    assert linked["courseBuildTask"]["status"] == "linked_existing_course"
    assert linked["courseBuildTask"]["nextAction"] == "review_existing_course_fit"
    assert any(course["action"] == "create_empty_course" for course in plan["courses"])


def test_program_scaffold_plan_adds_prerequisites_to_later_course_shells() -> None:
    _program, course_requirements, synthesis = build_program_contract(
        "pre medical preparation pathway",
        "undergraduate",
        8,
        benchmark_context={},
    )
    plan = synthesis["courseScaffoldPlan"]
    courses = plan["courses"]
    first_course_ids = {
        str(course.get("courseId"))
        for course in courses
        if course.get("clusterId") == courses[0]["clusterId"]
    }
    later_courses = [course for course in courses if course.get("clusterId") != courses[0]["clusterId"]]

    assert len(course_requirements) >= 8
    assert later_courses
    assert any(course.get("prerequisiteCourseIds") for course in later_courses)
    assert set(later_courses[0]["prerequisiteCourseIds"]).issubset(first_course_ids)
    assert all(course["courseBuildTask"]["contractVersion"] == "course-build-task-v1" for course in courses)
    assert any(course["courseBuildTask"]["status"] == "source_gathering" for course in later_courses)
    assert "source_packet" in later_courses[0]["courseBuildTask"]["requiredInputs"]
    assert later_courses[0]["courseBuildTask"]["prerequisiteCourseIds"] == later_courses[0]["prerequisiteCourseIds"]


def test_program_generation_drill_rehearses_full_path_handoff() -> None:
    drill = build_program_generation_drill("pre-medical-preparation-program")

    assert drill["contractVersion"] == "program-generation-drill-v1"
    assert drill["status"] == "passed"
    assert drill["programEnvelope"]["qualityReport"]["passed"] is True
    assert drill["programEvaluation"]["status"] == "passed"

    readiness = drill["courseShellReadiness"]
    scaffold_plan = drill["programEnvelope"]["generationTrace"]["programSynthesis"]["courseScaffoldPlan"]
    task_report = scaffold_plan["courseBuildTaskReport"]
    shell_readiness = scaffold_plan["courseShellReadinessReport"]
    action_plan = scaffold_plan["courseShellActionPlan"]
    source_acquisition = scaffold_plan["sourceAcquisitionPlan"]
    assert readiness["clusterCount"] >= 3
    assert readiness["courseCount"] >= 10
    assert readiness["courseBuildTaskCount"] == readiness["courseCount"]
    assert readiness["sourceGatheringTaskCount"] >= 1
    assert readiness["sourcePacketRequiredCount"] == readiness["createEmptyCourseCount"]
    assert readiness["prerequisiteLinkedCourseCount"] >= 1
    assert task_report["contractVersion"] == "course-build-task-report-v1"
    assert task_report["status"] == "needs_sources"
    assert task_report["sourcePacketRequiredCount"] == readiness["sourcePacketRequiredCount"]
    assert task_report["missingCourseBuildTaskCount"] == 0
    assert shell_readiness["contractVersion"] == "program-course-shell-readiness-report-v1"
    assert shell_readiness["status"] == "needs_sources"
    assert shell_readiness["readinessCounts"]["needs_sources"] == readiness["sourcePacketRequiredCount"]
    assert shell_readiness["missingCourseBuildTaskCount"] == 0
    assert len(shell_readiness["clusterSummaries"]) == readiness["clusterCount"]
    assert action_plan["contractVersion"] == "program-course-shell-action-plan-v1"
    assert action_plan["status"] == "needs_sources"
    assert action_plan["actionCounts"]["attach_source_packet"] == readiness["sourcePacketRequiredCount"]
    assert action_plan["sourceRequestCount"] == readiness["sourcePacketRequiredCount"]
    assert action_plan["nextActions"][0]["action"] == "attach_source_packet"
    assert action_plan["nextActions"][0]["sourceRequest"]["contractVersion"] == "course-source-request-v1"
    assert action_plan["nextActions"][0]["sourceRequest"]["requiredConcepts"]
    assert action_plan["nextActions"][0]["sourceRequest"]["suggestedQueries"]
    assert source_acquisition["contractVersion"] == "program-source-acquisition-plan-v1"
    assert source_acquisition["status"] == "needs_sources"
    assert source_acquisition["sourceRequestCount"] == readiness["sourcePacketRequiredCount"]
    assert source_acquisition["requiredConceptCount"] >= readiness["sourcePacketRequiredCount"]
    assert source_acquisition["nextRequests"][0]["contractVersion"] == "program-source-acquisition-request-v1"
    search_plan = source_acquisition["sourceIndexSearchPlan"]
    assert search_plan["contractVersion"] == "program-source-index-search-plan-v1"
    assert search_plan["status"] == "ready"
    assert search_plan["searchTaskCount"] >= readiness["sourcePacketRequiredCount"]
    assert search_plan["nextTasks"][0]["contractVersion"] == "source-index-search-task-v1"
    assert search_plan["nextTasks"][0]["intent"] == "find_source_packet_evidence"
    assert all(check["status"] == "passed" for check in drill["checks"])
    timeline = drill["programEnvelope"]["generationTrace"]["timeline"]
    assert timeline["contractVersion"] == "program-generation-timeline-v1"
    assert timeline["status"] == "passed"
    assert [event["eventType"] for event in timeline["events"]] == [
        "program_intake",
        "curriculum_benchmark_context",
        "program_contract_validated",
        "program_quality_assessed",
        "course_scaffold_planned",
        "course_build_task_summary",
    ]
    assert timeline["events"][-1]["payload"]["sourcePacketRequiredCount"] == readiness["sourcePacketRequiredCount"]
    assert timeline["events"][-1]["payload"]["courseBuildTaskReport"]["status"] == "needs_sources"
    assert timeline["events"][-1]["payload"]["courseShellReadinessReport"]["status"] == "needs_sources"
    assert timeline["events"][-1]["payload"]["courseShellActionPlan"]["status"] == "needs_sources"
    assert timeline["events"][-1]["payload"]["sourceAcquisitionPlan"]["status"] == "needs_sources"


def test_program_generation_drill_can_link_existing_courses_and_create_new_shells() -> None:
    initial_drill = build_program_generation_drill("pre-medical-preparation-program")
    initial_courses = initial_drill["programEnvelope"]["generationTrace"]["programSynthesis"]["courseScaffoldPlan"]["courses"]
    course_to_link = initial_courses[0]
    drill = build_program_generation_drill(
        "pre-medical-preparation-program",
        known_courses=[{"courseId": f"existing-{course_to_link['courseId']}", "title": course_to_link["title"]}],
    )

    readiness = drill["courseShellReadiness"]
    assert drill["status"] == "passed"
    assert readiness["linkExistingCourseCount"] >= 1
    assert readiness["createEmptyCourseCount"] >= 1
    assert readiness["sourcePacketRequiredCount"] == readiness["createEmptyCourseCount"]


def test_source_packet_transition_report_explains_outline_readiness() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "course-general-chemistry",
        "status": "source_gathering",
        "currentStage": "source_gathering",
        "nextAction": "attach_source_packet",
        "requiredInputs": ["source_packet", "concept_source_coverage"],
    }
    usable_packet = {
        "contractVersion": "source-packet-v1",
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1.0,
            "uncoveredConceptCandidates": [],
        },
    }

    advanced = transition_course_build_task_from_source_packet(task, source_packet=usable_packet)
    report = advanced["sourcePacketTransitionReport"]

    assert advanced["status"] == "outline_ready"
    assert report["contractVersion"] == "source-packet-transition-report-v1"
    assert report["passed"] is True
    assert report["status"] == "outline_ready"
    assert report["nextStage"] == "outline_ready"
    assert report["metrics"]["conceptCoverageRatio"] == 1.0


def test_source_packet_transition_report_explains_blocked_source_gathering() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "course-general-chemistry",
        "status": "source_gathering",
        "currentStage": "source_gathering",
        "nextAction": "attach_source_packet",
        "requiredInputs": ["source_packet", "concept_source_coverage"],
    }
    weak_packet = {
        "contractVersion": "source-packet-v1",
        "quality": {
            "status": "needs_review",
            "conceptCoverageRatio": 0.42,
            "uncoveredConceptCandidates": ["stoichiometry"],
        },
    }

    blocked = transition_course_build_task_from_source_packet(task, source_packet=weak_packet)
    report = blocked["sourcePacketTransitionReport"]

    assert blocked["status"] == "source_gathering"
    assert report["passed"] is False
    assert report["status"] == "blocked"
    assert "source_packet_not_usable" in report["reasons"]
    assert "concept_coverage_below_policy" in report["reasons"]
    assert "uncovered_concepts_remaining" in report["reasons"]
    assert report["uncoveredConceptCandidates"] == ["stoichiometry"]


def test_outline_transition_report_explains_section_generation_readiness() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "course-general-chemistry",
        "status": "outline_ready",
        "currentStage": "outline_ready",
        "nextAction": "generate_course_outline",
        "requiredInputs": ["course_outline"],
    }
    outline = {
        "modules": [
            {
                "title": "Matter and Measurement",
                "sections": [
                    {
                        "title": "Measurement systems",
                        "learningObjectives": ["Use units and significant figures."],
                        "conceptKeywords": ["measurement", "significant figures"],
                    },
                    {
                        "title": "Matter classification",
                        "learningObjectives": ["Classify matter by composition."],
                        "conceptKeywords": ["matter", "mixture"],
                    },
                ],
            }
        ]
    }

    advanced = transition_course_build_task_from_outline(task, outline=outline)
    report = advanced["outlineTransitionReport"]

    assert advanced["status"] == "section_generation_ready"
    assert report["contractVersion"] == "outline-transition-report-v1"
    assert report["passed"] is True
    assert report["status"] == "section_generation_ready"
    assert report["nextStage"] == "section_generation_ready"
    assert report["metrics"]["moduleCount"] == 1
    assert report["metrics"]["sectionCount"] == 2


def test_outline_transition_report_explains_blocked_outline() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "course-general-chemistry",
        "status": "outline_ready",
        "currentStage": "outline_ready",
        "nextAction": "generate_course_outline",
        "requiredInputs": ["course_outline"],
    }
    outline = {
        "modules": [
            {
                "title": "",
                "sections": [
                    {
                        "title": "Thin section",
                        "learningObjectives": [],
                        "conceptKeywords": [],
                    }
                ],
            }
        ]
    }

    blocked = transition_course_build_task_from_outline(task, outline=outline)
    report = blocked["outlineTransitionReport"]

    assert blocked["status"] == "outline_ready"
    assert report["passed"] is False
    assert report["status"] == "blocked"
    assert "module_title_missing" in report["reasons"]
    assert "section_count_below_policy" in report["reasons"]
    assert "section_objectives_missing" in report["reasons"]
    assert "section_concepts_missing" in report["reasons"]


def test_review_transition_report_explains_ready_for_review() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "course-general-chemistry",
        "status": "section_generation_ready",
        "currentStage": "section_generation_ready",
        "nextAction": "generate_course_sections",
        "requiredInputs": ["section_generation"],
    }
    quality_report = {
        "passed": True,
        "score": 0.93,
        "errors": [],
        "warnings": ["Review media manually."],
        "gates": [{"gate": "course_contract", "status": "passed"}],
        "evals": {"dimensions": [{"key": "source_grounding", "status": "passed"}]},
    }

    advanced = transition_course_build_task_from_quality_report(task, quality_report=quality_report)
    report = advanced["reviewTransitionReport"]

    assert advanced["status"] == "ready_for_review"
    assert report["contractVersion"] == "review-transition-report-v1"
    assert report["passed"] is True
    assert report["status"] == "ready_for_review"
    assert report["nextStage"] == "ready_for_review"
    assert report["metrics"]["score"] == 0.93
    assert report["metrics"]["warningCount"] == 1


def test_review_transition_report_explains_blocked_quality_report() -> None:
    task = {
        "contractVersion": "course-build-task-v1",
        "courseId": "course-general-chemistry",
        "status": "section_generation_ready",
        "currentStage": "section_generation_ready",
        "nextAction": "generate_course_sections",
        "requiredInputs": ["section_generation"],
    }
    quality_report = {
        "passed": False,
        "score": 0.41,
        "errors": ["Missing citations."],
        "warnings": [],
        "gates": [{"gate": "source_analysis", "status": "failed"}],
        "evals": {"dimensions": [{"key": "source_grounding", "status": "failed"}]},
    }

    blocked = transition_course_build_task_from_quality_report(task, quality_report=quality_report)
    report = blocked["reviewTransitionReport"]

    assert blocked["status"] == "section_generation_ready"
    assert report["passed"] is False
    assert report["status"] == "blocked"
    assert "quality_report_not_passed" in report["reasons"]
    assert "quality_errors_present" in report["reasons"]
    assert "quality_gates_failed" in report["reasons"]
    assert "quality_evals_failed" in report["reasons"]
    assert report["failedGates"] == ["source_analysis"]
    assert report["failedEvalDimensions"] == ["source_grounding"]


def test_course_source_request_fulfillment_report_scores_concept_coverage() -> None:
    source_request = {
        "contractVersion": "course-source-request-v1",
        "courseId": "general-chemistry-stoichiometry",
        "requirementId": "req-stoichiometry",
        "title": "Stoichiometry",
        "requiredConcepts": ["stoichiometry", "mole ratio", "limiting reactant"],
        "minimumConceptCoverageRatio": 0.7,
    }
    search_results = [
        {
            "source": {"public_id": "source-openstax-chemistry", "title": "Open Chemistry Notes"},
            "snapshot": {"extracted_text": "Stoichiometry uses mole ratio reasoning and limiting reactant analysis."},
            "score": 2.4,
            "matched_terms": ["stoichiometry", "mole", "ratio", "limiting", "reactant"],
            "evidence_refs": ["source-openstax-chemistry", "snapshot-openstax-chemistry"],
            "summary": "Stoichiometry, mole ratio, and limiting reactant practice.",
        }
    ]

    report = build_course_source_request_fulfillment_report(
        source_request=source_request,
        search_results=search_results,
    )

    assert report["contractVersion"] == "course-source-request-fulfillment-report-v1"
    assert report["status"] == "satisfied"
    assert report["metrics"]["conceptCoverageRatio"] == 1.0
    assert report["selectedCandidates"][0]["sourceId"] == "source-openstax-chemistry"
    assert report["uncoveredConcepts"] == []
