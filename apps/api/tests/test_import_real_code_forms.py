"""Spec identificacion-piezas — Formas reales de código de colección; Marcas de vacío y texto que
no es un código (RF-023, RF-004, RF-008, RN-010).

Change formatos-reales-importacion, tasks 4.2 to 4.4 (design D5): compound acronyms with
hyphens and letter suffixes are collection codes, also in the column of the code I; a number
without acronym takes the acronym of the collection of the row; a note in a code column becomes
an observation of the piece. Synthetic codes and collections (RNF-014).
"""

from typing import Any

import pytest
from sqlalchemy.orm import Session

from app.core.models_base import new_uuid
from app.models import Collection
from app.modules.catalog.enums import TenureRegime
from app.modules.identification.normalization import (
    TYPE_COLLECTION,
    detect_type,
    normalize_collection_code,
    propose_identifiers,
)
from app.modules.imports.mapping import (
    ColumnSpecV1,
    FieldTarget,
    IdentifiersTarget,
    MappingContext,
    MappingSpecV1,
    apply_mapping,
)
from tests.conftest import ActAs

# --- 4.2 sigla compuesta y sufijo -------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "normalized"),
    [
        ("AMM-IN-V-0195", "AMM-IN-V 195"),
        ("amm-ot-r-0073", "AMM-OT-R 73"),
        ("ela 012 cel", "ELA 12 CEL"),
        ("MMZ 40.1", "MMZ 40.1"),
        ("M.M.Z. 015", "MMZ 15"),
    ],
)
def test_real_forms_of_collection_codes(raw: str, normalized: str) -> None:
    result = normalize_collection_code(raw)

    assert result.normalized == normalized


def test_a_suffix_makes_a_different_code() -> None:
    assert (
        normalize_collection_code("ELA 12 CEL").normalized
        != normalize_collection_code("ELA 12").normalized
    )


def test_a_compound_acronym_in_the_code_i_column_is_a_collection_code() -> None:
    assert detect_type("AMM-IN-V-0195") == TYPE_COLLECTION
    (proposal,) = propose_identifiers("AMM-IN-V-0195", "I")

    assert proposal.type_code == TYPE_COLLECTION
    assert proposal.result.normalized == "AMM-IN-V 195"


# --- 4.3 y 4.4 en el mapeo de una fila ----------------------------------------------------------

SPEC = MappingSpecV1(
    columns=[
        ColumnSpecV1(source="I", target=IdentifiersTarget(default_type="I")),
        ColumnSpecV1(source="COLECCION", target=IdentifiersTarget(default_type="COLECCION")),
        ColumnSpecV1(source="NOMBRE", target=FieldTarget(name="collection")),
        ColumnSpecV1(source="TITULO", target=FieldTarget(name="denomination")),
        ColumnSpecV1(source="OBS", target=FieldTarget(name="notes")),
    ]
)


@pytest.fixture
def ctx(session: Session, act_as: ActAs, reference: Any) -> MappingContext:
    with act_as("ADMIN"):
        session.add(
            Collection(
                id=new_uuid(),
                name="Colección Juana Pérez (sintética)",
                acronym="JPZ",
                acronym_normalized="JPZ",
                default_tenure_regime=TenureRegime.OWNED,
            )
        )
        session.commit()
    return MappingContext(session)


def row(**values: Any) -> dict[str, Any]:
    return {"I": None, "COLECCION": None, "NOMBRE": None, "TITULO": "Mate sintético", "OBS": None,
            **values}  # fmt: skip


def codes(mapped: Any) -> list[tuple[str, str | None, str]]:
    return [(i.type_code, i.normalized_value, i.status.value) for i in mapped.identifiers]


def test_a_number_without_acronym_takes_the_acronym_of_the_collection_of_the_row(
    ctx: MappingContext,
) -> None:
    mapped = apply_mapping(row(COLECCION=45, NOMBRE="JPZ"), SPEC, ctx)

    assert codes(mapped) == [("COLECCION", "JPZ 45", "NORMALIZED")]
    assert [warning.code for warning in mapped.warnings] == ["acronym_from_row"]


def test_the_collection_of_the_row_may_be_written_by_its_name(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(COLECCION="40.1", NOMBRE="Juana Perez (sintetica)"), SPEC, ctx)

    assert codes(mapped) == [("COLECCION", "JPZ 40.1", "NORMALIZED")]


def test_a_number_without_acronym_nor_collection_is_unparseable(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(COLECCION="45"), SPEC, ctx)

    assert codes(mapped) == [("COLECCION", None, "UNPARSEABLE")]
    assert mapped.identifiers[0].original_value == "45"
    assert [warning.code for warning in mapped.warnings] == ["number_without_acronym"]


def test_a_note_in_the_code_i_column_becomes_an_observation(ctx: MappingContext) -> None:
    mapped = apply_mapping(
        row(I="número de inventario mal asignado, revisar", OBS="Fila sintética"), SPEC, ctx
    )

    assert codes(mapped) == []  # no code I
    assert mapped.fields["notes"] == (
        "Fila sintética\n[Importación] número de inventario mal asignado, revisar"
    )
    assert [warning.code for warning in mapped.warnings] == ["text_as_observation"]


def test_a_short_unparseable_value_stays_a_code(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(I="I.-18x4"), SPEC, ctx)

    assert codes(mapped) == [("I", None, "UNPARSEABLE")]
    assert "notes" not in mapped.fields


def test_no_presenta_is_no_code(ctx: MappingContext) -> None:
    mapped = apply_mapping(row(I="No presenta"), SPEC, ctx)

    assert [(i.type_code, i.is_absent) for i in mapped.identifiers] == [("I", True)]
    assert mapped.warnings == []
