"""Shared fixtures for HTTP contract tests: one synthetic seeded SQLite database per session."""

from collections.abc import Iterator
from dataclasses import dataclass

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import DEV_USER_HEADER
from app.core.config import Settings, load_settings
from app.core.db import make_session_factory
from app.main import create_app
from app.models import Base
from app.seed.synthetic import SeedOptions, SeedSummary, run_seed

SECRET = "test-secret-value-not-for-production"

ADMIN = "admin@matp.local"
MANAGER = "curadora@matp.local"
CATALOGUER = "catalogador@matp.local"
STORAGE = "deposito@matp.local"
VIEWER = "consulta@matp.local"


def api_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "app_env": "test",
        "database_url": "sqlite+pysqlite:///:memory:",
        "s3_endpoint_url": "http://localhost:9000",
        "s3_access_key_id": "test-access-key",
        "s3_secret_access_key": SECRET,
        "s3_bucket": "matp-test",
        "jwt_secret": SECRET,
    }
    values.update(overrides)
    return load_settings(**values)


@dataclass
class SeededApi:
    engine: Engine
    app: FastAPI
    client: TestClient
    summary: SeedSummary

    def session(self) -> Session:
        return make_session_factory(self.engine)()


def as_user(email: str) -> dict[str, str]:
    return {DEV_USER_HEADER: email}


@pytest.fixture(scope="session")
def seeded_api() -> Iterator[SeededApi]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    factory = make_session_factory(engine)
    Base.metadata.create_all(engine)
    with factory() as session:
        summary = run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    app = create_app(api_settings(), health_checks={}, engine=engine)
    with TestClient(app) as client:
        yield SeededApi(engine=engine, app=app, client=client, summary=summary)
    engine.dispose()


@pytest.fixture
def client(seeded_api: SeededApi) -> TestClient:
    return seeded_api.client
