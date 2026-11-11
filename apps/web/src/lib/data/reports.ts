/**
 * Reportes de inventario en modo `live` (change `reportes-inventario`, tareas 3.1 y 3.2; RF-033,
 * RF-034, RF-041). `GET /reports/{report_type}` devuelve una página del reporte con sus subtotales y
 * totales del reporte completo; con `format` descarga el archivo, o responde 202 con un trabajo de
 * exportación si supera el límite de la exportación síncrona. La vista imprimible lee el reporte
 * completo por páginas, hasta `PRINT_LIMIT` filas (design D5).
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";

import { IMPORT_ERROR_MESSAGES, call, type ImportFailure, type ImportResult } from "./imports";
import { apiBaseUrl, getApiMode } from "./mode";
import { apiFilters, filtersFromSearchParams, type SearchFilters } from "./search";

export type Report = ApiSchemas["ReportOut"];
export type ReportSubtotal = ApiSchemas["ReportSubtotal"];
export type ExportJob = ApiSchemas["ExportJob"];
export type LiveReportType = "inventory" | "by-collection" | "by-location" | "by-attribute";
export type ReportKey = LiveReportType | "incomplete";
type ReportQuery = NonNullable<paths["/api/v1/reports/{report_type}"]["get"]["parameters"]["query"]>;
export type GroupBy = NonNullable<ReportQuery["group_by"]>;

export interface ReportParams {
  collectionId?: string | null;
  locationId?: string | null;
  includeLoansForUse?: boolean;
  notVerifiedSinceDays?: number | null;
  /** El atributo de «Piezas agrupadas por…» (RF-047). */
  groupBy?: GroupBy | null;
  /** Los filtros de la búsqueda, los mismos que entiende `GET /search` (RF-047, design D1). */
  filters?: SearchFilters;
}

/** Los reportes con vista imprimible. */
export const PRINTABLE_REPORTS: LiveReportType[] = ["inventory", "by-collection", "by-location", "by-attribute"];
/** Filas máximas de la vista imprimible; por encima se sugiere Excel (design D5). */
export const PRINT_LIMIT = 2000;
const PAGE_SIZE_MAX = 100;

export const REPORT_TYPES: { type: ReportKey; label: string; summary: string; needs?: "collection" | "location" }[] = [
  { type: "inventory", label: "Inventario general", summary: "Todas las piezas del inventario permanente." },
  { type: "by-collection", label: "Por colección", summary: "Las piezas de una colección y sus subcolecciones.", needs: "collection" },
  { type: "by-location", label: "Por ubicación", summary: "Las piezas de una ubicación y cuándo se verificaron.", needs: "location" },
  { type: "by-attribute", label: "Piezas agrupadas por…", summary: "Por procedencia, denominación, autor, material, estado, categoría o colección." },
  { type: "incomplete", label: "Información incompleta", summary: "Las piezas a las que aún les faltan datos." },
];

/** Los atributos de «Piezas agrupadas por…», con los nombres que lleva el título del reporte. */
export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "provenance", label: "Procedencia" },
  { value: "denomination", label: "Denominación" },
  { value: "author", label: "Autor" },
  { value: "material", label: "Material" },
  { value: "conservation_state", label: "Estado de conservación" },
  { value: "category", label: "Categoría" },
  { value: "collection", label: "Colección" },
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

function query(params: ReportParams): ReportQuery {
  return {
    ...(params.filters ? (apiFilters(params.filters) as ReportQuery) : {}),
    ...(params.groupBy ? { group_by: params.groupBy } : {}),
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
    groupBy: GROUP_BY_OPTIONS.find((option) => option.value === search.get("group_by"))?.value ?? null,
    filters: filtersFromSearchParams(search),
  };
}

/** Por qué no se puede pedir el reporte todavía (falta un parámetro obligatorio), o `null`. */
export function missingParameter(type: LiveReportType, params: ReportParams): string | null {
  if (type === "by-collection" && !params.collectionId) return "Elija la colección.";
  if (type === "by-location" && !params.locationId) return "Elija la ubicación.";
  if (type === "by-attribute" && !params.groupBy) return "Elija por qué atributo agrupar.";
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

export const DESCRIPTION_COLUMN = "Descripción";
/** Hasta aquí la descripción cabe en las dos líneas de la vista previa; con más se ofrece «ver más». */
const DESCRIPTION_PREVIEW_CHARS = 140;
/** Las columnas que dividen las filas en grupos, de la más específica a la más general. */
const GROUP_COLUMNS = ["Grupo", "Colección"];

export interface ReportRowGroup {
  /** El valor del grupo; `null` si el reporte no se divide en grupos. */
  label: string | null;
  /** Qué agrupa: «Procedencia», «Colección»… */
  heading: string | null;
  /** Piezas del grupo en el reporte completo, no solo en esta página; `null` si no hay subtotal. */
  count: number | null;
  rows: unknown[][];
}

/** Filas consecutivas del mismo grupo, para plegarlas en la vista previa y separarlas al imprimir. */
export function groupRows(report: Pick<Report, "columns" | "rows" | "subtotals">): ReportRowGroup[] {
  const column = GROUP_COLUMNS.find((name) => report.columns.includes(name));
  if (!column) return [{ label: null, heading: null, count: null, rows: report.rows }];
  const index = report.columns.indexOf(column);
  const groups: ReportRowGroup[] = [];
  for (const row of report.rows) {
    const label = String(row[index] ?? "");
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.rows.push(row);
      continue;
    }
    const subtotal = (report.subtotals ?? []).find((item) => item.label === label && (column === "Grupo" || item.group === column));
    groups.push({ label, heading: subtotal?.group ?? column, count: subtotal?.count ?? null, rows: [row] });
  }
  return groups;
}

/** «Procedencia: Puno — 80 piezas»; el conteo es de todo el reporte, no de la página. */
export function groupTitle(group: Pick<ReportRowGroup, "heading" | "label" | "count">): string {
  const title = `${group.heading}: ${group.label}`;
  return group.count === null ? title : `${title} — ${group.count.toLocaleString("es-PE")} ${group.count === 1 ? "pieza" : "piezas"}`;
}

/** El texto de una celda. Una descripción vacía queda vacía, sin texto de relleno. */
export function cellText(value: unknown, column?: string): string {
  if (value == null || value === "") return column === DESCRIPTION_COLUMN ? "" : "—";
  return String(value);
}

/** La descripción no cabe en dos líneas: se recorta y se ofrece «ver más». */
export function isLongDescription(text: string): boolean {
  return text.length > DESCRIPTION_PREVIEW_CHARS || text.includes("\n");
}

/** Lo que el rol no puede ver, con las mismas palabras que el archivo (RF-041). */
export function maskedNotice(columns: string[]): string {
  if (columns.length === 1 && columns[0] === "Ubicación") return "Ubicación limitada a sede y espacio por tus permisos";
  return `Columnas limitadas por tus permisos: ${columns.join(", ")}`;
}

export function filtersText(report: Pick<Report, "filters">): string {
  const filters = Object.entries(report.filters ?? {});
  return filters.length ? filters.map(([key, value]) => `${key}: ${String(value)}`).join("; ") : "sin filtros";
}

/**
 * Frases de los totales conocidos (change `reportes-vista-simplificada`, Req: Textos y números de
 * Reportes en lenguaje llano): «14 piezas», no «Piezas: 14». La clave se compara sin mayúsculas
 * porque la API usa «Piezas» y la demostración, «piezas».
 */
const TOTAL_PHRASES: Record<string, readonly [singular: string, plural: string]> = {
  piezas: ["pieza", "piezas"],
  colecciones: ["colección", "colecciones"],
  propiedad: ["en propiedad", "en propiedad"],
  comodato: ["en comodato", "en comodato"],
  "préstamo temporal": ["en préstamo temporal", "en préstamo temporal"],
  "apariciones en grupos": ["aparición en grupos", "apariciones en grupos"],
  "nunca verificadas": ["nunca verificada", "nunca verificadas"],
};

/** Un número con el formato de la aplicación (`es-PE`); lo demás, tal cual. */
export function reportNumber(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString("es-PE") : String(value);
}

export function totalsText(report: Pick<Report, "totals">): string {
  return Object.entries(report.totals)
    .map(([label, value]) => {
      const phrase = TOTAL_PHRASES[label.trim().toLowerCase()];
      if (phrase && typeof value === "number") return `${reportNumber(value)} ${value === 1 ? phrase[0] : phrase[1]}`;
      // Lo que no tiene frase (p. ej. «Total PEN») se deja como nombre y valor, con el número formateado.
      return `${label}: ${reportNumber(value)}`;
    })
    .join(" · ");
}

/** Más columnas que estas y la vista previa muestra solo las principales (W6). */
export const PREVIEW_COLUMN_LIMIT = 6;

const MAIN_PIECE_COLUMNS = ["Código I", "Código de colección", "Denominación", DESCRIPTION_COLUMN, "Colección", "Régimen"] as const;

/**
 * Columnas principales de la vista previa por tipo de reporte (change `reportes-vista-simplificada`,
 * design D1). `[SUPUESTO: W6]` La descarga y la impresión llevan siempre todas.
 */
export const PREVIEW_COLUMNS: Readonly<Partial<Record<string, readonly string[]>>> = {
  inventory: MAIN_PIECE_COLUMNS,
  "by-collection": MAIN_PIECE_COLUMNS,
  // La columna del grupo ya se lee en el encabezado de cada grupo.
  "by-attribute": MAIN_PIECE_COLUMNS,
  "by-location": ["Código I", "Código de colección", "Denominación", DESCRIPTION_COLUMN, "Ubicación", "Última vez vista"],
};

/**
 * Índices de las columnas que pinta la vista previa, en el orden del reporte. Todas si se pidió,
 * si el reporte trae pocas o si no tiene columnas principales; una principal que no viene se omite.
 */
export function previewColumns(report: Pick<Report, "report_type" | "columns">, showAll: boolean): number[] {
  const all = report.columns.map((_, index) => index);
  if (showAll || report.columns.length <= PREVIEW_COLUMN_LIMIT) return all;
  const main = PREVIEW_COLUMNS[report.report_type];
  if (!main) return all;
  const picked = all.filter((index) => main.includes(report.columns[index]));
  return picked.length > 0 ? picked : all;
}

/** «En pantalla: 6 de 19 columnas. El Excel las trae todas.»; `null` si se ven todas. */
export function previewColumnsNotice(visible: number, total: number): string | null {
  if (visible >= total) return null;
  return `En pantalla: ${visible} de ${total} columnas. El Excel las trae todas.`;
}
