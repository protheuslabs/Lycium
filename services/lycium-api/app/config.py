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
    api_token: str | None
    agent_api_url: str
    agent_model: str
    agent_timeout_seconds: float
    source_index_api_url: str | None
    source_index_timeout_seconds: float
    source_extractor_api_url: str | None
    source_extractor_command: str | None
    source_extractor_working_dir: Path | None
    source_extractor_timeout_seconds: float
    source_extractor_local_fallback_enabled: bool


def _default_db_path() -> Path:
    root = Path(__file__).resolve().parents[2]
    return root / ".data" / "lycium.db"


def _default_local_data_path() -> Path:
    root = Path(__file__).resolve().parents[3]
    return root / ".lycium-local"


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_settings() -> Settings:
    db_path = Path(os.getenv("LYCIUM_DB_PATH", _default_db_path()))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    local_data_dir = Path(os.getenv("LYCIUM_LOCAL_DATA_DIR", _default_local_data_path()))
    local_data_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        app_env=os.getenv("LYCIUM_ENV", "development"),
        database_url=os.getenv("LYCIUM_DATABASE_URL", f"sqlite:///{db_path}"),
        user_agent=os.getenv("LYCIUM_USER_AGENT", "LyciumBot/0.1 (+https://lycium.local)"),
        local_data_dir=local_data_dir,
        api_token=os.getenv("LYCIUM_API_TOKEN") or None,
        agent_api_url=os.getenv("LYCIUM_AGENT_API_URL", "https://api.openai.com/v1/chat/completions"),
        agent_model=os.getenv("LYCIUM_AGENT_MODEL", "gpt-4.1-mini"),
        agent_timeout_seconds=float(os.getenv("LYCIUM_AGENT_TIMEOUT_SECONDS", "120")),
        source_index_api_url=os.getenv("LYCIUM_SOURCE_INDEX_API_URL") or None,
        source_index_timeout_seconds=float(os.getenv("LYCIUM_SOURCE_INDEX_TIMEOUT_SECONDS", "20")),
        source_extractor_api_url=os.getenv("LYCIUM_SOURCE_EXTRACTOR_API_URL") or None,
        source_extractor_command=os.getenv("LYCIUM_SOURCE_EXTRACTOR_COMMAND") or None,
        source_extractor_working_dir=Path(os.environ["LYCIUM_SOURCE_EXTRACTOR_CWD"])
        if os.getenv("LYCIUM_SOURCE_EXTRACTOR_CWD")
        else None,
        source_extractor_timeout_seconds=float(os.getenv("LYCIUM_SOURCE_EXTRACTOR_TIMEOUT_SECONDS", "45")),
        source_extractor_local_fallback_enabled=_env_bool("LYCIUM_SOURCE_EXTRACTOR_LOCAL_FALLBACK", False),
    )


SETTINGS = load_settings()
