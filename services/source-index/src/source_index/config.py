from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("SOURCE_INDEX_DATABASE_URL", "sqlite:///../.data/source-index.db")
    user_agent: str = os.getenv("SOURCE_INDEX_USER_AGENT", "ProtheusSourceIndex/0.1")


SETTINGS = Settings()
