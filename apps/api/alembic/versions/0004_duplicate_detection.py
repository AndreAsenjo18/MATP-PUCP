"""Duplicate detection: settings, background jobs and queue fields of `duplicate_candidate`.

Revision ID: 0004_duplicate_detection
Revises: 0003_term_hierarchy
Create Date: 2026-10-19

Change de OpenSpec: deteccion-duplicados-y-cola-revision (tarea 1.1). Additive only:
- `quality_setting`: weights and threshold of the detection rules (design D1), one row per key;
- `quality_job` and `quality_job_item`: full scans and the incremental queue (design D3);
- `duplicate_candidate`: `postponed_until` (D5), `blocking_conflict` (D1), `change_set_id` (D4)
  and the new status `SUPERSEDED` (D4, step 6).

The status is a VARCHAR with a named CHECK (ADR-004), so adding `SUPERSEDED` means recreating
that CHECK. SQLite cannot alter constraints, so there the table is rebuilt in batch mode; no
other table references `duplicate_candidate`, so the rebuild is safe with foreign keys on.
The downgrade turns `SUPERSEDED` rows back into `PENDING` before restoring the old CHECK.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_duplicate_detection"
down_revision: str | None = "0003_term_hierarchy"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUS_CHECK = "ck_duplicate_candidate_duplicate_status"
OLD_STATUSES = ("PENDING", "MERGED", "DISTINCT", "POSTPONED")
NEW_STATUSES = (*OLD_STATUSES, "SUPERSEDED")


def _status_condition(statuses: Sequence[str]) -> str:
    return "status IN ({})".format(", ".join(f"'{status}'" for status in statuses))


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True, length=40)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "quality_setting",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column(
            "value",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_quality_setting")),
        sa.UniqueConstraint("key", name=op.f("uq_quality_setting_key")),
    )
    op.create_table(
        "quality_job",
        sa.Column("job_type", _enum("quality_job_type", "FULL_SCAN"), nullable=False),
        sa.Column(
            "status",
            _enum("quality_job_status", "RUNNING", "SUCCEEDED", "FAILED"),
            nullable=False,
        ),
        sa.Column("requested_by_id", sa.Uuid(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_pieces", sa.Integer(), nullable=False),
        sa.Column("processed_pieces", sa.Integer(), nullable=False),
        sa.Column("pairs_evaluated", sa.Integer(), nullable=False),
        sa.Column("candidates_created", sa.Integer(), nullable=False),
        sa.Column("candidates_reopened", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["requested_by_id"],
            ["app_user.id"],
            name=op.f("fk_quality_job_requested_by_id_app_user"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_quality_job")),
    )
    op.create_table(
        "quality_job_item",
        sa.Column("piece_id", sa.Uuid(), nullable=False),
        sa.Column(
            "reason",
            _enum(
                "quality_job_item_reason", "PIECE_CREATED", "PIECE_UPDATED", "IDENTIFIER_CHANGED"
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            _enum("quality_job_item_status", "PENDING", "DONE", "FAILED"),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["piece_id"], ["piece.id"], name=op.f("fk_quality_job_item_piece_id_piece")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_quality_job_item")),
    )
    op.create_index(
        op.f("ix_quality_job_item_piece_id"), "quality_job_item", ["piece_id"], unique=False
    )
    op.create_index(
        op.f("ix_quality_job_item_status"), "quality_job_item", ["status"], unique=False
    )

    new_columns = [
        sa.Column("postponed_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blocking_conflict", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("change_set_id", sa.Uuid(), nullable=True),
    ]
    if _is_sqlite():
        with op.batch_alter_table("duplicate_candidate", recreate="always") as batch_op:
            for column in new_columns:
                batch_op.add_column(column)
            batch_op.drop_constraint(op.f(STATUS_CHECK), type_="check")
            batch_op.create_check_constraint(op.f(STATUS_CHECK), _status_condition(NEW_STATUSES))
        return
    for column in new_columns:
        op.add_column("duplicate_candidate", column)
    op.drop_constraint(op.f(STATUS_CHECK), "duplicate_candidate", type_="check")
    op.create_check_constraint(
        op.f(STATUS_CHECK), "duplicate_candidate", _status_condition(NEW_STATUSES)
    )


def downgrade() -> None:
    op.execute("UPDATE duplicate_candidate SET status = 'PENDING' WHERE status = 'SUPERSEDED'")
    if _is_sqlite():
        with op.batch_alter_table("duplicate_candidate", recreate="always") as batch_op:
            batch_op.drop_constraint(op.f(STATUS_CHECK), type_="check")
            batch_op.create_check_constraint(op.f(STATUS_CHECK), _status_condition(OLD_STATUSES))
            for name in ("change_set_id", "blocking_conflict", "postponed_until"):
                batch_op.drop_column(name)
    else:
        op.drop_constraint(op.f(STATUS_CHECK), "duplicate_candidate", type_="check")
        op.create_check_constraint(
            op.f(STATUS_CHECK), "duplicate_candidate", _status_condition(OLD_STATUSES)
        )
        for name in ("change_set_id", "blocking_conflict", "postponed_until"):
            op.drop_column("duplicate_candidate", name)
    op.drop_index(op.f("ix_quality_job_item_status"), table_name="quality_job_item")
    op.drop_index(op.f("ix_quality_job_item_piece_id"), table_name="quality_job_item")
    op.drop_table("quality_job_item")
    op.drop_table("quality_job")
    op.drop_table("quality_setting")
