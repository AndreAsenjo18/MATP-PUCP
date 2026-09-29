"""Add loan and loan-item records for loans and exhibitions (RF-018).

Revision ID: 0002_loans_and_exhibitions
Revises: 0001_core_data_model
Create Date: 2026-09-28

Change de OpenSpec: prestamos-y-exposiciones
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_loans_and_exhibitions"
down_revision: str | None = "0001_core_data_model"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "loan",
        sa.Column("type_term_id", sa.Uuid(), nullable=False),
        sa.Column("destination_label", sa.String(length=300), nullable=False),
        sa.Column("responsible_user_id", sa.Uuid(), nullable=True),
        sa.Column("document_reference", sa.String(length=200), nullable=True),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("status_term_id", sa.Uuid(), nullable=False),
        sa.Column("active_availability_term_id", sa.Uuid(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("deletion_reason", sa.Text(), nullable=True),
        sa.CheckConstraint("starts_on <= ends_on", name=op.f("ck_loan_loan_date_range")),
        sa.ForeignKeyConstraint(
            ["active_availability_term_id"],
            ["term.id"],
            name=op.f("fk_loan_active_availability_term_id_term"),
        ),
        sa.ForeignKeyConstraint(
            ["deleted_by_id"], ["app_user.id"], name=op.f("fk_loan_deleted_by_id_app_user")
        ),
        sa.ForeignKeyConstraint(
            ["responsible_user_id"], ["app_user.id"], name=op.f("fk_loan_responsible_user_id_app_user")
        ),
        sa.ForeignKeyConstraint(
            ["status_term_id"], ["term.id"], name=op.f("fk_loan_status_term_id_term")
        ),
        sa.ForeignKeyConstraint(
            ["type_term_id"], ["term.id"], name=op.f("fk_loan_type_term_id_term")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_loan")),
    )
    op.create_index(op.f("ix_loan_deleted_at"), "loan", ["deleted_at"], unique=False)
    op.create_index(op.f("ix_loan_status_term_id"), "loan", ["status_term_id"], unique=False)
    op.create_index(op.f("ix_loan_type_term_id"), "loan", ["type_term_id"], unique=False)
    op.create_table(
        "loan_item",
        sa.Column("loan_id", sa.Uuid(), nullable=False),
        sa.Column("piece_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", sa.Uuid(), nullable=True),
        sa.Column("deletion_reason", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["deleted_by_id"], ["app_user.id"], name=op.f("fk_loan_item_deleted_by_id_app_user")
        ),
        sa.ForeignKeyConstraint(["loan_id"], ["loan.id"], name=op.f("fk_loan_item_loan_id_loan")),
        sa.ForeignKeyConstraint(["piece_id"], ["piece.id"], name=op.f("fk_loan_item_piece_id_piece")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_loan_item")),
        sa.UniqueConstraint("loan_id", "piece_id", name=op.f("uq_loan_item_loan_id_piece_id")),
    )
    op.create_index(op.f("ix_loan_item_deleted_at"), "loan_item", ["deleted_at"], unique=False)
    op.create_index(op.f("ix_loan_item_loan_id"), "loan_item", ["loan_id"], unique=False)
    op.create_index(op.f("ix_loan_item_piece_id"), "loan_item", ["piece_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_loan_item_piece_id"), table_name="loan_item")
    op.drop_index(op.f("ix_loan_item_loan_id"), table_name="loan_item")
    op.drop_index(op.f("ix_loan_item_deleted_at"), table_name="loan_item")
    op.drop_table("loan_item")
    op.drop_index(op.f("ix_loan_type_term_id"), table_name="loan")
    op.drop_index(op.f("ix_loan_status_term_id"), table_name="loan")
    op.drop_index(op.f("ix_loan_deleted_at"), table_name="loan")
    op.drop_table("loan")
