"""Regresiones de libros con columnas variables y autor, usando datos sintéticos."""

from app.modules.imports.ledger_photo import row_raw_data


def _base(**changes: object) -> dict[str, object]:
    return {
        "inventory_code": "I-9000",
        "denomination": "Figura",
        "description": "Figura cerámica.",
        "author": None,
        "provenance": "Lugar ficticio",
        "conservation_state": "Buena",
        "entry_date": "7-4-2002",
        "additional_code": "ELA 900-CEL",
        **changes,
    }


def test_author_is_separate_and_full_transcription_is_preserved() -> None:
    raw = row_raw_data(
        _base(
            description="Figura cerámica. Autor: Rosa Quesada. Color natural.",
            author="Rosa Quesada",
        )
    )
    assert raw["Autor"] == "Rosa Quesada"
    assert "Autor: Rosa Quesada" not in raw["Descripción"]
    assert (
        raw["__ledger_original_description"]
        == "Figura cerámica. Autor: Rosa Quesada. Color natural."
    )


def test_explicit_author_can_be_found_even_when_model_omits_it() -> None:
    raw = row_raw_data(_base(description="Figura. Autor: Rosa Quesada.", author=None))
    assert raw["Autor"] == "Rosa Quesada"


def test_a_workshop_is_not_an_author() -> None:
    raw = row_raw_data(_base(description="Cerámica. Taller de don Jacinto.", author=None))
    assert raw["Autor"] is None


def test_swapped_columns_recover_state_without_losing_code() -> None:
    raw = row_raw_data(_base(conservation_state="M.H.O.", additional_code="Buena"))
    assert raw["Estado de conservación"] == "Buena"
    assert raw["Código adicional"] == "M.H.O."
    assert raw["__ledger_columns_exchanged"] is True


def test_normal_order_stays_unchanged() -> None:
    raw = row_raw_data(_base())
    assert raw["Estado de conservación"] == "Buena"
    assert raw["Código adicional"] == "ELA 900-CEL"
    assert "__ledger_columns_exchanged" not in raw
