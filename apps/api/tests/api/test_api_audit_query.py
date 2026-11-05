"""Spec auditoria-trazabilidad — Consulta agrupada y exportable de la auditoría (tarea 3.2).

Escenarios: los cambios de un lote de importación se ven como un único conjunto con el número
de piezas y campos afectados (RF-040), y quien no tiene el permiso de datos de comodantes ve
que el campo cambió, quién y cuándo, pero no los valores (RF-041).
"""

import csv
import io
import uuid
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.models_base import new_uuid
from app.models import AppUser, AuditLog, Permission, Piece, Role, RolePermission, UserRole
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.query import CSV_BOM
from app.modules.audit.soft_delete import soft_delete
from app.modules.catalog.enums import LEGAL_OWNER_PUCP, TenureRegime
from tests.api.conftest import ADMIN, CATALOGUER, SeededApi, as_user

HA = as_user(ADMIN)
AUDIT = "/api/v1/audit-logs"
LENDER_VALUE = "Comodante sintético AJB"
LIMITED_ROLE = "TEST_AUDIT_VIEWER"
LIMITED_EMAIL = "auditoria.sin.comodantes@matp.local"


@dataclass(frozen=True)
class ImportedBatch:
    """Conjunto de cambios sintético con origen de importación."""

    origin_ref: str
    change_set_id: uuid.UUID
    pieces: int
    fields: int


def _import_batch(seeded_api: SeededApi, pieces: int) -> ImportedBatch:
    """Crea varias piezas en un solo vaciado (un conjunto de cambios) y las deja eliminadas.

    Las piezas se eliminan lógicamente al final con origen manual para no alterar el total de
    piezas activas que comprueban otras pruebas; su creación sigue auditada como importación.
    """
    origin_ref = str(new_uuid())
    with seeded_api.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        imported = AuditContext(
            origin=AuditOrigin.IMPORT,
            user_id=admin.id,
            origin_ref=origin_ref,
            reason="Carga de la sábana 2024 (sintética)",
        )
        with audit_context(session, imported):
            rows = [
                Piece(
                    id=new_uuid(),
                    denomination=f"Pieza importada {number} ({origin_ref[:8]})",
                    tenure_regime=TenureRegime.OWNED,
                    legal_owner=LEGAL_OWNER_PUCP,
                    author="Autor sintético",
                    provenance="Procedencia sintética",
                )
                for number in range(1, pieces + 1)
            ]
            session.add_all(rows)
            session.flush()
        entries = list(session.scalars(select(AuditLog).where(AuditLog.origin_ref == origin_ref)))
        change_set_ids = {entry.change_set_id for entry in entries}
        assert len(change_set_ids) == 1, "las piezas deben compartir un único conjunto de cambios"
        manual = AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)
        with audit_context(session, manual):
            for row in rows:
                soft_delete(session, row, "Carga de prueba de auditoría")
        session.commit()
        return ImportedBatch(
            origin_ref=origin_ref,
            change_set_id=change_set_ids.pop(),
            pieces=pieces,
            fields=len(entries),
        )


@pytest.fixture(scope="module")
def imported_batch(seeded_api: SeededApi) -> ImportedBatch:
    return _import_batch(seeded_api, pieces=3)


@pytest.fixture(scope="module")
def auditor_without_donor_data(seeded_api: SeededApi) -> str:
    """Usuario con `audit.read` pero sin `sensitive.donor_data` (ningún rol semilla lo es)."""
    with seeded_api.session() as session:
        if session.scalar(select(AppUser).where(AppUser.email == LIMITED_EMAIL)) is not None:
            return LIMITED_EMAIL
        with audit_context(session, AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")):
            role = Role(
                id=new_uuid(),
                code=LIMITED_ROLE,
                name="Auditoría sin datos de comodantes (prueba)",
                description="Rol sintético de prueba: consulta la auditoría sin ver datos "
                "sensibles de comodantes (RF-041).",
            )
            session.add(role)
            user = AppUser(
                id=new_uuid(),
                email=LIMITED_EMAIL,
                full_name="Auditoría sin comodantes (sintética)",
                is_synthetic=True,
                password_hash="$argon2id$fake-hash-for-tests",
            )
            session.add(user)
            session.flush()
            for code in ("pieces.read", "audit.read"):
                permission = session.scalar(select(Permission).where(Permission.code == code))
                assert permission is not None
                session.add(
                    RolePermission(id=new_uuid(), role_id=role.id, permission_id=permission.id)
                )
            session.add(UserRole(id=new_uuid(), user_id=user.id, role_id=role.id))
            session.commit()
    return LIMITED_EMAIL


def _rows(body: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(body.removeprefix(CSV_BOM))))


# --- escenario: cambios de un lote de importación ---------------------------------------------
def test_an_import_batch_is_a_single_change_set(
    client: TestClient, imported_batch: ImportedBatch
) -> None:
    body = client.get(
        AUDIT,
        params={
            "origin": "IMPORT",
            "origin_ref": imported_batch.origin_ref,
            "group_by": "change_set",
        },
        headers=HA,
    ).json()
    assert body["total"] == 1
    assert body["items"] == []
    summary = body["change_sets"][0]
    assert summary["change_set_id"] == str(imported_batch.change_set_id)
    assert summary["origin"] == "IMPORT"
    assert summary["origin_ref"] == imported_batch.origin_ref
    assert summary["reason"] == "Carga de la sábana 2024 (sintética)"
    assert summary["actions"] == ["CREATE"]
    assert summary["entity_counts"] == {"piece": imported_batch.pieces}
    assert summary["entity_count"] == imported_batch.pieces
    assert summary["field_count"] == imported_batch.fields
    assert summary["reverted"] is False
    assert summary["reverted_by_change_set_id"] is None
    assert summary["user_id"] and summary["occurred_at"]

    # «puede abrir su detalle»: las filas campo a campo del mismo conjunto.
    detail = client.get(
        AUDIT, params={"change_set_id": summary["change_set_id"]}, headers=HA
    ).json()
    assert detail["total"] == imported_batch.fields
    assert {item["entity_type"] for item in detail["items"]} == {"piece"}
    assert {item["action"] for item in detail["items"]} == {"CREATE"}


def test_a_reverted_change_set_is_reported_as_such(seeded_api: SeededApi) -> None:
    batch = _import_batch(seeded_api, pieces=1)
    with seeded_api.session() as session:
        admin = session.scalar(select(AppUser).where(AppUser.email == ADMIN))
        assert admin is not None
        with audit_context(session, AuditContext(origin=AuditOrigin.MANUAL, user_id=admin.id)):
            session.add(
                AuditLog(
                    id=new_uuid(),
                    change_set_id=new_uuid(),
                    entity_type="piece",
                    entity_id=new_uuid(),
                    field="denomination",
                    old_value="Pieza importada 1",
                    new_value=None,
                    action=AuditAction.REVERT,
                    origin=AuditOrigin.MANUAL,
                    origin_ref=str(batch.change_set_id),
                    user_id=admin.id,
                )
            )
            session.commit()
    body = seeded_api.client.get(
        AUDIT,
        params={"origin_ref": batch.origin_ref, "group_by": "change_set"},
        headers=HA,
    ).json()
    summary = body["change_sets"][0]
    assert summary["reverted"] is True
    assert summary["reverted_by_change_set_id"]


# --- escenario: valor sensible en la auditoría ------------------------------------------------
def test_sensitive_values_are_hidden_from_a_role_without_the_permission(
    client: TestClient, auditor_without_donor_data: str
) -> None:
    params = {"entity_type": "piece", "field": "lender_name", "page_size": 5}
    limited = client.get(AUDIT, params=params, headers=as_user(auditor_without_donor_data)).json()
    assert limited["total"] >= 1
    for item in limited["items"]:
        assert item["field"] == "lender_name"
        assert item["values_masked"] is True
        assert item["old_value"] is None and item["new_value"] is None
        # Sigue constando qué cambió, quién y cuándo.
        assert item["action"] and item["occurred_at"]
        assert item["user_id"] or item["actor_label"]

    allowed = client.get(AUDIT, params=params, headers=HA).json()
    assert allowed["total"] == limited["total"]
    assert any(item["new_value"] == LENDER_VALUE for item in allowed["items"])
    assert all(item["values_masked"] is False for item in allowed["items"])


def test_non_sensitive_values_are_not_hidden(
    client: TestClient, auditor_without_donor_data: str
) -> None:
    body = client.get(
        AUDIT,
        params={"entity_type": "piece", "field": "denomination", "page_size": 5},
        headers=as_user(auditor_without_donor_data),
    ).json()
    assert body["items"]
    assert all(item["values_masked"] is False for item in body["items"])
    assert any(item["new_value"] for item in body["items"])


# --- exportación a CSV ------------------------------------------------------------------------
def test_csv_export_streams_the_same_filtered_rows(
    client: TestClient, imported_batch: ImportedBatch
) -> None:
    params = {"change_set_id": str(imported_batch.change_set_id)}
    response = client.get(AUDIT, params={**params, "format": "csv"}, headers=HA)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "auditoria.csv" in response.headers["content-disposition"]
    assert response.text.startswith(CSV_BOM)
    rows = _rows(response.text)
    assert len(rows) == imported_batch.fields
    assert {row["entity_type"] for row in rows} == {"piece"}
    assert {row["change_set_id"] for row in rows} == {str(imported_batch.change_set_id)}
    assert all(row["values_masked"] == "false" for row in rows)
    assert any(row["field"] == "denomination" and row["new_value"] for row in rows)


def test_csv_export_hides_sensitive_values_too(
    client: TestClient, auditor_without_donor_data: str
) -> None:
    response = client.get(
        AUDIT,
        params={"entity_type": "piece", "field": "lender_name", "format": "csv"},
        headers=as_user(auditor_without_donor_data),
    )
    assert response.status_code == 200
    assert LENDER_VALUE not in response.text
    rows = _rows(response.text)
    assert rows
    assert all(row["values_masked"] == "true" for row in rows)
    assert all(row["old_value"] == "" and row["new_value"] == "" for row in rows)
    allowed = client.get(
        AUDIT,
        params={"entity_type": "piece", "field": "lender_name", "format": "csv"},
        headers=HA,
    )
    assert LENDER_VALUE in allowed.text


def test_grouped_csv_export_summarizes_each_change_set(
    client: TestClient, imported_batch: ImportedBatch
) -> None:
    response = client.get(
        AUDIT,
        params={
            "origin_ref": imported_batch.origin_ref,
            "group_by": "change_set",
            "format": "csv",
        },
        headers=HA,
    )
    assert response.status_code == 200
    rows = _rows(response.text)
    assert len(rows) == 1
    assert rows[0]["change_set_id"] == str(imported_batch.change_set_id)
    assert rows[0]["entity_counts"] == f"piece={imported_batch.pieces}"
    assert rows[0]["field_count"] == str(imported_batch.fields)
    assert rows[0]["actions"] == "CREATE"
    assert rows[0]["reverted"] == "false"


def test_audit_query_still_requires_the_audit_permission(client: TestClient) -> None:
    assert client.get(AUDIT, headers=as_user(CATALOGUER)).status_code == 403
    assert (
        client.get(AUDIT, params={"format": "csv"}, headers=as_user(CATALOGUER)).status_code == 403
    )
