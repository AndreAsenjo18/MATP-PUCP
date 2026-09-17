"""Specs catalogo-piezas, colecciones-vocabularios, ubicacion-movimientos, ia-asistiva (modelo).

RF-005..010, RF-016, RF-017, RF-019, RN-006, RN-009.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ValidationFailed
from app.core.models_base import new_uuid
from app.models import AiSuggestion, AppUser, Piece, PieceMovement
from app.modules.ai_suggestions.models import AiFunction, SuggestionStatus
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, PeriodType, TenureRegime
from app.modules.catalog.service import create_piece, set_parent, update_piece
from app.modules.collections.service import create_collection, move_collection
from app.modules.locations.models import LocationLevel, MovementType
from app.modules.locations.service import (
    create_location,
    is_without_location,
    location_path,
    move_piece,
    verify_location,
)
from tests.conftest import ActAs


# --- Ficha y régimen de tenencia --------------------------------------------------------------
@pytest.mark.parametrize("title", [None, "", "   "])
def test_title_is_mandatory(session: Session, act_as: ActAs, title: str | None) -> None:
    with act_as("CATALOGUER"), pytest.raises(ValidationFailed) as excinfo:
        create_piece(session, title=title, tenure_regime=TenureRegime.OWNED)
    assert excinfo.value.code == "title_required"


def test_tenure_regime_is_mandatory(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"), pytest.raises(ValidationFailed) as excinfo:
        create_piece(session, title="Pieza", tenure_regime=None)
    assert excinfo.value.code == "tenure_required"


def test_partial_sheet_is_saved(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, title="Solo denominación", tenure_regime=TenureRegime.OWNED)
        session.commit()
    assert piece.description is None and piece.collection_id is None


def test_owned_piece_legal_owner_is_always_pucp(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, title="Propia", tenure_regime=TenureRegime.OWNED)
        with pytest.raises(BusinessRuleViolation) as excinfo:
            create_piece(
                session,
                title="Otra",
                tenure_regime=TenureRegime.OWNED,
                legal_owner="Coleccionista sintético",
            )
    assert piece.legal_owner == LEGAL_OWNER_PUCP
    assert excinfo.value.code == "invalid_legal_owner"


def test_loan_for_use_keeps_lender_and_agreement(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(
            session,
            title="Imagen en comodato",
            tenure_regime=TenureRegime.LOAN_FOR_USE,
            lender_name="Comodante sintético",
            loan_agreement_ref="ACUERDO-SINT-01",
        )
    assert piece.legal_owner is None
    assert piece.loan_agreement_ref == "ACUERDO-SINT-01"


@pytest.mark.parametrize(
    ("text", "period_type", "start", "end"),
    [
        ("s. XX", PeriodType.CENTURY, 1901, 2000),
        ("ca. 1950", PeriodType.APPROXIMATE, 1945, 1955),
        ("3000 años", PeriodType.RELATIVE_AGE, None, None),
    ],
)
def test_period_text_and_interpretation(
    session: Session,
    act_as: ActAs,
    text: str,
    period_type: PeriodType,
    start: int | None,
    end: int | None,
) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(
            session,
            title="Pieza",
            tenure_regime=TenureRegime.OWNED,
            period_text=text,
            period_type=period_type,
            period_from=start,
            period_to=end,
        )
    assert (piece.period_text, piece.period_from, piece.period_to) == (text, start, end)


def test_incoherent_period_is_rejected_and_text_kept(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(
            session, title="Pieza", tenure_regime=TenureRegime.OWNED, period_text="1960-1950"
        )
        with pytest.raises(ValidationFailed) as excinfo:
            update_piece(
                session, piece, period_type=PeriodType.RANGE, period_from=1960, period_to=1950
            )
    assert excinfo.value.code == "invalid_period_range"
    assert piece.period_text == "1960-1950" and piece.period_from is None


def test_database_check_constraint_on_period(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        session.add(
            Piece(
                id=new_uuid(),
                title="Directa",
                tenure_regime=TenureRegime.OWNED,
                period_from=2000,
                period_to=1900,
            )
        )
        with pytest.raises(IntegrityError):
            session.flush()
    session.rollback()


@pytest.mark.parametrize("value", [-1, "23", None, True])
def test_invalid_structured_dimension(session: Session, act_as: ActAs, value: object) -> None:
    with act_as("CATALOGUER"), pytest.raises(ValidationFailed) as excinfo:
        create_piece(
            session,
            title="Pieza",
            tenure_regime=TenureRegime.OWNED,
            dimensions_text="alto 23 cm",
            dimensions=[{"dimension": "alto", "value": value, "unit": "cm"}],
        )
    assert excinfo.value.code == "invalid_dimension"


def test_sets_reject_cycles(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        parent = create_piece(session, title="Conjunto", tenure_regime=TenureRegime.OWNED)
        child = create_piece(
            session, title="Componente", tenure_regime=TenureRegime.OWNED, parent_piece_id=parent.id
        )
        grandchild = create_piece(
            session,
            title="Subcomponente",
            tenure_regime=TenureRegime.OWNED,
            parent_piece_id=child.id,
        )
        with pytest.raises(BusinessRuleViolation) as excinfo:
            set_parent(session, parent, grandchild.id)
    assert excinfo.value.code == "piece_hierarchy_cycle"


# --- Colecciones --------------------------------------------------------------------------------
def test_duplicate_normalized_acronym_is_rejected(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        existing = create_collection(session, name="Colección ficticia", acronym="MMZ")
        with pytest.raises(ValidationFailed) as excinfo:
            create_collection(session, name="Otra", acronym="M.M.Z.")
    assert excinfo.value.details["collection_id"] == str(existing.id)


def test_collection_hierarchy_rejects_cycles(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        parent = create_collection(session, name="RA", acronym="RA")
        child = create_collection(session, name="RAB", acronym="RAB", parent_id=parent.id)
        with pytest.raises(BusinessRuleViolation):
            move_collection(session, parent, child.id)


# --- Ubicación y movimientos --------------------------------------------------------------------
def test_location_hierarchy_and_movements(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"):
        site = create_location(session, level=LocationLevel.SITE, code="sc", name="Sede")
        space = create_location(
            session, level=LocationLevel.SPACE, code="SC-D2", name="Depósito 2", parent=site
        )
        rack = create_location(
            session, level=LocationLevel.FURNITURE, code="SC-D2-RB", name="Rack B", parent=space
        )
        level = create_location(
            session,
            level=LocationLevel.SHELF_LEVEL,
            code="SC-D2-RB-N3",
            name="Nivel 3",
            parent=rack,
        )
        box = create_location(
            session,
            level=LocationLevel.CONTAINER,
            code="SC-D2-RB-N3-C12",
            name="Caja 12",
            parent=level,
        )
        with pytest.raises(ValidationFailed):
            create_location(session, level=LocationLevel.SPACE, code="X", name="Sin sede")
        with pytest.raises(ValidationFailed):
            create_location(
                session, level=LocationLevel.CONTAINER, code="Y", name="Caja en sede", parent=site
            )
    with act_as("CATALOGUER"):
        piece = create_piece(session, title="Pieza", tenure_regime=TenureRegime.OWNED)
        assert is_without_location(piece)
        with pytest.raises(ValidationFailed):
            move_piece(session, piece, site, "Solo sede")
        with pytest.raises(BusinessRuleViolation):
            verify_location(session, piece)
        move_piece(session, piece, box, "Ingreso a depósito")
        move_piece(session, piece, space, "Reubicación")
        verify_location(session, piece)
        session.commit()
    assert site.code == "SC"
    assert [loc.name for loc in location_path(session, box)] == [
        "Sede",
        "Depósito 2",
        "Rack B",
        "Nivel 3",
        "Caja 12",
    ]
    assert not is_without_location(piece)
    movements = session.scalars(
        select(PieceMovement)
        .where(PieceMovement.piece_id == piece.id)
        .order_by(PieceMovement.occurred_at)
    ).all()
    assert [m.movement_type for m in movements] == [
        MovementType.MOVE,
        MovementType.MOVE,
        MovementType.VERIFICATION,
    ]
    assert movements[1].from_location_id == box.id and movements[1].to_location_id == space.id
    assert all(m.performed_by_user_id == users["CATALOGUER"].id for m in movements)


# --- RN-009 en la base de datos ------------------------------------------------------------------
def test_ai_suggestion_cannot_be_approved_without_reviewer(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        session.add(
            AiSuggestion(
                id=new_uuid(),
                function_code=AiFunction.RIA_03_SUGGEST_TERMS,
                provider="mock",
                input_data={"title": "x"},
                output_data={"category": "RETABLO"},
                approved_data={"category": "RETABLO"},
                status=SuggestionStatus.APPROVED,
            )
        )
        with pytest.raises(IntegrityError):
            session.flush()
    session.rollback()


def test_ai_suggestion_rejection_requires_reason(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        session.add(
            AiSuggestion(
                id=new_uuid(),
                function_code=AiFunction.RIA_01_EXTRACT_STRUCTURED,
                provider="mock",
                input_data={},
                output_data={},
                status=SuggestionStatus.REJECTED,
                reviewed_by_id=users["COLLECTIONS_MANAGER"].id,
                reviewed_at=datetime.now(UTC),
            )
        )
        with pytest.raises(IntegrityError):
            session.flush()
    session.rollback()
