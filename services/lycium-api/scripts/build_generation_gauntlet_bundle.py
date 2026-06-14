from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from app.course_generation_gauntlet import load_generation_gauntlet_cases, load_generation_gauntlet_manifest


GAUNTLET_INPUT_VERSION = "course-generation-gauntlet-input-v1"


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Artifact must be a JSON object: {path}")
    return payload


def _parse_pair(raw: str, *, label: str) -> tuple[str, str]:
    if "=" not in raw:
        raise ValueError(f"{label} must use key=value format: {raw}")
    key, value = raw.split("=", 1)
    key = key.strip()
    value = value.strip()
    if not key or not value:
        raise ValueError(f"{label} must include both key and value: {raw}")
    return key, value


def _candidate_dicts(payload: dict[str, Any], keys: tuple[str, ...]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for key in keys:
        value = payload.get(key)
        if isinstance(value, dict):
            candidates.append(value)
    candidates.append(payload)
    return candidates


def _unwrap_course_artifact(payload: dict[str, Any]) -> dict[str, Any]:
    for candidate in _candidate_dicts(payload, ("course", "data", "generatedCourse", "courseJson")):
        if isinstance(candidate.get("modules"), list):
            return candidate
    return payload


def _unwrap_program_artifact(payload: dict[str, Any]) -> dict[str, Any]:
    for candidate in _candidate_dicts(payload, ("programEnvelope", "generatedProgram", "data", "structure")):
        if isinstance(candidate.get("program"), dict):
            return candidate
        if isinstance(candidate.get("requirementGroups"), list):
            return {"program": candidate}
    if isinstance(payload.get("program"), dict):
        return payload
    if isinstance(payload.get("requirementGroups"), list):
        return {"program": payload}
    return payload


def _artifact_map(entries: list[str] | None, *, kind: str) -> dict[str, Any]:
    artifacts: dict[str, Any] = {}
    for entry in entries or []:
        scenario_id, path_value = _parse_pair(entry, label=f"{kind} artifact")
        payload = _load_json(Path(path_value))
        artifacts[scenario_id] = _unwrap_course_artifact(payload) if kind == "course" else _unwrap_program_artifact(payload)
    return artifacts


def _metadata(args: argparse.Namespace) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for raw in args.metadata or []:
        key, value = _parse_pair(raw, label="metadata")
        metadata[key] = value
    for key in ("provider", "model", "prompt", "input_mix"):
        value = getattr(args, key)
        if value:
            metadata["inputMix" if key == "input_mix" else key] = value
    return metadata


def build_bundle(args: argparse.Namespace) -> dict[str, Any]:
    bundle = {
        "contractVersion": GAUNTLET_INPUT_VERSION,
        "metadata": _metadata(args),
        "courses": _artifact_map(args.course, kind="course"),
        "programs": _artifact_map(args.program, kind="program"),
    }
    if args.manifest:
        manifest = load_generation_gauntlet_manifest(args.manifest)
        bundle["cases"] = list(load_generation_gauntlet_cases(args.manifest))
        bundle["manifest"] = {
            "path": args.manifest,
            "contractVersion": manifest.get("contractVersion"),
            "description": manifest.get("description"),
        }
    return bundle


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a Lycium generation gauntlet input bundle from generated artifact files.")
    parser.add_argument("--course", action="append", default=[], help="Course artifact as scenario-id=path/to/course.json. May be repeated.")
    parser.add_argument("--program", action="append", default=[], help="Program artifact as scenario-id=path/to/program.json. May be repeated.")
    parser.add_argument("--metadata", action="append", default=[], help="Metadata as key=value. May be repeated.")
    parser.add_argument("--provider", default=None, help="Provider that generated the artifacts.")
    parser.add_argument("--model", default=None, help="Model that generated the artifacts.")
    parser.add_argument("--prompt", default=None, help="Prompt or prompt summary used for the generation run.")
    parser.add_argument("--input-mix", default=None, help="Input mix label, such as prompt+urls+files.")
    parser.add_argument("--manifest", default=None, help="Optional gauntlet manifest path. Defaults are used when omitted.")
    parser.add_argument("--output", default=None, help="Optional output path. Defaults to stdout.")
    args = parser.parse_args([argument for argument in sys.argv[1:] if argument != "--"])

    bundle = build_bundle(args)
    serialized = f"{json.dumps(bundle, indent=2, sort_keys=True)}\n"
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized, encoding="utf-8")
    else:
        print(serialized, end="")


if __name__ == "__main__":
    main()
