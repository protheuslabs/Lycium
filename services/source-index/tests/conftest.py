from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from source_index.db import configure_engine, reset_db
from source_index.main import app


@pytest.fixture(autouse=True)
def isolate_database(tmp_path: Path) -> Iterator[None]:
    configure_engine(f"sqlite:///{tmp_path / 'source-index-test.db'}")
    reset_db()
    yield


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
