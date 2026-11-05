"""Spec auditoria-trazabilidad — Reversión por conjunto de cambios con vista previa.

Tareas 2.1 y 2.2 del change `auditoria-y-soft-delete-transversal` (RNF-007, RF-040, RN-002,
RN-005). Cubre el planificador fila por fila (UPDATE, CREATE, SOFT_DELETE, RESTORE, CORRECTION y
tablas de solo inserción), la detección de conflictos y la aplicación en una transacción.
"""

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import PermissionDenied, ValidationFailed
from app.models import AppUser, AuditLog, Piece, PieceIdentifier
from app.modules.audit.context import AuditContext
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.revert import (
    AlreadyReverted,
    ConflictReason,
    NothingToRevert,
    RevertHasConflicts,
    RevertItemKind,
    RevertPlanChanged,
    check_revert_permissions,
    plan_revert,
    revert_change_set,
    summarize_change_set,
)
from app.modules.audit.soft_delete import restore, soft_delete
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece, update_piece
from app.modules.identification.service import add_identifier, correct_locked_identifier
from app.modules.locations.models import LocationLevel
from app.modules.locations.service import create_location, move_piece
from tests.conftest import ActAs

REASON = "Reversión de prueba"


def ctx_for(users: dict[str, AppUser], role: str, **extra: object) -> AuditContext:
    values: dict[str, object] = {"reason": REASON}
    values.update(extra)
    return AuditContext(
        origin=values.pop("origin", AuditOrigin.MANUAL),  # type: ignore[arg-type]
        user_id=users[role].id,
        **values,  # type: ignore[arg-type]
    )


def last_change_set(session: Session, entity_id: uuid.UUID) -> uuid.UUID:
    row = session.scalars(
        select(AuditLog)
        .where(AuditLog.entity_id == entity_id)
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
    ).first()
    assert row is not None
    return row.change_set_id


def change_set_of(
    session: Session, entity_id: uuid.UUID, field: str, action: AuditAction
) -> uuid.UUID:
    row = session.scalars(
        select(AuditLog)
        .where(
            AuditLog.entity_id == entity_id,
            AuditLog.field == field,
            AuditLog.action == action,
        )
        .order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
    ).first()
    assert row is not None, f"no hay fila {action} de «{field}»"
    return row.change_set_id


def edited_piece(session: Session, act_as: ActAs) -> tuple[Piece, uuid.UUID]:
    """A piece whose last change set modified ``provenance`` and ``author``."""
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(
            session,
            denomination="Retablo sintético",
            tenure_regime=TenureRegime.OWNED,
            provenance="Ayacucho",
        )
        session.commit()
        update_piece(session, piece, provenance="Huancavelica", author="Taller ficticio 01")
        session.commit()
    return piece, last_change_set(session, piece.id)


# ---------------------------------------------------------------- 2.1 planner, row by row
def test_plan_restores_every_updated_field(session: Session, act_as: ActAs) -> None:
    _piece, change_set = edited_piece(session, act_as)
    plan = plan_revert(session, change_set)
    by_field = {item.field: item for item in plan.items}
    assert set(by_field) == {"provenance", "author"}
    assert all(item.kind is RevertItemKind.RESTORE_VALUE for item in plan.items)
    assert (by_field["provenance"].current_value, by_field["provenance"].target_value) == (
        "Huancavelica",
        "Ayacucho",
    )
    assert by_field["author"].target_value is None
    assert plan.conflicts == ()
    assert plan.required_permissions == ("pieces.update",)
    assert plan.requires_admin is False
    assert plan.preview_token


def test_plan_of_a_creation_soft_deletes_the_record(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, denomination="Quena", tenure_regime=TenureRegime.OWNED)
        session.commit()
    plan = plan_revert(session, last_change_set(session, piece.id))
    assert [item.kind for item in plan.items] == [RevertItemKind.SOFT_DELETE_ENTITY]
    assert plan.items[0].entity_type == "piece"
    assert plan.items[0].source_action is AuditAction.CREATE
    assert plan.items[0].applicable is True


def test_plan_of_a_soft_delete_restores_the_record(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, denomination="Tinya", tenure_regime=TenureRegime.OWNED)
        session.commit()
        soft_delete(session, piece, "Registrada por error")
        session.commit()
    plan = plan_revert(session, last_change_set(session, piece.id))
    assert [item.kind for item in plan.items] == [RevertItemKind.RESTORE_ENTITY]
    assert plan.items[0].source_action is AuditAction.SOFT_DELETE


def test_plan_of_a_restore_soft_deletes_the_record_again(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        piece = create_piece(session, denomination="Mate", tenure_regime=TenureRegime.OWNED)
        soft_delete(session, piece, "Error")
        session.commit()
        restore(session, piece, "Eliminación equivocada")
        session.commit()
    plan = plan_revert(session, last_change_set(session, piece.id))
    assert [item.kind for item in plan.items] == [RevertItemKind.SOFT_DELETE_ENTITY]
    assert plan.items[0].source_action is AuditAction.RESTORE


def test_plan_reports_movements_without_undoing_them(session: Session, act_as: ActAs) -> None:
    """Escenario «Movimientos en el conjunto»: no se modifican y la vista previa lo informa."""
    with act_as("ADMIN"):
        site = create_location(session, level=LocationLevel.SITE, code="S", name="Sede")
        space = create_location(
            session, level=LocationLevel.SPACE, code="S-D1", name="Depósito", parent=site
        )
        piece = create_piece(session, denomination="Olla", tenure_regime=TenureRegime.OWNED)
        session.commit()
        movement = move_piece(session, piece, space, "Ingreso a depósito")
        session.commit()
    plan = plan_revert(session, last_change_set(session, piece.id))
    notes = " ".join(plan.notes)
    assert "movimientos de ubicación" in notes
    assert "correctiva" in notes
    movement_items = [item for item in plan.items if item.entity_type == "piece_movement"]
    assert [item.entity_id for item in movement_items] == [movement.id]
    assert all(item.kind is RevertItemKind.APPEND_ONLY_NOTE for item in movement_items)
    assert all(not item.applicable for item in movement_items)
    # La ubicación vigente la mantiene el historial de movimientos: no se reescribe.
    assert plan.applicable_items == ()
    assert piece.current_location_id == space.id


def test_plan_of_an_inventory_code_correction_needs_the_correction_permission(
    session: Session, act_as: ActAs
) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, denomination="Cántaro", tenure_regime=TenureRegime.OWNED)
        identifier = add_identifier(session, piece, "I", "1234")
        session.commit()
    with act_as("ADMIN"):
        correct_locked_identifier(session, piece, "I", "4321", "Dígito invertido en el libro")
        session.commit()
    change_set = change_set_of(session, identifier.id, "is_current", AuditAction.CORRECTION)
    plan = plan_revert(session, change_set)
    assert plan.touches_inventory_code is True
    assert "identifiers.correct_inventory_code" in plan.required_permissions
    assert plan.requires_admin is True
    assert any(item.kind is RevertItemKind.CORRECT_INVENTORY_CODE for item in plan.items)


def test_plan_reports_a_later_change_as_a_conflict(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    piece, change_set = edited_piece(session, act_as)
    with act_as("CATALOGUER"):
        update_piece(session, piece, provenance="Cusco")
        session.commit()
    plan = plan_revert(session, change_set)
    conflicts = {conflict.field: conflict for conflict in plan.conflicts}
    assert set(conflicts) == {"provenance"}
    conflict = conflicts["provenance"]
    assert conflict.reason is ConflictReason.CHANGED_AFTER
    assert (conflict.expected_value, conflict.current_value) == ("Huancavelica", "Cusco")
    assert conflict.changed_by_id == users["CATALOGUER"].id
    assert conflict.changed_at is not None


def test_plan_reports_an_already_deleted_record_as_a_conflict(
    session: Session, act_as: ActAs
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, denomination="Vasija", tenure_regime=TenureRegime.OWNED)
        session.commit()
        creation = last_change_set(session, piece.id)
        soft_delete(session, piece, "Duplicada")
        session.commit()
    plan = plan_revert(session, creation)
    assert [conflict.reason for conflict in plan.conflicts] == [ConflictReason.ALREADY_DELETED]
    assert plan.applicable_items == ()


def test_preview_token_changes_when_the_data_changes(session: Session, act_as: ActAs) -> None:
    piece, change_set = edited_piece(session, act_as)
    first = plan_revert(session, change_set).preview_token
    assert plan_revert(session, change_set).preview_token == first
    with act_as("CATALOGUER"):
        update_piece(session, piece, provenance="Cusco")
        session.commit()
    assert plan_revert(session, change_set).preview_token != first


def test_summary_groups_the_change_set(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    _piece, change_set = edited_piece(session, act_as)
    summary = summarize_change_set(session, change_set)
    assert summary.change_set_id == change_set
    assert summary.user_id == users["COLLECTIONS_MANAGER"].id
    assert summary.origin is AuditOrigin.MANUAL
    assert summary.field_count == 2
    assert summary.entity_count == 1
    assert summary.entities[0].entity_type == "piece"
    assert summary.reverted is False


def test_unknown_change_set_is_not_found(session: Session, act_as: ActAs) -> None:
    from app.core.errors import NotFound

    with pytest.raises(NotFound):
        plan_revert(session, uuid.uuid4())


# ------------------------------------------------------- 2.2 revert_change_set, transaction
def test_revert_restores_both_fields_as_a_new_change_set(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    """Escenario «Revertir una edición sin conflictos»."""
    piece, change_set = edited_piece(session, act_as)
    plan = plan_revert(session, change_set)
    outcome = revert_change_set(
        session,
        change_set,
        ctx_for(users, "COLLECTIONS_MANAGER"),
        confirm_conflicts=False,
        preview_token=plan.preview_token,
    )
    session.commit()
    assert (piece.provenance, piece.author) == ("Ayacucho", None)
    assert outcome.reverted_fields == 2
    assert outcome.new_change_set_id != change_set
    rows = session.scalars(
        select(AuditLog).where(AuditLog.change_set_id == outcome.new_change_set_id)
    ).all()
    assert {row.action for row in rows} == {AuditAction.REVERT}
    assert {row.origin_ref for row in rows} == {str(change_set)}
    assert {row.field for row in rows} == {"provenance", "author"}
    assert {row.reason for row in rows} == {REASON}
    assert summarize_change_set(session, change_set).reverted is True


def test_revert_with_a_stale_preview_token_is_rejected(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    """Escenario «Plan modificado entre vista previa y confirmación» → 409."""
    piece, change_set = edited_piece(session, act_as)
    token = plan_revert(session, change_set).preview_token
    with act_as("CATALOGUER"):
        update_piece(session, piece, provenance="Cusco")
        session.commit()
    with pytest.raises(RevertPlanChanged) as raised:
        revert_change_set(
            session,
            change_set,
            ctx_for(users, "COLLECTIONS_MANAGER"),
            confirm_conflicts=True,
            preview_token=token,
        )
    assert raised.value.code == "revert_plan_changed"
    session.rollback()
    assert session.get(Piece, piece.id).provenance == "Cusco"


def test_a_change_set_cannot_be_reverted_twice(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    """Escenario «Conjunto ya revertido» → 409 con el conjunto de reversión."""
    _piece, change_set = edited_piece(session, act_as)
    outcome = revert_change_set(
        session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=False
    )
    session.commit()
    with pytest.raises(AlreadyReverted) as raised:
        revert_change_set(session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=False)
    assert raised.value.code == "already_reverted"
    assert raised.value.details["reverted_by_change_set_id"] == str(outcome.new_change_set_id)


def test_the_reversal_can_itself_be_reverted(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    piece, change_set = edited_piece(session, act_as)
    first = revert_change_set(session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=False)
    session.commit()
    assert piece.provenance == "Ayacucho"
    second = revert_change_set(
        session,
        first.new_change_set_id,
        ctx_for(users, "ADMIN", reason="Deshacer la reversión"),
        confirm_conflicts=False,
    )
    session.commit()
    assert (piece.provenance, piece.author) == ("Huancavelica", "Taller ficticio 01")
    assert second.reverted_fields == 2
    assert summarize_change_set(session, first.new_change_set_id).reverted is True


def test_revert_of_an_inventory_code_without_the_admin_procedure_is_rejected(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    """Escenario «Reversión que afecta un código I» → 403 (RN-002)."""
    with act_as("CATALOGUER"):
        piece = create_piece(session, denomination="Cántaro", tenure_regime=TenureRegime.OWNED)
        identifier = add_identifier(session, piece, "I", "1234")
        session.commit()
    with act_as("ADMIN"):
        correct_locked_identifier(session, piece, "I", "4321", "Dígito invertido en el libro")
        session.commit()
    change_set = change_set_of(session, identifier.id, "is_current", AuditAction.CORRECTION)
    plan = plan_revert(session, change_set)
    manager = ctx_for(users, "COLLECTIONS_MANAGER")
    # Desde ficha-pieza-crud 1.4 el permiso de corrección es solo del Administrador.
    with pytest.raises(PermissionDenied) as missing:
        revert_change_set(session, change_set, manager, confirm_conflicts=True)
    assert missing.value.details["permissions"] == ["identifiers.correct_inventory_code"]
    # Aunque la matriz le conceda el permiso, sigue faltando el rol (Ñ2).
    with pytest.raises(PermissionDenied) as raised:
        check_revert_permissions(
            session, plan, manager, permissions=frozenset(plan.required_permissions)
        )
    assert raised.value.code == "admin_required"
    assert "Administrador" in raised.value.message
    # El Administrador sí supera la verificación de permisos del mismo plan.
    check_revert_permissions(session, plan, ctx_for(users, "ADMIN"))


def test_revert_of_an_import_change_set_requires_the_import_permission(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    """[SUPUESTO B7]: importación → `imports.revert`; el Gestor no lo tiene en la matriz."""
    with act_as("CATALOGUER"):
        piece = create_piece(session, denomination="Manta", tenure_regime=TenureRegime.OWNED)
        session.commit()
    with act_as("COLLECTIONS_MANAGER", origin=AuditOrigin.IMPORT, origin_ref="batch-42"):
        update_piece(session, piece, author="Autor sintético")
        session.commit()
    change_set = last_change_set(session, piece.id)
    plan = plan_revert(session, change_set)
    assert plan.required_permissions == ("imports.revert",)
    with pytest.raises(PermissionDenied) as raised:
        revert_change_set(
            session, change_set, ctx_for(users, "COLLECTIONS_MANAGER"), confirm_conflicts=False
        )
    assert raised.value.details["permissions"] == ["imports.revert"]
    session.rollback()
    revert_change_set(session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=False)
    session.commit()
    assert session.get(Piece, piece.id).author is None


def test_conflicts_need_explicit_confirmation_and_are_then_applied(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    piece, change_set = edited_piece(session, act_as)
    with act_as("CATALOGUER"):
        update_piece(session, piece, provenance="Cusco")
        session.commit()
    with pytest.raises(RevertHasConflicts) as raised:
        revert_change_set(session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=False)
    assert raised.value.details["conflicts"][0]["field"] == "provenance"
    session.rollback()
    outcome = revert_change_set(
        session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=True
    )
    session.commit()
    assert piece.provenance == "Ayacucho"
    assert len(outcome.conflicts) == 1


def test_revert_of_a_creation_soft_deletes_the_piece(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, denomination="Trompo", tenure_regime=TenureRegime.OWNED)
        session.commit()
    change_set = last_change_set(session, piece.id)
    outcome = revert_change_set(
        session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=False
    )
    session.commit()
    session.expunge_all()
    assert session.get(Piece, piece.id) is None
    stored = session.get(Piece, piece.id, execution_options={INCLUDE_DELETED: True})
    assert stored is not None and stored.deletion_reason == REASON
    assert outcome.deleted_entities == 1
    actions = set(
        session.scalars(
            select(AuditLog.action).where(AuditLog.change_set_id == outcome.new_change_set_id)
        )
    )
    assert actions == {AuditAction.SOFT_DELETE}


def test_revert_of_a_soft_delete_restores_the_piece(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, denomination="Zampoña", tenure_regime=TenureRegime.OWNED)
        session.commit()
        soft_delete(session, piece, "Eliminada por error")
        session.commit()
    change_set = last_change_set(session, piece.id)
    outcome = revert_change_set(
        session, change_set, ctx_for(users, "COLLECTIONS_MANAGER"), confirm_conflicts=False
    )
    session.commit()
    session.expunge_all()
    assert session.get(Piece, piece.id) is not None
    assert outcome.restored_entities == 1


def test_revert_requires_a_reason(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    _piece, change_set = edited_piece(session, act_as)
    with pytest.raises(ValidationFailed) as raised:
        revert_change_set(
            session, change_set, ctx_for(users, "ADMIN", reason="  "), confirm_conflicts=False
        )
    assert raised.value.code == "reason_required"


def test_a_change_set_with_only_append_only_rows_has_nothing_to_revert(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("ADMIN"):
        site = create_location(session, level=LocationLevel.SITE, code="S2", name="Sede")
        space = create_location(
            session, level=LocationLevel.SPACE, code="S2-D1", name="Depósito", parent=site
        )
        piece = create_piece(session, denomination="Cesta", tenure_regime=TenureRegime.OWNED)
        session.commit()
        move_piece(session, piece, space, "Ingreso")
        session.commit()
    change_set = last_change_set(session, piece.id)
    with pytest.raises(NothingToRevert) as raised:
        revert_change_set(session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=True)
    assert raised.value.code == "nothing_to_revert"
    assert raised.value.details["notes"]


def test_reverting_an_inventory_identifier_keeps_it_in_the_history(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    """Revertir la creación de un código I no lo borra: queda eliminado lógicamente (RN-005)."""
    with act_as("ADMIN"):
        piece = create_piece(session, denomination="Pututo", tenure_regime=TenureRegime.OWNED)
        session.commit()
        identifier = add_identifier(session, piece, "I", "9876")
        session.commit()
    change_set = last_change_set(session, identifier.id)
    plan = plan_revert(session, change_set)
    assert plan.touches_inventory_code is True
    assert plan.requires_admin is True
    revert_change_set(session, change_set, ctx_for(users, "ADMIN"), confirm_conflicts=True)
    session.commit()
    stored = session.get(PieceIdentifier, identifier.id, execution_options={INCLUDE_DELETED: True})
    assert stored is not None and stored.deleted_at is not None
