from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    user_agent: str


def _default_db_path() -> Path:
    root = Path(__file__).resolve().parents[2]
    return root / ".data" / "protheus.db"


def load_settings() -> Settings:
    db_path = Path(os.getenv("PROTHEUS_DB_PATH", _default_db_path()))
    db_path.parent.mkdir(parents=True, exist_ok=True)

    return Settings(
        app_env=os.getenv("PROTHEUS_ENV", "development"),
        database_url=os.getenv("PROTHEUS_DATABASE_URL", f"sqlite:///{db_path}"),
        user_agent=os.getenv("PROTHEUS_USER_AGENT", "ProtheusBot/0.1 (+https://protheuslabs.com)"),
    )


SETTINGS = load_settings()
