from __future__ import annotations

from app.course_build_task_resume import apply_course_build_resume_inputs
from app.course_build_tasks import transition_course_build_task_from_source_packet
from app.course_generation_stage_workflows import (
    CLUSTER_GENERATION_CONTRACT,
    CLUSTER_PLAN_CONTRACT,
    CLUSTER_QUALITY_REPORT_CONTRACT,
    COURSE_MODULE_OUTLINE_CONTRACT,
    COURSE_WRAPPER_GENERATION_CONTRACT,
    COURSE_WRAPPER_QUALITY_REPORT_CONTRACT,
    MODULE_ASSEMBLY_CONTRACT,
    MODULE_SECTION_PLAN_CONTRACT,
    PROGRAM_BRIEF_CONTRACT,
    PROGRAM_GENERATION_CONTRACT,
    SECTION_FILL_CONTRACT,
    STAGE_WORKFLOW_VERSION,
    run_cluster_generation_workflow,
    run_course_module_outline_workflow,
    run_course_wrapper_generation_workflow,
    run_module_assembly_workflow,
    run_module_section_plan_workflow,
    run_program_brief_workflow,
    run_program_generation_workflow,
    run_section_fill_workflow,
)


def _contains_course_materialization_payload(value: object) -> bool:
    if isinstance(value, dict):
        if any(key in value for key in ("courseWrapper", "activeGenerationPlan", "courseBuildTask", "modules", "sections", "content")):
            return True
        return any(_contains_course_materialization_payload(child) for child in value.values())
    if isinstance(value, list):
        return any(_contains_course_materialization_payload(item) for item in value)
    return False


def _source_packet() -> dict:
    return {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "usable",
            "conceptCoverageRatio": 1.0,
            "uncoveredConceptCandidates": [],
        },
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


def _course_shell_from_wrapper(wrapper: dict) -> dict:
    return {
        "title": wrapper["title"],
        "shortDescription": wrapper["description"],
        "metadata": {
            "courseBuildTask": wrapper["courseBuildTask"],
            "courseWrapper": wrapper["courseWrapper"],
            "activeGenerationPlan": wrapper["activeGenerationPlan"],
            "scaffoldCourseId": wrapper["courseId"],
            "clusterId": wrapper["clusterId"],
            "requirementId": wrapper["requirementId"],
        },
    }


def test_program_brief_workflow_returns_testable_intent_artifact() -> None:
    result = run_program_brief_workflow(
        goal="full-stack software developer",
        level="professional",
        desired_course_count=6,
    )

    assert result["workflowVersion"] == STAGE_WORKFLOW_VERSION
    assert result["contractVersion"] == PROGRAM_BRIEF_CONTRACT
    assert result["stage"] == "program_brief"
    assert result["status"] == "passed"
    assert result["metrics"]["learningOutcomeCount"] >= 4
    assert result["metrics"]["broadRequirementGroupCount"] >= 3
    brief = result["artifacts"]["programBrief"]
    assert brief["contractVersion"] == "program-brief-v1"
    assert brief["title"] == "Full-Stack Software Engineer Pathway"
    assert brief["programType"] == "career_path"
    assert brief["field"] == "Software Engineering"
    assert brief["level"] == "professional"
    assert "source-backed" in brief["description"]
    assert "portfolio" in brief["targetOutcome"].lower()
    assert brief["evidence"]["mode"] == "prompt_inferred"
    assert brief["evidence"]["fallbackTemplate"] == "software_engineering"
    assert brief["broadRequirementGroups"]
    assert all("courseId" not in group for group in brief["broadRequirementGroups"])
    assert all("courseWrapper" not in group for group in brief["broadRequirementGroups"])
    assert all("activeGenerationPlan" not in group for group in brief["broadRequirementGroups"])


def test_program_brief_workflow_uses_benchmark_requirement_signals() -> None:
    benchmark_context = {
        "curriculumBenchmarks": [{"id": "bm-data", "title": "Data analytics curriculum"}],
        "sourceSlots": [{"conceptId": "statistics", "primarySourceId": "source-statistics"}],
        "requirementOrigins": [
            {
                "requirementId": "req-statistics",
                "title": "Statistics and Probability",
                "importance": "required",
                "score": 0.95,
                "evidenceRefs": ["source-statistics"],
            },
            {
                "requirementId": "req-python",
                "title": "Python Data Workflows",
                "importance": "required",
                "score": 0.9,
                "evidenceRefs": ["source-python"],
            },
            {
                "requirementId": "req-portfolio",
                "title": "Analytics Portfolio Project",
                "importance": "recommended",
                "score": 0.8,
                "evidenceRefs": ["source-portfolio"],
            },
        ],
    }

    result = run_program_brief_workflow(
        goal="data analyst portfolio pathway",
        level="professional",
        desired_course_count=5,
        benchmark_context=benchmark_context,
    )

    brief = result["artifacts"]["programBrief"]

    assert result["status"] == "passed"
    assert brief["field"] == "Data Science"
    assert brief["evidence"]["mode"] == "benchmark_informed"
    assert brief["evidence"]["curriculumBenchmarkCount"] == 1
    assert brief["evidence"]["requirementOriginCount"] == 3
    assert brief["evidence"]["sourceSlotCount"] == 1
    assert brief["evidence"]["fallbackTemplate"] is None
    assert any(
        "statistics" in topic.lower() and "probability" in topic.lower()
        for group in brief["broadRequirementGroups"]
        for topic in group["sampleTopics"]
    )


def test_program_brief_workflow_blocks_empty_goal() -> None:
    result = run_program_brief_workflow(goal="   ", level="professional")

    assert result["status"] == "failed"
    assert any(issue["location"] == "goal" for issue in result["issues"])


def test_program_generation_workflow_returns_testable_program_contract() -> None:
    brief_result = run_program_brief_workflow(
        goal="full-stack software developer",
        level="professional",
        desired_course_count=6,
    )
    result = run_program_generation_workflow(
        goal="full-stack software developer",
        level="professional",
        desired_course_count=6,
        program_brief=brief_result["artifacts"]["programBrief"],
    )

    assert result["workflowVersion"] == STAGE_WORKFLOW_VERSION
    assert result["contractVersion"] == PROGRAM_GENERATION_CONTRACT
    assert result["stage"] == "program_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["requirementGroupCount"] >= 3
    assert result["metrics"]["courseRequirementCount"] >= 6
    assert result["artifacts"]["program"]["requirementGroups"]
    assert result["artifacts"]["programBrief"] == brief_result["artifacts"]["programBrief"]
    assert result["artifacts"]["program"]["title"] == result["artifacts"]["programBrief"]["title"]
    assert result["artifacts"]["program"]["targetOutcome"] == result["artifacts"]["programBrief"]["targetOutcome"]
    assert result["artifacts"]["programSynthesis"]["programBrief"] == result["artifacts"]["programBrief"]
    assert result["artifacts"]["programSynthesis"]["courseScaffoldPlan"]["workflowContracts"]["programBrief"] == "program-brief-workflow-v1"
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
    assert result["metrics"]["clusterCourseKindCount"] >= 8
    assert result["metrics"]["programCandidateClusterCount"] >= 2
    assert result["artifacts"]["assemblyThresholdPolicy"]["thresholds"]["clusterFromCourses"] == {
        "memberType": "course",
        "minimumRequired": 3,
        "recommendedMinimum": 4,
    }
    assert result["artifacts"]["programAssemblyReadiness"]["minimumRequired"] == 2
    assert result["artifacts"]["programAssemblyReadiness"]["recommendedMinimum"] == 3
    assert result["artifacts"]["programAssemblyReadiness"]["canGenerate"] is True
    assert all("courseRequirementCount" in cluster for cluster in result["artifacts"]["clusters"])
    course_clusters = [cluster for cluster in result["artifacts"]["clusters"] if cluster["courseKinds"]]
    assert course_clusters
    assert course_clusters[0]["assemblyReadiness"]["minimumRequired"] == 3
    assert course_clusters[0]["assemblyReadiness"]["recommendedMinimum"] == 4
    first_kind = course_clusters[0]["courseKinds"][0]
    assert first_kind["contractVersion"] == "cluster-course-kind-v1"
    assert first_kind["title"]
    assert first_kind["description"]
    assert "courseWrapper" not in first_kind
    assert "activeGenerationPlan" not in first_kind


def test_cluster_generation_workflow_scores_quality_without_materializing_courses() -> None:
    program = run_program_generation_workflow(
        goal="pre-medical preparation",
        level="undergraduate",
        desired_course_count=8,
    )["artifacts"]["program"]

    result = run_cluster_generation_workflow(program)

    quality = result["artifacts"]["clusterQualityReport"]
    clusters = result["artifacts"]["clusters"]
    course_clusters = [cluster for cluster in clusters if cluster["qualityProfile"]["courseBearing"]]

    assert result["status"] == "passed"
    assert quality["contractVersion"] == CLUSTER_QUALITY_REPORT_CONTRACT
    assert quality["passed"] is True
    assert quality["courseBearingClusterCount"] >= 2
    assert quality["courseKindCount"] >= 8
    assert quality["requiredConceptCount"] >= 8
    assert quality["policy"] == {
        "materializesCourses": False,
        "materializesCourseWrappers": False,
        "courseWrappersCreatedBy": COURSE_WRAPPER_GENERATION_CONTRACT,
    }
    assert course_clusters
    assert any(cluster["dependencyProfile"]["unlocksClusterIds"] for cluster in course_clusters)

    for cluster in clusters:
        assert cluster["contractVersion"] == CLUSTER_PLAN_CONTRACT
        assert cluster["policy"]["materializesCourses"] is False
        assert cluster["policy"]["materializesCourseWrappers"] is False
        assert cluster["dependencyProfile"]["contractVersion"] == "cluster-dependency-profile-v1"
        assert not _contains_course_materialization_payload(cluster)
        if not cluster["qualityProfile"]["courseBearing"]:
            continue
        assert cluster["qualityProfile"]["status"] == "passed"
        assert cluster["qualityProfile"]["titleReady"] is True
        assert cluster["qualityProfile"]["scopeReady"] is True
        assert cluster["qualityProfile"]["learningOutcomeCount"] >= 2
        assert cluster["requiredConcepts"]
        for course_kind in cluster["courseKinds"]:
            assert course_kind["contractVersion"] == "cluster-course-kind-v1"
            assert course_kind["planningRole"] == "abstract_course_kind"
            assert course_kind["sourceStatus"] == "needs_sources"
            assert course_kind["title"]
            assert course_kind["description"]
            assert course_kind["requiredConcepts"]
            assert "courseWrapper" not in course_kind
            assert "activeGenerationPlan" not in course_kind


def test_cluster_generation_workflow_blocks_missing_cluster_titles() -> None:
    result = run_cluster_generation_workflow(
        {
            "requirementGroups": [
                {
                    "id": "group-untitled",
                    "title": "",
                    "displayName": "",
                    "description": "",
                    "purpose": "",
                    "groupKind": "cluster",
                    "clusterType": "core",
                    "learningOutcomes": [],
                    "requirements": [
                        {
                            "id": "req-python",
                            "type": "complete_course",
                            "title": "Python Foundations",
                            "description": "Complete a course covering Python foundations.",
                            "courseId": "python-foundations",
                            "estimatedHours": 20,
                        }
                    ],
                    "completionRule": {"type": "complete_all"},
                }
            ],
            "dependencyGraph": {"edges": []},
        }
    )

    cluster = result["artifacts"]["clusters"][0]

    assert result["status"] == "failed"
    assert result["artifacts"]["clusterQualityReport"]["passed"] is False
    assert cluster["title"] == "Cluster 1"
    assert cluster["qualityProfile"]["status"] == "needs_review"
    assert "missing_cluster_title" in cluster["qualityProfile"]["reviewReasons"]
    assert any(issue["location"] == "clusters[1].title" for issue in result["issues"])


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
    plan = result["artifacts"]["courseScaffoldPlan"]
    wrappers = result["artifacts"]["wrapperCourses"]
    wrapper = result["artifacts"]["wrapperCourses"][0]
    scaffold_cluster = plan["clusters"][0]
    scaffold_kind = scaffold_cluster["courseKinds"][0]
    task_report = plan["courseBuildTaskReport"]
    quality_report = result["artifacts"]["courseWrapperQualityReport"]
    action_plan = plan["courseShellActionPlan"]
    source_acquisition = plan["sourceAcquisitionPlan"]
    assert plan["generationPolicy"]["assemblyThresholds"]["programFromClusters"] == {
        "memberType": "cluster",
        "minimumRequired": 2,
        "recommendedMinimum": 3,
    }
    assert plan["programAssemblyReadiness"]["minimumRequired"] == 2
    assert scaffold_cluster["assemblyReadiness"]["minimumRequired"] == 3
    assert scaffold_kind["contractVersion"] == "cluster-course-kind-v1"
    assert scaffold_kind["title"]
    assert scaffold_kind["description"]
    assert scaffold_kind["action"] == "create_empty_course"
    assert scaffold_kind["status"] == "empty_course_shell"
    assert scaffold_kind["sourceStatus"] == "needs_sources"
    assert "courseWrapper" not in scaffold_kind
    assert wrapper["courseWrapper"]["contractVersion"] == "course-wrapper-v1"
    assert wrapper["activeGenerationPlan"]["contractVersion"] == "active-course-generation-plan-v1"
    assert wrapper["courseBuildTask"]["contractVersion"] == "course-build-task-v1"
    assert plan["courseWrapperQualityReport"] == quality_report
    assert quality_report["contractVersion"] == COURSE_WRAPPER_QUALITY_REPORT_CONTRACT
    assert quality_report["passed"] is True
    assert quality_report["wrapperCourseCount"] == len(wrappers)
    assert quality_report["sourceRequestCount"] == len(wrappers)
    assert quality_report["activeGenerationPlanCount"] == len(wrappers)
    assert quality_report["courseBuildTaskCount"] == len(wrappers)
    assert quality_report["materializedContentCourseCount"] == 0
    assert quality_report["policy"] == {
        "wrapperStatus": "wrapper",
        "placeholderText": "Section not yet generated",
        "nextWorkflow": "active-course-generation-plan-v1",
        "requiresSourcePacketBeforeOutline": True,
        "materializesLearnerContent": False,
    }
    assert task_report["status"] == "needs_sources"
    assert task_report["missingCourseBuildTaskCount"] == 0
    assert task_report["sourcePacketRequiredCount"] == len(wrappers)
    assert action_plan["status"] == "needs_sources"
    assert action_plan["actionCounts"]["attach_source_packet"] == len(wrappers)
    assert action_plan["sourceRequestCount"] == len(wrappers)
    assert source_acquisition["status"] == "needs_sources"
    assert source_acquisition["sourceRequestCount"] == len(wrappers)
    assert source_acquisition["sourceIndexSearchPlan"]["searchTaskCount"] >= len(wrappers)

    for row in wrappers:
        course_wrapper = row["courseWrapper"]
        active_plan = row["activeGenerationPlan"]
        build_task = row["courseBuildTask"]
        source_request = row["sourceRequest"]
        quality_profile = next(profile for profile in quality_report["profiles"] if profile["courseId"] == row["courseId"])
        assert "modules" not in row
        assert "sections" not in row
        assert "content" not in row
        assert quality_profile["contractVersion"] == "course-wrapper-quality-profile-v1"
        assert quality_profile["passed"] is True
        assert quality_profile["sourceRequestReady"] is True
        assert quality_profile["activeGenerationPlanReady"] is True
        assert quality_profile["courseBuildTaskReady"] is True
        assert quality_profile["materializesContent"] is False
        assert course_wrapper["status"] == "wrapper"
        assert course_wrapper["generationMode"] == "active_generation"
        assert "editor-native" in course_wrapper["generationPrompt"]
        assert "source-backed course" in course_wrapper["generationPrompt"]
        assert "source packet" in course_wrapper["generationPrompt"]
        assert course_wrapper["learnerPlaceholderText"] == "Section not yet generated"
        assert active_plan["status"] == "needs_sources"
        assert active_plan["mode"] == "on_demand_module_batches"
        assert active_plan["plannedModuleCount"] >= 4
        assert active_plan["batches"]
        assert build_task["status"] == "source_gathering"
        assert build_task["currentStage"] == "source_gathering"
        assert build_task["nextAction"] == "attach_source_packet"
        assert {"source_packet", "concept_source_coverage"}.issubset(set(build_task["requiredInputs"]))
        assert source_request["contractVersion"] == "course-source-request-v1"
        assert source_request["requiredConcepts"]
        assert source_request["suggestedQueries"]


def test_course_wrapper_generation_workflow_blocks_incomplete_wrapper_handoff() -> None:
    result = run_course_wrapper_generation_workflow(
        {"requirementGroups": []},
        course_scaffold_plan={
            "version": "program-course-scaffold-plan-v1",
            "clusters": [],
            "courses": [
                {
                    "clusterId": "cluster-broken",
                    "requirementId": "req-broken",
                    "courseId": "broken-course",
                    "title": "Broken Course",
                    "action": "create_empty_course",
                    "status": "needs_course_buildout",
                    "courseBuildTask": {
                        "contractVersion": "course-build-task-v1",
                        "courseId": "broken-course",
                        "title": "Broken Course",
                        "status": "source_gathering",
                        "currentStage": "source_gathering",
                        "nextAction": "attach_source_packet",
                        "requiredInputs": ["source_packet"],
                    },
                }
            ],
        },
    )

    quality = result["artifacts"]["courseWrapperQualityReport"]
    profile = quality["failedProfiles"][0]

    assert result["status"] == "failed"
    assert quality["passed"] is False
    assert quality["failedCourseCount"] == 1
    assert profile["courseId"] == "broken-course"
    assert "missing_source_request" in profile["reasons"]
    assert "missing_course_wrapper" in profile["reasons"]
    assert "missing_active_generation_plan" in profile["reasons"]
    assert "course_build_task_required_inputs_invalid" in profile["reasons"]
    assert any(issue["location"] == "courseWrapperQualityReport.failedProfiles" for issue in result["issues"])


def test_course_wrapper_source_packet_transition_enables_module_outline_generation() -> None:
    program = run_program_generation_workflow(
        goal="data analyst portfolio pathway",
        level="professional",
        desired_course_count=5,
    )["artifacts"]["program"]
    wrapper_result = run_course_wrapper_generation_workflow(program)
    wrapper = wrapper_result["artifacts"]["wrapperCourses"][0]
    source_packet = _source_packet()

    transitioned_task = transition_course_build_task_from_source_packet(
        wrapper["courseBuildTask"],
        source_packet=source_packet,
    )
    outline_result = run_course_module_outline_workflow(
        prompt=wrapper["title"],
        source_packet=source_packet,
        desired_module_count=2,
        sections_per_module=2,
    )

    assert transitioned_task["status"] == "outline_ready"
    assert transitioned_task["currentStage"] == "outline_ready"
    assert transitioned_task["nextAction"] == "generate_course_outline"
    assert transitioned_task["requiredInputs"] == ["course_outline"]
    assert transitioned_task["sourcePacketTransitionReport"]["passed"] is True
    assert outline_result["status"] == "passed"
    assert outline_result["metrics"]["moduleCount"] == 2
    assert outline_result["metrics"]["sectionOutlineCount"] == 4
    outline = outline_result["artifacts"]["outline"]
    assert outline["contractVersion"] == "course-outline-from-source-packet-v1"
    assert outline["provenance"]["mode"] == "source_packet"
    assert all(module["planningSource"] == "source_packet" for module in outline["modules"])


def test_course_wrapper_resume_inputs_advance_to_section_generation_ready() -> None:
    program = run_program_generation_workflow(
        goal="data analyst portfolio pathway",
        level="professional",
        desired_course_count=5,
    )["artifacts"]["program"]
    wrapper = run_course_wrapper_generation_workflow(program)["artifacts"]["wrapperCourses"][0]

    resumed = apply_course_build_resume_inputs(
        _course_shell_from_wrapper(wrapper),
        prompt=wrapper["courseWrapper"]["generationPrompt"],
        source_packet=_source_packet(),
        desired_module_count=2,
    )

    metadata = resumed["metadata"]
    task = metadata["courseBuildTask"]
    trace = metadata["courseBuildResumeTrace"]
    report = metadata["courseBuildResumeReport"]
    outline = metadata["courseBuildOutline"]

    assert task["status"] == "section_generation_ready"
    assert task["currentStage"] == "section_generation_ready"
    assert task["nextAction"] == "generate_course_sections"
    assert task["requiredInputs"] == ["section_generation"]
    assert task["sourcePacketTransitionReport"]["passed"] is True
    assert task["outlineTransitionReport"]["passed"] is True
    assert task["outlineTransitionReport"]["metrics"]["moduleCount"] == 2
    assert task["outlineTransitionReport"]["metrics"]["sectionCount"] == 4
    assert outline["contractVersion"] == "course-outline-from-source-packet-v1"
    assert len(outline["modules"]) == 2
    assert metadata["courseWrapper"]["contractVersion"] == "course-wrapper-v1"
    assert metadata["activeGenerationPlan"]["contractVersion"] == "active-course-generation-plan-v1"
    assert [row["inputType"] for row in trace] == ["source_packet", "outline"]
    assert [row["transitionStatus"] for row in trace] == ["advanced", "advanced"]
    assert trace[0]["fromStatus"] == "source_gathering"
    assert trace[0]["toStatus"] == "outline_ready"
    assert trace[1]["fromStatus"] == "outline_ready"
    assert trace[1]["toStatus"] == "section_generation_ready"
    assert report["status"] == "section_generation_ready"
    assert report["advancedTransitionCount"] == 2
    assert report["blockedTransitionCount"] == 0
    assert report["latestInputType"] == "outline"

    first_module_plan = run_module_section_plan_workflow(outline["modules"][0])
    assert first_module_plan["status"] == "passed"
    assert first_module_plan["metrics"]["sectionPlanCount"] == 2
    assert first_module_plan["artifacts"]["sectionPlans"][0]["sourceIds"] == ["source-motion"]


def test_course_wrapper_resume_inputs_preserve_explicit_outline() -> None:
    program = run_program_generation_workflow(
        goal="data analyst portfolio pathway",
        level="professional",
        desired_course_count=5,
    )["artifacts"]["program"]
    wrapper = run_course_wrapper_generation_workflow(program)["artifacts"]["wrapperCourses"][0]
    outline = run_course_module_outline_workflow(
        prompt=wrapper["courseWrapper"]["generationPrompt"],
        source_packet=_source_packet(),
        desired_module_count=2,
        sections_per_module=2,
    )["artifacts"]["outline"]
    shell = _course_shell_from_wrapper(wrapper)
    shell["metadata"]["courseBuildTask"] = transition_course_build_task_from_source_packet(
        shell["metadata"]["courseBuildTask"],
        source_packet=_source_packet(),
    )

    resumed = apply_course_build_resume_inputs(shell, outline=outline)

    assert resumed["metadata"]["courseBuildTask"]["status"] == "section_generation_ready"
    assert resumed["metadata"]["courseBuildOutline"] == outline
    assert resumed["metadata"]["courseBuildResumeReport"]["latestInputType"] == "outline"


def test_course_wrapper_resume_inputs_block_weak_outline_with_report() -> None:
    program = run_program_generation_workflow(
        goal="data analyst portfolio pathway",
        level="professional",
        desired_course_count=5,
    )["artifacts"]["program"]
    wrapper = run_course_wrapper_generation_workflow(program)["artifacts"]["wrapperCourses"][0]
    shell = _course_shell_from_wrapper(wrapper)
    shell["metadata"]["courseBuildTask"] = transition_course_build_task_from_source_packet(
        shell["metadata"]["courseBuildTask"],
        source_packet=_source_packet(),
    )
    weak_outline = {
        "contractVersion": "course-outline-from-source-packet-v1",
        "modules": [
            {
                "id": "thin-module",
                "title": "",
                "sections": [{"id": "thin-section", "title": "Only a title"}],
            }
        ],
    }

    resumed = apply_course_build_resume_inputs(shell, outline=weak_outline)
    task = resumed["metadata"]["courseBuildTask"]
    report = task["outlineTransitionReport"]
    resume_report = resumed["metadata"]["courseBuildResumeReport"]

    assert task["status"] == "outline_ready"
    assert task["currentStage"] == "outline_ready"
    assert task["nextAction"] == "revise_course_outline"
    assert task["requiredInputs"] == ["course_outline"]
    assert report["passed"] is False
    assert report["status"] == "blocked"
    assert report["metrics"]["moduleCount"] == 1
    assert report["metrics"]["sectionCount"] == 1
    assert "module_title_missing" in report["reasons"]
    assert "section_count_below_policy" in report["reasons"]
    assert "section_objectives_missing" in report["reasons"]
    assert "section_concepts_missing" in report["reasons"]
    assert resume_report["status"] == "blocked"
    assert resume_report["blockedTransitionCount"] == 1
    assert resume_report["latestInputType"] == "outline"


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
