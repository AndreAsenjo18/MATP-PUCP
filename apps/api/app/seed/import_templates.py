"""Predefined mapping templates: the two real formats of the museum (change
``formatos-reales-importacion``, task 3.2; design D1 and D2).

The museum handed over 61 Excel files in two families (``docs/preguntas-contraparte.md``, FR;
ADR-019): the **standardized database 2025** (44 columns, with variants of 46, 27 and 28) and the
**catalogue sheet in RN format** (54 columns, with a variant of 40). Each template lists every
column of its family with its target, the other names a variant uses (``aliases``) and whether a
variant may lack it (``optional``); only the code columns and the denomination are required, so a
file of another format is still rejected. Columns of a file the template does not know stay as
source data (RF-008). Only column names come from the museum files, never their values.

The illustrative templates of ``rediseno-ux-administracion`` (``ILLUSTRATIVE_NAMES``, [SUPUESTO
A1]) are retired logically by ``sync_predefined_templates`` (RN-005).
"""

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

PAYLOAD: dict[str, Any] = {"kind": "source_payload"}


def target(name: str) -> dict[str, Any]:
    return {"kind": "field", "name": name}


def codes(default_type: str | None = None) -> dict[str, Any]:
    return {"kind": "identifiers", "default_type": default_type}


def code(type_code: str) -> dict[str, Any]:
    return {"kind": "identifier", "type": type_code}


def terms(vocabulary: str) -> dict[str, Any]:
    return {"kind": "terms", "vocabulary": vocabulary}


def measures(*magnitudes: str) -> dict[str, Any]:
    return {"kind": "measures", "magnitudes": list(magnitudes)}


CODE_TRANSFORMS = ["trim", "absence_markers", "split_concatenated"]
TEXT = ["trim"]


@dataclass(frozen=True)
class TemplateColumn:
    source: str
    target: dict[str, Any]
    transforms: list[str] = field(default_factory=list)
    aliases: tuple[str, ...] = ()
    required: bool = False
    # Several columns into one target, joined with ``join`` (design D3).
    sources: tuple[str, ...] = ()
    join: str | None = None

    @property
    def headers(self) -> list[str]:
        return list(self.sources) if self.sources else [self.source]

    def as_json(self) -> dict[str, Any]:
        entry: dict[str, Any] = {"source": self.source, "target": self.target}
        if self.sources:
            entry["sources"] = list(self.sources)
        if self.join is not None:
            entry["join"] = self.join
        if self.transforms:
            entry["transforms"] = list(self.transforms)
        if self.aliases:
            entry["aliases"] = list(self.aliases)
        if not self.required:
            entry["optional"] = True
        return entry


def column(
    source: str,
    target_: dict[str, Any] = PAYLOAD,
    transforms: list[str] | None = None,
    *aliases: str,
    required: bool = False,
) -> TemplateColumn:
    return TemplateColumn(source, target_, transforms or [], aliases, required)


@dataclass(frozen=True)
class PredefinedTemplate:
    name: str
    source_name: str
    description: str
    columns: tuple[TemplateColumn, ...]

    @property
    def headers(self) -> list[str]:
        return [header for item in self.columns for header in item.headers]

    def mapping(self) -> dict[str, Any]:
        return {"version": 1, "columns": [item.as_json() for item in self.columns]}


# Columns of the standardized database 2025, in the order of the 44-column files.
BD_ESTANDARIZADA = PredefinedTemplate(
    name="BD estandarizada 2025",
    source_name="Base de datos estandarizada del museo (2025)",
    description="Inventario general, listado RNBM y archivos por colección de la consultoría "
    "2024/25: 44 columnas, con variantes de 46, 27 y 28. Las columnas de datos del propietario "
    "quedan solo en los datos de origen.",
    columns=(
        column("N°", PAYLOAD, None, "Nº"),
        column("N° Inventario MATP (I)", codes("I"), CODE_TRANSFORMS, required=True),
        column(
            "Código de la colección",
            codes("COLECCION"),
            CODE_TRANSFORMS,
            "N° Inventario MATP (I) (2)",  # one collection labels it so (design D2)
            required=True,
        ),
        column("N° Inscripción Registro Nacional", codes("INC_RN"), CODE_TRANSFORMS),
        column("Código de propietario (RN*)", code("PROPIETARIO"), TEXT, "Código de propietario"),
        column("Código PUCP", code("PUCP"), TEXT),
        column("Otros códigos", codes("OTRO"), CODE_TRANSFORMS),
        column("Nombre de la Colección", target("collection"), TEXT),
        column("Forma de Adquisición", terms("ACQUISITION_METHOD"), TEXT),
        column("Fecha de ingreso a la colección", target("entry_date")),
        column("Autor / Atribuido / Firmado", target("author"), TEXT, "Autor / Atribuido"),
        column("Procedencia (Ciudad, País, Continente)", target("provenance"), TEXT),
        column("Época / Año", target("epoch_original_text"), TEXT),
        column("Clasificación (RN*)"),
        column("Clasificación específica (RN*)"),
        column("Tipo de bien", terms("OBJECT_TYPE"), TEXT),
        column(
            "Título / Denominación",
            target("denomination"),
            TEXT,
            "Título/Denominación",
            required=True,
        ),
        column("Material", terms("MATERIAL"), TEXT),
        TemplateColumn(
            "Alto (cm)",
            measures("alto", "ancho", "espesor", "diámetro", "peso"),
            sources=("Alto (cm)", "Ancho (cm)", "Espesor (cm)", "Diámetro (cm)", "Peso (gr)"),
        ),
        column("Técnica de manufactura", terms("TECHNIQUE"), TEXT),
        column("Técnica de acabado"),
        column("Técnica de decoración"),
        column("Descripción del bien", target("description"), TEXT, "Descripción"),
        column("Descripción de decoración"),
        column("Estado de conservación (bueno, regular, malo)", terms("CONSERVATION_STATUS"), TEXT),
        column("Estado de integridad (completo, incompleto, fragmentado)"),
        column("Detalle de conservación (deterioros)"),
        column("Tratamiento de conservación"),
        column("Nombre del registrador", target("recorded_by"), TEXT),
        column("Fecha de registro"),
        column("Nombre del fotógrafo"),
        column("Fecha de la fotografía"),
        column("Datos de registro anterior \n(nombre y fecha)"),
        # Personal data of the owner (RNF-014, RF-041): source data only.
        column("Tipo de propietario"),
        column("Nombre de propietario"),
        column("Dirección de propietario"),
        column("Nombre de localización (inmueble)"),
        column("Dirección de localización (inmueble)"),
        column("Ubicación en inmueble"),
        column("Observaciones", target("notes"), TEXT),
    ),
)

# Columns of the catalogue sheet in RN format (header on row 2, groups of 3 and 4 columns).
FICHA_RN = PredefinedTemplate(
    name="Ficha de catalogación RN",
    source_name="Fichas de catalogación del museo (formato RN)",
    description="Fichas de catalogación en el formato del Registro Nacional (colección AJB de 100 "
    "en 100 y colección FJT): 54 columnas, con una variante de 40. La procedencia y las "
    "dimensiones ocupan varias columnas; los datos del propietario quedan solo en los datos de "
    "origen.",
    columns=(
        column("Nº", PAYLOAD, None, "N°"),
        column("Código  INC", codes("INC_RN"), CODE_TRANSFORMS, required=True),
        column("Código de propietario", code("PROPIETARIO"), TEXT),
        column("Otros códigos", codes("OTRO"), CODE_TRANSFORMS),
        column("Tipo de bien", terms("OBJECT_TYPE"), TEXT),
        column(
            "Título/Denominación",
            target("denomination"),
            TEXT,
            "Título / Denominación",
            required=True,
        ),
        column("Autor/ Atribución", target("author"), TEXT),
        column("País / Continente"),
        TemplateColumn(
            "Procedencia",
            target("provenance"),
            TEXT,
            sources=("Procedencia", "Procedencia (2)", "Procedencia (3)"),
            join=", ",
        ),
        column("Época / Año", target("epoch_original_text"), TEXT),
        column("Descripción del bien", target("description"), TEXT),
        column("Material", terms("MATERIAL"), TEXT),
        column("Técnica de manufactura", terms("TECHNIQUE"), TEXT),
        column("Técnica de acabado"),
        column("Técnica de decoración"),
        column("Descripcion de decoración", PAYLOAD, None, "Decoración"),
        TemplateColumn(
            "Dimensiones",
            target("dimensions_text"),
            TEXT,
            sources=("Dimensiones", "Dimensiones (2)", "Dimensiones (3)", "Dimensiones (4)"),
            join="; ",
        ),
        column("Estado de conservación (bueno, regular, malo)", terms("CONSERVATION_STATUS"), TEXT),
        column("Estado de integridad (completo, incompleto, fragmentado)"),
        column("Detalle de conservación (deterioros)"),
        column("Colección", target("collection"), TEXT),
        column("Bibliografía"),
        column("Elementos adicionales (marco, base, pedestal, tapa, etc.)"),
        column("Material del elemento adicional"),
        column("Forma del elemento adicional"),
        column("Técnica del elemento adicional"),
        column("Estilo del elemento adicional"),
        column("Acabado del elemento adicional"),
        column("Estado de conservación del elemento adicional"),
        column("Estado de integridad del elemento adicional"),
        column("Alto del elemento adicional (cm)"),
        column("Ancho del elemento adicional (cm)"),
        column("Fondo del elemento adicional (cm)"),
        column("Diámetro del elemento adicional (cm)"),
        column("Peso del elemento adicional (g)"),
        column("Observaciones", target("notes"), TEXT),
        # Location and personal data of the owner (RNF-014, RF-041): source data only.
        column("Inmueble"),
        column(
            "Domicilio del Inmueble (especificar calle, número, provincia, distrito y departamento)"
        ),
        column("Ubicación en el inmueble"),
        column("Situación (Habida-No habida)"),
        column("Referencia"),
        column("Propietario (persona natural o jurídica)"),
        column(
            "Domicilio legal del propietario (especificar calle, número, provincia, distrito y "
            "departamento)"
        ),
        column(
            "Forma de Adquisición (compra, Custodia, Decomiso, Desconocido, Donación, Entrega "
            "judicial, Evaluación, Herencia, Investigación, Rescate)",
            terms("ACQUISITION_METHOD"),
            TEXT,
            "Forma de Adquisición",
        ),
        column("Nombre del Catalogador", target("recorded_by"), TEXT),
        column("Fecha de la catalogación"),
        column(
            "Referencia (Datos de una catalogación anterior: nombre  y  fecha)",
            PAYLOAD,
            None,
            "Referencia (Datos de una catalogación anterior: nombre  y  fecha )",
        ),
        column("Nombre del Fotógrafo"),
        column("Fecha de Fotografiado"),
    ),
)

PREDEFINED_TEMPLATES: tuple[PredefinedTemplate, ...] = (BD_ESTANDARIZADA, FICHA_RN)

#: Illustrative templates seeded before the real files were reviewed [SUPUESTO A1].
ILLUSTRATIVE_NAMES = (
    "Libro de inventario general v1",
    "Ficha en Word tabulada v1",
    "Tabla de Access v1",
    "Inventario de depósito v1",
    "Colecciones en comodato v1",
)
RETIRED_REASON = (
    "Plantilla ilustrativa reemplazada por las plantillas de los formatos reales del museo "
    "(formatos-reales-importacion)."
)


def sync_predefined_templates(session: Session) -> tuple[list[str], list[str]]:
    """Create the real templates that do not exist and retire the illustrative ones (RN-005).
    Idempotent: a second run changes nothing. Needs an audit context. Returns the names created
    and retired."""
    from app.core.models_base import new_uuid
    from app.modules.audit.soft_delete import soft_delete
    from app.modules.imports.mapping import MappingSpecV1
    from app.modules.imports.models import ImportMappingTemplate
    from app.modules.imports.templates import header_signature

    active = {
        template.name: template
        for template in session.scalars(
            select(ImportMappingTemplate).where(ImportMappingTemplate.deleted_at.is_(None))
        )
    }
    created = []
    for predefined in PREDEFINED_TEMPLATES:
        if predefined.name in active:
            continue
        session.add(
            ImportMappingTemplate(
                id=new_uuid(),
                name=predefined.name,
                source_name=predefined.source_name,
                header_signature=header_signature(predefined.headers),
                mapping=MappingSpecV1.model_validate(predefined.mapping()).as_json(),
                description=predefined.description,
            )
        )
        created.append(predefined.name)
    retired = []
    for name in ILLUSTRATIVE_NAMES:
        if name in active:
            soft_delete(session, active[name], RETIRED_REASON)
            retired.append(name)
    session.flush()
    return created, retired
