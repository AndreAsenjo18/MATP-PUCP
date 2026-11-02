"""The location filter respects the scope of the role (RF-041; spec usuarios-roles).

Without ``sensitive.exact_location``, a role works with sites and spaces: the places below them
are out of its scope, in the same terms as the reports. Synthetic data only (RNF-014).
"""

import uuid
from typing import Any

import pytest
from sqlalchemy import func, select

from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.locations.models import Location, LocationLevel
from app.modules.search.models import ExportJobModel
from app.modules.users.models import Permission, Role, RolePermission
from tests.api.conftest import LoginAs, Pipeline, SeededApi

ROUTES = ("/api/v1/search", "/api/v1/pieces")
EXPORT = "/api/v1/reports/export-excel"
OUT_OF_SCOPE = (LocationLevel.FURNITURE, LocationLevel.SHELF_LEVEL, LocationLevel.CONTAINER)
IN_SCOPE = (LocationLevel.SITE, LocationLevel.SPACE)


def _places_with_pieces(session: Any) -> dict[LocationLevel, str]:
    """A place of each level, on the way from a container with pieces up to its site."""
    node = session.scalar(
        select(Location)
        .join(Piece, Piece.current_location_id == Location.id)
        .where(Location.level == LocationLevel.CONTAINER, Piece.deleted_at.is_(None))
        .order_by(Location.code)
        .limit(1)
    )
    places: dict[LocationLevel, str] = {}
    while node is not None:
        places[node.level] = str(node.id)
        node = session.get(Location, node.parent_id) if node.parent_id else None
    return places


@pytest.fixture(scope="module")
def places(seeded_api: SeededApi) -> dict[LocationLevel, str]:
    with seeded_api.session() as session:
        found = _places_with_pieces(session)
    assert set(found) == {*OUT_OF_SCOPE, *IN_SCOPE}
    return found


def _total(client: Any, route: str, place: str) -> int:
    response = client.get(route, params={"location_id": place})
    assert response.status_code == 200, response.text
    return response.json()["total"]


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize("level", OUT_OF_SCOPE)
def test_a_limited_role_gets_no_pieces_from_a_place_out_of_its_scope(
    login_as: LoginAs, places: dict[LocationLevel, str], route: str, level: LocationLevel
) -> None:
    place = places[level]
    assert _total(login_as("ADMIN"), route, place) > 0

    response = login_as("INTERNAL_VIEWER").get(route, params={"location_id": place})

    assert response.status_code == 403, response.text
    body = response.json()
    assert body["code"] == "exact_location_required"
    assert "items" not in body and "total" not in body


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize("role", ("ADMIN", "COLLECTIONS_MANAGER", "STORAGE_STAFF"))
@pytest.mark.parametrize("level", (*IN_SCOPE, *OUT_OF_SCOPE))
def test_a_role_with_exact_location_keeps_filtering_by_any_level(
    login_as: LoginAs,
    places: dict[LocationLevel, str],
    route: str,
    role: str,
    level: LocationLevel,
) -> None:
    assert _total(login_as(role), route, places[level]) > 0


@pytest.mark.parametrize("route", ROUTES)
@pytest.mark.parametrize("level", IN_SCOPE)
def test_a_limited_role_keeps_filtering_inside_its_scope(
    login_as: LoginAs, places: dict[LocationLevel, str], route: str, level: LocationLevel
) -> None:
    """Site and space still include what is below them, as for any other role."""
    place = places[level]

    total = _total(login_as("INTERNAL_VIEWER"), route, place)

    assert total > 0
    assert total == _total(login_as("ADMIN"), route, place)


@pytest.mark.parametrize("route", ROUTES)
def test_an_unknown_place_is_still_an_empty_result(login_as: LoginAs, route: str) -> None:
    assert _total(login_as("INTERNAL_VIEWER"), route, str(uuid.uuid4())) == 0


@pytest.mark.parametrize("route", ROUTES)
def test_a_limited_role_keeps_searching_without_that_filter(login_as: LoginAs, route: str) -> None:
    response = login_as("INTERNAL_VIEWER").get(route)

    assert response.status_code == 200, response.text
    assert response.json()["total"] > 0


def _grant(pipeline: Pipeline, role_code: str, permission_code: str) -> None:
    """On the database of this module only: no seeded role exports without exact location."""
    context = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")
    with pipeline.session() as session, audit_context(session, context):
        role = session.scalar(select(Role).where(Role.code == role_code))
        permission = session.scalar(select(Permission).where(Permission.code == permission_code))
        assert role is not None and permission is not None
        session.add(RolePermission(role_id=role.id, permission_id=permission.id))
        session.commit()


def test_the_export_respects_the_same_scope(pipeline: Pipeline) -> None:
    _grant(pipeline, "INTERNAL_VIEWER", "exports.run")
    with pipeline.session() as session:
        places = _places_with_pieces(session)
        jobs = session.scalar(select(func.count()).select_from(ExportJobModel))
    client = pipeline.login("INTERNAL_VIEWER")

    out_of_scope = client.post(
        EXPORT, json={"filters": {"location_id": places[LocationLevel.CONTAINER]}}
    )
    in_scope = client.post(EXPORT, json={"filters": {"location_id": places[LocationLevel.SPACE]}})

    assert out_of_scope.status_code == 403, out_of_scope.text
    assert out_of_scope.json()["code"] == "exact_location_required"
    assert in_scope.status_code == 200, in_scope.text
    with pipeline.session() as session:
        assert session.scalar(select(func.count()).select_from(ExportJobModel)) == jobs
