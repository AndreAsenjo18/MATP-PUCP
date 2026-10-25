"""Photos of an applied import batch registered on their piece (importacion-masiva-fotografias 5.1).

Spec importacion-datos, «Aplicación y reversión conjunta de piezas y fotografías»; design D5. The
photos come already verified from the batch (task 2.2): ``register_from_import`` neither reads
nor copies them. Each test has its own database with the reference seed. Synthetic data only
(RNF-014).
"""

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.audit.models import AuditLog, AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Term, Vocabulary, VocabularyCode
from app.modules.imports.models import ImportPhoto, ImportPhotoStatus
from app.modules.media.service import (
    LOAN_RESTRICTION_NOTE,
    UNSPECIFIED_VIEW_TYPE,
    register_from_import,
    unspecified_view_type_id,
)
from app.seed.reference import ReferenceData
from tests.conftest import ActAs


def _photo(name: str, batch_id: uuid.UUID) -> ImportPhoto:
    photo_id = new_uuid()
    return ImportPhoto(
        id=photo_id,
        batch_id=batch_id,
        relative_path=f"lote/{name}",
        original_filename=name,
        content_sha256=f"{photo_id.hex}{photo_id.hex}",
        size_bytes=2048,
        content_type="image/jpeg",
        storage_prefix=f"media/{photo_id}/",
        status=ImportPhotoStatus.VERIFIED,
    )


def _unspecified_terms(session: Session) -> list[Term]:
    return list(
        session.scalars(
            select(Term)
            .join(Vocabulary)
            .where(
                Vocabulary.code == VocabularyCode.PHOTO_VIEW_TYPE,
                Term.code == UNSPECIFIED_VIEW_TYPE,
            )
            .execution_options(**{INCLUDE_DELETED: True})
        )
    )


def _forget_unspecified_term(session: Session) -> None:
    """An environment seeded before the term existed: rename the seeded one out of the way."""
    (term,) = _unspecified_terms(session)
    session.execute(
        update(Term).where(Term.id == term.id).values(code="VISTA_ANTIGUA", label="Vista antigua")
    )
    session.commit()


def test_a_new_piece_gets_its_photos_in_order_with_the_first_as_primary(
    session: Session, reference: ReferenceData, act_as: ActAs
) -> None:
    batch_id = new_uuid()
    view_type = unspecified_view_type_id(session)
    with act_as("CATALOGUER", origin=AuditOrigin.IMPORT, origin_ref=str(batch_id)):
        piece = create_piece(
            session, denomination="Retablo sintético", tenure_regime=TenureRegime.OWNED
        )
        photos = [
            _photo(name, batch_id) for name in ("I 1234.jpg", "I 1234 (2).jpg", "I 1234 (3).jpg")
        ]
        assets = [
            register_from_import(
                session,
                piece,
                photo,
                storage_key=f"{photo.storage_prefix}upload.jpeg",
                view_type_term_id=view_type,
            )
            for photo in photos
        ]
        session.commit()

    assert [asset.sort_order for asset in assets] == [0, 1, 2]
    assert [asset.is_primary for asset in assets] == [True, False, False]
    first, photo = assets[0], photos[0]
    assert first.storage_key == f"media/{photo.id}/upload.jpeg"  # nothing copied (D2)
    assert (first.content_sha256, first.size_bytes) == (photo.content_sha256, 2048)
    assert first.view_type_term_id == view_type is not None
    assert first.usage_restriction_term_id is None
    assert first.extra_metadata == {
        "import_batch_id": str(batch_id),
        "import_photo_id": str(photo.id),
        "relative_path": "lote/I 1234.jpg",
    }


def test_a_loan_for_use_inherits_the_publication_restriction(
    session: Session, reference: ReferenceData, act_as: ActAs
) -> None:
    batch_id = new_uuid()
    with act_as("CATALOGUER", origin=AuditOrigin.IMPORT, origin_ref=str(batch_id)):
        piece = create_piece(
            session, denomination="Manta sintética", tenure_regime=TenureRegime.LOAN_FOR_USE
        )
        photo = _photo("AJB 501.jpg", batch_id)
        asset = register_from_import(
            session,
            piece,
            photo,
            storage_key=f"{photo.storage_prefix}upload.jpeg",
            view_type_term_id=None,
        )
        session.commit()

    restriction = session.get(Term, asset.usage_restriction_term_id)
    assert restriction is not None and restriction.code == "NO_PUBLICAR"
    assert asset.restriction_note == LOAN_RESTRICTION_NOTE


def test_the_seeded_unspecified_view_is_used_as_it_is(
    session: Session, reference: ReferenceData
) -> None:
    (seeded,) = _unspecified_terms(session)

    assert unspecified_view_type_id(session) == seeded.id
    assert len(_unspecified_terms(session)) == 1


def test_a_missing_unspecified_view_is_created_once_by_the_system(
    session: Session, reference: ReferenceData
) -> None:
    _forget_unspecified_term(session)

    first = unspecified_view_type_id(session)
    second = unspecified_view_type_id(session)
    session.commit()

    (created,) = _unspecified_terms(session)
    assert first == second == created.id
    assert (created.label, created.deleted_at) == ("Sin especificar", None)
    entries = list(session.scalars(select(AuditLog).where(AuditLog.entity_id == created.id)))
    assert entries and {entry.origin for entry in entries} == {AuditOrigin.SYSTEM}
    # Its own change set: reverting a batch never takes the term with it.
    assert len({entry.change_set_id for entry in entries}) == 1


def test_a_deleted_unspecified_view_is_respected(
    session: Session, reference: ReferenceData
) -> None:
    (seeded,) = _unspecified_terms(session)
    session.execute(update(Term).where(Term.id == seeded.id).values(deleted_at=func.now()))
    session.commit()

    assert unspecified_view_type_id(session) is None
    assert len(_unspecified_terms(session)) == 1  # not created again
