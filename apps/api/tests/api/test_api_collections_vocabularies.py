"""Spec colecciones-vocabularios — CRUD trivial por API con auditoría y soft-delete (RF-010)."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import AuditLog, Collection, Term
from app.modules.audit.tracking import INCLUDE_DELETED
from tests.api.conftest import CATALOGUER, MANAGER, VIEWER, SeededApi, as_user

H = as_user(MANAGER)


def test_create_collection_is_audited_with_user(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    response = client.post(
        "/api/v1/collections",
        json={"name": "Colección de prueba API (sintética)", "acronym": "T.A.P."},
        headers=H,
    )
    assert response.status_code == 201
    created = response.json()
    assert created["acronym_normalized"] == "TAP"
    assert created["piece_count"] == 0
    me = client.get("/api/v1/auth/me", headers=H).json()
    audit = client.get(
        "/api/v1/audit",
        params={"entity_type": "collection", "entity_id": created["id"]},
        headers=H,
    ).json()
    assert audit["total"] > 0
    assert {entry["user_id"] for entry in audit["items"]} == {me["id"]}
    assert {entry["origin"] for entry in audit["items"]} == {"MANUAL"}


def test_duplicate_acronym_after_normalization(client: TestClient) -> None:
    response = client.post(
        "/api/v1/collections", json={"name": "Otra MMZ", "acronym": "m m z"}, headers=H
    )
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "duplicate_acronym"
    assert "Colección MMZ (ficticia)" in body["message"]


def test_move_collection_into_its_child_is_rejected(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        parent = session.scalar(select(Collection).where(Collection.acronym_normalized == "RA"))
        child = session.scalar(select(Collection).where(Collection.acronym_normalized == "RAB"))
    response = seeded_api.client.patch(
        f"/api/v1/collections/{parent.id}", json={"parent_id": str(child.id)}, headers=H
    )
    assert response.status_code == 409
    assert response.json()["code"] == "collection_hierarchy_cycle"


def test_non_empty_collection_cannot_be_deleted(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        mmz = session.scalar(select(Collection).where(Collection.acronym_normalized == "MMZ"))
    response = seeded_api.client.delete(
        f"/api/v1/collections/{mmz.id}", params={"reason": "Prueba"}, headers=H
    )
    assert response.status_code == 409
    assert response.json()["code"] == "collection_not_empty"


def test_soft_delete_empty_collection(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    created = client.post(
        "/api/v1/collections", json={"name": "Colección temporal (sintética)"}, headers=H
    ).json()
    missing_reason = client.delete(f"/api/v1/collections/{created['id']}", headers=H)
    assert missing_reason.status_code == 422
    response = client.delete(
        f"/api/v1/collections/{created['id']}",
        params={"reason": "Creada por error en prueba"},
        headers=H,
    )
    assert response.status_code == 204
    assert client.get(f"/api/v1/collections/{created['id']}", headers=H).status_code == 404
    with seeded_api.session() as session:
        row = session.scalar(
            select(Collection)
            .where(Collection.name == "Colección temporal (sintética)")
            .execution_options(**{INCLUDE_DELETED: True})
        )
        assert row is not None and row.deletion_reason == "Creada por error en prueba"


def test_donor_data_masked_for_viewer(client: TestClient) -> None:
    listed = client.get("/api/v1/collections", headers=as_user(VIEWER)).json()
    assert all(item["origin_description"] is None for item in listed)
    assert all("origin_description" in item["masked_fields"] for item in listed)


def test_terms_lifecycle(seeded_api: SeededApi) -> None:
    client = seeded_api.client
    base = "/api/v1/vocabularies/CONSERVATION_STATUS/terms"
    before = client.get(base, headers=H).json()
    assert {term["code"] for term in before} >= {"BUENO", "REGULAR", "MALO"}

    created = client.post(base, json={"code": "FRAGMENTADO", "label": "Fragmentado"}, headers=H)
    assert created.status_code == 201
    term_id = created.json()["id"]
    duplicate = client.post(base, json={"code": "OTRO", "label": "fragmentado"}, headers=H)
    assert duplicate.status_code == 422
    assert duplicate.json()["code"] == "duplicate_term"

    deactivated = client.patch(f"{base}/{term_id}", json={"is_active": False}, headers=H)
    assert deactivated.json()["is_active"] is False
    assert term_id not in {t["id"] for t in client.get(base, headers=H).json()}
    assert term_id in {
        t["id"] for t in client.get(f"{base}?include_inactive=true", headers=H).json()
    }

    deleted = client.delete(f"{base}/{term_id}", params={"reason": "Término de prueba"}, headers=H)
    assert deleted.status_code == 204
    assert client.patch(f"{base}/{term_id}", json={"label": "X"}, headers=H).status_code == 404


def test_term_in_use_cannot_be_deleted(seeded_api: SeededApi) -> None:
    with seeded_api.session() as session:
        regular = session.scalar(select(Term).where(Term.code == "REGULAR"))
    response = seeded_api.client.delete(
        f"/api/v1/vocabularies/CONSERVATION_STATUS/terms/{regular.id}",
        params={"reason": "Prueba"},
        headers=H,
    )
    assert response.status_code == 409
    assert response.json()["code"] == "term_in_use"


def test_unknown_vocabulary_and_permissions(client: TestClient) -> None:
    assert client.get("/api/v1/vocabularies/NO_EXISTE/terms", headers=H).status_code == 404
    forbidden = client.post(
        "/api/v1/vocabularies/MATERIAL/terms",
        json={"code": "BARRO", "label": "Barro"},
        headers=as_user(CATALOGUER),
    )
    assert forbidden.status_code == 403
    vocabularies = client.get("/api/v1/vocabularies", headers=H).json()
    assert {v["code"] for v in vocabularies} >= {"CATEGORY", "MATERIAL", "PHOTO_VIEW_TYPE"}


def test_writes_never_bypass_audit(seeded_api: SeededApi) -> None:
    created = seeded_api.client.post(
        "/api/v1/vocabularies/MATERIAL/terms",
        json={"code": "TOTORA", "label": "Totora"},
        headers=H,
    )
    assert created.status_code == 201
    with seeded_api.session() as session:
        rows = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(created.json()["id"]), AuditLog.origin == "MANUAL"
            )
        ).all()
    assert rows, "Las escrituras por API deben generar auditoría de origen MANUAL"
