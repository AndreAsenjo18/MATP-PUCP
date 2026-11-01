"""Photo packages of several pieces (descargas-masivas-y-enriquecimiento-lote, section 2).

Spec multimedia, «Descarga masiva de fotografías por paquete» and «Restricciones de uso
respetadas en la descarga masiva»; design D1 to D3. The service and the worker run on the
SQLite test database with an in-memory storage. Synthetic data only (RNF-014).
"""

import io
import uuid
import zipfile
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.core.db import make_session_factory
from app.core.errors import ConflictError
from app.core.models_base import new_uuid, utcnow
from app.models import AppUser
from app.modules.catalog.models import Piece, TenureRegime
from app.modules.catalog.service import change_tenure, create_piece
from app.modules.media import bulk_download
from app.modules.media.bulk_download import (
    build_bulk_download,
    create_bulk_download,
    fail_interrupted,
)
from app.modules.media.models import BulkDownloadStatus as S
from app.modules.media.models import MediaAsset, MediaBulkDownload
from app.modules.media.service import comodato_restriction_term_id
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


# ---------------------------------------------------------------- task 2.2: the worker
class Storage:
    """In-memory storage: what the worker reads and the ZIP it uploads."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def get_bytes(self, key: str) -> bytes:
        return self.objects[key]

    def put_bytes(self, key: str, data: bytes, _type: str) -> None:
        self.objects[key] = data


class Broken(Storage):
    def put_bytes(self, key: str, data: bytes, _type: str) -> None:
        raise OSError("almacenamiento caído (sintético)")


def _photo(
    session: Session, storage: Storage, piece: Piece, name: str, **values: object
) -> MediaAsset:
    asset_id = new_uuid()
    key = f"pieces/{piece.id}/{asset_id}/original.jpg"
    storage.objects[key] = f"jpeg {name}".encode()
    asset = MediaAsset(
        id=asset_id,
        piece_id=piece.id,
        storage_key=key,
        original_filename=f"{name}.jpg",
        content_type="image/jpeg",
        size_bytes=len(storage.objects[key]),
        content_sha256=asset_id.hex * 2,
        **values,
    )
    session.add(asset)
    session.flush()
    return asset


@pytest.fixture
def lot(session: Session, act_as: ActAs, users: dict[str, AppUser]):  # type: ignore[no-untyped-def]
    """An owned piece with two photos and a loan for use one whose photo carries «No publicar»."""
    storage = Storage()
    with act_as("COLLECTIONS_MANAGER"):
        owned = create_piece(
            session, denomination="Retablo sintético", tenure_regime=TenureRegime.OWNED
        )
        lent = create_piece(
            session, denomination="Manta sintética", tenure_regime=TenureRegime.LOAN_FOR_USE
        )
        front = _photo(session, storage, owned, "frontal", sort_order=0, is_primary=True)
        back = _photo(session, storage, owned, "posterior", sort_order=1)
        restricted = _photo(
            session,
            storage,
            lent,
            "manta",
            usage_restriction_term_id=comodato_restriction_term_id(session),
        )
        job = create_bulk_download(session, users["COLLECTIONS_MANAGER"].id, [owned.id, lent.id])
        session.commit()
    return SimpleNamespace(
        storage=storage,
        owned=owned,
        lent=lent,
        front=front,
        back=back,
        restricted=restricted,
        job=job,
    )


def _run(
    session: Session, engine: Engine, job: MediaBulkDownload, storage: Storage
) -> MediaBulkDownload:
    build_bulk_download(make_session_factory(engine), job.id, storage, ttl_hours=24)  # type: ignore[arg-type]
    session.expire_all()
    built = session.get(MediaBulkDownload, job.id)
    assert built is not None
    return built


def _entries(storage: Storage, job: MediaBulkDownload) -> list[str]:
    assert job.storage_key is not None
    with zipfile.ZipFile(io.BytesIO(storage.objects[job.storage_key])) as archive:
        return archive.namelist()


def test_the_zip_has_the_allowed_photos_and_leaves_out_the_restricted_one(
    session: Session, engine: Engine, lot
) -> None:  # type: ignore[no-untyped-def]
    built = _run(session, engine, lot.job, lot.storage)

    assert built.status is S.READY
    assert built.included_photos == 2
    assert built.omitted == [
        {
            "media_id": str(lot.restricted.id),
            "piece_id": str(lot.lent.id),
            "restriction": "NO_PUBLICAR",
        }
    ]
    folder = f"Retablo sintético ({str(lot.owned.id)[:8]})"
    assert _entries(lot.storage, built) == [
        f"{folder}/01 frontal.jpg",
        f"{folder}/02 posterior.jpg",
    ]
    assert built.storage_key == f"exports/bulk-download/{built.id}.zip"
    assert built.expires_at is not None
    left = built.expires_at.replace(tzinfo=None) - utcnow().replace(tzinfo=None)
    assert timedelta(hours=23) < left <= timedelta(hours=24)


def test_a_piece_that_became_a_loan_for_use_after_its_photos_is_left_out(
    session: Session, engine: Engine, act_as: ActAs, users: dict[str, AppUser], lot
) -> None:  # type: ignore[no-untyped-def]
    """Its photos have no restriction of their own and it has no collection (RN-008)."""
    with act_as("COLLECTIONS_MANAGER"):
        change_tenure(session, lot.owned, TenureRegime.LOAN_FOR_USE, "Pasa a comodato (sintético)")
        session.commit()

    built = _run(session, engine, lot.job, lot.storage)

    assert built.included_photos == 0
    assert {item["media_id"] for item in built.omitted} == {
        str(lot.front.id),
        str(lot.back.id),
        str(lot.restricted.id),
    }
    assert {item["restriction"] for item in built.omitted} == {"NO_PUBLICAR"}


def test_when_every_photo_is_restricted_the_package_ends_without_a_file(
    session: Session, engine: Engine, act_as: ActAs, users: dict[str, AppUser], lot
) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        lot.job.status = S.READY  # the first package is done
        only_lent = create_bulk_download(session, users["COLLECTIONS_MANAGER"].id, [lot.lent.id])
        session.commit()

    built = _run(session, engine, only_lent, lot.storage)

    assert (built.status, built.included_photos, built.storage_key, built.expires_at) == (
        S.READY,
        0,
        None,
        None,
    )
    assert [item["restriction"] for item in built.omitted] == ["NO_PUBLICAR"]
    assert not [key for key in lot.storage.objects if key.startswith("exports/")]


def test_the_temporary_zip_is_always_deleted(
    session: Session, engine: Engine, lot, monkeypatch: pytest.MonkeyPatch
) -> None:  # type: ignore[no-untyped-def]
    created: list[Path] = []
    original = bulk_download._temporary_zip

    def recording() -> Path:
        created.append(original())
        return created[-1]

    monkeypatch.setattr(bulk_download, "_temporary_zip", recording)

    _run(session, engine, lot.job, lot.storage)

    assert created and not created[0].exists()


def test_a_failure_leaves_the_package_failed_and_no_temporary_file(
    session: Session, engine: Engine, lot, monkeypatch: pytest.MonkeyPatch
) -> None:  # type: ignore[no-untyped-def]
    broken = Broken()
    broken.objects = lot.storage.objects
    created: list[Path] = []
    original = bulk_download._temporary_zip
    monkeypatch.setattr(
        bulk_download, "_temporary_zip", lambda: created.append(original()) or created[-1]
    )

    built = _run(session, engine, lot.job, broken)

    assert built.status is S.FAILED and built.error
    assert created and not created[0].exists()


def test_deleted_photos_and_pieces_stay_out_of_the_package(
    session: Session, engine: Engine, act_as: ActAs, lot
) -> None:  # type: ignore[no-untyped-def]
    with act_as("COLLECTIONS_MANAGER"):
        lot.back.deleted_at = utcnow()
        lot.lent.deleted_at = utcnow()
        session.commit()

    built = _run(session, engine, lot.job, lot.storage)

    assert (built.included_photos, built.omitted) == (1, [])
    assert [name.rsplit("/", 1)[1] for name in _entries(lot.storage, built)] == ["01 frontal.jpg"]
