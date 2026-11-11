"""Leaving a record type out of the audit query on a real PostgreSQL (administracion-control, 5.6).

The screen sends ``exclude_entity_type=user_session`` so that logins do not flood the query. The
condition is ``entity_type <> value``: this checks it on PostgreSQL in the grouped list (total and
page), next to a change set of another type. Synthetic data only (RNF-014).
"""

import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.db import make_session_factory
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.audit.query import AuditFilters, list_change_sets
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece

pytestmark = pytest.mark.postgres

API_DIR = Path(__file__).resolve().parents[1]
ORIGIN_REF = "lote-sintetico-exclusion"


@pytest.fixture(scope="module")
def factory(postgres_url: str) -> Iterator[sessionmaker[Session]]:
    config = Config(str(API_DIR / "alembic.ini"), stdout=io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.set_section_option("alembic", "sqlalchemy.url", postgres_url)
    with pytest.MonkeyPatch.context() as patch:
        patch.setenv("DATABASE_URL", postgres_url)  # read by alembic/env.py
        command.upgrade(config, "head")
    engine = create_engine(postgres_url, poolclass=NullPool)
    sessions = make_session_factory(engine)
    with sessions() as session:
        context = AuditContext(
            origin=AuditOrigin.SYSTEM, actor_label="prueba sintética", origin_ref=ORIGIN_REF
        )
        with audit_context(session, context):
            create_piece(
                session,
                denomination="Pieza sintética de auditoría",
                tenure_regime=TenureRegime.OWNED,
            )
        session.commit()
    yield sessions
    engine.dispose()


def _total(factory: sessionmaker[Session], **filters: str) -> int:
    with factory() as session:
        found, total = list_change_sets(
            session, AuditFilters(origin_ref=ORIGIN_REF, **filters), limit=20, offset=0
        )
        assert len(found) == total
        return total


def test_a_record_type_is_left_out_on_postgresql(factory: sessionmaker[Session]) -> None:
    assert _total(factory) == 1
    assert _total(factory, exclude_entity_type="piece") == 0
    assert _total(factory, exclude_entity_type="user_session") == 1
