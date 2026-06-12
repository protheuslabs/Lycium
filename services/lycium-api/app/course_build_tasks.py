from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.course_build_task_reports import (
    build_outline_transition_report,
    build_review_transition_report,
    build_source_packet_transition_report,
)

BUILD_TASK_CONTRACT_VERSION = "course-build-task-v1"
SOURCE_PACKET_CONTRACT_VERSION = "source-packet-v1"
MINIMUM_CONCEPT_COVERAGE_RATIO = 0.7
COURSE_BUILD_STAGE_ORDER = [
    "source_gathering",
    "outline_ready",
    "section_generation_ready",
    "ready_for_review",
]
MINIMUM_OUTLINE_MODULE_COUNT = 1
MINIMUM_OUTLINE_SECTIONS_PER_MODULE = 2


def _quality_from_source_packet(source_packet: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(source_packet, dict):
        return {}
    quality = source_packet.get("quality")
    if isinstance(quality, dict):
        return quality
    synthesis = source_packet.get("synthesis")
    if isinstance(synthesis, dict):
        packet = synthesis.get("sourcePacket")
        if isinstance(packet, dict) and isinstance(packet.get("quality"), dict):
            return packet["quality"]
    packet = source_packet.get("sourcePacket")
    if isinstance(packet, dict) and isinstance(packet.get("quality"), dict):
        return packet["quality"]
    return {}


def _concept_coverage_ratio(quality: dict[str, Any]) -> float:
    try:
        return float(quality.get("conceptCoverageRatio") or 0)
    except (TypeError, ValueError):
        return 0.0


def _uncovered_concepts(quality: dict[str, Any]) -> list[str]:
    uncovered = quality.get("uncoveredConceptCandidates")
    if not isinstance(uncovered, list):
        return []
    return [str(concept) for concept in uncovered if str(concept).strip()]


def _packet_contract(source_packet: dict[str, Any] | None) -> str:
    if not isinstance(source_packet, dict):
        return ""
    return str(source_packet.get("contract_version") or source_packet.get("contractVersion") or "")


def source_packet_supports_outline_ready(
    source_packet: dict[str, Any] | None,
    *,
    minimum_concept_coverage_ratio: float = MINIMUM_CONCEPT_COVERAGE_RATIO,
) -> bool:
    if _packet_contract(source_packet) != SOURCE_PACKET_CONTRACT_VERSION:
        return False
    quality = _quality_from_source_packet(source_packet)
    return (
        str(quality.get("status") or "").lower() == "usable"
        and _concept_coverage_ratio(quality) >= minimum_concept_coverage_ratio
        and not _uncovered_concepts(quality)
    )


def transition_course_build_task_from_source_packet(
    task: dict[str, Any] | None,
    *,
    source_packet: dict[str, Any] | None,
    minimum_concept_coverage_ratio: float = MINIMUM_CONCEPT_COVERAGE_RATIO,
) -> dict[str, Any]:
    next_task = deepcopy(task) if isinstance(task, dict) else {}
    next_task.setdefault("contractVersion", BUILD_TASK_CONTRACT_VERSION)
    next_task.setdefault("stageOrder", COURSE_BUILD_STAGE_ORDER)
    current_status = str(next_task.get("status") or next_task.get("currentStage") or "source_gathering")
    quality = _quality_from_source_packet(source_packet)
    ratio = _concept_coverage_ratio(quality)
    uncovered = _uncovered_concepts(quality)

    next_task["sourcePacketEvidence"] = {
        "contractVersion": _packet_contract(source_packet),
        "qualityStatus": quality.get("status"),
        "conceptCoverageRatio": ratio,
        "minimumConceptCoverageRatio": minimum_concept_coverage_ratio,
        "uncoveredConceptCandidates": uncovered,
    }
    next_task["sourcePacketTransitionReport"] = build_source_packet_transition_report(
        task=next_task,
        source_packet=source_packet,
        minimum_concept_coverage_ratio=minimum_concept_coverage_ratio,
    )

    if current_status != "source_gathering":
        next_task["transitionStatus"] = "unchanged"
        next_task["transitionReason"] = f"Current stage is {current_status}."
        return next_task

    if source_packet_supports_outline_ready(
        source_packet,
        minimum_concept_coverage_ratio=minimum_concept_coverage_ratio,
    ):
        next_task["sourcePacketTransitionReport"]["status"] = "outline_ready"
        next_task["sourcePacketTransitionReport"]["passed"] = True
        next_task["sourcePacketTransitionReport"]["nextStage"] = "outline_ready"
        next_task["sourcePacketTransitionReport"]["nextAction"] = "generate_course_outline"
        next_task.update(
            {
                "status": "outline_ready",
                "currentStage": "outline_ready",
                "nextAction": "generate_course_outline",
                "requiredInputs": ["course_outline"],
                "transitionStatus": "advanced",
                "transitionReason": "Usable source packet satisfies concept coverage policy.",
            }
        )
        return next_task

    missing_inputs = []
    if _packet_contract(source_packet) != SOURCE_PACKET_CONTRACT_VERSION:
        missing_inputs.append("source_packet")
    if ratio < minimum_concept_coverage_ratio or uncovered:
        missing_inputs.append("concept_source_coverage")
    next_task.update(
        {
            "status": "source_gathering",
            "currentStage": "source_gathering",
            "nextAction": "attach_source_packet",
            "requiredInputs": missing_inputs or ["source_packet", "concept_source_coverage"],
            "transitionStatus": "blocked",
            "transitionReason": "Source packet is missing, not usable, or below concept coverage policy.",
        }
    )
    next_task["sourcePacketTransitionReport"]["status"] = "blocked"
    next_task["sourcePacketTransitionReport"]["passed"] = False
    next_task["sourcePacketTransitionReport"]["nextStage"] = "source_gathering"
    next_task["sourcePacketTransitionReport"]["nextAction"] = "attach_source_packet"
    return next_task


def transition_course_build_task_in_structure(
    structure: dict[str, Any],
    *,
    source_packet: dict[str, Any] | None,
    minimum_concept_coverage_ratio: float = MINIMUM_CONCEPT_COVERAGE_RATIO,
) -> dict[str, Any]:
    next_structure = deepcopy(structure)
    metadata = next_structure.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    metadata["courseBuildTask"] = transition_course_build_task_from_source_packet(
        metadata.get("courseBuildTask"),
        source_packet=source_packet,
        minimum_concept_coverage_ratio=minimum_concept_coverage_ratio,
    )
    next_structure["metadata"] = metadata
    return next_structure


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def outline_readiness_report(
    outline: dict[str, Any] | None,
    *,
    minimum_module_count: int = MINIMUM_OUTLINE_MODULE_COUNT,
    minimum_sections_per_module: int = MINIMUM_OUTLINE_SECTIONS_PER_MODULE,
) -> dict[str, Any]:
    outline = outline if isinstance(outline, dict) else {}
    modules = _items(outline.get("modules"))
    issues: list[dict[str, str]] = []
    section_count = 0
    objective_section_count = 0
    concept_section_count = 0

    if len(modules) < minimum_module_count:
        issues.append(
            {
                "severity": "error",
                "message": f"Outline needs at least {minimum_module_count} module.",
                "location": "modules",
            }
        )

    for module_index, module in enumerate(modules, start=1):
        module_title = _clean_text(module.get("title"))
        if not module_title:
            issues.append(
                {
                    "severity": "error",
                    "message": "Outline module is missing a title.",
                    "location": f"modules[{module_index}]",
                }
            )
        sections = _items(module.get("sections"))
        section_count += len(sections)
        if len(sections) < minimum_sections_per_module:
            issues.append(
                {
                    "severity": "error",
                    "message": f"Outline module needs at least {minimum_sections_per_module} sections.",
                    "location": f"modules[{module_index}].sections",
                }
            )
        for section_index, section in enumerate(sections, start=1):
            location = f"modules[{module_index}].sections[{section_index}]"
            if not _clean_text(section.get("title")):
                issues.append({"severity": "error", "message": "Outline section is missing a title.", "location": location})
            objectives = section.get("learning_objectives") or section.get("learningObjectives")
            if isinstance(objectives, list) and any(_clean_text(objective) for objective in objectives):
                objective_section_count += 1
            else:
                issues.append({"severity": "error", "message": "Outline section is missing learning objectives.", "location": location})
            concepts = section.get("concept_keywords") or section.get("conceptKeywords") or section.get("concepts")
            if isinstance(concepts, list) and any(_clean_text(concept) for concept in concepts):
                concept_section_count += 1
            else:
                issues.append({"severity": "error", "message": "Outline section is missing concept signals.", "location": location})

    passed = not any(issue["severity"] == "error" for issue in issues)
    return {
        "contractVersion": "course-outline-readiness-v1",
        "passed": passed,
        "issues": issues,
        "metrics": {
            "moduleCount": len(modules),
            "sectionCount": section_count,
            "objectiveSectionCount": objective_section_count,
            "conceptSectionCount": concept_section_count,
            "minimumModuleCount": minimum_module_count,
            "minimumSectionsPerModule": minimum_sections_per_module,
        },
    }


def outline_supports_section_generation_ready(outline: dict[str, Any] | None) -> bool:
    return bool(outline_readiness_report(outline)["passed"])


def transition_course_build_task_from_outline(
    task: dict[str, Any] | None,
    *,
    outline: dict[str, Any] | None,
) -> dict[str, Any]:
    next_task = deepcopy(task) if isinstance(task, dict) else {}
    next_task.setdefault("contractVersion", BUILD_TASK_CONTRACT_VERSION)
    next_task.setdefault("stageOrder", COURSE_BUILD_STAGE_ORDER)
    current_status = str(next_task.get("status") or next_task.get("currentStage") or "outline_ready")
    report = outline_readiness_report(outline)
    next_task["outlineReadiness"] = report
    next_task["outlineTransitionReport"] = build_outline_transition_report(
        task=next_task,
        outline=outline,
        minimum_module_count=MINIMUM_OUTLINE_MODULE_COUNT,
        minimum_sections_per_module=MINIMUM_OUTLINE_SECTIONS_PER_MODULE,
    )

    if current_status != "outline_ready":
        next_task["transitionStatus"] = "unchanged"
        next_task["transitionReason"] = f"Current stage is {current_status}."
        return next_task

    if report["passed"]:
        next_task["outlineTransitionReport"]["status"] = "section_generation_ready"
        next_task["outlineTransitionReport"]["passed"] = True
        next_task["outlineTransitionReport"]["nextStage"] = "section_generation_ready"
        next_task["outlineTransitionReport"]["nextAction"] = "generate_course_sections"
        next_task.update(
            {
                "status": "section_generation_ready",
                "currentStage": "section_generation_ready",
                "nextAction": "generate_course_sections",
                "requiredInputs": ["section_generation"],
                "transitionStatus": "advanced",
                "transitionReason": "Course outline has enough module, section, objective, and concept structure.",
            }
        )
        return next_task

    next_task.update(
        {
            "status": "outline_ready",
            "currentStage": "outline_ready",
            "nextAction": "revise_course_outline",
            "requiredInputs": ["course_outline"],
            "transitionStatus": "blocked",
            "transitionReason": "Course outline is missing required structure for section generation.",
        }
    )
    next_task["outlineTransitionReport"]["status"] = "blocked"
    next_task["outlineTransitionReport"]["passed"] = False
    next_task["outlineTransitionReport"]["nextStage"] = "outline_ready"
    next_task["outlineTransitionReport"]["nextAction"] = "revise_course_outline"
    return next_task


def transition_course_build_task_in_structure_from_outline(
    structure: dict[str, Any],
    *,
    outline: dict[str, Any] | None,
) -> dict[str, Any]:
    next_structure = deepcopy(structure)
    metadata = next_structure.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    metadata["courseBuildTask"] = transition_course_build_task_from_outline(
        metadata.get("courseBuildTask"),
        outline=outline,
    )
    next_structure["metadata"] = metadata
    return next_structure


def _quality_gate_failures(quality_report: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    gates = quality_report.get("gates")
    if isinstance(gates, list):
        for gate in gates:
            if isinstance(gate, dict) and str(gate.get("status") or "").lower() == "failed":
                failures.append(str(gate.get("gate") or "unnamed_gate"))
    workflow = quality_report.get("workflow")
    workflow_gates = workflow.get("gates") if isinstance(workflow, dict) else None
    if isinstance(workflow_gates, list):
        for gate in workflow_gates:
            if isinstance(gate, dict) and str(gate.get("status") or "").lower() == "failed":
                failures.append(str(gate.get("gate") or "unnamed_workflow_gate"))
    evals = quality_report.get("evals")
    dimensions = evals.get("dimensions") if isinstance(evals, dict) else None
    if isinstance(dimensions, list):
        for dimension in dimensions:
            if isinstance(dimension, dict) and str(dimension.get("status") or "").lower() == "failed":
                failures.append(str(dimension.get("key") or "unnamed_eval_dimension"))
    return sorted(set(failures))


def review_readiness_report(quality_report: dict[str, Any] | None) -> dict[str, Any]:
    quality_report = quality_report if isinstance(quality_report, dict) else {}
    errors = [str(error) for error in quality_report.get("errors", []) if str(error).strip()] if isinstance(quality_report.get("errors"), list) else []
    failures = _quality_gate_failures(quality_report)
    explicit_pass = quality_report.get("passed") is True or str(quality_report.get("status") or "").lower() == "passed"
    passed = explicit_pass and not errors and not failures
    issues = [
        *[
            {
                "severity": "error",
                "message": f"Quality gate failed: {failure}.",
                "location": "qualityReport.gates",
            }
            for failure in failures
        ],
        *[
            {
                "severity": "error",
                "message": error,
                "location": "qualityReport.errors",
            }
            for error in errors
        ],
    ]
    if not explicit_pass:
        issues.append(
            {
                "severity": "error",
                "message": "Quality report has not passed.",
                "location": "qualityReport.passed",
            }
        )
    return {
        "contractVersion": "course-review-readiness-v1",
        "passed": passed,
        "issues": issues,
        "metrics": {
            "qualityPassed": bool(explicit_pass),
            "errorCount": len(errors),
            "failedGateCount": len(failures),
            "score": quality_report.get("score") or quality_report.get("overallScore"),
        },
    }


def transition_course_build_task_from_quality_report(
    task: dict[str, Any] | None,
    *,
    quality_report: dict[str, Any] | None,
) -> dict[str, Any]:
    next_task = deepcopy(task) if isinstance(task, dict) else {}
    next_task.setdefault("contractVersion", BUILD_TASK_CONTRACT_VERSION)
    next_task.setdefault("stageOrder", COURSE_BUILD_STAGE_ORDER)
    current_status = str(next_task.get("status") or next_task.get("currentStage") or "section_generation_ready")
    report = review_readiness_report(quality_report)
    next_task["reviewReadiness"] = report
    next_task["reviewTransitionReport"] = build_review_transition_report(
        task=next_task,
        quality_report=quality_report,
    )

    if current_status != "section_generation_ready":
        next_task["transitionStatus"] = "unchanged"
        next_task["transitionReason"] = f"Current stage is {current_status}."
        return next_task

    if report["passed"]:
        next_task["reviewTransitionReport"]["status"] = "ready_for_review"
        next_task["reviewTransitionReport"]["passed"] = True
        next_task["reviewTransitionReport"]["nextStage"] = "ready_for_review"
        next_task["reviewTransitionReport"]["nextAction"] = "review_and_publish"
        next_task.update(
            {
                "status": "ready_for_review",
                "currentStage": "ready_for_review",
                "nextAction": "review_and_publish",
                "requiredInputs": ["human_review"],
                "transitionStatus": "advanced",
                "transitionReason": "Generated course passed quality, source, citation, and evaluation gates.",
            }
        )
        return next_task

    next_task.update(
        {
            "status": "section_generation_ready",
            "currentStage": "section_generation_ready",
            "nextAction": "repair_generated_sections",
            "requiredInputs": ["quality_gate_repairs"],
            "transitionStatus": "blocked",
            "transitionReason": "Generated course is not ready for review because quality gates failed.",
        }
    )
    next_task["reviewTransitionReport"]["status"] = "blocked"
    next_task["reviewTransitionReport"]["passed"] = False
    next_task["reviewTransitionReport"]["nextStage"] = "section_generation_ready"
    next_task["reviewTransitionReport"]["nextAction"] = "repair_generated_sections"
    return next_task


def transition_course_build_task_in_structure_from_quality_report(
    structure: dict[str, Any],
    *,
    quality_report: dict[str, Any] | None,
) -> dict[str, Any]:
    next_structure = deepcopy(structure)
    metadata = next_structure.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    metadata["courseBuildTask"] = transition_course_build_task_from_quality_report(
        metadata.get("courseBuildTask"),
        quality_report=quality_report,
    )
    next_structure["metadata"] = metadata
    return next_structure
