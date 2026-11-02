"""The Spanish texts of the search filters keep their accents (busqueda-reportes; RF-032, RNF-010).

The active filters reach the screen as chips and the «Filtros» sheet of the exports; the permission
messages reach the user as they are. Synthetic values only (RNF-014).
"""

import uuid

import pytest

from app.core.errors import PermissionDenied
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.queries import Viewer
from app.modules.search.filters import PieceFilter

SOME_ID = uuid.UUID("01920000-0000-7000-8000-000000000001")


def _labels(piece_filter: PieceFilter) -> list[tuple[str, str]]:
    return [(item.label, item.value_display) for item in piece_filter.describe()]


def test_the_active_filters_are_written_with_their_accents() -> None:
    every_filter = PieceFilter(
        q="retablo",
        collection_id=SOME_ID,
        tenure_regime=TenureRegime.LOAN_FOR_USE,
        category_id=SOME_ID,
        conservation_state_id=SOME_ID,
        material_id=SOME_ID,
        location_id=SOME_ID,
        has_inventory_code=True,
        period_text="colonial",
        epoch_start_year=1900,
        epoch_end_year=1950,
        valuation_min=10.0,
        valuation_max=20.0,
        loan_agreement_ref="CONV-2026-0001",
    )

    labels = [label for label, _value in _labels(every_filter)]

    assert labels == [
        "Búsqueda",
        "Colección",
        "Régimen de tenencia",
        "Categoría",
        "Estado de conservación",
        "Material",
        "Ubicación",
        "Código de inventario",
        "Época (texto)",
        "Época",
        "Valorización",
        "Convenio de préstamo",
    ]


@pytest.mark.parametrize(
    ("piece_filter", "expected"),
    [
        (PieceFilter(collection_code="MMZ"), ("Colección", "Código 'MMZ'")),
        (PieceFilter(without_collection=True), ("Colección", "Sin colección asignada")),
        (PieceFilter(without_collection=False), ("Colección", "Con colección asignada")),
        (PieceFilter(has_inventory_code=True), ("Código de inventario", "Con código I vigente")),
        (PieceFilter(has_inventory_code=False), ("Código de inventario", "Sin código I vigente")),
        (PieceFilter(epoch_start_year=1900), ("Época desde", "1900")),
        (PieceFilter(epoch_end_year=1950), ("Época hasta", "1950")),
        (PieceFilter(valuation_min=10.0), ("Valorización mínima", "10.0")),
        (PieceFilter(valuation_max=20.0), ("Valorización máxima", "20.0")),
        (
            PieceFilter(collection_id=SOME_ID),
            ("Colección", f"Colección {SOME_ID} (con subcolecciones)"),
        ),
    ],
)
def test_each_active_filter_value_keeps_its_accents(
    piece_filter: PieceFilter, expected: tuple[str, str]
) -> None:
    assert _labels(piece_filter) == [expected]


@pytest.mark.parametrize(
    ("piece_filter", "word"),
    [
        (PieceFilter(valuation_min=1.0), "valorización"),
        (PieceFilter(loan_agreement_ref="CONV-2026-0001"), "préstamo"),
    ],
)
def test_the_permission_messages_keep_their_accents(piece_filter: PieceFilter, word: str) -> None:
    with pytest.raises(PermissionDenied) as raised:
        piece_filter.validate_permissions(Viewer(permissions=frozenset()))

    assert word in str(raised.value)
