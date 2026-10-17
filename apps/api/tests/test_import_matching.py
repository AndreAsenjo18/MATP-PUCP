"""Spec importacion-datos — Matching multi-código (RF-024, RF-023).

Change importacion-pipeline-reconciliacion, task 3.2. Synthetic data only (RNF-014).
"""

import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.catalog.service import create_piece
from app.modules.identification.models import NormalizationStatus
from app.modules.identification.normalization import TYPE_COLLECTION, TYPE_INC_RN, TYPE_INVENTORY
from app.modules.identification.service import (
    add_identifier,
    current_identifiers,
    retire_identifier,
)
from app.modules.imports.matching import RowIdentifier, find_matches
from tests.conftest import ActAs


def _piece(session: Session, name: str, **codes: str) -> Piece:
    piece = create_piece(session, denomination=name, tenure_regime=TenureRegime.OWNED)
    for type_code, value in codes.items():
        add_identifier(session, piece, type_code, value)
    return piece


@pytest.fixture
def catalog(session: Session, act_as: ActAs) -> dict[str, Piece]:
    with act_as("COLLECTIONS_MANAGER"):
        pieces = {
            "toro": _piece(session, "Toro de Pucará", **{TYPE_COLLECTION: "MMZ 15"}),
            "retablo": _piece(session, "Retablo", **{TYPE_INVENTORY: "I-2362"}),
            "charango": _piece(session, "Charango", **{TYPE_INC_RN: "004521"}),
        }
        old_inc = pieces["charango"].identifiers[0]
        add_identifier(session, pieces["charango"], TYPE_INC_RN, "123456", replaces=old_inc)
        session.commit()
    return pieces


def _row(*codes: tuple[str, str]) -> list[RowIdentifier]:
    return [RowIdentifier.from_raw(type_code, raw) for type_code, raw in codes]


def test_collection_code_with_another_format(session: Session, catalog: dict[str, Piece]) -> None:
    result = find_matches(session, {2: _row((TYPE_COLLECTION, "M.M.Z. 015"))})[2]

    assert result.piece_ids == [catalog["toro"].id]
    [match] = result.matches
    assert (match.identifier_type, match.value, match.via) == (TYPE_COLLECTION, "MMZ 15", "current")
    assert not result.has_contradiction


def test_historical_identifier(session: Session, catalog: dict[str, Piece]) -> None:
    result = find_matches(session, {2: _row((TYPE_INC_RN, "RN 004521"))})[2]

    assert result.piece_ids == [catalog["charango"].id]
    assert result.matches[0].via == "historical"


def test_codes_pointing_to_different_pieces(session: Session, catalog: dict[str, Piece]) -> None:
    row = _row((TYPE_INVENTORY, "I 2362"), (TYPE_COLLECTION, "mmz 15"))

    result = find_matches(session, {7: row})[7]

    assert result.piece_ids == [catalog["retablo"].id, catalog["toro"].id]
    assert result.has_contradiction
    stored = result.as_json()
    assert stored[0]["contradicts"] == [str(catalog["toro"].id)]
    assert stored[0]["identifiers"] == [
        {"identifier_type": TYPE_INVENTORY, "value": "I-2362", "via": "current"}
    ]


def test_inventory_codes_of_candidates_are_reported(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = find_matches(
        session, {1: _row((TYPE_INVENTORY, "I-0236"), (TYPE_COLLECTION, "MMZ 15"))}
    )[1]

    assert result.inventory_codes == {catalog["toro"].id: set()}
    result = find_matches(session, {1: _row((TYPE_INVENTORY, "2362"))})[1]
    assert result.inventory_codes == {catalog["retablo"].id: {"I-2362"}}


def test_same_value_of_another_type_does_not_match(
    session: Session, catalog: dict[str, Piece]
) -> None:
    result = find_matches(session, {1: [RowIdentifier("PUCP", "MMZ 15", "MMZ 15")]})[1]

    assert result.matches == []


def test_no_candidates_absent_and_unparseable_values(
    session: Session, catalog: dict[str, Piece]
) -> None:
    rows = {
        1: _row((TYPE_INVENTORY, "I-9999")),
        2: _row((TYPE_INVENTORY, "S/N")),
        3: _row((TYPE_INVENTORY, "???")),
        4: [],
    }

    result = find_matches(session, rows)

    assert all(matches.matches == [] for matches in result.values())
    assert rows[3][0].status == NormalizationStatus.UNPARSEABLE


def test_deleted_pieces_and_retired_identifiers_are_ignored(
    session: Session, act_as: ActAs, catalog: dict[str, Piece]
) -> None:
    with act_as("ADMIN"):
        soft_delete(session, catalog["toro"], "Registro duplicado de prueba")
        charango = catalog["charango"]
        [current_inc] = current_identifiers(session, charango, TYPE_INC_RN)
        retire_identifier(session, charango, current_inc, "Mal transcrito")
        session.commit()

    rows = {1: _row((TYPE_COLLECTION, "MMZ 15")), 2: _row((TYPE_INC_RN, "123456"))}

    result = find_matches(session, rows)

    assert result[1].matches == [] and result[2].matches == []


def test_whole_batch_uses_a_constant_number_of_queries(
    session: Session, catalog: dict[str, Piece]
) -> None:
    statements: list[str] = []
    engine = session.get_bind()
    listener = lambda *args: statements.append(args[2])  # noqa: E731
    event.listen(engine, "before_cursor_execute", listener)
    try:
        rows = {
            n: _row((TYPE_INVENTORY, f"I-{n}"), (TYPE_COLLECTION, "MMZ 15")) for n in range(300)
        }
        find_matches(session, rows)
    finally:
        event.remove(engine, "before_cursor_execute", listener)

    assert len(statements) == 2
