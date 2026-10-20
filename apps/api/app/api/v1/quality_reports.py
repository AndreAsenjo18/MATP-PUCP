"""Quality, search, reports and exports (calidad-datos, busqueda-reportes)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status

from app.api.deps import CurrentUser, SessionDep, require_permission, writer
from app.api.enums import TENURE_REGIME_LABELS, TenureRegimeLabel, code_of
from app.api.errors import COMMON_ERROR_RESPONSES
from app.api.pagination import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    Page,
    PageParams,
    page_params,
    paginate,
)
from app.api.stubs import (
    CHANGE_DUPLICATES,
    CHANGE_INCOMPLETE,
    CHANGE_REPORTS,
    CHANGE_SEARCH_EXPORT,
    implemented,
    not_implemented,
    page_example,
    stub,
)
from app.core.errors import NotFound
from app.core.jobs import run_in_background
from app.modules.catalog.queries import CatalogReader, PieceFilters, Viewer, build_piece_query
from app.modules.collections.service import find_collection_by_code
from app.modules.quality.models import DuplicateStatus, QualityJob
from app.modules.quality.queue import (
    StaleCandidate,
    queue_query,
    reopen_expired_postponements,
    resolve_candidate,
)
from app.modules.quality.scan import run_full_scan, start_scan
from app.modules.quality.schemas import (
    AlertType,
    CompletenessKpis,
    DuplicateCandidateOut,
    DuplicateOrigin,
    DuplicateResolution,
    IncompletePiece,
    QualityJobOut,
)
from app.modules.search.schemas import (
    ExportFormat,
    ExportJob,
    ReportOut,
    ReportType,
    SearchExportRequest,
    SearchResultPage,
)
from app.modules.search.service import describe_matches

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
ReportViewer = Annotated[CurrentUser, Depends(require_permission("reports.view"))]
Exporter = Annotated[CurrentUser, Depends(require_permission("exports.run"))]


# ------------------------------------------------------------------------ quality
@router.get(
    "/quality/incomplete",
    response_model=Page[IncompletePiece],
    summary="Piezas con información incompleta (RF-019, RF-035)",
    tags=["Calidad"],
    **stub(CHANGE_INCOMPLETE),
)
def list_incomplete_pieces(
    user: ReportViewer,
    params: Annotated[PageParams, Depends(page_params)],
    alert: Annotated[list[AlertType] | None, Query(description="Tipos de alerta (AND).")] = None,
    collection_id: uuid.UUID | None = None,
) -> Page[IncompletePiece]:
    raise not_implemented(CHANGE_INCOMPLETE, page_example(IncompletePiece))


@router.get(
    "/reports/dashboard-stats",
    response_model=CompletenessKpis,
    summary="KPI de completitud general y por colección (RF-035)",
    tags=["Calidad"],
    **stub(CHANGE_INCOMPLETE),
)
def get_dashboard_stats(user: ReportViewer) -> CompletenessKpis:
    raise not_implemented(CHANGE_INCOMPLETE, CompletenessKpis)


@router.get(
    "/quality/duplicates",
    response_model=Page[DuplicateCandidateOut],
    summary="Cola de posibles duplicados por revisar, con filtros (RF-030)",
    tags=["Calidad"],
    **implemented(),
)
def list_duplicate_candidates(
    session: SessionDep,
    user: Reader,
    params: Annotated[PageParams, Depends(page_params)],
    candidate_status: Annotated[DuplicateStatus | None, Query(alias="status")] = None,
    collection_id: Annotated[
        uuid.UUID | None, Query(description="Incluye las subcolecciones.")
    ] = None,
    min_score: Annotated[float | None, Query(ge=0, le=1)] = None,
    origin: Annotated[
        DuplicateOrigin | None,
        Query(description="CATALOG: dos piezas del catálogo; IMPORT: fila de importación."),
    ] = None,
) -> Page[DuplicateCandidateOut]:
    if reopen_expired_postponements(session):  # design D5: no cron, reopened on read
        session.commit()
    statement = queue_query(
        session,
        status=candidate_status,
        collection_id=collection_id,
        min_score=min_score,
        origin=origin,
    )
    rows, total = paginate(session, statement, params)
    return Page[DuplicateCandidateOut](
        items=[DuplicateCandidateOut.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.post(
    "/quality/duplicates/{candidate_id}/resolve",
    response_model=DuplicateCandidateOut,
    summary=(
        "Resolver un candidato: marcar distinto o posponer (nunca borrar); la fusión llega con "
        "la tarea 3.3 (RF-030)"
    ),
    tags=["Calidad"],
    **implemented(),
)
def resolve_duplicate_candidate(
    candidate_id: uuid.UUID,
    body: DuplicateResolution,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("duplicates.resolve"))],
) -> DuplicateCandidateOut:
    if body.resolution == "MERGED":  # merge procedure: task 3.3 of the same change
        raise not_implemented(CHANGE_DUPLICATES, DuplicateCandidateOut)
    writer(session, user, reason=body.note)
    try:
        candidate = resolve_candidate(
            session,
            candidate_id,
            resolution=body.resolution,
            reviewer_id=user.id,
            note=body.note,
            postponed_until=body.postponed_until,
        )
    except StaleCandidate:
        session.commit()  # the pair stays SUPERSEDED (spec: «Candidato obsoleto»)
        raise
    session.commit()
    return DuplicateCandidateOut.model_validate(candidate)


@router.post(
    "/quality/duplicates/scan",
    response_model=QualityJobOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary=(
        "Lanzar la detección completa de duplicados en segundo plano; 409 si ya hay una en curso "
        "(RF-030)"
    ),
    tags=["Calidad"],
    **implemented(),
)
def scan_duplicates(
    request: Request,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("duplicates.resolve"))],
) -> QualityJobOut:
    writer(session, user)
    job = start_scan(session, user.id)
    session.commit()
    run_in_background(background_tasks, run_full_scan, request.app.state.session_factory, job.id)
    return QualityJobOut.model_validate(job)


@router.get(
    "/quality/jobs/{job_id}",
    response_model=QualityJobOut,
    summary="Estado y avance de una detección de duplicados (RF-030, RNF-015)",
    tags=["Calidad"],
    **implemented(),
)
def get_quality_job(job_id: uuid.UUID, session: SessionDep, user: Reader) -> QualityJobOut:
    job = session.get(QualityJob, job_id)
    if job is None:
        raise NotFound("No existe esa detección de duplicados.")
    return QualityJobOut.model_validate(job)


# ------------------------------------------------------------------------- search
@router.get(
    "/search",
    response_model=SearchResultPage,
    summary="Búsqueda avanzada con filtros combinados (RF-031, RF-032)",
    tags=["Búsqueda"],
    **implemented(),
)
def search_pieces(
    q: Annotated[str, Query(min_length=1, max_length=200, description="Código o texto.")],
    session: SessionDep,
    user: Reader,
    collection_code: Annotated[
        str | None, Query(description="Sigla de la colección, con o sin puntos (ej. MMZ, M.M.Z.).")
    ] = None,
    tenure_regime: Annotated[
        TenureRegimeLabel | None,
        Query(description="Régimen de tenencia: Propiedad, Comodato o Préstamo Temporal."),
    ] = None,
    page: Annotated[int, Query(ge=1, description="Número de página (desde 1).")] = 1,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="Resultados por página (máx. 100).")
    ] = DEFAULT_PAGE_SIZE,
) -> SearchResultPage:
    collection_id: uuid.UUID | None = None
    if collection_code is not None:
        collection = find_collection_by_code(session, collection_code)
        if collection is None:
            return SearchResultPage(items=[], total=0, page=page, limit=limit)
        collection_id = collection.id

    regime = (
        code_of(TENURE_REGIME_LABELS, tenure_regime, "tenure_regime")
        if tenure_regime is not None
        else None
    )
    filters = PieceFilters(q=q, collection_id=collection_id, tenure_regime=regime)
    params = PageParams(page=page, page_size=limit)
    pieces, total = paginate(session, build_piece_query(session, filters), params)
    summaries = CatalogReader(session, Viewer(user.permissions)).summaries(pieces)
    return SearchResultPage(
        items=describe_matches(session, q, summaries),
        total=total,
        page=page,
        limit=limit,
    )


@router.post(
    "/reports/export-excel",
    response_model=ExportJob,
    summary="Exportar a Excel los resultados de la consulta actual (RF-036)",
    tags=["Reportes"],
    **stub(CHANGE_SEARCH_EXPORT),
)
def export_excel_report(body: SearchExportRequest, user: Exporter) -> ExportJob:
    raise not_implemented(CHANGE_SEARCH_EXPORT, ExportJob)


# ------------------------------------------------------------------------ reports
@router.get(
    "/reports/{report_type}",
    response_model=ReportOut,
    summary="Reportes: inventario, por colección, por ubicación, incompletas, valorización",
    tags=["Reportes"],
    **stub(CHANGE_REPORTS),
)
def get_report(
    report_type: ReportType,
    user: ReportViewer,
    collection_id: uuid.UUID | None = None,
    location_id: uuid.UUID | None = None,
    export_format: Annotated[ExportFormat | None, Query(alias="format")] = None,
) -> ReportOut:
    raise not_implemented(CHANGE_REPORTS, ReportOut)


@router.get(
    "/reports/piece-card/{piece_id}/pdf",
    response_model=ExportJob,
    summary="Generar la ficha museográfica imprimible de una pieza en PDF (RF-006)",
    tags=["Reportes"],
    **stub(CHANGE_REPORTS),
)
def export_piece_pdf(piece_id: uuid.UUID, user: ReportViewer) -> ExportJob:
    raise not_implemented(CHANGE_REPORTS, ExportJob)


@router.get(
    "/exports/full",
    response_model=ExportJob,
    summary="Exportación completa de la base en formato abierto (RF-044)",
    tags=["Reportes"],
    **stub(CHANGE_SEARCH_EXPORT),
)
def export_full_database(
    user: Annotated[CurrentUser, Depends(require_permission("exports.full"))],
    export_format: Annotated[ExportFormat, Query(alias="format")] = ExportFormat.XLSX,
) -> ExportJob:
    raise not_implemented(CHANGE_SEARCH_EXPORT, ExportJob)
