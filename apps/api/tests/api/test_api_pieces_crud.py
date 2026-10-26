"""Spec catalogo-piezas — tarea 4.1: POST/PUT/DELETE /pieces con los esquemas y el code_i
del contrato (`docs/fuentes/endpoints-api-v1.yaml`), y el rendimiento constante de
`GET /pieces` (D6). Change ficha-pieza-crud, tareas 1.1 y 2.2: versión de la ficha y control de
concurrencia con If-Match (D2)."""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import event, func, select

from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.models import Piece
from tests.api.conftest import SeededApi


def _put(client: TestClient, piece_id: str, body: dict[str, Any]) -> Any:
    """PUT of the sheet with the version just read, as the editor does (D2)."""
    version = client.get(f"/api/v1/pieces/{piece_id}").json()["version"]
    return client.put(f"/api/v1/pieces/{piece_id}", json=body, headers={"If-Match": str(version)})


def _delete(seeded_api: SeededApi, piece_id: str, reason: str = "Limpieza de prueba") -> None:
    """Soft-delete a piece created by a test, so the active total returns to the baseline."""
    response = seeded_api.login_as("ADMIN").delete(
        f"/api/v1/pieces/{piece_id}", params={"reason": reason}
    )
    assert response.status_code == 204


def test_create_piece_with_code_i_is_reflected_in_detail(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    created = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Pieza de prueba con código I (sintética)",
            "tenure_regime": "Propiedad",
            "code_i": "I 09999",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["denomination"] == "Pieza de prueba con código I (sintética)"
    assert body["code_i"] == "I-9999"

    detail = client.get(f"/api/v1/pieces/{body['id']}").json()
    assert detail["code_i"] == "I-9999"
    _delete(seeded_api, body["id"])


def test_create_piece_comodato_with_code_i_is_rejected(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    response = client.post(
        "/api/v1/pieces",
        json={
            "denomination": "Pieza en comodato (sintética)",
            "tenure_regime": "Comodato",
            "code_i": "I-8888",
        },
    )
    assert response.status_code == 409  # RN-003: comodato nunca recibe código I
    assert response.json()["code"] == "identifier_not_allowed_for_tenure"


def test_create_piece_without_category_or_conservation_state_succeeds(
    seeded_api: SeededApi,
) -> None:
    """Supuesto B1: `category_id`/`conservation_state_id` son opcionales en `PieceCreate`."""
    client = seeded_api.login_as("CATALOGUER")
    created = client.post(
        "/api/v1/pieces",
        json={"denomination": "Pieza sin categoría (sintética)", "tenure_regime": "Propiedad"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["category"] is None
    assert body["conservation_status"] is None
    _delete(seeded_api, body["id"])


def test_a_piece_without_denomination_is_not_created(seeded_api: SeededApi) -> None:
    """ficha-pieza-crud 2.1: the denomination is mandatory (RF-006)."""
    client = seeded_api.login_as("CATALOGUER")

    for body in (
        {"tenure_regime": "Propiedad"},
        {"denomination": "", "tenure_regime": "Propiedad"},
    ):
        assert client.post("/api/v1/pieces", json=body).status_code == 422


def test_an_internal_viewer_cannot_create_a_piece(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("INTERNAL_VIEWER")

    response = client.post(
        "/api/v1/pieces", json={"denomination": "Pieza no permitida", "tenure_regime": "Propiedad"}
    )

    assert response.status_code == 403


def test_creating_a_piece_is_audited_as_manual_with_its_user(seeded_api: SeededApi) -> None:
    """ficha-pieza-crud 2.1: the creation leaves its audit with manual origin and the user."""
    client = seeded_api.login_as("CATALOGUER")
    me = client.get("/api/v1/auth/me").json()

    created = client.post(
        "/api/v1/pieces",
        json={"denomination": "Pieza auditada (sintética)", "tenure_regime": "Propiedad"},
    )

    assert created.status_code == 201, created.text
    with seeded_api.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(created.json()["id"]),
                AuditLog.action == AuditAction.CREATE,
            )
        ).all()
    assert entries
    assert {(entry.origin, str(entry.user_id)) for entry in entries} == {
        (AuditOrigin.MANUAL, me["id"])
    }
    _delete(seeded_api, created.json()["id"])


def _create_throwaway_piece(seeded_api: SeededApi, denomination: str) -> str:
    client = seeded_api.login_as("CATALOGUER")
    created = client.post(
        "/api/v1/pieces",
        json={"denomination": denomination, "tenure_regime": "Propiedad"},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_put_changes_editable_fields(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza editable (sintética)")
    response = _put(
        client,
        piece_id,
        {"denomination": "Pieza editada (sintética)", "notes": "Revisado en prueba"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["denomination"] == "Pieza editada (sintética)"
    assert body["notes"] == "Revisado en prueba"
    _delete(seeded_api, piece_id)


def test_put_changing_an_existing_code_i_is_rejected(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza con código I fijo (sintética)")
    created = _put(client, piece_id, {"code_i": "I-7777"})
    assert created.status_code == 200, created.text
    assert created.json()["code_i"] == "I-7777"

    changed = _put(client, piece_id, {"code_i": "I-7778"})
    assert changed.status_code == 409  # RN-002: código I inmutable fuera de la corrección auditada
    _delete(seeded_api, piece_id)


def test_put_resending_the_same_code_i_is_idempotent(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza idempotente (sintética)")
    _put(client, piece_id, {"code_i": "I 06543"})

    same = _put(client, piece_id, {"code_i": "I-06543"})
    assert same.status_code == 200, same.text
    assert same.json()["code_i"] == "I-6543"
    _delete(seeded_api, piece_id)


def test_the_sheet_exposes_its_version(seeded_api: SeededApi) -> None:
    """ficha-pieza-crud 1.1 (D2): the version the editor sends back in If-Match."""
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza con versión (sintética)")

    detail = client.get(f"/api/v1/pieces/{piece_id}")

    assert detail.status_code == 200, detail.text
    assert detail.json()["version"] == 1
    _delete(seeded_api, piece_id)


def test_two_concurrent_edits_the_second_gets_the_conflict(seeded_api: SeededApi) -> None:
    """ficha-pieza-crud 2.2: two people open version 1; the second save answers 409."""
    first, second = seeded_api.login_as("CATALOGUER"), seeded_api.login_as("COLLECTIONS_MANAGER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza disputada (sintética)")
    opened = first.get(f"/api/v1/pieces/{piece_id}").json()["version"]

    saved = first.put(
        f"/api/v1/pieces/{piece_id}", json={"notes": "Primera"}, headers={"If-Match": str(opened)}
    )
    late = second.put(
        f"/api/v1/pieces/{piece_id}", json={"notes": "Segunda"}, headers={"If-Match": str(opened)}
    )

    assert saved.status_code == 200, saved.text
    assert saved.json()["version"] == opened + 1
    assert late.status_code == 409, late.text
    conflict = late.json()
    assert conflict["code"] == "edit_conflict"
    assert conflict["details"]["current_version"] == opened + 1
    assert conflict["details"]["current"]["notes"] == "Primera"
    assert first.get(f"/api/v1/pieces/{piece_id}").json()["notes"] == "Primera"
    _delete(seeded_api, piece_id)


def test_an_edit_without_the_version_is_428(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza sin versión (sintética)")

    response = client.put(f"/api/v1/pieces/{piece_id}", json={"notes": "Sin If-Match"})

    assert response.status_code == 428, response.text
    assert response.json()["code"] == "precondition_required"
    assert client.get(f"/api/v1/pieces/{piece_id}").json()["notes"] is None
    _delete(seeded_api, piece_id)


def test_saving_without_changes_is_not_audited_and_keeps_the_version(
    seeded_api: SeededApi,
) -> None:
    client = seeded_api.login_as("CATALOGUER")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza sin cambios (sintética)")
    with seeded_api.session() as session:
        before = session.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.entity_id == uuid.UUID(piece_id))
        )

    response = _put(client, piece_id, {"denomination": "Pieza sin cambios (sintética)"})

    assert response.status_code == 200, response.text
    assert response.json()["version"] == 1
    with seeded_api.session() as session:
        after = session.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.entity_id == uuid.UUID(piece_id))
        )
    assert after == before
    _delete(seeded_api, piece_id)


def test_delete_requires_reason_then_soft_deletes(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    admin = seeded_api.login_as("ADMIN")
    piece_id = _create_throwaway_piece(seeded_api, "Pieza a eliminar (sintética)")

    without_reason = admin.delete(f"/api/v1/pieces/{piece_id}")
    assert without_reason.status_code == 422

    with_reason = admin.delete(
        f"/api/v1/pieces/{piece_id}", params={"reason": "Registrada por error"}
    )
    assert with_reason.status_code == 204

    after = client.get(f"/api/v1/pieces/{piece_id}")
    assert after.status_code == 404

    # ficha-pieza-crud 2.4 (RN-005, RNF-006): the row stays, deleted logically, and the audit
    # records who deleted it and why.
    with seeded_api.session() as session:
        kept = session.scalar(
            select(Piece)
            .where(Piece.id == uuid.UUID(piece_id))
            .execution_options(**{INCLUDE_DELETED: True})
        )
        assert kept is not None and kept.deleted_at is not None
        assert kept.deletion_reason == "Registrada por error"
        deletion = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(piece_id),
                AuditLog.action == AuditAction.SOFT_DELETE,
            )
        ).all()
    assert "deleted_at" in {entry.field for entry in deletion}
    assert {entry.reason for entry in deletion} == {"Registrada por error"}
    assert all(entry.user_id and entry.origin is AuditOrigin.MANUAL for entry in deletion)


def test_get_pieces_query_count_is_constant_for_any_limit(seeded_api: SeededApi) -> None:
    """D6: el costo de `GET /pieces` no debe crecer con `limit` (code_i se resuelve en lote)."""
    client = seeded_api.login_as("CATALOGUER")
    # Límites que garanticen varias piezas (evita el caso límite de una sola pieza sin colección,
    # donde el lote de colecciones se salta por estar vacío y no por evitar N+1).
    counts: dict[int, int] = {}
    for limit in (10, 50, 100):
        statements: list[str] = []

        def _capture(
            conn, cursor, statement, parameters, context, executemany, _out=statements
        ) -> None:
            _out.append(statement)

        event.listen(seeded_api.engine, "before_cursor_execute", _capture)
        try:
            response = client.get(f"/api/v1/pieces?limit={limit}")
        finally:
            event.remove(seeded_api.engine, "before_cursor_execute", _capture)
        assert response.status_code == 200
        counts[limit] = len(statements)
    assert len(set(counts.values())) == 1, (
        f"El número de consultas SQL de GET /pieces varía con `limit`: {counts} (D6)."
    )
