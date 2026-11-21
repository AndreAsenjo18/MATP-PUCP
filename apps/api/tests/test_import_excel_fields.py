"""Fields of the museum spreadsheets that were not read (revision with the real files, 2026-11-21).

Running the 16 files of the consultancy through the pipeline showed values that the validation
dropped or misread:

- measures: «No aplica» or «-» was a warning and «Diámetro No aplica» in the text, and «12 cm»
  or «75,4cm» (the unit of the column written after the number) was not read;
- entry dates written with the month in Spanish («1-feb.-2015», «11-set.-2006») were not read;
- a type of object such as «Escultura y talla» or «Textilería e indumentaria» was split at «y» and
  «e», so the review offered «talla» and «indumentaria» as values of the list;
- a location written as a path («Depósito N° 1, caja 6.», or one level per line) matched none.

Only column names and the shape of the values come from the museum files; every value here is
synthetic (RNF-014).
"""

from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.modules.audit.context import audit_context
from app.modules.collections.models import Collection
from app.modules.imports.mapping import MappingContext, MappingSpecV1, _match_terms, apply_mapping
from app.modules.locations.models import Location, LocationLevel
from app.seed.reference import ReferenceData
from tests.conftest import SYSTEM_CONTEXT
from tests.test_import_multi_source import SPEC, row


@pytest.fixture
def ctx(session: Session, reference: ReferenceData) -> MappingContext:
    return MappingContext(session)


# -------------------------------------------------------------------------------- measures


def test_a_measure_that_does_not_apply_is_no_value(ctx: MappingContext) -> None:
    mapped = apply_mapping(
        row(
            **{"Alto (cm)": 25, "Ancho (cm)": "No aplica", "Espesor (cm)": " - ", "Peso (gr)": "-"}
        ),
        SPEC,
        ctx,
    )

    assert mapped.fields["dimensions_text"] == "Alto 25 cm"
    assert mapped.dimensions == [{"dimension": "alto", "value": 25.0, "unit": "cm"}]
    assert mapped.warnings == []
    # What the file said stays in the source record (RF-008).
    assert mapped.source_payload["Ancho (cm)"] == "No aplica"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("12 cm", 12.0),
        ("22 cm ", 22.0),
        ("75,4cm", 75.4),
        ("26cm.", 26.0),
        ("2.4.", 2.4),
        ("1.44 m", 144.0),  # in metres in a column in cm
    ],
)
def test_a_measure_with_its_unit_written_is_read(
    ctx: MappingContext, value: str, expected: float
) -> None:
    mapped = apply_mapping(row(**{"Alto (cm)": value}), SPEC, ctx)

    assert mapped.dimensions == [{"dimension": "alto", "value": expected, "unit": "cm"}]
    assert mapped.warnings == []


@pytest.mark.parametrize("value", ["10 x 10 cm", "70 (armado)", "120 g", "2 kg"])
def test_a_measure_that_needs_a_person_is_still_a_warning(ctx: MappingContext, value: str) -> None:
    # Two numbers, a note, or the unit of another column: someone has to look at it.
    mapped = apply_mapping(row(**{"Alto (cm)": value}), SPEC, ctx)

    assert mapped.dimensions is None
    assert [warning.code for warning in mapped.warnings] == ["measure_not_number"]


def test_a_weight_with_its_unit_written_is_read(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(**{"Peso (gr)": "120 gr"}), SPEC, ctx)

    assert mapped.dimensions == [{"dimension": "peso", "value": 120.0, "unit": "g"}]


# -------------------------------------------------------------------------------- dates


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("1-feb.-2015", "2015-02-01"),
        ("11-set.-2006", "2006-09-11"),
        ("20-Feb-2006", "2006-02-20"),
        ("3 de marzo de 1998", "1998-03-03"),
        ("14/jun/2018", "2018-06-14"),
    ],
)
def test_an_entry_date_with_the_month_in_spanish(
    ctx: MappingContext, value: str, expected: str
) -> None:
    mapped = apply_mapping(row(**{"Fecha de ingreso": value}), SPEC, ctx)

    assert mapped.fields["entry_date"] == expected
    assert mapped.warnings == []


@pytest.mark.parametrize("value", ["31-feb.-2015", "1-xyz.-2015"])
def test_a_month_name_that_makes_no_date_is_still_unreadable(
    ctx: MappingContext, value: str
) -> None:
    mapped = apply_mapping(row(**{"Fecha de ingreso": value}), SPEC, ctx)

    assert "entry_date" not in mapped.fields
    assert [warning.code for warning in mapped.warnings] == ["entry_date_unreadable"]


# -------------------------------------------------------------------------------- term lists


def test_a_type_of_object_with_y_in_its_name_is_one_value(ctx: MappingContext) -> None:
    matches = _match_terms("OBJECT_TYPE", "Textilería e indumentaria", ctx)

    assert matches.unmatched == ["Textilería e indumentaria"]


def test_one_value_per_line_keeps_each_name_whole(ctx: MappingContext) -> None:
    matches = _match_terms("OBJECT_TYPE", "CESTERÍA\n\nRecipientes y utensilios", ctx)

    assert matches.unmatched == ["CESTERÍA", "Recipientes y utensilios"]


def test_materials_are_still_a_list_at_y(ctx: MappingContext) -> None:
    # The seed has «Madera» and «Lana»; a piece takes several materials.
    matches = _match_terms("MATERIAL", "Madera y lana, plumas", ctx)

    assert [code for _text, code in matches.matched] == ["MADERA", "LANA"]
    assert matches.unmatched == ["plumas"]


# -------------------------------------------------------------------------------- locations


def _location(
    session: Session, name: str, level: LocationLevel, parent: Location | None
) -> Location:
    location = Location(
        id=new_uuid(),
        name=name,
        code=f"T-{new_uuid().hex[-8:]}",
        level=level,
        parent_id=parent.id if parent else None,
    )
    session.add(location)
    session.flush()
    return location


@pytest.fixture
def places(session: Session, reference: ReferenceData) -> dict[str, Any]:
    with audit_context(session, SYSTEM_CONTEXT):
        site = _location(session, "Sede de prueba", LocationLevel.SITE, None)
        store = _location(session, "Depósito N° 1", LocationLevel.SPACE, site)
        shelf = _location(session, "Anaquel", LocationLevel.FURNITURE, store)
        box = _location(session, "Caja 6", LocationLevel.CONTAINER, shelf)
        other = _location(session, "Depósito N° 2", LocationLevel.SPACE, site)
        other_box = _location(session, "Caja 6", LocationLevel.CONTAINER, other)
        floor = _location(session, "2do piso", LocationLevel.SPACE, site)
        room = _location(session, "Cuarto almacén", LocationLevel.FURNITURE, floor)
        room_box = _location(session, "Caja 8", LocationLevel.CONTAINER, room)
        session.commit()
    return {"box": box.id, "other_box": other_box.id, "room_box": room_box.id}


@pytest.mark.parametrize(
    ("text", "place"),
    [
        ("Depósito N° 1, caja 6.", "box"),  # the shelf between them may be left out
        ("Deposito N°2, Caja 6", "other_box"),
        ("2do piso\nCuarto almacén\nCaja 8", "room_box"),
        ("Sede de prueba, 2do piso, Caja 8", "room_box"),
        ("2do piso, Cuarto almacén, Caja 08", "room_box"),  # the zeros before a number
    ],
)
def test_a_location_written_as_a_path(
    session: Session, places: dict[str, Any], text: str, place: str
) -> None:
    assert MappingContext(session).locations_named(text) == [places[place]]


def test_a_path_that_does_not_lead_to_one_place_finds_none_or_several(
    session: Session, places: dict[str, Any]
) -> None:
    ctx = MappingContext(session)

    assert ctx.locations_named("Depósito N° 1, caja 9") == []
    assert ctx.locations_named("Depósito N° 2, Cuarto almacén") == []  # not inside it
    assert sorted(ctx.locations_named("Caja 6")) == sorted([places["box"], places["other_box"]])


# -------------------------------------------------------------------------------- collections


def test_two_collections_with_the_name_of_the_file_say_so(
    session: Session, reference: ReferenceData
) -> None:
    """Before, the row said there was no collection with that name, and the person looked for
    one that did exist (it had been created twice)."""
    with audit_context(session, SYSTEM_CONTEXT):
        for _ in range(2):
            session.add(Collection(id=new_uuid(), name="Colección Ejemplo Sintético"))
        session.commit()
    spec = MappingSpecV1.model_validate(
        {
            "version": 1,
            "columns": [
                {"source": "Título", "target": {"kind": "field", "name": "denomination"}},
                {"source": "Colección", "target": {"kind": "field", "name": "collection"}},
            ],
            "defaults": {"tenure_regime": "OWNED"},
        }
    )

    mapped = apply_mapping(
        {"Título": "Mate (sintético)", "Colección": "Ejemplo Sintético"},
        spec,
        MappingContext(session),
    )

    [error] = mapped.errors
    assert error.code == "ambiguous_collection"
    assert error.message.startswith("Hay 2 colecciones con el nombre «Ejemplo Sintético»")
