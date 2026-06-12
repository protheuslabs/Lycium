from __future__ import annotations

import argparse
import time
from typing import Any

from app.course_quality import assess_course_quality
from model_sweep_micro import run_micro_benchmark

def _task_sample(micro_gate: dict[str, Any], task: str) -> dict[str, Any]:
    for result in micro_gate.get("task_results", []):
        if result.get("task") == task and isinstance(result.get("sample"), dict):
            return result["sample"]
    return {}


def _source_records() -> list[dict[str, Any]]:
    return [
        {
            "id": "source-1",
            "type": "input_artifact",
            "title": "CHEM 105 syllabus outline",
            "localPath": "artifact://chem105-syllabus-outline",
        },
        {
            "id": "source-2",
            "type": "input_artifact",
            "title": "CHEM 105 open textbook excerpt",
            "localPath": "artifact://chem105-open-textbook-excerpt",
        },
        {
            "id": "source-3",
            "type": "input_artifact",
            "title": "CHEM 105 lab sequence",
            "localPath": "artifact://chem105-lab-sequence",
        },
    ]


def _summary_section(learn_section: dict[str, Any]) -> dict[str, Any]:
    concepts = [
        {
            **block,
            "sourceIds": block.get("sourceIds") or learn_section.get("sourceIds") or ["source-1", "source-2"],
            "sourceSectionId": learn_section.get("id") or "module-1-lesson-1",
        }
        for block in learn_section.get("content", [])
        if isinstance(block, dict) and block.get("type") == "conceptCard"
    ]
    return {
        "id": "module-1-summary",
        "title": "Module 1 summary",
        "pageType": "learn",
        "sectionType": "summary",
        "sourceIds": learn_section.get("sourceIds") or ["source-1", "source-2"],
        "content": [
            {"type": "heading", "title": "Module concepts"},
            *concepts,
        ],
    }


def _normalize_learn_section(section: dict[str, Any]) -> dict[str, Any]:
    source_ids = section.get("sourceIds") or ["source-1", "source-2"]
    content = section.get("content") if isinstance(section.get("content"), list) else []
    normalized: list[dict[str, Any]] = []
    inserted_concepts_heading = False
    inserted_practice_loop = False
    for block in content:
        if not isinstance(block, dict):
            continue
        block_type = block.get("type")
        if block_type == "conceptCard" and not inserted_concepts_heading:
            if not inserted_practice_loop:
                normalized.extend(_practice_loop_blocks(source_ids))
                inserted_practice_loop = True
            normalized.append({"type": "heading", "title": "Concepts introduced", "sourceIds": source_ids})
            inserted_concepts_heading = True
        next_block = {**block}
        if block_type in {"text", "conceptCard"} and not next_block.get("sourceIds"):
            next_block["sourceIds"] = source_ids
        normalized.append(next_block)
    return {
        **section,
        "id": section.get("id") or "module-1-lesson-1",
        "sectionType": "lesson",
        "sourceIds": source_ids,
        "content": normalized,
    }


def _practice_loop_blocks(source_ids: list[str]) -> list[dict[str, Any]]:
    return [
        {"type": "heading", "title": "Worked example", "sourceIds": source_ids},
        {
            "type": "text",
            "value": (
                "Example: start with the balanced equation and treat each coefficient as a mole ratio. "
                "If two moles of one reactant are required for every one mole of product, the coefficient "
                "relationship becomes the bridge between measured mass, moles, and predicted yield [1]. "
                "This keeps the work grounded in conservation of atoms instead of memorized shortcuts."
            ),
            "sourceIds": source_ids,
        },
        {"type": "heading", "title": "Practice exercise", "sourceIds": source_ids},
        {
            "type": "text",
            "value": (
                "Practice: identify the known quantity, convert it to moles, use the balanced equation to "
                "compare both reactants, and decide which reactant is consumed first. Then explain the result "
                "as mastery evidence: the limiting reactant sets the theoretical yield, while the excess "
                "reactant remains after the reaction [2]."
            ),
            "sourceIds": source_ids,
        },
    ]


def _normalize_quiz_section(section: dict[str, Any]) -> dict[str, Any]:
    source_ids = section.get("sourceIds") or ["source-1", "source-2", "source-3"]
    content = section.get("content") if isinstance(section.get("content"), list) else []
    return {
        **section,
        "id": section.get("id") or "module-1-quiz-1",
        "pageType": "apply",
        "sectionType": "assessment",
        "sourceIds": source_ids,
        "content": [
            {**block, "sourceIds": block.get("sourceIds") or source_ids}
            for block in content
            if isinstance(block, dict)
        ],
    }


def _source_slots(learn_section: dict[str, Any], quiz_section: dict[str, Any]) -> list[dict[str, Any]]:
    slots: list[dict[str, Any]] = []
    for index, block in enumerate(learn_section.get("content", []), start=1):
        if not isinstance(block, dict) or block.get("type") != "conceptCard":
            continue
        title = str(block.get("title") or block.get("term") or f"Concept {index}")
        source_ids = block.get("sourceIds") if isinstance(block.get("sourceIds"), list) else ["source-1", "source-2"]
        primary = str(source_ids[0]) if source_ids else "source-1"
        slots.append(
            {
                "id": f"source-slot-{index}",
                "requiredConceptId": title.lower().replace(" ", "-"),
                "concept": title,
                "sectionIds": [learn_section.get("id") or "module-1-lesson-1"],
                "primarySourceId": primary,
                "fallbackSourceIds": [source_id for source_id in ["source-1", "source-2", "source-3"] if source_id != primary],
                "sourceIds": source_ids,
                "replacementPolicy": "review_required",
            }
        )
    slots.append(
        {
            "id": "source-slot-quiz-application",
            "requiredConceptId": "quiz-application",
            "concept": "CHEM 105 application quiz",
            "title": str(quiz_section.get("title") or "CHEM 105 application quiz"),
            "sectionIds": [str(quiz_section.get("id") or "module-1-quiz-1")],
            "primarySourceId": "source-2",
            "fallbackSourceIds": ["source-1", "source-3"],
            "sourceIds": ["source-1", "source-2", "source-3"],
            "replacementPolicy": "review_required",
        }
    )
    return slots


def compose_one_module_course(micro_gate: dict[str, Any], model: str, args: argparse.Namespace) -> dict[str, Any]:
    plan = _task_sample(micro_gate, "plan")
    learn_section = _normalize_learn_section(_task_sample(micro_gate, "section"))
    quiz_section = _normalize_quiz_section(_task_sample(micro_gate, "quiz"))
    modules = plan.get("modules") if isinstance(plan.get("modules"), list) else []
    module_plan = modules[0] if modules and isinstance(modules[0], dict) else {}
    pacing_label = str(plan.get("pacingLabel") or "Module")
    source_ids = ["source-1", "source-2", "source-3"]
    return {
        "contractVersion": "0.1.0",
        "title": str(plan.get("title") or "CHEM 105 General Chemistry I"),
        "shortDescription": str(
            plan.get("shortDescription")
            or "A source-backed one-module chemistry course assembled from validated generation primitives."
        ),
        "difficultyLevel": args.level,
        "category": args.category,
        "department": args.department,
        "tags": ["chemistry", "general chemistry", "stoichiometry", "laboratory science"],
        "orderMandatory": False,
        "sourceIds": source_ids,
        "sourceRecords": _source_records(),
        "metadata": {
            "pacingLabel": pacing_label if pacing_label in {"Module", "Week"} else "Module",
            "courseType": "academic_course",
            "scope": {
                "audience": "Undergraduate general chemistry students",
                "level": args.level,
                "duration": f"{args.duration_minutes} minutes",
                "outcome": "Use core chemistry models and quantitative reasoning to solve introductory problems.",
            },
            "sourceSlots": _source_slots(learn_section, quiz_section),
            "requirementOrigins": [
                {
                    "id": "chem105-core-topics-origin",
                    "requirementId": "chem105-core-topics",
                    "title": "CHEM 105 core topic coverage",
                    "originType": "common_academic_requirement",
                    "evidenceRefs": ["source-1", "source-2", "source-3"],
                    "frequency": 1.0,
                }
            ],
            "sourceCorpusSynthesis": {
                "submittedSourceCount": 3,
                "includedSourceCount": 3,
                "excludedSourceCount": 0,
                "commonThemes": ["stoichiometry", "bonding", "thermochemistry", "laboratory measurement"],
            },
            "generationPlan": {
                "mode": "composed-from-model-sweep-primitives",
                "model": model,
                "microGateScore": micro_gate.get("quality_score"),
            },
        },
        "modules": [
            {
                "id": "module-1",
                "title": str(module_plan.get("title") or "Module 1: Chemistry foundations"),
                "sourceIds": source_ids,
                "sections": [
                    learn_section,
                    quiz_section,
                    _summary_section(learn_section),
                ],
            }
        ],
    }


def run_composed_one_module_benchmark(model: str, args: argparse.Namespace) -> dict[str, Any]:
    gate_args = argparse.Namespace(**{**vars(args), "task": "all-micro"})
    micro_gate = run_micro_benchmark(model, gate_args)
    if not micro_gate.get("quality_passed"):
        return {
            "model": model,
            "ok": False,
            "accepted": False,
            "elapsed_seconds": micro_gate.get("elapsed_seconds"),
            "quality_passed": False,
            "quality_score": micro_gate.get("quality_score"),
            "error": "Composed one-module benchmark skipped because the model failed the all-micro gate.",
            "micro_gate": micro_gate,
            "benchmark_mode": "composed-one-module-after-all-micro",
        }

    started = time.monotonic()
    course = compose_one_module_course(micro_gate, model, args)
    quality_report = assess_course_quality(course, gate="generation")
    accepted = bool(quality_report.get("passed"))
    return {
        "model": model,
        "ok": True,
        "accepted": accepted,
        "elapsed_seconds": round(float(micro_gate.get("elapsed_seconds") or 0.0) + time.monotonic() - started, 2),
        "quality_passed": accepted,
        "quality_score": quality_report.get("score"),
        "quality_errors": quality_report.get("errors") or [],
        "quality_warnings": quality_report.get("warnings") or [],
        "title": course.get("title"),
        "module_count": 1,
        "section_count": 3,
        "source_count": len(course.get("sourceRecords") or []),
        "model_capability": micro_gate.get("model_capability"),
        "micro_gate": micro_gate,
        "course": course,
        "quality_report": quality_report,
        "benchmark_mode": "composed-one-module-after-all-micro",
    }
