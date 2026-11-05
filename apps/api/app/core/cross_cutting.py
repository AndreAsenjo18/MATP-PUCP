"""Reglas transversales de «nunca se borra información» (RN-005, RNF-006, RF-040).

Con diez personas agregando modelos en paralelo, la regla se degrada en silencio si nadie la
verifica. Este módulo concentra:

1. las tablas de **solo inserción** (sin UPDATE ni DELETE, con disparador en la base);
2. las **excepciones justificadas** a borrado lógico y a cobertura de auditoría;
3. los **borrados físicos autorizados** (archivo y tablas), y
4. las funciones que recorren modelos, código y migraciones para detectar infracciones.

`tests/test_cross_cutting_rules.py` ejecuta estas funciones en cada `npm run test:api` y en CI.
**Agregar una excepción exige revisión del Arquitecto** (ver `CODEOWNERS`): toda entrada necesita
motivo, célula responsable y, si es deuda, qué falta para quitarla.

Change `auditoria-y-soft-delete-transversal`, tarea 1.1 (design D3).
"""

import ast
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass, field
from pathlib import Path

#: Tablas de solo inserción. Debe coincidir con `__append_only__` en los modelos y con los
#: disparadores que crean las migraciones (`APPEND_ONLY_TABLES` en `alembic/versions/`).
APPEND_ONLY_TABLES: frozenset[str] = frozenset(
    {
        "audit_log",
        "piece_movement",
        "piece_source_record",
        "conservation_assessment",
        "audit_digest",
        # Autenticación (ADR-009): trazas de seguridad que nadie debe poder reescribir.
        "auth_event",
        "sensitive_access_log",
        # Valorizaciones históricas (reportes-inventario D6): una nueva nunca reemplaza otra.
        "piece_valuation",
    }
)

SCOPE_SOFT_DELETE = "soft_delete"
SCOPE_AUDIT = "audit"


@dataclass(frozen=True)
class TableException:
    """Excepción explícita y justificada para una tabla (RNF-006: solo por lista)."""

    table: str
    scopes: frozenset[str]
    #: Por qué la tabla no necesita la garantía. Obligatorio y revisado por el Arquitecto.
    reason: str
    #: Célula que responde por la tabla (`docs/ownership.md`).
    owner: str
    #: Qué falta para retirar la excepción. `None` = excepción definitiva, no deuda.
    follow_up: str | None = None


def _exception(
    table: str, *, scopes: Sequence[str], reason: str, owner: str, follow_up: str | None = None
) -> TableException:
    return TableException(
        table=table, scopes=frozenset(scopes), reason=reason, owner=owner, follow_up=follow_up
    )


#: Excepciones vigentes al 2026-10-20. Las que tienen `follow_up` son **deuda registrada**:
#: están en `docs/preguntas-contraparte.md` y las retira la célula dueña, no esta lista.
TABLE_EXCEPTIONS: dict[str, TableException] = {
    exception.table: exception
    for exception in (
        _exception(
            "permission",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Catálogo técnico de permisos sembrado por el sistema: no contiene datos del "
                "museo y sus filas no se retiran, se deja de asignar el permiso en role_permission "
                "(que sí tiene borrado lógico)."
            ),
            owner="Plataforma",
        ),
        _exception(
            "import_row",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Filas de trabajo de un lote de importación: se regeneran al volver a mapear o "
                "validar el lote y se conservan con él porque import_batch sí tiene borrado "
                "lógico. Lo que entra al catálogo queda en piece_source_record, de solo inserción."
            ),
            owner="Importación",
        ),
        _exception(
            "duplicate_candidate",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Cola de revisión derivada: se recalcula para cada lote y cada decisión humana "
                "queda en la auditoría. Ningún dato del museo vive solo aquí."
            ),
            owner="Importación",
        ),
        _exception(
            "quality_job",
            scopes=[SCOPE_SOFT_DELETE, SCOPE_AUDIT],
            reason=(
                "Estado técnico de un trabajo en segundo plano (progreso y latido). No es "
                "información del museo y auditar cada latido inundaría audit_log; el resultado "
                "del trabajo sí se audita."
            ),
            owner="Importación",
        ),
        _exception(
            "quality_job_item",
            scopes=[SCOPE_SOFT_DELETE, SCOPE_AUDIT],
            reason=(
                "Avance por elemento del trabajo en segundo plano; mismo motivo que quality_job."
            ),
            owner="Importación",
        ),
        _exception(
            "idempotency_key",
            scopes=[SCOPE_SOFT_DELETE, SCOPE_AUDIT],
            reason=(
                "Respuesta guardada de un lote para que un reintento no lo repita: "
                "infraestructura de transporte, no un hecho del museo. Lo que el lote cambia sí "
                "queda en piece_movement (solo inserción) y en audit_log; esta fila se limpia "
                "periódicamente."
            ),
            owner="Ubicaciones",
        ),
        _exception(
            "export_job",
            scopes=[SCOPE_SOFT_DELETE, SCOPE_AUDIT],
            reason=(
                "Estado técnico de una exportación en segundo plano (progreso, latido, "
                "vencimiento): auditar cada latido inundaría audit_log. La petición de "
                "exportar sí queda auditada con origen EXPORT y el archivo generado vive "
                "en el almacenamiento de objetos, que lo retira por vencimiento."
            ),
            owner="Búsqueda y exportación",
        ),
        _exception(
            "import_image",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Imagen incrustada en un Excel a la espera de asociarse a una pieza: se regenera "
                "al volver a validar el lote, igual que import_row. La foto ya asociada vive en "
                "media_asset, que sí tiene borrado lógico, y el archivo original queda en el "
                "almacenamiento de objetos."
            ),
            owner="Importación",
        ),
        _exception(
            "import_photo",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Foto de trabajo de un lote de importación, igual que import_row e import_image: "
                "su fila nunca se borra (descartarla es un estado y la purga de lotes abandonados "
                "solo elimina sus archivos). Al aplicar el lote la foto pasa a media_asset, que sí "
                "tiene borrado lógico (importacion-masiva-fotografias, D1 y D7)."
            ),
            owner="Importación",
        ),
        _exception(
            "quality_setting",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Parámetros de calidad: hoy se actualizan en sitio y cada cambio queda auditado, "
                "pero desactivar un parámetro borra su fila."
            ),
            owner="Importación",
            follow_up=(
                "Añadir SoftDeleteMixin a quality_setting cuando "
                "deteccion-duplicados-y-cola-revision cierre su tarea de parámetros (pregunta N1)."
            ),
        ),
        _exception(
            "ai_suggestion",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Propuesta de IA pendiente de aprobación humana (RN-009): cambia de estado, nunca "
                "se borra y su aprobación o rechazo queda auditado."
            ),
            owner="IA",
            follow_up=(
                "Confirmar con la célula de IA si descartar una sugerencia debe ser borrado "
                "lógico con motivo en lugar de un estado REJECTED (pregunta N2)."
            ),
        ),
        _exception(
            "completeness_rule",
            scopes=[SCOPE_SOFT_DELETE],
            reason=(
                "Parámetro de qué campos cuentan para las alertas de completitud: una regla "
                "retirada se desactiva con is_active y su fila nunca se borra; cada cambio queda "
                "auditado (alertas-y-reporte-incompletas, D2)."
            ),
            owner="Consulta y control",
        ),
        _exception(
            "completeness_snapshot",
            scopes=[SCOPE_SOFT_DELETE, SCOPE_AUDIT],
            reason=(
                "Instantánea diaria derivada de los KPI de completitud: se recalcula desde el "
                "catálogo y la de un mismo día reemplaza a la anterior (idempotente). No contiene "
                "datos del museo que no estén en piece (alertas-y-reporte-incompletas, D5)."
            ),
            owner="Consulta y control",
        ),
    )
}

#: Borrados físicos autorizados: ruta relativa a `apps/api` → tablas que ese archivo puede borrar.
#: Solo se admiten tablas con excepción de borrado lógico; la prueba lo verifica.
PHYSICAL_DELETE_EXCEPTIONS: dict[str, frozenset[str]] = {
    "app/modules/imports/service.py": frozenset(
        {"import_row", "duplicate_candidate", "import_image"}
    ),
    "app/modules/imports/images.py": frozenset({"import_image"}),
    "app/modules/imports/classify.py": frozenset({"duplicate_candidate"}),
    "app/modules/quality/snapshot.py": frozenset({"completeness_snapshot"}),
}

#: Nombres que no son borrado de datos aunque la llamada se llame `delete`.
_DELETE_CALL_SAFE_RECEIVERS = frozenset({"router", "app", "client", "storage", "bucket", "cache"})


@dataclass(frozen=True)
class Finding:
    """Infracción encontrada, con la ubicación exacta para poder corregirla."""

    kind: str
    location: str
    message: str

    def __str__(self) -> str:
        return f"{self.location}: {self.message}"


@dataclass
class ModelFacts:
    """Lo que la verificación necesita saber de un modelo, sin depender de SQLAlchemy."""

    table: str
    class_name: str
    has_soft_delete: bool
    append_only: bool
    audited: bool
    excluded_scopes: frozenset[str] = field(default_factory=frozenset)


def model_facts(models: Iterable[type]) -> list[ModelFacts]:
    """Traduce modelos declarativos a hechos verificables (evita importar aquí los modelos)."""
    from app.core.models_base import SoftDeleteMixin

    facts: list[ModelFacts] = []
    for model in models:
        table = str(model.__tablename__)  # type: ignore[attr-defined]
        exception = TABLE_EXCEPTIONS.get(table)
        facts.append(
            ModelFacts(
                table=table,
                class_name=model.__name__,
                has_soft_delete=issubclass(model, SoftDeleteMixin),
                append_only=bool(getattr(model, "__append_only__", False)),
                audited=bool(getattr(model, "__audited__", True)),
                excluded_scopes=exception.scopes if exception else frozenset(),
            )
        )
    return sorted(facts, key=lambda fact: fact.table)


def missing_delete_protection(facts: Iterable[ModelFacts]) -> list[Finding]:
    """Modelos que no admiten borrado lógico ni son de solo inserción (RN-005)."""
    findings: list[Finding] = []
    for fact in facts:
        if fact.has_soft_delete or fact.append_only:
            continue
        if SCOPE_SOFT_DELETE in fact.excluded_scopes:
            continue
        findings.append(
            Finding(
                kind="delete_protection",
                location=f"{fact.class_name} ({fact.table})",
                message=(
                    "no admite eliminación lógica ni es de solo inserción. Corríjalo de una de "
                    "estas dos formas: heredar de SoftDeleteMixin, o declarar "
                    "__append_only__ = True y crear su disparador en la migración. Si de verdad "
                    "no aplica, agregue la tabla a TABLE_EXCEPTIONS con motivo y célula "
                    "responsable (revisa el Arquitecto)."
                ),
            )
        )
    return findings


def missing_audit_coverage(facts: Iterable[ModelFacts]) -> list[Finding]:
    """Modelos de negocio fuera del seguimiento de auditoría campo a campo (RF-040)."""
    findings: list[Finding] = []
    for fact in facts:
        if fact.audited or fact.append_only:
            continue
        if SCOPE_AUDIT in fact.excluded_scopes:
            continue
        findings.append(
            Finding(
                kind="audit_coverage",
                location=f"{fact.class_name} ({fact.table})",
                message=(
                    "tiene __audited__ = False sin ser de solo inserción: sus cambios no quedan "
                    "en audit_log. Quite el __audited__ = False o agregue la tabla a "
                    "TABLE_EXCEPTIONS con el alcance 'audit' y su motivo."
                ),
            )
        )
    return findings


def stale_exceptions(facts: Iterable[ModelFacts]) -> list[Finding]:
    """Excepciones que ya no hacen falta o que apuntan a tablas inexistentes."""
    by_table = {fact.table: fact for fact in facts}
    findings: list[Finding] = []
    for table, exception in sorted(TABLE_EXCEPTIONS.items()):
        fact = by_table.get(table)
        if fact is None:
            findings.append(
                Finding(
                    kind="stale_exception",
                    location=f"TABLE_EXCEPTIONS[{table!r}]",
                    message="la tabla ya no existe: quite la excepción.",
                )
            )
            continue
        if SCOPE_SOFT_DELETE in exception.scopes and (fact.has_soft_delete or fact.append_only):
            findings.append(
                Finding(
                    kind="stale_exception",
                    location=f"TABLE_EXCEPTIONS[{table!r}]",
                    message=(
                        "la tabla ya tiene borrado lógico o es de solo inserción: quite el "
                        "alcance 'soft_delete' de la excepción."
                    ),
                )
            )
        if SCOPE_AUDIT in exception.scopes and fact.audited:
            findings.append(
                Finding(
                    kind="stale_exception",
                    location=f"TABLE_EXCEPTIONS[{table!r}]",
                    message="la tabla ya está auditada: quite el alcance 'audit' de la excepción.",
                )
            )
    return findings


def _python_files(root: Path) -> Iterator[Path]:
    for path in sorted(root.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        yield path


def _argument_table(node: ast.expr, tables_by_class: dict[str, str]) -> str:
    """Tabla a la que apunta el argumento de un borrado: `Piece`, `models.Piece` o `Piece()`."""
    if isinstance(node, ast.Call):
        return _argument_table(node.func, tables_by_class)
    if isinstance(node, ast.Name):
        return tables_by_class.get(node.id, f"<{node.id}>")
    if isinstance(node, ast.Attribute):
        return tables_by_class.get(node.attr, f"<{node.attr}>")
    return "<desconocida>"


def _deleted_table(node: ast.Call, tables_by_class: dict[str, str]) -> str | None:
    """Tabla que borra físicamente una llamada, o None si la llamada no es un borrado."""
    func = node.func
    # sqlalchemy.delete(Model) / sa.delete(Model)
    if (isinstance(func, ast.Name) and func.id == "delete") or (
        isinstance(func, ast.Attribute) and func.attr == "delete" and node.args
    ):
        if isinstance(func, ast.Attribute):
            receiver = func.value
            if isinstance(receiver, ast.Name) and receiver.id in _DELETE_CALL_SAFE_RECEIVERS:
                return None
        if node.args:
            return _argument_table(node.args[0], tables_by_class)
    # session.delete(obj) sin argumentos reconocibles, o query.delete()
    if isinstance(func, ast.Attribute) and func.attr == "delete" and not node.args:
        receiver = func.value
        if isinstance(receiver, ast.Name) and receiver.id in _DELETE_CALL_SAFE_RECEIVERS:
            return None
        return "<desconocida>"
    return None


def unjustified_physical_deletes(app_root: Path, tables_by_class: dict[str, str]) -> list[Finding]:
    """Borrados físicos en el código de la aplicación que no están autorizados (RN-005)."""
    findings: list[Finding] = []
    for path in _python_files(app_root):
        relative = path.relative_to(app_root.parent).as_posix()
        allowed = PHYSICAL_DELETE_EXCEPTIONS.get(relative, frozenset())
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            table = _deleted_table(node, tables_by_class)
            if table is None or table in allowed:
                continue
            findings.append(
                Finding(
                    kind="physical_delete",
                    location=f"{relative}:{node.lineno}",
                    message=(
                        f"borrado físico sobre {table}. Use eliminación lógica con motivo "
                        "(RN-005) o declare el archivo y la tabla en "
                        "PHYSICAL_DELETE_EXCEPTIONS con su justificación."
                    ),
                )
            )
    return sorted(findings, key=lambda finding: finding.location)


def migration_append_only_tables(migrations_root: Path) -> set[str]:
    """Tablas que las migraciones protegen con disparadores de solo inserción."""
    tables: set[str] = set()
    for path in _python_files(migrations_root):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Assign):
                continue
            names = {target.id for target in node.targets if isinstance(target, ast.Name)}
            if "APPEND_ONLY_TABLES" not in names:
                continue
            try:
                value = ast.literal_eval(node.value)
            except ValueError:
                continue
            if isinstance(value, str):
                tables.add(value)
            elif isinstance(value, list | tuple | set | frozenset):
                tables.update(str(item) for item in value)
    return tables


def append_only_mismatches(facts: Iterable[ModelFacts], migrations_root: Path) -> list[Finding]:
    """Desajustes entre los modelos de solo inserción, esta lista y los disparadores."""
    declared = {fact.table for fact in facts if fact.append_only}
    protected = migration_append_only_tables(migrations_root)
    findings: list[Finding] = []
    for table in sorted(declared - APPEND_ONLY_TABLES):
        findings.append(
            Finding(
                kind="append_only_list",
                location=table,
                message=(
                    "el modelo declara __append_only__ pero la tabla no está en "
                    "APPEND_ONLY_TABLES de app/core/cross_cutting.py."
                ),
            )
        )
    for table in sorted(APPEND_ONLY_TABLES - declared):
        findings.append(
            Finding(
                kind="append_only_list",
                location=table,
                message="está en APPEND_ONLY_TABLES pero ningún modelo declara __append_only__.",
            )
        )
    for table in sorted(declared - protected):
        findings.append(
            Finding(
                kind="append_only_trigger",
                location=table,
                message=(
                    "es de solo inserción pero ninguna migración crea su disparador: agréguela a "
                    "APPEND_ONLY_TABLES de la migración que crea la tabla."
                ),
            )
        )
    return findings
