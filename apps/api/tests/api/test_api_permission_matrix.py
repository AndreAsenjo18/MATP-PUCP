"""Seeded permission matrix: restoring and correcting the code I are Administrator-only.

Change ficha-pieza-crud, task 1.4: the dependency of the route and the role check of the
service agree, so the 403 is reproducible before reaching the service; the trash is opened
with its own `trash.read` [SUPUESTO Ñ3, B7]. Synthetic data only (RNF-014).
"""

import uuid

from app.seed.reference import ROLE_PERMISSIONS
from tests.api.conftest import SeededApi

ADMIN_ONLY = ("pieces.restore", "identifiers.correct_inventory_code")


def _holders(permission: str) -> set[str]:
    return {role for role, granted in ROLE_PERMISSIONS.items() if permission in granted}


def test_restoring_and_correcting_the_code_i_are_only_for_the_administrator() -> None:
    assert {permission: _holders(permission) for permission in ADMIN_ONLY} == {
        permission: {"ADMIN"} for permission in ADMIN_ONLY
    }


def test_the_trash_is_opened_by_the_administrator_and_the_manager() -> None:
    assert _holders("trash.read") == {"ADMIN", "COLLECTIONS_MANAGER"}


def test_a_manager_or_a_cataloguer_gets_403_from_the_route(seeded_api: SeededApi) -> None:
    piece_id, identifier_id = uuid.uuid4(), uuid.uuid4()
    for role in ("COLLECTIONS_MANAGER", "CATALOGUER"):
        client = seeded_api.login_as(role)

        restore = client.post(f"/api/v1/pieces/{piece_id}/restore")
        correction = client.post(
            f"/api/v1/pieces/{piece_id}/identifiers/{identifier_id}/correction",
            json={"new_value": "I-2363", "reason": "Error de transcripción (sintético)"},
        )

        assert restore.status_code == 403, (role, restore.text)
        assert restore.json()["details"]["permission"] == "pieces.restore"
        assert correction.status_code == 403, (role, correction.text)
        assert correction.json()["details"]["permission"] == "identifiers.correct_inventory_code"


def test_the_manager_still_opens_the_trash_and_the_cataloguer_does_not(
    seeded_api: SeededApi,
) -> None:
    assert seeded_api.login_as("COLLECTIONS_MANAGER").get("/api/v1/trash").status_code == 200
    assert seeded_api.login_as("CATALOGUER").get("/api/v1/trash").status_code == 403
