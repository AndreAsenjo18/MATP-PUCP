"""Photos of a photo-only batch matched with the catalogue (change importacion-fotos-a-catalogo).

Task 3.10 (spec importacion-datos, «Asignación manual de fotos a piezas existentes», scenario
«Asignación que sobrevive a una nueva lectura»): ``match_batch_photos`` on a ``PHOTOS`` batch
proposes pieces of the catalogue from their current identifiers, never touches a manual or a
discarded photo, leaves retired pieces out and writes nothing when run again. On SQLite with the
seeded database of ``tests/conftest.py``. Synthetic data only (RNF-014).
"""

import hashlib
import uuid
from collections.abc import Callable

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.models import AppUser, Collection, Piece
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.identification.service import add_identifier
from app.modules.imports.catalog_photo_matching import OTHER_COLLECTION
from app.modules.imports.catalog_photos import catalog_index
from app.modules.imports.mapping import MappingContext
from app.modules.imports.models import (
    ImportBatch,
    ImportPhoto,
    ImportPhotoStatus,
    PhotoMatchSource,
    PhotoMatchStatus,
)
from app.modules.imports.models import ImportBatchStatus as S
from app.modules.imports.photos import match_batch_photos
from app.modules.imports.service import create_photo_batch
from tests.conftest import ActAs

FIELDS = ("match_status", "match_source", "piece_id", "match_reason", "sort_key")


class Lot:
    def __init__(self, session: Session, act_as: ActAs, user: AppUser) -> None:
        self.session, self.act_as = session, act_as
        with act_as("CATALOGUER"):
            self.collection = Collection(
                id=new_uuid(),
                name="Colección sintética de fotos",
                acronym="SFT",
                acronym_normalized="SFT",
                default_tenure_regime=TenureRegime.OWNED,
            )
            session.add(self.collection)
            batch = create_photo_batch(session, name="Fotos SFT", uploaded_by_id=user.id)
            session.commit()
        self.id = batch.id

    def piece(self, *codes: tuple[str, str], collection: Collection | None = None) -> Piece:
        with self.act_as("CATALOGUER"):
            piece = Piece(
                id=new_uuid(),
                denomination="Pieza sintética",
                tenure_regime=TenureRegime.OWNED,
                collection_id=(collection or self.collection).id,
            )
            self.session.add(piece)
            self.session.flush()
            for type_code, value in codes:
                add_identifier(self.session, piece, type_code, value)
            self.session.commit()
        return piece

    def add_photo(self, path: str, **values: object) -> uuid.UUID:
        photo_id = new_uuid()
        with self.act_as("CATALOGUER"):
            self.session.add(
                ImportPhoto(
                    id=photo_id,
                    batch_id=self.id,
                    relative_path=path,
                    original_filename=path.rsplit("/", 1)[-1],
                    content_sha256=hashlib.sha256(f"{self.id}{path}".encode()).hexdigest(),
                    size_bytes=1024,
                    content_type="image/jpeg",
                    storage_prefix=f"media/{photo_id}/",
                    **{"status": ImportPhotoStatus.VERIFIED, **values},
                )
            )
            self.session.commit()
        return photo_id

    @property
    def batch(self) -> ImportBatch:
        batch = self.session.get(ImportBatch, self.id)
        assert batch is not None
        return batch

    def match(self) -> int:
        with self.act_as("CATALOGUER"):
            done = match_batch_photos(
                self.session, self.batch, MappingContext(self.session).identifier_rules
            )
            self.session.commit()
        return done

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
def new_lot(session: Session, act_as: ActAs, users: dict[str, AppUser]) -> Callable[[], Lot]:
    return lambda: Lot(session, act_as, users["CATALOGUER"])


def test_photos_are_proposed_for_pieces_of_the_catalogue(new_lot: Callable[[], Lot]) -> None:
    lot = new_lot()
    first = lot.piece(("COLECCION", "SFT 1"), ("PUCP", "91234"))
    second = lot.piece(("COLECCION", "SFT 2"))
    photos = {
        "two_codes": lot.add_photo("Fotos SFT/SFT 001 - PUCP 91234 (2).JPG"),
        "one_code": lot.add_photo("Fotos SFT/SFT 001 - PUCP 91234 (1).JPG"),
        "number": lot.add_photo("Fotos SFT/2.JPG"),
        "camera": lot.add_photo("Fotos SFT/ALTAS/82LF4169 copy.jpg"),
    }

    assert lot.match() == 4

    assert (lot.photo(photos["one_code"]).piece_id, lot.photo(photos["one_code"]).sort_key) == (
        first.id,
        1,
    )
    assert lot.photo(photos["two_codes"]).sort_key == 2
    assert lot.photo(photos["number"]).piece_id == second.id
    assert lot.photo(photos["number"]).match_source is PhotoMatchSource.FILENAME
    camera = lot.photo(photos["camera"])
    assert camera.match_status is PhotoMatchStatus.UNMATCHED and camera.piece_id is None
    assert lot.batch.status is S.UPLOADED  # matching alone does not move the batch


def test_running_again_keeps_manual_and_discarded_photos_and_writes_nothing(
    new_lot: Callable[[], Lot],
) -> None:
    lot = new_lot()
    piece = lot.piece(("COLECCION", "SFT 3"))
    other = lot.piece(("COLECCION", "SFT 4"))
    automatic = lot.add_photo("Fotos SFT/SFT 3.jpg")
    manual = lot.add_photo(
        "Fotos SFT/SFT 3 (2).jpg",
        match_status=PhotoMatchStatus.MANUAL,
        match_source=PhotoMatchSource.MANUAL,
        piece_id=other.id,
        sort_key=1,
    )
    discarded = lot.add_photo("Fotos SFT/SFT 3 (3).jpg", status=ImportPhotoStatus.DISCARDED)

    lot.match()
    first = lot.snapshot()
    assert lot.match() == 1
    second = lot.snapshot()

    assert first == second
    assert lot.photo(automatic).piece_id == piece.id
    assert lot.photo(manual).piece_id == other.id
    assert lot.photo(discarded).match_status is None


def test_retired_pieces_and_historical_codes_are_left_out(
    new_lot: Callable[[], Lot], session: Session, act_as: ActAs
) -> None:
    lot = new_lot()
    retired = lot.piece(("COLECCION", "SFT 5"))
    with act_as("COLLECTIONS_MANAGER"):
        soft_delete(session, retired, "Retirada sintética")
        session.commit()

    index = catalog_index(session)

    assert retired.id not in index.collection_of
    photo = lot.add_photo("Fotos SFT/SFT 5.jpg")
    lot.match()
    assert lot.photo(photo).piece_id is None


def test_a_piece_of_another_collection_is_only_a_candidate(
    new_lot: Callable[[], Lot], session: Session, act_as: ActAs
) -> None:
    lot = new_lot()
    with act_as("CATALOGUER"):
        elsewhere = Collection(
            id=new_uuid(),
            name="Otra colección sintética",
            acronym="OTC",
            acronym_normalized="OTC",
            default_tenure_regime=TenureRegime.OWNED,
        )
        session.add(elsewhere)
        session.commit()
    outside = lot.piece(("PUCP", "97777"), collection=elsewhere)
    photo = lot.add_photo("Fotos SFT/PUCP 97777.jpg")

    lot.match()

    proposal = lot.photo(photo)
    assert proposal.match_status is PhotoMatchStatus.UNMATCHED
    assert proposal.match_reason == OTHER_COLLECTION
    assert proposal.candidate_piece_ids == [str(outside.id)]
