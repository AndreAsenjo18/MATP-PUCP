"""Check the museum's real Excel files against the import (change formatos-reales-importacion, D9).

Runs ingestion, template suggestion and mapping with normalization over every sheet of every
``.xlsx`` in a folder and prints counts per sheet: rows, skipped rows, the suggested template and
how many file columns it leaves unmapped, and identifiers by status per code column. With
``--examples`` it also prints up to five codes that could not be normalized per column; codes are
not personal data, and no other column is ever printed.

The real files are personal data of owners and live outside git (``data/real/``, ADR-019): this
script is not run in CI. It works on an in-memory database with the synthetic seed, so the
templates and parameters are those of a fresh installation.

    cd apps/api
    .venv/Scripts/python ../../scripts/check_real_excels.py ../../data/real [--examples]

(``.venv/bin/python`` on Linux/macOS.)
"""

import argparse
import sys
from collections import Counter, defaultdict
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1] / "apps" / "api"
sys.path.insert(0, str(API_DIR))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.db import make_session_factory  # noqa: E402
from app.models import Base  # noqa: E402
from app.modules.audit.context import AuditContext, audit_context  # noqa: E402
from app.modules.audit.models import AuditOrigin  # noqa: E402
from app.modules.identification.models import NormalizationStatus  # noqa: E402
from app.modules.imports.ingest import IngestionFailed, ingest, list_sheets  # noqa: E402
from app.modules.imports.mapping import (  # noqa: E402
    ColumnSpecV1,
    FieldTarget,
    IdentifiersTarget,
    IdentifierTarget,
    MappingContext,
    MappingSpecV1,
    apply_mapping,
)
from app.modules.imports.templates import header_key, suggest_templates  # noqa: E402
from app.seed.synthetic import SeedOptions, run_seed  # noqa: E402

DEFAULT_FOLDER = Path(__file__).resolve().parents[1] / "data" / "real"

#: Code columns of the two families (design D2), by ``header_key``: (default type, mixed cell).
CODE_COLUMNS: dict[str, tuple[str, bool]] = {
    header_key("N° Inventario MATP (I)"): ("I", True),
    header_key("Código de la colección"): ("COLECCION", True),
    header_key("N° Inscripción Registro Nacional"): ("INC_RN", True),
    header_key("Código de propietario (RN*)"): ("PROPIETARIO", False),
    header_key("Código de propietario"): ("PROPIETARIO", False),
    header_key("Código PUCP"): ("PUCP", False),
    header_key("Código  INC"): ("INC_RN", True),
    header_key("Otros códigos"): ("OTRO", True),
}
COLLECTION_COLUMNS = {header_key("Nombre de la Colección"), header_key("Colección")}
STATUSES = ("NORMALIZED", "ABSENT", "UNPARSEABLE")


def seeded_session():  # type: ignore[no-untyped-def]
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = make_session_factory(engine)()
    with audit_context(session, AuditContext(origin=AuditOrigin.SYSTEM, actor_label="check")):
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    return session


def column_spec(source: str, collection: str | None) -> MappingSpecV1:
    type_code, mixed = CODE_COLUMNS[header_key(source)]
    target = IdentifiersTarget(default_type=type_code) if mixed else IdentifierTarget(type=type_code)
    columns = [ColumnSpecV1(source=source, target=target)]
    if collection:
        columns.append(ColumnSpecV1(source=collection, target=FieldTarget(name="collection")))
    return MappingSpecV1(columns=columns)


def check_sheet(session, path: Path, content: bytes, sheet: str, examples: int, totals: Counter) -> None:  # type: ignore[no-untyped-def]
    try:
        result = ingest(content, path.name, sheet_name=sheet)
    except IngestionFailed as exc:
        print(f"  {sheet}: no se pudo leer ({exc.code})")
        return
    skipped_headers = getattr(result, "skipped_header_rows", 0)
    suggestions = suggest_templates(session, result.headers)
    best = suggestions[0] if suggestions else None
    template = f"{best.template.name} ({best.score:.0%})" if best else "ninguna"
    unmapped = f", {len(best.new_columns)} columnas sin mapear" if best else ""
    print(
        f"  {sheet}: {result.row_count} filas (encabezado en la fila {result.header_row}), "
        f"{result.skipped_empty_rows} vacías y {skipped_headers} con el encabezado repetido "
        f"omitidas; plantilla: {template}{unmapped}"
    )
    totals["rows"] += result.row_count
    collection = next((h for h in result.headers if header_key(h) in COLLECTION_COLUMNS), None)
    ctx = MappingContext(session)
    for source in result.headers:
        if header_key(source) not in CODE_COLUMNS:
            continue
        spec = column_spec(source, collection)
        counts: Counter[str] = Counter()
        samples: list[str] = []
        for row in result.rows:
            mapped = apply_mapping(row.raw_data, spec, ctx)
            for identifier in mapped.identifiers:
                status = "ABSENT" if identifier.is_absent else identifier.status.value
                counts[status] += 1
                if (
                    identifier.status is NormalizationStatus.UNPARSEABLE
                    and not identifier.is_absent
                    and len(samples) < examples
                    and identifier.original_value not in samples
                ):
                    samples.append(identifier.original_value)
        total = sum(counts.values())
        if total == 0:
            continue
        for status in STATUSES:
            totals[status] += counts[status]
        share = counts["UNPARSEABLE"] / total
        print(
            f"    {source!r}: {total} códigos — "
            + ", ".join(f"{status.lower()} {counts[status]}" for status in STATUSES)
            + f" ({share:.1%} no normalizables)"
        )
        if samples:
            print(f"      ejemplos: {samples}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("folder", nargs="?", type=Path, default=DEFAULT_FOLDER)
    parser.add_argument("--examples", action="store_true", help="hasta 5 códigos no normalizables")
    args = parser.parse_args()
    files = sorted(args.folder.rglob("*.xlsx"))
    if not files:
        print(f"No hay archivos .xlsx en {args.folder}.")
        return 1
    session = seeded_session()
    totals: Counter[str] = Counter()
    for path in files:
        print(path.relative_to(args.folder))
        content = path.read_bytes()
        for sheet in list_sheets(content):
            check_sheet(session, path, content, sheet, 5 if args.examples else 0, totals)
    codes = sum(totals[status] for status in STATUSES)
    print(
        f"\nTotal: {len(files)} archivos, {totals['rows']} filas, {codes} códigos — "
        + ", ".join(f"{status.lower()} {totals[status]}" for status in STATUSES)
        + f" ({totals['UNPARSEABLE'] / max(codes, 1):.1%} no normalizables)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
