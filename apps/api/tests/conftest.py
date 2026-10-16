import os
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager

import pytest
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool, StaticPool

from app.core.config import Settings, load_settings
from app.core.db import make_session_factory
from app.core.models_base import new_uuid
from app.models import AppUser, Base, UserRole
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.seed.reference import ReferenceData, seed_reference_data

SECRET = "test-secret-value-not-for-production"


@pytest.fixture(scope="module")
def postgres_url() -> Iterator[str]:
    """URL de la base PostgreSQL de pruebas (change ci-migraciones-postgresql, decision D1).

    Se omite con un motivo si ``TEST_POSTGRES_URL`` no esta definida, para que ``npm test``
    siga en verde en maquinas sin Docker. El esquema ``public`` se recrea antes de cada
    modulo: las migraciones parten siempre de una base vacia.
    """
    url = os.environ.get("TEST_POSTGRES_URL")
    if not url:
        pytest.skip(
            "requiere TEST_POSTGRES_URL (npm run test:api:pg o el job de migraciones de CI)"
        )
    engine = create_engine(url, isolation_level="AUTOCOMMIT", poolclass=NullPool)
    try:
        with engine.connect() as connection:
            connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            connection.execute(text("CREATE SCHEMA public"))
    finally:
        engine.dispose()
    yield url


@pytest.fixture
def settings() -> Settings:
    return load_settings(
        app_env="test",
        database_url="sqlite+pysqlite:///:memory:",
        s3_endpoint_url="http://localhost:9000",
        s3_access_key_id="test-access-key",
        s3_secret_access_key=SECRET,
        s3_bucket="matp-test",
        jwt_secret=SECRET,
    )


def _enable_sqlite_foreign_keys(dbapi_connection, _record) -> None:  # type: ignore[no-untyped-def]
    dbapi_connection.execute("PRAGMA foreign_keys=ON")


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    make_session_factory(engine)  # installs hooks and registers models
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    factory = make_session_factory(engine)
    with factory() as session:
        yield session


SYSTEM_CONTEXT = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")


@pytest.fixture
def reference(session: Session) -> ReferenceData:
    with audit_context(session, SYSTEM_CONTEXT):
        data = seed_reference_data(session)
        session.commit()
    return data


@pytest.fixture
def users(session: Session, reference: ReferenceData) -> dict[str, AppUser]:
    created: dict[str, AppUser] = {}
    with audit_context(session, SYSTEM_CONTEXT):
        for role_code in ("ADMIN", "COLLECTIONS_MANAGER", "CATALOGUER", "INTERNAL_VIEWER"):
            user = AppUser(
                id=new_uuid(),
                email=f"{role_code.lower()}@test.local",
                full_name=f"Usuario de prueba {role_code}",
                is_synthetic=True,
                password_hash="$argon2id$fake-hash-for-tests",
            )
            session.add(user)
            session.add(
                UserRole(id=new_uuid(), user_id=user.id, role_id=reference.roles[role_code].id)
            )
            created[role_code] = user
        session.commit()
    return created


ActAs = Callable[..., AbstractContextManager[AuditContext]]


@pytest.fixture
def act_as(session: Session, users: dict[str, AppUser]) -> ActAs:
    """``with act_as("CATALOGUER"):`` sets a manual audit context for that synthetic user."""

    def factory(role_code: str, **extra: object) -> AbstractContextManager[AuditContext]:
        context = AuditContext(
            origin=extra.pop("origin", AuditOrigin.MANUAL),  # type: ignore[arg-type]
            user_id=users[role_code].id,
            **extra,  # type: ignore[arg-type]
        )
        return audit_context(session, context)

    return factory
