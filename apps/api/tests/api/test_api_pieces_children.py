"""POST /pieces/{piece_id}/children (ficha-pieza-crud 2.7; RF-009, RN-007).

Spec catalogo-piezas, «Asociación de piezas componentes a un conjunto». Every piece a test
creates is deleted at the end, so the active total of the seeded database does not move.
Synthetic data only (RNF-014).
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from tests.api.conftest import SeededApi


def _new_piece(client: TestClient, denomination: str) -> str:
    created = client.post(
        "/api/v1/pieces", json={"denomination": denomination, "tenure_regime": "Propiedad"}
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def _link(client: TestClient, set_id: str, child_id: str) -> object:
    return client.post(f"/api/v1/pieces/{set_id}/children", json={"child_piece_id": child_id})


def _parent_of(client: TestClient, piece_id: str) -> str | None:
    return client.get(f"/api/v1/pieces/{piece_id}").json()["parent_piece_id"]


def _delete(seeded_api: SeededApi, *piece_ids: str) -> None:
    admin = seeded_api.login_as("ADMIN")
    for piece_id in piece_ids:
        deleted = admin.delete(f"/api/v1/pieces/{piece_id}", params={"reason": "Limpieza"})
        assert deleted.status_code == 204, deleted.text


def test_a_component_is_linked_to_the_set_and_the_link_is_audited(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    set_id = _new_piece(client, "Retablo de tres pisos (sintético)")
    child_id = _new_piece(client, "Puerta del retablo (sintética)")

    response = _link(client, set_id, child_id)
    again = _link(client, set_id, child_id)

    assert response.status_code == 200, response.text
    assert response.json()["id"] == child_id
    assert again.status_code == 200, again.text
    children = client.get(f"/api/v1/pieces/{set_id}/children").json()
    assert [child["id"] for child in children] == [child_id]
    with seeded_api.session() as session:
        entries = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(child_id),
                AuditLog.action == AuditAction.UPDATE,
                AuditLog.field == "parent_piece_id",
            )
        ).all()
    assert len(entries) == 1  # linking again to the same set changes nothing
    assert str(entries[0].new_value) == set_id
    assert entries[0].origin is AuditOrigin.MANUAL and entries[0].user_id is not None
    _delete(seeded_api, child_id, set_id)


def test_a_cycle_in_the_hierarchy_of_sets_is_409(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    set_id = _new_piece(client, "Nacimiento (sintético)")
    child_id = _new_piece(client, "Grupo central del nacimiento (sintético)")
    assert _link(client, set_id, child_id).status_code == 200

    ancestor = _link(client, child_id, set_id)
    itself = _link(client, set_id, set_id)

    assert (ancestor.status_code, ancestor.json()["code"]) == (409, "piece_hierarchy_cycle")
    assert (itself.status_code, itself.json()["code"]) == (409, "piece_hierarchy_cycle")
    assert _parent_of(client, set_id) is None
    assert _parent_of(client, child_id) == set_id
    _delete(seeded_api, child_id, set_id)


def test_a_component_of_another_set_is_409_and_keeps_its_set(seeded_api: SeededApi) -> None:
    client = seeded_api.login_as("CATALOGUER")
    first_set = _new_piece(client, "Primer conjunto (sintético)")
    second_set = _new_piece(client, "Segundo conjunto (sintético)")
    child_id = _new_piece(client, "Componente disputado (sintético)")
    assert _link(client, first_set, child_id).status_code == 200

    response = _link(client, second_set, child_id)

    assert response.status_code == 409, response.text
    assert response.json()["code"] == "component_already_linked"
    assert response.json()["details"]["parent_piece_id"] == first_set
    assert _parent_of(client, child_id) == first_set
    _delete(seeded_api, child_id, first_set, second_set)


def test_an_internal_viewer_cannot_link_components(seeded_api: SeededApi) -> None:
    viewer = seeded_api.login_as("INTERNAL_VIEWER")

    response = _link(viewer, str(uuid.uuid4()), str(uuid.uuid4()))

    assert response.status_code == 403
