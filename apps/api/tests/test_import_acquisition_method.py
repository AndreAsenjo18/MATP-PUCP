"""Spec importacion-datos — Régimen deducido de la forma de adquisición (RF-005, RF-021).

Change ajustes-lectura-importacion, tasks 1.1 and 1.3 (design D2). Task 1.1: a column mapped
to ``terms:ACQUISITION_METHOD`` fills ``Piece.acquisition_method_term_id`` when the batch is
applied, and an update row shows the change in its diff. Task 1.3: the row's regime is the
explicit one, else the one its acquisition method stands for, else the batch default. Synthetic
data only (RNF-014).
"""

import json
from types import SimpleNamespace
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Term
from app.modules.identification.models import TENURE_ALIASES_KEY, NormalizationSetting
from app.modules.identification.normalization import DEFAULT_TENURE_ALIASES
from app.modules.imports.apply import _acquisition_term_id, _create
from app.modules.imports.classify import validate_row
from app.modules.imports.mapping import (
    MappedRow,
    MappingContext,
    MappingSpec,
    apply_mapping,
    read_mapping,
)
from app.modules.imports.service import _acquisition_codes, field_diff
from app.seed.reference import ReferenceData
from tests.conftest import ActAs

SPEC: dict[str, Any] = {
    "version": 1,
    "columns": [
        {"source": "DENOMINACIÓN", "target": {"kind": "field", "name": "denomination"}},
        {"source": "FORMA", "target": {"kind": "terms", "vocabulary": "ACQUISITION_METHOD"}},
    ],
    "defaults": {"tenure_regime": "OWNED"},
}
BATCH = SimpleNamespace(file_name="sabana_sintetica.xlsx")


def _term_code(session: Session, term_id: object) -> str | None:
    return session.scalar(select(Term.code).where(Term.id == term_id))


def test_the_matched_method_is_stored_with_the_row(
    session: Session, reference: ReferenceData
) -> None:
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "donacion"}, read_mapping(SPEC), MappingContext(session)
    )

    stored = MappedRow.from_json(json.loads(json.dumps(row.as_json())))

    assert row.acquisition_method == "DONACION"
    assert stored.acquisition_method == "DONACION"


def test_a_new_piece_gets_its_acquisition_method(
    session: Session, reference: ReferenceData, act_as: ActAs
) -> None:
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "Compra"}, read_mapping(SPEC), MappingContext(session)
    )

    with act_as("CATALOGUER"):
        piece = _create(session, BATCH, row)  # type: ignore[arg-type]

    assert _term_code(session, piece.acquisition_method_term_id) == "COMPRA"


def test_a_method_without_term_leaves_the_field_empty(
    session: Session, reference: ReferenceData, act_as: ActAs
) -> None:
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "Permuta"}, read_mapping(SPEC), MappingContext(session)
    )

    with act_as("CATALOGUER"):
        piece = _create(session, BATCH, row)  # type: ignore[arg-type]

    assert row.acquisition_method is None
    assert piece.acquisition_method_term_id is None
    assert row.source_payload["FORMA"] == "Permuta"


def test_an_update_row_shows_the_new_method_in_its_diff(
    session: Session, reference: ReferenceData, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(
            session,
            denomination="Mate",
            tenure_regime=TenureRegime.OWNED,
            acquisition_method_term_id=_acquisition_term_id(session, "COMPRA"),
        )
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "Donación"}, read_mapping(SPEC), MappingContext(session)
    )

    diff = field_diff(piece, row, MappingSpec.from_json(SPEC), [], _acquisition_codes(session))

    assert diff["acquisition_method"] == {
        "current": "COMPRA",
        "incoming": "DONACION",
        "default_action": "accept",
    }


# --- task 1.3: the regime deduced from the acquisition method (design D2) -------------------

WITH_REGIME: dict[str, Any] = {
    "version": 1,
    "columns": [
        {"source": "DENOMINACIÓN", "target": {"kind": "field", "name": "denomination"}},
        {"source": "CÓDIGO I", "target": {"kind": "identifier", "type": "I"}},
        {"source": "RÉGIMEN", "target": {"kind": "field", "name": "tenure_regime"}},
        {"source": "FORMA", "target": {"kind": "terms", "vocabulary": "ACQUISITION_METHOD"}},
    ],
}


def test_cesion_de_uso_is_imported_as_loan_for_use(
    session: Session, reference: ReferenceData
) -> None:
    """Escenario «Cesión de uso se importa como comodato»: the comodato rules apply."""
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "CÓDIGO I": "I-0236", "FORMA": "Cesión de uso"},
        read_mapping(WITH_REGIME),
        MappingContext(session),
    )

    assert row.tenure_regime is TenureRegime.LOAN_FOR_USE
    errors = classify_errors(row)
    assert "loan_for_use_with_inventory_code" in errors


def test_donacion_is_imported_as_owned(session: Session, reference: ReferenceData) -> None:
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "donacion"},
        read_mapping(WITH_REGIME),
        MappingContext(session),
    )

    assert row.tenure_regime is TenureRegime.OWNED
    assert row.acquisition_method == "DONACION"
    assert classify_errors(row) == []


def test_an_explicit_regime_wins_with_a_warning(session: Session, reference: ReferenceData) -> None:
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "RÉGIMEN": "Propiedad", "FORMA": "Custodia"},
        read_mapping(WITH_REGIME),
        MappingContext(session),
    )

    assert row.tenure_regime is TenureRegime.OWNED
    assert [warning.code for warning in row.warnings] == ["acquisition_regime_mismatch"]
    assert "indica Comodato" in row.warnings[0].message
    assert MappedRow.from_json(row.as_json()).warnings == row.warnings  # stored with the row
    assert classify_errors(row) == []


def test_a_method_without_correspondence_and_no_default_is_an_error(
    session: Session, reference: ReferenceData
) -> None:
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "Permuta"},
        read_mapping(WITH_REGIME),
        MappingContext(session),
    )

    assert row.tenure_regime is None
    assert classify_errors(row) == ["acquisition_without_regime"]
    assert "«Permuta»" in row.errors[0].message


def test_a_correspondence_added_by_the_administrator_is_used(
    session: Session, reference: ReferenceData, act_as: ActAs
) -> None:
    with act_as("ADMIN"):
        session.add(
            NormalizationSetting(
                key=TENURE_ALIASES_KEY, value={**DEFAULT_TENURE_ALIASES, "permuta": "LOAN_FOR_USE"}
            )
        )
        session.flush()

    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "Permuta"},
        read_mapping(WITH_REGIME),
        MappingContext(session),
    )

    assert row.tenure_regime is TenureRegime.LOAN_FOR_USE


def test_the_default_of_the_batch_applies_when_nothing_else_does(
    session: Session, reference: ReferenceData
) -> None:
    spec = {**WITH_REGIME, "defaults": {"tenure_regime": "TEMPORARY_LOAN"}}
    row = apply_mapping(
        {"DENOMINACIÓN": "Mate", "FORMA": "Permuta"}, read_mapping(spec), MappingContext(session)
    )

    assert row.tenure_regime is TenureRegime.TEMPORARY_LOAN
    assert "tenure_regime" in row.defaulted


def classify_errors(row: MappedRow) -> list[str]:
    return [error.code for error in validate_row(row.row_input(2))]
