"""Helpers to declare contract operations that are not implemented yet (design D3; RNF-009).

Usage::

    @router.post("/imports/{batch_id}/approve", response_model=ImportBatchOut, **stub(IMPORTS))
    def approve_import(batch_id: UUID, body: ApprovalIn) -> ImportBatchOut:
        raise not_implemented(IMPORTS, ImportBatchOut)
"""

from typing import Any

from pydantic import BaseModel

from app.api.errors import NotImplementedEndpoint, NotImplementedResponse

X_STATUS = "x-status"
X_CHANGE = "x-change"
STATUS_STUB = "stub"
STATUS_IMPLEMENTED = "implemented"

# Backlog changes (Fase 7) that will replace each stub.
CHANGE_PIECE_CRUD = "ficha-pieza-crud"
CHANGE_COLLECTIONS_ADMIN = "colecciones-y-vocabularios-admin"
CHANGE_MEDIA = "fotografias-multiples-por-pieza"
CHANGE_LOCATIONS = "ubicacion-jerarquica-y-movimientos"
CHANGE_IMPORTS = "importacion-pipeline-reconciliacion"
CHANGE_TEMPLATES = "plantillas-mapeo-y-normalizacion"
CHANGE_DUPLICATES = "deteccion-duplicados-y-cola-revision"
CHANGE_INCOMPLETE = "alertas-y-reporte-incompletas"
CHANGE_SEARCH_EXPORT = "busqueda-avanzada-y-exportacion"
CHANGE_REPORTS = "reportes-inventario"
CHANGE_AUTH = "autenticacion-y-matriz-permisos"
CHANGE_AUDIT = "auditoria-y-soft-delete-transversal"
CHANGE_AI_EXTRACTION = "ia-extraccion-texto-libre"


def implemented() -> dict[str, Any]:
    return {"openapi_extra": {X_STATUS: STATUS_IMPLEMENTED}}


def stub(change: str) -> dict[str, Any]:
    return {
        "openapi_extra": {X_STATUS: STATUS_STUB, X_CHANGE: change},
        "responses": {
            501: {
                "model": NotImplementedResponse,
                "description": f"Stub del contrato; lo implementa el change `{change}`.",
            }
        },
    }


def example_of(model: type[BaseModel]) -> Any:
    """First example declared in the model's ``json_schema_extra`` (None if there is none)."""
    extra = model.model_config.get("json_schema_extra")
    if isinstance(extra, dict):
        examples = extra.get("examples")
        if isinstance(examples, list) and examples:
            return examples[0]
    return None


def page_example(model: type[BaseModel]) -> dict[str, Any]:
    item = example_of(model)
    return {"items": [item] if item is not None else [], "total": 1, "page": 1, "page_size": 20}


def not_implemented(change: str, example: type[BaseModel] | Any | None = None) -> Exception:
    if isinstance(example, type) and issubclass(example, BaseModel):
        example = example_of(example)
    return NotImplementedEndpoint(change, example)
