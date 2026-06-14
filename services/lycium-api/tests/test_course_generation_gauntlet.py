from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from app.course_generation_gauntlet import evaluate_generation_gauntlet, evaluate_generation_gauntlet_bundle, gauntlet_eval_reports
from tests.course_generation_fixture_builders import (
    chem_105_flagship_course_from_scenario,
    source_backed_course_from_scenario,
    under_sourced_course_draft_from_scenario,
)


def _program_fixture() -> dict[str, Any]:
    requirement_groups = [
        {
            "id": "group-foundations",
            "displayName": "Foundations",
            "groupKind": "cluster",
            "requirements": [
                {"id": "req-command-line", "type": "complete_course", "title": "Command Line", "courseId": "command-line"},
                {"id": "req-git", "type": "complete_course", "title": "Git and GitHub", "courseId": "git-github"},
                {"id": "req-computing-basics", "type": "complete_course", "title": "Computing Basics", "courseId": "computing-basics"},
            ],
            "completionRule": {"type": "complete_all"},
        },
        {
            "id": "group-programming-core",
            "displayName": "Programming Core",
            "groupKind": "cluster",
            "requirements": [
                {"id": "req-js", "type": "complete_course", "title": "JavaScript Fundamentals", "courseId": "javascript-fundamentals"},
                {"id": "req-ts", "type": "complete_course", "title": "TypeScript Fundamentals", "courseId": "typescript-fundamentals"},
                {"id": "req-data-structures", "type": "complete_course", "title": "Data Structures", "courseId": "data-structures"},
                {"id": "req-programming-assessment", "type": "pass_assessment", "title": "Programming Assessment", "assessmentId": "programming-assessment"},
            ],
            "completionRule": {"type": "complete_all"},
        },
        {
            "id": "group-frontend",
            "displayName": "Frontend Engineering",
            "groupKind": "cluster",
            "requirements": [
                {"id": "req-html-css", "type": "complete_course", "title": "HTML and CSS", "courseId": "html-css"},
                {"id": "req-react", "type": "complete_course", "title": "React", "courseId": "react"},
                {"id": "req-frontend-testing", "type": "complete_course", "title": "Frontend Testing", "courseId": "frontend-testing"},
                {"id": "req-accessibility", "type": "complete_course", "title": "Accessibility", "courseId": "accessibility"},
            ],
            "completionRule": {"type": "complete_all"},
        },
        {
            "id": "group-backend-data",
            "displayName": "Backend and Data",
            "groupKind": "cluster",
            "requirements": [
                {"id": "req-http", "type": "complete_course", "title": "HTTP APIs", "courseId": "http-apis"},
                {"id": "req-authentication", "type": "complete_course", "title": "Authentication", "courseId": "authentication"},
                {"id": "req-api-security", "type": "complete_course", "title": "API Security", "courseId": "api-security"},
                {"id": "req-sql", "type": "complete_course", "title": "SQL", "courseId": "sql"},
                {"id": "req-database-design", "type": "complete_course", "title": "Database Design", "courseId": "database-design"},
            ],
            "completionRule": {"type": "complete_all"},
        },
        {
            "id": "group-delivery",
            "displayName": "Delivery and Operations",
            "groupKind": "cluster",
            "requirements": [
                {"id": "req-docker", "type": "complete_course", "title": "Docker", "courseId": "docker"},
                {"id": "req-ci-cd", "type": "complete_course", "title": "CI/CD", "courseId": "ci-cd"},
                {"id": "req-cloud-deployment", "type": "complete_course", "title": "Cloud Deployment", "courseId": "cloud-deployment"},
            ],
            "completionRule": {"type": "complete_all"},
        },
        {
            "id": "group-specialization",
            "displayName": "Specialization Elective",
            "groupKind": "elective_pool",
            "requirements": [
                {
                    "id": "req-specialization-choice",
                    "type": "complete_n_of_courses",
                    "title": "Choose one specialization course",
                    "count": 1,
                    "courseIds": ["ai-app-development", "advanced-backend", "devops-foundations"],
                },
                {"id": "req-systems-design", "type": "complete_course", "title": "Systems Design", "courseId": "systems-design"},
            ],
            "completionRule": {"type": "complete_all"},
        },
        {
            "id": "group-capstone",
            "displayName": "Capstone and Portfolio",
            "groupKind": "capstone",
            "requirements": [
                {"id": "req-capstone-project", "type": "submit_project", "title": "Full-Stack Capstone", "projectId": "full-stack-capstone"},
                {"id": "req-portfolio-review", "type": "pass_assessment", "title": "Portfolio Review", "assessmentId": "portfolio-review"},
            ],
            "completionRule": {"type": "complete_all"},
        },
    ]
    return {
        "program": {
            "id": "full-stack-software-engineer",
            "title": "Full-Stack Software Engineer Program",
            "description": "A source-backed program fixture for the generation gauntlet.",
            "programType": "career_path",
            "field": "Software Engineering",
            "level": "professional",
            "targetOutcome": "Prepare learners for junior full-stack engineering work.",
            "learningOutcomes": [
                {"id": "outcome-build", "statement": "Build and deploy full-stack applications."},
                {"id": "outcome-review", "statement": "Review software tradeoffs with source-backed reasoning."},
            ],
            "entryRequirements": [],
            "requirementGroups": requirement_groups,
            "dependencyGraph": {
                "edges": [
                    {"fromNodeId": "group-foundations", "toNodeId": "group-programming-core", "type": "required"},
                    {"fromNodeId": "group-programming-core", "toNodeId": "group-frontend", "type": "required"},
                    {"fromNodeId": "group-programming-core", "toNodeId": "group-backend-data", "type": "required"},
                    {"fromNodeId": "group-backend-data", "toNodeId": "group-delivery", "type": "required"},
                    {"fromNodeId": "group-delivery", "toNodeId": "group-capstone", "type": "required"},
                ]
            },
            "estimatedHours": 420,
            "masteryPolicy": {"type": "minimum_percent", "minimumPercent": 80},
            "credentialPolicy": {"credentialType": "portfolio_certificate", "requiresCapstone": True},
            "reviewStatus": "draft",
        }
    }


def test_generation_gauntlet_accepts_complete_artifacts() -> None:
    report = evaluate_generation_gauntlet(
        course_artifacts={
            "chem-105-general-chemistry": chem_105_flagship_course_from_scenario(),
            "intro-programming-foundations": source_backed_course_from_scenario("intro-programming-foundations"),
            "software-engineering-methods": source_backed_course_from_scenario("software-engineering-methods"),
            "under-sourced-course-prompt": under_sourced_course_draft_from_scenario(),
        },
        program_artifacts={"full-stack-software-engineer-program": _program_fixture()},
    )

    assert report["contractVersion"] == "course-generation-gauntlet-v1"
    assert report["status"] == "passed"
    assert report["metrics"]["caseCount"] == 5
    assert report["metrics"]["passedCount"] == 5
    assert report["metrics"]["gapCounts"] == {}


def test_generation_gauntlet_marks_missing_artifacts_as_review_needed() -> None:
    report = evaluate_generation_gauntlet(
        course_artifacts={
            "chem-105-general-chemistry": chem_105_flagship_course_from_scenario(),
        },
        program_artifacts={},
    )

    assert report["status"] == "needs_review"
    assert report["metrics"]["needsReviewCount"] == 4
    assert report["metrics"]["gapCounts"]["missing_artifact"] == 4


def test_generation_gauntlet_bundle_preserves_run_metadata_and_case_reports() -> None:
    report = evaluate_generation_gauntlet_bundle(
        {
            "contractVersion": "course-generation-gauntlet-input-v1",
            "metadata": {
                "provider": "fixture-provider",
                "model": "fixture-model",
                "inputMix": "prompt+urls+files",
            },
            "courses": {
                "chem-105-general-chemistry": chem_105_flagship_course_from_scenario(),
            },
            "programs": {},
        }
    )
    reports = gauntlet_eval_reports(report)

    assert report["inputContractVersion"] == "course-generation-gauntlet-input-v1"
    assert report["metadata"]["provider"] == "fixture-provider"
    assert report["status"] == "needs_review"
    assert report["metrics"]["gapCounts"]["missing_artifact"] == 4
    assert {case_report["scenarioId"] for case_report in reports} >= {
        "chem-105-general-chemistry",
        "intro-programming-foundations",
        "full-stack-software-engineer-program",
    }


def test_generation_gauntlet_bundle_treats_empty_placeholders_as_missing() -> None:
    report = evaluate_generation_gauntlet_bundle(
        {
            "contractVersion": "course-generation-gauntlet-input-v1",
            "metadata": {"provider": "fixture-provider", "model": "fixture-model"},
            "courses": {"chem-105-general-chemistry": {}},
            "programs": {"full-stack-software-engineer-program": {}},
        }
    )

    assert report["status"] == "needs_review"
    assert report["metrics"]["gapCounts"]["missing_artifact"] == 5
    assert all(case["gapClass"] == "missing_artifact" for case in report["cases"])


def test_generation_gauntlet_report_script_writes_persistent_run(tmp_path: Path) -> None:
    service_root = Path(__file__).resolve().parents[1]
    input_path = tmp_path / "gauntlet-input.json"
    report_dir = tmp_path / "eval-runs"
    input_path.write_text(
        json.dumps(
            {
                "contractVersion": "course-generation-gauntlet-input-v1",
                "metadata": {"provider": "fixture-provider", "model": "fixture-model"},
                "courses": {"chem-105-general-chemistry": chem_105_flagship_course_from_scenario()},
                "programs": {},
            }
        ),
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            sys.executable,
            "scripts/write_generation_gauntlet_report.py",
            "--input",
            str(input_path),
            "--report-dir",
            str(report_dir),
        ],
        cwd=service_root,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)

    assert Path(payload["runPath"]).exists()
    assert payload["gauntlet"]["status"] == "needs_review"
    assert payload["gauntlet"]["gapCounts"]["missing_artifact"] == 4
    assert (report_dir / "latest.json").exists()
    assert (report_dir / "index.json").exists()
