from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from source_index.config import SETTINGS
from source_index.models import Base


def _ensure_sqlite_parent(database_url: str) -> None:
    if not database_url.startswith("sqlite:///"):
        return
    path = database_url.replace("sqlite:///", "", 1)
    if path and path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)


def _build_engine(database_url: str):
    _ensure_sqlite_parent(database_url)
    return create_engine(
        database_url,
        connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {},
    )


engine = _build_engine(SETTINGS.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def configure_engine(database_url: str) -> None:
    global engine, SessionLocal
    engine.dispose()
    engine = _build_engine(database_url)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _run_light_migrations()


def reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _run_light_migrations() -> None:
    if not str(engine.url).startswith("sqlite"):
        return

    inspector = inspect(engine)
    if "source_snapshots" not in inspector.get_table_names():
        return

    snapshot_columns = {column["name"] for column in inspector.get_columns("source_snapshots")}
    with engine.begin() as connection:
        if "extracted_text" not in snapshot_columns:
            connection.execute(text("ALTER TABLE source_snapshots ADD COLUMN extracted_text TEXT NOT NULL DEFAULT ''"))


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
