"""Registry for Lycium generation stage contracts and handoffs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

STAGE_WORKFLOW_VERSION = "course-generation-stage-workflows-v1"

PROGRAM_BRIEF_CONTRACT = "program-brief-workflow-v1"
REQUIREMENT_GROUP_PLAN_CONTRACT = "requirement-group-plan-workflow-v1"
PROGRAM_GENERATION_CONTRACT = "program-generation-workflow-v1"
CLUSTER_GENERATION_CONTRACT = "cluster-generation-workflow-v1"
CLUSTER_PLAN_CONTRACT = "cluster-plan-v1"
CLUSTER_QUALITY_REPORT_CONTRACT = "cluster-quality-report-v1"
COURSE_TEMPLATE_CONTRACT = "course-template-workflow-v1"
COURSE_TEMPLATE_ARTIFACT_CONTRACT = "course-template-v1"
COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT = "course-template-quality-report-v1"
COURSE_WRAPPER_GENERATION_CONTRACT = "course-wrapper-generation-workflow-v1"
COURSE_MODULE_OUTLINE_CONTRACT = "course-module-outline-workflow-v1"
MODULE_SECTION_PLAN_CONTRACT = "module-section-plan-workflow-v1"
SECTION_FILL_CONTRACT = "section-fill-workflow-v1"
MODULE_ASSESSMENT_PLAN_CONTRACT = "module-assessment-plan-workflow-v1"
MODULE_QUIZ_ASSESSMENT_CONTRACT = "module-quiz-assessment-workflow-v1"
MODULE_PROJECT_ASSESSMENT_CONTRACT = "module-project-assessment-workflow-v1"
MODULE_APPLY_SECTION_CONTRACT = "module-apply-section-workflow-v1"
MODULE_SUMMARY_SECTION_CONTRACT = "module-summary-section-workflow-v1"
MODULE_ASSEMBLY_CONTRACT = "module-assembly-workflow-v1"
APPLY_NESTED_REPORT_ARTIFACT_KEYS = ("assessmentPlanReport", "assessmentSubWorkflowReport")

_PROGRAM_BRIEF_ARTIFACT_CONTRACT = "program-brief-v1"
_REQUIREMENT_GROUP_PLAN_ARTIFACT_CONTRACT = "requirement-group-plan-v1"
_COURSE_WRAPPER_QUALITY_REPORT_CONTRACT = "course-wrapper-quality-report-v1"
_COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT = "course-module-outline-quality-report-v1"

WorkflowMode = Literal["passive", "active"]


@dataclass(frozen=True)
class StageWorkflowDefinition:
    key: str
    mode: WorkflowMode
    stage: str
    contract_version: str
    label: str
    status_message: str
    ui_group: str
    artifact_contract_versions: tuple[str, ...] = ()
    next_workflows: tuple[str, ...] = ()


STAGE_WORKFLOW_DEFINITIONS = (
    StageWorkflowDefinition(
        key="program_brief",
        mode="passive",
        stage="program_brief",
        contract_version=PROGRAM_BRIEF_CONTRACT,
        label="Program brief",
        status_message="Creating program brief...",
        ui_group="course_template",
        artifact_contract_versions=(_PROGRAM_BRIEF_ARTIFACT_CONTRACT,),
        next_workflows=("requirement_group_plan",),
    ),
    StageWorkflowDefinition(
        key="requirement_group_plan",
        mode="passive",
        stage="requirement_group_plan",
        contract_version=REQUIREMENT_GROUP_PLAN_CONTRACT,
        label="Requirement-group plan",
        status_message="Planning requirement groups...",
        ui_group="course_template",
        artifact_contract_versions=(_REQUIREMENT_GROUP_PLAN_ARTIFACT_CONTRACT,),
        next_workflows=("program_generation",),
    ),
    StageWorkflowDefinition(
        key="program_generation",
        mode="passive",
        stage="program_generation",
        contract_version=PROGRAM_GENERATION_CONTRACT,
        label="Program generation",
        status_message="Creating program...",
        ui_group="course_template",
        next_workflows=("cluster_generation",),
    ),
    StageWorkflowDefinition(
        key="cluster_generation",
        mode="passive",
        stage="cluster_generation",
        contract_version=CLUSTER_GENERATION_CONTRACT,
        label="Cluster generation",
        status_message="Creating clusters...",
        ui_group="course_template",
        artifact_contract_versions=(CLUSTER_PLAN_CONTRACT, CLUSTER_QUALITY_REPORT_CONTRACT),
        next_workflows=("course_wrapper_generation",),
    ),
    StageWorkflowDefinition(
        key="course_wrapper_generation",
        mode="passive",
        stage="course_wrapper_generation",
        contract_version=COURSE_WRAPPER_GENERATION_CONTRACT,
        label="Course-wrapper generation",
        status_message="Creating course wrappers...",
        ui_group="course_template",
        artifact_contract_versions=(_COURSE_WRAPPER_QUALITY_REPORT_CONTRACT,),
        next_workflows=("course_template",),
    ),
    StageWorkflowDefinition(
        key="course_template",
        mode="active",
        stage="course_template_generation",
        contract_version=COURSE_TEMPLATE_CONTRACT,
        label="Course template",
        status_message="Creating course template...",
        ui_group="course_template",
        artifact_contract_versions=(COURSE_TEMPLATE_ARTIFACT_CONTRACT, COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT),
        next_workflows=("course_module_outline",),
    ),
    StageWorkflowDefinition(
        key="course_module_outline",
        mode="active",
        stage="course_module_outline_generation",
        contract_version=COURSE_MODULE_OUTLINE_CONTRACT,
        label="Course module outline",
        status_message="Creating modules...",
        ui_group="modules",
        artifact_contract_versions=(_COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT,),
        next_workflows=("module_section_plan",),
    ),
    StageWorkflowDefinition(
        key="module_section_plan",
        mode="active",
        stage="module_section_plan_generation",
        contract_version=MODULE_SECTION_PLAN_CONTRACT,
        label="Module section plan",
        status_message="Creating sections...",
        ui_group="sections",
        next_workflows=("section_fill",),
    ),
    StageWorkflowDefinition(
        key="section_fill",
        mode="active",
        stage="section_fill_generation",
        contract_version=SECTION_FILL_CONTRACT,
        label="Section fill",
        status_message="Writing section content...",
        ui_group="section_content",
        next_workflows=("module_apply_section", "module_summary_section"),
    ),
    StageWorkflowDefinition(
        key="module_assessment_plan",
        mode="active",
        stage="module_assessment_planning",
        contract_version=MODULE_ASSESSMENT_PLAN_CONTRACT,
        label="Module assessment plan",
        status_message="Planning module assessment...",
        ui_group="section_content",
        next_workflows=("module_quiz_assessment", "module_project_assessment"),
    ),
    StageWorkflowDefinition(
        key="module_quiz_assessment",
        mode="active",
        stage="module_quiz_assessment_generation",
        contract_version=MODULE_QUIZ_ASSESSMENT_CONTRACT,
        label="Quiz/test assessment",
        status_message="Writing quiz/test...",
        ui_group="section_content",
        next_workflows=("module_apply_section",),
    ),
    StageWorkflowDefinition(
        key="module_project_assessment",
        mode="active",
        stage="module_project_assessment_generation",
        contract_version=MODULE_PROJECT_ASSESSMENT_CONTRACT,
        label="Project assessment",
        status_message="Writing project assessment...",
        ui_group="section_content",
        next_workflows=("module_apply_section",),
    ),
    StageWorkflowDefinition(
        key="module_apply_section",
        mode="active",
        stage="module_apply_section_generation",
        contract_version=MODULE_APPLY_SECTION_CONTRACT,
        label="Module Apply section",
        status_message="Creating Apply section...",
        ui_group="section_content",
        next_workflows=("module_assembly",),
    ),
    StageWorkflowDefinition(
        key="module_summary_section",
        mode="active",
        stage="module_summary_section_generation",
        contract_version=MODULE_SUMMARY_SECTION_CONTRACT,
        label="Module summary section",
        status_message="Creating module summary...",
        ui_group="section_content",
        next_workflows=("module_assembly",),
    ),
    StageWorkflowDefinition(
        key="module_assembly",
        mode="active",
        stage="module_assembly",
        contract_version=MODULE_ASSEMBLY_CONTRACT,
        label="Module assembly",
        status_message="Assembling module...",
        ui_group="section_content",
    ),
)

ACTIVE_STAGE_WORKFLOW_KEYS = tuple(definition.key for definition in STAGE_WORKFLOW_DEFINITIONS if definition.mode == "active")
PASSIVE_STAGE_WORKFLOW_KEYS = tuple(definition.key for definition in STAGE_WORKFLOW_DEFINITIONS if definition.mode == "passive")
STAGE_WORKFLOW_KEYS = tuple(definition.key for definition in STAGE_WORKFLOW_DEFINITIONS)

_DEFINITIONS_BY_KEY = {definition.key: definition for definition in STAGE_WORKFLOW_DEFINITIONS}
_DEFINITIONS_BY_STAGE = {definition.stage: definition for definition in STAGE_WORKFLOW_DEFINITIONS}
_DEFINITIONS_BY_CONTRACT = {definition.contract_version: definition for definition in STAGE_WORKFLOW_DEFINITIONS}


def stage_workflow_definitions(*, mode: WorkflowMode | None = None) -> tuple[StageWorkflowDefinition, ...]:
    if mode is None:
        return STAGE_WORKFLOW_DEFINITIONS
    return tuple(definition for definition in STAGE_WORKFLOW_DEFINITIONS if definition.mode == mode)


def stage_workflow_definition(identifier: str | None) -> StageWorkflowDefinition | None:
    normalized = str(identifier or "").strip()
    if not normalized:
        return None
    return (
        _DEFINITIONS_BY_KEY.get(normalized)
        or _DEFINITIONS_BY_STAGE.get(normalized)
        or _DEFINITIONS_BY_CONTRACT.get(normalized)
    )


def stage_workflow_status_message(identifier: str | None, *, default: str = "Working...") -> str:
    definition = stage_workflow_definition(identifier)
    return definition.status_message if definition else default


__all__ = [
    "ACTIVE_STAGE_WORKFLOW_KEYS",
    "APPLY_NESTED_REPORT_ARTIFACT_KEYS",
    "CLUSTER_GENERATION_CONTRACT",
    "CLUSTER_PLAN_CONTRACT",
    "CLUSTER_QUALITY_REPORT_CONTRACT",
    "COURSE_MODULE_OUTLINE_CONTRACT",
    "COURSE_TEMPLATE_ARTIFACT_CONTRACT",
    "COURSE_TEMPLATE_CONTRACT",
    "COURSE_TEMPLATE_QUALITY_REPORT_CONTRACT",
    "COURSE_WRAPPER_GENERATION_CONTRACT",
    "MODULE_ASSESSMENT_PLAN_CONTRACT",
    "MODULE_APPLY_SECTION_CONTRACT",
    "MODULE_ASSEMBLY_CONTRACT",
    "MODULE_PROJECT_ASSESSMENT_CONTRACT",
    "MODULE_QUIZ_ASSESSMENT_CONTRACT",
    "MODULE_SECTION_PLAN_CONTRACT",
    "MODULE_SUMMARY_SECTION_CONTRACT",
    "PASSIVE_STAGE_WORKFLOW_KEYS",
    "PROGRAM_BRIEF_CONTRACT",
    "PROGRAM_GENERATION_CONTRACT",
    "REQUIREMENT_GROUP_PLAN_CONTRACT",
    "SECTION_FILL_CONTRACT",
    "STAGE_WORKFLOW_DEFINITIONS",
    "STAGE_WORKFLOW_KEYS",
    "STAGE_WORKFLOW_VERSION",
    "StageWorkflowDefinition",
    "WorkflowMode",
    "stage_workflow_definition",
    "stage_workflow_definitions",
    "stage_workflow_status_message",
]
