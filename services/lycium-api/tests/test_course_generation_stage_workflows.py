from __future__ import annotations

from app.course_generation_stage_workflows import (
    CLUSTER_GENERATION_CONTRACT,
    COURSE_MODULE_OUTLINE_CONTRACT,
    COURSE_WRAPPER_GENERATION_CONTRACT,
    MODULE_ASSEMBLY_CONTRACT,
    MODULE_SECTION_PLAN_CONTRACT,
    PROGRAM_GENERATION_CONTRACT,
    SECTION_FILL_CONTRACT,
    STAGE_WORKFLOW_VERSION,
    run_cluster_generation_workflow,
    run_course_module_outline_workflow,
    run_course_wrapper_generation_workflow,
    run_module_assembly_workflow,
    run_module_section_plan_workflow,
    run_program_generation_workflow,
    run_section_fill_workflow,
)


def _source_packet() -> dict:
    return {
        "contract_version": "source-packet-v1",
        "source_documents": [
            {
                "courseSourceId": "source-motion",
                "title": "Mechanics notes",
                "url": "https://example.edu/mechanics",
                "text": (
                    "Velocity, acceleration, force, energy, momentum, vectors, free body diagrams, "
                    "laboratory measurement, and uncertainty are core mechanics concepts."
                ),
            }
        ],
    }


def test_program_generation_workflow_returns_testable_program_contract() -> None:
    result = run_program_generation_workflow(
        goal="full-stack software developer",
        level="professional",
        desired_course_count=6,
    )

    assert result["workflowVersion"] == STAGE_WORKFLOW_VERSION
    assert result["contractVersion"] == PROGRAM_GENERATION_CONTRACT
    assert result["stage"] == "program_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["requirementGroupCount"] >= 3
    assert result["metrics"]["courseRequirementCount"] >= 6
    assert result["artifacts"]["program"]["requirementGroups"]
    assert result["artifacts"]["programSynthesis"]["courseScaffoldPlan"]["workflowContracts"]["programGeneration"] == "program-generation-workflow-v1"


def test_cluster_generation_workflow_is_separate_from_program_generation() -> None:
    program = run_program_generation_workflow(
        goal="pre-medical preparation",
        level="undergraduate",
        desired_course_count=8,
    )["artifacts"]["program"]

    result = run_cluster_generation_workflow(program)

    assert result["contractVersion"] == CLUSTER_GENERATION_CONTRACT
    assert result["stage"] == "cluster_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["clusterCount"] == len(program["requirementGroups"])
    assert result["metrics"]["courseRequirementCount"] >= 8
    assert all("courseRequirementCount" in cluster for cluster in result["artifacts"]["clusters"])


def test_course_wrapper_generation_workflow_creates_build_tasks() -> None:
    program = run_program_generation_workflow(
        goal="data analyst portfolio pathway",
        level="professional",
        desired_course_count=5,
    )["artifacts"]["program"]

    result = run_course_wrapper_generation_workflow(program)

    assert result["contractVersion"] == COURSE_WRAPPER_GENERATION_CONTRACT
    assert result["stage"] == "course_wrapper_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["wrapperCourseCount"] > 0
    wrapper = result["artifacts"]["wrapperCourses"][0]
    assert wrapper["courseWrapper"]["contractVersion"] == "course-wrapper-v1"
    assert wrapper["activeGenerationPlan"]["contractVersion"] == "active-course-generation-plan-v1"
    assert wrapper["courseBuildTask"]["contractVersion"] == "course-build-task-v1"


def test_course_module_outline_workflow_is_testable_from_source_packet() -> None:
    result = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=2,
        sections_per_module=2,
    )

    assert result["contractVersion"] == COURSE_MODULE_OUTLINE_CONTRACT
    assert result["stage"] == "course_module_outline_generation"
    assert result["status"] == "passed"
    assert result["metrics"] == {
        "moduleCount": 2,
        "sectionOutlineCount": 4,
        "sourceDocumentCount": 1,
    }
    outline = result["artifacts"]["outline"]
    assert outline["contractVersion"] == "course-outline-from-source-packet-v1"
    assert outline["modules"][0]["sections"][0]["sourceIds"] == ["source-motion"]


def test_module_section_plan_workflow_extracts_lesson_plans() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=3,
    )["artifacts"]["outline"]

    result = run_module_section_plan_workflow(outline["modules"][0])

    assert result["contractVersion"] == MODULE_SECTION_PLAN_CONTRACT
    assert result["stage"] == "module_section_plan_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["sectionPlanCount"] == 3
    assert result["artifacts"]["sectionPlans"][0]["contractVersion"] == "section-generation-outline-v1"
    assert result["artifacts"]["sectionPlans"][0]["pageType"] == "learn"


def test_section_fill_workflow_produces_section_with_generation_outline_metadata() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module = outline["modules"][0]
    section_plan = run_module_section_plan_workflow(module)["artifacts"]["sectionPlans"][0]

    result = run_section_fill_workflow(section_plan, module_outline=module)

    assert result["contractVersion"] == SECTION_FILL_CONTRACT
    assert result["stage"] == "section_fill_generation"
    assert result["status"] == "passed"
    section = result["artifacts"]["section"]
    assert section["pageType"] == "learn"
    assert section["metadata"]["generationOutline"]["contractVersion"] == "section-generation-outline-v1"
    assert any(block["type"] == "conceptCard" for block in section["content"])


def test_module_assembly_workflow_adds_summary_and_reports_missing_apply_stage() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module_outline = outline["modules"][0]
    section_plan_result = run_module_section_plan_workflow(module_outline)
    filled_sections = [
        run_section_fill_workflow(section_plan, module_outline=module_outline)["artifacts"]["section"]
        for section_plan in section_plan_result["artifacts"]["sectionPlans"]
    ]

    result = run_module_assembly_workflow(module_outline, filled_sections)

    assert result["contractVersion"] == MODULE_ASSEMBLY_CONTRACT
    assert result["stage"] == "module_assembly"
    assert result["status"] == "needs_review"
    assert result["metrics"]["sectionCount"] == 3
    module = result["artifacts"]["module"]
    assert module["sections"][-1]["sectionType"] == "summary"
    assert module["sections"][-1]["content"][0]["title"] == "Module concepts"
    assert any(issue["message"] == "Module assembly has no apply/practice section yet." for issue in result["issues"])
