"""Spec importacion-datos — Régimen deducido de la forma de adquisición (RF-005, RF-021).

Change ajustes-lectura-importacion, task 1.1: a column mapped to ``terms:ACQUISITION_METHOD``
fills ``Piece.acquisition_method_term_id`` when the batch is applied, and an update row shows
the change in its diff. Synthetic data only (RNF-014).
"""

import json
from types import SimpleNamespace
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece
from app.modules.collections.models import Term
from app.modules.imports.apply import _acquisition_term_id, _create
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
