from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class CourseAgentError(ValueError):
    def __init__(self, message: str, *, trace: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.trace = trace or {}


@dataclass(frozen=True)
class CourseAgentResult:
    course: dict[str, Any]
    trace: dict[str, Any]
