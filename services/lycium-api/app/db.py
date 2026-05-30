from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import SETTINGS
from app.models import Base


def _build_engine(database_url: str):
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
    tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "sources" in tables:
            source_columns = {column["name"] for column in inspector.get_columns("sources")}
            if "public_id" not in source_columns:
                connection.execute(text("ALTER TABLE sources ADD COLUMN public_id VARCHAR(80)"))
                connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_sources_public_id ON sources (public_id)"))
        if "snapshots" in tables:
            snapshot_columns = {column["name"] for column in inspector.get_columns("snapshots")}
            if "public_id" not in snapshot_columns:
                connection.execute(text("ALTER TABLE snapshots ADD COLUMN public_id VARCHAR(80)"))
                connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_snapshots_public_id ON snapshots (public_id)"))


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
