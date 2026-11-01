"""Photo packages of several pieces (descargas-masivas-y-enriquecimiento-lote, section 2).

Spec multimedia, «Descarga masiva de fotografías por paquete» and «Restricciones de uso
respetadas en la descarga masiva»; design D1 to D3. The service and the worker run on the
SQLite test database with an in-memory storage. Synthetic data only (RNF-014).
"""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.core.db import make_session_factory
from app.core.errors import ConflictError
from app.core.models_base import utcnow
from app.models import AppUser
from app.modules.media.bulk_download import create_bulk_download, fail_interrupted
from app.modules.media.models import BulkDownloadStatus as S
from app.modules.media.models import MediaBulkDownload
from tests.conftest import ActAs


# ------------------------------------------------------------------ task 2.1: the job
def test_a_package_is_created_pending_with_its_pieces_once(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    piece = uuid.uuid4()
    with act_as("COLLECTIONS_MANAGER"):
        job = create_bulk_download(session, users["COLLECTIONS_MANAGER"].id, [piece, piece])
        session.commit()

    assert job.status is S.PENDING
    assert job.piece_ids == [str(piece)]
    assert job.requested_by_id == users["COLLECTIONS_MANAGER"].id


def test_a_second_package_in_preparation_is_409_but_not_for_someone_else(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    manager, cataloguer = users["COLLECTIONS_MANAGER"].id, users["CATALOGUER"].id
    with act_as("COLLECTIONS_MANAGER"):
        first = create_bulk_download(session, manager, [uuid.uuid4()])
        session.commit()
        with pytest.raises(ConflictError) as raised:
            create_bulk_download(session, manager, [uuid.uuid4()])
    with act_as("CATALOGUER"):
        other = create_bulk_download(session, cataloguer, [uuid.uuid4()])
        session.commit()

    assert raised.value.code == "bulk_download_in_progress"
    assert raised.value.details == {"job_id": str(first.id)}
    assert other.requested_by_id == cataloguer


@pytest.mark.parametrize("finished", [S.READY, S.FAILED])
def test_a_new_package_is_allowed_once_the_previous_one_finished(
    session: Session, act_as: ActAs, users: dict[str, AppUser], finished: S
) -> None:
    manager = users["COLLECTIONS_MANAGER"].id
    with act_as("COLLECTIONS_MANAGER"):
        first = create_bulk_download(session, manager, [uuid.uuid4()])
        first.status = finished
        session.commit()

        second = create_bulk_download(session, manager, [uuid.uuid4()])
        session.commit()

    assert second.status is S.PENDING


def test_a_running_package_without_heartbeat_does_not_block(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    manager = users["COLLECTIONS_MANAGER"].id
    with act_as("COLLECTIONS_MANAGER"):
        first = create_bulk_download(session, manager, [uuid.uuid4()])
        first.status = S.RUNNING
        first.heartbeat_at = utcnow() - timedelta(hours=1)
        session.commit()

        assert create_bulk_download(session, manager, [uuid.uuid4()]).status is S.PENDING


def test_on_startup_the_packages_left_in_preparation_fail(
    session: Session, engine: Engine, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        pending = create_bulk_download(session, users["COLLECTIONS_MANAGER"].id, [uuid.uuid4()])
        session.commit()

    assert fail_interrupted(make_session_factory(engine)) == 1
    session.expire_all()
    failed = session.get(MediaBulkDownload, pending.id)
    assert failed is not None and failed.status is S.FAILED and failed.error
