"""Import stages against a real PostgreSQL engine (change importacion-pipeline-reconciliacion).

On PostgreSQL the heartbeat of a stage is written from its own connection (``worker._beat_for``),
so a stage that writes the batch row before its last heartbeat waits forever for itself. SQLite
writes the heartbeat in the stage transaction and cannot catch it. This test runs validation and
application with a heartbeat on every row and a lock timeout, so a regression fails instead of
hanging (Req: Estados del lote con etapas reanudables; RF-021, RF-027).
"""

import io
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
from app.modules.catalog.models import Piece
from app.modules.imports import worker
from app.modules.imports.apply import apply_stage
from app.modules.imports.decisions import approval_summary, approve
from app.modules.imports.mapping import ColumnSpec, MappingSpec
from app.modules.imports.models import ImportBatch
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.service import create_batch, ingest_stage, set_mapping, validate_stage
from app.modules.users.models import AppUser
from app.seed.synthetic import SeedOptions, run_seed

pytestmark = pytest.mark.postgres

API_DIR = Path(__file__).resolve().parents[1]


class MemoryStorage:
    def __init__(self) -> None:
        self.data: dict[str, bytes] = {}

    def put_bytes(self, key: str, data: bytes, _type: str) -> None:
        self.data[key] = data

    def get_bytes(self, key: str) -> bytes:
        return self.data[key]


@pytest.fixture(scope="module")
def factory(postgres_url: str) -> Iterator[sessionmaker[Session]]:
    config = Config(str(API_DIR / "alembic.ini"), stdout=io.StringIO())
    config.set_main_option("script_location", str(API_DIR / "alembic"))
    config.attributes["configure_logger"] = False
    config.set_section_option("alembic", "sqlalchemy.url", postgres_url)
    with pytest.MonkeyPatch.context() as patch:
        patch.setenv("DATABASE_URL", postgres_url)  # read by alembic/env.py
        command.upgrade(config, "head")
    # A blocked heartbeat raises after 5 s instead of waiting forever.
    engine = create_engine(
        postgres_url, poolclass=NullPool, connect_args={"options": "-c lock_timeout=5000"}
    )
    sessions = make_session_factory(engine)
    with sessions() as session:
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    yield sessions
    engine.dispose()


def _run(sessions: sessionmaker[Session], batch_id, stage, work, user_id) -> None:  # type: ignore[no-untyped-def]
    with sessions() as session:
        worker.start_stage(session, batch_id, stage)
        session.commit()
    with sessions() as session:
        worker.run_stage(session, sessions, batch_id, stage, work, user_id)


def test_validation_and_application_heartbeat_without_blocking(
    factory: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(worker, "HEARTBEAT_EVERY_ROWS", 1)
    storage = MemoryStorage()
    with factory() as session:
        user = session.scalar(select(AppUser).where(AppUser.email == "admin@matp.local"))
        seeded = session.scalar(select(Piece.denomination).order_by(Piece.id).limit(1))
        assert user is not None and seeded is not None
        user_id = user.id
    # Rows 2 and 3 are new; row 4 repeats a seeded denomination without codes, so validation
    # writes a review link (and flushes) in the middle of the stage.
    content = (
        f"DENOMINACIÓN;CÓDIGOS\nPieza pg uno;I-987001\nPieza pg dos;I-987002\n{seeded};S/N\n"
    ).encode()
    context = AuditContext(origin=AuditOrigin.MANUAL, user_id=user_id)
    with factory() as session, audit_context(session, context):
        batch = create_batch(
            session, storage, file_name="pg.csv", content=content, uploaded_by_id=user_id
        )
        session.commit()
        batch_id = batch.id

    _run(factory, batch_id, worker.Stage.INGEST, ingest_stage(content, storage), user_id)
    spec = MappingSpec(
        columns=[
            ColumnSpec("DENOMINACIÓN", "denomination"),
            ColumnSpec("CÓDIGOS", "identifier", "I"),
        ],
        defaults={"tenure_regime": "Propiedad"},
    )
    with factory() as session, audit_context(session, context):
        set_mapping(session, storage, batch_id, spec)
        session.commit()
    _run(factory, batch_id, worker.Stage.VALIDATE, validate_stage(), user_id)

    with factory() as session, audit_context(session, context):
        batch = session.get(ImportBatch, batch_id)
        assert batch is not None
        assert batch.status == S.IN_PREVIEW, batch.status_reason
        assert (batch.counts or {})["POSSIBLE_DUPLICATE"] == 1
        approve(session, batch_id, approval_summary(session, batch_id).token, user_id)
        session.commit()
    _run(factory, batch_id, worker.Stage.APPLY, apply_stage(), user_id)

    with factory() as session:
        batch = session.get(ImportBatch, batch_id)
        assert batch is not None
        assert batch.status == S.APPLIED, batch.status_reason
        assert batch.change_set_id is not None and batch.processing_started_at is None
        assert (batch.counts or {})["APPLIED_CREATED"] == 2
