"""Quality, search, reports and exports (calidad-datos, busqueda-reportes)."""

import csv
import tempfile
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from fastapi import Path as FastAPIPath
from fastapi.responses import JSONResponse
from sqlalchemy import and_, func, or_, select

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
    CHANGE_REPORTS,
    implemented,
    not_implemented,
    stub,
)
from app.core.errors import NotFound
from app.core.jobs import run_in_background
from app.core.models_base import new_uuid, utcnow
from app.core.xlsx import write_table
from app.modules.audit.context import AuditContext, set_audit_context
from app.modules.audit.models import AuditAction, AuditLog, AuditOrigin
from app.modules.catalog.models import Piece
from app.modules.catalog.queries import CatalogReader, Viewer
from app.modules.collections.models import Collection, Term
from app.modules.exports.worker import EXPORT_SYNC_MAX_ROWS, run_export_job
from app.modules.locations.models import Location
from app.modules.quality.completeness import (
    list_completeness_rules,
    load_active_rules,
    replace_completeness_rules,
)
from app.modules.quality.incomplete_report import (
    XLSX_CONTENT_TYPE,
    build_incomplete_query,
    incomplete_report_csv,
    incomplete_report_workbook,
    rows_for_pieces,
)
from app.modules.quality.kpis import compute_dashboard_kpis
from app.modules.quality.models import DuplicateStatus, QualityJob
from app.modules.quality.queue import (
    StaleCandidate,
    queue_query,
    reopen_expired_postponements,
    resolve_candidate,
)
from app.modules.quality.scan import run_full_scan, start_scan
from app.modules.quality.schemas import (
    AlertKpi,
    AlertType,
    CollectionKpis,
    CompletenessKpis,
    CompletenessRuleOut,
    CompletenessRulesUpdate,
    DashboardHistory,
    DuplicateCandidateOut,
    DuplicateOrigin,
    DuplicateResolution,
    IncompletePiece,
    QualityJobOut,
    SnapshotPointOut,
)
from app.modules.quality.snapshot import dashboard_history
from app.modules.reports import registry as reports
from app.modules.reports.files import report_file
from app.modules.search.filters import PieceFilter
from app.modules.search.models import ExportJobKind, ExportJobModel, ExportJobStatus
from app.modules.search.ranking import generate_search_suggestions, rank_and_describe_pieces
from app.modules.search.schemas import (
    ExportFormat,
    ExportJob,
    ReportOut,
    ReportSubtotal,
    ReportType,
    SearchExportRequest,
    SearchResultPage,
)
from app.modules.users.sensitive import PERM_DONOR_DATA, PERM_LOAN_TERMS, PERM_VALUATION

router = APIRouter(responses=COMMON_ERROR_RESPONSES)

Reader = Annotated[CurrentUser, Depends(require_permission("pieces.read"))]
ReportViewer = Annotated[CurrentUser, Depends(require_permission("reports.view"))]
Exporter = Annotated[CurrentUser, Depends(require_permission("exports.run"))]
CompletenessRulesManager = Annotated[
    CurrentUser, Depends(require_permission("quality.completeness_rules.manage"))
]


# ------------------------------------------------------------------------- quality
@router.get(
    "/quality/incomplete",
    response_model=Page[IncompletePiece],
    summary="Listado de piezas con alertas de incompletitud (RF-019)",
    tags=["Calidad"],
    responses={
        200: {
            "content": {"text/csv": {}, XLSX_CONTENT_TYPE: {}},
            "description": "Lista en JSON o, con `format=xlsx|csv`, como archivo descargable "
            "(sin paginar: incluye todas las piezas que cumplen los filtros).",
        }
    },
    **implemented(),
)
def list_incomplete_pieces(
    session: SessionDep,
    user: ReportViewer,
    params: Annotated[PageParams, Depends(page_params)],
    alert: Annotated[list[AlertType] | None, Query(description="Tipos de alerta (AND).")] = None,
    collection_id: uuid.UUID | None = None,
    include_subcollections: Annotated[
        bool, Query(description="Con `collection_id`, incluye sus subcolecciones.")
    ] = True,
    export_format: Annotated[ExportFormat | None, Query(alias="format")] = None,
) -> Page[IncompletePiece] | Response:
    rules = load_active_rules(session)
    statement = build_incomplete_query(
        session,
        rules,
        alert_codes=alert,
        collection_id=collection_id,
        include_subcollections=include_subcollections,
    )
    filters = {
        "alert": ", ".join(alert) if alert else None,
        "collection_id": str(collection_id) if collection_id else None,
        "include_subcollections": include_subcollections if collection_id else None,
    }
    if export_format is not None:
        pieces = list(session.scalars(statement))
        rows = rows_for_pieces(session, pieces, rules)
        if export_format == ExportFormat.CSV:
            return Response(
                content=incomplete_report_csv(rows, filters),
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="piezas-incompletas.csv"'},
            )
        return Response(
            content=incomplete_report_workbook(rows, filters),
            media_type=XLSX_CONTENT_TYPE,
            headers={"Content-Disposition": 'attachment; filename="piezas-incompletas.xlsx"'},
        )
    pieces, total = paginate(session, statement, params)
    rows = rows_for_pieces(session, pieces, rules)
    return Page[IncompletePiece](
        items=[
            IncompletePiece(
                piece_id=row.piece_id,
                title=row.title,
                collection_name=row.collection_name,
                alerts=row.alerts,
            )
            for row in rows
        ],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@router.get(
    "/reports/dashboard-stats",
    response_model=CompletenessKpis,
    summary="KPI de completitud general y por coleccin (RF-035)",
    tags=["Calidad"],
    **implemented(),
)
def get_dashboard_stats(
    session: SessionDep,
    user: ReportViewer,
    by_collection: Annotated[
        bool, Query(description="Incluye el desglose por colección raíz con subcolecciones.")
    ] = False,
) -> CompletenessKpis:
    kpis = compute_dashboard_kpis(session, by_collection=by_collection)
    return CompletenessKpis(
        total_pieces=kpis.total_pieces,
        alerts=[AlertKpi.model_validate(alert, from_attributes=True) for alert in kpis.alerts],
        by_collection=[
            CollectionKpis(
                collection_id=group.collection_id,
                collection_name=group.collection_name,
                alerts=[
                    AlertKpi.model_validate(alert, from_attributes=True) for alert in group.alerts
                ],
            )
            for group in kpis.by_collection
        ],
        computed_at=kpis.computed_at,
    )


@router.get(
    "/reports/dashboard-stats/history",
    response_model=DashboardHistory,
    summary="Evolución diaria de los indicadores de completitud (RF-035)",
    tags=["Calidad"],
    **implemented(),
)
def get_dashboard_stats_history(
    session: SessionDep,
    user: ReportViewer,
    date_from: Annotated[date, Query(alias="from", description="Fecha inicial, incluida.")],
    date_to: Annotated[date, Query(alias="to", description="Fecha final, incluida.")],
    collection_id: Annotated[
        uuid.UUID | None, Query(description="Omitido: indicadores globales.")
    ] = None,
) -> DashboardHistory:
    points = dashboard_history(session, date_from, date_to, collection_id)
    return DashboardHistory(
        collection_id=collection_id,
        points=[SnapshotPointOut.model_validate(point, from_attributes=True) for point in points],
    )


@router.get(
    "/quality/completeness-rules",
    response_model=list[CompletenessRuleOut],
    summary="Campos obligatorios y recomendados vigentes para las alertas de completitud",
    tags=["Calidad"],
    **implemented(),
)
def get_completeness_rules(
    session: SessionDep, user: CompletenessRulesManager
) -> list[CompletenessRuleOut]:
    rules = list_completeness_rules(session)
    return [CompletenessRuleOut.model_validate(rule, from_attributes=True) for rule in rules]


@router.put(
    "/quality/completeness-rules",
    response_model=list[CompletenessRuleOut],
    summary="Reemplazar los campos obligatorios y recomendados (RF-019, RN-010)",
    tags=["Calidad"],
    **implemented(),
)
def put_completeness_rules(
    body: CompletenessRulesUpdate, session: SessionDep, user: CompletenessRulesManager
) -> list[CompletenessRuleOut]:
    writer(session, user)
    rules = replace_completeness_rules(
        session, [(rule.field, rule.kind, rule.is_active) for rule in body.rules]
    )
    session.commit()
    return [CompletenessRuleOut.model_validate(rule, from_attributes=True) for rule in rules]


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
        Query(description="CATALOG: dos piezas del catlogo; IMPORT: fila de importacin."),
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
    summary="Resolver un candidato: fusionar, marcar distinto o posponer (nunca borrar; RF-030)",
    tags=["Calidad"],
    **implemented(),
)
def resolve_duplicate_candidate(
    candidate_id: uuid.UUID,
    body: DuplicateResolution,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("duplicates.resolve"))],
) -> DuplicateCandidateOut:
    writer(session, user, reason=body.note)
    try:
        candidate = resolve_candidate(
            session,
            candidate_id,
            resolution=body.resolution,
            reviewer_id=user.id,
            note=body.note,
            postponed_until=body.postponed_until,
            surviving_piece_id=body.surviving_piece_id,
            field_choices=body.field_choices,
        )
    except StaleCandidate:
        session.commit()  # the pair stays SUPERSEDED (spec: Candidato obsoleto)
        raise
    session.commit()
    return DuplicateCandidateOut.model_validate(candidate)


@router.post(
    "/quality/duplicates/scan",
    response_model=QualityJobOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary=(
        "Lanzar la deteccin completa de duplicados en segundo plano; 409 si ya hay una en curso "
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
    summary="Estado y avance de una deteccin de duplicados (RF-030, RNF-015)",
    tags=["Calidad"],
    **implemented(),
)
def get_quality_job(job_id: uuid.UUID, session: SessionDep, user: Reader) -> QualityJobOut:
    job = session.get(QualityJob, job_id)
    if job is None:
        raise NotFound("No existe esa deteccin de duplicados.")
    return QualityJobOut.model_validate(job)


# ------------------------------------------------------------------------- search
@router.get(
    "/search",
    response_model=SearchResultPage,
    response_model_exclude_unset=True,
    summary="Bsqueda avanzada con filtros combinados (RF-031, RF-032)",
    tags=["Bsqueda"],
    **implemented(),
)
def search_pieces(
    q: Annotated[str, Query(min_length=1, max_length=200, description="Cdigo o texto.")],
    session: SessionDep,
    user: Reader,
    collection_code: Annotated[
        str | None, Query(description="Sigla de la coleccin, con o sin puntos (ej. MMZ, M.M.Z.).")
    ] = None,
    tenure_regime: Annotated[
        TenureRegimeLabel | None,
        Query(description="Rgimen de tenencia: Propiedad, Comodato o Prstamo Temporal."),
    ] = None,
    page: Annotated[int, Query(ge=1, description="Nmero de pgina (desde 1).")] = 1,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="Resultados por pgina (mx. 100).")
    ] = DEFAULT_PAGE_SIZE,
) -> SearchResultPage:
    regime = (
        code_of(TENURE_REGIME_LABELS, tenure_regime, "tenure_regime")
        if tenure_regime is not None
        else None
    )
    piece_filter = PieceFilter(
        q=q,
        collection_code=collection_code,
        tenure_regime=regime,
    )
    viewer = Viewer(user.permissions)
    where_clause = piece_filter.to_where(session, viewer)
    params = PageParams(page=page, page_size=limit)
    query = select(Piece).where(where_clause).order_by(Piece.denomination)
    pieces, total = paginate(session, query, params)
    summaries = CatalogReader(session, viewer).summaries(pieces)
    hits = rank_and_describe_pieces(session, pieces, summaries, q)

    extra_kwargs: dict[str, Any] = {}
    active_other_filters = [f for f in piece_filter.describe() if f.key != "q"]
    if total == 0 and len(active_other_filters) >= 2:
        suggestions, active_f = generate_search_suggestions(piece_filter, q, total)
        if suggestions:
            extra_kwargs["suggestions"] = suggestions
        if active_f:
            extra_kwargs["active_filters"] = [a.model_dump() for a in active_f]

    return SearchResultPage(
        items=hits,
        total=total,
        page=page,
        limit=limit,
        **extra_kwargs,
    )


@router.post(
    "/reports/export-excel",
    response_model=ExportJob,
    summary="Exportar a Excel los resultados de la consulta actual (RF-036)",
    tags=["Reportes"],
    **implemented(),
)
def export_excel_report(
    body: SearchExportRequest,
    user: Exporter,
    session: SessionDep,
    request: Request,
    background_tasks: BackgroundTasks,
) -> Any:
    # 1. Parse unified filter
    piece_filter = PieceFilter(**(body.filters or {}))
    viewer = Viewer(user.permissions)
    where_clause = piece_filter.to_where(session, viewer)

    # 2. Count matching rows
    count = session.scalar(select(func.count(Piece.id)).where(where_clause)) or 0
    fmt = body.format.value if hasattr(body.format, "value") else str(body.format).lower()

    # 3. Synchronous export if count <= EXPORT_SYNC_MAX_ROWS (5 000)
    if count <= EXPORT_SYNC_MAX_ROWS:
        user_perms = user.permissions
        can_view_lender = PERM_DONOR_DATA in user_perms
        can_view_loan = PERM_LOAN_TERMS in user_perms
        can_view_valuation = PERM_VALUATION in user_perms

        masked_fields: list[str] = []
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

        pieces = session.scalars(
            select(Piece).where(where_clause).order_by(Piece.denomination)
        ).all()
        reader = CatalogReader(session, viewer)
        summaries = {s.id: s for s in reader.summaries(pieces)}

        rows = []
        for piece in pieces:
            summary = summaries.get(piece.id)
            code_i = summary.code_i if summary else ""
            coll_name = ""
            if piece.collection_id:
                coll = session.get(Collection, piece.collection_id)
                coll_name = coll.name if coll else ""
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
            rows.append(row)

        with tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            if fmt == "xlsx":
                write_table(
                    tmp_path,
                    rows,
                    columns,
                    sheet_title="Resultados",
                    active_filters=piece_filter.describe(session),
                    user_label=user.email or "usuario",
                    omitted_columns=masked_fields if masked_fields else None,
                )
                media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            else:
                with open(tmp_path, "w", encoding="utf-8-sig", newline="") as csv_f:
                    csv_w = csv.writer(csv_f)
                    csv_w.writerow(columns)
                    for r in rows:
                        csv_w.writerow(r)
                media_type = "text/csv"

            file_bytes = tmp_path.read_bytes()

            ctx = AuditContext(
                origin=AuditOrigin.MANUAL,
                user_id=user.id,
                actor_label=user.email or "usuario",
                action=AuditAction.EXPORT,
            )
            set_audit_context(session, ctx)

            # Record audit
            audit_entry = AuditLog(
                change_set_id=new_uuid(),
                entity_type="export_job",
                entity_id=new_uuid(),
                field=None,
                old_value=None,
                new_value={
                    "kind": "results",
                    "format": fmt,
                    "row_count": count,
                    "filters": body.filters,
                    "includes_sensitive_fields": can_view_lender or can_view_loan,
                    "masked_fields": masked_fields,
                },
                action=AuditAction.EXPORT,
                origin=AuditOrigin.MANUAL,
                user_id=user.id,
                actor_label=user.email or "usuario",
                reason=f"Exportacin sncrona de resultados ({fmt}) con {count} filas",
            )
            session.add(audit_entry)
            session.commit()

            resp_headers = {"Content-Disposition": f'attachment; filename="reporte_catalogo.{fmt}"'}
            if masked_fields:
                resp_headers["X-Omited-Columns"] = ", ".join(masked_fields)

            return Response(
                content=file_bytes,
                media_type=media_type,
                headers=resp_headers,
            )
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    # 4. Asynchronous export job if count > EXPORT_SYNC_MAX_ROWS
    job = ExportJobModel(
        kind=ExportJobKind.RESULTS,
        requested_by_id=user.id,
        format=fmt,
        params=body.model_dump(),
        status=ExportJobStatus.PENDING,
        row_count=count,
    )
    session.add(job)
    session.commit()

    run_in_background(
        background_tasks,
        run_export_job,
        request.app.state.session_factory,
        job.id,
        getattr(request.app.state, "storage", None),
    )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=ExportJob(
            id=job.id,
            status="PENDING",
            format=body.format,
            row_count=count,
        ).model_dump(mode="json"),
    )


# ------------------------------------------------------------------------ reports
@router.get(
    "/reports/{report_type}",
    response_model=ReportOut,
    responses={
        200: {
            "content": {XLSX_CONTENT_TYPE: {}, "text/csv": {}},
            "description": "El reporte en JSON (una página) o, con `format`, el archivo.",
        },
        202: {"model": ExportJob, "description": "Reporte grande: se genera en segundo plano."},
        403: {"description": "`exact_location_required`: detalle por debajo del espacio."},
        404: {"description": "`report_not_found`, con los reportes disponibles para su rol."},
    },
    summary="Reportes: inventario general, por colección, por ubicación e incompletas (RF-033)",
    description="Catálogo cerrado de reportes generados sobre una instantánea consistente: el "
    "total coincide con la suma de subtotales y con las filas. Excluye préstamos temporales, "
    "piezas eliminadas y fusionadas; incluye los comodatos con subtotal propio salvo "
    "`include_loans_for_use=false` [SUPUESTO]. La ubicación se limita a sede y espacio sin el "
    "permiso de ubicación exacta (RF-041). Con `format` descarga el archivo, o lo genera en "
    "segundo plano (202) si supera el límite de la exportación síncrona.",
    tags=["Reportes"],
    **implemented(),
)
def get_report(
    request: Request,
    background_tasks: BackgroundTasks,
    report_type: Annotated[
        str,
        FastAPIPath(
            description="Tipo de reporte.",
            json_schema_extra={"enum": [item.value for item in ReportType]},
        ),
    ],
    session: SessionDep,
    user: ReportViewer,
    collection_id: uuid.UUID | None = None,
    location_id: uuid.UUID | None = None,
    include_loans_for_use: bool = True,
    not_verified_since_days: Annotated[int | None, Query(ge=0)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
    export_format: Annotated[ExportFormat | None, Query(alias="format")] = None,
) -> ReportOut | Response:
    params = reports.ReportParams(
        collection_id=collection_id,
        location_id=location_id,
        include_loans_for_use=include_loans_for_use,
        not_verified_since_days=not_verified_since_days,
    )
    permissions = frozenset(user.permissions)
    data = reports.build(report_type, session, permissions, params)
    generated_at = utcnow()
    generated_by = user.email or "usuario"
    if export_format is not None:
        fmt = export_format.value
        if len(data.rows) > EXPORT_SYNC_MAX_ROWS:
            job = ExportJobModel(
                kind=ExportJobKind.REPORT,
                requested_by_id=user.id,
                format=fmt,
                params={"report_type": report_type, **reports.serialize_params(params)},
                status=ExportJobStatus.PENDING,
                row_count=len(data.rows),
            )
            session.add(job)
            session.commit()
            run_in_background(
                background_tasks,
                run_export_job,
                request.app.state.session_factory,
                job.id,
                getattr(request.app.state, "storage", None),
            )
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content=ExportJob(
                    id=job.id, status="PENDING", format=export_format, row_count=len(data.rows)
                ).model_dump(mode="json"),
            )
        content, media_type = report_file(
            data, fmt, generated_at=generated_at, generated_by=generated_by
        )
        reports.record_report_export(session, user.id, generated_by, report_type, fmt, data)
        session.commit()
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="reporte-{report_type}.{fmt}"'},
        )
    start = (page - 1) * page_size
    return ReportOut(
        report_type=ReportType(report_type),
        title=data.title,
        generated_at=generated_at,
        generated_by=generated_by,
        filters=data.filters,
        columns=data.columns,
        rows=data.rows[start : start + page_size],
        totals=data.totals,
        subtotals=[ReportSubtotal(**vars(subtotal)) for subtotal in data.subtotals],
        masked_columns=data.masked_columns,
        message=data.message,
        total_rows=len(data.rows),
        page=page,
        page_size=page_size,
    )


@router.get(
    "/reports/piece-card/{piece_id}/pdf",
    response_model=ExportJob,
    summary="Generar la ficha museogrfica imprimible de una pieza en PDF (RF-006)",
    tags=["Reportes"],
    **stub(CHANGE_REPORTS),
)
def export_piece_pdf(piece_id: uuid.UUID, user: ReportViewer) -> ExportJob:
    raise not_implemented(CHANGE_REPORTS, ExportJob)


@router.get(
    "/exports/full",
    response_model=ExportJob,
    summary="Exportacin completa de la base en formato abierto (RF-044)",
    tags=["Reportes"],
    **implemented(),
)
def export_full_database(
    request: Request,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    user: Annotated[CurrentUser, Depends(require_permission("exports.full"))],
    export_format: Annotated[ExportFormat, Query(alias="format")] = ExportFormat.XLSX,
) -> Any:
    # Check if a full export is already in progress (RF-044:
    # devuelve el trabajo en curso en lugar de iniciar otro)
    now = utcnow()
    existing_job = session.scalar(
        select(ExportJobModel)
        .where(
            ExportJobModel.kind == ExportJobKind.FULL,
            or_(
                ExportJobModel.status.in_([ExportJobStatus.PENDING, ExportJobStatus.RUNNING]),
                and_(
                    ExportJobModel.status == ExportJobStatus.READY,
                    ExportJobModel.expires_at > now,
                ),
            ),
        )
        .order_by(ExportJobModel.created_at.desc())
    )
    if existing_job:
        status_code = (
            status.HTTP_200_OK
            if existing_job.status == ExportJobStatus.READY
            else status.HTTP_202_ACCEPTED
        )
        return JSONResponse(
            status_code=status_code,
            content=ExportJob(
                id=existing_job.id,
                status=existing_job.status.value,
                format=ExportFormat.XLSX,
                row_count=existing_job.row_count,
                expires_at=existing_job.expires_at,
            ).model_dump(mode="json"),
        )

    # Create new full export job
    job = ExportJobModel(
        kind=ExportJobKind.FULL,
        requested_by_id=user.id,
        format=export_format.value,
        params={"format": export_format.value},
        status=ExportJobStatus.PENDING,
    )
    session.add(job)
    session.commit()

    run_in_background(
        background_tasks,
        run_export_job,
        request.app.state.session_factory,
        job.id,
        getattr(request.app.state, "storage", None),
    )

    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=ExportJob(
            id=job.id,
            status="PENDING",
            format=export_format,
        ).model_dump(mode="json"),
    )
