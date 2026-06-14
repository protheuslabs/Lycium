from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parent
SERVICE_ROOT = SCRIPT_ROOT.parents[0]
sys.path.insert(0, str(SERVICE_ROOT))
sys.path.insert(0, str(SCRIPT_ROOT))

from app.course_generation_gauntlet import evaluate_generation_gauntlet_bundle, gauntlet_eval_reports
from app.generation_eval_reports import build_generation_eval_run, build_generation_eval_trend, load_generation_eval_runs, write_generation_eval_run
from build_generation_gauntlet_bundle import build_bundle


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build and score a Lycium generation gauntlet bundle from generated artifact files.")
    parser.add_argument("--course", action="append", default=[], help="Course artifact as scenario-id=path/to/course.json. May be repeated.")
    parser.add_argument("--program", action="append", default=[], help="Program artifact as scenario-id=path/to/program.json. May be repeated.")
    parser.add_argument("--metadata", action="append", default=[], help="Metadata as key=value. May be repeated.")
    parser.add_argument("--provider", default=None, help="Provider that generated the artifacts.")
    parser.add_argument("--model", default=None, help="Model that generated the artifacts.")
    parser.add_argument("--prompt", default=None, help="Prompt or prompt summary used for the generation run.")
    parser.add_argument("--input-mix", default=None, help="Input mix label, such as prompt+urls+files.")
    parser.add_argument("--manifest", default=None, help="Optional gauntlet manifest path. Defaults are used when omitted.")
    parser.add_argument("--bundle-output", default=None, help="Optional path to persist the generated gauntlet input bundle.")
    parser.add_argument("--report-dir", default=None, help="Optional report directory. Defaults to LYCIUM_EVAL_REPORT_DIR or .lycium-local/eval-runs.")
    return parser


def main() -> None:
    args = _parser().parse_args([argument for argument in sys.argv[1:] if argument != "--"])
    bundle = build_bundle(args)
    if args.bundle_output:
        bundle_path = Path(args.bundle_output)
        bundle_path.parent.mkdir(parents=True, exist_ok=True)
        bundle_path.write_text(f"{json.dumps(bundle, indent=2, sort_keys=True)}\n", encoding="utf-8")

    gauntlet_report = evaluate_generation_gauntlet_bundle(bundle)
    run = build_generation_eval_run(
        gauntlet_eval_reports(gauntlet_report),
        metadata={
            "trigger": "gauntlet-artifact-run",
            **(gauntlet_report.get("metadata") if isinstance(gauntlet_report.get("metadata"), dict) else {}),
        },
        gauntlet_report=gauntlet_report,
    )
    run_path = write_generation_eval_run(run, args.report_dir)
    trend = build_generation_eval_trend(load_generation_eval_runs(args.report_dir))

    print(
        json.dumps(
            {
                "bundlePath": args.bundle_output,
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
