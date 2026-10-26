"""CLI: ``python -m app.imports.purge_photos`` (importacion-masiva-fotografias, design D7).

Deletes the files of the batch photos past ``IMPORT_PHOTO_RETENTION_DAYS``: those of abandoned
batches and those discarded in a closed batch. The ``import_photo`` rows stay, with the purge in
their reason and in the audit. Safe to run again: a purged photo is not purged twice.
"""

import argparse
import sys

from app.core.config import ConfigurationError, load_settings
from app.core.db import make_engine, make_session_factory
from app.core.storage import ObjectStorage
from app.modules.imports.photo_purge import purge_photos


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.imports.purge_photos",
        description="Elimina los archivos de las fotos de lotes abandonados o descartadas",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo cuenta las fotos que se purgarían, sin eliminar nada.",
    )
    args = parser.parse_args(argv)

    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    days = settings.import_photo_retention_days
    storage = ObjectStorage.from_settings(settings)
    factory = make_session_factory(make_engine(settings.database_url))
    with factory() as session:
        result = purge_photos(session, storage, retention_days=days, dry_run=args.dry_run)
        session.commit()
    verb = "se purgarían" if args.dry_run else "purgadas"
    print(f"Fotos {verb} tras {days} días: {len(result.photos)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
