"""Editing a collection from Administración (crud-manual-completo 2.2; RF-010, RN-010).

Spec colecciones-vocabularios, «Edición y retiro de colecciones desde la interfaz»: name, acronym,
parent collection and default tenure regime; every change is audited. The default regime joins the
PATCH (decided while applying 2.2). Synthetic data only (RNF-014).
"""

import uuid

from sqlalchemy import select

from app.models import AuditLog
from app.modules.audit.models import AuditAction
from tests.api.conftest import SeededApi


def _collection(client, name: str, acronym: str) -> dict:  # type: ignore[no-untyped-def]
    created = client.post("/api/v1/collections", json={"name": name, "acronym": acronym})
    assert created.status_code == 201, created.text
    return created.json()


def _changes(seeded_api: SeededApi, collection_id: str) -> dict[str, tuple]:
    with seeded_api.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(collection_id),
                AuditLog.action == AuditAction.UPDATE,
            )
        ).all()
    return {entry.field: (entry.old_value, entry.new_value) for entry in entries if entry.field}


def test_the_default_regime_is_edited_with_its_label_and_audited(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    collection = _collection(
        client, "Colección de comodato (sintética)", f"CC{uuid.uuid4().hex[:4]}"
    )

    edited = client.patch(
        f"/api/v1/collections/{collection['id']}", json={"default_tenure_regime": "Comodato"}
    )
    wrong = client.patch(
        f"/api/v1/collections/{collection['id']}", json={"default_tenure_regime": "Robado"}
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["default_tenure_regime"] == "Comodato"
    assert wrong.status_code == 422
    assert _changes(seeded_api, collection["id"])["default_tenure_regime"][1] == "LOAN_FOR_USE"


def test_fixing_the_acronym_is_audited_and_the_old_one_can_be_kept(seeded_api: SeededApi) -> None:
    """Escenario «Corregir la sigla de una colección»: ABC → ABD, ABC kept as historical."""
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    tag = uuid.uuid4().hex[:3].upper()
    collection = _collection(client, "Colección con errata (sintética)", f"AB{tag}C")

    edited = client.patch(f"/api/v1/collections/{collection['id']}", json={"acronym": f"AB{tag}D"})
    kept = client.post(
        "/api/v1/collection-acronym-aliases",
        json={"collection_id": collection["id"], "alias": f"AB{tag}C"},
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["acronym"] == f"AB{tag}D"
    assert _changes(seeded_api, collection["id"])["acronym"] == (f"AB{tag}C", f"AB{tag}D")
    assert kept.status_code == 201, kept.text


def test_an_acronym_of_another_active_collection_is_rejected(seeded_api: SeededApi) -> None:
    """Escenario «Sigla repetida»."""
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    tag = uuid.uuid4().hex[:4].upper()
    _collection(client, "Colección original (sintética)", f"OR{tag}")
    other = _collection(client, "Otra colección (sintética)", f"OT{tag}")

    repeated = client.patch(f"/api/v1/collections/{other['id']}", json={"acronym": f"OR{tag}"})

    assert repeated.status_code == 422, repeated.text
    assert repeated.json()["code"] == "duplicate_acronym"
