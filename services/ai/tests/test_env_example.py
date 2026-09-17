"""Spec plataforma — .env.example documenta toda variable que lee el servicio de IA."""

from pathlib import Path

from app.config import Settings

ENV_EXAMPLE = Path(__file__).resolve().parents[3] / ".env.example"


def test_every_setting_is_documented() -> None:
    text = ENV_EXAMPLE.read_text(encoding="utf-8")
    missing = [name.upper() for name in Settings.model_fields if f"{name.upper()}=" not in text]
    assert not missing, f"Variables sin documentar en .env.example: {missing}"
