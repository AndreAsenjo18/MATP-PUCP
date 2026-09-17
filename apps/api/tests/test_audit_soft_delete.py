"""Spec auditoria-trazabilidad: auditoría campo a campo, sin borrado físico, contexto obligatorio.

RF-040, RNF-006, RNF-007, RN-005.
"""

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import (
    AppendOnlyViolation,
    MissingAuditContext,
    PermissionDenied,
    PhysicalDeleteForbidden,
    ValidationFailed,
)
from app.core.models_base import new_uuid
from app.models import AppUser, AuditLog, Piece, PieceMovement
from app.modules.audit.context import AuditContext, audit_context
from app.modules.audit.models import AuditAction, AuditOrigin
from app.modules.audit.soft_delete import restore, soft_delete
from app.modules.audit.tracking import INCLUDE_DELETED
from app.modules.catalog.enums import TenureRegime
from app.modules.catalog.service import create_piece, update_piece
from app.modules.locations.models import LocationLevel
from app.modules.locations.service import create_location, move_piece
from tests.conftest import ActAs


def _audit_count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(AuditLog)) or 0


def test_write_without_audit_context_is_rejected_and_nothing_is_saved(
    session: Session, users: dict[str, AppUser]
) -> None:
    session.add(Piece(id=new_uuid(), title="Sin contexto", tenure_regime=TenureRegime.OWNED))
    with pytest.raises(MissingAuditContext):
        session.flush()
    session.rollback()
    assert session.scalar(select(func.count()).select_from(Piece)) == 0


def test_service_without_context_is_rejected(session: Session, users: dict[str, AppUser]) -> None:
    with pytest.raises(MissingAuditContext):
        create_piece(session, title="Sin contexto", tenure_regime=TenureRegime.OWNED)


def test_context_requires_user_or_system_process() -> None:
    with pytest.raises(MissingAuditContext):
        AuditContext(origin=AuditOrigin.MANUAL)
    with pytest.raises(MissingAuditContext):
        AuditContext(origin=AuditOrigin.SYSTEM)
    AuditContext(origin=AuditOrigin.SYSTEM, actor_label="seed")


@pytest.mark.parametrize("origin", [AuditOrigin.IMPORT, AuditOrigin.AI])
def test_import_and_ai_changes_require_reference(origin: AuditOrigin) -> None:
    with pytest.raises(MissingAuditContext):
        AuditContext(origin=origin, actor_label="x", user_id=new_uuid())


def test_manual_edit_is_audited_field_by_field(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(
            session, title="Retablo", tenure_regime=TenureRegime.OWNED, provenance="Ayacucho"
        )
        session.commit()
        before = _audit_count(session)
        update_piece(session, piece, provenance="Huancavelica", author="Taller ficticio 01")
        session.commit()
    entries = session.scalars(
        select(AuditLog).where(
            AuditLog.entity_id == piece.id, AuditLog.action == AuditAction.UPDATE
        )
    ).all()
    assert _audit_count(session) == before + 2
    by_field = {entry.field: entry for entry in entries}
    assert (by_field["provenance"].old_value, by_field["provenance"].new_value) == (
        "Ayacucho",
        "Huancavelica",
    )
    assert by_field["author"].old_value is None
    assert by_field["provenance"].user_id == users["CATALOGUER"].id
    assert by_field["provenance"].origin is AuditOrigin.MANUAL
    assert by_field["provenance"].entity_type == "piece"
    assert len({entry.change_set_id for entry in entries}) == 1


def test_creation_is_audited_per_field(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, title="Quena", tenure_regime=TenureRegime.OWNED)
        session.commit()
    fields = set(
        session.scalars(
            select(AuditLog.field).where(
                AuditLog.entity_id == piece.id, AuditLog.action == AuditAction.CREATE
            )
        )
    )
    assert {"id", "title", "tenure_regime", "legal_owner"} <= fields
    assert "created_at" not in fields


def test_import_origin_keeps_batch_reference(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, title="Manta", tenure_regime=TenureRegime.OWNED)
        session.commit()
    with act_as("COLLECTIONS_MANAGER", origin=AuditOrigin.IMPORT, origin_ref="batch-42"):
        update_piece(session, piece, author="Autor sintético")
        session.commit()
    entry = session.scalars(
        select(AuditLog).where(AuditLog.entity_id == piece.id, AuditLog.field == "author")
    ).one()
    assert entry.origin is AuditOrigin.IMPORT
    assert entry.origin_ref == "batch-42"


def test_saving_without_changes_creates_no_audit_rows(session: Session, act_as: ActAs) -> None:
    with act_as("CATALOGUER"):
        piece = create_piece(session, title="Charango", tenure_regime=TenureRegime.OWNED)
        session.commit()
        before = _audit_count(session)
        update_piece(session, piece, title="Charango")
        session.commit()
    assert _audit_count(session) == before


def test_physical_delete_is_forbidden(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        piece = create_piece(session, title="Tinya", tenure_regime=TenureRegime.OWNED)
        session.commit()
        session.delete(piece)
        with pytest.raises(PhysicalDeleteForbidden):
            session.flush()
    session.rollback()


def test_audit_log_rows_cannot_be_modified_or_deleted(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        create_piece(session, title="Mate", tenure_regime=TenureRegime.OWNED)
        session.commit()
        entry = session.scalars(select(AuditLog)).first()
        assert entry is not None
        entry.new_value = "alterado"
        with pytest.raises(AppendOnlyViolation):
            session.flush()
        session.rollback()
        session.delete(session.scalars(select(AuditLog)).first())
        with pytest.raises(PhysicalDeleteForbidden):
            session.flush()
    session.rollback()


def test_movements_are_append_only(session: Session, act_as: ActAs) -> None:
    with act_as("ADMIN"):
        site = create_location(session, level=LocationLevel.SITE, code="S", name="Sede")
        space = create_location(
            session, level=LocationLevel.SPACE, code="S-D1", name="Depósito", parent=site
        )
        piece = create_piece(session, title="Olla", tenure_regime=TenureRegime.OWNED)
        movement = move_piece(session, piece, space, "Ingreso")
        session.commit()
        movement.reason = "Otro motivo"
        with pytest.raises(AppendOnlyViolation):
            session.flush()
    session.rollback()
    assert session.scalar(select(func.count()).select_from(PieceMovement)) == 1


def test_soft_delete_requires_reason(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, title="Trompo", tenure_regime=TenureRegime.OWNED)
        with pytest.raises(ValidationFailed) as excinfo:
            soft_delete(session, piece, "  ")
    assert excinfo.value.code == "reason_required"


def test_soft_deleted_piece_is_hidden_kept_and_audited(
    session: Session, act_as: ActAs, users: dict[str, AppUser]
) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        kept = create_piece(session, title="Visible", tenure_regime=TenureRegime.OWNED)
        piece = create_piece(session, title="Eliminada", tenure_regime=TenureRegime.OWNED)
        soft_delete(session, piece, "Registrada por error")
        session.commit()
    session.expunge_all()
    visible = session.scalars(select(Piece)).all()
    assert [p.id for p in visible] == [kept.id]
    assert session.get(Piece, piece.id) is None
    stored = session.get(Piece, piece.id, execution_options={INCLUDE_DELETED: True})
    assert stored is not None and stored.title == "Eliminada"
    assert stored.deleted_by_id == users["COLLECTIONS_MANAGER"].id
    assert stored.deletion_reason == "Registrada por error"
    entry = session.scalars(
        select(AuditLog).where(
            AuditLog.entity_id == piece.id,
            AuditLog.action == AuditAction.SOFT_DELETE,
            AuditLog.field == "deleted_at",
        )
    ).one()
    assert entry.reason == "Registrada por error"


def test_restore_by_admin_only(session: Session, act_as: ActAs) -> None:
    with act_as("COLLECTIONS_MANAGER"):
        piece = create_piece(session, title="Restaurable", tenure_regime=TenureRegime.OWNED)
        soft_delete(session, piece, "Error")
        session.commit()
        with pytest.raises(PermissionDenied):
            restore(session, piece)
    with act_as("ADMIN"):
        restore(session, piece, "Eliminación equivocada")
        session.commit()
    assert session.get(Piece, piece.id) is not None
    actions = set(session.scalars(select(AuditLog.action).where(AuditLog.entity_id == piece.id)))
    assert {AuditAction.CREATE, AuditAction.SOFT_DELETE, AuditAction.RESTORE} <= actions


def test_password_hash_never_reaches_audit_log(session: Session, act_as: ActAs) -> None:
    system = AuditContext(origin=AuditOrigin.SYSTEM, actor_label="tests")
    with audit_context(session, system):
        user = AppUser(
            id=new_uuid(),
            email="nuevo@test.local",
            full_name="Usuario sintético",
            password_hash="$argon2id$secret-hash",
        )
        session.add(user)
        session.commit()
    fields = set(session.scalars(select(AuditLog.field).where(AuditLog.entity_id == user.id)))
    assert "email" in fields
    assert "password_hash" not in fields
    values = [str(v) for v in session.scalars(select(AuditLog.new_value))]
    assert not any("secret-hash" in value for value in values)
