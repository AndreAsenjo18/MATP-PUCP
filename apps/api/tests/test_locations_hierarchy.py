"""Unit tests for the location hierarchy rules (RF-016, design D1): allowed parents, code
normalization and cycle detection. Change ubicacion-jerarquica-y-movimientos, task 1.2."""

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.errors import ValidationFailed
from app.models import Base
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditOrigin
from app.modules.locations import hierarchy
from app.modules.locations.models import Location, LocationLevel


@pytest.fixture
def session() -> Session:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    Base.metadata.create_all(engine)
    with Session(engine) as db_session:
        set_audit_context(
            db_session, AuditContext(origin=AuditOrigin.SYSTEM, actor_label="test-fixture")
        )
        yield db_session


def _location(level: LocationLevel, code: str, *, parent: Location | None = None) -> Location:
    return Location(level=level, code=code, name=code, parent_id=parent.id if parent else None)


@pytest.mark.parametrize(
    ("level", "parent_level"),
    [
        (LocationLevel.SITE, None),
        (LocationLevel.SPACE, LocationLevel.SITE),
        (LocationLevel.FURNITURE, LocationLevel.SPACE),
        (LocationLevel.SHELF_LEVEL, LocationLevel.FURNITURE),
        (LocationLevel.CONTAINER, LocationLevel.SHELF_LEVEL),
        (LocationLevel.CONTAINER, LocationLevel.FURNITURE),
    ],
)
def test_allowed_parent_accepts_valid_combinations(
    level: LocationLevel, parent_level: LocationLevel | None
) -> None:
    hierarchy.assert_allowed_parent(level, parent_level)  # no debe lanzar


@pytest.mark.parametrize(
    ("level", "parent_level"),
    [
        (LocationLevel.SHELF_LEVEL, LocationLevel.SITE),
        (LocationLevel.SPACE, None),
        (LocationLevel.CONTAINER, LocationLevel.SITE),
        (LocationLevel.SITE, LocationLevel.SPACE),
    ],
)
def test_allowed_parent_rejects_invalid_combinations(
    level: LocationLevel, parent_level: LocationLevel | None
) -> None:
    with pytest.raises(ValidationFailed) as exc_info:
        hierarchy.assert_allowed_parent(level, parent_level)
    assert exc_info.value.code == "invalid_location_parent"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("dep2-rb", "DEP2-RB"),
        ("  Dep2   RB  ", "DEP2 RB"),
        ("M.M.Z.", "M.M.Z."),
    ],
)
def test_normalize_code(raw: str, expected: str) -> None:
    assert hierarchy.normalize_code(raw) == expected


def test_full_path_from_site_to_container(session: Session) -> None:
    site = _location(LocationLevel.SITE, "SITE")
    session.add(site)
    session.flush()
    space = _location(LocationLevel.SPACE, "SPACE", parent=site)
    session.add(space)
    session.flush()
    furniture = _location(LocationLevel.FURNITURE, "FURN", parent=space)
    session.add(furniture)
    session.flush()

    path = hierarchy.full_path(session, furniture)
    assert [node.code for node in path] == ["SITE", "SPACE", "FURN"]


def test_subtree_ids_includes_all_descendants(session: Session) -> None:
    site = _location(LocationLevel.SITE, "SITE")
    session.add(site)
    session.flush()
    space_a = _location(LocationLevel.SPACE, "A", parent=site)
    space_b = _location(LocationLevel.SPACE, "B", parent=site)
    session.add_all([space_a, space_b])
    session.flush()
    furniture = _location(LocationLevel.FURNITURE, "FURN", parent=space_a)
    session.add(furniture)
    session.flush()

    ids = hierarchy.subtree_ids(session, site.id)
    assert ids == {site.id, space_a.id, space_b.id, furniture.id}

    ids_a = hierarchy.subtree_ids(session, space_a.id)
    assert ids_a == {space_a.id, furniture.id}


def test_would_cycle_detects_moving_a_node_under_its_own_descendant(session: Session) -> None:
    site = _location(LocationLevel.SITE, "SITE")
    session.add(site)
    session.flush()
    space = _location(LocationLevel.SPACE, "SPACE", parent=site)
    session.add(space)
    session.flush()
    furniture = _location(LocationLevel.FURNITURE, "FURN", parent=space)
    session.add(furniture)
    session.flush()

    assert hierarchy.would_cycle(session, space.id, furniture.id) is True
    assert hierarchy.would_cycle(session, space.id, space.id) is True
    assert hierarchy.would_cycle(session, furniture.id, site.id) is False
