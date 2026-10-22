"""CLI: ``python -m app.quality.snapshot`` (``npm run kpis:snapshot``; design D5).

Replaces the completeness-KPI snapshot of a day (today UTC by default) with the current numbers.
Safe to run twice the same day: the second run replaces, never duplicates (spec calidad-datos,
escenario "Instantánea repetida").
"""

import argparse
import sys
from datetime import UTC, date, datetime

from app.core.config import ConfigurationError, load_settings
from app.core.db import make_engine, make_session_factory
from app.modules.quality.snapshot import replace_daily_snapshot


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.quality.snapshot",
        description="Instantánea diaria de los KPI de completitud",
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=None,
        help="Fecha a reemplazar (AAAA-MM-DD); por defecto, hoy en UTC.",
    )
    args = parser.parse_args(argv)
    taken_on = args.date or datetime.now(UTC).date()

    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    engine = make_engine(settings.database_url)
    factory = make_session_factory(engine)
    with factory() as session:
        rows = replace_daily_snapshot(session, taken_on)
        session.commit()
    print(f"Instantánea de {taken_on} reemplazada: {len(rows)} filas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
