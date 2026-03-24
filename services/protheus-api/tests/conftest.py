from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import configure_engine, reset_db
from app.main import app


@pytest.fixture(autouse=True)
def isolate_database(tmp_path: Path) -> Iterator[None]:
    test_db_url = f"sqlite:///{tmp_path / 'protheus-test.db'}"
    configure_engine(test_db_url)
    reset_db()
    yield


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
