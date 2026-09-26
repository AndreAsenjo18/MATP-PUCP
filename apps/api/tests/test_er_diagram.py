"""Pruebas del generador del diagrama entidad-relación (Parte 1, INSTRUCCIONES cap6-8)."""

from pathlib import Path

import pytest

from app.models import Base
from app.tools import er_diagram

REPO_ROOT = Path(__file__).resolve().parents[3]
ER_FILE = REPO_ROOT / "docs" / "diagramas" / "modelo-datos" / "er.puml"


def test_render_includes_every_table_as_entity() -> None:
    content = er_diagram.render()
    assert content.startswith("@startuml")
    assert content.rstrip().endswith("@enduml")
    for table_name in Base.metadata.tables:
        assert f"entity {table_name.upper()}" in content, f"falta la tabla {table_name}"


def test_render_fails_when_a_table_has_no_group(monkeypatch: pytest.MonkeyPatch) -> None:
    incomplete = er_diagram.GROUPS[:1] + [
        (title, color, names[:-1]) for title, color, names in er_diagram.GROUPS[1:]
    ]
    monkeypatch.setattr(er_diagram, "GROUPS", incomplete)
    with pytest.raises(SystemExit, match="sin grupo asignado"):
        er_diagram.render()


def test_committed_diagram_is_up_to_date() -> None:
    assert ER_FILE.exists(), f"falta {ER_FILE}; ejecute: npm run diagrams:er"
    assert ER_FILE.read_text(encoding="utf-8") == er_diagram.render() + "\n", (
        f"{ER_FILE} está desactualizado; ejecute: npm run diagrams:er"
    )
