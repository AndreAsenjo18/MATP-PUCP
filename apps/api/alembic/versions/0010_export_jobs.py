"""Export job table and EXPORT action in AuditAction.

Revision ID: 0010_export_jobs
Revises: 0009_search_unaccent_and_trigram_indexes
Create Date: 2026-10-22

Change de OpenSpec: busqueda-avanzada-y-exportacion (tarea 2.2, RF-036, RF-044).
- Anade el valor 'EXPORT' a la restriccion CHECK de audit_action.
- Crea la tabla export_job para gestionar trabajos asincronos de exportacion con
  latido, expiracion (72 h), hash sha256 y parametros de filtros.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010_export_jobs"
down_revision: str | None = "0009_search_unaccent_and_trigram_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ACTION_CHECK = "ck_audit_log_audit_action"
OLD_ACTIONS = ("CREATE", "UPDATE", "SOFT_DELETE", "RESTORE", "CORRECTION", "MERGE", "REVERT")
NEW_ACTIONS = (*OLD_ACTIONS, "EXPORT")


def _action_condition(actions: Sequence[str]) -> str:
    return "action IN ({})".format(", ".join(f"'{act}'" for act in actions))


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def _recreate_sqlite_triggers() -> None:
    for operation in ("UPDATE", "DELETE"):
        op.execute(
            f"CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_{operation.lower()} "
            f"BEFORE {operation} ON audit_log BEGIN "
            "SELECT RAISE(ABORT, 'La tabla audit_log es de solo insercion'); END"
        )


def upgrade() -> None:
    # 1. Update check constraint on audit_log
    if _is_sqlite():
        with op.batch_alter_table("audit_log", recreate="always") as batch_op:
            batch_op.drop_constraint(op.f(ACTION_CHECK), type_="check")
            batch_op.create_check_constraint(op.f(ACTION_CHECK), _action_condition(NEW_ACTIONS))
        _recreate_sqlite_triggers()
    else:
        op.drop_constraint(op.f(ACTION_CHECK), "audit_log", type_="check")
        op.create_check_constraint(op.f(ACTION_CHECK), "audit_log", _action_condition(NEW_ACTIONS))

    # 2. Create export_job table
    op.create_table(
        "export_job",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "RESULTS",
                "FULL",
                "REPORT",
                name="export_job_kind",
                native_enum=False,
                create_constraint=True,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column("requested_by_id", sa.Uuid(), nullable=False),
        sa.Column("format", sa.String(length=20), nullable=False),
        sa.Column("params", _json(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "RUNNING",
                "READY",
                "FAILED",
                name="export_job_status",
                native_enum=False,
                create_constraint=True,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("storage_key", sa.String(length=500), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("masked_fields", _json(), nullable=False),
        sa.ForeignKeyConstraint(
            ["requested_by_id"],
            ["app_user.id"],
            name=op.f("fk_export_job_requested_by_id_app_user"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_export_job")),
    )
    op.create_index(op.f("ix_export_job_requested_by_id"), "export_job", ["requested_by_id"])
    op.create_index(op.f("ix_export_job_status"), "export_job", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_export_job_status"), table_name="export_job")
    op.drop_index(op.f("ix_export_job_requested_by_id"), table_name="export_job")
    op.drop_table("export_job")

    if _is_sqlite():
        with op.batch_alter_table("audit_log", recreate="always") as batch_op:
            batch_op.drop_constraint(op.f(ACTION_CHECK), type_="check")
            batch_op.create_check_constraint(op.f(ACTION_CHECK), _action_condition(OLD_ACTIONS))
        _recreate_sqlite_triggers()
    else:
        op.drop_constraint(op.f(ACTION_CHECK), "audit_log", type_="check")
        op.create_check_constraint(op.f(ACTION_CHECK), "audit_log", _action_condition(OLD_ACTIONS))
