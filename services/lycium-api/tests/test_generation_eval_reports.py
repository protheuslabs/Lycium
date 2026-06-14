from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from app.course_generation_gauntlet import evaluate_generation_gauntlet
from app.course_generation_scenarios import evaluate_course_generation_scenario, evaluate_program_generation_scenario
from app.generation_eval_reports import (
    build_generation_eval_run,
    build_generation_eval_trend,
    load_generation_eval_runs,
    write_generation_eval_run,
)
from tests.course_generation_fixture_builders import (
    chem_105_flagship_course_from_scenario,
    source_backed_course_from_scenario,
    under_sourced_course_draft_from_scenario,
)
from tests.test_program_generation_eval_scenarios import _generated_program_from_scenario


REPO_ROOT = Path(__file__).resolve().parents[3]
GAUNTLET_PROGRAM_SCENARIOS = (
    "chemistry-foundations-program",
    "data-science-analytics-program",
    "public-health-foundations-program",
    "pre-medical-preparation-program",
)


def _noisy_source_report() -> dict[str, Any]:
    course = source_backed_course_from_scenario("intro-programming-foundations")
    course["metadata"]["sourceCorpusSynthesis"] = {
        "includedSources": ["source-primary", "source-video"],
        "excludedSources": ["source-unrelated-recipe", "source-vacation-blog"],
        "commonThemes": ["variables", "functions", "testing"],
    }
    report = evaluate_course_generation_scenario(course, "intro-programming-foundations")
    return {
        **report,
        "scenarioId": "multi-source-noisy-corpus",
        "scenarioLabel": "Multi-source noisy corpus",
    }


def _fixed_generation_eval_reports() -> list[dict[str, Any]]:
    full_stack_program = json.loads((REPO_ROOT / "packages/contracts/fixtures/full-stack-engineer-program.json").read_text())
    return [
        evaluate_course_generation_scenario(chem_105_flagship_course_from_scenario(), "chem-105-general-chemistry"),
        evaluate_course_generation_scenario(source_backed_course_from_scenario("intro-programming-foundations"), "intro-programming-foundations"),
        evaluate_program_generation_scenario(full_stack_program, "full-stack-software-engineer-program"),
        evaluate_program_generation_scenario(
            _generated_program_from_scenario("pre-medical-preparation-program"),
            "pre-medical-preparation-program",
        ),
        _noisy_source_report(),
        evaluate_course_generation_scenario(under_sourced_course_draft_from_scenario(), "under-sourced-course-prompt"),
    ]


def _fixed_generation_gauntlet_report() -> dict[str, Any]:
    full_stack_program = json.loads((REPO_ROOT / "packages/contracts/fixtures/full-stack-engineer-program.json").read_text())
    return evaluate_generation_gauntlet(
        course_artifacts={
            "chem-105-general-chemistry": chem_105_flagship_course_from_scenario(),
            "intro-programming-foundations": source_backed_course_from_scenario("intro-programming-foundations"),
            "software-engineering-methods": source_backed_course_from_scenario("software-engineering-methods"),
            "under-sourced-course-prompt": under_sourced_course_draft_from_scenario(),
        },
        program_artifacts={
            "full-stack-software-engineer-program": full_stack_program,
            **{scenario_id: _generated_program_from_scenario(scenario_id) for scenario_id in GAUNTLET_PROGRAM_SCENARIOS},
        },
    )


def test_generation_eval_reports_are_persisted_and_trendable(tmp_path: Path) -> None:
    reports = _fixed_generation_eval_reports()
    gauntlet_report = _fixed_generation_gauntlet_report()
    first_run = build_generation_eval_run(
        reports,
        run_id="eval-run-1",
        created_at="2026-06-06T00:00:00Z",
        metadata={"trigger": "pytest"},
        gauntlet_report=gauntlet_report,
    )
    second_reports = copy.deepcopy(reports)
    second_reports[0]["score"] = 0.97
    second_run = build_generation_eval_run(
        second_reports,
        run_id="eval-run-2",
        created_at="2026-06-06T00:01:00Z",
        metadata={"trigger": "pytest"},
        gauntlet_report=gauntlet_report,
    )

    first_path = write_generation_eval_run(first_run, tmp_path, keep=5)
    second_path = write_generation_eval_run(second_run, tmp_path, keep=5)
    loaded_runs = load_generation_eval_runs(tmp_path)
    trend = build_generation_eval_trend(loaded_runs)

    assert first_path.exists()
    assert second_path.exists()
    assert (tmp_path / "latest.json").exists()
    assert (tmp_path / "index.json").exists()
    assert len(loaded_runs) == 2
    assert loaded_runs[0]["runId"] == "eval-run-2"
    assert trend["latestRunId"] == "eval-run-2"
    assert trend["latestSummary"]["scenarioCount"] == 6
    assert trend["latestSummary"]["failedCount"] == 0
    assert trend["latestGauntlet"]["status"] == "passed"
    assert trend["latestGauntlet"]["caseCount"] == 9
    assert trend["latestGauntlet"]["kindCounts"] == {"course": 4, "program": 5}
    assert trend["latestGauntlet"]["domainCounts"]["data and analytics"] == 1
    assert trend["latestGauntlet"]["domainCounts"]["health sciences"] == 1
    assert trend["latestGauntlet"]["domainCounts"]["public health"] == 1
    assert loaded_runs[0]["gauntlet"]["status"] == "passed"
    assert loaded_runs[0]["gauntletReport"]["contractVersion"] == "course-generation-gauntlet-v1"
    assert {row["scenarioId"] for row in trend["scenarioTrends"]} >= {
        "chem-105-general-chemistry",
        "intro-programming-foundations",
        "full-stack-software-engineer-program",
        "pre-medical-preparation-program",
        "multi-source-noisy-corpus",
        "under-sourced-course-prompt",
    }
    chem_trend = next(row for row in trend["scenarioTrends"] if row["scenarioId"] == "chem-105-general-chemistry")
    assert chem_trend["scoreDelta"] is not None


def test_generation_eval_trend_route_reads_persisted_reports(client, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("LYCIUM_EVAL_REPORT_DIR", str(tmp_path))
    reports = _fixed_generation_eval_reports()
    run = build_generation_eval_run(
        reports,
        run_id="eval-route-run",
        created_at="2026-06-06T00:02:00Z",
        metadata={"trigger": "route-test"},
        gauntlet_report=_fixed_generation_gauntlet_report(),
    )
    write_generation_eval_run(run, tmp_path, keep=5)

    response = client.get("/v1/generation-evals/trend")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["trend"]["latestRunId"] == "eval-route-run"
    assert payload["trend"]["latestSummary"]["scenarioCount"] == 6
    assert payload["trend"]["latestGauntlet"]["status"] == "passed"
    assert payload["runs"][0]["runId"] == "eval-route-run"
    assert payload["runs"][0]["gauntlet"]["caseCount"] == 9
