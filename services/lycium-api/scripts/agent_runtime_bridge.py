#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


DEFAULT_TIMEOUT_SECONDS = 900

CODEX_ACCOUNT_DEFAULT_MODEL = {"id": "codex", "label": "Codex account default"}
CODEX_DOCUMENTED_MODELS = (
    {"id": "gpt-5.6-sol", "label": "GPT-5.6 Sol"},
    {"id": "gpt-5.6-terra", "label": "GPT-5.6 Terra"},
    {"id": "gpt-5.6-luna", "label": "GPT-5.6 Luna"},
    {"id": "gpt-5.5", "label": "GPT-5.5"},
    {"id": "gpt-5.4", "label": "GPT-5.4"},
    {"id": "gpt-5.4-mini", "label": "GPT-5.4 Mini"},
    {"id": "gpt-5.3-codex-spark", "label": "GPT-5.3 Codex Spark"},
)
CODEX_DOCUMENTED_FALLBACK_WARNING = "Documented Codex model; availability depends on this Codex account."

CLAUDE_CODE_ACCOUNT_DEFAULT_MODEL = {"id": "claude-code", "label": "Claude Code account default"}
CLAUDE_CODE_DOCUMENTED_MODELS = (
    {"id": "sonnet", "label": "Sonnet alias"},
    {"id": "opus", "label": "Opus alias"},
    {"id": "fable", "label": "Fable alias"},
    {"id": "haiku", "label": "Haiku alias"},
    {"id": "claude-sonnet-5", "label": "Claude Sonnet 5"},
    {"id": "claude-opus-5", "label": "Claude Opus 5"},
    {"id": "claude-fable-5", "label": "Claude Fable 5"},
    {"id": "claude-haiku-4-5", "label": "Claude Haiku 4.5"},
    {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5 20251001"},
)
CLAUDE_CODE_DOCUMENTED_FALLBACK_WARNING = "Claude Code model selector; availability depends on this Claude account and CLI configuration."


def _read_request() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        _write({"ok": False, "error": f"Bridge request was not valid JSON: {exc}"})
        raise SystemExit(2) from exc
    if not isinstance(payload, dict):
        _write({"ok": False, "error": "Bridge request must be a JSON object."})
        raise SystemExit(2)
    return payload


def _write(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.write("\n")
    sys.stdout.flush()


def _runtime_executable(runtime: str) -> str | None:
    env_key = "LYCIUM_CODEX_COMMAND" if runtime == "codex" else "LYCIUM_CLAUDE_COMMAND"
    configured = os.environ.get(env_key, "").strip()
    if configured:
        return configured
    return shutil.which("codex" if runtime == "codex" else "claude")


def _codex_cache_paths() -> list[Path]:
    paths: list[Path] = []
    codex_home = os.environ.get("CODEX_HOME", "").strip()
    if codex_home:
        paths.append(Path(codex_home).expanduser() / "models_cache.json")
    home = Path.home()
    if home:
        paths.append(home / ".codex" / "models_cache.json")
    return paths


def _append_model(
    models: list[dict[str, Any]],
    seen: set[str],
    model_id: str,
    label: str | None = None,
    *,
    warning: str | None = None,
    error: str | None = None,
    disabled: bool = False,
) -> None:
    cleaned_id = str(model_id or "").strip()
    if not cleaned_id or cleaned_id in seen:
        return
    record: dict[str, Any] = {"id": cleaned_id, "label": str(label or cleaned_id).strip() or cleaned_id}
    if warning:
        record["warning"] = warning
    if error:
        record["error"] = error
    if disabled:
        record["disabled"] = True
    models.append(record)
    seen.add(cleaned_id)


def _cached_codex_models() -> list[dict[str, Any]]:
    for path in _codex_cache_paths():
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        raw_models = payload.get("models") if isinstance(payload, dict) else None
        if not isinstance(raw_models, list):
            continue
        models: list[dict[str, Any]] = []
        for raw_model in raw_models:
            if not isinstance(raw_model, dict):
                continue
            if str(raw_model.get("visibility") or "list").lower() == "hide":
                continue
            model_id = str(raw_model.get("slug") or raw_model.get("id") or raw_model.get("name") or "").strip()
            label = str(raw_model.get("display_name") or raw_model.get("label") or model_id).strip()
            if model_id:
                models.append({"id": model_id, "label": label or model_id})
        if models:
            return models
    return []


def _codex_models() -> list[dict[str, Any]]:
    models: list[dict[str, Any]] = []
    seen: set[str] = set()
    _append_model(models, seen, CODEX_ACCOUNT_DEFAULT_MODEL["id"], CODEX_ACCOUNT_DEFAULT_MODEL["label"])

    for model in _cached_codex_models():
        _append_model(models, seen, str(model.get("id") or ""), str(model.get("label") or ""))

    for model in CODEX_DOCUMENTED_MODELS:
        warning = None if model["id"] in seen else CODEX_DOCUMENTED_FALLBACK_WARNING
        _append_model(models, seen, model["id"], model["label"], warning=warning)

    return models


def _models_for_runtime(runtime: str) -> list[dict[str, Any]]:
    if runtime == "codex":
        return _codex_models()
    models: list[dict[str, Any]] = []
    seen: set[str] = set()
    _append_model(models, seen, CLAUDE_CODE_ACCOUNT_DEFAULT_MODEL["id"], CLAUDE_CODE_ACCOUNT_DEFAULT_MODEL["label"])
    for model in CLAUDE_CODE_DOCUMENTED_MODELS:
        _append_model(
            models,
            seen,
            model["id"],
            model["label"],
            warning=CLAUDE_CODE_DOCUMENTED_FALLBACK_WARNING,
        )
    return models


def _messages_to_prompt(messages: list[dict[str, Any]], response_format: str) -> str:
    lines = [
        "You are being called by Lycium through a local agent-runtime bridge.",
        "Follow the provided messages and return only the requested final answer.",
    ]
    if response_format == "json_object":
        lines.append("The final answer must be a single valid JSON object with no markdown fence.")
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "user").upper()
        content = str(message.get("content") or "").strip()
        if content:
            lines.append(f"\n[{role}]\n{content}")
    return "\n".join(lines).strip()


def _timeout_seconds() -> int:
    try:
        return max(30, int(os.environ.get("LYCIUM_AGENT_RUNTIME_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS)))
    except ValueError:
        return DEFAULT_TIMEOUT_SECONDS


def _run_codex(executable: str, prompt: str, model: str | None) -> str:
    with tempfile.NamedTemporaryFile(prefix="lycium-codex-", suffix=".txt", delete=False) as tmp:
        output_path = Path(tmp.name)
    command = [
        executable,
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--output-last-message",
        str(output_path),
    ]
    if model and model != "codex":
        command.extend(["--model", model])
    command.append(prompt)
    try:
        result = subprocess.run(command, text=True, capture_output=True, timeout=_timeout_seconds(), check=False)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()[:1200]
            raise RuntimeError(detail or f"Codex exited with code {result.returncode}.")
        if output_path.exists():
            content = output_path.read_text(encoding="utf-8").strip()
            if content:
                return content
        return result.stdout.strip()
    finally:
        output_path.unlink(missing_ok=True)


def _run_claude(executable: str, prompt: str, model: str | None) -> str:
    command = [
        executable,
        "--print",
        "--output-format",
        "text",
        "--permission-mode",
        "dontAsk",
    ]
    if model and model != "claude-code":
        command.extend(["--model", model])
    command.append(prompt)
    result = subprocess.run(command, text=True, capture_output=True, timeout=_timeout_seconds(), check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()[:1200]
        raise RuntimeError(detail or f"Claude Code exited with code {result.returncode}.")
    return result.stdout.strip()


def _handle_probe(runtime: str) -> None:
    executable = _runtime_executable(runtime)
    if not executable:
        binary = "codex" if runtime == "codex" else "claude"
        _write({
            "ok": False,
            "error": f"{binary} was not found on PATH. Install it or set {'LYCIUM_CODEX_COMMAND' if runtime == 'codex' else 'LYCIUM_CLAUDE_COMMAND'}.",
            "models": _models_for_runtime(runtime),
        })
        return
    _write({
        "ok": True,
        "runtime": runtime,
        "executable": executable,
        "models": _models_for_runtime(runtime),
    })


def _handle_generate(runtime: str, request: dict[str, Any]) -> None:
    executable = _runtime_executable(runtime)
    if not executable:
        binary = "codex" if runtime == "codex" else "claude"
        _write({"ok": False, "error": f"{binary} was not found on PATH."})
        raise SystemExit(1)
    messages = request.get("messages")
    if not isinstance(messages, list):
        _write({"ok": False, "error": "Generation request is missing messages."})
        raise SystemExit(2)
    model = str(request.get("model") or "").strip() or None
    prompt = _messages_to_prompt(messages, str(request.get("responseFormat") or "json_object"))
    try:
        content = _run_codex(executable, prompt, model) if runtime == "codex" else _run_claude(executable, prompt, model)
    except (OSError, subprocess.TimeoutExpired, RuntimeError) as exc:
        _write({"ok": False, "error": str(exc)})
        raise SystemExit(1) from exc
    _write({"content": content, "usage": {}})


def main() -> int:
    parser = argparse.ArgumentParser(description="Lycium local agent-runtime bridge.")
    parser.add_argument("--runtime", choices=["codex", "claude-code"], required=True)
    args = parser.parse_args()
    request = _read_request()
    request_type = str(request.get("type") or "")
    if request_type == "lycium-agent-runtime-probe-v1":
        _handle_probe(args.runtime)
        return 0
    if request_type == "lycium-agent-runtime-generate-v1":
        _handle_generate(args.runtime, request)
        return 0
    _write({"ok": False, "error": f"Unsupported bridge request type: {request_type or 'missing'}"})
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
