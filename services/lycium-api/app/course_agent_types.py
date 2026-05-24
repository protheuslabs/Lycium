from __future__ import annotations

from dataclasses import dataclass
from typing import Any


class CourseAgentError(ValueError):
    pass


@dataclass(frozen=True)
class CourseAgentResult:
    course: dict[str, Any]
    trace: dict[str, Any]
