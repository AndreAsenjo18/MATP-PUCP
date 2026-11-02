"""Adding a place from the tree of the search (crud-manual-completo 3.1; RF-016, RN-005).

Spec ubicacion-movimientos, «Agregar una caja en un nivel» and «Usuario sin permiso». The tree of
the search uses the same operations as Administración, so the rules and the audit must hold for
whoever manages locations. Synthetic data only (RNF-014).
"""

import uuid
from collections.abc import Iterator

import pytest
from sqlalchemy import select

from app.models import AuditLog
from app.modules.audit.models import AuditAction
from tests.api.conftest import SeededApi


def _find(nodes: list[dict], location_id: str) -> dict | None:
    for node in nodes:
        if node["id"] == location_id:
            return node
        below = _find(node["children"], location_id)
        if below is not None:
            return below
    return None


@pytest.fixture
def level(seeded_api: SeededApi) -> Iterator[str]:
    """Sede › Depósito › Estante › Nivel, deactivated at the end so nothing else counts them."""
    client = seeded_api.login_as("COLLECTIONS_MANAGER")
    tag = uuid.uuid4().hex[:6].upper()
    created: list[str] = []
    parent_id = None
    for kind, name in (
        ("Sede", "Sede del árbol (sintética)"),
        ("Depósito", "Depósito 2"),
        ("Mueble", "Estante C"),
        ("Nivel", "Nivel 1"),
    ):
        response = client.post(
            "/api/v1/locations",
            json={"level": kind, "code": f"{tag}-{kind}", "name": name, "parent_id": parent_id},
        )
        assert response.status_code == 201, response.text
        parent_id = response.json()["id"]
        created.append(parent_id)
    yield parent_id
    for location_id in reversed(created):
        client.put(f"/api/v1/locations/{location_id}", json={"is_active": False})


def test_a_box_added_on_a_level_is_in_the_tree_and_audited(
    seeded_api: SeededApi, level: str
) -> None:
    client = seeded_api.login_as("COLLECTIONS_MANAGER")

    created = client.post(
        "/api/v1/locations",
        json={
            "level": "Contenedor",
            "code": f"CAJA-{uuid.uuid4().hex[:6]}",
            "name": "Caja 14",
            "parent_id": level,
        },
    )

    assert created.status_code == 201, created.text
    box_id = created.json()["id"]
    tree = client.get("/api/v1/locations/tree").json()
    node = _find(tree, box_id)
    assert node is not None
    assert node["level_type"] == "Contenedor"
    assert node["allowed_child_types"] == []
    with seeded_api.session() as session:
        audited = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(box_id), AuditLog.action == AuditAction.CREATE
            )
        ).all()
    assert audited
    assert client.put(f"/api/v1/locations/{box_id}", json={"is_active": False}).status_code == 200


def test_a_site_is_refused_inside_a_level(seeded_api: SeededApi, level: str) -> None:
    client = seeded_api.login_as("COLLECTIONS_MANAGER")

    response = client.post(
        "/api/v1/locations",
        json={
            "level": "Sede",
            "code": f"SEDE-{uuid.uuid4().hex[:6]}",
            "name": "Sede imposible",
            "parent_id": level,
        },
    )

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "invalid_location_parent"


def test_a_name_change_keeps_the_place_and_is_audited(seeded_api: SeededApi, level: str) -> None:
    client = seeded_api.login_as("COLLECTIONS_MANAGER")

    edited = client.put(f"/api/v1/locations/{level}", json={"name": "Nivel 1 (corregido)"})

    assert edited.status_code == 200, edited.text
    assert edited.json()["id"] == level
    assert edited.json()["name"] == "Nivel 1 (corregido)"
    with seeded_api.session() as session:
        changes = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == uuid.UUID(level),
                AuditLog.action == AuditAction.UPDATE,
                AuditLog.field == "name",
            )
        ).all()
    assert [change.new_value for change in changes] == ["Nivel 1 (corregido)"]


def test_internal_viewer_sees_the_tree_but_cannot_change_it(
    seeded_api: SeededApi, level: str
) -> None:
    client = seeded_api.login_as("INTERNAL_VIEWER")

    tree = client.get("/api/v1/locations/tree")
    added = client.post(
        "/api/v1/locations",
        json={"level": "Contenedor", "code": "NO-DEBE", "name": "Caja", "parent_id": level},
    )
    edited = client.put(f"/api/v1/locations/{level}", json={"name": "Otro"})

    assert tree.status_code == 200, tree.text
    assert added.status_code == 403
    assert edited.status_code == 403
