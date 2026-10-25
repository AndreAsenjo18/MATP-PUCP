"""Background worker for export jobs (RF-036, RF-044, design D3).

Handles asynchronous generation of large Excel/CSV results exports and full database
export packages. Manages heartbeat, interruption recovery, and audit logging.
"""

from __future__ import annotations

import csv
import datetime
import hashlib
import logging
import tempfile
import uuid
from pathlib import Path

from sqlalchemy import select

from app.api.deps import load_permissions
from app.api.enums import TENURE_REGIME_LABELS
from app.core.jobs import Heartbeat, SessionFactory, is_stale, register_recovery
from app.core.models_base import new_uuid, utcnow
from app.core.storage import ObjectStorage
from app.core.xlsx import write_table
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.collections.models import Collection, Term
from app.modules.locations.models import Location
from app.modules.search.filters import PieceFilter
from app.modules.search.models import ExportJobKind, ExportJobModel, ExportJobStatus
from app.modules.users.models import AppUser
from app.modules.users.sensitive import PERM_DONOR_DATA, PERM_LOAN_TERMS, PERM_VALUATION

logger = logging.getLogger(__name__)

EXPORT_TTL_HOURS = 72
EXPORT_SYNC_MAX_ROWS = 5000


def _update_heartbeat(factory: SessionFactory, job_id: uuid.UUID) -> None:
    with factory() as session:
        job = session.get(ExportJobModel, job_id)
        if job and job.status == ExportJobStatus.RUNNING:
            job.heartbeat_at = utcnow()
            session.commit()


def run_export_job(
    factory: SessionFactory,
    job_id: uuid.UUID,
    storage: ObjectStorage | None = None,
) -> None:
    """Execute an export job in background with heartbeat and error tracking."""
    with factory() as session:
        job = session.get(ExportJobModel, job_id)
        if not job or job.status != ExportJobStatus.PENDING:
            return

        job.status = ExportJobStatus.RUNNING
        job.heartbeat_at = utcnow()
        session.commit()

        requester = session.get(AppUser, job.requested_by_id)
        if job.requested_by_id:
            _, permissions = load_permissions(session, job.requested_by_id)
            user_perms = set(permissions)
        else:
            user_perms = set()
        user_label = requester.email if requester else "sistema"

    heartbeat = Heartbeat(lambda: _update_heartbeat(factory, job_id))

    try:
        if job.kind == ExportJobKind.FULL:
            from app.modules.exports.full import export_full_database_job

            export_full_database_job(factory, job_id, storage)
            return
        if job.kind == ExportJobKind.REPORT:
            _run_report_export(factory, job_id, storage, frozenset(user_perms), user_label)
            return

        # Results export (XLSX or CSV)
        _run_results_export(factory, job_id, storage, user_perms, user_label, heartbeat)

    except Exception as exc:
        logger.exception("Error executing export job %s", job_id)
        with factory() as session:
            job = session.get(ExportJobModel, job_id)
            if job:
                job.status = ExportJobStatus.FAILED
                job.error = str(exc)
                session.commit()


def _run_results_export(
    factory: SessionFactory,
    job_id: uuid.UUID,
    storage: ObjectStorage | None,
    user_perms: set[str],
    user_label: str,
    heartbeat: Heartbeat,
) -> None:
    with factory() as session:
        job = session.get(ExportJobModel, job_id)
        if not job:
            return

        params = job.params or {}
        filter_dict = params.get("filters", {})
        fmt = (job.format or "xlsx").lower()

        piece_filter = PieceFilter(**filter_dict)
        viewer = Viewer(frozenset(user_perms))
        where_clause = piece_filter.to_where(session, viewer)

        # Check sensitive columns permissions
        masked_fields: list[str] = []
        can_view_lender = PERM_DONOR_DATA in user_perms
        can_view_loan = PERM_LOAN_TERMS in user_perms
        can_view_valuation = PERM_VALUATION in user_perms

        if not can_view_lender:
            masked_fields.append("lender_name")
        if not can_view_loan:
            masked_fields.append("loan_agreement_ref")
        if not can_view_valuation:
            masked_fields.append("valuation")

        columns = [
            "Cdigo I",
            "Denominacin",
            "Coleccin",
            "Rgimen de tenencia",
            "Categora",
            "Estado de conservacin",
            "Ubicacin",
            "Autor",
            "Procedencia",
            "poca",
        ]
        if can_view_lender:
            columns.append("Comodante")
        if can_view_loan:
            columns.append("Convenio de prstamo")

        query = select(Piece).where(where_clause).order_by(Piece.denomination)
        pieces = session.scalars(query).all()
        row_count = len(pieces)

        # Build rows
        reader = CatalogReader(session, viewer)
        summaries = reader.summaries(pieces)
        summaries_by_id = {s.id: s for s in summaries}

        def row_generator():
            for idx, piece in enumerate(pieces):
                if idx % 100 == 0:
                    heartbeat.tick()
                summary = summaries_by_id.get(piece.id)
                code_i = summary.code_i if summary else ""
                coll_name = ""
                if piece.collection_id:
                    c = session.get(Collection, piece.collection_id)
                    coll_name = c.name if c else ""

                cat_name = ""
                if piece.category_id:
                    term = session.get(Term, piece.category_id)
                    cat_name = term.label if term else ""

                state_name = ""
                if piece.conservation_state_id:
                    term = session.get(Term, piece.conservation_state_id)
                    state_name = term.label if term else ""

                loc_name = ""
                if piece.current_location_id:
                    loc = session.get(Location, piece.current_location_id)
                    loc_name = loc.name if loc else ""

                regime_label = (
                    TENURE_REGIME_LABELS.get(piece.tenure_regime, piece.tenure_regime.value)
                    if piece.tenure_regime
                    else ""
                )

                row = [
                    code_i,
                    piece.denomination,
                    coll_name,
                    regime_label,
                    cat_name,
                    state_name,
                    loc_name,
                    piece.author or "",
                    piece.provenance or "",
                    piece.epoch_original_text or "",
                ]
                if can_view_lender:
                    row.append(piece.lender_name or "")
                if can_view_loan:
                    row.append(piece.loan_agreement_ref or "")
                yield row

        # Write output
        with tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        try:
            if fmt == "xlsx":
                write_table(
                    tmp_path,
                    row_generator(),
                    columns,
                    sheet_title="Resultados",
                    active_filters=piece_filter.describe(session),
                    user_label=user_label,
                    omitted_columns=masked_fields if masked_fields else None,
                )
                content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            else:
                with open(tmp_path, "w", encoding="utf-8-sig", newline="") as csv_f:
                    writer = csv.writer(csv_f)
                    writer.writerow(columns)
                    for r in row_generator():
                        writer.writerow(r)
                content_type = "text/csv"

            file_bytes = tmp_path.read_bytes()
            sha256_hash = hashlib.sha256(file_bytes).hexdigest()
            storage_key = f"exports/{job_id}/results.{fmt}"

            if storage is not None:
                storage.put_bytes(storage_key, file_bytes, content_type)

            # Update job state
            job.status = ExportJobStatus.READY
            job.storage_key = storage_key
            job.sha256 = sha256_hash
            job.row_count = row_count
            job.expires_at = utcnow() + datetime.timedelta(hours=EXPORT_TTL_HOURS)
            job.masked_fields = masked_fields

            # Audit log
            ctx = AuditContext(
                origin=AuditOrigin.MANUAL if job.requested_by_id else AuditOrigin.SYSTEM,
                user_id=job.requested_by_id,
                actor_label=user_label or "export_worker",
                action=AuditAction.EXPORT,
            )
            set_audit_context(session, ctx)

            audit_entry = AuditLog(
                change_set_id=new_uuid(),
                entity_type="export_job",
                entity_id=job.id,
                field=None,
                old_value=None,
                new_value={
                    "kind": job.kind.value,
                    "format": fmt,
                    "row_count": row_count,
                    "filters": filter_dict,
                    "includes_sensitive_fields": can_view_lender or can_view_loan,
                    "masked_fields": masked_fields,
                    "sha256": sha256_hash,
                },
                action=AuditAction.EXPORT,
                origin=AuditOrigin.MANUAL,
                user_id=job.requested_by_id,
                actor_label=user_label,
                reason=f"Exportacin de resultados ({fmt}) con {row_count} filas",
            )
            session.add(audit_entry)
            session.commit()

        finally:
            if tmp_path.exists():
                tmp_path.unlink()


def _run_report_export(
    factory: SessionFactory,
    job_id: uuid.UUID,
    storage: ObjectStorage | None,
    permissions: frozenset[str],
    user_label: str,
) -> None:
    """A report above the synchronous limit (reportes-inventario 1.2), rebuilt on its own
    consistent snapshot with the permissions of whoever asked for it."""
    from app.modules.reports import registry as reports
    from app.modules.reports.files import report_file

    with factory() as session:
        job = session.get(ExportJobModel, job_id)
        if not job:
            return
        params = job.params or {}
        report_type = str(params.get("report_type"))
        fmt = (job.format or "xlsx").lower()
        features = frozenset(params.get("features", []))
        data = reports.build(
            report_type, session, permissions, reports.params_from(params), features
        )
        content, content_type = report_file(
            data, fmt, generated_at=utcnow(), generated_by=user_label
        )
        storage_key = f"exports/{job_id}/reporte-{report_type}.{fmt}"
        if storage is not None:
            storage.put_bytes(storage_key, content, content_type)
        job.status = ExportJobStatus.READY
        job.storage_key = storage_key
        job.sha256 = hashlib.sha256(content).hexdigest()
        job.row_count = len(data.rows)
        job.expires_at = utcnow() + datetime.timedelta(hours=EXPORT_TTL_HOURS)
        job.masked_fields = data.masked_columns
        reports.record_report_export(
            session, job.requested_by_id, user_label, report_type, fmt, data, entity_id=job.id
        )
        session.commit()


def recover_interrupted_exports(factory: SessionFactory) -> int:
    """Recover stale running export jobs after server restarts (RF-036)."""
    with factory() as session:
        stale_jobs = session.scalars(
            select(ExportJobModel).where(ExportJobModel.status == ExportJobStatus.RUNNING)
        ).all()
        recovered = 0
        for job in stale_jobs:
            if is_stale(job.heartbeat_at):
                job.status = ExportJobStatus.FAILED
                job.error = "Trabajo interrumpido por reinicio del servidor"
                recovered += 1
        if recovered:
            session.commit()
        return recovered


def register_export_jobs() -> None:
    """Register export recovery on app startup."""
    register_recovery("exports", recover_interrupted_exports)
