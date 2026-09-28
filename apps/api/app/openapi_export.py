"""Export the OpenAPI contract without database, storage or containers (design D7; RNF-009).

Usage (from apps/api):
    python -m app.openapi_export            # writes ../../docs/api/openapi.json
    python -m app.openapi_export --check    # exit 1 if the committed file is outdated
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from app.core.config import load_settings

DEFAULT_OUTPUT = Path(__file__).resolve().parents[3] / "docs" / "api" / "openapi.json"

# Dummy, non-secret values: building the app never connects to the database or storage.
_EXPORT_SETTINGS = {
    "app_env": "development",
    "database_url": "sqlite://",
    "s3_endpoint_url": "http://storage.invalid:9000",
    "s3_access_key_id": "openapi-export",
    "s3_secret_access_key": "openapi-export-not-a-secret",
    "s3_bucket": "openapi-export",
    "jwt_secret": "openapi-export-not-a-secret",
    "app_version": "0.1.0",
}


def build_spec() -> dict[str, Any]:
    from app.main import create_app

    app = create_app(load_settings(**_EXPORT_SETTINGS), health_checks={})
    return app.openapi()


def render(spec: dict[str, Any]) -> str:
    return json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Exporta el contrato OpenAPI de la API MATP.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--check", action="store_true", help="Solo verifica que el archivo esté actualizado."
    )
    args = parser.parse_args(argv)
    content = render(build_spec())
    if args.check:
        current = args.output.read_text(encoding="utf-8") if args.output.exists() else ""
        if current != content:
            print(
                f"{args.output} está desactualizado. Ejecute: npm run openapi",
                file=sys.stderr,
            )
            return 1
        print(f"{args.output} está actualizado.")
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8", newline="\n")
    print(f"Contrato OpenAPI escrito en {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
