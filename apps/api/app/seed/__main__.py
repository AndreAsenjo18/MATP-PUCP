"""CLI: ``python -m app.seed`` (``npm run seed`` runs it inside the api container).

Options:
  --pieces N            number of synthetic pieces (default SEED_PIECE_COUNT or 300)
  --random-seed N       random seed (default SEED_RANDOM_SEED or 20260917)
  --no-media-upload     do not upload placeholder photos to object storage
  --fixtures DIR        only write the synthetic Excel fixture into DIR and exit
"""

import argparse
import os
import sys
from pathlib import Path

from app.core.config import ConfigurationError, load_settings
from app.core.db import make_engine, make_session_factory
from app.core.storage import ObjectStorage
from app.seed.fixtures import write_synthetic_workbook
from app.seed.synthetic import SeedOptions, SeedRefused, run_seed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.seed", description="Datos semilla sintéticos"
    )
    parser.add_argument(
        "--pieces", type=int, default=int(os.environ.get("SEED_PIECE_COUNT", "300"))
    )
    parser.add_argument(
        "--random-seed", type=int, default=int(os.environ.get("SEED_RANDOM_SEED", "20260917"))
    )
    parser.add_argument("--no-media-upload", action="store_true")
    parser.add_argument("--fixtures", type=Path)
    args = parser.parse_args(argv)

    if args.fixtures:
        path = write_synthetic_workbook(args.fixtures, random_seed=args.random_seed)
        print(f"Excel sintético generado en {path}")
        return 0

    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    options = SeedOptions(
        random_seed=args.random_seed,
        piece_count=args.pieces,
        upload_media=not args.no_media_upload,
        admin_email=os.environ.get("SEED_ADMIN_EMAIL", "admin@matp.local"),
        admin_password=os.environ.get("SEED_ADMIN_PASSWORD") or None,
    )
    engine = make_engine(settings.database_url)
    factory = make_session_factory(engine)
    storage = ObjectStorage.from_settings(settings) if options.upload_media else None
    with factory() as session:
        try:
            summary = run_seed(session, options, storage)
        except SeedRefused as exc:
            print(exc, file=sys.stderr)
            return 1
        session.commit()
    print("Datos semilla sintéticos cargados:")
    for key, value in vars(summary).items():
        if key != "details":
            print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
