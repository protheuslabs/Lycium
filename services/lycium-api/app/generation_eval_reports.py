from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


GENERATION_EVAL_REPORT_KIND = "lycium.generationEvalRun"
GENERATION_EVAL_TREND_KIND = "lycium.generationEvalTrend"
GENERATION_EVAL_SCHEMA_VERSION = 1
DEFAULT_REPORT_KEEP_COUNT = 20


def default_generation_eval_report_dir() -> Path:
    configured = os.environ.get("LYCIUM_EVAL_REPORT_DIR")
    return Path(configured) if configured else Path(".lycium-local/eval-runs")


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _number(value: Any, fallback: float = 0.0) -> float:
    return float(value) if isinstance(value, int | float) else fallback


def _scenario_row(report: dict[str, Any]) -> dict[str, Any]:
    metrics = report.get("metrics") if isinstance(report.get("metrics"), dict) else {}
    checks = [
        {
            "key": str(check.get("key") or check.get("gate") or "unknown"),
            "status": str(check.get("status") or "unknown"),
            "score": round(_number(check.get("score")), 4),
        }
        for check in _items(report.get("checks"))
    ]
    return {
        "scenarioId": str(report.get("scenarioId") or "unknown"),
        "scenarioLabel": str(report.get("scenarioLabel") or report.get("scenarioId") or "Unknown scenario"),
        "kind": str(report.get("kind") or "unknown"),
        "status": str(report.get("status") or "unknown"),
        "score": round(_number(report.get("score")), 4),
        "failedCheckCount": int(metrics.get("failedCheckCount") or 0),
        "needsReviewCheckCount": int(metrics.get("needsReviewCheckCount") or 0),
        "checks": checks,
    }


def _summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [_number(row.get("score")) for row in rows]
    return {
        "scenarioCount": len(rows),
        "passedCount": sum(1 for row in rows if row.get("status") == "passed"),
        "needsReviewCount": sum(1 for row in rows if row.get("status") == "needs_review"),
        "failedCount": sum(1 for row in rows if row.get("status") == "failed"),
        "averageScore": round(sum(scores) / len(scores), 4) if scores else 0,
        "minimumScore": round(min(scores), 4) if scores else 0,
    }


def _gauntlet_summary(report: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(report, dict):
        return None
    metrics = report.get("metrics") if isinstance(report.get("metrics"), dict) else {}
    cases = [
        {
            "key": str(case.get("key") or "unknown"),
            "scenarioId": str(case.get("scenarioId") or "unknown"),
            "kind": str(case.get("kind") or "unknown"),
            "status": str(case.get("status") or "unknown"),
            "score": round(_number(case.get("score")), 4),
            "gapClass": case.get("gapClass"),
        }
        for case in _items(report.get("cases"))
    ]
    return {
        "contractVersion": report.get("contractVersion"),
        "status": str(report.get("status") or "unknown"),
        "score": round(_number(report.get("score")), 4),
        "caseCount": int(metrics.get("caseCount") or len(cases)),
        "kindCounts": metrics.get("kindCounts") if isinstance(metrics.get("kindCounts"), dict) else {},
        "domainCounts": metrics.get("domainCounts") if isinstance(metrics.get("domainCounts"), dict) else {},
        "inputMixCounts": metrics.get("inputMixCounts") if isinstance(metrics.get("inputMixCounts"), dict) else {},
        "passedCount": int(metrics.get("passedCount") or 0),
        "needsReviewCount": int(metrics.get("needsReviewCount") or 0),
        "failedCount": int(metrics.get("failedCount") or 0),
        "gapCounts": metrics.get("gapCounts") if isinstance(metrics.get("gapCounts"), dict) else {},
        "cases": cases,
    }


def build_generation_eval_run(
    reports: list[dict[str, Any]],
    *,
    run_id: str | None = None,
    created_at: str | None = None,
    metadata: dict[str, Any] | None = None,
    gauntlet_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    scenario_rows = [_scenario_row(report) for report in reports]
    return {
        "kind": GENERATION_EVAL_REPORT_KIND,
        "schemaVersion": GENERATION_EVAL_SCHEMA_VERSION,
        "runId": run_id or f"eval-{uuid4().hex[:12]}",
        "createdAt": created_at or _utc_now(),
        "summary": _summary(scenario_rows),
        "scenarios": scenario_rows,
        "reports": reports,
        "gauntlet": _gauntlet_summary(gauntlet_report),
        "gauntletReport": gauntlet_report,
        "metadata": metadata or {},
    }


def _safe_run_filename(run: dict[str, Any]) -> str:
    created_at = str(run.get("createdAt") or _utc_now())
    safe_timestamp = "".join(character for character in created_at if character.isalnum())
    run_id = "".join(character for character in str(run.get("runId") or "eval") if character.isalnum() or character in "-_")
    return f"run-{safe_timestamp}-{run_id}.json"


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(f"{json.dumps(payload, indent=2, sort_keys=True)}\n", encoding="utf-8")


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def write_generation_eval_run(
    run: dict[str, Any],
    report_dir: str | Path | None = None,
    *,
    keep: int = DEFAULT_REPORT_KEEP_COUNT,
) -> Path:
    target_dir = Path(report_dir) if report_dir is not None else default_generation_eval_report_dir()
    target_dir.mkdir(parents=True, exist_ok=True)
    run_path = target_dir / _safe_run_filename(run)
    _write_json(run_path, run)
    _write_json(target_dir / "latest.json", run)
    _write_index(target_dir, keep=keep)
    return run_path


def _run_paths(report_dir: Path) -> list[Path]:
    return sorted(report_dir.glob("run-*.json"), key=lambda path: path.name, reverse=True)


def _write_index(report_dir: Path, *, keep: int) -> None:
    paths = _run_paths(report_dir)
    retained = paths[: max(1, keep)]
    for stale_path in paths[len(retained):]:
        stale_path.unlink(missing_ok=True)
    runs = []
    for path in retained:
        run = _read_json(path)
        if run:
            runs.append(
                {
                    "runId": run.get("runId"),
                    "createdAt": run.get("createdAt"),
                    "summary": run.get("summary"),
                    "gauntlet": run.get("gauntlet"),
                    "path": path.name,
                }
            )
    _write_json(
        report_dir / "index.json",
        {
            "kind": "lycium.generationEvalRunIndex",
            "schemaVersion": GENERATION_EVAL_SCHEMA_VERSION,
            "updatedAt": _utc_now(),
            "runs": runs,
        },
    )


def load_generation_eval_runs(report_dir: str | Path | None = None, *, limit: int = DEFAULT_REPORT_KEEP_COUNT) -> list[dict[str, Any]]:
    target_dir = Path(report_dir) if report_dir is not None else default_generation_eval_report_dir()
    runs = [_read_json(path) for path in _run_paths(target_dir)[:limit]]
    return [run for run in runs if run and run.get("kind") == GENERATION_EVAL_REPORT_KIND]


def build_generation_eval_trend(runs: list[dict[str, Any]]) -> dict[str, Any]:
    ordered = sorted(runs, key=lambda run: str(run.get("createdAt") or ""))
    latest = ordered[-1] if ordered else {}
    previous = ordered[-2] if len(ordered) > 1 else {}
    previous_rows = {
        str(row.get("scenarioId")): row
        for row in _items(previous.get("scenarios"))
    }
    scenario_trends = []
    for row in _items(latest.get("scenarios")):
        scenario_id = str(row.get("scenarioId"))
        previous_row = previous_rows.get(scenario_id)
        score = _number(row.get("score"))
        previous_score = _number(previous_row.get("score")) if previous_row else None
        scenario_trends.append(
            {
                "scenarioId": scenario_id,
                "scenarioLabel": row.get("scenarioLabel"),
                "status": row.get("status"),
                "previousStatus": previous_row.get("status") if previous_row else None,
                "score": round(score, 4),
                "previousScore": round(previous_score, 4) if previous_score is not None else None,
                "scoreDelta": round(score - previous_score, 4) if previous_score is not None else None,
            }
        )
    return {
        "kind": GENERATION_EVAL_TREND_KIND,
        "schemaVersion": GENERATION_EVAL_SCHEMA_VERSION,
        "runCount": len(ordered),
        "latestRunId": latest.get("runId"),
        "previousRunId": previous.get("runId"),
        "latestSummary": latest.get("summary", {}),
        "latestGauntlet": latest.get("gauntlet") or {},
        "scenarioTrends": scenario_trends,
    }
