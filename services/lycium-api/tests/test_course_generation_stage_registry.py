from __future__ import annotations

from app import course_generation_stage_workflows
from app.course_outline_from_source_packet import COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT
from app.course_generation_stage_registry import (
    ACTIVE_STAGE_WORKFLOW_KEYS,
    PASSIVE_STAGE_WORKFLOW_KEYS,
    STAGE_WORKFLOW_DEFINITIONS,
    STAGE_WORKFLOW_KEYS,
    stage_workflow_definition,
    stage_workflow_definitions,
    stage_workflow_status_message,
)
from app.program_contract_builder import PROGRAM_BRIEF_CONTRACT_VERSION, REQUIREMENT_GROUP_PLAN_CONTRACT_VERSION
from app.program_course_scaffold import COURSE_WRAPPER_QUALITY_REPORT_CONTRACT


EXPECTED_PASSIVE_ORDER = (
    "program_brief",
    "requirement_group_plan",
    "program_generation",
    "cluster_generation",
    "course_wrapper_generation",
)

EXPECTED_ACTIVE_ORDER = (
    "course_template",
    "course_module_outline",
    "module_section_plan",
    "section_fill",
    "module_assessment_plan",
    "module_quiz_assessment",
    "module_project_assessment",
    "module_apply_section",
    "module_summary_section",
    "module_assembly",
)

LEGACY_STAGE_EXPORTS = {
    "program_brief": "PROGRAM_BRIEF_CONTRACT",
    "requirement_group_plan": "REQUIREMENT_GROUP_PLAN_CONTRACT",
    "program_generation": "PROGRAM_GENERATION_CONTRACT",
    "cluster_generation": "CLUSTER_GENERATION_CONTRACT",
    "course_wrapper_generation": "COURSE_WRAPPER_GENERATION_CONTRACT",
    "course_template": "COURSE_TEMPLATE_CONTRACT",
    "course_module_outline": "COURSE_MODULE_OUTLINE_CONTRACT",
    "module_section_plan": "MODULE_SECTION_PLAN_CONTRACT",
    "section_fill": "SECTION_FILL_CONTRACT",
    "module_assessment_plan": "MODULE_ASSESSMENT_PLAN_CONTRACT",
    "module_quiz_assessment": "MODULE_QUIZ_ASSESSMENT_CONTRACT",
    "module_project_assessment": "MODULE_PROJECT_ASSESSMENT_CONTRACT",
    "module_apply_section": "MODULE_APPLY_SECTION_CONTRACT",
    "module_summary_section": "MODULE_SUMMARY_SECTION_CONTRACT",
    "module_assembly": "MODULE_ASSEMBLY_CONTRACT",
}


def test_stage_workflow_registry_declares_the_generation_order() -> None:
    assert PASSIVE_STAGE_WORKFLOW_KEYS == EXPECTED_PASSIVE_ORDER
    assert ACTIVE_STAGE_WORKFLOW_KEYS == EXPECTED_ACTIVE_ORDER
    assert STAGE_WORKFLOW_KEYS == (*EXPECTED_PASSIVE_ORDER, *EXPECTED_ACTIVE_ORDER)
    assert stage_workflow_definitions(mode="passive") == STAGE_WORKFLOW_DEFINITIONS[: len(EXPECTED_PASSIVE_ORDER)]
    assert stage_workflow_definitions(mode="active") == STAGE_WORKFLOW_DEFINITIONS[len(EXPECTED_PASSIVE_ORDER) :]


def test_stage_workflow_registry_has_unique_lookup_fields_and_valid_handoffs() -> None:
    keys = [definition.key for definition in STAGE_WORKFLOW_DEFINITIONS]
    stages = [definition.stage for definition in STAGE_WORKFLOW_DEFINITIONS]
    contracts = [definition.contract_version for definition in STAGE_WORKFLOW_DEFINITIONS]

    assert len(keys) == len(set(keys))
    assert len(stages) == len(set(stages))
    assert len(contracts) == len(set(contracts))

    known_keys = set(keys)
    for definition in STAGE_WORKFLOW_DEFINITIONS:
        assert definition.label
        assert definition.status_message.endswith("...")
        assert set(definition.next_workflows) <= known_keys


def test_stage_workflow_registry_resolves_by_key_stage_or_contract() -> None:
    template = stage_workflow_definition("course_template")

    assert template is not None
    assert stage_workflow_definition(template.stage) is template
    assert stage_workflow_definition(template.contract_version) is template
    assert stage_workflow_definition("") is None
    assert stage_workflow_status_message("module_project_assessment_generation") == "Writing project assessment..."
    assert stage_workflow_status_message("not-a-stage", default="Fallback") == "Fallback"


def test_stage_workflow_artifact_versions_match_owner_modules() -> None:
    program_brief = stage_workflow_definition("program_brief")
    group_plan = stage_workflow_definition("requirement_group_plan")
    course_wrapper = stage_workflow_definition("course_wrapper_generation")
    module_outline = stage_workflow_definition("course_module_outline")

    assert program_brief is not None
    assert group_plan is not None
    assert course_wrapper is not None
    assert module_outline is not None
    assert program_brief.artifact_contract_versions == (PROGRAM_BRIEF_CONTRACT_VERSION,)
    assert group_plan.artifact_contract_versions == (REQUIREMENT_GROUP_PLAN_CONTRACT_VERSION,)
    assert course_wrapper.artifact_contract_versions == (COURSE_WRAPPER_QUALITY_REPORT_CONTRACT,)
    assert module_outline.artifact_contract_versions == (COURSE_MODULE_OUTLINE_QUALITY_REPORT_CONTRACT,)


def test_stage_workflow_contracts_stay_backward_compatible_from_stage_workflows_module() -> None:
    for key, export_name in LEGACY_STAGE_EXPORTS.items():
        definition = stage_workflow_definition(key)

        assert definition is not None
        assert getattr(course_generation_stage_workflows, export_name) == definition.contract_version
