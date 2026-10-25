"""CLI: ``python -m app.reports.load_valuations <archivo.csv> [--apply]`` (design D6; RF-037).

Loads historical valuations from a CSV file with the columns ``codigo, monto, moneda, fecha,
fuente`` and optionally ``notas``. Without ``--apply`` it only validates and reports what it
would load (dry-run); with ``--apply`` it inserts the valid rows. Valuations are append-only: a
row already loaded is skipped, never replaced.
"""

import argparse
import sys
from pathlib import Path

from app.core.config import ConfigurationError, load_settings
from app.core.db import make_engine, make_session_factory
from app.modules.reports.valuations import load_valuations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.reports.load_valuations",
        description="Carga de valorizaciones históricas desde un CSV (por defecto, sin escribir)",
    )
    parser.add_argument("archivo", type=Path, help="CSV con codigo, monto, moneda, fecha, fuente.")
    parser.add_argument(
        "--apply", action="store_true", help="Registrar las filas válidas (sin esto, solo revisa)."
    )
    args = parser.parse_args(argv)

    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2
    try:
        content = args.archivo.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        print(f"No se pudo leer {args.archivo}: {exc}", file=sys.stderr)
        return 2

    factory = make_session_factory(make_engine(settings.database_url))
    with factory() as session:
        report = load_valuations(session, content, apply=args.apply, file_label=args.archivo.name)
        if args.apply:
            session.commit()
        else:
            session.rollback()

    for issue in report.issues:
        print(f"Fila {issue.row_number}: {issue.message}", file=sys.stderr)
    verb = "registradas" if args.apply else "por registrar (sin --apply no se escribió nada)"
    print(
        f"Filas válidas: {report.valid}. Ya cargadas antes: {report.already_loaded}. "
        f"Valorizaciones {verb}: "
        f"{report.inserted if args.apply else report.valid - report.already_loaded}. "
        f"Filas con errores: {len(report.issues)}."
    )
    return 1 if report.issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
