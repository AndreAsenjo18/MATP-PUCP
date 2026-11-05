"""Inventory report on a consistent snapshot of a real PostgreSQL (reportes-inventario, task 4.1).

While the report is being built, another connection registers a new owned piece and commits.
The report runs in a ``REPEATABLE READ READ ONLY`` transaction (design D2), so the new piece is not
in the detail, and the total still equals the sum of the subtotals and the number of rows
(Req: Inventario permanente consistente con subtotales; RF-033). Synthetic data only (RNF-014).
"""

import io
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.db import make_session_factory
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog import queries
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.reports import registry
from app.modules.users.models import AppUser
from app.seed.reference import ROLE_PERMISSIONS
from app.seed.synthetic import SeedOptions, run_seed

pytestmark = pytest.mark.postgres

API_DIR = Path(__file__).resolve().parents[1]
ADMIN_PERMISSIONS = frozenset(ROLE_PERMISSIONS["ADMIN"])


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
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    yield sessions
    engine.dispose()


def test_a_piece_registered_during_the_report_is_not_in_it(
    factory: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    original = queries.CatalogReader.current_identifiers
    inserted: list[str] = []

    def register_meanwhile(self, piece_ids):  # type: ignore[no-untyped-def]
        if not inserted:
            with factory() as other:
                admin_id = other.scalar(
                    select(AppUser.id).where(AppUser.email == "admin@matp.local")
                )
                with audit_context(
                    other, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin_id)
                ):
                    create_piece(
                        other,
                        denomination="Registrada durante el reporte",
                        tenure_regime=TenureRegime.OWNED,
                    )
                other.commit()
            inserted.append("yes")
        return original(self, piece_ids)

    monkeypatch.setattr(queries.CatalogReader, "current_identifiers", register_meanwhile)
    with factory() as session:
        started = time.perf_counter()
        data = registry.build("inventory", session, ADMIN_PERMISSIONS, registry.ReportParams())
        elapsed = time.perf_counter() - started

    assert inserted == ["yes"]
    names = {row[4] for row in data.rows}
    assert "Registrada durante el reporte" not in names
    total = data.totals["Piezas"]
    assert total == len(data.rows)
    assert sum(s.count for s in data.subtotals if s.group == "Régimen") == total
    assert sum(s.count for s in data.subtotals if s.group == "Colección" and s.level == 0) == total
    assert elapsed < 10  # ~300 seeded pieces

    with factory() as session:
        later = registry.build("inventory", session, ADMIN_PERMISSIONS, registry.ReportParams())
    assert "Registrada durante el reporte" in {row[4] for row in later.rows}
    assert later.totals["Piezas"] == total + 1
