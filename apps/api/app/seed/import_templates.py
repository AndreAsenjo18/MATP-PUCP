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
# Personal data of the owner or the property (RNF-014, RF-041; design D6): source data only,
# marked sensitive; the owner's name is also the lender of a piece in loan for use.
SENSITIVE: dict[str, Any] = {"kind": "source_payload", "sensitive": True}
OWNER: dict[str, Any] = {"kind": "source_payload", "sensitive": True, "lender_for_loans": True}


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

#: How the museum files write the conservation state, as the terms of its list (importacion-
#: aplicar-vocabularios, D2). [SUPUESTO CV1] «En perfecto estado» is «Bueno»; «Restaurado» and
#: the mixed values («Bueno deteriorado») are left to the person: they are not «En restauración».
CONSERVATION_VALUES: dict[str, str] = {
    **dict.fromkeys(
        ["Bueno", "Buena", "Buen estado", "En perfecto estado", "En perfecto"], "BUENO"
    ),
    **dict.fromkeys(
        ["Regular", "Regular estado", "En regular estado", "Estado regular"], "REGULAR"
    ),
    **dict.fromkeys(
        [
            "Malo",
            "Mala",
            "Mal estado",
            "Deteriorado",
            "Deteriorada",
            "Dañado",
            "Dañada",
            "Dañado (apolillado)",
            "Apolillado",
        ],
        "MALO",
    ),
}


def conservation_column(source: str) -> "TemplateColumn":
    return TemplateColumn(
        source,
        terms("CONSERVATION_STATUS"),
        [*TEXT, "value_map"],
        value_map=CONSERVATION_VALUES,
    )


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
    # Values of the file and the term each one is (``terms`` columns; importacion-aplicar-
    # vocabularios, D2). Compared ignoring case, accents and repeated spaces.
    value_map: dict[str, str] | None = None

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
        if self.value_map:
            entry["value_map"] = dict(self.value_map)
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
        conservation_column("Estado de conservación (bueno, regular, malo)"),
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
        column("Nombre de propietario", OWNER),
        column("Dirección de propietario", SENSITIVE),
        column("Nombre de localización (inmueble)", SENSITIVE),
        column("Dirección de localización (inmueble)", SENSITIVE),
        column("Ubicación en inmueble", target("location"), TEXT),
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
        conservation_column("Estado de conservación (bueno, regular, malo)"),
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
        column("Inmueble", SENSITIVE),
        column(
            "Domicilio del Inmueble (especificar calle, número, provincia, distrito y "
            "departamento)",
            SENSITIVE,
        ),
        column("Ubicación en el inmueble", target("location"), TEXT),
        column("Situación (Habida-No habida)"),
        column("Referencia"),
        column("Propietario (persona natural o jurídica)", OWNER),
        column(
            "Domicilio legal del propietario (especificar calle, número, provincia, distrito y "
            "departamento)",
            SENSITIVE,
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

# Encabezados sintéticos de la extracción de IA sobre una foto del libro de registros (change
# `digitalizacion-libro-registros`, design D2): no los escribe el museo, los fija este mismo
# proveedor (RIA-07), siempre iguales — por eso no hay nada que una persona tenga que mapear a
# mano, a diferencia de un Excel real.
LIBRO_REGISTROS = PredefinedTemplate(
    name="Foto del libro de registros",
    source_name="Lectura por IA de una foto del libro de registros manuscrito",
    description="Plantilla fija de los campos que devuelve la lectura por IA de "
    "una página del libro de registros (RIA-07): incluye autor y revisión humana.",
    columns=(
        column("Denominación sugerida", target("denomination"), TEXT),
        column("Descripción", target("description"), TEXT),
        column("Autor", target("author"), TEXT),
        column("Procedencia", target("provenance"), TEXT),
        conservation_column("Estado de conservación"),
        column("Fecha", target("entry_date"), TEXT),
        column("Código de inventario", codes("I"), CODE_TRANSFORMS, required=True),
        # Dato de origen, no identificador (ajuste tras prueba en vivo, LR3 de
        # preguntas-contraparte.md): la IA a veces repite aquí el encabezado de la columna de la
        # foto («M.I.F.O.») en vez del valor real de la fila. Como identificador, ese mismo texto
        # repetido en varias filas choca entre sí y vuelve CONFLICT a todo el lote; como dato de
        # origen queda visible para que el curador lo revise, sin arriesgar el resto del lote.
        column("Código adicional", PAYLOAD),
        # La foto nunca trae la colección (ajuste tras probar en vivo, LR5 de
        # preguntas-contraparte.md): queda vacía a propósito, para que el curador la elija fila por
        # fila en la revisión (misma corrección de celda que el resto de columnas, D8 de
        # design.md) en vez de quedar «Sin registrar» hasta «Revisar pendientes».
        column("Colección", target("collection"), TEXT),
    ),
)

PREDEFINED_TEMPLATES: tuple[PredefinedTemplate, ...] = (BD_ESTANDARIZADA, FICHA_RN, LIBRO_REGISTROS)

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


def refresh_predefined_templates(
    session: Session, *, keep_edited: bool = False, kept: list[str] | None = None
) -> list[str]:
    """Bring the stored mapping of each real template up to the one in this module.

    ``sync_predefined_templates`` only creates the templates that are missing, so a database seeded
    before a template changed (for instance, «Ubicación en inmueble» mapped to the location in
    importacion-aplicar-vocabularios) kept validating with the old mapping: the location and the
    conservation values were never read. The previous mapping stays in the audit log (RN-005).
    With ``keep_edited`` a template a person changed in Administración after its last update by
    the system is left as it is, and its name goes to ``kept``. Idempotent. Needs an audit
    context. Returns the names updated."""
    from app.modules.imports.mapping import MappingSpecV1
    from app.modules.imports.models import ImportMappingTemplate
    from app.modules.imports.templates import header_signature

    updated = []
    for predefined in PREDEFINED_TEMPLATES:
        template = session.scalar(
            select(ImportMappingTemplate).where(
                ImportMappingTemplate.name == predefined.name,
                ImportMappingTemplate.deleted_at.is_(None),
            )
        )
        if template is None:
            continue
        mapping = MappingSpecV1.model_validate(predefined.mapping()).as_json()
        signature = header_signature(predefined.headers)
        if template.mapping == mapping and template.header_signature == signature:
            continue
        if keep_edited and _edited_by_a_person(session, template.id):
            if kept is not None:
                kept.append(predefined.name)
            continue
        template.mapping = mapping
        template.header_signature = signature
        updated.append(predefined.name)
    session.flush()
    return updated


def _edited_by_a_person(session: Session, template_id: Any) -> bool:
    """A person changed the mapping of the template after the system last wrote it."""
    from sqlalchemy import func

    from app.modules.audit.models import AuditLog, AuditOrigin

    entries = select(AuditLog).where(
        AuditLog.entity_type == "import_mapping_template",
        AuditLog.entity_id == template_id,
    )
    last_by_system = session.scalar(
        select(func.max(AuditLog.occurred_at)).where(
            AuditLog.entity_type == "import_mapping_template",
            AuditLog.entity_id == template_id,
            AuditLog.origin == AuditOrigin.SYSTEM,
        )
    )
    by_a_person = entries.where(
        AuditLog.origin != AuditOrigin.SYSTEM,
        AuditLog.field.in_(("mapping", "header_signature")),
    )
    if last_by_system is not None:
        by_a_person = by_a_person.where(AuditLog.occurred_at > last_by_system)
    return session.scalar(by_a_person.limit(1)) is not None


#: Who updates the templates when the API starts, in the audit log.
STARTUP_ACTOR = "Plantillas de los formatos del museo"


def refresh_templates_on_startup(factory: Any) -> tuple[list[str], list[str]]:
    """Update the real templates when the API starts (revision with the museum files, 2026-11-21).

    Before, only ``python -m app.seed --templates`` did it, so an installation seeded before a
    template changed kept reading the files with the old mapping: in the revision, «Ubicación en
    inmueble» and the conservation values were not read. A missing template is created (an
    emptied test environment, change codigo-unico-y-ajustes-pantallas), and a template a person
    edited in Administración is left as it is. Returns ``(created or updated, kept)``."""
    from app.modules.audit.context import AuditContext, audit_context
    from app.modules.audit.models import AuditOrigin

    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label=STARTUP_ACTOR)
    kept: list[str] = []
    with factory() as session, audit_context(session, context):
        created, _retired = sync_predefined_templates(session)
        updated = refresh_predefined_templates(session, keep_edited=True, kept=kept)
        session.commit()
    return created + updated, kept
