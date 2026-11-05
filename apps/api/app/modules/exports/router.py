"""Router for asynchronous export jobs and download URLs (RF-036, RF-044)."""

from __future__ import annotations

import contextlib
import datetime
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep, require_permission
from app.api.stubs import implemented
from app.core.errors import NotFound, PermissionDenied
from app.core.models_base import utcnow
from app.modules.search.models import ExportJobModel, ExportJobStatus
from app.modules.search.schemas import ExportFormat, ExportJob

router = APIRouter(prefix="/exports", tags=["Exportaciones"])

Exporter = Annotated[CurrentUser, Depends(require_permission("exports.run"))]


def _to_export_job_schema(job: ExportJobModel) -> ExportJob:
    fmt = ExportFormat.XLSX
    with contextlib.suppress(ValueError):
        fmt = ExportFormat(job.format.lower())
    return ExportJob(
        id=job.id,
        kind=job.kind.value,
        status=job.status.value,
        format=fmt,
        row_count=job.row_count,
        created_at=job.created_at,
        expires_at=job.expires_at,
        masked_fields=job.masked_fields or [],
        sha256=job.sha256,
        error=job.error,
    )


@router.get(
    "/jobs",
    response_model=list[ExportJob],
    summary="Listar trabajos de exportación del usuario (o todos si es administrador)",
    **implemented(),
)
def list_export_jobs(
    session: SessionDep,
    user: Exporter,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[ExportJob]:
    """List export jobs. Regular users see only their own jobs; admins see all."""
    query = select(ExportJobModel).order_by(ExportJobModel.created_at.desc()).limit(limit)
    is_admin = "admin" in {r.lower() for r in user.roles} or "exports.full" in user.permissions
    if not is_admin:
        query = query.where(ExportJobModel.requested_by_id == user.id)

    jobs = session.scalars(query).all()
    return [_to_export_job_schema(j) for j in jobs]


@router.get(
    "/jobs/{job_id}",
    response_model=ExportJob,
    summary="Consultar estado de un trabajo de exportación (RF-036)",
    **implemented(),
)
def get_export_job(job_id: uuid.UUID, session: SessionDep, user: Exporter) -> ExportJob:
    """Get status and details of an export job."""
    job = session.get(ExportJobModel, job_id)
    if job is None:
        raise NotFound("No existe ese trabajo de exportación.")

    is_admin = "admin" in {r.lower() for r in user.roles} or "exports.full" in user.permissions
    if job.requested_by_id != user.id and not is_admin:
        raise PermissionDenied("No tiene permiso para consultar la exportación de otro usuario.")

    return _to_export_job_schema(job)


@router.get(
    "/jobs/{job_id}/download-url",
    summary="Obtener URL prefirmada de descarga de un archivo de exportación (RF-036)",
    **implemented(),
)
def get_export_download_url(
    job_id: uuid.UUID,
    request: Request,
    session: SessionDep,
    user: Exporter,
) -> dict[str, str | None]:
    """Get presigned download URL for a completed, non-expired export."""
    job = session.get(ExportJobModel, job_id)
    if job is None:
        raise NotFound("No existe ese trabajo de exportación.")

    is_admin = "admin" in {r.lower() for r in user.roles} or "exports.full" in user.permissions
    if job.requested_by_id != user.id and not is_admin:
        raise PermissionDenied("No tiene permiso para descargar la exportación de otro usuario.")

    if job.status != ExportJobStatus.READY or not job.storage_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La exportación todavía no está lista para descarga.",
        )

    now = utcnow()
    is_expired = False
    if job.expires_at:
        exp = job.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=datetime.UTC)
        is_expired = exp < now

    if is_expired:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="El archivo de exportación ha caducado. Genere una nueva exportación.",
        )

    storage = getattr(request.app.state, "storage", None)
    if storage is None:
        from app.core.storage import ObjectStorage

        storage = ObjectStorage.from_settings(request.app.state.settings)

    download_url = storage.presign_get(job.storage_key, ttl_seconds=3600)
    return {
        "download_url": download_url,
        "expires_at": job.expires_at.isoformat() if job.expires_at else None,
    }
