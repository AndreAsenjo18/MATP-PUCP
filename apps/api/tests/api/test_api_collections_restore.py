"""Retired collections and their restoration (crud-manual-completo 1.1; RF-010, RN-005).

Spec colecciones-vocabularios, «Edición y retiro de colecciones desde la interfaz», scenario
«Retirar una colección vacía y restaurarla»; design D2. The list of retired collections and their
restoration already exist in the trash (`auditoria-y-soft-delete-transversal`): whoever manages
collections sees them and only the Administrator restores [SUPUESTO Ñ3], so no route is added.
Synthetic data only (RNF-014).
"""

import uuid

from sqlalchemy import select

from app.models import AuditLog
from app.modules.audit.models import AuditAction
from tests.api.conftest import LoginAs, SeededApi


def _retired_collection(client, name: str) -> str:  # type: ignore[no-untyped-def]
    created = client.post("/api/v1/collections", json={"name": name})
    assert created.status_code == 201, created.text
    collection_id = created.json()["id"]
    retired = client.delete(
        f"/api/v1/collections/{collection_id}", params={"reason": "Creada por error (sintético)"}
    )
    assert retired.status_code == 204, retired.text
    return collection_id


def test_a_retired_collection_is_listed_apart_and_restored(seeded_api: SeededApi) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    collection_id = _retired_collection(manager, "Colección para restaurar (sintética)")
    admin = seeded_api.login_as("ADMIN")

    offered = {item["id"] for item in manager.get("/api/v1/collections").json()}
    retired = manager.get("/api/v1/trash", params={"entity_type": "collection"}).json()["items"]
    entry = next(item for item in retired if item["entity_id"] == collection_id)
    restored = admin.post(
        f"/api/v1/trash/collection/{collection_id}/restore",
        params={"reason": "Se retiró por error (sintético)"},
    )

    assert collection_id not in offered
    assert entry["deletion_reason"] == "Creada por error (sintético)"
    assert restored.status_code == 200, restored.text
    assert collection_id in {item["id"] for item in manager.get("/api/v1/collections").json()}
    with seeded_api.session() as session:
        actions = set(
            session.scalars(
                select(AuditLog.action).where(AuditLog.entity_id == uuid.UUID(collection_id))
            )
        )
    assert {AuditAction.SOFT_DELETE, AuditAction.RESTORE} <= actions


def test_an_active_collection_cannot_be_restored(seeded_api: SeededApi) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    active = manager.post("/api/v1/collections", json={"name": "Colección activa (sintética)"})

    response = seeded_api.login_as("ADMIN").post(
        f"/api/v1/trash/collection/{active.json()['id']}/restore"
    )

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "not_deleted"


def test_the_manager_sees_the_retired_but_only_the_administrator_restores(
    seeded_api: SeededApi, login_as: LoginAs
) -> None:
    manager = seeded_api.login_as("COLLECTIONS_MANAGER")
    collection_id = _retired_collection(manager, "Colección retirada ajena (sintética)")
    cataloguer = login_as("CATALOGUER")

    by_manager = manager.post(f"/api/v1/trash/collection/{collection_id}/restore")
    listing = cataloguer.get("/api/v1/trash", params={"entity_type": "collection"})
    by_cataloguer = cataloguer.post(f"/api/v1/trash/collection/{collection_id}/restore")

    assert by_manager.status_code == 403 and by_manager.json()["code"] == "admin_required"
    assert (listing.status_code, by_cataloguer.status_code) == (403, 403)
