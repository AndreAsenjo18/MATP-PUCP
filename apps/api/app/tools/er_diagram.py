"""Genera el diagrama entidad-relación (PlantUML) desde ``Base.metadata``.

Uso (desde apps/api):
    python -m app.tools.er_diagram                        # escribe en stdout
    python -m app.tools.er_diagram --output ../../docs/diagramas/modelo-datos/er.puml
    python -m app.tools.er_diagram --check  ../../docs/diagramas/modelo-datos/er.puml
El diagrama se deriva del código, así nunca se desalinea de las migraciones.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects import postgresql

import app.models as m

Base = m.Base
_pg = postgresql.dialect()

DEFAULT_OUTPUT = (
    Path(__file__).resolve().parents[3] / "docs" / "diagramas" / "modelo-datos" / "er.puml"
)

# Columnas transversales que se colapsan en una sola línea para no saturar el diagrama.
BOILERPLATE = {"created_at", "updated_at", "deleted_at", "deleted_by_id", "deletion_reason"}

# Tablas de solo inserción (ADR-004, triggers en BD).
APPEND_ONLY = {"audit_log", "piece_movement", "piece_source_record", "conservation_assessment"}

# Agrupación por módulo funcional del SRS.
GROUPS = [
    (
        "Gestión de Colecciones y Piezas (EP-01)",
        "#FBEFE9",
        [
            "collection",
            "piece",
            "piece_identifier",
            "identifier_type",
            "piece_material",
            "conservation_assessment",
            "piece_source_record",
            "media_asset",
        ],
    ),
    ("Vocabularios controlados (RN-010)", "#F3EEF8", ["vocabulary", "term"]),
    ("Ubicación y Control (EP-02)", "#FDF6E3", ["location", "piece_movement"]),
    (
        "Importación y Calidad de Datos (EP-03)",
        "#EEF6EC",
        [
            "import_mapping_template",
            "import_batch",
            "import_row",
            "duplicate_candidate",
            "ai_suggestion",
        ],
    ),
    (
        "Usuarios, Seguridad y Auditoría (EP-05)",
        "#EDF0F7",
        ["app_user", "role", "permission", "role_permission", "user_role", "audit_log"],
    ),
]

# Etiquetas de relaciones (tabla_hija, columna) -> verbo.
LABELS = {
    ("collection", "parent_id"): "subcolección de",
    ("piece", "collection_id"): "contiene",
    ("piece", "parent_piece_id"): "conjunto / componente",
    ("piece", "merged_into_id"): "fusionada en",
    ("piece", "current_location_id"): "ubicación actual",
    ("piece", "category_term_id"): "categoría",
    ("piece", "object_type_term_id"): "tipo de bien",
    ("piece", "acquisition_method_term_id"): "forma de adquisición",
    ("piece", "conservation_status_term_id"): "estado de conservación",
    ("piece", "availability_term_id"): "disponibilidad",
    ("piece_identifier", "piece_id"): "posee códigos",
    ("piece_identifier", "identifier_type_code"): "tipifica",
    ("piece_identifier", "replaced_by_id"): "reemplazado por",
    ("piece_material", "piece_id"): "materiales",
    ("piece_material", "term_id"): "material",
    ("conservation_assessment", "piece_id"): "historial de estado",
    ("conservation_assessment", "status_term_id"): "estado",
    ("piece_source_record", "piece_id"): "datos de origen",
    ("piece_source_record", "import_batch_id"): "originado en",
    ("media_asset", "piece_id"): "fotografías",
    ("media_asset", "view_type_term_id"): "tipo de vista",
    ("media_asset", "usage_restriction_term_id"): "restricción de uso",
    ("term", "vocabulary_id"): "contiene",
    ("location", "parent_id"): "jerarquía espacial",
    ("piece_movement", "piece_id"): "movimientos",
    ("piece_movement", "from_location_id"): "origen",
    ("piece_movement", "to_location_id"): "destino",
    ("piece_movement", "performed_by_user_id"): "ejecuta",
    ("import_batch", "template_id"): "plantilla",
    ("import_batch", "uploaded_by_id"): "carga",
    ("import_batch", "approved_by_id"): "aprueba",
    ("import_row", "batch_id"): "filas / diffs",
    ("import_row", "target_piece_id"): "pieza objetivo",
    ("duplicate_candidate", "piece_a_id"): "pieza A",
    ("duplicate_candidate", "piece_b_id"): "pieza B",
    ("duplicate_candidate", "import_row_id"): "fila vs pieza",
    ("duplicate_candidate", "reviewed_by_id"): "resuelve",
    ("ai_suggestion", "piece_id"): "sugerencias",
    ("ai_suggestion", "import_batch_id"): "sobre lote",
    ("ai_suggestion", "reviewed_by_id"): "revisa",
    ("ai_suggestion", "requested_by_id"): "solicita",
    ("role_permission", "role_id"): "",
    ("role_permission", "permission_id"): "",
    ("user_role", "user_id"): "",
    ("user_role", "role_id"): "",
    ("audit_log", "user_id"): "autor del cambio",
    ("conservation_assessment", "assessed_by_user_id"): "evalúa",
}


def col_type(col) -> str:
    try:
        t = col.type.compile(dialect=_pg)
    except Exception:  # noqa: BLE001  # pragma: no cover
        t = str(col.type)
    t = t.lower()
    return t.replace("timestamp with time zone", "timestamptz").replace(
        "character varying", "varchar"
    )


def unique_cols(table) -> set[str]:
    out = set()
    for c in table.constraints:
        if isinstance(c, UniqueConstraint) and len(c.columns) == 1:
            out.add(next(iter(c.columns)).name)
    for ix in table.indexes:
        if ix.unique and len(ix.expressions) == 1 and hasattr(ix.expressions[0], "name"):
            out.add(ix.expressions[0].name)
    return out


def render() -> str:
    """Renderiza el diagrama ER en PlantUML a partir de ``Base.metadata``."""
    tables = Base.metadata.tables
    lines = [
        "@startuml MATP_ER",
        "' Generado automáticamente desde apps/api/app/models.py — no editar a mano.",
        "hide circle",
        "skinparam dpi 150",
        "skinparam linetype ortho",
        "skinparam nodesep 55",
        "skinparam ranksep 65",
        "skinparam shadowing false",
        "skinparam defaultFontSize 11",
        "skinparam ArrowColor #0C0F14",
        "skinparam class {\n"
        "  BorderColor #0C0F14\n"
        "  HeaderBackgroundColor #F5F0DA\n"
        "  BackgroundColor #FFFFFF\n"
        "}",
        "skinparam package {\n  BorderColor #5B534C\n  FontSize 13\n  FontStyle bold\n}",
        "",
    ]
    seen = set()
    for title, color, names in GROUPS:
        lines.append(f'package "{title}" {color} {{')
        for name in names:
            t = tables[name]
            seen.add(name)
            uqs = unique_cols(t)
            stereo = " <<solo inserción>>" if name in APPEND_ONLY else ""
            lines.append(f"entity {name.upper()}{stereo} {{")
            pk = [c for c in t.columns if c.primary_key]
            for c in pk:
                lines.append(f"  * {c.name} : {col_type(c)} <<PK>>")
            lines.append("  --")
            has_bp = False
            for c in t.columns:
                if c.primary_key:
                    continue
                if c.name in BOILERPLATE:
                    has_bp = True
                    continue
                tags = []
                if c.foreign_keys:
                    tags.append("FK")
                if c.name in uqs:
                    tags.append("UK")
                tag = f" <<{', '.join(tags)}>>" if tags else ""
                req = "* " if not c.nullable else "  "
                lines.append(f"  {req}{c.name} : {col_type(c)}{tag}")
            if has_bp:
                bp = [c for c in t.columns if c.name in BOILERPLATE]
                names_bp = {c.name for c in bp}
                parts = []
                if {"created_at", "updated_at"} & names_bp:
                    parts.append("timestamps")
                if "deleted_at" in names_bp:
                    parts.append("soft-delete")
                lines.append(f"  ..\n  <i>+ {' + '.join(parts)}</i>")
            lines.append("}")
        lines.append("}")
        lines.append("")
    missing = set(tables) - seen
    if missing:
        raise SystemExit(f"Tablas sin grupo asignado: {sorted(missing)}")

    # Relaciones
    for t in Base.metadata.sorted_tables:
        for c in t.columns:
            if c.name == "deleted_by_id":
                continue  # FK transversal a app_user, se omite para legibilidad
            for fk in c.foreign_keys:
                parent = fk.column.table.name
                left = "|o" if c.nullable else "||"
                label = LABELS.get((t.name, c.name), c.name)
                lbl = f' : "{label}"' if label else ""
                lines.append(f"{parent.upper()} {left}--o{{ {t.name.upper()}{lbl}")
    lines.append("")
    lines.append("""note as N1
  <b>Convenciones</b>
  * = obligatorio (NOT NULL) | PK/FK/UK = clave primaria/foránea/única
  <<solo inserción>> = triggers bloquean UPDATE/DELETE/TRUNCATE (ADR-004)
  soft-delete = deleted_at, deleted_by_id -> APP_USER, deletion_reason (RN-005)
  Enumerados: VARCHAR(40) + CHECK | Claves: UUIDv7
  Código I: fila de PIECE_IDENTIFIER (tipo I), único entre vigentes
  (índice parcial) y bloqueado al asignarse (RN-002)
end note""")
    lines.append("@enduml")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Genera el diagrama entidad-relación (PlantUML) desde los modelos SQLAlchemy."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Escribe el diagrama en la ruta indicada (por defecto, stdout).",
    )
    parser.add_argument(
        "--check",
        type=Path,
        metavar="RUTA",
        help="Sale con código 1 si el archivo existente difiere de lo generado.",
    )
    args = parser.parse_args(argv)
    content = render() + "\n"
    if args.check is not None:
        current = args.check.read_text(encoding="utf-8") if args.check.exists() else ""
        if current != content:
            print(
                f"{args.check} está desactualizado. Ejecute: npm run diagrams:er", file=sys.stderr
            )
            return 1
        print(f"{args.check} está actualizado.")
        return 0
    if args.output is None:
        sys.stdout.write(content)
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8", newline="\n")
    print(f"Diagrama ER escrito en {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
