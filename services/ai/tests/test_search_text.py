"""Texto que sobra de una búsqueda con IA (change busqueda-ia-sin-palabras-genericas; RIA-06).

«piezas de madera procedentes de Ayacucho» se vuelve material y procedencia; «piezas» no debe quedar
como texto que buscar. Datos sintéticos (RNF-014).
"""

import pytest
from fastapi.testclient import TestClient

from matp_ai.config import Settings
from matp_ai.main import create_app
from matp_ai.schemas import SearchInterpretation
from matp_ai.search_text import clean_interpretation, clean_query


@pytest.mark.parametrize(
    ("q", "used", "expected"),
    [
        ("piezas de procedentes de", [], None),
        ("píeza", [], None),  # with a stray accent, as the model wrote it
        ("Piezas", [], None),
        ("muéstrame las piezas de", [], None),
        ("piezas Ayacucho", ["Ayacucho"], None),  # the model repeats a filter in q
        ("objetos de toro de Pucará", [], "toro de Pucará"),  # the middle stays a phrase
        ("toro de Pucará", [], "toro de Pucará"),
        ("mantas con flores", [], "mantas con flores"),
        ("retablo pieza", [], "retablo"),
        (None, [], None),
    ],
)
def test_clean_query(q: str | None, used: list[str], expected: str | None) -> None:
    assert clean_query(q, used) == expected


def test_the_filters_do_not_change() -> None:
    result = clean_interpretation(
        SearchInterpretation(q="piezas", material="Madera", provenance="Ayacucho")
    )
    assert (result.q, result.material, result.provenance) == (None, "Madera", "Ayacucho")


def test_the_endpoint_drops_the_word_pieza() -> None:
    client = TestClient(create_app(Settings(ai_provider="mock")))
    response = client.post(
        "/v1/interpret-search",
        json={
            "text": "piezas de madera",
            "valid_values": {"materials": ["Madera"]},
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["material"] == "Madera"
    assert response.json()["q"] is None
