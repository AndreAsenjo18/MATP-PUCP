"""Spec plataforma — .env.example documenta toda variable que lee la API (RNF-002)."""

from pathlib import Path

from app.core.config import Settings

ENV_EXAMPLE = Path(__file__).resolve().parents[3] / ".env.example"


def _documented_variables() -> set[str]:
    names: set[str] = set()
    for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip().lstrip("#").strip()
        if "=" in stripped and stripped.split("=", 1)[0].isupper():
            names.add(stripped.split("=", 1)[0])
    return names


def test_every_setting_is_documented() -> None:
    documented = _documented_variables()
    missing = [name.upper() for name in Settings.model_fields if name.upper() not in documented]
    assert not missing, f"Variables sin documentar en .env.example: {missing}"
