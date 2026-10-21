"""Location space_kind, corrective and batch movements, idempotency.

Revision ID: 0008_locations_idempotency
Revises: 0007_import_decisions_and_images
Create Date: 2026-10-21

Change de OpenSpec: ubicacion-jerarquica-y-movimientos (tarea 1.1). Additive only:
- `location.space_kind`: tipo de espacio (depósito, sala, taller, otro) [SUPUESTO], solo
  significativo en el nivel SPACE (design D5);
- `piece_movement.corrects_movement_id`: enlaza un movimiento correctivo al que repara, sin
  editar el anterior (RN-005, design D2);
- `piece_movement.origin_ref`: referencia común a los movimientos de una misma reubicación de
  nodo (design D4) o de un mismo lote (design D3);
- `idempotency_key`: respuesta guardada de una operación de lote para que un reintento con la
  misma clave no duplique movimientos (RNF-005, design D3).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_locations_idempotency"
down_revision: str | None = "0007_import_decisions_and_images"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json() -> sa.types.TypeEngine:
    return sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column(
        "location",
        sa.Column(
            "space_kind",
            sa.Enum(
                "DEPOSIT",
                "EXHIBITION_ROOM",
                "WORKSHOP",
                "OTHER",
                name="location_space_kind",
                native_enum=False,
                create_constraint=True,
                length=40,
            ),
            nullable=True,
        ),
    )
    op.add_column("piece_movement", sa.Column("corrects_movement_id", sa.Uuid(), nullable=True))
    op.add_column(
        "piece_movement", sa.Column("origin_ref", sa.String(length=80), nullable=True)
    )
    with op.batch_alter_table("piece_movement") as batch_op:
        batch_op.create_foreign_key(
            op.f("fk_piece_movement_corrects_movement_id_piece_movement"),
            "piece_movement",
            ["corrects_movement_id"],
            ["id"],
        )
    op.create_index(
        op.f("ix_piece_movement_origin_ref"), "piece_movement", ["origin_ref"], unique=False
    )
    op.create_table(
        "idempotency_key",
        sa.Column("key", sa.String(length=200), nullable=False),
        sa.Column("scope", sa.String(length=80), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_status", sa.Integer(), nullable=False),
        sa.Column("response_body", _json(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["app_user.id"], name=op.f("fk_idempotency_key_user_id_app_user")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_idempotency_key")),
    )
    op.create_index(
        op.f("ix_idempotency_key_key"), "idempotency_key", ["key"], unique=True
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_idempotency_key_key"), table_name="idempotency_key")
    op.drop_table("idempotency_key")
    op.drop_index(op.f("ix_piece_movement_origin_ref"), table_name="piece_movement")
    with op.batch_alter_table("piece_movement") as batch_op:
        batch_op.drop_constraint(
            op.f("fk_piece_movement_corrects_movement_id_piece_movement"), type_="foreignkey"
        )
        batch_op.drop_column("origin_ref")
        batch_op.drop_column("corrects_movement_id")
    with op.batch_alter_table("location") as batch_op:
        batch_op.drop_column("space_kind")
