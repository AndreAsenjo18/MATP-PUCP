"""`export_job.kind` on a database created by the migrations (issue #104).

The suite builds its schema from the models, so it never saw that the CHECK of migration 0010
listed the enum names (`'RESULTS'`, …) while the ORM writes the values (`'results'`, …): every
export job failed on a migrated database. Here the schema comes from `alembic upgrade head`, on
SQLite and, with ``TEST_POSTGRES_URL``, on PostgreSQL.
"""

import io
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, event, select
from sqlalchemy.pool import NullPool

from app.core.db import make_session_factory
from app.modules.search.models import ExportJobKind, ExportJobModel, ExportJobStatus
from app.modules.users.models import AppUser
from app.seed.synthetic import SeedOptions, run_seed

API_DIR = Path(__file__).resolve().parents[1]


def _upgrade(url: str, monkeypatch: pytest.MonkeyPatch) -> None:
    config = Config(str(API_DIR / "alembic.ini"), stdout=io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.set_section_option("alembic", "sqlalchemy.url", url)
    monkeypatch.setenv("DATABASE_URL", url)  # read by alembic/env.py
    command.upgrade(config, "head")


def _every_kind_is_stored(engine: Engine) -> None:
    sessions = make_session_factory(engine)
    with sessions() as session:
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
        user_id = session.scalar(select(AppUser.id).limit(1))
        for kind in ExportJobKind:
            session.add(
                ExportJobModel(
                    kind=kind,
                    requested_by_id=user_id,
                    format="xlsx",
                    params={},
                    status=ExportJobStatus.PENDING,
                )
            )
        session.commit()
        stored = set(session.scalars(select(ExportJobModel.kind)))
    assert stored == set(ExportJobKind)


@pytest.fixture
def migrated_sqlite(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Engine]:
    url = f"sqlite:///{(tmp_path / 'matp.db').as_posix()}"
    _upgrade(url, monkeypatch)
    engine = create_engine(url)
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    yield engine
    engine.dispose()


def test_every_export_job_kind_is_stored_on_a_migrated_database(migrated_sqlite: Engine) -> None:
    _every_kind_is_stored(migrated_sqlite)


@pytest.mark.postgres
def test_every_export_job_kind_is_stored_on_postgresql(
    postgres_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _upgrade(postgres_url, monkeypatch)
    engine = create_engine(postgres_url, poolclass=NullPool)
    try:
        _every_kind_is_stored(engine)
    finally:
        engine.dispose()
