"""CLI: ``python -m app.seed.vocabularies <archivo.csv> [--apply]`` (``npm run vocabularies:load``).

Without ``--apply`` it only reports what it would do (design D4 of
colecciones-y-vocabularios-admin). With Docker: ``docker compose exec api python -m
app.seed.vocabularies <archivo.csv> --apply``.
"""

import argparse
import sys
from pathlib import Path

from app.core.config import ConfigurationError, load_settings
from app.core.db import make_engine, make_session_factory
from app.core.errors import DomainError
from app.seed.vocabularies import VocabularyFileError, file_reference, load_terms, parse_terms


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.seed.vocabularies",
        description="Precarga idempotente de términos de vocabularios desde un CSV",
    )
    parser.add_argument("file", type=Path, help="CSV con las columnas vocabulary_code, ...")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run", action="store_true", help="Solo informa (comportamiento por defecto)."
    )
    mode.add_argument("--apply", action="store_true", help="Escribe los cambios.")
    args = parser.parse_args(argv)

    try:
        content = args.file.read_bytes()
        rows = parse_terms(content.decode("utf-8-sig"))
    except (OSError, UnicodeDecodeError, VocabularyFileError) as exc:
        print(f"No se cargó nada: {exc}", file=sys.stderr)
        return 2
    try:
        settings = load_settings()
    except ConfigurationError as exc:
        print(exc, file=sys.stderr)
        return 2

    engine = make_engine(settings.database_url)
    factory = make_session_factory(engine)
    with factory() as session:
        try:
            report = load_terms(
                session, rows, apply=args.apply, source=file_reference(args.file.name, content)
            )
        except (VocabularyFileError, DomainError) as exc:
            session.rollback()
            print(f"No se cargó nada: {exc}", file=sys.stderr)
            return 2
        if args.apply:
            session.commit()
        else:
            session.rollback()
    print(report.summary())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
