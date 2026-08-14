from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import signal
import sys
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path
from typing import Any

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.course_agent_assembly import _model_json
from app.course_agent_providers import assess_agent_model_capability, get_agent_provider
from app.course_quality import assess_course_quality
from app.local_store_settings import require_verified_active_agent_profile


MICRO_BENCHMARKS = {
    "plan": {
        "description": "Create a compact college-course plan from source excerpts.",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Lycium course planner. Return strict JSON only. "
                    "Use source-backed, college-style course structure."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Create a one-module Macroeconomics Principles plan from these source excerpts. "
                    "Return JSON with title, shortDescription, pacingLabel, modules. Each module must have "
                    "title, learningObjectives, sections. Each section must have title, pageType, "
                    "conceptKeywords, learningObjectives, sourceIds.\n\n"
                    "Sources:\n"
                    "source-1: Macroeconomics Principles includes GDP, national income accounting, inflation, "
                    "unemployment, aggregate demand, aggregate supply, and fiscal policy.\n"
                    "source-2: Core topics include price indexes, labor force participation, money, banking, "
                    "monetary policy, economic growth, exchange rates, and international trade.\n"
                    "source-3: Data activities include GDP table interpretation, inflation calculations, "
                    "unemployment comparisons, policy scenario analysis, and evidence-based writing."
                ),
            },
        ],
    },
    "section": {
        "description": "Create one editor-native sourced learn section.",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Lycium lesson writer. Return strict JSON only. "
                    "Use editor-native blocks and local sourceIds. Text blocks must use "
                    "{\"type\":\"text\",\"value\":\"...\"}. Concept cards must use "
                    "{\"type\":\"conceptCard\",\"title\":\"...\",\"description\":\"...\"}."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Write one Macroeconomics Principles learn section on inflation and price indexes. "
                    "Return JSON with id, title, pageType='learn', sourceIds, and content. Content must "
                    "include at least one heading block using {\"type\":\"heading\",\"title\":\"...\"}, "
                    "two text blocks using {\"type\":\"text\",\"value\":\"...\"} with inline [1] citation markers, "
                    "and at least two conceptCard blocks. Use only sourceIds ['source-1','source-2'].\n\n"
                    "source-1: Inflation measures sustained changes in the overall price level using indexes "
                    "such as CPI.\n"
                    "source-2: Price indexes compare a basket of goods across periods so learners can calculate "
                    "inflation rates and real purchasing power."
                ),
            },
        ],
    },
    "quiz": {
        "description": "Create one valid 10-question quiz block.",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a Lycium assessment writer. Return strict JSON only. "
                    "Create assessment-only quiz sections with answer indexes. Keep explanations out of the quiz. "
                    "Each question should be concise. Every question must use this exact shape: "
                    "{\"question\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answers\":[0]}. "
                    "Do not use the legacy singular answer field."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Create one Macroeconomics Principles apply section assessing GDP, inflation, unemployment, "
                    "aggregate demand, fiscal policy, and monetary policy. Return JSON with id, title, pageType='apply', and content "
                    "containing exactly one quiz block. The quiz must have at least 10 questions. Each "
                    "question needs question, exactly 4 options, and answers as zero-based indexes. Include "
                    "passPercentage 70 and showAnswers false. Use answers arrays like [1], never answer: 1. "
                    "Do not include explanations, rationales, markdown, or prose outside JSON."
                ),
            },
        ],
    },
}


@contextmanager
def model_deadline(seconds: float):
    def timeout_handler(_signum, _frame):
        raise TimeoutError(f"Model run exceeded {seconds:g}s outer deadline")

    previous_handler = signal.getsignal(signal.SIGALRM)
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.setitimer(signal.ITIMER_REAL, max(1.0, float(seconds)))
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)


def post_json(api_base: str, path: str, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{api_base.rstrip('/')}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def summarize_result(model: str, elapsed_seconds: float, result: dict[str, Any]) -> dict[str, Any]:
    course = result.get("course") if isinstance(result.get("course"), dict) else {}
    quality = result.get("quality_report") if isinstance(result.get("quality_report"), dict) else {}
    trace = result.get("trace") if isinstance(result.get("trace"), dict) else {}
    metadata = course.get("metadata") if isinstance(course.get("metadata"), dict) else {}
    source_records = course.get("sourceRecords")
    if isinstance(source_records, dict):
        source_count = len(source_records)
    elif isinstance(source_records, list):
        source_count = len(source_records)
    else:
        source_count = 0
    modules = course.get("modules") if isinstance(course.get("modules"), list) else []
    section_count = sum(len(module.get("sections") or []) for module in modules if isinstance(module, dict))

    return {
        "model": model,
        "ok": True,
        "accepted": bool(result.get("accepted")),
        "elapsed_seconds": round(elapsed_seconds, 2),
        "quality_passed": bool(quality.get("passed")),
        "quality_score": quality.get("score"),
        "quality_errors": quality.get("errors") or [],
        "quality_warnings": quality.get("warnings") or [],
        "title": course.get("title"),
        "module_count": len(modules),
        "section_count": section_count,
        "source_count": source_count,
        "input_artifact_count": len(metadata.get("inputArtifacts") or []),
        "model_capability": trace.get("model_capability"),
        "stages": trace.get("stages") or [],
    }


def score_micro_result(task: str, payload: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    if task == "plan":
        modules = payload.get("modules") if isinstance(payload.get("modules"), list) else []
        if not str(payload.get("title") or "").strip():
            errors.append("Missing plan title.")
        if not str(payload.get("shortDescription") or "").strip():
            warnings.append("Missing short description.")
        if len(modules) < 1:
            errors.append("Plan did not include modules.")
        sections = [
            section
            for module in modules
            if isinstance(module, dict)
            for section in module.get("sections", [])
            if isinstance(section, dict)
        ]
        if len(sections) < 3:
            errors.append("Plan included fewer than 3 sections.")
        if any(not section.get("sourceIds") for section in sections):
            errors.append("At least one planned section lacks sourceIds.")

    if task == "section":
        content = payload.get("content") if isinstance(payload.get("content"), list) else []
        if payload.get("pageType") != "learn":
            errors.append("Section pageType is not learn.")
        if not payload.get("sourceIds"):
            errors.append("Section lacks sourceIds.")
        text_blocks = [block for block in content if isinstance(block, dict) and block.get("type") == "text"]
        concept_cards = [block for block in content if isinstance(block, dict) and block.get("type") == "conceptCard"]
        if len(text_blocks) < 2:
            errors.append("Section has fewer than 2 text blocks.")
        if len(concept_cards) < 2:
            errors.append("Section has fewer than 2 concept cards.")
        if not any("[1]" in str(block.get("value") or "") for block in text_blocks):
            errors.append("Section text lacks inline citation marker [1].")
        if any("value" not in block for block in text_blocks):
            errors.append("At least one text block lacks value.")
        if any("title" not in block or "description" not in block for block in concept_cards):
            errors.append("At least one conceptCard lacks title or description.")

    if task == "quiz":
        content = payload.get("content") if isinstance(payload.get("content"), list) else []
        quiz_blocks = [block for block in content if isinstance(block, dict) and block.get("type") == "quiz"]
        if payload.get("pageType") != "apply":
            errors.append("Quiz section pageType is not apply.")
        if len(quiz_blocks) != 1:
            errors.append("Quiz section must contain exactly one quiz block.")
        questions = quiz_blocks[0].get("questions") if quiz_blocks and isinstance(quiz_blocks[0].get("questions"), list) else []
        if len(questions) < 10:
            errors.append("Quiz has fewer than 10 questions.")
        for index, question in enumerate(questions, start=1):
            if not isinstance(question, dict):
                errors.append(f"Question {index} is not an object.")
                continue
            options = question.get("options") if isinstance(question.get("options"), list) else []
            answers = question.get("answers") if isinstance(question.get("answers"), list) else []
            if len(options) < 3:
                errors.append(f"Question {index} has fewer than 3 options.")
            if not answers:
                errors.append(f"Question {index} has no answers array.")

    passed = not errors
    return {
        "passed": passed,
        "score": 1.0 if passed and not warnings else 0.8 if passed else 0.0,
        "errors": errors,
        "warnings": warnings,
    }


def micro_task_worker(queue: mp.Queue, provider: dict[str, Any], api_key: str, adapter: str, model: str, task: str, timeout: float) -> None:
    benchmark = MICRO_BENCHMARKS[task]
    started = time.monotonic()
    try:
        payload, response = _model_json(
            provider=provider,
            api_key=api_key,
            adapter=adapter,
            model=model,
            stage=f"micro_{task}",
            timeout_seconds=timeout,
            messages=benchmark["messages"],
        )
        queue.put(
            {
                "task": task,
                "description": benchmark["description"],
                "ok": True,
                "elapsed_seconds": round(time.monotonic() - started, 2),
                "quality": score_micro_result(task, payload),
                "usage": response.get("usage") if isinstance(response, dict) else None,
                "sample": payload,
            }
        )
    except Exception as exc:
        queue.put(
            {
                "task": task,
                "description": benchmark["description"],
                "ok": False,
                "elapsed_seconds": round(time.monotonic() - started, 2),
                "error": str(exc),
                "quality": {"passed": False, "score": 0.0, "errors": [str(exc)], "warnings": []},
            }
        )


def run_micro_task(provider: dict[str, Any], api_key: str, adapter: str, model: str, task: str, stage_timeout: float, deadline: float) -> dict[str, Any]:
    queue: mp.Queue = mp.Queue()
    process = mp.Process(target=micro_task_worker, args=(queue, provider, api_key, adapter, model, task, stage_timeout))
    process.start()
    process.join(max(1.0, float(deadline)))
    if process.is_alive():
        process.terminate()
        process.join(5)
        benchmark = MICRO_BENCHMARKS[task]
        return {
            "task": task,
            "description": benchmark["description"],
            "ok": False,
            "elapsed_seconds": round(float(deadline), 2),
            "error": f"Task exceeded {deadline:g}s process deadline",
            "quality": {"passed": False, "score": 0.0, "errors": [f"Task exceeded {deadline:g}s process deadline"], "warnings": []},
        }
    if not queue.empty():
        return queue.get()
    benchmark = MICRO_BENCHMARKS[task]
    return {
        "task": task,
        "description": benchmark["description"],
        "ok": False,
        "elapsed_seconds": round(float(deadline), 2),
        "error": "Task process exited without a result.",
        "quality": {"passed": False, "score": 0.0, "errors": ["Task process exited without a result."], "warnings": []},
    }


def run_micro_benchmark(model: str, args: argparse.Namespace) -> dict[str, Any]:
    active_profile = require_verified_active_agent_profile()
    provider = get_agent_provider(str(active_profile.get("provider_id") or "openai"))
    adapter = str(provider.get("generationAdapter") or "openai-chat-completions")
    api_key = str(active_profile["agent_api_key"])
    selected_tasks = ["plan", "section", "quiz"] if args.task == "all-micro" else [args.task]
    task_results: list[dict[str, Any]] = []
    started = time.monotonic()

    for task in selected_tasks:
        task_results.append(run_micro_task(provider, api_key, adapter, model, task, args.stage_timeout, args.per_model_timeout))

    passed = all(result.get("quality", {}).get("passed") for result in task_results)
    return {
        "model": model,
        "ok": all(bool(result.get("ok")) for result in task_results),
        "accepted": passed,
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "quality_passed": passed,
        "quality_score": round(sum(float(result.get("quality", {}).get("score") or 0.0) for result in task_results) / len(task_results), 3),
        "model_capability": assess_agent_model_capability(provider, model),
        "task_results": task_results,
    }
