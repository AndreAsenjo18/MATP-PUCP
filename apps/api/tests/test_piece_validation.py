"""Validación de la ficha en una sola fuente (change ficha-pieza-crud, tarea 1.3).

Una prueba por regla de `validate_piece_payload()` (design D1) y una por el efecto de cada
incidencia bloqueante en el guardado, que conserva los códigos de error y los estados HTTP que
la API ya devolvía.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleViolation, ValidationFailed
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import (
    create_piece,
    set_parent,
    update_piece,
    validate_piece_payload,
)
from app.modules.identification.models import PieceIdentifier
from app.modules.identification.service import add_identifier, set_inventory_code
from tests.conftest import ActAs


def _piece(session: Session, regime: TenureRegime = TenureRegime.OWNED, **fields: object) -> Piece:
    denomination = str(fields.pop("denomination", "Pieza sintética"))
    return create_piece(session, denomination=denomination, tenure_regime=regime, **fields)


def _identifiers(session: Session, piece: Piece) -> list[PieceIdentifier]:
    return list(
        session.scalars(select(PieceIdentifier).where(PieceIdentifier.piece_id == piece.id))
    )


# --- Reglas de la ficha ----------------------------------------------------------------------
def test_a_valid_sheet_has_no_issues_and_writes_nothing(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        issues = validate_piece_payload(
            session, denomination="Retablo sintético", tenure_regime=TenureRegime.OWNED
        )
        assert issues == []
        assert list(session.scalars(select(Piece))) == []


def test_denomination_is_reported_as_an_error(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        issues = validate_piece_payload(
            session, denomination="   ", tenure_regime=TenureRegime.OWNED
        )
    assert [(issue.field, issue.code, issue.severity) for issue in issues] == [
        ("denomination", "denomination_required", "error")
    ]


def test_incoherent_period_is_reported_as_an_error(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        issues = validate_piece_payload(
            session,
            denomination="Pieza sintética",
            tenure_regime=TenureRegime.OWNED,
            epoch_start_year=1960,
            epoch_end_year=1950,
        )
    assert [(issue.field, issue.code, issue.severity) for issue in issues] == [
        ("period.text", "invalid_period_range", "error")
    ]


def test_invalid_dimension_is_reported_as_an_error(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        issues = validate_piece_payload(
            session,
            denomination="Pieza sintética",
            tenure_regime=TenureRegime.OWNED,
            dimensions=[{"value": -1, "unit": "cm"}],
        )
    assert [(issue.field, issue.code, issue.severity) for issue in issues] == [
        ("dimensions_text", "invalid_dimension", "error")
    ]


def test_duplicate_inventory_code_is_an_error_naming_the_piece(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        owner = _piece(session, denomination="Dueña del código")
        add_identifier(session, owner, "I", "I-236")
        session.commit()
        issues = validate_piece_payload(
            session,
            denomination="Otra pieza",
            tenure_regime=TenureRegime.OWNED,
            code_i="I 236",
        )
    duplicates = [issue for issue in issues if issue.code == "duplicate_inventory_code"]
    assert len(duplicates) == 1
    assert duplicates[0].field == "code_i"
    assert duplicates[0].severity == "error"
    assert str(owner.id) in duplicates[0].message


def test_inventory_code_of_a_deleted_piece_is_only_a_warning(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        owner = _piece(session, denomination="Pieza dada de baja")
        add_identifier(session, owner, "I", "I-236")
        session.commit()
        soft_delete(session, owner, "Registrada por error")
        session.commit()
        issues = validate_piece_payload(
            session,
            denomination="Otra pieza",
            tenure_regime=TenureRegime.OWNED,
            code_i="I-236",
        )
    warnings = [issue for issue in issues if issue.code == "inventory_code_of_deleted_piece"]
    assert len(warnings) == 1
    assert warnings[0].field == "code_i"
    assert warnings[0].severity == "warning"


@pytest.mark.parametrize("marker", ["S/N", "s/c", "-", "0"])
def test_absence_marker_is_only_a_warning_and_the_piece_is_saved_without_code(
    session: Session, act_as: ActAs, marker: str
) -> None:
    """A5: el marcador de ausencia no se registra como código I y la pieza se guarda sin él."""
    with act_as("CATALOGUER"):
        issues = validate_piece_payload(
            session,
            denomination="Pieza sin código",
            tenure_regime=TenureRegime.OWNED,
            code_i=marker,
        )
        piece = _piece(session, denomination="Pieza sin código")
        assert set_inventory_code(session, piece, marker) is None
        session.commit()
    markers = [issue for issue in issues if issue.code == "absence_marker"]
    assert len(markers) == 1
    assert markers[0].field == "code_i"
    assert markers[0].severity == "warning"
    assert _identifiers(session, piece) == []


def test_unrecognized_inventory_format_is_reported_as_an_error(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        issues = validate_piece_payload(
            session,
            denomination="Pieza sintética",
            tenure_regime=TenureRegime.OWNED,
            code_i="??-15",
        )
    assert [(issue.field, issue.code, issue.severity) for issue in issues] == [
        ("code_i", "unrecognized_format", "error")
    ]


def test_parent_cycle_is_reported_as_an_error(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        parent = _piece(session, denomination="Conjunto")
        child = _piece(session, denomination="Componente")
        set_parent(session, parent, child.id)
        session.commit()
        issues = validate_piece_payload(
            session,
            denomination="Componente",
            tenure_regime=TenureRegime.OWNED,
            parent_piece_id=parent.id,
            piece=child,
        )
    cycles = [issue for issue in issues if issue.code == "parent_cycle"]
    assert len(cycles) == 1
    assert cycles[0].field == "parent_piece_id"
    assert cycles[0].severity == "error"


def test_the_own_inventory_code_is_not_a_duplicate(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = _piece(session, denomination="Pieza con código")
        add_identifier(session, piece, "I", "I-236")
        session.commit()
        issues = validate_piece_payload(
            session,
            denomination=piece.denomination,
            tenure_regime=piece.tenure_regime,
            code_i="I-236",
            piece=piece,
        )
    assert issues == []


# --- El guardado conserva los códigos de error de la API ------------------------------------
def test_saving_keeps_the_api_error_codes(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        owner = _piece(session, denomination="Dueña del código")
        add_identifier(session, owner, "I", "I-236")
        session.commit()
        with pytest.raises(BusinessRuleViolation) as excinfo:
            create_piece(
                session,
                denomination="Otra pieza",
                tenure_regime=TenureRegime.OWNED,
                code_i="I-236",
            )
        assert excinfo.value.code == "duplicate_identifier"
        assert excinfo.value.details["piece_id"] == str(owner.id)
        with pytest.raises(ValidationFailed) as excinfo:
            create_piece(session, denomination="   ", tenure_regime=TenureRegime.OWNED)
        assert excinfo.value.code == "title_required"
        with pytest.raises(ValidationFailed) as excinfo:
            create_piece(
                session,
                denomination="Otra pieza",
                tenure_regime=TenureRegime.OWNED,
                dimensions=[{"value": "mucho"}],
            )
        assert excinfo.value.code == "invalid_dimension"
    session.rollback()


def test_saving_a_hierarchy_cycle_keeps_the_conflict_code(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        parent = _piece(session, denomination="Conjunto")
        child = _piece(session, denomination="Componente")
        set_parent(session, parent, child.id)
        session.commit()
        with pytest.raises(BusinessRuleViolation) as excinfo:
            update_piece(session, child, parent_piece_id=parent.id)
        assert excinfo.value.code == "piece_hierarchy_cycle"
    session.rollback()


def test_edition_validates_the_inventory_code_of_the_sheet(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        owner = _piece(session, denomination="Dueña del código")
        add_identifier(session, owner, "I", "I-236")
        session.commit()
        piece = _piece(session, denomination="Otra pieza")
        session.commit()
        with pytest.raises(BusinessRuleViolation) as excinfo:
            update_piece(session, piece, code_i="I-236")
        assert excinfo.value.code == "duplicate_identifier"
    session.rollback()
