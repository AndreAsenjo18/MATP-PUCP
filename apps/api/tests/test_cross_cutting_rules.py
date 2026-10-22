"""Spec auditoria-trazabilidad — Verificación automática de cobertura de soft-delete y auditoría.

Protege la regla «nunca se borra información» (RN-005, RNF-006, RF-040) mientras diez personas
agregan modelos en paralelo. Si esta prueba falla, el mensaje dice qué tabla o archivo corregir y
cómo; la salida fácil (agregar una excepción) exige motivo, célula responsable y revisión del
Arquitecto en `app/core/cross_cutting.py`.

Change `auditoria-y-soft-delete-transversal`, tarea 1.1.
"""

from pathlib import Path

import pytest
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

import app.models  # noqa: F401  — importarlo registra todas las tablas en Base.metadata
from app.core.cross_cutting import (
    APPEND_ONLY_TABLES,
    PHYSICAL_DELETE_EXCEPTIONS,
    SCOPE_SOFT_DELETE,
    TABLE_EXCEPTIONS,
    ModelFacts,
    append_only_mismatches,
    missing_audit_coverage,
    missing_delete_protection,
    model_facts,
    stale_exceptions,
    unjustified_physical_deletes,
)
from app.core.models_base import Base, SoftDeleteMixin

API_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = API_ROOT / "app"
MIGRATIONS_ROOT = API_ROOT / "alembic" / "versions"

MODELS = [mapper.class_ for mapper in Base.registry.mappers]
FACTS = model_facts(MODELS)
TABLES_BY_CLASS = {fact.class_name: fact.table for fact in FACTS}


def _report(findings: list) -> str:
    return "\n".join(f"  - {finding}" for finding in findings)


def test_every_model_supports_logical_deletion_or_is_append_only() -> None:
    findings = missing_delete_protection(FACTS)
    assert not findings, "Modelos sin protección contra borrado (RN-005):\n" + _report(findings)


def test_every_business_model_is_covered_by_the_audit_log() -> None:
    findings = missing_audit_coverage(FACTS)
    assert not findings, "Modelos fuera de la auditoría (RF-040):\n" + _report(findings)


def test_the_application_code_never_deletes_physically() -> None:
    findings = unjustified_physical_deletes(APP_ROOT, TABLES_BY_CLASS)
    assert not findings, "Borrados físicos sin justificar (RN-005):\n" + _report(findings)


def test_append_only_tables_match_their_models_and_triggers() -> None:
    findings = append_only_mismatches(FACTS, MIGRATIONS_ROOT)
    assert not findings, "Desajustes de solo inserción:\n" + _report(findings)


def test_exceptions_are_justified_and_not_stale() -> None:
    for table, exception in sorted(TABLE_EXCEPTIONS.items()):
        assert exception.scopes, f"{table}: la excepción no declara alcance"
        assert len(exception.reason.strip()) >= 40, (
            f"{table}: la justificación debe explicar por qué la tabla no necesita la garantía"
        )
        assert exception.owner.strip(), f"{table}: la excepción no dice qué célula responde"
    findings = stale_exceptions(FACTS)
    assert not findings, "Excepciones que sobran:\n" + _report(findings)


def test_physical_delete_exceptions_only_cover_tables_with_an_exception() -> None:
    """Autorizar un borrado físico exige antes justificar que la tabla no lleva borrado lógico."""
    for path, tables in sorted(PHYSICAL_DELETE_EXCEPTIONS.items()):
        assert (API_ROOT / path).exists(), f"{path}: el archivo autorizado ya no existe"
        for table in sorted(tables):
            exception = TABLE_EXCEPTIONS.get(table)
            assert exception is not None and SCOPE_SOFT_DELETE in exception.scopes, (
                f"{path} puede borrar {table}, pero {table} no figura en TABLE_EXCEPTIONS "
                "con alcance 'soft_delete'"
            )


# --------------------------------------------------------------------- la prueba se prueba
# Un modelo nuevo sin borrado lógico, como el que agregaría una célula por descuido.
class _FakeBase(DeclarativeBase):
    pass


class _LoanWithoutSoftDelete(_FakeBase):
    __tablename__ = "fake_loan"
    __append_only__ = False
    __audited__ = True

    id: Mapped[int] = mapped_column(primary_key=True)


class _JobWithoutAudit(_FakeBase):
    __tablename__ = "fake_job"
    __append_only__ = False
    __audited__ = False

    id: Mapped[int] = mapped_column(primary_key=True)


def test_detects_a_new_model_without_logical_deletion() -> None:
    facts = model_facts([_LoanWithoutSoftDelete])
    findings = missing_delete_protection(facts)
    assert len(findings) == 1
    assert "fake_loan" in findings[0].location
    assert "SoftDeleteMixin" in findings[0].message
    assert "__append_only__" in findings[0].message


def test_detects_a_new_model_outside_the_audit_log() -> None:
    findings = missing_audit_coverage(model_facts([_JobWithoutAudit]))
    assert len(findings) == 1
    assert "fake_job" in findings[0].location


def test_detects_a_physical_delete_in_new_code(tmp_path: Path) -> None:
    module = tmp_path / "app" / "modules" / "demo"
    module.mkdir(parents=True)
    (module / "service.py").write_text(
        "from sqlalchemy import delete\n"
        "from app.modules.catalog.models import Piece\n\n\n"
        "def purge(session):\n"
        "    session.execute(delete(Piece))\n"
        "    session.delete(Piece())\n",
        encoding="utf-8",
    )
    findings = unjustified_physical_deletes(tmp_path / "app", {"Piece": "piece"})
    assert len(findings) == 2, _report(findings)
    assert all(finding.location.startswith("app/modules/demo/service.py:") for finding in findings)
    assert "piece" in findings[0].message


def test_ignores_fastapi_delete_routes(tmp_path: Path) -> None:
    """`@router.delete(...)` declara una ruta HTTP, no borra datos."""
    module = tmp_path / "app" / "api"
    module.mkdir(parents=True)
    (module / "routes.py").write_text(
        '@router.delete("/pieces/{piece_id}")\ndef soft_delete_piece(piece_id):\n    return None\n',
        encoding="utf-8",
    )
    assert not unjustified_physical_deletes(tmp_path / "app", {})


def test_detects_an_append_only_table_without_its_trigger(tmp_path: Path) -> None:
    facts = [
        ModelFacts(
            table=next(iter(APPEND_ONLY_TABLES)),
            class_name="Whatever",
            has_soft_delete=False,
            append_only=True,
            audited=False,
        )
    ]
    findings = append_only_mismatches(facts, tmp_path)
    kinds = {finding.kind for finding in findings}
    assert "append_only_trigger" in kinds


@pytest.mark.parametrize("table", sorted(APPEND_ONLY_TABLES))
def test_append_only_models_do_not_also_have_soft_delete(table: str) -> None:
    """Una tabla de solo inserción no puede tener columnas de borrado lógico: son excluyentes."""
    model = next(
        mapper.class_ for mapper in Base.registry.mappers if mapper.class_.__tablename__ == table
    )
    assert not issubclass(model, SoftDeleteMixin), (
        f"{model.__name__} es de solo inserción y además tiene SoftDeleteMixin: elija una"
    )
