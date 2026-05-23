from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    user_agent: str
    local_data_dir: Path
    agent_api_url: str
    agent_model: str
    agent_timeout_seconds: float


def _default_db_path() -> Path:
    root = Path(__file__).resolve().parents[2]
    return root / ".data" / "protheus.db"


def _default_local_data_path() -> Path:
    root = Path(__file__).resolve().parents[3]
    return root / ".lyceum-local"


def load_settings() -> Settings:
    db_path = Path(os.getenv("PROTHEUS_DB_PATH", _default_db_path()))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    local_data_dir = Path(os.getenv("LYCEUM_LOCAL_DATA_DIR", _default_local_data_path()))
    local_data_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        app_env=os.getenv("PROTHEUS_ENV", "development"),
        database_url=os.getenv("PROTHEUS_DATABASE_URL", f"sqlite:///{db_path}"),
        user_agent=os.getenv("PROTHEUS_USER_AGENT", "ProtheusBot/0.1 (+https://protheuslabs.com)"),
        local_data_dir=local_data_dir,
        agent_api_url=os.getenv("LYCEUM_AGENT_API_URL", "https://api.openai.com/v1/chat/completions"),
        agent_model=os.getenv("LYCEUM_AGENT_MODEL", "gpt-4.1-mini"),
        agent_timeout_seconds=float(os.getenv("LYCEUM_AGENT_TIMEOUT_SECONDS", "120")),
    )


SETTINGS = load_settings()
