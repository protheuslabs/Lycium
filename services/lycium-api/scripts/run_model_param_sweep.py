#!/usr/bin/env python3
"""Run a bounded course-generation sweep across local/cloud model names.

This script is intentionally outside CI. It is for local evidence gathering when
we want to compare model sizes/capability classes against the same course task.
It calls the staged experiment endpoint with a per-stage timeout and writes a
small JSON report under .lycium-local/reports/.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_API_BASE = "http://127.0.0.1:8000"
DEFAULT_MODELS = ["qwen2.5:3b", "llama3.1:8b", "llama3.1:70b", "kimi-k2.6:cloud"]


CHEMISTRY_ARTIFACTS = [
    {
        "id": "chem105-syllabus-outline",
        "filename": "chem105-syllabus-outline.txt",
        "mimeType": "text/plain",
        "text": """
CHEM 105 General Chemistry I introduces measurement, dimensional analysis, atomic structure, periodic trends,
chemical bonding, molecular geometry, stoichiometry, thermochemistry, gases, and aqueous reactions. Laboratory
work emphasizes safety, measurement, data analysis, calorimetry, titration, and communicating results.
Learning outcomes include solving quantitative chemistry problems, explaining structure-property relationships,
writing balanced chemical equations, interpreting lab data, and connecting microscopic models to macroscopic
observations.
""".strip(),
    },
    {
        "id": "chem105-open-textbook-excerpt",
        "filename": "chem105-open-textbook-excerpt.txt",
        "mimeType": "text/plain",
        "text": """
Core topics: significant figures, unit conversion, isotopes, mole concept, empirical formulas, limiting reactants,
solution concentration, enthalpy, ideal gas law, electron configuration, periodic properties, Lewis structures,
VSEPR geometry, polarity, intermolecular forces, precipitation reactions, acid-base reactions, oxidation-reduction,
and laboratory uncertainty.
""".strip(),
    },
    {
        "id": "chem105-lab-sequence",
        "filename": "chem105-lab-sequence.txt",
        "mimeType": "text/plain",
        "text": """
Representative labs: chemical safety orientation, density and measurement uncertainty, hydrate composition,
stoichiometry of a precipitation reaction, coffee-cup calorimetry, gas collection over water, acid-base titration,
and qualitative analysis of ions. Lab assessment uses pre-lab questions, data tables, calculations, claim-evidence-
reasoning conclusions, and short error analyses.
""".strip(),
    },
]

from model_sweep_micro import (  # noqa: E402
    model_deadline,
    post_json,
    run_micro_benchmark,
    summarize_result,
)
from model_sweep_composition import run_composed_one_module_benchmark  # noqa: E402


def run_model(api_base: str, model: str, args: argparse.Namespace) -> dict[str, Any]:
    if args.task in {"plan", "section", "quiz", "all-micro"}:
        return run_micro_benchmark(model, args)
    if args.task == "one-module":
        return run_composed_one_module_benchmark(model, args)
    micro_gate = None
    module_count = args.modules

    payload = {
        "prompt": args.prompt,
        "level": args.level,
        "language": "en",
        "model": model,
        "source_policy": "balanced",
        "category": args.category,
        "department": args.department,
        "desired_module_count": module_count,
        "expected_duration_minutes": args.duration_minutes,
        "max_stage_timeout_seconds": args.stage_timeout,
        "input_artifacts": CHEMISTRY_ARTIFACTS,
    }
    started = time.monotonic()
    try:
        with model_deadline(args.per_model_timeout):
            result = post_json(
                api_base,
                "/v1/agent/courses/experiment/staged",
                payload,
                timeout=max(args.http_timeout, int(args.stage_timeout * (module_count + 4))),
            )
        summary = summarize_result(model, time.monotonic() - started, result)
        if micro_gate is not None:
            summary["micro_gate"] = micro_gate
            summary["benchmark_mode"] = "one-module-after-all-micro"
        return summary
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        staged_elapsed_seconds = round(time.monotonic() - started, 2)
        gate_elapsed_seconds = float(micro_gate.get("elapsed_seconds") or 0.0) if micro_gate else 0.0
        detail = None
        if isinstance(exc, urllib.error.HTTPError):
            try:
                detail = exc.read().decode("utf-8")
            except Exception:
                detail = None
        return {
            "model": model,
            "ok": False,
            "accepted": False,
            "elapsed_seconds": round(gate_elapsed_seconds + staged_elapsed_seconds, 2),
            "staged_elapsed_seconds": staged_elapsed_seconds,
            "error": str(exc),
            "detail": detail,
            "micro_gate": micro_gate,
            "benchmark_mode": "one-module-after-all-micro" if micro_gate is not None else args.task,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a bounded Lycium model parameter sweep.")
    parser.add_argument("--api-base", default=DEFAULT_API_BASE)
    parser.add_argument("--models", nargs="+", default=DEFAULT_MODELS)
    parser.add_argument("--modules", type=int, default=1)
    parser.add_argument("--duration-minutes", type=int, default=90)
    parser.add_argument("--stage-timeout", type=float, default=90.0)
    parser.add_argument("--http-timeout", type=int, default=420)
    parser.add_argument("--per-model-timeout", type=float, default=180.0)
    parser.add_argument("--task", choices=["full-course", "one-module", "plan", "section", "quiz", "all-micro"], default="full-course")
    parser.add_argument("--level", default="undergrad")
    parser.add_argument("--category", default="natural-sciences-mathematics")
    parser.add_argument("--department", default="chemistry")
    parser.add_argument(
        "--prompt",
        default="Generate a college-style CHEM 105 General Chemistry I course from the provided syllabus, textbook, and lab artifacts.",
    )
    parser.add_argument("--out", default=None, help="Optional JSON output path.")
    args = parser.parse_args()

    report = {
        "contractVersion": "model-param-sweep-v1",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "apiBase": args.api_base,
        "task": {
            "prompt": args.prompt,
            "level": args.level,
            "category": args.category,
            "department": args.department,
            "modules": args.modules,
            "durationMinutes": args.duration_minutes,
            "stageTimeoutSeconds": args.stage_timeout,
            "artifactCount": len(CHEMISTRY_ARTIFACTS),
            "task": args.task,
        },
        "results": [],
    }

    for model in args.models:
        print(f"Testing {model} ...", flush=True)
        result = run_model(args.api_base, model, args)
        report["results"].append(result)
        status = "PASS" if result.get("quality_passed") else "FAIL"
        if not result.get("ok"):
            status = "ERROR"
        print(f"  {status} in {result.get('elapsed_seconds')}s", flush=True)

    output_path = Path(args.out) if args.out else Path(".lycium-local/reports") / f"model-param-sweep-{int(time.time())}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(f"Wrote {output_path}")

    passed = [item for item in report["results"] if item.get("quality_passed")]
    if passed:
        print("Passing models:")
        for item in passed:
            capability = item.get("model_capability") if isinstance(item.get("model_capability"), dict) else {}
            estimate = capability.get("estimated_parameters_billion")
            estimate_text = f" (~{estimate}B)" if estimate is not None else ""
            print(f"  - {item['model']}{estimate_text}: score {item.get('quality_score')}")
    else:
        print("No models passed the course quality gate in this sweep.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
