"""Tests for background export workers, recovery and full database export."""

from __future__ import annotations

import datetime
import hashlib
import io
import json
import zipfile

from sqlalchemy.orm import Session

from app.core.models_base import utcnow
from app.modules.audit.models import AuditAction, AuditLog
from app.modules.catalog.models import Piece, TenureRegime
from app.modules.collections.models import Collection
from app.modules.exports.full import export_full_database_job
from app.modules.exports.worker import recover_interrupted_exports, run_export_job
from app.modules.identification.models import NormalizationStatus, PieceIdentifier
from app.modules.search.models import ExportJobKind, ExportJobModel, ExportJobStatus


class InMemoryStorage:
    def __init__(self) -> None:
        self.files: dict[str, tuple[bytes, str]] = {}

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self.files[key] = (data, content_type)

    def get_bytes(self, key: str) -> bytes:
        return self.files[key][0]


def test_export_worker_results_and_audit(session: Session, engine, act_as) -> None:
    """Worker generates results file, calculates sha256, stores in bucket, and logs audit."""
    storage = InMemoryStorage()
    with act_as("ADMIN") as admin_user:
        coll = Collection(
            name="Coleccion Metalurgia",
            acronym="MET",
            acronym_normalized="MET",
        )
        session.add(coll)
        session.flush()

        p1 = Piece(
            denomination="Tumi ceremonial",
            tenure_regime=TenureRegime.OWNED,
            collection_id=coll.id,
        )
        session.add(p1)
        session.flush()

        ident = PieceIdentifier(
            piece_id=p1.id,
            identifier_type_code="I",
            original_value="I-100",
            normalized_value="I-100",
            normalization_status=NormalizationStatus.NORMALIZED,
            is_current=True,
        )
        session.add(ident)

        job = ExportJobModel(
            kind=ExportJobKind.RESULTS,
            requested_by_id=admin_user.user_id,
            format="xlsx",
            params={"filters": {"q": "Tumi"}},
            status=ExportJobStatus.PENDING,
        )
        session.add(job)
        session.commit()
        job_id = job.id

    from app.core.db import make_session_factory

    factory = make_session_factory(engine)

    run_export_job(factory, job_id, storage=storage)

    with factory() as sess:
        updated_job = sess.get(ExportJobModel, job_id)
        assert updated_job.status == ExportJobStatus.READY
        assert updated_job.row_count == 1
        assert updated_job.storage_key in storage.files
        assert updated_job.sha256 is not None
        assert updated_job.expires_at is not None

        # Verify audit log was created
        audit = sess.query(AuditLog).filter_by(action=AuditAction.EXPORT, entity_id=job_id).first()
        assert audit is not None
        assert audit.new_value["kind"] == "results"
        assert audit.new_value["row_count"] == 1
        assert audit.new_value["sha256"] == updated_job.sha256


def test_recover_interrupted_exports(session: Session, engine, act_as) -> None:
    """Stale jobs without heartbeat for > 60s are marked as FAILED with recovery message."""
    with act_as("ADMIN") as admin_user:
        stale_time = utcnow() - datetime.timedelta(seconds=120)
        job = ExportJobModel(
            kind=ExportJobKind.RESULTS,
            requested_by_id=admin_user.user_id,
            format="xlsx",
            params={},
            status=ExportJobStatus.RUNNING,
            heartbeat_at=stale_time,
        )
        session.add(job)
        session.commit()
        job_id = job.id

    from app.core.db import make_session_factory

    factory = make_session_factory(engine)

    recovered = recover_interrupted_exports(factory)
    assert recovered == 1

    with factory() as sess:
        j = sess.get(ExportJobModel, job_id)
        assert j.status == ExportJobStatus.FAILED
        assert "interrumpido" in j.error.lower()


def test_full_database_export_package(session: Session, engine, act_as) -> None:
    """Full export produces verifiable ZIP with all entities, soft-deleted rows,
    and no password_hash.
    """
    storage = InMemoryStorage()
    with act_as("ADMIN") as admin_user:
        # Create pieces (one active, one soft-deleted)
        p_active = Piece(
            denomination="Pieza Activa",
            tenure_regime=TenureRegime.OWNED,
        )
        p_deleted = Piece(
            denomination="Pieza Eliminada",
            tenure_regime=TenureRegime.OWNED,
            deleted_at=utcnow(),
            deletion_reason="Baja logica de prueba",
        )
        session.add_all([p_active, p_deleted])

        job = ExportJobModel(
            kind=ExportJobKind.FULL,
            requested_by_id=admin_user.user_id,
            format="zip",
            params={},
            status=ExportJobStatus.RUNNING,
        )
        session.add(job)
        session.commit()
        job_id = job.id

    from app.core.db import make_session_factory

    factory = make_session_factory(engine)

    export_full_database_job(factory, job_id, storage=storage)

    with factory() as sess:
        j = sess.get(ExportJobModel, job_id)
        assert j.status == ExportJobStatus.READY
        assert j.storage_key in storage.files

    zip_bytes = storage.get_bytes(j.storage_key)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        file_list = zf.namelist()
        assert "manifest.json" in file_list
        assert "diccionario.csv" in file_list
        assert "matp_export.xlsx" in file_list
        assert "csv/piece.csv" in file_list
        assert "csv/app_user.csv" in file_list

        # Check credentials excluded from user csv
        user_csv = zf.read("csv/app_user.csv").decode("utf-8-sig")
        assert "password_hash" not in user_csv
        assert "email" in user_csv

        # Check soft-deleted rows included in piece.csv
        piece_csv = zf.read("csv/piece.csv").decode("utf-8-sig")
        assert "Pieza Activa" in piece_csv
        assert "Pieza Eliminada" in piece_csv
        assert "Baja logica de prueba" in piece_csv

        # Check manifest integrity
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert "files" in manifest
        for f in manifest["files"]:
            content = zf.read(f["path"])
            assert hashlib.sha256(content).hexdigest() == f["sha256"]
