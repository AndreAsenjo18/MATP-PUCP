"""Photo matching inside the import pipeline (task 3.3 of importacion-masiva-fotografias).

Spec importacion-datos, «Emparejamiento automático propuesto entre fotos y filas» and «Bandeja de
revisión de fotografías del lote»; design D3 and D4. The pipeline stages are the real ones on
SQLite. Upload and verification (tasks 2.1 and 2.2) do not exist yet: photos are inserted already
``VERIFIED`` as their stand-in. Synthetic data only (RNF-014).
"""

import hashlib
import uuid
from collections.abc import Callable

import pytest
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core.db import make_session_factory
from app.core.models_base import new_uuid
from app.models import AppUser
from app.modules.audit.models import AuditLog
from app.modules.imports import photos as photos_module
from app.modules.imports.log import build_log
from app.modules.imports.mapping import ColumnSpec, MappingContext, MappingSpec
from app.modules.imports.models import (
    ImportBatch,
    ImportPhoto,
    ImportPhotoStatus,
    ImportRow,
    PhotoMatchSource,
    PhotoMatchStatus,
)
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.photos import match_batch_photos
from app.modules.imports.service import (
    clear_rows,
    create_batch,
    ingest_stage,
    set_mapping,
    validate_stage,
)
from app.modules.imports.worker import Stage, run_stage, start_stage
from tests.conftest import ActAs

# Rows 2 to 5 of the sheet: a code I, a collection code, and two rows a lone `245` matches.
CONTENT = (
    "DENOMINACIÓN;CÓDIGO I;COLECCIÓN;PUCP\n"
    "Toro sintético;I-01234;;\n"
    "Retablo sintético;;MMZ 45;\n"
    "Mate sintético;;RA 245;\n"
    "Manta sintética;;;245\n"
).encode()
SPEC = MappingSpec(
    columns=[
        ColumnSpec("DENOMINACIÓN", "denomination"),
        ColumnSpec("CÓDIGO I", "identifier", "I"),
        ColumnSpec("COLECCIÓN", "identifier", "COLECCION"),
        ColumnSpec("PUCP", "identifier", "PUCP"),
    ],
    defaults={"tenure_regime": "Propiedad"},
)
FIELDS = ("status", "match_status", "match_source", "row_id", "candidate_row_ids", "sort_key")


class MemoryStorage:
    def __init__(self) -> None:
        self.data: dict[str, bytes] = {}

    def put_bytes(self, key: str, data: bytes, _type: str) -> None:
        self.data[key] = data

    def get_bytes(self, key: str) -> bytes:
        return self.data[key]


class Batch:
    """A batch of the real pipeline, ingested and mapped, with photos added as verified."""

    def __init__(self, session: Session, engine: Engine, act_as: ActAs, user: AppUser) -> None:
        self.session, self.engine, self.act_as, self.user_id = session, engine, act_as, user.id
        self.storage = MemoryStorage()
        with act_as("CATALOGUER"):
            batch = create_batch(
                session,
                self.storage,
                file_name="sabana_fotos.csv",
                content=CONTENT,
                uploaded_by_id=self.user_id,
            )
            session.commit()
        self.id = batch.id
        self._stage(Stage.INGEST, ingest_stage(CONTENT, self.storage))
        self.map()

    def _stage(self, stage: Stage, work) -> None:  # type: ignore[no-untyped-def]
        start_stage(self.session, self.id, stage)
        self.session.commit()
        run_stage(
            self.session, make_session_factory(self.engine), self.id, stage, work, self.user_id
        )
        self.session.expire_all()

    def map(self) -> None:
        with self.act_as("CATALOGUER"):
            set_mapping(self.session, self.storage, self.id, SPEC)
            self.session.commit()

    def validate(self) -> ImportBatch:
        self._stage(Stage.VALIDATE, validate_stage())
        return self.batch

    @property
    def batch(self) -> ImportBatch:
        batch = self.session.get(ImportBatch, self.id)
        assert batch is not None
        return batch

    def row(self, number: int) -> uuid.UUID:
        row_id = self.session.scalar(
            select(ImportRow.id).where(
                ImportRow.batch_id == self.id, ImportRow.source_row_number == number
            )
        )
        assert row_id is not None
        return row_id

    def add_photo(self, path: str, **values: object) -> uuid.UUID:
        photo_id = new_uuid()
        with self.act_as("CATALOGUER"):
            self.session.add(
                ImportPhoto(
                    id=photo_id,
                    batch_id=self.id,
                    relative_path=path,
                    original_filename=path.rsplit("/", 1)[-1],
                    content_sha256=hashlib.sha256(path.encode()).hexdigest(),
                    size_bytes=1024,
                    content_type="image/jpeg",
                    storage_prefix=f"media/{photo_id}/",
                    **{"status": ImportPhotoStatus.VERIFIED, **values},
                )
            )
            self.session.commit()
        return photo_id

    def photo(self, photo_id: uuid.UUID) -> ImportPhoto:
        self.session.expire_all()
        photo = self.session.get(ImportPhoto, photo_id)
        assert photo is not None
        return photo

    def snapshot(self) -> dict[uuid.UUID, tuple[object, ...]]:
        self.session.expire_all()
        return {
            photo.id: tuple(getattr(photo, name) for name in FIELDS)
            for photo in self.session.scalars(
                select(ImportPhoto).where(ImportPhoto.batch_id == self.id)
            )
        }


@pytest.fixture
def new_batch(
    session: Session, engine: Engine, act_as: ActAs, users: dict[str, AppUser]
) -> Callable[[], Batch]:
    return lambda: Batch(session, engine, act_as, users["CATALOGUER"])


def test_validation_proposes_the_row_of_every_verified_photo(
    new_batch: Callable[[], Batch],
) -> None:
    lot = new_batch()
    first = lot.add_photo("fotos/I 1234.JPG")
    second = lot.add_photo("fotos/I 1234 (2).JPG")
    folder = lot.add_photo("MMZ 045/DSC_0001.jpg")
    ambiguous = lot.add_photo("245.jpg")
    unmatched = lot.add_photo("Fotos sueltas/IMG_20190312_101500.jpg")
    uploading = lot.add_photo("fotos/I 1234 (5).JPG", status=ImportPhotoStatus.UPLOADED)

    assert lot.validate().status == S.IN_PREVIEW, lot.batch.status_reason

    toro = lot.row(2)
    assert (lot.photo(first).row_id, lot.photo(first).sort_key) == (toro, 1)
    assert (lot.photo(second).row_id, lot.photo(second).sort_key) == (toro, 2)
    assert lot.photo(second).match_source is PhotoMatchSource.FILENAME
    assert lot.photo(folder).match_source is PhotoMatchSource.FOLDER
    assert lot.photo(folder).row_id == lot.row(3)
    proposal = lot.photo(ambiguous)
    assert proposal.match_status is PhotoMatchStatus.AMBIGUOUS
    assert proposal.row_id is None
    assert set(proposal.candidate_row_ids or []) == {str(lot.row(4)), str(lot.row(5))}
    assert lot.photo(unmatched).match_status is PhotoMatchStatus.UNMATCHED
    # A photo still uploading is matched later, once verified (task 2.2).
    assert lot.photo(uploading).match_status is None


def test_running_the_matching_again_changes_nothing(
    new_batch: Callable[[], Batch], session: Session, act_as: ActAs
) -> None:
    lot = new_batch()
    for path in ("fotos/I 1234.JPG", "fotos/I 1234 (2).JPG", "245.jpg", "MMZ 045/DSC_1.jpg"):
        lot.add_photo(path)
    lot.validate()
    first_run = lot.snapshot()
    audit_entries = session.scalar(select(func.count()).select_from(AuditLog))

    with act_as("CATALOGUER"):
        match_batch_photos(session, lot.batch, MappingContext(session).identifier_rules)
        session.commit()
    assert lot.snapshot() == first_run
    assert session.scalar(select(func.count()).select_from(AuditLog)) == audit_entries

    lot.map()  # re-mapping and validating again gives the same proposals
    assert lot.validate().status == S.IN_PREVIEW
    assert lot.snapshot() == first_run


def test_manual_photos_keep_their_row_and_order_and_automatic_ones_follow(
    new_batch: Callable[[], Batch],
) -> None:
    lot = new_batch()
    toro = lot.row(2)
    manual = lot.add_photo(
        "varios/otra_foto.jpg",
        match_status=PhotoMatchStatus.MANUAL,
        match_source=PhotoMatchSource.MANUAL,
        row_id=toro,
        sort_key=3,
    )
    first = lot.add_photo("fotos/I 1234.JPG")
    second = lot.add_photo("fotos/I 1234 (2).JPG")
    lot.validate()

    kept = lot.photo(manual)
    assert (kept.match_status, kept.row_id, kept.sort_key) == (PhotoMatchStatus.MANUAL, toro, 3)
    assert (lot.photo(first).row_id, lot.photo(first).sort_key) == (toro, 4)
    assert (lot.photo(second).row_id, lot.photo(second).sort_key) == (toro, 5)


def test_a_photo_removed_from_its_row_by_hand_is_not_matched_again(
    new_batch: Callable[[], Batch],
) -> None:
    """`unassign` leaves the photo MANUAL without a row: the code in its name is not used again."""
    lot = new_batch()
    removed = lot.add_photo(
        "fotos/I 1234 (3).JPG",
        match_status=PhotoMatchStatus.MANUAL,
        match_source=PhotoMatchSource.MANUAL,
    )
    never_matched = lot.add_photo("fotos/I 1234.JPG")
    lot.validate()

    photo = lot.photo(removed)
    assert photo.match_status is PhotoMatchStatus.MANUAL
    assert (photo.row_id, photo.sort_key) == (None, None)
    assert lot.photo(never_matched).match_status is PhotoMatchStatus.MATCHED


def test_a_discarded_photo_is_not_matched_again(new_batch: Callable[[], Batch]) -> None:
    lot = new_batch()
    discarded = lot.add_photo(
        "fotos/I 1234 (4).JPG",
        status=ImportPhotoStatus.DISCARDED,
        rejection_reason="Foto desenfocada (sintético)",
    )
    lot.validate()

    photo = lot.photo(discarded)
    assert photo.status is ImportPhotoStatus.DISCARDED
    assert (photo.match_status, photo.row_id) == (None, None)


def test_a_matching_failure_fails_the_validation_and_leaves_no_proposal(
    new_batch: Callable[[], Batch], monkeypatch: pytest.MonkeyPatch, session: Session
) -> None:
    def broken(*_args: object, **_kwargs: object) -> list[object]:
        raise RuntimeError("fallo sintético")

    monkeypatch.setattr(photos_module, "match_photos", broken)
    lot = new_batch()
    photo_id = lot.add_photo("fotos/I 1234.JPG")

    batch = lot.validate()
    assert batch.status == S.MAPPED  # never VALIDATED: the whole stage is rolled back
    assert batch.status_reason is not None
    assert batch.status_reason.startswith(
        "No se pudo proponer la fila de las fotos del lote (RuntimeError)."
    )
    assert build_log(session, batch)["batch"]["status_reason"] == batch.status_reason
    assert lot.photo(photo_id).match_status is None
    classified = session.scalar(
        select(func.count())
        .select_from(ImportRow)
        .where(ImportRow.batch_id == lot.id, ImportRow.classification.is_not(None))
    )
    assert classified == 0


def test_reingestion_detaches_the_photos_without_breaking_the_foreign_key(
    new_batch: Callable[[], Batch], session: Session, act_as: ActAs
) -> None:
    lot = new_batch()
    toro = lot.row(2)
    automatic = lot.add_photo("fotos/I 1234.JPG")
    ambiguous = lot.add_photo("245.jpg")
    assigned = lot.add_photo(
        "varios/otra_foto.jpg",
        match_status=PhotoMatchStatus.MANUAL,
        match_source=PhotoMatchSource.MANUAL,
        row_id=toro,
        sort_key=1,
    )
    removed = lot.add_photo(
        "fotos/I 1234 (3).JPG",
        match_status=PhotoMatchStatus.MANUAL,
        match_source=PhotoMatchSource.MANUAL,
    )
    lot.validate()

    with act_as("CATALOGUER"):
        clear_rows(session, lot.batch)  # SQLite enforces the foreign keys in these tests
        session.commit()

    assert session.scalar(select(func.count()).select_from(ImportRow)) == 0
    for photo_id in (automatic, ambiguous, assigned):
        photo = lot.photo(photo_id)
        assert (photo.match_status, photo.row_id, photo.sort_key) == (None, None, None)
        assert not photo.candidate_row_ids
    kept = lot.photo(removed)
    assert (kept.match_status, kept.row_id) == (PhotoMatchStatus.MANUAL, None)


def test_remapping_only_clears_the_automatic_proposals(new_batch: Callable[[], Batch]) -> None:
    lot = new_batch()
    toro = lot.row(2)
    automatic = lot.add_photo("fotos/I 1234.JPG")
    assigned = lot.add_photo(
        "varios/otra_foto.jpg",
        match_status=PhotoMatchStatus.MANUAL,
        match_source=PhotoMatchSource.MANUAL,
        row_id=toro,
        sort_key=1,
    )
    removed = lot.add_photo(
        "fotos/I 1234 (3).JPG",
        match_status=PhotoMatchStatus.MANUAL,
        match_source=PhotoMatchSource.MANUAL,
    )
    lot.validate()

    lot.map()  # same sheet: the rows keep their id and reset_validation runs
    assert lot.batch.status == S.MAPPED

    photo = lot.photo(automatic)
    assert (photo.match_status, photo.row_id, photo.sort_key) == (None, None, None)
    kept = lot.photo(assigned)
    assert (kept.match_status, kept.row_id, kept.sort_key) == (PhotoMatchStatus.MANUAL, toro, 1)
    assert lot.photo(removed).match_status is PhotoMatchStatus.MANUAL
