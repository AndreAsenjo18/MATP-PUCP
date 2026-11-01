"""CLI: ``python -m app.media.rebuild_derivatives`` (fotografias-multiples-por-pieza 2.3).

Regenerates the thumbnail and display copy of the photos whose derivatives failed or are missing
in the storage. ``--only-failed`` skips the check of the storage; ``--dry-run`` only counts.
"""

import argparse
import sys

from app.core.config import ConfigurationError, load_settings
from app.core.db import make_engine, make_session_factory
from app.core.storage import ObjectStorage
from app.modules.media.derivatives import rebuild_derivatives


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.media.rebuild_derivatives",
        description="Regenera los derivados faltantes o fallidos de las fotos",
    )
    parser.add_argument(
        "--only-failed",
        action="store_true",
        help="Solo las fotos marcadas con derivados fallidos, sin revisar el almacenamiento.",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Solo cuenta las fotos, sin regenerar nada."
    )
    args = parser.parse_args(argv)

    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    storage = ObjectStorage.from_settings(settings)
    factory = make_session_factory(make_engine(settings.database_url))
    with factory() as session:
        result = rebuild_derivatives(
            session, storage, only_failed=args.only_failed, dry_run=args.dry_run
        )
        session.commit()
    if args.dry_run:
        print(f"Fotos con derivados por regenerar: {len(result.rebuilt)}.")
        return 0
    print(f"Derivados regenerados: {len(result.rebuilt)}; fallidos: {len(result.failed)}.")
    return 0 if not result.failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
