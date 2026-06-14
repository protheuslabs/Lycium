from __future__ import annotations

import json
import sys
from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.generation_eval_reports import build_generation_eval_run, build_generation_eval_trend, load_generation_eval_runs, write_generation_eval_run
from tests.test_generation_eval_reports import _fixed_generation_eval_reports, _fixed_generation_gauntlet_report


def main() -> None:
    reports = _fixed_generation_eval_reports()
    run = build_generation_eval_run(
        reports,
        metadata={"trigger": "manual-report"},
        gauntlet_report=_fixed_generation_gauntlet_report(),
    )
    run_path = write_generation_eval_run(run)
    trend = build_generation_eval_trend(load_generation_eval_runs())

    print(json.dumps({
        "runPath": str(run_path),
        "summary": run["summary"],
        "trend": trend,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
