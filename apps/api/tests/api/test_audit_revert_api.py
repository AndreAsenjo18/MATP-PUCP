"""Spec auditoria-trazabilidad — Operaciones HTTP de reversión por conjunto de cambios.

Tarea 2.3 del change `auditoria-y-soft-delete-transversal` (RNF-007, RF-040, RN-002):

- `GET  /api/v1/audit/change-sets/{id}`
- `POST /api/v1/audit/change-sets/{id}/revert-preview`
- `POST /api/v1/audit/change-sets/{id}/revert`

El router `app/api/v1/audit_revert.py` todavía **no** está registrado en `app/api/v1/__init__.py`
para no desactualizar `docs/api/openapi.json` ni el contrato (lo regenera la tarea 6.2 al
integrar, tras eliminar el stub de `POST .../revert` que sigue declarado en `admin.py`). Estas
pruebas montan una aplicación con las mismas dependencias (identidad, permisos, sesión y
manejadores de error) y solo este router, de modo que no compiten con ese stub.
"""

import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.errors import install_error_handlers
from app.api.v1 import API_PREFIX, audit_revert
from app.core.db import make_session_factory
from app.main import operation_id
from app.models import AppUser, AuditLog, Base, Piece
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece, update_piece
from app.modules.identification.service import add_identifier, correct_locked_identifier
from app.seed.synthetic import SeedOptions, run_seed
from tests.api.conftest import ADMIN, CATALOGUER, MANAGER, VIEWER, api_settings, as_user

REVERT_PATH = "/api/v1/audit/change-sets/{}/revert"
PREVIEW_PATH = "/api/v1/audit/change-sets/{}/revert-preview"
SUMMARY_PATH = "/api/v1/audit/change-sets/{}"


def build_revert_app(engine: Engine) -> FastAPI:
    """Application with the production dependencies and only the reversal router."""
    app = FastAPI(title="MATP API (reversión)", generate_unique_id_function=operation_id)
    app.state.settings = api_settings()
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    install_error_handlers(app)
    app.include_router(audit_revert.router, prefix=API_PREFIX)
    return app


@dataclass
class RevertApi:
    engine: Engine
    client: TestClient

    def session(self) -> Session:
        return make_session_factory(self.engine)()

    def get(self, url: str, **kwargs: Any) -> Any:
        return self.client.get(url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> Any:
        return self.client.post(url, **kwargs)

    def user_id(self, email: str) -> uuid.UUID:
        with self.session() as session:
            return session.scalars(select(AppUser).where(AppUser.email == email)).one().id

    def acting_as(self, email: str) -> AuditContext:
        return AuditContext(origin=AuditOrigin.MANUAL, user_id=self.user_id(email))

    def piece(self, piece_id: uuid.UUID) -> Piece:
        with self.session() as session:
            piece = session.get(Piece, piece_id, execution_options={INCLUDE_DELETED: True})
            assert piece is not None
            session.expunge(piece)
            return piece

    def edit_a_piece(self, email: str = MANAGER) -> tuple[uuid.UUID, uuid.UUID]:
        """Create a piece and edit two of its fields; return (piece_id, change_set_id)."""
        with self.session() as session, audit_context(session, self.acting_as(email)):
            piece = create_piece(
                session,
                denomination=f"Retablo sintético {uuid.uuid4().hex[:6]}",
                tenure_regime=TenureRegime.OWNED,
                provenance="Ayacucho",
            )
            session.commit()
            update_piece(session, piece, provenance="Huancavelica", author="Taller ficticio 01")
            session.commit()
            row = session.scalars(
                select(AuditLog)
                .where(AuditLog.entity_id == piece.id)
                .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
            ).first()
            assert row is not None
            return piece.id, row.change_set_id

    def token(self, change_set: uuid.UUID, email: str = ADMIN) -> str:
        response = self.post(PREVIEW_PATH.format(change_set), headers=as_user(email))
        assert response.status_code == 200, response.text
        return str(response.json()["preview_token"])

    def update_provenance(self, piece_id: uuid.UUID, value: str, email: str) -> None:
        with self.session() as session, audit_context(session, self.acting_as(email)):
            piece = session.get(Piece, piece_id)
            assert piece is not None
            update_piece(session, piece, provenance=value)
            session.commit()


@pytest.fixture(scope="module")
def api() -> Iterator[RevertApi]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    event.listen(engine, "connect", lambda conn, _r: conn.execute("PRAGMA foreign_keys=ON"))
    factory = make_session_factory(engine)
    Base.metadata.create_all(engine)
    with factory() as session:
        run_seed(session, SeedOptions(upload_media=False))
        session.commit()
    with TestClient(build_revert_app(engine)) as client:
        yield RevertApi(engine=engine, client=client)
    engine.dispose()


def test_summary_and_preview_describe_the_change_set(api: RevertApi) -> None:
    piece_id, change_set = api.edit_a_piece()

    summary = api.get(SUMMARY_PATH.format(change_set), headers=as_user(ADMIN))
    assert summary.status_code == 200
    body = summary.json()
    assert body["change_set_id"] == str(change_set)
    assert body["origin"] == "MANUAL"
    assert body["field_count"] == 2
    assert body["entities"] == [
        {"entity_type": "piece", "entity_id": str(piece_id), "field_count": 2}
    ]
    assert body["reverted"] is False

    preview = api.post(PREVIEW_PATH.format(change_set), headers=as_user(ADMIN))
    assert preview.status_code == 200
    plan = preview.json()
    assert plan["preview_token"]
    assert plan["applicable_count"] == 2
    assert plan["conflicts"] == []
    assert plan["required_permissions"] == ["pieces.update"]
    assert plan["touches_inventory_code"] is False
    by_field = {item["field"]: item for item in plan["items"]}
    assert by_field["provenance"]["target_value"] == "Ayacucho"
    assert by_field["provenance"]["current_value"] == "Huancavelica"
    assert by_field["provenance"]["kind"] == "RESTORE_VALUE"
    assert "Restaurar" in by_field["provenance"]["description"]


def test_revert_restores_the_values_and_records_the_reversal(api: RevertApi) -> None:
    """Escenario «Revertir una edición sin conflictos»."""
    piece_id, change_set = api.edit_a_piece()
    token = api.post(PREVIEW_PATH.format(change_set), headers=as_user(MANAGER)).json()[
        "preview_token"
    ]
    response = api.post(
        REVERT_PATH.format(change_set),
        json={"reason": "La edición se aplicó a la pieza equivocada", "preview_token": token},
        headers=as_user(MANAGER),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["reverted_change_set_id"] == str(change_set)
    assert body["new_change_set_id"] != str(change_set)
    assert body["reverted_fields"] == 2
    piece = api.piece(piece_id)
    assert (piece.provenance, piece.author) == ("Ayacucho", None)

    summary = api.get(SUMMARY_PATH.format(change_set), headers=as_user(ADMIN)).json()
    assert summary["reverted"] is True
    assert summary["reverted_by_change_set_id"] == body["new_change_set_id"]
    reversal = api.get(
        SUMMARY_PATH.format(body["new_change_set_id"]), headers=as_user(ADMIN)
    ).json()
    assert reversal["actions"] == [AuditAction.REVERT.value]
    assert reversal["reverts_change_set_id"] == str(change_set)
    assert reversal["reason"] == "La edición se aplicó a la pieza equivocada"


def test_revert_with_a_stale_token_returns_409(api: RevertApi) -> None:
    """Escenario «Plan modificado entre vista previa y confirmación»."""
    piece_id, change_set = api.edit_a_piece()
    token = api.post(PREVIEW_PATH.format(change_set), headers=as_user(ADMIN)).json()[
        "preview_token"
    ]
    api.update_provenance(piece_id, "Cusco", CATALOGUER)
    response = api.post(
        REVERT_PATH.format(change_set),
        json={
            "reason": "Reversión solicitada por la curadora",
            "preview_token": token,
            "confirm_conflicts": True,
        },
        headers=as_user(ADMIN),
    )
    assert response.status_code == 409
    assert response.json()["code"] == "revert_plan_changed"
    assert response.json()["details"]["preview_token"] != token
    assert api.piece(piece_id).provenance == "Cusco"


def test_reverting_an_already_reverted_change_set_returns_409(api: RevertApi) -> None:
    """Escenario «Conjunto ya revertido»: indica el conjunto de reversión existente."""
    _piece_id, change_set = api.edit_a_piece()
    first = api.post(
        REVERT_PATH.format(change_set),
        json={"reason": "Primera reversión", "preview_token": api.token(change_set)},
        headers=as_user(ADMIN),
    )
    assert first.status_code == 200, first.text
    again = api.post(
        REVERT_PATH.format(change_set),
        json={"reason": "Segunda reversión", "preview_token": api.token(change_set)},
        headers=as_user(ADMIN),
    )
    assert again.status_code == 409
    body = again.json()
    assert body["code"] == "already_reverted"
    assert body["details"]["reverted_by_change_set_id"] == first.json()["new_change_set_id"]
    # El conjunto de reversión sí puede revertirse.
    reversal = uuid.UUID(first.json()["new_change_set_id"])
    undo = api.post(
        REVERT_PATH.format(reversal),
        json={"reason": "Deshacer la reversión", "preview_token": api.token(reversal)},
        headers=as_user(ADMIN),
    )
    assert undo.status_code == 200, undo.text


def test_revert_touching_an_inventory_code_without_the_procedure_returns_403(
    api: RevertApi,
) -> None:
    """Escenario «Reversión que afecta un código I» → 403 (RN-002)."""
    with api.session() as session, audit_context(session, api.acting_as(ADMIN)):
        piece = create_piece(
            session,
            denomination=f"Cántaro sintético {uuid.uuid4().hex[:6]}",
            tenure_regime=TenureRegime.OWNED,
        )
        identifier = add_identifier(session, piece, "I", "987654")
        session.commit()
        correct_locked_identifier(session, piece, "I", "987645", "Dígitos invertidos")
        session.commit()
        row = session.scalars(
            select(AuditLog).where(
                AuditLog.entity_id == identifier.id,
                AuditLog.field == "is_current",
                AuditLog.action == AuditAction.CORRECTION,
            )
        ).first()
        assert row is not None
        change_set = row.change_set_id

    preview = api.post(PREVIEW_PATH.format(change_set), headers=as_user(MANAGER)).json()
    assert preview["touches_inventory_code"] is True
    assert preview["requires_admin"] is True
    assert "identifiers.correct_inventory_code" in preview["required_permissions"]
    response = api.post(
        REVERT_PATH.format(change_set),
        json={
            "reason": "La corrección del código I fue un error",
            "preview_token": preview["preview_token"],
            "confirm_conflicts": True,
        },
        headers=as_user(MANAGER),
    )
    assert response.status_code == 403
    # Desde ficha-pieza-crud 1.4 el Gestor ya no tiene el permiso de corrección; el rol que
    # falta aunque se tenga el permiso lo cubre tests/test_audit_revert.py.
    assert response.json()["details"]["permissions"] == ["identifiers.correct_inventory_code"]


def test_revert_without_the_origin_permission_returns_403(api: RevertApi) -> None:
    _piece_id, change_set = api.edit_a_piece()
    # La consulta interna no puede ni abrir la vista previa (no tiene `audit.read`).
    assert api.post(PREVIEW_PATH.format(change_set), headers=as_user(VIEWER)).status_code == 403
    response = api.post(
        REVERT_PATH.format(change_set),
        json={
            "reason": "Intento sin permiso de edición",
            "preview_token": api.token(change_set),
        },
        headers=as_user(VIEWER),
    )
    assert response.status_code == 403
    assert response.json()["details"]["permissions"] == ["pieces.update"]


def test_conflicts_require_explicit_confirmation(api: RevertApi) -> None:
    piece_id, change_set = api.edit_a_piece()
    api.update_provenance(piece_id, "Cusco", CATALOGUER)
    token = api.token(change_set)
    response = api.post(
        REVERT_PATH.format(change_set),
        json={"reason": "Reversión con conflicto", "preview_token": token},
        headers=as_user(ADMIN),
    )
    assert response.status_code == 409
    assert response.json()["code"] == "revert_has_conflicts"
    conflict = response.json()["details"]["conflicts"][0]
    assert (conflict["field"], conflict["current_value"]) == ("provenance", "Cusco")
    confirmed = api.post(
        REVERT_PATH.format(change_set),
        json={
            "reason": "Reversión con conflicto",
            "preview_token": token,
            "confirm_conflicts": True,
        },
        headers=as_user(ADMIN),
    )
    assert confirmed.status_code == 200, confirmed.text
    assert api.piece(piece_id).provenance == "Ayacucho"
    assert len(confirmed.json()["conflicts"]) == 1


def test_unknown_change_set_returns_404(api: RevertApi) -> None:
    missing = uuid.uuid4()
    assert api.get(SUMMARY_PATH.format(missing), headers=as_user(ADMIN)).status_code == 404
    assert api.post(PREVIEW_PATH.format(missing), headers=as_user(ADMIN)).status_code == 404
    response = api.post(
        REVERT_PATH.format(missing),
        json={"reason": "No existe", "preview_token": "cualquiera"},
        headers=as_user(ADMIN),
    )
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_operations_require_identity_and_the_audit_permission(api: RevertApi) -> None:
    change_set = uuid.uuid4()
    assert api.get(SUMMARY_PATH.format(change_set)).status_code == 401
    assert api.post(PREVIEW_PATH.format(change_set)).status_code == 401
    # `audit.read` no lo tiene el catalogador en la matriz de permisos sintética.
    assert api.get(SUMMARY_PATH.format(change_set), headers=as_user(CATALOGUER)).status_code == 403
    assert api.post(PREVIEW_PATH.format(change_set), headers=as_user(CATALOGUER)).status_code == 403


def test_revert_requires_a_reason_and_a_preview_token(api: RevertApi) -> None:
    _piece_id, change_set = api.edit_a_piece()
    short_reason = api.post(
        REVERT_PATH.format(change_set),
        json={"reason": "x", "preview_token": api.token(change_set)},
        headers=as_user(ADMIN),
    )
    assert short_reason.status_code == 422
    assert short_reason.json()["code"] == "request_validation_failed"
    without_token = api.post(
        REVERT_PATH.format(change_set),
        json={"reason": "Reversión sin vista previa"},
        headers=as_user(ADMIN),
    )
    assert without_token.status_code == 422
    assert ["body", "preview_token"] in [
        field["location"] for field in without_token.json()["details"]["fields"]
    ]


def test_the_three_operations_are_declared_as_implemented() -> None:
    declared = {
        (route.path, tuple(sorted(route.methods)), route.name)
        for route in audit_revert.router.routes
        if isinstance(route, APIRoute)
    }
    assert declared == {
        ("/audit/change-sets/{change_set_id}", ("GET",), "get_change_set"),
        (
            "/audit/change-sets/{change_set_id}/revert-preview",
            ("POST",),
            "preview_change_set_revert",
        ),
        ("/audit/change-sets/{change_set_id}/revert", ("POST",), "revert_change_set"),
    }
    for route in audit_revert.router.routes:
        if isinstance(route, APIRoute):
            assert route.openapi_extra == {"x-status": "implemented"}, route.path
            assert route.summary, route.path
