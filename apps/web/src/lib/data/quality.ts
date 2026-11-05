/**
 * Capa de datos de calidad consciente del modo (change `alertas-y-reporte-incompletas`): alertas
 * de la pieza, KPI del tablero, reporte de piezas incompletas y su evolución diaria.
 *
 * En modo `live` usa el cliente tipado contra `GET /pieces/{piece_id}/alerts`, `GET
 * /reports/dashboard-stats[?by_collection]`, `GET /quality/incomplete` (JSON, o `format=xlsx|csv`
 * para descargar) y `GET /reports/dashboard-stats/history`.
 *
 * En modo `mock` responde con los fixtures (spec plataforma, «Recorrido completo sin backend»):
 * `alertsForPiece`, `computeCompletenessKpis` y `computeIncompletePieces`. Los fixtures no tienen
 * instantáneas diarias reales, así que `fetchDashboardHistory` arma en memoria una serie plana
 * con los números actuales para que el gráfico de evolución tenga algo que dibujar.
 */
import { apiErrorMessage, createApiClient, type ApiSchemas } from "@/lib/api/client";
import { alertsForPiece, computeCompletenessKpis, computeIncompletePieces, getPieceDetail } from "@/lib/fixtures";

import { apiBaseUrl, getApiMode } from "./mode";

export type PieceAlert = ApiSchemas["PieceAlert"];
export type AlertType = PieceAlert["type"];
export type CompletenessKpis = ApiSchemas["CompletenessKpis"];
export type AlertKpi = ApiSchemas["AlertKpi"];
export type CollectionKpis = ApiSchemas["CollectionKpis"];
export type IncompletePiece = ApiSchemas["IncompletePiece"];
export type SnapshotPoint = ApiSchemas["SnapshotPointOut"];

const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";
export const INCOMPLETE_PAGE_SIZE = 20;

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

export type QualityFailure = { status: "unavailable"; message: string };
export type PieceAlertsResult = { status: "ok"; alerts: PieceAlert[] } | QualityFailure;
export type DashboardKpisResult = { status: "ok"; kpis: CompletenessKpis } | QualityFailure;

/** `GET /pieces/{piece_id}/alerts`: alertas activas con mensaje y acción sugerida (RF-019). */
export async function fetchPieceAlerts(pieceId: string, devUser?: string): Promise<PieceAlertsResult> {
  if (getApiMode() === "mock") {
    const piece = getPieceDetail(pieceId);
    return { status: "ok", alerts: piece ? alertsForPiece(piece) : [] };
  }
  try {
    const { data, error } = await client(devUser).GET("/api/v1/pieces/{piece_id}/alerts", {
      params: { path: { piece_id: pieceId } },
    });
    if (error) return { status: "unavailable", message: apiErrorMessage(error) };
    return { status: "ok", alerts: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** `GET /reports/dashboard-stats`: KPI de completitud, global y (`byCollection`) por colección. */
export async function fetchDashboardKpis(byCollection: boolean, devUser?: string): Promise<DashboardKpisResult> {
  if (getApiMode() === "mock") return { status: "ok", kpis: computeCompletenessKpis() };
  try {
    const { data, error } = await client(devUser).GET("/api/v1/reports/dashboard-stats", {
      params: { query: { by_collection: byCollection } },
    });
    if (error) return { status: "unavailable", message: apiErrorMessage(error) };
    return { status: "ok", kpis: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

export interface IncompleteFilters {
  alert?: AlertType[];
  collectionId?: string;
  includeSubcollections?: boolean;
  page?: number;
  pageSize?: number;
}

export interface IncompletePage {
  items: IncompletePiece[];
  total: number;
  page: number;
  pageSize: number;
}

export type IncompleteReportResult = { status: "ok"; page: IncompletePage } | QualityFailure;

/** `GET /quality/incomplete`: piezas con alguna alerta activa, paginadas (RF-019, RF-035). */
export async function fetchIncompleteReport(filters: IncompleteFilters, devUser?: string): Promise<IncompleteReportResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? INCOMPLETE_PAGE_SIZE;
  if (getApiMode() === "mock") {
    const items = computeIncompletePieces().filter(
      (p) => !filters.alert || filters.alert.length === 0 || filters.alert.every((a) => p.alerts.includes(a)),
    );
    return { status: "ok", page: { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize } };
  }
  try {
    // La operación responde JSON o un archivo según `format`; sin él, el cliente tipado solo
    // sabe que el contenido es uno de los dos, así que se fija el tipo de la variante JSON
    // (mismo patrón que `fetchImportLog` en lib/data/imports.ts).
    const { data, error } = (await client(devUser).GET("/api/v1/quality/incomplete", {
      params: {
        query: {
          alert: filters.alert,
          collection_id: filters.collectionId,
          include_subcollections: filters.includeSubcollections,
          page,
          page_size: pageSize,
        },
      },
    })) as { data?: ApiSchemas["Page_IncompletePiece_"]; error?: unknown };
    if (error || !data) return { status: "unavailable", message: apiErrorMessage(error) };
    return { status: "ok", page: { items: data.items, total: data.total, page: data.page, pageSize: data.page_size } };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

export type DownloadResult = { status: "ok"; blob: Blob } | QualityFailure;

/**
 * Descarga el reporte en Excel o CSV. Se pide con `fetch` (cliente tipado) y no con un enlace
 * directo porque la petición debe llevar la identidad de la sesión en la cabecera (igual que
 * `downloadImportLog`); solo disponible en modo `live`, la maqueta no genera archivos.
 */
export async function downloadIncompleteReport(
  filters: IncompleteFilters,
  format: "xlsx" | "csv",
  devUser?: string,
): Promise<DownloadResult> {
  if (getApiMode() === "mock") {
    return { status: "unavailable", message: "La descarga solo está disponible conectada a la API." };
  }
  try {
    const { data, error } = await client(devUser).GET("/api/v1/quality/incomplete", {
      params: {
        query: {
          alert: filters.alert,
          collection_id: filters.collectionId,
          include_subcollections: filters.includeSubcollections,
          format,
        },
      },
      parseAs: "blob",
    });
    if (error !== undefined || !data) return { status: "unavailable", message: apiErrorMessage(error) };
    return { status: "ok", blob: data as unknown as Blob };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

export type DashboardHistoryResult = { status: "ok"; points: SnapshotPoint[] } | QualityFailure;

/** Últimos `n` días (AAAA-MM-DD), incluido hoy; sirve de rango por defecto para la evolución. */
export function recentDateRange(today: Date, days: number): { from: string; to: string } {
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

function mockHistoryDays(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const days: string[] = [];
  for (let t = start; t <= end; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
  return days.slice(-14); // no más de dos semanas, para que el gráfico de la maqueta no se sature
}

/** `GET /reports/dashboard-stats/history`: un punto por día y alerta (RF-035, design D5). */
export async function fetchDashboardHistory(
  from: string,
  to: string,
  collectionId?: string,
  devUser?: string,
): Promise<DashboardHistoryResult> {
  if (getApiMode() === "mock") {
    const kpis = computeCompletenessKpis();
    const points: SnapshotPoint[] = mockHistoryDays(from, to).flatMap((taken_on) =>
      kpis.alerts.map((alert) => ({
        taken_on,
        alert: alert.alert,
        numerator: alert.numerator,
        denominator: alert.denominator,
        completeness_ratio: alert.completeness_ratio,
      })),
    );
    return { status: "ok", points };
  }
  try {
    const { data, error } = await client(devUser).GET("/api/v1/reports/dashboard-stats/history", {
      params: { query: { from, to, collection_id: collectionId } },
    });
    if (error) return { status: "unavailable", message: apiErrorMessage(error) };
    return { status: "ok", points: data.points };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}
