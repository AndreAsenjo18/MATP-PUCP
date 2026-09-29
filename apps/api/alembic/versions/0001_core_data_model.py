"""Core data model: pieces, identifiers, collections, vocabularies, locations, media,
import pipeline tables, duplicates, AI suggestions, users/roles and audit log.

Revision ID: 0001_core_data_model
Revises:
Create Date: 2026-09-17

Change de OpenSpec: modelo-datos-nucleo
Generated from the SQLAlchemy metadata with Alembic autogenerate rendering, then completed by
hand with PostgreSQL extras (pg_trgm, trigram indexes) and append-only triggers.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_core_data_model"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables whose rows can only be inserted (spec auditoria-trazabilidad).
APPEND_ONLY_TABLES = ("audit_log", "piece_movement", "piece_source_record", "conservation_assessment")

POSTGRES_APPEND_ONLY_FUNCTION = """
CREATE OR REPLACE FUNCTION matp_reject_append_only_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo inserción: no se permite %', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
"""


def _create_append_only_guards() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "postgresql":
        op.execute(POSTGRES_APPEND_ONLY_FUNCTION)
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
        op.execute("DROP FUNCTION IF EXISTS matp_reject_append_only_change()")
    elif dialect == "sqlite":
        for table in APPEND_ONLY_TABLES:
            for operation in ("update", "delete"):
                op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_no_{operation}")


def _create_search_extensions() -> None:
    """Trigram similarity for search (RF-031) and duplicate detection (RF-030). PostgreSQL only."""
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX ix_piece_title_trgm ON piece USING gin (title gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_piece_identifier_normalized_trgm ON piece_identifier "
        "USING gin (normalized_value gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_piece_identifier_original_trgm ON piece_identifier "
        "USING gin (original_value gin_trgm_ops)"
    )


def _drop_search_extensions() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute("DROP INDEX IF EXISTS ix_piece_identifier_original_trgm")
    op.execute("DROP INDEX IF EXISTS ix_piece_identifier_normalized_trgm")
    op.execute("DROP INDEX IF EXISTS ix_piece_title_trgm")


def upgrade() -> None:
    op.create_table('app_user',
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('full_name', sa.String(length=200), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_synthetic', sa.Boolean(), nullable=False),
    sa.Column('external_subject', sa.String(length=255), nullable=True),
    sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('failed_login_count', sa.Integer(), nullable=False),
    sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_app_user_deleted_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_app_user'))
    )
    op.create_index(op.f('ix_app_user_deleted_at'), 'app_user', ['deleted_at'], unique=False)
    op.create_index(
        'uq_app_user_email_active',
        'app_user',
        [sa.text('lower(email)')],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL'),
        sqlite_where=sa.text('deleted_at IS NULL'),
    )
    op.create_table('permission',
    sa.Column('code', sa.String(length=80), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_permission')),
    sa.UniqueConstraint('code', name=op.f('uq_permission_code'))
    )
    op.create_table('audit_log',
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('change_set_id', sa.Uuid(), nullable=False),
    sa.Column('entity_type', sa.String(length=60), nullable=False),
    sa.Column('entity_id', sa.Uuid(), nullable=False),
    sa.Column('field', sa.String(length=100), nullable=True),
    sa.Column('old_value', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('new_value', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('action', sa.Enum('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'CORRECTION', 'MERGE', 'REVERT', name='audit_action', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('origin', sa.Enum('MANUAL', 'IMPORT', 'AI', 'SYSTEM', name='audit_origin', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('origin_ref', sa.String(length=100), nullable=True),
    sa.Column('user_id', sa.Uuid(), nullable=True),
    sa.Column('actor_label', sa.String(length=100), nullable=True),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['app_user.id'], name=op.f('fk_audit_log_user_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_log'))
    )
    op.create_index(op.f('ix_audit_log_change_set_id'), 'audit_log', ['change_set_id'], unique=False)
    op.create_index('ix_audit_log_entity', 'audit_log', ['entity_type', 'entity_id', 'occurred_at'], unique=False)
    op.create_index(op.f('ix_audit_log_user_id'), 'audit_log', ['user_id'], unique=False)
    op.create_table('collection',
    sa.Column('parent_id', sa.Uuid(), nullable=True),
    sa.Column('name', sa.String(length=300), nullable=False),
    sa.Column('acronym', sa.String(length=40), nullable=True),
    sa.Column('acronym_normalized', sa.String(length=40), nullable=True),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('default_tenure_regime', sa.Enum('OWNED', 'LOAN_FOR_USE', 'TEMPORARY_LOAN', name='tenure_regime', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('origin_description', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_collection_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['parent_id'], ['collection.id'], name=op.f('fk_collection_parent_id_collection')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_collection'))
    )
    op.create_index(op.f('ix_collection_deleted_at'), 'collection', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_collection_parent_id'), 'collection', ['parent_id'], unique=False)
    op.create_index('uq_collection_acronym_active', 'collection', ['acronym_normalized'], unique=True, postgresql_where=sa.text('deleted_at IS NULL AND acronym_normalized IS NOT NULL'), sqlite_where=sa.text('deleted_at IS NULL AND acronym_normalized IS NOT NULL'))
    op.create_table('identifier_type',
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('label', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('normalization_rule', sa.Enum('INVENTORY', 'COLLECTION', 'INC_RN', 'GENERIC', name='normalization_rule', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('is_unique_when_current', sa.Boolean(), nullable=False),
    sa.Column('locks_on_assignment', sa.Boolean(), nullable=False),
    sa.Column('owned_pieces_only', sa.Boolean(), nullable=False),
    sa.Column('allowed_for_temporary_loan', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_identifier_type_deleted_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_identifier_type')),
    sa.UniqueConstraint('code', name=op.f('uq_identifier_type_code'))
    )
    op.create_index(op.f('ix_identifier_type_deleted_at'), 'identifier_type', ['deleted_at'], unique=False)
    op.create_table('import_mapping_template',
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('source_name', sa.String(length=200), nullable=False),
    sa.Column('header_signature', sa.String(length=64), nullable=False),
    sa.Column('mapping', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_import_mapping_template_deleted_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_mapping_template'))
    )
    op.create_index(op.f('ix_import_mapping_template_deleted_at'), 'import_mapping_template', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_import_mapping_template_header_signature'), 'import_mapping_template', ['header_signature'], unique=False)
    op.create_table('location',
    sa.Column('parent_id', sa.Uuid(), nullable=True),
    sa.Column('level', sa.Enum('SITE', 'SPACE', 'FURNITURE', 'SHELF_LEVEL', 'CONTAINER', name='location_level', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('code', sa.String(length=80), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_location_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['parent_id'], ['location.id'], name=op.f('fk_location_parent_id_location')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_location')),
    sa.UniqueConstraint('code', name=op.f('uq_location_code'))
    )
    op.create_index(op.f('ix_location_deleted_at'), 'location', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_location_parent_id'), 'location', ['parent_id'], unique=False)
    op.create_table('role',
    sa.Column('code', sa.String(length=40), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('is_enabled', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_role_deleted_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_role')),
    sa.UniqueConstraint('code', name=op.f('uq_role_code'))
    )
    op.create_index(op.f('ix_role_deleted_at'), 'role', ['deleted_at'], unique=False)
    op.create_table('vocabulary',
    sa.Column('code', sa.String(length=60), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_vocabulary_deleted_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_vocabulary')),
    sa.UniqueConstraint('code', name=op.f('uq_vocabulary_code'))
    )
    op.create_index(op.f('ix_vocabulary_deleted_at'), 'vocabulary', ['deleted_at'], unique=False)
    op.create_table('import_batch',
    sa.Column('source_name', sa.String(length=200), nullable=False),
    sa.Column('file_name', sa.String(length=300), nullable=False),
    sa.Column('file_storage_key', sa.String(length=500), nullable=True),
    sa.Column('file_sha256', sa.String(length=64), nullable=True),
    sa.Column('template_id', sa.Uuid(), nullable=True),
    sa.Column('status', sa.Enum('UPLOADED', 'FAILED_INGESTION', 'MAPPED', 'VALIDATED', 'IN_PREVIEW', 'APPROVED', 'APPLIED', 'FAILED_APPLY', 'ABANDONED', 'REVERTED', name='import_batch_status', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('status_reason', sa.Text(), nullable=True),
    sa.Column('uploaded_by_id', sa.Uuid(), nullable=True),
    sa.Column('approved_by_id', sa.Uuid(), nullable=True),
    sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('stage_timestamps', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('counts', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['approved_by_id'], ['app_user.id'], name=op.f('fk_import_batch_approved_by_id_app_user')),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_import_batch_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['template_id'], ['import_mapping_template.id'], name=op.f('fk_import_batch_template_id_import_mapping_template')),
    sa.ForeignKeyConstraint(['uploaded_by_id'], ['app_user.id'], name=op.f('fk_import_batch_uploaded_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_batch'))
    )
    op.create_index(op.f('ix_import_batch_deleted_at'), 'import_batch', ['deleted_at'], unique=False)
    op.create_table('role_permission',
    sa.Column('role_id', sa.Uuid(), nullable=False),
    sa.Column('permission_id', sa.Uuid(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_role_permission_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['permission_id'], ['permission.id'], name=op.f('fk_role_permission_permission_id_permission')),
    sa.ForeignKeyConstraint(['role_id'], ['role.id'], name=op.f('fk_role_permission_role_id_role')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_role_permission'))
    )
    op.create_index(op.f('ix_role_permission_deleted_at'), 'role_permission', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_role_permission_permission_id'), 'role_permission', ['permission_id'], unique=False)
    op.create_index(op.f('ix_role_permission_role_id'), 'role_permission', ['role_id'], unique=False)
    op.create_index('uq_role_permission_active', 'role_permission', ['role_id', 'permission_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.create_table('term',
    sa.Column('vocabulary_id', sa.Uuid(), nullable=False),
    sa.Column('code', sa.String(length=80), nullable=False),
    sa.Column('label', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('external_uri', sa.String(length=500), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_term_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['vocabulary_id'], ['vocabulary.id'], name=op.f('fk_term_vocabulary_id_vocabulary')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_term')),
    sa.UniqueConstraint('vocabulary_id', 'code', name=op.f('uq_term_vocabulary_id_code'))
    )
    op.create_index(op.f('ix_term_deleted_at'), 'term', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_term_vocabulary_id'), 'term', ['vocabulary_id'], unique=False)
    op.create_table('user_role',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('role_id', sa.Uuid(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_user_role_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['role_id'], ['role.id'], name=op.f('fk_user_role_role_id_role')),
    sa.ForeignKeyConstraint(['user_id'], ['app_user.id'], name=op.f('fk_user_role_user_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_user_role'))
    )
    op.create_index(op.f('ix_user_role_deleted_at'), 'user_role', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_user_role_role_id'), 'user_role', ['role_id'], unique=False)
    op.create_index(op.f('ix_user_role_user_id'), 'user_role', ['user_id'], unique=False)
    op.create_index('uq_user_role_active', 'user_role', ['user_id', 'role_id'], unique=True, postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.create_table('piece',
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('collection_id', sa.Uuid(), nullable=True),
    sa.Column('tenure_regime', sa.Enum('OWNED', 'LOAN_FOR_USE', 'TEMPORARY_LOAN', name='tenure_regime', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('legal_owner', sa.String(length=200), nullable=True),
    sa.Column('lender_name', sa.String(length=300), nullable=True),
    sa.Column('loan_agreement_ref', sa.String(length=200), nullable=True),
    sa.Column('temporary_inventory_number', sa.String(length=60), nullable=True),
    sa.Column('acquisition_method_term_id', sa.Uuid(), nullable=True),
    sa.Column('entry_date', sa.Date(), nullable=True),
    sa.Column('author', sa.String(length=300), nullable=True),
    sa.Column('provenance', sa.String(length=300), nullable=True),
    sa.Column('period_text', sa.String(length=200), nullable=True),
    sa.Column('period_type', sa.Enum('CENTURY', 'DECADE', 'YEAR', 'RANGE', 'APPROXIMATE', 'RELATIVE_AGE', 'UNKNOWN', name='period_type', native_enum=False, create_constraint=True, length=40), nullable=True),
    sa.Column('period_from', sa.Integer(), nullable=True),
    sa.Column('period_to', sa.Integer(), nullable=True),
    sa.Column('object_type_term_id', sa.Uuid(), nullable=True),
    sa.Column('category_term_id', sa.Uuid(), nullable=True),
    sa.Column('dimensions_text', sa.Text(), nullable=True),
    sa.Column('dimensions', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('conservation_status_term_id', sa.Uuid(), nullable=True),
    sa.Column('recorded_by', sa.String(length=200), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('parent_piece_id', sa.Uuid(), nullable=True),
    sa.Column('merged_into_id', sa.Uuid(), nullable=True),
    sa.Column('availability_term_id', sa.Uuid(), nullable=True),
    sa.Column('current_location_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.CheckConstraint('period_from IS NULL OR period_to IS NULL OR period_from <= period_to', name=op.f('ck_piece_period_range')),
    sa.ForeignKeyConstraint(['acquisition_method_term_id'], ['term.id'], name=op.f('fk_piece_acquisition_method_term_id_term')),
    sa.ForeignKeyConstraint(['availability_term_id'], ['term.id'], name=op.f('fk_piece_availability_term_id_term')),
    sa.ForeignKeyConstraint(['category_term_id'], ['term.id'], name=op.f('fk_piece_category_term_id_term')),
    sa.ForeignKeyConstraint(['collection_id'], ['collection.id'], name=op.f('fk_piece_collection_id_collection')),
    sa.ForeignKeyConstraint(['conservation_status_term_id'], ['term.id'], name=op.f('fk_piece_conservation_status_term_id_term')),
    sa.ForeignKeyConstraint(['current_location_id'], ['location.id'], name=op.f('fk_piece_current_location_id_location')),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_piece_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['merged_into_id'], ['piece.id'], name=op.f('fk_piece_merged_into_id_piece')),
    sa.ForeignKeyConstraint(['object_type_term_id'], ['term.id'], name=op.f('fk_piece_object_type_term_id_term')),
    sa.ForeignKeyConstraint(['parent_piece_id'], ['piece.id'], name=op.f('fk_piece_parent_piece_id_piece')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_piece'))
    )
    op.create_index(op.f('ix_piece_category_term_id'), 'piece', ['category_term_id'], unique=False)
    op.create_index(op.f('ix_piece_collection_id'), 'piece', ['collection_id'], unique=False)
    op.create_index(op.f('ix_piece_current_location_id'), 'piece', ['current_location_id'], unique=False)
    op.create_index(op.f('ix_piece_deleted_at'), 'piece', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_piece_parent_piece_id'), 'piece', ['parent_piece_id'], unique=False)
    op.create_index('ix_piece_title', 'piece', ['title'], unique=False)
    op.create_table('ai_suggestion',
    sa.Column('function_code', sa.Enum('RIA_01', 'RIA_02', 'RIA_03', 'RIA_04', 'RIA_05', name='ai_function', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', name='suggestion_status', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('provider', sa.String(length=60), nullable=False),
    sa.Column('model', sa.String(length=120), nullable=True),
    sa.Column('piece_id', sa.Uuid(), nullable=True),
    sa.Column('import_batch_id', sa.Uuid(), nullable=True),
    sa.Column('input_data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('output_data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('approved_data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('requested_by_id', sa.Uuid(), nullable=True),
    sa.Column('reviewed_by_id', sa.Uuid(), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('rejection_reason', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("status <> 'REJECTED' OR rejection_reason IS NOT NULL", name=op.f('ck_ai_suggestion_rejection_requires_reason')),
    sa.CheckConstraint("status = 'PENDING' OR (reviewed_by_id IS NOT NULL AND reviewed_at IS NOT NULL)", name=op.f('ck_ai_suggestion_decision_requires_reviewer')),
    sa.CheckConstraint("status NOT IN ('APPROVED', 'PARTIALLY_APPROVED') OR approved_data IS NOT NULL", name=op.f('ck_ai_suggestion_approval_requires_data')),
    sa.ForeignKeyConstraint(['import_batch_id'], ['import_batch.id'], name=op.f('fk_ai_suggestion_import_batch_id_import_batch')),
    sa.ForeignKeyConstraint(['piece_id'], ['piece.id'], name=op.f('fk_ai_suggestion_piece_id_piece')),
    sa.ForeignKeyConstraint(['requested_by_id'], ['app_user.id'], name=op.f('fk_ai_suggestion_requested_by_id_app_user')),
    sa.ForeignKeyConstraint(['reviewed_by_id'], ['app_user.id'], name=op.f('fk_ai_suggestion_reviewed_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_ai_suggestion'))
    )
    op.create_index(op.f('ix_ai_suggestion_piece_id'), 'ai_suggestion', ['piece_id'], unique=False)
    op.create_table('conservation_assessment',
    sa.Column('piece_id', sa.Uuid(), nullable=False),
    sa.Column('status_term_id', sa.Uuid(), nullable=False),
    sa.Column('assessed_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('assessed_by_user_id', sa.Uuid(), nullable=True),
    sa.Column('assessed_by_label', sa.String(length=200), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['assessed_by_user_id'], ['app_user.id'], name=op.f('fk_conservation_assessment_assessed_by_user_id_app_user')),
    sa.ForeignKeyConstraint(['piece_id'], ['piece.id'], name=op.f('fk_conservation_assessment_piece_id_piece')),
    sa.ForeignKeyConstraint(['status_term_id'], ['term.id'], name=op.f('fk_conservation_assessment_status_term_id_term')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_conservation_assessment'))
    )
    op.create_index(op.f('ix_conservation_assessment_piece_id'), 'conservation_assessment', ['piece_id'], unique=False)
    op.create_table('import_row',
    sa.Column('batch_id', sa.Uuid(), nullable=False),
    sa.Column('source_row_number', sa.Integer(), nullable=False),
    sa.Column('raw_data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('mapped_data', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('classification', sa.Enum('NEW', 'UPDATE', 'POSSIBLE_DUPLICATE', 'CONFLICT', name='row_classification', native_enum=False, create_constraint=True, length=40), nullable=True),
    sa.Column('has_validation_errors', sa.Boolean(), nullable=False),
    sa.Column('validation_errors', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('matches', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('diff', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('decision', sa.Enum('PENDING', 'ACCEPTED', 'EXCLUDED', 'REJECTED', name='row_decision', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('decision_reason', sa.Text(), nullable=True),
    sa.Column('target_piece_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['batch_id'], ['import_batch.id'], name=op.f('fk_import_row_batch_id_import_batch')),
    sa.ForeignKeyConstraint(['target_piece_id'], ['piece.id'], name=op.f('fk_import_row_target_piece_id_piece')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_import_row')),
    sa.UniqueConstraint('batch_id', 'source_row_number', name=op.f('uq_import_row_batch_id_source_row_number'))
    )
    op.create_index('ix_import_row_batch_classification', 'import_row', ['batch_id', 'classification'], unique=False)
    op.create_index(op.f('ix_import_row_batch_id'), 'import_row', ['batch_id'], unique=False)
    op.create_table('media_asset',
    sa.Column('piece_id', sa.Uuid(), nullable=False),
    sa.Column('storage_key', sa.String(length=500), nullable=False),
    sa.Column('original_filename', sa.String(length=300), nullable=True),
    sa.Column('content_type', sa.String(length=100), nullable=False),
    sa.Column('size_bytes', sa.BigInteger(), nullable=False),
    sa.Column('content_sha256', sa.String(length=64), nullable=False),
    sa.Column('width_px', sa.Integer(), nullable=True),
    sa.Column('height_px', sa.Integer(), nullable=True),
    sa.Column('view_type_term_id', sa.Uuid(), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_primary', sa.Boolean(), nullable=False),
    sa.Column('photographer', sa.String(length=200), nullable=True),
    sa.Column('taken_on', sa.Date(), nullable=True),
    sa.Column('usage_restriction_term_id', sa.Uuid(), nullable=True),
    sa.Column('restriction_note', sa.Text(), nullable=True),
    sa.Column('extra_metadata', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_media_asset_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['piece_id'], ['piece.id'], name=op.f('fk_media_asset_piece_id_piece')),
    sa.ForeignKeyConstraint(['usage_restriction_term_id'], ['term.id'], name=op.f('fk_media_asset_usage_restriction_term_id_term')),
    sa.ForeignKeyConstraint(['view_type_term_id'], ['term.id'], name=op.f('fk_media_asset_view_type_term_id_term')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_media_asset')),
    sa.UniqueConstraint('storage_key', name=op.f('uq_media_asset_storage_key'))
    )
    op.create_index(op.f('ix_media_asset_deleted_at'), 'media_asset', ['deleted_at'], unique=False)
    op.create_index('ix_media_asset_piece_hash', 'media_asset', ['piece_id', 'content_sha256'], unique=False)
    op.create_index(op.f('ix_media_asset_piece_id'), 'media_asset', ['piece_id'], unique=False)
    op.create_table('piece_identifier',
    sa.Column('piece_id', sa.Uuid(), nullable=False),
    sa.Column('identifier_type_code', sa.String(length=40), nullable=False),
    sa.Column('original_value', sa.Text(), nullable=False),
    sa.Column('normalized_value', sa.String(length=200), nullable=True),
    sa.Column('normalization_status', sa.Enum('NORMALIZED', 'UNPARSEABLE', name='normalization_status', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('detected_format', sa.String(length=40), nullable=True),
    sa.Column('is_current', sa.Boolean(), nullable=False),
    sa.Column('is_locked', sa.Boolean(), nullable=False),
    sa.Column('source', sa.String(length=200), nullable=True),
    sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('replaced_by_id', sa.Uuid(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_piece_identifier_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['identifier_type_code'], ['identifier_type.code'], name=op.f('fk_piece_identifier_identifier_type_code_identifier_type')),
    sa.ForeignKeyConstraint(['piece_id'], ['piece.id'], name=op.f('fk_piece_identifier_piece_id_piece')),
    sa.ForeignKeyConstraint(['replaced_by_id'], ['piece_identifier.id'], name=op.f('fk_piece_identifier_replaced_by_id_piece_identifier')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_piece_identifier'))
    )
    op.create_index(op.f('ix_piece_identifier_deleted_at'), 'piece_identifier', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_piece_identifier_identifier_type_code'), 'piece_identifier', ['identifier_type_code'], unique=False)
    op.create_index('ix_piece_identifier_normalized_value', 'piece_identifier', ['normalized_value'], unique=False)
    op.create_index(op.f('ix_piece_identifier_piece_id'), 'piece_identifier', ['piece_id'], unique=False)
    op.create_index('uq_piece_identifier_current_inventory_code', 'piece_identifier', ['normalized_value'], unique=True, postgresql_where=sa.text("identifier_type_code = 'I' AND is_current AND deleted_at IS NULL"), sqlite_where=sa.text("identifier_type_code = 'I' AND is_current = 1 AND deleted_at IS NULL"))
    op.create_table('piece_material',
    sa.Column('piece_id', sa.Uuid(), nullable=False),
    sa.Column('term_id', sa.Uuid(), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_id', sa.Uuid(), nullable=True),
    sa.Column('deletion_reason', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['deleted_by_id'], ['app_user.id'], name=op.f('fk_piece_material_deleted_by_id_app_user')),
    sa.ForeignKeyConstraint(['piece_id'], ['piece.id'], name=op.f('fk_piece_material_piece_id_piece')),
    sa.ForeignKeyConstraint(['term_id'], ['term.id'], name=op.f('fk_piece_material_term_id_term')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_piece_material'))
    )
    op.create_index(op.f('ix_piece_material_deleted_at'), 'piece_material', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_piece_material_piece_id'), 'piece_material', ['piece_id'], unique=False)
    op.create_index(op.f('ix_piece_material_term_id'), 'piece_material', ['term_id'], unique=False)
    op.create_table('piece_movement',
    sa.Column('piece_id', sa.Uuid(), nullable=False),
    sa.Column('movement_type', sa.Enum('MOVE', 'VERIFICATION', 'CORRECTION', name='movement_type', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('from_location_id', sa.Uuid(), nullable=True),
    sa.Column('to_location_id', sa.Uuid(), nullable=True),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('performed_by_user_id', sa.Uuid(), nullable=True),
    sa.Column('performed_by_label', sa.String(length=200), nullable=True),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['from_location_id'], ['location.id'], name=op.f('fk_piece_movement_from_location_id_location')),
    sa.ForeignKeyConstraint(['performed_by_user_id'], ['app_user.id'], name=op.f('fk_piece_movement_performed_by_user_id_app_user')),
    sa.ForeignKeyConstraint(['piece_id'], ['piece.id'], name=op.f('fk_piece_movement_piece_id_piece')),
    sa.ForeignKeyConstraint(['to_location_id'], ['location.id'], name=op.f('fk_piece_movement_to_location_id_location')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_piece_movement'))
    )
    op.create_index(op.f('ix_piece_movement_occurred_at'), 'piece_movement', ['occurred_at'], unique=False)
    op.create_index(op.f('ix_piece_movement_piece_id'), 'piece_movement', ['piece_id'], unique=False)
    op.create_table('piece_source_record',
    sa.Column('piece_id', sa.Uuid(), nullable=False),
    sa.Column('import_batch_id', sa.Uuid(), nullable=True),
    sa.Column('source_name', sa.String(length=200), nullable=False),
    sa.Column('source_file_name', sa.String(length=300), nullable=True),
    sa.Column('source_row_number', sa.Integer(), nullable=True),
    sa.Column('payload', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['import_batch_id'], ['import_batch.id'], name=op.f('fk_piece_source_record_import_batch_id_import_batch')),
    sa.ForeignKeyConstraint(['piece_id'], ['piece.id'], name=op.f('fk_piece_source_record_piece_id_piece')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_piece_source_record'))
    )
    op.create_index(op.f('ix_piece_source_record_piece_id'), 'piece_source_record', ['piece_id'], unique=False)
    op.create_table('duplicate_candidate',
    sa.Column('piece_a_id', sa.Uuid(), nullable=False),
    sa.Column('piece_b_id', sa.Uuid(), nullable=True),
    sa.Column('import_row_id', sa.Uuid(), nullable=True),
    sa.Column('score', sa.Numeric(precision=5, scale=4), nullable=False),
    sa.Column('matched_fields', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
    sa.Column('status', sa.Enum('PENDING', 'MERGED', 'DISTINCT', 'POSTPONED', name='duplicate_status', native_enum=False, create_constraint=True, length=40), nullable=False),
    sa.Column('compared_fingerprint', sa.String(length=64), nullable=True),
    sa.Column('detected_by', sa.String(length=40), nullable=False),
    sa.Column('reviewed_by_id', sa.Uuid(), nullable=True),
    sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('resolution_note', sa.Text(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("status = 'PENDING' OR reviewed_by_id IS NOT NULL", name=op.f('ck_duplicate_candidate_review_requires_reviewer')),
    sa.CheckConstraint('(piece_b_id IS NOT NULL) <> (import_row_id IS NOT NULL)', name=op.f('ck_duplicate_candidate_one_counterpart')),
    sa.CheckConstraint('score >= 0 AND score <= 1', name=op.f('ck_duplicate_candidate_score_range')),
    sa.ForeignKeyConstraint(['import_row_id'], ['import_row.id'], name=op.f('fk_duplicate_candidate_import_row_id_import_row')),
    sa.ForeignKeyConstraint(['piece_a_id'], ['piece.id'], name=op.f('fk_duplicate_candidate_piece_a_id_piece')),
    sa.ForeignKeyConstraint(['piece_b_id'], ['piece.id'], name=op.f('fk_duplicate_candidate_piece_b_id_piece')),
    sa.ForeignKeyConstraint(['reviewed_by_id'], ['app_user.id'], name=op.f('fk_duplicate_candidate_reviewed_by_id_app_user')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_duplicate_candidate'))
    )
    op.create_index(op.f('ix_duplicate_candidate_piece_a_id'), 'duplicate_candidate', ['piece_a_id'], unique=False)
    op.create_index(op.f('ix_duplicate_candidate_piece_b_id'), 'duplicate_candidate', ['piece_b_id'], unique=False)

    _create_search_extensions()
    _create_append_only_guards()


def downgrade() -> None:
    _drop_append_only_guards()
    _drop_search_extensions()
    op.drop_index(op.f('ix_duplicate_candidate_piece_b_id'), table_name='duplicate_candidate')
    op.drop_index(op.f('ix_duplicate_candidate_piece_a_id'), table_name='duplicate_candidate')
    op.drop_table('duplicate_candidate')
    op.drop_index(op.f('ix_piece_source_record_piece_id'), table_name='piece_source_record')
    op.drop_table('piece_source_record')
    op.drop_index(op.f('ix_piece_movement_piece_id'), table_name='piece_movement')
    op.drop_index(op.f('ix_piece_movement_occurred_at'), table_name='piece_movement')
    op.drop_table('piece_movement')
    op.drop_index(op.f('ix_piece_material_term_id'), table_name='piece_material')
    op.drop_index(op.f('ix_piece_material_piece_id'), table_name='piece_material')
    op.drop_index(op.f('ix_piece_material_deleted_at'), table_name='piece_material')
    op.drop_table('piece_material')
    op.drop_index('uq_piece_identifier_current_inventory_code', table_name='piece_identifier', postgresql_where=sa.text("identifier_type_code = 'I' AND is_current AND deleted_at IS NULL"), sqlite_where=sa.text("identifier_type_code = 'I' AND is_current = 1 AND deleted_at IS NULL"))
    op.drop_index(op.f('ix_piece_identifier_piece_id'), table_name='piece_identifier')
    op.drop_index('ix_piece_identifier_normalized_value', table_name='piece_identifier')
    op.drop_index(op.f('ix_piece_identifier_identifier_type_code'), table_name='piece_identifier')
    op.drop_index(op.f('ix_piece_identifier_deleted_at'), table_name='piece_identifier')
    op.drop_table('piece_identifier')
    op.drop_index(op.f('ix_media_asset_piece_id'), table_name='media_asset')
    op.drop_index('ix_media_asset_piece_hash', table_name='media_asset')
    op.drop_index(op.f('ix_media_asset_deleted_at'), table_name='media_asset')
    op.drop_table('media_asset')
    op.drop_index(op.f('ix_import_row_batch_id'), table_name='import_row')
    op.drop_index('ix_import_row_batch_classification', table_name='import_row')
    op.drop_table('import_row')
    op.drop_index(op.f('ix_conservation_assessment_piece_id'), table_name='conservation_assessment')
    op.drop_table('conservation_assessment')
    op.drop_index(op.f('ix_ai_suggestion_piece_id'), table_name='ai_suggestion')
    op.drop_table('ai_suggestion')
    op.drop_index('ix_piece_title', table_name='piece')
    op.drop_index(op.f('ix_piece_parent_piece_id'), table_name='piece')
    op.drop_index(op.f('ix_piece_deleted_at'), table_name='piece')
    op.drop_index(op.f('ix_piece_current_location_id'), table_name='piece')
    op.drop_index(op.f('ix_piece_collection_id'), table_name='piece')
    op.drop_index(op.f('ix_piece_category_term_id'), table_name='piece')
    op.drop_table('piece')
    op.drop_index('uq_user_role_active', table_name='user_role', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index(op.f('ix_user_role_user_id'), table_name='user_role')
    op.drop_index(op.f('ix_user_role_role_id'), table_name='user_role')
    op.drop_index(op.f('ix_user_role_deleted_at'), table_name='user_role')
    op.drop_table('user_role')
    op.drop_index(op.f('ix_term_vocabulary_id'), table_name='term')
    op.drop_index(op.f('ix_term_deleted_at'), table_name='term')
    op.drop_table('term')
    op.drop_index('uq_role_permission_active', table_name='role_permission', postgresql_where=sa.text('deleted_at IS NULL'), sqlite_where=sa.text('deleted_at IS NULL'))
    op.drop_index(op.f('ix_role_permission_role_id'), table_name='role_permission')
    op.drop_index(op.f('ix_role_permission_permission_id'), table_name='role_permission')
    op.drop_index(op.f('ix_role_permission_deleted_at'), table_name='role_permission')
    op.drop_table('role_permission')
    op.drop_index(op.f('ix_import_batch_deleted_at'), table_name='import_batch')
    op.drop_table('import_batch')
    op.drop_index(op.f('ix_vocabulary_deleted_at'), table_name='vocabulary')
    op.drop_table('vocabulary')
    op.drop_index(op.f('ix_role_deleted_at'), table_name='role')
    op.drop_table('role')
    op.drop_index(op.f('ix_location_parent_id'), table_name='location')
    op.drop_index(op.f('ix_location_deleted_at'), table_name='location')
    op.drop_table('location')
    op.drop_index(op.f('ix_import_mapping_template_header_signature'), table_name='import_mapping_template')
    op.drop_index(op.f('ix_import_mapping_template_deleted_at'), table_name='import_mapping_template')
    op.drop_table('import_mapping_template')
    op.drop_index(op.f('ix_identifier_type_deleted_at'), table_name='identifier_type')
    op.drop_table('identifier_type')
    op.drop_index('uq_collection_acronym_active', table_name='collection', postgresql_where=sa.text('deleted_at IS NULL AND acronym_normalized IS NOT NULL'), sqlite_where=sa.text('deleted_at IS NULL AND acronym_normalized IS NOT NULL'))
    op.drop_index(op.f('ix_collection_parent_id'), table_name='collection')
    op.drop_index(op.f('ix_collection_deleted_at'), table_name='collection')
    op.drop_table('collection')
    op.drop_index(op.f('ix_audit_log_user_id'), table_name='audit_log')
    op.drop_index('ix_audit_log_entity', table_name='audit_log')
    op.drop_index(op.f('ix_audit_log_change_set_id'), table_name='audit_log')
    op.drop_table('audit_log')
    op.drop_table('permission')
    op.drop_index('uq_app_user_email_active', table_name='app_user')
    op.drop_index(op.f('ix_app_user_deleted_at'), table_name='app_user')
    op.drop_table('app_user')
