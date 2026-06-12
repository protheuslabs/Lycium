from __future__ import annotations

from typing import Any

from app.course_generation_scenario_specs import PROGRAM_SCENARIOS
from app.curriculum_benchmarks import compile_curriculum_benchmark_context
from app.program_contract_builder import build_program_contract
from app.program_generation_scenarios import evaluate_program_generation_scenario
from app.program_generation_timeline import build_program_generation_timeline
from app.program_quality import assess_program_quality
from app.program_validation import validate_program_contract


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _values(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _source_documents(spec: dict[str, Any]) -> list[dict[str, Any]]:
    return _items(spec.get("sourceDocuments"))


def _document_urls(source_documents: list[dict[str, Any]]) -> list[str]:
    return [
        str(document.get("url"))
        for document in source_documents
        if isinstance(document.get("url"), str) and document.get("url")
    ]


def _has_required_input(task: dict[str, Any], required_input: str) -> bool:
    inputs = task.get("requiredInputs")
    return isinstance(inputs, list) and required_input in inputs


def _scaffold_readiness(scaffold_plan: dict[str, Any]) -> dict[str, Any]:
    clusters = _items(scaffold_plan.get("clusters"))
    courses = _items(scaffold_plan.get("courses"))
    course_tasks = [course.get("courseBuildTask") for course in courses]
    tasks = [task for task in course_tasks if isinstance(task, dict)]
    create_empty_courses = [course for course in courses if course.get("action") == "create_empty_course"]
    linked_existing_courses = [course for course in courses if course.get("action") == "link_existing_course"]
    source_gathering_tasks = [task for task in tasks if task.get("status") == "source_gathering"]
    source_packet_tasks = [task for task in tasks if _has_required_input(task, "source_packet")]
    prerequisite_courses = [course for course in courses if _values(course.get("prerequisiteCourseIds"))]
    return {
        "clusterCount": len(clusters),
        "courseCount": len(courses),
        "createEmptyCourseCount": len(create_empty_courses),
        "linkExistingCourseCount": len(linked_existing_courses),
        "courseBuildTaskCount": len(tasks),
        "sourceGatheringTaskCount": len(source_gathering_tasks),
        "sourcePacketRequiredCount": len(source_packet_tasks),
        "prerequisiteLinkedCourseCount": len(prerequisite_courses),
        "missingCourseBuildTaskCount": len(courses) - len(tasks),
    }


def _course_packets_from_scaffold(scaffold_plan: dict[str, Any]) -> list[dict[str, Any]]:
    packets: list[dict[str, Any]] = []
    for course in _items(scaffold_plan.get("courses")):
        course_id = str(course.get("existingCourseId") or course.get("courseId") or "")
        requirement_id = str(course.get("requirementId") or "")
        packet_id = course_id or requirement_id
        if not packet_id:
            continue
        packets.append(
            {
                "courseId": course_id,
                "requirementId": requirement_id,
                "title": str(course.get("title") or course_id or requirement_id),
                "learningPacket": {
                    "object_ids": [f"object-{packet_id}"],
                    "sourceIds": [f"source-{packet_id}"],
                },
            }
        )
    return packets


def _check(status: str, name: str, message: str, evidence: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "status": status,
        "message": message,
        "evidence": evidence or {},
    }


def _drill_status(checks: list[dict[str, Any]]) -> str:
    if any(check.get("status") == "failed" for check in checks):
        return "failed"
    if any(check.get("status") == "needs_review" for check in checks):
        return "needs_review"
    return "passed"


def _recommendations(checks: list[dict[str, Any]]) -> list[str]:
    recommendations: list[str] = []
    for check in checks:
        if check.get("status") == "passed":
            continue
        name = str(check.get("name") or "check")
        message = str(check.get("message") or "Review the drill evidence.")
        recommendations.append(f"{name}: {message}")
    return recommendations


def build_program_generation_drill(
    scenario_id: str,
    *,
    known_courses: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    spec = PROGRAM_SCENARIOS[scenario_id]
    goal = str(spec.get("generationGoal") or spec.get("label") or scenario_id)
    source_documents = _source_documents(spec)
    benchmark_context = compile_curriculum_benchmark_context(
        prompt=goal,
        source_urls=_document_urls(source_documents),
        source_documents=source_documents,
    )
    program, _course_requirements, synthesis = build_program_contract(
        goal=goal,
        level=spec.get("level"),
        desired_course_count=int(spec.get("desiredCourseCount") or spec.get("minCourseRequirements") or 12),
        benchmark_context=benchmark_context,
        known_courses=known_courses,
    )
    validation_errors = validate_program_contract(program)
    scaffold_plan = synthesis.get("courseScaffoldPlan") if isinstance(synthesis.get("courseScaffoldPlan"), dict) else {}
    course_packets = _course_packets_from_scaffold(scaffold_plan)
    program_envelope: dict[str, Any] = {
        "contractVersion": "0.1.0",
        "program": program,
        "generationTrace": {
            "goal": goal,
            "scenarioId": scenario_id,
            "curriculumBenchmarkContext": benchmark_context,
            "programSynthesis": synthesis,
            "coursePackets": course_packets,
        },
        "contractValidation": {"passed": not validation_errors, "errors": validation_errors},
    }
    quality_report = assess_program_quality(program_envelope)
    program_envelope["qualityReport"] = quality_report
    program_envelope["generationTrace"]["timeline"] = build_program_generation_timeline(program_envelope)
    program_evaluation = evaluate_program_generation_scenario(program_envelope, scenario_id)
    scaffold_readiness = _scaffold_readiness(scaffold_plan)

    checks = [
        _check(
            "passed" if not validation_errors else "failed",
            "program_contract",
            "Generated program matches the LyciumProgram contract.",
            {"errors": validation_errors},
        ),
        _check(
            "passed" if quality_report.get("passed") else "failed",
            "program_quality",
            "Program quality gates pass.",
            {"score": quality_report.get("score"), "passed": quality_report.get("passed")},
        ),
        _check(
            "passed" if program_evaluation.get("status") == "passed" else "failed",
            "scenario_evaluation",
            "Program satisfies the scenario-specific curriculum expectations.",
            {"status": program_evaluation.get("status"), "score": program_evaluation.get("score")},
        ),
        _check(
            "passed"
            if scaffold_readiness["clusterCount"] > 0
            and scaffold_readiness["courseCount"] > 0
            and scaffold_readiness["missingCourseBuildTaskCount"] == 0
            else "failed",
            "course_scaffold_handoff",
            "Generated clusters and course shells all include build tasks.",
            scaffold_readiness,
        ),
        _check(
            "passed"
            if scaffold_readiness["createEmptyCourseCount"] == scaffold_readiness["sourcePacketRequiredCount"]
            else "failed",
            "source_packet_handoff",
            "Every new course shell that needs buildout explicitly asks for a source packet.",
            scaffold_readiness,
        ),
        _check(
            "passed" if scaffold_readiness["prerequisiteLinkedCourseCount"] > 0 else "needs_review",
            "prerequisite_handoff",
            "Later course shells carry prerequisite course IDs from earlier clusters.",
            scaffold_readiness,
        ),
    ]
    status = _drill_status(checks)
    return {
        "contractVersion": "program-generation-drill-v1",
        "scenarioId": scenario_id,
        "status": status,
        "programEnvelope": program_envelope,
        "programEvaluation": program_evaluation,
        "courseShellReadiness": scaffold_readiness,
        "checks": checks,
        "recommendations": _recommendations(checks),
    }
