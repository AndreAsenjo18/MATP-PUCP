"""Shared fixtures for HTTP contract tests: one synthetic seeded SQLite database per session.

Authentication in tests (ADR-009, decision D7): ``login_as("CATALOGUER")`` returns a client that
already carries a real server-side session and its CSRF token, exactly what a browser has after
``POST /auth/login`` but without paying for an Argon2 verification per test. See the migration
guide in ``docs/api/README.md``. The ``X-MATP-User`` header (``as_user``) still works under
``APP_ENV=test`` and is kept only for the tests of that header itself.
"""

from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.deps import DEV_USER_HEADER
from app.core.config import Settings, load_settings
from app.core.db import make_session_factory
from app.core.models_base import new_uuid
from app.main import create_app
from app.models import AppUser, Base, Role, UserRole
from app.modules.audit.context import AuditContext, audit_context, set_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.users.passwords import hash_password
from app.modules.users.sessions import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, issue_session
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

    def login_as(self, who: str) -> TestClient:
        """A client holding a real session of the seeded user with that role (or e-mail)."""
        return login_client(self.app, self.engine, who)

    def system_session(self) -> Session:
        """A session that may write: its audit context is the ``tests`` system process."""
        db = self.session()
        set_audit_context(db, AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests"))
        return db


def as_user(email: str) -> dict[str, str]:
    """Test-only header identity (ADR-005). Prefer ``login_as``."""
    return {DEV_USER_HEADER: email}


# Test client origin: cookies are issued `Secure`, so the client must speak https.
BASE_URL = "https://testserver"

LoginAs = Callable[..., TestClient]


def create_user(
    engine: Engine,
    email: str,
    *,
    role: str = "CATALOGUER",
    password: str | None = "contrasena-de-prueba-2026",
    is_synthetic: bool = False,
    is_active: bool = True,
    must_change_password: bool = False,
) -> AppUser:
    """Insert a user with a known password; tests of the login flow own their users.

    Failed-attempt counters and locks are state, so tests that exercise them must not share the
    seeded users with the rest of the suite (the seeded database lives for the whole session).
    """
    with make_session_factory(engine)() as db:
        role_row = db.scalar(select(Role).where(Role.code == role))
        assert role_row is not None, f"No existe el rol {role!r}"
        with audit_context(db, AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")):
            user = AppUser(
                id=new_uuid(),
                email=email,
                full_name=f"Usuario de prueba {email}",
                password_hash=hash_password(password, validate=False) if password else None,
                is_synthetic=is_synthetic,
                is_active=is_active,
                must_change_password=must_change_password,
            )
            db.add(user)
            db.add(UserRole(id=new_uuid(), user_id=user.id, role_id=role_row.id))
            db.commit()
        db.refresh(user)
        db.expunge(user)
        return user


def login_client(app: FastAPI, engine: Engine, who: str, *, base_url: str = BASE_URL) -> TestClient:
    """Open a real session for a seeded user and return a client that carries it.

    ``who`` is a role code (``"CATALOGUER"``, the first seeded user holding it) or an e-mail.
    The session is issued through the production code (``issue_session``), so it expires,
    revokes and authorizes exactly like a browser one, and the client sends the CSRF header on
    every request like the web client does.
    """
    with make_session_factory(engine)() as db:
        if "@" in who:
            user = db.scalar(select(AppUser).where(AppUser.email == who))
        else:
            user = db.scalar(
                select(AppUser)
                .join(UserRole, UserRole.user_id == AppUser.id)
                .join(Role, Role.id == UserRole.role_id)
                .where(Role.code == who, AppUser.is_synthetic.is_(True))
                .order_by(AppUser.email)
            )
        assert user is not None, f"No hay un usuario sintético para {who!r}"
        with audit_context(db, AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")):
            issued = issue_session(db, app.state.settings, user.id, ip_address="testclient")
            db.commit()
    client = TestClient(app, base_url=base_url, headers={CSRF_HEADER: issued.csrf_token})
    client.cookies.set(SESSION_COOKIE, issued.token)
    client.cookies.set(CSRF_COOKIE, issued.csrf_token)
    return client


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


@pytest.fixture
def login_as(seeded_api: SeededApi) -> LoginAs:
    """``login_as("ADMIN")`` -> a client signed in as the seeded user holding that role."""

    return seeded_api.login_as


# --- Import pipeline (importacion-pipeline-reconciliacion) ----------------------------------
@dataclass
class Pipeline:
    engine: Any
    client: TestClient
    stored: dict[str, bytes]
    app_for: Callable[..., TestClient]
    sessions: dict[str, TestClient] = field(default_factory=dict)

    def session(self) -> Session:
        return make_session_factory(self.engine)()

    def login(self, role: str) -> TestClient:
        """A client signed in as ``role`` on the same application as ``client``."""
        if role not in self.sessions:
            self.sessions[role] = login_client(self.client.app, self.engine, role)  # type: ignore[arg-type]
        return self.sessions[role]


def _fake_storage(app: Any, stored: dict[str, bytes]) -> None:
    app.state.storage.put_bytes = lambda key, data, _type: stored.__setitem__(key, data)
    app.state.storage.get_bytes = lambda key: stored[key]


@pytest.fixture(scope="module")
def pipeline() -> Iterator[Pipeline]:
    """A seeded database per test module for the import pipeline: validation writes review
    links and applying creates pieces that other modules count."""
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as session:
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    stored: dict[str, bytes] = {}
    clients: list[TestClient] = []

    def app_for(role: str = "CATALOGUER", **overrides: object) -> TestClient:
        """A client signed in as ``role`` on an application built with these settings."""
        app = create_app(api_settings(**overrides), health_checks={}, engine=engine)
        _fake_storage(app, stored)
        lifespan = TestClient(app)
        lifespan.__enter__()
        clients.append(lifespan)
        return login_client(app, engine, role)

    yield Pipeline(engine, app_for(), stored, app_for)
    for client in clients:
        client.__exit__(None, None, None)
    engine.dispose()
