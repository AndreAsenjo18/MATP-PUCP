"""Spec importacion-datos — Plantillas de los formatos reales del museo con variantes (RF-022,
RF-021, RF-008).

Change formatos-reales-importacion, tasks 1.2, 3.1 and 3.2 (design D1, D2): the fixture with the
real headers and invented values is ingested; each family is recognized by its template, also
its variants with more or fewer columns or another name for a column (aliases); columns the
template does not know stay as source data; a file of another format gets no suggestion.
Synthetic values only (RNF-014).
"""

from collections.abc import Callable

import pytest
from sqlalchemy.orm import Session

from app.modules.imports.ingest import IngestResult, ingest
from app.modules.imports.mapping import (
    MappingContext,
    apply_mapping,
    read_mapping,
    validate_mapping,
)
from app.modules.imports.templates import resolve_columns, suggest_templates
from app.seed.import_templates import BD_ESTANDARIZADA, FICHA_RN, sync_predefined_templates
from app.seed.real_formats import FILES
from tests.conftest import ActAs


def read(name: str, sheet: str | None = None) -> IngestResult:
    return ingest(FILES[name](), name, sheet_name=sheet)


@pytest.fixture
def templates(session: Session, act_as: ActAs) -> Callable[[list[str]], list[tuple[str, float]]]:
    with act_as("ADMIN"):
        sync_predefined_templates(session)
        session.commit()

    def suggest(headers: list[str]) -> list[tuple[str, float]]:
        return [(item.template.name, item.score) for item in suggest_templates(session, headers)]

    return suggest


# --- 1.2 el fixture se ingiere ---------------------------------------------------------------


def test_every_fixture_is_ingested() -> None:
    bd = read("bd_estandarizada_44.xlsx")
    assert (bd.header_row, len(bd.headers), bd.row_count) == (1, 44, 6)
    errors = read("bd_estandarizada_27_con_errores.xlsx", "Errores pendientes")
    assert len(errors.headers) == 28 and errors.row_count == 1

    merged = read("ficha_rn_combinada.xlsx")
    assert merged.header_row == 2 and len(merged.headers) == 54
    assert merged.headers[8:11] == ["Procedencia", "Procedencia (2)", "Procedencia (3)"]
    assert merged.skipped_header_rows == [3, 7]  # the sub-headers and a repeated header
    assert merged.row_count == 5

    plain = read("ficha_rn_sin_combinar_40.xlsx")
    assert len(plain.headers) == 40 and plain.skipped_header_rows == [3]
    assert "Dimensiones (4)" in plain.headers and not any(
        header.startswith("Columna ") for header in plain.headers
    )


# --- 3.1 y 3.2 plantillas y variantes ----------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("bd_estandarizada_44.xlsx", "BD estandarizada 2025"),
        ("bd_estandarizada_46.xlsx", "BD estandarizada 2025"),
        ("bd_estandarizada_27_con_errores.xlsx", "BD estandarizada 2025"),
        ("ficha_rn_combinada.xlsx", "Ficha de catalogación RN"),
        ("ficha_rn_sin_combinar_40.xlsx", "Ficha de catalogación RN"),
    ],
)
def test_each_family_and_variant_is_recognized(
    templates: Callable[[list[str]], list[tuple[str, float]]], name: str, expected: str
) -> None:
    suggestions = templates(read(name).headers)

    assert suggestions and suggestions[0][0] == expected


def test_the_44_column_file_is_a_full_match(
    templates: Callable[[list[str]], list[tuple[str, float]]],
) -> None:
    assert templates(read("bd_estandarizada_44.xlsx").headers)[0] == ("BD estandarizada 2025", 1.0)


def test_a_file_of_another_format_gets_no_suggestion(
    templates: Callable[[list[str]], list[tuple[str, float]]],
) -> None:
    other = ["DENOMINACIÓN", "CÓDIGOS", "COLECCIÓN", "RÉGIMEN", "PROCEDENCIA", "ÉPOCA"]

    real = ("BD estandarizada 2025", "Ficha de catalogación RN")
    assert not any(name in real for name, _ in templates(other))


def test_the_variant_with_two_more_columns_links_by_alias_and_keeps_the_rest(
    session: Session, reference: object
) -> None:
    result = read("bd_estandarizada_46.xlsx")
    spec = resolve_columns(read_mapping(BD_ESTANDARIZADA.mapping()), result.headers)
    ctx = MappingContext(session)

    assert validate_mapping(spec, result.headers, ctx) == []
    author = next(c for c in spec.columns if c.target.model_dump().get("name") == "author")
    assert author.source == "Autor / Atribuido"
    mapped = apply_mapping(result.rows[0].raw_data, spec, ctx)
    assert mapped.fields["denomination"] == "Toro de Pucará sintético"
    assert "Firmado" not in mapped.fields and "Estilo / Escuela" not in mapped.fields
    # Unknown columns and source-data columns stay in the source data (RF-008).
    assert mapped.source_payload["Nombre de propietario"] == "Propietario sintético"


def test_a_variant_with_fewer_columns_leaves_the_optional_ones_out(
    session: Session, reference: object
) -> None:
    result = read("bd_estandarizada_27_con_errores.xlsx")
    spec = resolve_columns(read_mapping(BD_ESTANDARIZADA.mapping()), result.headers)

    assert validate_mapping(spec, result.headers, MappingContext(session)) == []
    # 27 file columns: «Técnica de acabado/decoración» stays as source data and the five
    # measures are one column.
    assert sum(len(column.inputs) for column in spec.columns) == 26
    assert len(spec.columns) == 22


def test_a_template_still_rejects_a_file_without_its_required_columns(
    session: Session, reference: object
) -> None:
    headers = ["Nº", "Título/Denominación", "Observaciones"]
    spec = resolve_columns(read_mapping(FICHA_RN.mapping()), headers)

    codes = {error.code for error in validate_mapping(spec, headers, MappingContext(session))}
    assert "unknown_column" in codes  # «Código  INC» is required
