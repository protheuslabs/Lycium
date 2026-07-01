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


def _models_for_runtime(runtime: str) -> list[dict[str, str]]:
    if runtime == "codex":
        return [{"id": "codex", "label": "Codex account default"}]
    return [{"id": "claude-code", "label": "Claude Code account default"}]


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
