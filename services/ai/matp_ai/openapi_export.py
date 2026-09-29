"""Export the AI service OpenAPI contract (design D7). From services/ai:

python -m matp_ai.openapi_export [--check]
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from matp_ai.config import load_settings

DEFAULT_OUTPUT = Path(__file__).resolve().parents[3] / "docs" / "api" / "ai-openapi.json"


def build_spec() -> dict[str, Any]:
    from matp_ai.main import create_app

    return create_app(load_settings(ai_provider="mock", app_version="0.1.0")).openapi()


def render(spec: dict[str, Any]) -> str:
    return json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Exporta el contrato OpenAPI del servicio IA.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    content = render(build_spec())
    if args.check:
        current = args.output.read_text(encoding="utf-8") if args.output.exists() else ""
        if current != content:
            print(f"{args.output} está desactualizado. Ejecute: npm run openapi", file=sys.stderr)
            return 1
        print(f"{args.output} está actualizado.")
        return 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content, encoding="utf-8", newline="\n")
    print(f"Contrato OpenAPI escrito en {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
