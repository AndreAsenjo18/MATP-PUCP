"""Fix the CHECK of export_job.kind: the values the application writes, in lowercase.

Revision ID: 0016_export_job_kind_check
Revises: 0015_piece_valuation
Create Date: 2026-10-25

Issue #104. Migration 0010 created the column as `sa.Enum("RESULTS", "FULL", "REPORT")`, so its
CHECK lists the enum names, but the model maps `ExportJobKind` with `values_callable` and writes
the values (`'results'`, `'full'`, `'report'`): on a migrated database every export job above the
synchronous limit, every full export and every large report failed. No data to migrate: with the
old CHECK no row could be stored.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016_export_job_kind_check"
down_revision: str | None = "0015_piece_valuation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

KIND_CHECK = "ck_export_job_export_job_kind"
OLD_KINDS = ("RESULTS", "FULL", "REPORT")
NEW_KINDS = ("results", "full", "report")


def _condition(kinds: Sequence[str]) -> str:
    return "kind IN ({})".format(", ".join(f"'{kind}'" for kind in kinds))


def _replace_check(kinds: Sequence[str]) -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("export_job", recreate="always") as batch_op:
            batch_op.drop_constraint(op.f(KIND_CHECK), type_="check")
            batch_op.create_check_constraint(op.f(KIND_CHECK), _condition(kinds))
    else:
        op.drop_constraint(op.f(KIND_CHECK), "export_job", type_="check")
        op.create_check_constraint(op.f(KIND_CHECK), "export_job", _condition(kinds))


def upgrade() -> None:
    _replace_check(NEW_KINDS)


def downgrade() -> None:
    # Back to the CHECK of 0010; rows written meanwhile (lowercase) would block it, as they should.
    _replace_check(OLD_KINDS)
