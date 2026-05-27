from __future__ import annotations

import json
import re
from typing import Any

from app.course_agent_types import CourseAgentError


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
    if adapter == "ollama-chat":
        message = response.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if isinstance(content, str) and content.strip():
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

    if adapter == "gemini-generate-content":
        candidates = response.get("candidates")
        if isinstance(candidates, list) and candidates:
            parts = candidates[0].get("content", {}).get("parts", []) if isinstance(candidates[0], dict) else []
            if isinstance(parts, list):
                text = "".join(str(part.get("text") or "") for part in parts if isinstance(part, dict))
                if text.strip():
                    return text

    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise CourseAgentError("LLM API response did not include choices.")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise CourseAgentError("LLM API response did not include JSON content.")
    return content
