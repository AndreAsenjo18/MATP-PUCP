"""AI verdicts on duplicate pairs, append-only, and AI runs as quality jobs.

Revision ID: 0025_duplicate_ai_verdict
Revises: 0024_observation_batches
Create Date: 2026-11-16

Change de OpenSpec: ia-juicio-duplicados (tarea 2.1; design D3; RIA-02, RN-005, RN-009).

- `duplicate_ai_verdict` keeps one verdict per pair and run (rule, AI or a person taking the pair
  out of its group), with the provider, the model and the prompt version. Append-only and
  protected by database triggers: a verdict is never rewritten, a newer one is added.
- `quality_job.job_type` gains `AI_DUPLICATE_JUDGMENT` (the enum is a VARCHAR with a named CHECK,
  replaced as in 0024) and three counters for the AI runs: `total_pairs`, `processed_pairs` and
  `failed_batches`. No data to migrate.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025_duplicate_ai_verdict"
down_revision: str | None = "0024_observation_batches"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables created by this migration whose rows can only be inserted (spec auditoria-trazabilidad).
APPEND_ONLY_TABLES = ("duplicate_ai_verdict",)

JOB_TYPE_CHECK = "ck_quality_job_quality_job_type"
OLD_JOB_TYPES = ("FULL_SCAN",)
NEW_JOB_TYPES = (*OLD_JOB_TYPES, "AI_DUPLICATE_JUDGMENT")
COUNTERS = ("total_pairs", "processed_pairs", "failed_batches")

# The PostgreSQL trigger function `matp_reject_append_only_change()` is created by
# 0001_core_data_model, an ancestor of this revision, and shared by every append-only table.


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, create_constraint=True, length=40)


def _job_types(job_types: Sequence[str]) -> None:
    condition = "job_type IN ({})".format(", ".join(f"'{value}'" for value in job_types))
    with op.batch_alter_table("quality_job") as batch_op:
        batch_op.drop_constraint(op.f(JOB_TYPE_CHECK), type_="check")
        batch_op.create_check_constraint(op.f(JOB_TYPE_CHECK), condition)


def _create_append_only_guards() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        for table in APPEND_ONLY_TABLES:
            op.execute(
                f"CREATE TRIGGER trg_{table}_append_only BEFORE UPDATE OR DELETE ON {table} "
                "FOR EACH ROW EXECUTE FUNCTION matp_reject_append_only_change()"
            )
            op.execute(
                f"CREATE TRIGGER trg_{table}_no_truncate BEFORE TRUNCATE ON {table} "
                "FOR EACH STATEMENT EXECUTE FUNCTION matp_reject_append_only_change()"
            )
    elif dialect == "sqlite":
        for table in APPEND_ONLY_TABLES:
            for operation in ("UPDATE", "DELETE"):
                op.execute(
                    f"CREATE TRIGGER trg_{table}_no_{operation.lower()} BEFORE {operation} "
                    f"ON {table} BEGIN SELECT RAISE(ABORT, 'La tabla {table} es de solo "
                    "inserción'); END"
                )


def _drop_append_only_guards() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        for table in APPEND_ONLY_TABLES:
            op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_append_only ON {table}")
            op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_no_truncate ON {table}")
    elif dialect == "sqlite":
        for table in APPEND_ONLY_TABLES:
            for operation in ("update", "delete"):
                op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_no_{operation}")


def upgrade() -> None:
    _job_types(NEW_JOB_TYPES)
    with op.batch_alter_table("quality_job") as batch_op:
        for column in COUNTERS:
            batch_op.add_column(
                sa.Column(column, sa.Integer(), server_default=sa.text("0"), nullable=False)
            )
    op.create_table(
        "duplicate_ai_verdict",
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("candidate_id", sa.Uuid(), nullable=False),
        sa.Column(
            "verdict",
            _enum("duplicate_ai_verdict_value", "same", "distinct", "unsure"),
            nullable=False,
        ),
        sa.Column("confidence", sa.Numeric(precision=4, scale=3), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "source",
            _enum("duplicate_ai_verdict_source", "rule", "ai", "review"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=60), nullable=True),
        sa.Column("model", sa.String(length=120), nullable=True),
        sa.Column("prompt_version", sa.String(length=60), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "confidence >= 0 AND confidence <= 1",
            name=op.f("ck_duplicate_ai_verdict_confidence_range"),
        ),
        sa.ForeignKeyConstraint(
            ["run_id"], ["quality_job.id"], name=op.f("fk_duplicate_ai_verdict_run_id_quality_job")
        ),
        sa.ForeignKeyConstraint(
            ["candidate_id"],
            ["duplicate_candidate.id"],
            name=op.f("fk_duplicate_ai_verdict_candidate_id_duplicate_candidate"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["app_user.id"],
            name=op.f("fk_duplicate_ai_verdict_created_by_id_app_user"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_duplicate_ai_verdict")),
    )
    op.create_index(
        op.f("ix_duplicate_ai_verdict_run_id"), "duplicate_ai_verdict", ["run_id"], unique=False
    )
    op.create_index(
        op.f("ix_duplicate_ai_verdict_candidate_id"),
        "duplicate_ai_verdict",
        ["candidate_id"],
        unique=False,
    )
    _create_append_only_guards()


def downgrade() -> None:
    _drop_append_only_guards()
    op.drop_index(op.f("ix_duplicate_ai_verdict_candidate_id"), table_name="duplicate_ai_verdict")
    op.drop_index(op.f("ix_duplicate_ai_verdict_run_id"), table_name="duplicate_ai_verdict")
    op.drop_table("duplicate_ai_verdict")
    with op.batch_alter_table("quality_job") as batch_op:
        for column in reversed(COUNTERS):
            batch_op.drop_column(column)
    # AI runs written meanwhile would block the old CHECK, as they should.
    _job_types(OLD_JOB_TYPES)
