from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Literal

from app.course_generation_scenarios import (
    evaluate_course_generation_scenario,
    evaluate_program_generation_scenario,
)


GAUNTLET_VERSION = "course-generation-gauntlet-v1"
GAUNTLET_INPUT_VERSION = "course-generation-gauntlet-input-v1"

GauntletKind = Literal["course", "program"]
GauntletStatus = Literal["passed", "needs_review", "failed"]


DEFAULT_GAUNTLET_CASES: tuple[dict[str, str], ...] = (
    {
        "kind": "course",
        "scenarioId": "chem-105-general-chemistry",
        "label": "CHEM 105 college course",
        "domain": "natural sciences",
        "inputMix": "prompt+urls+files",
    },
    {
        "kind": "course",
        "scenarioId": "intro-programming-foundations",
        "label": "Intro programming course",
        "domain": "software",
        "inputMix": "prompt+urls",
    },
    {
        "kind": "course",
        "scenarioId": "software-engineering-methods",
        "label": "Software engineering course",
        "domain": "software engineering",
        "inputMix": "prompt+benchmarks+urls",
    },
    {
        "kind": "course",
        "scenarioId": "under-sourced-course-prompt",
        "label": "Under-sourced prompt",
        "domain": "source readiness",
        "inputMix": "prompt-only",
    },
    {
        "kind": "program",
        "scenarioId": "full-stack-software-engineer-program",
        "label": "Full-stack software engineer program",
        "domain": "program planning",
        "inputMix": "program+clusters+course shells",
    },
)


def _scenario_key(kind: str, scenario_id: str) -> str:
    return f"{kind}:{scenario_id}"


def _status_from_children(children: Sequence[dict[str, Any]]) -> GauntletStatus:
    statuses = {child.get("status") for child in children}
    if "failed" in statuses:
        return "failed"
    if "needs_review" in statuses or "missing" in statuses:
        return "needs_review"
    return "passed"


def _score_from_children(children: Sequence[dict[str, Any]]) -> float:
    if not children:
        return 0.0
    return round(sum(float(child.get("score") or 0) for child in children) / len(children), 2)


def _finding_text(report: Mapping[str, Any]) -> str:
    parts: list[str] = []
    checks = report.get("checks", [])
    if not isinstance(checks, list):
        return ""
    for check in checks:
        if not isinstance(check, dict):
            continue
        parts.append(str(check.get("key") or ""))
        findings = check.get("findings", [])
        if not isinstance(findings, list):
            continue
        for finding in findings:
            if isinstance(finding, dict):
                parts.append(str(finding.get("message") or ""))
                parts.append(str(finding.get("location") or ""))
    return " ".join(parts).lower()


def _classify_gap(report: Mapping[str, Any]) -> str:
    text = _finding_text(report)
    if "readiness" in text or "source gap" in text or "minimum source" in text:
        return "source_readiness"
    if "source" in text or "citation" in text or "coverage" in text:
        return "source_grounding"
    if "quiz" in text or "assessment" in text or "question" in text:
        return "assessment_quality"
    if "topic" in text or "requirement" in text or "benchmark" in text:
        return "curriculum_coverage"
    if "placeholder" in text or "prompt" in text or "hollow" in text:
        return "instructional_substance"
    if "dependency" in text or "capstone" in text or "program" in text:
        return "program_structure"
    return "unknown"


def _case_result(case: Mapping[str, str], report: Mapping[str, Any]) -> dict[str, Any]:
    enriched_report = dict(report)
    enriched_report.setdefault("scenarioId", case["scenarioId"])
    enriched_report.setdefault("scenarioLabel", case.get("label") or case["scenarioId"])
    enriched_report.setdefault("kind", case["kind"])
    return {
        "key": _scenario_key(case["kind"], case["scenarioId"]),
        "kind": case["kind"],
        "scenarioId": case["scenarioId"],
        "label": case.get("label") or case["scenarioId"],
        "domain": case.get("domain"),
        "inputMix": case.get("inputMix"),
        "status": report.get("status", "failed"),
        "score": round(float(report.get("score") or 0), 2),
        "gapClass": None if report.get("status") == "passed" else _classify_gap(report),
        "failedCheckCount": (report.get("metrics") or {}).get("failedCheckCount", 0) if isinstance(report.get("metrics"), dict) else 0,
        "needsReviewCheckCount": (report.get("metrics") or {}).get("needsReviewCheckCount", 0) if isinstance(report.get("metrics"), dict) else 0,
        "report": enriched_report,
    }


def _missing_case(case: Mapping[str, str]) -> dict[str, Any]:
    missing_report = {
        "scenarioId": case["scenarioId"],
        "scenarioLabel": case.get("label") or case["scenarioId"],
        "kind": case["kind"],
        "status": "needs_review",
        "score": 0,
        "checks": [
            {
                "key": "gauntlet_artifact_present",
                "label": "Gauntlet artifact present",
                "status": "needs_review",
                "score": 0,
                "findings": [
                    {
                        "severity": "warning",
                        "message": "No generated artifact was supplied for this gauntlet scenario.",
                    }
                ],
                "metrics": {},
            }
        ],
        "metrics": {"failedCheckCount": 0, "needsReviewCheckCount": 1},
    }
    return {
        "key": _scenario_key(case["kind"], case["scenarioId"]),
        "kind": case["kind"],
        "scenarioId": case["scenarioId"],
        "label": case.get("label") or case["scenarioId"],
        "domain": case.get("domain"),
        "inputMix": case.get("inputMix"),
        "status": "needs_review",
        "score": 0,
        "gapClass": "missing_artifact",
        "failedCheckCount": 0,
        "needsReviewCheckCount": 1,
        "report": missing_report,
    }


def evaluate_generation_gauntlet(
    *,
    course_artifacts: Mapping[str, Mapping[str, Any]] | None = None,
    program_artifacts: Mapping[str, Mapping[str, Any]] | None = None,
    cases: Sequence[Mapping[str, str]] = DEFAULT_GAUNTLET_CASES,
) -> dict[str, Any]:
    """Evaluate generated course/program artifacts against the native Lycium gauntlet.

    The gauntlet is intentionally artifact-oriented. It does not know how an artifact
    was generated, which keeps it usable for local models, cloud providers, fixtures,
    future Infring primitives, and human-authored drafts.
    """

    course_artifacts = course_artifacts or {}
    program_artifacts = program_artifacts or {}
    results: list[dict[str, Any]] = []

    for case in cases:
        kind = case["kind"]
        scenario_id = case["scenarioId"]
        if kind == "course":
            artifact = course_artifacts.get(scenario_id)
            if artifact is None:
                results.append(_missing_case(case))
                continue
            results.append(_case_result(case, evaluate_course_generation_scenario(dict(artifact), scenario_id)))
            continue
        if kind == "program":
            artifact = program_artifacts.get(scenario_id)
            if artifact is None:
                results.append(_missing_case(case))
                continue
            results.append(_case_result(case, evaluate_program_generation_scenario(dict(artifact), scenario_id)))
            continue
        raise ValueError(f"Unsupported gauntlet case kind: {kind}")

    gap_counts: dict[str, int] = {}
    for result in results:
        gap_class = result.get("gapClass")
        if isinstance(gap_class, str) and gap_class:
            gap_counts[gap_class] = gap_counts.get(gap_class, 0) + 1

    return {
        "contractVersion": GAUNTLET_VERSION,
        "status": _status_from_children(results),
        "score": _score_from_children(results),
        "cases": results,
        "metrics": {
            "caseCount": len(results),
            "passedCount": sum(1 for result in results if result.get("status") == "passed"),
            "needsReviewCount": sum(1 for result in results if result.get("status") == "needs_review"),
            "failedCount": sum(1 for result in results if result.get("status") == "failed"),
            "gapCounts": gap_counts,
        },
    }


def evaluate_generation_gauntlet_bundle(bundle: Mapping[str, Any]) -> dict[str, Any]:
    """Evaluate a real generated-artifact bundle.

    Bundle shape:
    {
      "contractVersion": "course-generation-gauntlet-input-v1",
      "metadata": {"provider": "...", "model": "..."},
      "courses": {"scenario-id": {...}},
      "programs": {"scenario-id": {...}}
    }
    """

    courses = bundle.get("courses") or bundle.get("courseArtifacts") or {}
    programs = bundle.get("programs") or bundle.get("programArtifacts") or {}
    if not isinstance(courses, Mapping):
        raise ValueError("Gauntlet bundle courses must be an object keyed by scenario id.")
    if not isinstance(programs, Mapping):
        raise ValueError("Gauntlet bundle programs must be an object keyed by scenario id.")
    report = evaluate_generation_gauntlet(
        course_artifacts={str(key): value for key, value in courses.items() if isinstance(value, Mapping)},
        program_artifacts={str(key): value for key, value in programs.items() if isinstance(value, Mapping)},
    )
    metadata = bundle.get("metadata")
    if isinstance(metadata, Mapping):
        report["metadata"] = dict(metadata)
    report["inputContractVersion"] = bundle.get("contractVersion") or GAUNTLET_INPUT_VERSION
    return report


def gauntlet_eval_reports(gauntlet_report: Mapping[str, Any]) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []
    cases = gauntlet_report.get("cases")
    if not isinstance(cases, list):
        return reports
    for case in cases:
        if not isinstance(case, Mapping):
            continue
        report = case.get("report")
        if isinstance(report, Mapping):
            reports.append(dict(report))
    return reports
