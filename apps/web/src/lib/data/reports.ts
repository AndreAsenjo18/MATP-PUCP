/**
 * Reportes de inventario en modo `live` (change `reportes-inventario`, tareas 3.1 y 3.2; RF-033,
 * RF-034, RF-041). `GET /reports/{report_type}` devuelve una página del reporte con sus subtotales y
 * totales del reporte completo; con `format` descarga el archivo, o responde 202 con un trabajo de
 * exportación si supera el límite de la exportación síncrona. La vista imprimible lee el reporte
 * completo por páginas, hasta `PRINT_LIMIT` filas (design D5).
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";

import { IMPORT_ERROR_MESSAGES, call, type ImportFailure, type ImportResult } from "./imports";
import { apiBaseUrl, getApiMode } from "./mode";

export type Report = ApiSchemas["ReportOut"];
export type ReportSubtotal = ApiSchemas["ReportSubtotal"];
export type ExportJob = ApiSchemas["ExportJob"];
export type LiveReportType = "inventory" | "by-collection" | "by-location";

export interface ReportParams {
  collectionId?: string | null;
  locationId?: string | null;
  includeLoansForUse?: boolean;
  notVerifiedSinceDays?: number | null;
}

/** Filas máximas de la vista imprimible; por encima se sugiere Excel (design D5). */
export const PRINT_LIMIT = 2000;
const PAGE_SIZE_MAX = 100;

export const REPORT_TYPES: { type: LiveReportType | "incomplete"; label: string; needs?: "collection" | "location" }[] = [
  { type: "inventory", label: "Inventario general" },
  { type: "by-collection", label: "Por colección", needs: "collection" },
  { type: "by-location", label: "Por ubicación", needs: "location" },
  { type: "incomplete", label: "Información incompleta" },
];

export const REPORT_ERROR_MESSAGES: Record<string, string> = {
  ...IMPORT_ERROR_MESSAGES,
  report_not_found: "Ese reporte no existe o no está disponible para su rol.",
  invalid_report_parameter: "Revise los parámetros del reporte.",
  exact_location_required:
    "Su rol no ve el detalle por debajo del espacio. Elija la sede o el espacio que contiene esa ubicación: el reporte se entrega agregado por espacio.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

function query(params: ReportParams) {
  return {
    ...(params.collectionId ? { collection_id: params.collectionId } : {}),
    ...(params.locationId ? { location_id: params.locationId } : {}),
    ...(params.includeLoansForUse === false ? { include_loans_for_use: false } : {}),
    ...(params.notVerifiedSinceDays != null ? { not_verified_since_days: params.notVerifiedSinceDays } : {}),
  };
}

/** Parámetros del reporte en la URL de la vista imprimible (`/reportes/imprimir/[tipo]?...`). */
export function printHref(type: LiveReportType, params: ReportParams): string {
  const search = new URLSearchParams(Object.entries(query(params)).map(([key, value]) => [key, String(value)]));
  const text = search.toString();
  return `/reportes/imprimir/${type}${text ? `?${text}` : ""}`;
}

export function paramsFromSearch(search: URLSearchParams): ReportParams {
  const days = search.get("not_verified_since_days");
  return {
    collectionId: search.get("collection_id"),
    locationId: search.get("location_id"),
    includeLoansForUse: search.get("include_loans_for_use") !== "false",
    notVerifiedSinceDays: days ? Number(days) : null,
  };
}

/** Por qué no se puede pedir el reporte todavía (falta un parámetro obligatorio), o `null`. */
export function missingParameter(type: LiveReportType, params: ReportParams): string | null {
  if (type === "by-collection" && !params.collectionId) return "Elija la colección.";
  if (type === "by-location" && !params.locationId) return "Elija la ubicación.";
  return null;
}

/** Una página del reporte, con subtotales y totales del reporte completo. */
export async function fetchReport(
  type: LiveReportType,
  params: ReportParams,
  page = 1,
  pageSize = 25,
  devUser?: string,
): Promise<ImportResult<Report>> {
  return call(
    () =>
      client(devUser).GET("/api/v1/reports/{report_type}", {
        params: { path: { report_type: type }, query: { ...query(params), page, page_size: pageSize } },
      }) as Promise<{ data?: Report; error?: unknown }>,
    REPORT_ERROR_MESSAGES,
  );
}

/** El reporte completo para imprimir, o `tooLarge` si supera `PRINT_LIMIT` filas. */
export async function fetchPrintableReport(
  type: LiveReportType,
  params: ReportParams,
  devUser?: string,
): Promise<ImportResult<Report & { tooLarge: boolean }>> {
  const first = await fetchReport(type, params, 1, PAGE_SIZE_MAX, devUser);
  if (first.status !== "ok") return first;
  const report = first.value;
  if (report.total_rows > PRINT_LIMIT) return { status: "ok", value: { ...report, rows: [], tooLarge: true } };
  const rows = [...report.rows];
  for (let page = 2; rows.length < report.total_rows; page += 1) {
    const next = await fetchReport(type, params, page, PAGE_SIZE_MAX, devUser);
    if (next.status !== "ok") return next;
    if (next.value.rows.length === 0) break;
    rows.push(...next.value.rows);
  }
  return { status: "ok", value: { ...report, rows, tooLarge: false } };
}

export type ReportDownload = { kind: "file"; blob: Blob; fileName: string } | { kind: "job"; job: ExportJob };

/** Excel del reporte: el archivo, o el trabajo en segundo plano (202) si es grande. */
export async function downloadReport(
  type: LiveReportType,
  params: ReportParams,
  devUser?: string,
): Promise<ImportResult<ReportDownload> | ImportFailure> {
  if (getApiMode() === "mock") return { status: "unavailable", message: "Disponible con la API (modo live)." };
  try {
    const { data, error, response } = await client(devUser).GET("/api/v1/reports/{report_type}", {
      params: { path: { report_type: type }, query: { ...query(params), format: "xlsx" } },
      parseAs: "blob",
    });
    if (error !== undefined || !data) {
      const result = await call(async () => ({ error }), REPORT_ERROR_MESSAGES);
      return result.status === "ok" ? { status: "unavailable", message: "No se pudo generar el reporte." } : result;
    }
    if (response.status === 202) {
      const job = JSON.parse(await (data as unknown as Blob).text()) as ExportJob;
      return { status: "ok", value: { kind: "job", job } };
    }
    return { status: "ok", value: { kind: "file", blob: data as unknown as Blob, fileName: `reporte-${type}.xlsx` } };
  } catch {
    return { status: "unavailable", message: "No se pudo conectar con el servidor. Intente nuevamente." };
  }
}

/** Filas agrupadas por colección para los saltos de página de la vista imprimible. */
export function groupByCollection(report: Pick<Report, "columns" | "rows">): { label: string | null; rows: unknown[][] }[] {
  const index = report.columns.indexOf("Colección");
  if (index < 0) return [{ label: null, rows: report.rows }];
  const groups: { label: string | null; rows: unknown[][] }[] = [];
  for (const row of report.rows) {
    const label = String(row[index] ?? "");
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }
  return groups;
}
