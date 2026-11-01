"""Predefined mapping templates of the synthetic seed (change ``rediseno-ux-administracion``).

The museum names several sources of historical data (book of inventory, Word cards, Access table,
storage inventory and loan collections). Until it hands over the real files, each one has an
illustrative v1 template so that Administration shows what a format is and the import wizard
recognizes a file by its headers. Column names are illustrative [SUPUESTO A1]: nothing here comes
from the museum.
"""

from dataclasses import dataclass
from typing import Any

# (source column, target) pairs; ``transforms`` is optional. Targets are the v1 targets of
# ``app.modules.imports.mapping`` written as plain dicts.
Column = tuple[str, dict[str, Any]] | tuple[str, dict[str, Any], list[str]]

PAYLOAD: dict[str, Any] = {"kind": "source_payload"}


def field(name: str) -> dict[str, Any]:
    return {"kind": "field", "name": name}


def codes(default_type: str | None = None) -> dict[str, Any]:
    return {"kind": "identifiers", "default_type": default_type}


@dataclass(frozen=True)
class PredefinedTemplate:
    name: str
    source_name: str
    description: str
    columns: tuple[Column, ...]

    @property
    def headers(self) -> list[str]:
        return [column[0] for column in self.columns]

    def mapping(self) -> dict[str, Any]:
        built: list[dict[str, Any]] = []
        for column in self.columns:
            entry: dict[str, Any] = {"source": column[0], "target": column[1]}
            if len(column) == 3:
                entry["transforms"] = column[2]
            built.append(entry)
        return {"version": 1, "columns": built}


CODE_TRANSFORMS = ["trim", "absence_markers", "split_concatenated"]

PREDEFINED_TEMPLATES: tuple[PredefinedTemplate, ...] = (
    PredefinedTemplate(
        name="Libro de inventario general v1",
        source_name="Libro de inventario (sintético)",
        description="[SUPUESTO] Columnas ilustrativas del libro de inventario general (sintético).",
        columns=(
            ("Nº INVENTARIO", codes("I"), CODE_TRANSFORMS),
            ("DESCRIPCIÓN DEL OBJETO", field("denomination"), ["trim"]),
            ("PROCEDENCIA", field("provenance"), ["trim"]),
            ("FECHA DE INGRESO", PAYLOAD),
            ("ESTADO", PAYLOAD),
            ("OBSERVACIONES", field("notes"), ["trim"]),
        ),
    ),
    PredefinedTemplate(
        name="Ficha en Word tabulada v1",
        source_name="Ficha en Word (sintética)",
        description="[SUPUESTO] Columnas ilustrativas de las fichas en Word pasadas a tabla.",
        columns=(
            ("CÓDIGO MUSEO", codes(), CODE_TRANSFORMS),
            ("TÍTULO", field("denomination"), ["trim"]),
            ("AUTOR", field("author"), ["trim"]),
            ("TÉCNICA / MATERIAL", PAYLOAD),
            ("MEDIDAS", field("dimensions_text"), ["trim", "propose_dimensions"]),
            ("DATACIÓN", field("epoch_original_text"), ["trim", "propose_period"]),
            ("DESCRIPCIÓN", field("description"), ["trim"]),
            ("OBSERVACIONES", field("notes"), ["trim"]),
        ),
    ),
    PredefinedTemplate(
        name="Tabla de Access v1",
        source_name="Tabla de Access (sintética)",
        description="[SUPUESTO] Columnas ilustrativas de la tabla de piezas de Access.",
        columns=(
            ("ID_OBJETO", PAYLOAD),
            ("COD_COLECCION", codes("COLECCION"), CODE_TRANSFORMS),
            ("NOMBRE_OBJETO", field("denomination"), ["trim"]),
            ("PROCEDENCIA", field("provenance"), ["trim"]),
            ("ESTADO_CONSERVACION", PAYLOAD),
            ("UBICACION_ACTUAL", PAYLOAD),
            ("FECHA_REGISTRO", PAYLOAD),
        ),
    ),
    PredefinedTemplate(
        name="Inventario de depósito v1",
        source_name="Inventario de depósito (sintético)",
        description="[SUPUESTO] Columnas ilustrativas de la verificación física de un depósito.",
        columns=(
            ("CÓDIGO", codes(), CODE_TRANSFORMS),
            ("OBJETO", field("denomination"), ["trim"]),
            ("UBICACIÓN ENCONTRADA", PAYLOAD),
            ("FECHA DE VERIFICACIÓN", PAYLOAD),
            ("VERIFICADO POR", field("recorded_by"), ["trim"]),
            ("OBSERVACIÓN", field("notes"), ["trim"]),
        ),
    ),
    PredefinedTemplate(
        name="Colecciones en comodato v1",
        source_name="Comodatos (sintético)",
        description="[SUPUESTO] Columnas ilustrativas del registro de bienes en comodato.",
        columns=(
            ("N° INTERNO", codes("COLECCION"), CODE_TRANSFORMS),
            ("COMODANTE", field("lender_name"), ["trim"]),
            ("DENOMINACIÓN DEL BIEN", field("denomination"), ["trim"]),
            ("REFERENCIA DEL CONTRATO", field("loan_agreement_ref"), ["trim"]),
            ("RÉGIMEN", field("tenure_regime"), ["trim"]),
            ("RESTRICCIONES", PAYLOAD),
            ("OBSERVACIONES", field("notes"), ["trim"]),
        ),
    ),
)
