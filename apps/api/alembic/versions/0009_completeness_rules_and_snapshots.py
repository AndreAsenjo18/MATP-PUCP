"""Completeness rules and daily snapshots.

Revision ID: 0009_completeness_rules_and_snapshots
Revises: 0008_locations_idempotency
Create Date: 2026-10-21

Change de OpenSpec: alertas-y-reporte-incompletas (tarea 1.1). Additive only:
- `completeness_rule`: qué campos de la ficha cuentan como obligatorios/recomendados para las
  alertas de completitud (design D2); `field` es único, auditada como cualquier otra escritura.
- `completeness_snapshot`: instantánea diaria de un indicador de completitud, global o por
  colección (design D5); índices parciales distintos para el caso global (`collection_id` nulo,
  no comparable con `=` en SQL) y el caso por colección, para que una segunda instantánea del
  mismo día reemplace a la anterior en vez de duplicarla.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_completeness_rules_and_snapshots"
down_revision: str | None = "0008_locations_idempotency"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "completeness_rule",
        sa.Column("field", sa.String(length=80), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "REQUIRED",
                "RECOMMENDED",
                name="completeness_field_kind",
                native_enum=False,
                create_constraint=True,
                length=40,
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_completeness_rule")),
        sa.UniqueConstraint("field", name=op.f("uq_completeness_rule_field")),
    )
    op.create_table(
        "completeness_snapshot",
        sa.Column("taken_on", sa.Date(), nullable=False),
        sa.Column("collection_id", sa.Uuid(), nullable=True),
        sa.Column("alert_code", sa.String(length=40), nullable=False),
        sa.Column("numerator", sa.Integer(), nullable=False),
        sa.Column("denominator", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["collection_id"],
            ["collection.id"],
            name=op.f("fk_completeness_snapshot_collection_id_collection"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_completeness_snapshot")),
    )
    op.create_index(
        op.f("ix_completeness_snapshot_taken_on"), "completeness_snapshot", ["taken_on"]
    )
    op.create_index(
        "uq_completeness_snapshot_global",
        "completeness_snapshot",
        ["taken_on", "alert_code"],
        unique=True,
        postgresql_where=sa.text("collection_id IS NULL"),
        sqlite_where=sa.text("collection_id IS NULL"),
    )
    op.create_index(
        "uq_completeness_snapshot_collection",
        "completeness_snapshot",
        ["taken_on", "collection_id", "alert_code"],
        unique=True,
        postgresql_where=sa.text("collection_id IS NOT NULL"),
        sqlite_where=sa.text("collection_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_completeness_snapshot_collection", table_name="completeness_snapshot")
    op.drop_index("uq_completeness_snapshot_global", table_name="completeness_snapshot")
    op.drop_index(
        op.f("ix_completeness_snapshot_taken_on"), table_name="completeness_snapshot"
    )
    op.drop_table("completeness_snapshot")
    op.drop_table("completeness_rule")
