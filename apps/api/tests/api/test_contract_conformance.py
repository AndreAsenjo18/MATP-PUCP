"""Spec plataforma — Conformidad con el contrato de interfaces del equipo (RNF-009).

Compara `docs/fuentes/endpoints-api-v1.yaml` (fuente de verdad de las interfaces, change
`alinear-api-endpoints-v1`) con la especificación que genera la aplicación.

La alineación está en curso: `PENDIENTES` y `PENDIENTES_OPERATION_ID` congelan las diferencias
conocidas hoy y `ANADIDOS` las operaciones propias justificadas en `docs/api/mapeo-endpoints-v1.md`.
Las pruebas fallan ante cualquier diferencia **nueva** y también cuando una diferencia ya resuelta
sigue en la lista, para que las listas se vacíen a medida que avanzan las tareas del change.
"""

import json
import re
from pathlib import Path

import pytest
import yaml

from app.openapi_export import build_spec

REPO_ROOT = Path(__file__).resolve().parents[4]
CONTRACT = REPO_ROOT / "docs" / "fuentes" / "endpoints-api-v1.yaml"
MAPPING_DOC = "docs/api/mapeo-endpoints-v1.md"
PREFIX = "/api/v1"

# --- Diferencias congeladas ------------------------------------------------------------------
# Operaciones del documento que la API todavía no expone. Vacía desde la tarea 5.2: las de la
# fase 3 son stubs que citan `prestamos-y-exposiciones` y
# `descargas-masivas-y-enriquecimiento-lote`.
PENDIENTES: set[tuple[str, str]] = set()

# `GET /public/catalog` queda fuera de PENDIENTES a propósito: el conflicto C2 del mapeo
# (catálogo público sin autenticación frente a "solo uso interno en fase 1", RF-042) debe
# resolverse antes de exponerlo, así que esta prueba no lo exige.
BLOQUEADAS: set[tuple[str, str]] = {("get", "/public/catalog")}

# Operaciones que coinciden en ruta y verbo, pero cuyo identificador aún no es el del documento.
# Vacía desde la tarea 1.4: `operation_id()` convierte el nombre del handler a camelCase.
PENDIENTES_OPERATION_ID: set[tuple[str, str]] = set()

# Campos propios que extienden un esquema sin cambiar rutas ni `operationId`, justificados en el
# mapeo (`ficha-pieza-crud` 5.2): la versión de la ficha (D2), el motivo y el documento del cambio
# de régimen (D4) y la confirmación de un valor concatenado con su original (D5).
CAMPOS_ANADIDOS: set[tuple[str, str]] = {
    ("PieceDetail", "version"),
    ("PieceUpdate", "tenure_change_reason"),
    ("PieceUpdate", "supporting_document_ref"),
    ("IdentifierCreate", "confirmed_split"),
    ("IdentifierCreate", "split_from"),
}

# Operaciones propias que el documento no contempla, justificadas en el mapeo.
ANADIDOS: set[tuple[str, str]] = {
    ("get", "/ai/suggestions"),
    ("get", "/ai/suggestions/{}"),
    ("post", "/ai/suggestions/{}/approve"),
    ("post", "/ai/suggestions/{}/reject"),
    ("get", "/audit/sensitive-access"),
    ("post", "/audit/change-sets/{}/revert"),
    ("get", "/audit/change-sets/{}"),
    ("post", "/audit/change-sets/{}/revert-preview"),
    ("post", "/auth/change-password"),
    ("post", "/auth/logout"),
    ("delete", "/collections/{}"),
    ("get", "/collections/{}"),
    ("patch", "/collections/{}"),
    ("get", "/exports/full"),
    ("get", "/exports/jobs"),
    ("get", "/exports/jobs/{}"),
    ("get", "/exports/jobs/{}/download-url"),
    ("get", "/identifier-types"),
    ("post", "/identifier-types"),
    ("patch", "/identifier-types/{}"),
    # Vista previa del cambio de regla (change colecciones-y-vocabularios-admin, diseño D2).
    ("post", "/identifier-types/{}/normalization-preview"),
    ("post", "/identifiers/normalize"),
    ("get", "/import-templates"),
    ("post", "/import-templates"),
    # Plantillas por id (change plantillas-mapeo-y-normalizacion, tarea 3.1).
    ("get", "/import-templates/{}"),
    ("patch", "/import-templates/{}"),
    ("delete", "/import-templates/{}"),
    # Sugerencia por cabeceras (change plantillas-mapeo-y-normalizacion, tarea 3.2).
    ("post", "/import-templates/suggest"),
    # Vista previa de normalización por columna (change plantillas-mapeo-y-normalizacion, 3.3).
    ("post", "/import-templates/{}/dry-run"),
    # Parámetros de normalización y alias de siglas (change plantillas-mapeo-y-normalizacion, 2.3).
    ("get", "/normalization-settings/{}"),
    ("put", "/normalization-settings/{}"),
    ("get", "/collection-acronym-aliases"),
    ("post", "/collection-acronym-aliases"),
    ("delete", "/collection-acronym-aliases/{}"),
    ("get", "/imports/{}"),
    ("post", "/imports/{}/images/{}/associate"),
    ("get", "/imports/{}/log"),
    # Fotos del lote (change importacion-masiva-fotografias, diseño D2).
    ("post", "/imports/{}/photos/complete"),
    ("get", "/imports/{}/photos"),
    ("get", "/imports/{}/photos/summary"),
    ("patch", "/imports/{}/photos"),
    ("post", "/imports/{}/photos/upload-urls"),
    ("put", "/imports/{}/mapping"),
    ("patch", "/imports/{}/rows/{}"),
    ("post", "/imports/{}/validate"),
    ("get", "/locations"),
    ("get", "/locations/{}"),
    ("post", "/movements/batch"),
    ("get", "/permissions"),
    ("post", "/pieces/validate"),
    ("get", "/pieces/{}/alerts"),
    ("get", "/pieces/{}/identifiers"),
    ("post", "/pieces/{}/identifiers/{}/correction"),
    ("get", "/pieces/{}/media"),
    ("post", "/pieces/{}/media"),
    ("post", "/pieces/{}/media/upload-url"),
    ("delete", "/pieces/{}/media/{}"),
    ("patch", "/pieces/{}/media/{}"),
    ("put", "/pieces/{}/media/order"),
    ("get", "/pieces/{}/media/{}/download-url"),
    ("get", "/pieces/media/storage-estimate"),
    ("post", "/pieces/{}/restore"),
    # Historial de conservación (change colecciones-y-vocabularios-admin, diseño D3).
    ("get", "/pieces/{}/conservation-assessments"),
    ("post", "/pieces/{}/conservation-assessments"),
    ("get", "/pieces/{}/source-records"),
    ("get", "/quality/completeness-rules"),
    ("put", "/quality/completeness-rules"),
    ("get", "/quality/duplicates"),
    ("post", "/quality/duplicates/{}/resolve"),
    ("post", "/quality/duplicates/scan"),
    ("get", "/quality/incomplete"),
    ("get", "/quality/jobs/{}"),
    ("get", "/reports/dashboard-stats/history"),
    ("get", "/reports/{}"),
    ("get", "/roles"),
    ("put", "/roles/{}/permissions"),
    # Papelera (change auditoria-y-soft-delete-transversal, diseño D2).
    ("get", "/trash"),
    ("post", "/trash/{}/{}/restore"),
    ("get", "/users/{}"),
    ("patch", "/users/{}"),
    ("get", "/vocabularies"),
    ("post", "/vocabularies"),
    ("get", "/vocabularies/{}"),
    ("get", "/vocabularies/{}/terms"),
    ("post", "/vocabularies/{}/terms"),
    ("delete", "/vocabularies/{}/terms/{}"),
    ("patch", "/vocabularies/{}/terms/{}"),
}


def _normalize(path: str) -> str:
    """Los nombres de los parámetros de ruta no forman parte del contrato: `{id}` ≡ `{piece_id}`."""
    return re.sub(r"\{[^}]+\}", "{}", path)


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(word.capitalize() for word in rest)


@pytest.fixture(scope="module")
def contract() -> dict[tuple[str, str], str]:
    document = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return {
        (method, _normalize(path)): operation["operationId"]
        for path, operations in document["paths"].items()
        for method, operation in operations.items()
    }


@pytest.fixture(scope="module")
def implemented() -> dict[tuple[str, str], str]:
    spec = build_spec()
    return {
        (method, _normalize(path[len(PREFIX) :])): operation["operationId"]
        for path, operations in spec["paths"].items()
        if path.startswith(PREFIX)
        for method, operation in operations.items()
    }


def _format(operations: set[tuple[str, str]]) -> str:
    return ", ".join(f"{method.upper()} {path}" for method, path in sorted(operations))


def test_contract_document_is_parseable(contract: dict[tuple[str, str], str]) -> None:
    assert len(contract) == 45, "El documento de interfaces cambió: revise el mapeo y las listas."


def test_every_documented_operation_exists_or_is_a_known_gap(
    contract: dict[tuple[str, str], str], implemented: dict[tuple[str, str], str]
) -> None:
    missing = {key for key in contract if key not in implemented}
    unexpected = missing - PENDIENTES - BLOQUEADAS
    assert not unexpected, (
        "Operaciones del documento de interfaces que la API no expone y que no estaban "
        f"registradas como pendientes: {_format(unexpected)}. Impleméntelas o justifíquelas "
        f"en {MAPPING_DOC}."
    )


def test_resolved_gaps_are_removed_from_the_pending_list(
    contract: dict[tuple[str, str], str], implemented: dict[tuple[str, str], str]
) -> None:
    resolved = {key for key in PENDIENTES if key in implemented}
    assert not resolved, (
        f"Estas operaciones ya existen: elimínelas de PENDIENTES y marque su tarea en "
        f"openspec/changes/alinear-api-endpoints-v1/tasks.md: {_format(resolved)}"
    )
    obsolete = PENDIENTES - set(contract)
    assert not obsolete, (
        f"PENDIENTES cita operaciones que el documento no tiene: {_format(obsolete)}"
    )


def test_operation_ids_match_the_contract(
    contract: dict[tuple[str, str], str], implemented: dict[tuple[str, str], str]
) -> None:
    divergent = {
        key
        for key, operation_id in contract.items()
        if key in implemented and _camel(implemented[key]) != operation_id
    }
    unexpected = divergent - PENDIENTES_OPERATION_ID
    assert not unexpected, (
        "Identificadores de operación distintos a los del documento: "
        + ", ".join(
            f"{method.upper()} {path} (documento: {contract[(method, path)]}, "
            f"API: {implemented[(method, path)]})"
            for method, path in sorted(unexpected)
        )
    )
    resolved = PENDIENTES_OPERATION_ID - divergent
    assert not resolved, (
        f"Identificadores ya alineados: elimínelos de PENDIENTES_OPERATION_ID: {_format(resolved)}"
    )


def test_extra_operations_are_declared_as_additions(
    contract: dict[tuple[str, str], str], implemented: dict[tuple[str, str], str]
) -> None:
    extra = {key for key in implemented if key not in contract}
    undeclared = extra - ANADIDOS
    assert not undeclared, (
        f"Operaciones que el documento de interfaces no contempla y que no figuran como "
        f"añadidos justificados en {MAPPING_DOC}: {_format(undeclared)}"
    )
    stale = ANADIDOS - extra
    assert not stale, f"ANADIDOS cita operaciones que la API ya no expone: {_format(stale)}"


def test_documented_schema_fields_are_not_silently_renamed(
    contract: dict[tuple[str, str], str],
) -> None:
    """Los campos requeridos de `PieceCreate` son los nombres que debe aceptar la API (D3)."""
    document = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    required = document["components"]["schemas"]["PieceCreate"]["required"]
    assert required == [
        "denomination",
        "tenure_regime",
        "category_id",
        "conservation_state_id",
    ], "Cambiaron los campos obligatorios del documento: revise la tarea 4.1 y el mapeo."
    spec = json.dumps(build_spec(), ensure_ascii=False)
    assert '"denomination"' in spec and '"code_i"' in spec, (
        "Los campos del contrato (denomination, code_i) deben aparecer en el esquema de la API "
        "(tarea 4.1 del change alinear-api-endpoints-v1)."
    )


def test_added_schema_fields_exist_and_are_declared_in_the_mapping() -> None:
    """`CAMPOS_ANADIDOS`: cada extensión existe en la API y figura en el mapeo."""
    schemas = build_spec()["components"]["schemas"]
    missing = {
        (schema, field)
        for schema, field in CAMPOS_ANADIDOS
        if field not in schemas.get(schema, {}).get("properties", {})
    }
    assert not missing, f"CAMPOS_ANADIDOS cita campos que la API ya no tiene: {sorted(missing)}"
    mapping = (REPO_ROOT / MAPPING_DOC).read_text(encoding="utf-8")
    undeclared = {
        (schema, field) for schema, field in CAMPOS_ANADIDOS if f"`{field}`" not in mapping
    }
    assert not undeclared, f"Campos añadidos sin justificar en {MAPPING_DOC}: {sorted(undeclared)}"
