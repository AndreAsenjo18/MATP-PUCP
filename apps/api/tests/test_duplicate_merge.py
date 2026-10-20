"""Spec calidad-datos — merge of two duplicate pieces (task 3.3, design D4).

Service-level tests with controlled pieces: what moves to the surviving piece, what stays on the
absorbed one (append-only history, codes I), the blocking rules and the single change set.
"""

import uuid
from collections.abc import Callable
from datetime import date

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ValidationFailed
from app.core.models_base import new_uuid, utcnow
from app.models import (
    AiSuggestion,
    AuditLog,
    Collection,
    DuplicateCandidate,
    LoanItem,
    MediaAsset,
    Piece,
    PieceIdentifier,
    PieceMaterial,
    PieceMovement,
    PieceSourceRecord,
    Term,
)
from app.modules.ai_suggestions.models import AiFunction, SuggestionStatus
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.service import create_collection
from app.modules.identification.normalization import TYPE_COLLECTION, TYPE_INC_RN
from app.modules.identification.service import add_identifier, set_inventory_code
from app.modules.locations.models import Loan, MovementType
from app.modules.quality.models import DuplicateStatus
from app.modules.quality.queue import CandidateClosed, resolve_candidate
from tests.conftest import ActAs

ALL = {INCLUDE_DELETED: True}


@pytest.fixture
def collection(session: Session, act_as: ActAs) -> Collection:
    with act_as("ADMIN"):
        created = create_collection(session, name="Colección RA (ficticia)", acronym="RA")
        session.commit()
    return created


@pytest.fixture
def make_piece(session: Session, act_as: ActAs, collection: Collection) -> Callable[..., Piece]:
    def make(denomination: str, **fields: object) -> Piece:
        values: dict[str, object] = {"collection_id": collection.id}
        tenure = fields.pop("tenure_regime", TenureRegime.OWNED)
        values.update(fields)
        with act_as("CATALOGUER"):
            piece = create_piece(session, denomination=denomination, tenure_regime=tenure, **values)
            session.commit()
        return piece

    return make


def _candidate(session: Session, a: Piece, b: Piece) -> DuplicateCandidate:
    first, second = sorted((a.id, b.id), key=str)
    candidate = DuplicateCandidate(
        id=new_uuid(),
        piece_a_id=first,
        piece_b_id=second,
        score=0.9,
        matched_fields=[],
        status=DuplicateStatus.PENDING,
    )
    session.add(candidate)
    session.flush()
    return candidate


def _photo(session: Session, piece: Piece, *, primary: bool, order: int = 0) -> MediaAsset:
    photo = MediaAsset(
        id=new_uuid(),
        piece_id=piece.id,
        storage_key=f"media/{uuid.uuid4()}.jpg",
        content_type="image/jpeg",
        size_bytes=1000,
        content_sha256=uuid.uuid4().hex * 2,
        sort_order=order,
        is_primary=primary,
    )
    session.add(photo)
    return photo


def _merge(
    session: Session,
    act_as: ActAs,
    users: dict,
    candidate: DuplicateCandidate,
    surviving: Piece,
    **extra: object,
) -> DuplicateCandidate:
    with act_as("COLLECTIONS_MANAGER"):
        resolved = resolve_candidate(
            session,
            candidate.id,
            resolution=DuplicateStatus.MERGED,
            reviewer_id=users["COLLECTIONS_MANAGER"].id,
            note=extra.pop("note", "Misma pieza registrada dos veces"),
            surviving_piece_id=surviving.id,
            **extra,  # type: ignore[arg-type]
        )
        session.commit()
    return resolved


def test_merge_with_chosen_provenance_moves_identifiers_and_photos(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    """Spec: «Fusión con elección de procedencia»."""
    a = make_piece("Retablo ayacuchano", provenance="Ayacucho", author="Taller Urbano")
    b = make_piece("Retablo ayacuchano (3 pisos)", provenance="Huamanga")
    with act_as("CATALOGUER"):
        add_identifier(session, a, TYPE_COLLECTION, "RA 12")
        add_identifier(session, b, TYPE_COLLECTION, "R.A. 012")  # same normalized value
        add_identifier(session, b, TYPE_INC_RN, "INC 1234")
        cover_a = _photo(session, a, primary=True)
        cover_b = _photo(session, b, primary=True)
        extra_b = _photo(session, b, primary=False, order=1)
        candidate = _candidate(session, a, b)
        session.commit()
    audit_before = session.scalar(select(func.count()).select_from(AuditLog))

    resolved = _merge(
        session, act_as, users, candidate, a, field_choices={"provenance": "ABSORBED"}
    )

    session.expire_all()
    a, b = session.get(Piece, a.id), session.get(Piece, b.id, execution_options=ALL)
    assert a.provenance == "Huamanga"  # chosen from B
    assert a.author == "Taller Urbano"  # the rest stays from A
    assert a.denomination == "Retablo ayacuchano"
    ids_a = session.scalars(select(PieceIdentifier).where(PieceIdentifier.piece_id == a.id)).all()
    by_value = {(i.identifier_type_code, i.original_value): i for i in ids_a}
    assert by_value[(TYPE_INC_RN, "INC 1234")].is_current
    repeated = by_value[(TYPE_COLLECTION, "R.A. 012")]
    assert not repeated.is_current  # repeated value kept as not current, never deleted
    assert "Fusión" in repeated.notes
    photos = {p.id: p for p in session.scalars(select(MediaAsset)).all()}
    assert {photos[p].piece_id for p in (cover_a.id, cover_b.id, extra_b.id)} == {a.id}
    assert photos[cover_a.id].is_primary and not photos[cover_b.id].is_primary

    assert b.merged_into_id == a.id
    assert b.deleted_at is not None
    assert b.deletion_reason.startswith(f"Fusionada en {a.id}")
    assert resolved.status == DuplicateStatus.MERGED
    assert resolved.change_set_id is not None
    # A single change set covers every audited write of the merge (spec: «único conjunto»).
    new_rows = session.scalars(select(AuditLog).order_by(AuditLog.occurred_at)).all()[audit_before:]
    assert new_rows and {row.change_set_id for row in new_rows} == {resolved.change_set_id}


def test_an_empty_field_is_completed_from_the_absorbed_piece(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    a = make_piece("Mate burilado")
    b = make_piece("Mate burilado", author="Taller Huanca", entry_date=date(1990, 5, 1))
    with act_as("CATALOGUER"):
        candidate = _candidate(session, a, b)
        session.commit()
    _merge(session, act_as, users, candidate, a)
    session.expire_all()
    a = session.get(Piece, a.id)
    assert (a.author, a.entry_date) == ("Taller Huanca", date(1990, 5, 1))


def test_history_stays_on_the_absorbed_piece_and_the_rest_moves(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    """Append-only movements, source records stay; components, materials, loans move (D4)."""
    a = make_piece("Retablo")
    b = make_piece("Retablo")
    child = make_piece("Puerta del retablo", parent_piece_id=b.id)
    terms = session.scalars(select(Term).limit(3)).all()
    with act_as("CATALOGUER"):
        session.add_all(
            [
                PieceMovement(
                    id=new_uuid(),
                    piece_id=b.id,
                    movement_type=MovementType.VERIFICATION,
                    occurred_at=utcnow(),
                ),
                PieceSourceRecord(
                    id=new_uuid(),
                    piece_id=b.id,
                    source_name="Sábana 2024",
                    recorded_at=utcnow(),
                    payload={"OBS.": "sintético"},
                ),
                PieceMaterial(id=new_uuid(), piece_id=a.id, term_id=terms[0].id),
                PieceMaterial(id=new_uuid(), piece_id=b.id, term_id=terms[0].id),  # repeated
                PieceMaterial(id=new_uuid(), piece_id=b.id, term_id=terms[1].id),
            ]
        )
        loan = Loan(
            id=new_uuid(),
            type_term_id=terms[0].id,
            status_term_id=terms[1].id,
            destination_label="Exposición sintética",
            starts_on=date(2026, 1, 1),
            ends_on=date(2026, 2, 1),
        )
        session.add(loan)
        session.flush()
        session.add(LoanItem(id=new_uuid(), loan_id=loan.id, piece_id=b.id))
        session.add(
            AiSuggestion(
                id=new_uuid(),
                piece_id=b.id,
                function_code=AiFunction.RIA_03_SUGGEST_TERMS,
                status=SuggestionStatus.PENDING,
                provider="mock",
                input_data={},
                output_data={},
            )
        )
        candidate = _candidate(session, a, b)
        session.commit()

    _merge(session, act_as, users, candidate, a)

    session.expire_all()
    assert session.scalars(select(PieceMovement.piece_id)).all() == [b.id]
    assert session.scalars(select(PieceSourceRecord.piece_id)).all() == [b.id]
    assert session.get(Piece, child.id).parent_piece_id == a.id
    materials = session.scalars(select(PieceMaterial).execution_options(**ALL)).all()
    assert sorted((m.piece_id == a.id, m.term_id == terms[0].id) for m in materials) == sorted(
        [(True, True), (False, True), (True, False)]
    )  # union without repeating: the repeated material stays on B
    assert session.scalars(select(LoanItem.piece_id)).all() == [a.id]
    assert session.scalars(select(AiSuggestion.piece_id)).all() == [a.id]


def test_different_tenure_regimes_block_the_merge(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    """Spec: «Regímenes distintos»."""
    a = make_piece("Retablo")
    b = make_piece(
        "Retablo", tenure_regime=TenureRegime.LOAN_FOR_USE, lender_name="Comodante ficticio"
    )
    with act_as("CATALOGUER"):
        candidate = _candidate(session, a, b)
        session.commit()
    with pytest.raises(ConflictError) as raised:
        _merge(session, act_as, users, candidate, a)
    assert raised.value.code == "merge_blocked_tenure"
    session.rollback()
    assert session.get(Piece, b.id).merged_into_id is None


def test_two_different_inventory_codes_block_the_merge(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    a, b = make_piece("Retablo"), make_piece("Retablo")
    with act_as("CATALOGUER"):
        set_inventory_code(session, a, "I-100")
        set_inventory_code(session, b, "I-200")
        candidate = _candidate(session, a, b)
        session.commit()
    with pytest.raises(ConflictError) as raised:
        _merge(session, act_as, users, candidate, a)
    assert raised.value.code == "merge_blocked_inventory_code"


def test_the_piece_with_the_only_inventory_code_must_survive(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    """Spec: «Código I solo en la pieza absorbida»; merged the other way round it works."""
    a, b = make_piece("Retablo"), make_piece("Retablo")
    with act_as("CATALOGUER"):
        set_inventory_code(session, b, "I-300")
        candidate = _candidate(session, a, b)
        session.commit()
    with pytest.raises(ConflictError) as raised:
        _merge(session, act_as, users, candidate, a)
    assert raised.value.code == "merge_surviving_must_hold_inventory_code"
    session.rollback()

    _merge(session, act_as, users, candidate, b)
    session.expire_all()
    code = session.scalars(
        select(PieceIdentifier).where(PieceIdentifier.normalized_value == "I-300")
    ).one()
    assert code.piece_id == b.id  # a code I never changes piece (RN-002)


def test_other_pairs_of_the_absorbed_piece_are_superseded(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    a, b, c, d = (make_piece("Retablo") for _ in range(4))
    with act_as("CATALOGUER"):
        merged = _candidate(session, a, b)
        of_absorbed = _candidate(session, b, c)
        of_surviving = _candidate(session, a, d)
        session.commit()
    _merge(session, act_as, users, merged, a)
    session.expire_all()
    assert session.get(DuplicateCandidate, of_absorbed.id).status == DuplicateStatus.SUPERSEDED
    assert session.get(DuplicateCandidate, of_surviving.id).status == DuplicateStatus.PENDING
    with act_as("COLLECTIONS_MANAGER"), pytest.raises(CandidateClosed):
        resolve_candidate(  # already superseded by the merge: closed
            session,
            of_absorbed.id,
            resolution=DuplicateStatus.DISTINCT,
            reviewer_id=users["COLLECTIONS_MANAGER"].id,
        )


@pytest.mark.parametrize(
    ("extra", "code"),
    [
        ({"note": ""}, "merge_reason_required"),
        ({"field_choices": {"tenure_regime": "ABSORBED"}}, "unknown_merge_fields"),
    ],
)
def test_invalid_merge_requests_are_rejected(
    session: Session,
    act_as: ActAs,
    users: dict,
    make_piece: Callable[..., Piece],
    extra: dict,
    code: str,
) -> None:
    a, b = make_piece("Retablo"), make_piece("Retablo")
    with act_as("CATALOGUER"):
        candidate = _candidate(session, a, b)
        session.commit()
    with pytest.raises(ValidationFailed) as raised:
        _merge(session, act_as, users, candidate, a, **extra)
    assert raised.value.code == code


def test_the_surviving_piece_must_belong_to_the_pair(
    session: Session, act_as: ActAs, users: dict, make_piece: Callable[..., Piece]
) -> None:
    a, b, other = make_piece("Retablo"), make_piece("Retablo"), make_piece("Caja")
    with act_as("CATALOGUER"):
        candidate = _candidate(session, a, b)
        session.commit()
    with pytest.raises(ValidationFailed) as raised:
        _merge(session, act_as, users, candidate, other)
    assert raised.value.code == "surviving_not_in_pair"
