from __future__ import annotations

import json
import re
from typing import Any

from app.course_agent_types import CourseAgentError

PREVIEW_LIMIT = 500


def _safe_preview(value: Any) -> str:
    if value is None:
        return ""
    try:
        if isinstance(value, (dict, list)):
            text = json.dumps(value, ensure_ascii=False, sort_keys=True)
        else:
            text = str(value)
    except (TypeError, ValueError):
        text = repr(value)
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned[:PREVIEW_LIMIT]


def _response_keys(response: dict[str, Any]) -> list[str]:
    return sorted(str(key) for key in response.keys())


def _text_from_value(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    if isinstance(value, dict):
        for key in ("content", "text", "response", "output", "message"):
            text = _text_from_value(value.get(key))
            if text:
                return text
    if isinstance(value, list):
        text = "".join(_text_from_value(item) or "" for item in value)
        if text.strip():
            return text
    return None


def _raise_provider_error(response: dict[str, Any], adapter: str) -> None:
    error = response.get("error")
    detail = _safe_preview(error) or _safe_preview(response.get("message")) or "Provider returned an error response."
    raise CourseAgentError(
        f"LLM API returned an error response for adapter {adapter}: {detail}",
        trace={
            "adapter": adapter,
            "response_keys": _response_keys(response),
            "error_preview": detail,
        },
    )


def _raise_unexpected_shape(response: dict[str, Any], adapter: str) -> None:
    preview = _safe_preview(response)
    raise CourseAgentError(
        f"LLM API response did not include usable text content for adapter {adapter}.",
        trace={
            "adapter": adapter,
            "response_keys": _response_keys(response),
            "response_preview": preview,
        },
    )


def json_from_model_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise CourseAgentError("The agent did not return valid JSON.") from exc

    if not isinstance(parsed, dict):
        raise CourseAgentError("The agent response must be a JSON object.")
    if isinstance(parsed.get("course"), dict):
        parsed = parsed["course"]
    if isinstance(parsed.get("error"), dict):
        detail = parsed["error"].get("message") or parsed["error"].get("detail") or "Course generation failed."
        raise CourseAgentError(str(detail))
    return parsed


def extract_message_content(response: dict[str, Any], adapter: str) -> str:
    if isinstance(response.get("error"), (dict, list, str)):
        _raise_provider_error(response, adapter)

    if adapter == "ollama-chat":
        message = response.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if isinstance(content, str) and content.strip():
            return content
        for key in ("response", "content", "text", "output"):
            content = _text_from_value(response.get(key))
            if content:
                return content

    if adapter == "anthropic-messages":
        content = response.get("content")
        if isinstance(content, list):
            text = "".join(
                str(part.get("text") or "")
                for part in content
                if isinstance(part, dict) and part.get("type") in {None, "text"}
            )
            if text.strip():
                return text
        content = _text_from_value(content)
        if content:
            return content

    if adapter == "gemini-generate-content":
        candidates = response.get("candidates")
        if isinstance(candidates, list) and candidates:
            parts = candidates[0].get("content", {}).get("parts", []) if isinstance(candidates[0], dict) else []
            if isinstance(parts, list):
                text = "".join(str(part.get("text") or "") for part in parts if isinstance(part, dict))
                if text.strip():
                    return text
        content = _text_from_value(response.get("text") or response.get("content") or response.get("response"))
        if content:
            return content

    choices = response.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0] if isinstance(choices[0], dict) else {}
        message = choice.get("message") if isinstance(choice, dict) else None
        content = _text_from_value(message)
        if content:
            return content
        content = _text_from_value(choice.get("text") or choice.get("content") or choice.get("delta"))
        if content:
            return content

    content = _text_from_value(response.get("content") or response.get("response") or response.get("text") or response.get("output"))
    if content:
        return content
    _raise_unexpected_shape(response, adapter)
