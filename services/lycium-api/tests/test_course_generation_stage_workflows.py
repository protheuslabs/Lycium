from __future__ import annotations

from app.course_build_task_resume import apply_course_build_resume_inputs
from app.course_build_tasks import transition_course_build_task_from_source_packet
from app.course_outline_from_source_packet import build_outline_from_source_packet
from app.course_generation_stage_workflows import (
    CLUSTER_GENERATION_CONTRACT,
    CLUSTER_PLAN_CONTRACT,
    CLUSTER_QUALITY_REPORT_CONTRACT,
    COURSE_MODULE_OUTLINE_CONTRACT,
    COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT,
    COURSE_TEMPLATE_ARTIFACT_CONTRACT,
    COURSE_TEMPLATE_CONTRACT,
    COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT,
    COURSE_WRAPPER_GENERATION_CONTRACT,
    COURSE_WRAPPER_QUALITY_REPORT_CONTRACT,
    MODULE_ASSESSMENT_PLAN_CONTRACT,
    MODULE_APPLY_SECTION_CONTRACT,
    MODULE_ASSEMBLY_CONTRACT,
    MODULE_PROJECT_ASSESSMENT_CONTRACT,
    MODULE_QUIZ_ASSESSMENT_CONTRACT,
    MODULE_SECTION_PLAN_CONTRACT,
    MODULE_SUMMARY_SECTION_CONTRACT,
    PROGRAM_BRIEF_CONTRACT,
    PROGRAM_GENERATION_CONTRACT,
    SECTION_FILL_CONTRACT,
    STAGE_WORKFLOW_VERSION,
    run_cluster_generation_workflow,
    run_course_module_outline_workflow,
    run_course_template_workflow,
    run_course_wrapper_generation_workflow,
    run_module_assessment_plan_workflow,
    run_module_apply_section_workflow,
    run_module_assembly_workflow,
    run_module_project_assessment_workflow,
    run_module_quiz_assessment_workflow,
    run_module_section_plan_workflow,
    run_module_summary_section_workflow,
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


def test_course_template_workflow_returns_first_stage_handoff() -> None:
    result = run_course_template_workflow(
        prompt=(
            "Create a macroeconomics principles course covering economic measurement, gross domestic product, "
            "inflation, unemployment, aggregate demand, and monetary policy."
        ),
        level="undergrad",
        target_audience="first-year college learners",
        desired_module_count=6,
        expected_duration_minutes=1200,
        source_packet={
            "contract_version": "source-packet-v1",
            "quality": {"status": "usable", "conceptCoverageRatio": 1.0},
            "sources": [
                {"source_public_id": "source-openstax-macro", "title": "OpenStax Macroeconomics"},
                {"source_public_id": "source-bea-gdp", "title": "BEA GDP"},
            ],
        },
        category="business-management",
        department="economics",
    )

    assert result["workflowVersion"] == STAGE_WORKFLOW_VERSION
    assert result["contractVersion"] == COURSE_TEMPLATE_CONTRACT
    assert result["stage"] == "course_template_generation"
    assert result["status"] == "passed"
    template = result["artifacts"]["courseTemplate"]
    quality = result["artifacts"]["courseTemplateQualityReport"]
    required_items = template["courseCoverageChecklist"]["requiredItems"]

    assert template["contractVersion"] == COURSE_TEMPLATE_ARTIFACT_CONTRACT
    assert template["title"] == "Macroeconomics Principles Course"
    assert template["category"] == "business-management"
    assert template["department"] == "economics"
    assert template["sourceIds"] == ["source-openstax-macro", "source-bea-gdp"]
    assert template["scope"]["audience"] == "first-year college learners"
    assert template["scope"]["level"] == "undergrad"
    assert template["scope"]["evidenceMode"] == "source_packet"
    assert len(template["learningOutcomes"]) >= 3
    assert template["handoff"]["nextWorkflow"] == COURSE_MODULE_OUTLINE_CONTRACT
    assert template["handoff"]["desiredModuleCount"] == 6
    assert template["handoff"]["coverageChecklistContract"] == "course-coverage-checklist-v1"
    assert template["handoff"]["requiredCoverageItemIds"] == [item["id"] for item in required_items]
    assert {item["title"] for item in required_items} >= {
        "Economic Measurement",
        "Gross Domestic Product",
        "Inflation",
        "Unemployment",
        "Aggregate Demand",
        "Monetary Policy",
    }
    assert all(item["mustTeach"] for item in required_items)
    assert all(item["sectionPlans"] for item in required_items)
    assert "modules" not in template
    assert not _contains_course_materialization_payload(template)
    assert quality["contractVersion"] == COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT
    assert quality["passed"] is True
    assert quality["metrics"]["requiredCoverageItemCount"] == len(required_items)
    assert quality["policy"]["materializesLearnerContent"] is False


def test_course_template_workflow_blocks_empty_prompt_but_keeps_handoff_shape() -> None:
    result = run_course_template_workflow(prompt="   ", desired_module_count=3)

    assert result["contractVersion"] == COURSE_TEMPLATE_CONTRACT
    assert result["status"] == "failed"
    template = result["artifacts"]["courseTemplate"]
    quality = result["artifacts"]["courseTemplateQualityReport"]

    assert template["contractVersion"] == COURSE_TEMPLATE_ARTIFACT_CONTRACT
    assert template["handoff"]["nextWorkflow"] == COURSE_MODULE_OUTLINE_CONTRACT
    assert quality["passed"] is False
    assert "Course template needs a resolved course title." in quality["reasons"]
    assert "modules" not in template
    assert not _contains_course_materialization_payload(template)


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
    assert outline_result["metrics"]["embeddedSectionOutlineCount"] == 0
    outline = outline_result["artifacts"]["outline"]
    assert outline["contractVersion"] == "course-outline-from-source-packet-v1"
    assert outline["provenance"]["mode"] == "source_packet"
    assert all(module["planningSource"] == "source_packet" for module in outline["modules"])
    assert all("sections" not in module for module in outline["modules"])
    assert all(module["targetSectionCount"] == 2 for module in outline["modules"])


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
    outline = build_outline_from_source_packet(
        prompt=wrapper["courseWrapper"]["generationPrompt"],
        source_packet=_source_packet(),
        desired_module_count=2,
        sections_per_module=2,
    )
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
    assert result["metrics"]["moduleCount"] == 2
    assert result["metrics"]["sectionOutlineCount"] == 0
    assert result["metrics"]["embeddedSectionOutlineCount"] == 0
    assert result["metrics"]["sourceDocumentCount"] == 1
    assert result["metrics"]["outlineQualityStatus"] == "passed"
    assert result["metrics"]["outlineQualityReasonCount"] == 0
    assert result["metrics"]["sourceMappedModuleCount"] == 2
    assert result["metrics"]["sourceMappedSectionCount"] == 0
    outline = result["artifacts"]["outline"]
    quality = result["artifacts"]["outlineQualityReport"]
    assert outline["contractVersion"] == "course-outline-from-source-packet-v1"
    assert outline["modules"][0]["sourceIds"] == ["source-motion"]
    assert outline["modules"][0]["targetSectionCount"] == 2
    assert "sections" not in outline["modules"][0]
    assert quality["contractVersion"] == COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT
    assert quality["passed"] is True
    assert quality["metrics"]["sourcePacketContractVersion"] == "source-packet-v1"
    assert quality["metrics"]["sourcePacketQualityStatus"] == "usable"
    assert quality["metrics"]["sourceMappedModuleCount"] == 2
    assert quality["metrics"]["sourceMappedSectionCount"] == 0
    assert quality["metrics"]["objectiveModuleCount"] == 2
    assert quality["metrics"]["conceptModuleCount"] == 2
    assert quality["metrics"]["materializedContentPayloadCount"] == 0
    assert quality["policy"] == {
        "materializesLearnerContent": False,
        "requiresSourcePacketWhenProvided": True,
        "createsSectionPlans": False,
        "sectionPlansCreatedBy": "module-section-plan-workflow-v1",
        "requiresModuleObjectives": True,
        "requiresModuleConcepts": True,
        "requiresSourceMappingWhenSourcePacketProvided": True,
    }
    assert all(module["status"] == "passed" for module in quality["moduleProfiles"])


def test_course_module_outline_workflow_blocks_weak_source_packet() -> None:
    weak_packet = {
        "contract_version": "source-packet-v1",
        "quality": {
            "status": "blocked",
            "conceptCoverageRatio": 0.25,
            "uncoveredConceptCandidates": ["momentum", "energy"],
        },
        "source_documents": [
            {
                "courseSourceId": "source-thin",
                "title": "Thin mechanics notes",
                "text": "Velocity definition only.",
            }
        ],
    }

    result = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=weak_packet,
        desired_module_count=2,
        sections_per_module=2,
    )

    quality = result["artifacts"]["outlineQualityReport"]

    assert result["status"] == "failed"
    assert quality["passed"] is False
    assert "source_packet_not_usable" in quality["reasons"]
    assert "source_packet_concept_coverage_below_policy" in quality["reasons"]
    assert any(issue["location"] == "outlineQualityReport.reasons" for issue in result["issues"])


def test_course_module_outline_workflow_blocks_materialized_or_thin_outlines() -> None:
    outline = {
        "contractVersion": "course-outline-from-source-packet-v1",
        "modules": [
            {
                "id": "module-1",
                "title": "",
                "sections": [
                    {
                        "id": "section-1",
                        "title": "Only a title",
                        "content": [{"type": "text", "value": "This is already lesson content."}],
                    }
                ],
            }
        ],
    }

    result = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=2,
        sections_per_module=2,
        outline=outline,
    )

    quality = result["artifacts"]["outlineQualityReport"]

    assert result["status"] == "failed"
    assert quality["passed"] is False
    assert "module_1_module_title_missing" in quality["reasons"]
    assert "module_1_module_objectives_missing" in quality["reasons"]
    assert "module_1_module_concepts_missing" in quality["reasons"]
    assert "module_1_module_source_ids_missing" in quality["reasons"]
    assert "module_1_materialized_content_payload_present" in quality["reasons"]
    assert "module_1_section_1_section_objectives_missing" in quality["reasons"]
    assert "module_1_section_1_section_concepts_missing" in quality["reasons"]
    assert "module_1_section_1_section_source_ids_missing" in quality["reasons"]


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
    assert result["metrics"]["targetSectionCount"] == 3
    assert result["metrics"]["generatedFromModuleOutline"] is True
    assert result["metrics"]["plannedSectionCount"] == 3
    assert result["artifacts"]["sectionPlans"][0]["contractVersion"] == "section-generation-outline-v1"
    assert result["artifacts"]["sectionPlans"][0]["pageType"] == "learn"
    assert result["artifacts"]["sectionPlans"][0]["description"]
    assert result["artifacts"]["sectionPlans"][0]["sourceIds"] == ["source-motion"]
    assert result["artifacts"]["sectionPlans"][0]["conceptKeywords"]
    assert result["artifacts"]["sectionPlans"][0]["learningObjectives"]
    assert result["artifacts"]["plannedModule"]["sections"] == result["artifacts"]["plannedSections"]
    assert result["artifacts"]["plannedCourse"]["modules"][0] == result["artifacts"]["plannedModule"]
    assert result["artifacts"]["plannedSections"][0]["content"] == []
    assert result["artifacts"]["plannedSections"][0]["sourceIds"] == []
    assert result["artifacts"]["plannedSections"][0]["description"] == result["artifacts"]["sectionPlans"][0]["description"]
    assert (
        result["artifacts"]["plannedSections"][0]["metadata"]["generationOutline"]["plannedDescription"]
        == result["artifacts"]["sectionPlans"][0]["description"]
    )
    assert result["artifacts"]["plannedSections"][0]["metadata"]["generationOutline"]["candidateSourceIds"] == ["source-motion"]
    assert result["artifacts"]["plannedSections"][0]["metadata"]["generationOutline"]["contentStatus"] == "planned_empty"


def test_module_section_plan_workflow_expands_module_only_outline_without_content() -> None:
    module_outline = {
        "id": "module-data-pipelines",
        "title": "Module 1: Data Pipelines",
        "targetSectionCount": 4,
        "learning_objectives": ["Design a resilient source-backed data pipeline."],
        "concept_keywords": [
            "batch ingestion",
            "schema validation",
            "pipeline monitoring",
            "retry strategy",
        ],
        "sourceIds": ["source-pipeline", "source-ops"],
        "planningSource": "source_packet",
    }

    result = run_module_section_plan_workflow(
        module_outline,
        course={"title": "Data Engineering Course", "modules": [module_outline]},
    )
    section_plans = result["artifacts"]["sectionPlans"]

    assert result["status"] == "passed"
    assert result["metrics"]["sectionPlanCount"] == 4
    assert result["metrics"]["generatedFromModuleOutline"] is True
    assert result["metrics"]["plannedSectionCount"] == 4
    assert [plan["title"] for plan in section_plans] == [
        "Batch Ingestion Foundations",
        "Schema Validation Applied Practice",
        "Pipeline Monitoring Extension 3",
        "Retry Strategy Extension 4",
    ]
    assert len({plan["title"] for plan in section_plans}) == 4
    assert all(plan["description"].startswith("Planning reference for content generation") for plan in section_plans)
    assert all(plan["sourceIds"] == ["source-pipeline", "source-ops"] for plan in section_plans)
    assert all(plan["conceptKeywords"] for plan in section_plans)
    assert all(plan["learningObjectives"] for plan in section_plans)
    assert all(
        not {"content", "blocks", "body", "markdown", "html"}.intersection(plan)
        for plan in section_plans
    )
    assert result["artifacts"]["plannedModule"]["sections"]
    assert all(section["content"] == [] for section in result["artifacts"]["plannedModule"]["sections"])
    assert all(section["description"] for section in result["artifacts"]["plannedModule"]["sections"])
    assert result["artifacts"]["plannedCourse"]["title"] == "Data Engineering Course"
    assert result["artifacts"]["plannedCourse"]["modules"][0]["sections"] == result["artifacts"]["plannedSections"]


def test_module_section_plan_workflow_respects_desired_count_override() -> None:
    module_outline = {
        "id": "module-risk",
        "title": "Module 1: Risk Controls",
        "targetSectionCount": 5,
        "learning_objectives": ["Explain practical risk controls."],
        "concept_keywords": ["risk register", "mitigation plan", "control review"],
        "sourceIds": ["source-risk"],
    }

    result = run_module_section_plan_workflow(module_outline, desired_section_count=2)

    assert result["status"] == "passed"
    assert result["metrics"]["sectionPlanCount"] == 2
    assert result["metrics"]["targetSectionCount"] == 2
    assert [plan["id"] for plan in result["artifacts"]["sectionPlans"]] == [
        "module-risk-section-1",
        "module-risk-section-2",
    ]


def test_module_section_plan_workflow_blocks_duplicate_embedded_lesson_titles() -> None:
    module_outline = {
        "id": "module-duplicates",
        "title": "Module 1: Duplicate Lessons",
        "sourceIds": ["source-1"],
        "sections": [
            {
                "id": "section-1",
                "title": "Repeated Lesson",
                "learning_objectives": ["Explain the first target."],
                "concept_keywords": ["first target"],
                "sourceIds": ["source-1"],
            },
            {
                "id": "section-2",
                "title": "Repeated Lesson",
                "learning_objectives": ["Explain the second target."],
                "concept_keywords": ["second target"],
                "sourceIds": ["source-1"],
            },
        ],
    }

    result = run_module_section_plan_workflow(module_outline)

    assert result["status"] == "failed"
    assert result["metrics"]["generatedFromModuleOutline"] is False
    assert any(issue["location"] == "sections[].title" for issue in result["issues"])


def test_module_section_plan_workflow_blocks_thin_embedded_lesson_plans() -> None:
    module_outline = {
        "id": "module-thin",
        "title": "Module 1: Thin Lessons",
        "sourceIds": ["source-1"],
        "sections": [{"id": "section-1", "title": "Only a title"}],
    }

    result = run_module_section_plan_workflow(module_outline)

    assert result["status"] == "failed"
    assert any(issue["location"] == "sectionPlans[1].learningObjectives" for issue in result["issues"])
    assert any(issue["location"] == "sectionPlans[1].conceptKeywords" for issue in result["issues"])


def test_section_fill_workflow_produces_section_with_generation_outline_metadata() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module = outline["modules"][0]
    section_plan_result = run_module_section_plan_workflow(module)
    section_plan = section_plan_result["artifacts"]["sectionPlans"][0]
    planned_section = section_plan_result["artifacts"]["plannedSections"][0]

    result = run_section_fill_workflow(
        section_plan,
        planned_section=planned_section,
        module_outline=section_plan_result["artifacts"]["plannedModule"],
    )

    assert result["contractVersion"] == SECTION_FILL_CONTRACT
    assert result["stage"] == "section_fill_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["replacedPlannedEmptySection"] is True
    assert planned_section["content"] == []
    section = result["artifacts"]["section"]
    assert section["id"] == planned_section["id"]
    assert section["title"] == planned_section["title"]
    assert section["pageType"] == "learn"
    assert "description" not in section
    assert section["content"]
    assert section["metadata"]["generationOutline"]["contractVersion"] == "section-generation-outline-v1"
    assert section["metadata"]["generationOutline"]["plannedDescription"] == section_plan["description"]
    worked_example = next(block for block in section["content"] if block["type"] == "workedExample")
    assert worked_example["problem"]
    assert worked_example["given"]
    assert worked_example["find"]
    assert worked_example["steps"][0]["equation"]
    assert worked_example["workedAnswer"]
    assert any(block["type"] == "conceptCard" for block in section["content"])


def test_section_fill_workflow_uses_guided_practice_for_humanities_sections() -> None:
    section_plan = {
        "id": "history-section-1",
        "title": "The Fugitive Slave Act and Northern Resistance",
        "description": "Explain how the Fugitive Slave Act changed Northern attitudes toward slavery and compromise.",
        "pageType": "learn",
        "sectionType": "lesson",
        "sourceIds": ["source-history"],
        "learningObjectives": ["Explain a cause-and-effect historical interpretation using evidence."],
        "conceptKeywords": ["Fugitive Slave Act of 1850", "Northern resistance", "sectional compromise"],
    }

    result = run_section_fill_workflow(
        section_plan,
        module_outline={
            "id": "history-module-1",
            "title": "Module 4: Sectional Crisis",
            "learningObjectives": ["Interpret causes of sectional conflict."],
        },
    )

    assert result["status"] == "passed"
    content = result["artifacts"]["section"]["content"]
    assert not any(block["type"] == "workedExample" for block in content)
    guided_practice = next(block for block in content if block.get("heading") == "Guided practice")
    assert guided_practice["type"] == "text"
    assert "interpretation" in guided_practice["value"].lower()


def test_section_fill_workflow_blocks_unfilled_planned_empty_section() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module = outline["modules"][0]
    section_plan_result = run_module_section_plan_workflow(module)
    section_plan = section_plan_result["artifacts"]["sectionPlans"][0]
    planned_section = section_plan_result["artifacts"]["plannedSections"][0]

    result = run_section_fill_workflow(
        section_plan,
        planned_section=planned_section,
        generated_section=planned_section,
        module_outline=section_plan_result["artifacts"]["plannedModule"],
    )

    assert result["status"] == "failed"
    assert result["metrics"]["contentBlockCount"] == 0
    assert result["metrics"]["replacedPlannedEmptySection"] is False
    assert any(issue["location"] == "content" for issue in result["issues"])


def test_section_fill_workflow_keeps_only_explicitly_used_source_refs() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module = outline["modules"][0]
    section_plan = run_module_section_plan_workflow(module)["artifacts"]["sectionPlans"][0]

    result = run_section_fill_workflow(
        section_plan,
        generated_section={
            "id": "generated-lesson",
            "title": "Generated Lesson",
            "pageType": "learn",
            "sectionType": "lesson",
            "sourceIds": ["unused-source"],
            "content": [
                {
                    "type": "text",
                    "value": "This block explicitly uses the source-motion reference.",
                    "sourceIds": ["source-motion", "unknown-source"],
                },
                {"type": "heading", "title": "Concepts introduced"},
                {
                    "type": "conceptCard",
                    "title": "Velocity",
                    "description": "Velocity connects motion to time.",
                },
            ],
        },
        module_outline=module,
    )

    section = result["artifacts"]["section"]

    assert result["status"] == "passed"
    assert result["metrics"]["sourceIdCount"] == 1
    assert result["metrics"]["plannedSourceIdCount"] == 1
    assert section["sourceIds"] == ["source-motion"]
    assert section["content"][0]["sourceIds"] == ["source-motion"]
    assert "sourceIds" not in section["content"][2]


def test_module_apply_section_workflow_generates_assessment_from_filled_lessons() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module_outline = outline["modules"][0]
    section_plan_result = run_module_section_plan_workflow(module_outline)
    filled_lessons = [
        run_section_fill_workflow(
            section_plan,
            planned_section=planned_section,
            module_outline=section_plan_result["artifacts"]["plannedModule"],
        )["artifacts"]["section"]
        for section_plan, planned_section in zip(
            section_plan_result["artifacts"]["sectionPlans"],
            section_plan_result["artifacts"]["plannedSections"],
            strict=True,
        )
    ]

    result = run_module_apply_section_workflow(module_outline, filled_lessons)

    assert result["contractVersion"] == MODULE_APPLY_SECTION_CONTRACT
    assert result["stage"] == "module_apply_section_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["lessonSectionCount"] == 2
    assert result["metrics"]["taughtConceptCount"] >= 2
    assert result["metrics"]["assessedConceptCount"] >= 2
    assert result["metrics"]["questionCount"] == 10
    assert result["metrics"]["validQuestionCount"] == 10
    assert result["metrics"]["badTemplatePhraseCount"] == 0
    assert result["metrics"]["contentCoverageRatio"] >= 0.7
    assert result["metrics"]["minimumContentCoverageRatio"] == 0.7
    assert result["metrics"]["coverageScope"] == "current_module"
    assert result["metrics"]["sourceIdCount"] == 0
    assert result["metrics"]["generatedFromFilledLessons"] is True
    assert result["metrics"]["assessmentKind"] == "quiz"
    assert result["metrics"]["assessmentPlanStatus"] == "passed"
    assert result["metrics"]["assessmentSubWorkflowStatus"] == "passed"
    section = result["artifacts"]["section"]
    quiz = section["content"][0]
    assert section["pageType"] == "apply"
    assert section["sectionType"] == "assessment"
    assert "sourceIds" not in section
    assert section["metadata"]["generationOutline"]["role"] == "assessment"
    assert section["metadata"]["generationOutline"]["planningSource"] == "module_apply_section_workflow"
    assessment_metadata = section["metadata"]["assessmentPlan"]
    assert assessment_metadata["contractVersion"] == "module-apply-assessment-plan-v1"
    assert assessment_metadata["assessmentKind"] == "quiz"
    assert assessment_metadata["coverageScope"] == "current_module"
    assert assessment_metadata["minimumContentCoverageRatio"] == 0.7
    assert assessment_metadata["contentCoverageRatio"] >= 0.7
    assert assessment_metadata["quizSpec"]["questionCount"] == 10
    assert assessment_metadata["quizSpec"]["multipleAnswerRatio"] == 0
    assert assessment_metadata["targetConceptIds"]
    assert assessment_metadata["assessedConceptIds"]
    assert quiz["type"] == "quiz"
    assert "sourceIds" not in quiz
    assert len(quiz["questions"]) == 10
    assert all(question["answers"] == [0] for question in quiz["questions"])
    assert all("sourceIds" not in question for question in quiz["questions"])
    quiz_text = " ".join(
        [question["question"] for question in quiz["questions"]]
        + [option for question in quiz["questions"] for option in question["options"]]
    ).lower()
    assert "which answer best demonstrates mastery" not in quiz_text
    assert "memorize the label" not in quiz_text
    assert result["artifacts"]["assessmentPlanReport"]["contractVersion"] == MODULE_ASSESSMENT_PLAN_CONTRACT
    assert result["artifacts"]["assessmentSubWorkflowReport"]["contractVersion"] == MODULE_QUIZ_ASSESSMENT_CONTRACT
    assessment_plan = result["artifacts"]["assessmentPlan"]
    assert assessment_plan["minimumContentCoverageRatio"] == 0.7
    assert assessment_plan["coverageScope"] == "current_module"
    assert assessment_plan["quizSpec"]["questionCount"] == 10
    assert assessment_plan["quizSpec"]["multipleAnswerRatio"] == 0
    assert assessment_plan["targetConceptIds"]


def test_module_apply_section_workflow_generates_prompt_grounded_quiz_questions() -> None:
    module_outline = {
        "id": "macro-m1",
        "title": "Module 1: GDP, inflation, unemployment, and aggregate demand",
    }
    filled_lessons = [
        {
            "id": "macro-m1-s1",
            "title": "GDP and national income accounting",
            "pageType": "learn",
            "sectionType": "lesson",
            "content": [
                {"type": "text", "value": "Students compare output, income, and expenditure approaches to measuring economic activity."},
                {"type": "heading", "title": "Concepts introduced"},
                {"type": "conceptCard", "title": "Gross Domestic Product", "description": "The market value of final goods and services produced in an economy over a period."},
                {"type": "conceptCard", "title": "National Income Accounting", "description": "The framework for measuring production, spending, and income in an economy."},
                {"type": "conceptCard", "title": "Real GDP", "description": "Output adjusted for price changes so production can be compared across time."},
            ],
        },
        {
            "id": "macro-m1-s2",
            "title": "Inflation, labor markets, and aggregate demand",
            "pageType": "learn",
            "sectionType": "lesson",
            "content": [
                {"type": "text", "value": "Students interpret price indexes, unemployment measures, and demand shocks."},
                {"type": "heading", "title": "Concepts introduced"},
                {"type": "conceptCard", "title": "Inflation", "description": "A sustained increase in the overall price level."},
                {"type": "conceptCard", "title": "Price Index", "description": "A normalized measure used to compare prices across periods."},
                {"type": "conceptCard", "title": "Unemployment Rate", "description": "The share of the labor force that is jobless and actively seeking work."},
                {"type": "conceptCard", "title": "Aggregate Demand", "description": "Total planned spending on domestic output at different price levels."},
                {"type": "conceptCard", "title": "Aggregate Supply", "description": "The relationship between price level and the quantity of output firms supply."},
                {"type": "conceptCard", "title": "Fiscal Policy", "description": "Government tax and spending choices used to influence aggregate demand."},
            ],
        },
    ]

    plan_report = run_module_assessment_plan_workflow(module_outline, filled_lessons)
    quiz_report = run_module_quiz_assessment_workflow(module_outline, plan_report["artifacts"]["assessmentPlan"])
    apply_report = run_module_apply_section_workflow(module_outline, filled_lessons)

    assert plan_report["status"] == "passed"
    assert plan_report["artifacts"]["assessmentPlan"]["assessmentKind"] == "quiz"
    assert plan_report["artifacts"]["assessmentPlan"]["minimumContentCoverageRatio"] == 0.7
    assert plan_report["artifacts"]["assessmentPlan"]["coverageScope"] == "current_module"
    assert len(plan_report["artifacts"]["assessmentPlan"]["targetConceptIds"]) == 9
    assert quiz_report["contractVersion"] == MODULE_QUIZ_ASSESSMENT_CONTRACT
    assert quiz_report["status"] == "passed"
    assert quiz_report["metrics"]["contentCoverageRatio"] >= 0.7
    assert apply_report["status"] == "passed"
    assert apply_report["metrics"]["contentCoverageRatio"] >= 0.7
    assessment_metadata = apply_report["artifacts"]["section"]["metadata"]["assessmentPlan"]
    assert assessment_metadata["coverageScope"] == "current_module"
    assert assessment_metadata["minimumContentCoverageRatio"] == 0.7
    assert assessment_metadata["contentCoverageRatio"] >= 0.7
    assert len(assessment_metadata["targetConcepts"]) == 9
    quiz = apply_report["artifacts"]["section"]["content"][0]
    questions = quiz["questions"]
    quiz_text = " ".join(
        [question["question"] for question in questions]
        + [option for question in questions for option in question["options"]]
    ).lower()

    assert len(questions) == 10
    assert "which answer best demonstrates mastery" not in quiz_text
    assert "source-backed evidence" not in quiz_text
    assert "memorize the label" not in quiz_text
    assert "assess an unrelated idea" not in quiz_text
    assert "gross domestic product" in quiz_text
    assert "inflation" in quiz_text
    assert "aggregate demand" in quiz_text
    assert "stoichiometry" not in quiz_text
    assert "2 h2" not in quiz_text


def test_module_quiz_assessment_workflow_blocks_low_content_coverage() -> None:
    target_concepts = [
        {"title": f"Concept {index}", "description": f"Definition for concept {index}."}
        for index in range(1, 21)
    ]
    assessment_plan = {
        "contractVersion": "module-assessment-plan-v1",
        "moduleId": "coverage-m1",
        "moduleTitle": "Module 1: Coverage Test",
        "assessmentKind": "quiz",
        "assessmentScale": "module_check",
        "coverageScope": "current_module",
        "minimumContentCoverageRatio": 0.7,
        "targetConceptIds": [f"concept-{index}" for index in range(1, 21)],
        "targetConcepts": target_concepts,
        "quizSpec": {
            "questionCount": 10,
            "timeLimitSeconds": None,
            "multipleAnswerRatio": 0,
            "questionTypes": ["single_answer"],
        },
    }

    result = run_module_quiz_assessment_workflow({"id": "coverage-m1", "title": "Module 1: Coverage Test"}, assessment_plan)

    assert result["status"] == "failed"
    assert result["metrics"]["questionCount"] == 10
    assert result["metrics"]["targetConceptCount"] == 20
    assert result["metrics"]["contentCoverageRatio"] == 0.5
    assert any(issue["location"] == "assessmentPlan.minimumContentCoverageRatio" for issue in result["issues"])


def test_module_apply_section_workflow_routes_project_modules_to_project_subworkflow() -> None:
    module_outline = {
        "id": "design-capstone",
        "title": "Module 12: Capstone engineering design project",
    }
    filled_lessons = [
        {
            "id": "design-capstone-s1",
            "title": "Design tradeoffs",
            "pageType": "learn",
            "sectionType": "lesson",
            "content": [
                {"type": "text", "value": "Students compare constraints, evidence, and tradeoffs."},
                {"type": "heading", "title": "Concepts introduced"},
                {"type": "conceptCard", "title": "Design Constraint", "description": "A requirement that limits acceptable solutions."},
                {"type": "conceptCard", "title": "Tradeoff", "description": "A choice that improves one criterion while weakening another."},
            ],
        }
    ]

    plan_report = run_module_assessment_plan_workflow(module_outline, filled_lessons, module_number=12, total_module_count=12)
    project_report = run_module_project_assessment_workflow(module_outline, plan_report["artifacts"]["assessmentPlan"])
    apply_report = run_module_apply_section_workflow(module_outline, filled_lessons, module_number=12, total_module_count=12)

    assert plan_report["artifacts"]["assessmentPlan"]["assessmentKind"] == "project"
    assert plan_report["artifacts"]["assessmentPlan"]["assessmentScale"] == "final"
    assert plan_report["artifacts"]["assessmentPlan"]["coverageScope"] == "entire_course"
    assert plan_report["artifacts"]["assessmentPlan"]["projectSpec"]["submissionType"] == "text"
    assert project_report["contractVersion"] == MODULE_PROJECT_ASSESSMENT_CONTRACT
    assert project_report["status"] == "passed"
    assert project_report["metrics"]["contentCoverageRatio"] >= 0.7
    assert apply_report["status"] == "passed"
    assert apply_report["metrics"]["assessmentKind"] == "project"
    assert apply_report["metrics"]["contentCoverageRatio"] >= 0.7
    section = apply_report["artifacts"]["section"]
    assert section["pageType"] == "apply"
    assert section["sectionType"] == "project"
    assessment_metadata = section["metadata"]["assessmentPlan"]
    assert assessment_metadata["assessmentKind"] == "project"
    assert assessment_metadata["assessmentScale"] == "final"
    assert assessment_metadata["coverageScope"] == "entire_course"
    assert assessment_metadata["minimumContentCoverageRatio"] == 0.7
    assert assessment_metadata["projectSpec"]["submissionType"] == "text"
    assert section["content"][0]["type"] == "project"
    assert section["content"][0]["submission"]["submissionType"] == "text"
    assert len(section["content"][0]["rubric"]["criteria"]) == 3
    assert "sourceIds" not in section


def test_module_apply_section_workflow_blocks_empty_assessment_payload() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module_outline = outline["modules"][0]
    section_plan_result = run_module_section_plan_workflow(module_outline)
    filled_lessons = [
        run_section_fill_workflow(section_plan, module_outline=module_outline)["artifacts"]["section"]
        for section_plan in section_plan_result["artifacts"]["sectionPlans"]
    ]

    result = run_module_apply_section_workflow(
        module_outline,
        filled_lessons,
        generated_section={
            "id": f"{module_outline['id']}-apply",
            "title": f"Apply: {module_outline['title']}",
            "pageType": "apply",
            "sectionType": "assessment",
            "sourceIds": module_outline["sourceIds"],
            "content": [],
        },
    )

    assert result["status"] == "failed"
    assert result["metrics"]["generatedFromFilledLessons"] is False
    assert result["metrics"]["contentBlockCount"] == 0
    assert any(issue["location"] == "content" for issue in result["issues"])
    assert "sourceIds" not in result["artifacts"]["section"]


def test_module_summary_section_workflow_generates_concept_inventory_from_filled_lessons() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module_outline = outline["modules"][0]
    section_plan_result = run_module_section_plan_workflow(module_outline)
    filled_lessons = [
        run_section_fill_workflow(
            section_plan,
            planned_section=planned_section,
            module_outline=section_plan_result["artifacts"]["plannedModule"],
        )["artifacts"]["section"]
        for section_plan, planned_section in zip(
            section_plan_result["artifacts"]["sectionPlans"],
            section_plan_result["artifacts"]["plannedSections"],
            strict=True,
        )
    ]

    result = run_module_summary_section_workflow(module_outline, filled_lessons)

    assert result["contractVersion"] == MODULE_SUMMARY_SECTION_CONTRACT
    assert result["stage"] == "module_summary_section_generation"
    assert result["status"] == "passed"
    assert result["metrics"]["lessonSectionCount"] == 2
    assert result["metrics"]["conceptCardCount"] >= 2
    assert result["metrics"]["sourceIdCount"] == 1
    section = result["artifacts"]["section"]
    assert section["pageType"] == "learn"
    assert section["sectionType"] == "summary"
    assert section["sourceIds"] == ["source-motion"]
    assert section["metadata"]["generationOutline"]["role"] == "summary"
    assert section["metadata"]["generationOutline"]["planningSource"] == "module_summary_section_workflow"
    assert section["content"][0]["title"] == "Module concepts"
    assert all(block["type"] != "quiz" for block in section["content"])


def test_module_assembly_workflow_reports_missing_summary_and_apply_stage() -> None:
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
    assert result["status"] == "failed"
    assert result["metrics"]["sectionCount"] == 2
    assert any(issue["message"] == "Module assembly must end with a summary section." for issue in result["issues"])
    assert any(issue["message"] == "Module assembly has no apply/practice section yet." for issue in result["issues"])


def test_module_assembly_workflow_passes_with_filled_lesson_and_apply_sections() -> None:
    outline = run_course_module_outline_workflow(
        prompt="Create an introductory mechanics course",
        source_packet=_source_packet(),
        desired_module_count=1,
        sections_per_module=2,
    )["artifacts"]["outline"]
    module_outline = outline["modules"][0]
    section_plan_result = run_module_section_plan_workflow(module_outline)
    filled_lessons = [
        run_section_fill_workflow(
            section_plan,
            planned_section=planned_section,
            module_outline=section_plan_result["artifacts"]["plannedModule"],
        )["artifacts"]["section"]
        for section_plan, planned_section in zip(
            section_plan_result["artifacts"]["sectionPlans"],
            section_plan_result["artifacts"]["plannedSections"],
            strict=True,
        )
    ]
    apply_section = run_module_apply_section_workflow(module_outline, filled_lessons)["artifacts"]["section"]
    summary_section = run_module_summary_section_workflow(module_outline, filled_lessons)["artifacts"]["section"]

    result = run_module_assembly_workflow(module_outline, [*filled_lessons, apply_section, summary_section])

    assert result["status"] == "passed"
    assert result["metrics"]["sectionCount"] == 4
    assert result["metrics"]["lessonSectionCount"] == 2
    assert result["metrics"]["applySectionCount"] == 1
    assert result["metrics"]["summarySectionCount"] == 1
    assert result["metrics"]["contentReadySectionCount"] == 4
    assert not any("apply/practice" in issue["message"] for issue in result["issues"])
    module = result["artifacts"]["module"]
    assert module["sections"][-2]["pageType"] == "apply"
    assert module["sections"][-1]["sectionType"] == "summary"
