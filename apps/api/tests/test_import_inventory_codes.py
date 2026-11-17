"""A row with its code I written twice, or with two different ones (revision with the museum's
real spreadsheets, 2026-11-17; RN-002, RN-005).

The «BD estandarizada 2025» files bring the code I in two columns, one zero-padded
(``I-03602``) and one not (``I-3602``). Validation passed them and the application failed on the
second spelling, undoing the whole batch. Synthetic data only (RNF-014).
"""

from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.audit.context import audit_context
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.models import Piece
from app.modules.identification.models import PieceIdentifier
from app.modules.imports.apply import REPEATED_CODE_NOTE, _add_identifiers
from app.modules.imports.mapping import MappingContext, MappingSpecV1, apply_mapping
from app.seed.reference import ReferenceData
from tests.conftest import SYSTEM_CONTEXT


def _spec() -> MappingSpecV1:
    columns: list[dict[str, Any]] = [
        {"source": "DENOMINACIÓN", "target": {"kind": "field", "name": "denomination"}},
        {"source": "N° INVENTARIO", "target": {"kind": "identifiers", "default_type": "I"}},
        {"source": "OTRO N° INVENTARIO", "target": {"kind": "identifiers", "default_type": "I"}},
    ]
    return MappingSpecV1.model_validate({"version": 1, "columns": columns, "defaults": {}})


@pytest.fixture
def ctx(session: Session, reference: ReferenceData) -> MappingContext:
    return MappingContext(session)


def _row(first: str, second: str) -> dict[str, str]:
    return {
        "DENOMINACIÓN": "Mate burilado (sintético)",
        "N° INVENTARIO": first,
        "OTRO N° INVENTARIO": second,
    }


def test_the_same_code_written_twice_is_not_an_error(ctx: MappingContext) -> None:
    mapped = apply_mapping(_row("I-03602", "I-3602"), _spec(), ctx)
    assert [e.code for e in mapped.errors] == []


def test_two_different_codes_are_an_error_of_the_row(ctx: MappingContext) -> None:
    mapped = apply_mapping(_row("I-03602", "I-9999"), _spec(), ctx)
    [error] = [e for e in mapped.errors if e.code == "several_inventory_codes"]
    assert "«I-03602»" in error.message and "«I-9999»" in error.message
    assert "uno solo" in error.message


def test_applying_keeps_the_second_spelling_as_historical(
    session: Session, reference: ReferenceData
) -> None:
    with audit_context(session, SYSTEM_CONTEXT):
        piece = Piece(
            id=new_uuid(),
            denomination="Mate burilado (sintético)",
            tenure_regime=TenureRegime.OWNED,
        )
        session.add(piece)
        session.flush()
        # Before, the second one raised «La pieza ya tiene Código I» and undid the batch.
        _add_identifiers(session, piece, [("I", "I-03602"), ("I", "I-3602")], "Importación")
        session.commit()
    rows = session.scalars(
        select(PieceIdentifier).where(PieceIdentifier.piece_id == piece.id)
    ).all()
    current = [r for r in rows if r.is_current]
    historical = [r for r in rows if not r.is_current]
    assert [r.original_value for r in current] == ["I-03602"]
    assert [r.original_value for r in historical] == ["I-3602"]
    assert historical[0].notes == REPEATED_CODE_NOTE
