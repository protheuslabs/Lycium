from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.course_generation_gauntlet import evaluate_generation_gauntlet_bundle, gauntlet_eval_reports
from app.generation_eval_reports import build_generation_eval_run, build_generation_eval_trend, load_generation_eval_runs, write_generation_eval_run


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Gauntlet input must be a JSON object.")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Write a Lycium generation gauntlet report for generated artifacts.")
    parser.add_argument("--input", required=True, help="Path to a course-generation-gauntlet-input-v1 JSON bundle.")
    parser.add_argument("--report-dir", default=None, help="Optional report directory. Defaults to LYCIUM_EVAL_REPORT_DIR or .lycium-local/eval-runs.")
    args = parser.parse_args([argument for argument in sys.argv[1:] if argument != "--"])

    bundle = _load_json(Path(args.input))
    gauntlet_report = evaluate_generation_gauntlet_bundle(bundle)
    reports = gauntlet_eval_reports(gauntlet_report)
    run = build_generation_eval_run(
        reports,
        metadata={
            "trigger": "gauntlet-artifact-report",
            "inputPath": str(Path(args.input)),
            **(gauntlet_report.get("metadata") if isinstance(gauntlet_report.get("metadata"), dict) else {}),
        },
        gauntlet_report=gauntlet_report,
    )
    run_path = write_generation_eval_run(run, args.report_dir)
    trend = build_generation_eval_trend(load_generation_eval_runs(args.report_dir))

    print(
        json.dumps(
            {
                "runPath": str(run_path),
                "summary": run["summary"],
                "gauntlet": run["gauntlet"],
                "trend": trend,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
