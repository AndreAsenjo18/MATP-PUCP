/**
 * Búsqueda en modo `live` (change `busqueda-avanzada-y-exportacion`, tareas 4.1 y 4.2; RF-031,
 * RF-032, RF-036, RF-044). `GET /search` recibe el mismo filtro único (`PieceFilter`) que la
 * exportación: lo que se ve en pantalla es lo que se exporta (design D1). Sin texto, la búsqueda
 * lista las piezas que cumplen los filtros en orden alfabético.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";

import { IMPORT_ERROR_MESSAGES, call, type ImportFailure, type ImportResult } from "./imports";
import { apiBaseUrl, getApiMode } from "./mode";

export type SearchHit = ApiSchemas["SearchHit"];
export type SearchPage = ApiSchemas["SearchResultPage"];
export type ExportJob = ApiSchemas["ExportJob"];
export type ExportFormat = ApiSchemas["ExportFormat"];
type SearchQuery = NonNullable<paths["/api/v1/search"]["get"]["parameters"]["query"]>;
export type TenureRegimeLabel = NonNullable<SearchQuery["tenure_regime"]>;
export type AlertCode = NonNullable<SearchQuery["alert_code"]>;

export const SEARCH_PAGE_SIZE = 20;

/** Filtros de la pantalla. `null`/vacío = filtro inactivo. */
export interface SearchFilters {
  q: string;
  collectionId: string | null;
  categoryId: string | null;
  materialId: string | null;
  conservationStateId: string | null;
  locationId: string | null;
  tenureRegime: TenureRegimeLabel | null;
  hasInventoryCode: boolean | null;
  epochStartYear: number | null;
  epochEndYear: number | null;
  hasAlerts: boolean | null;
}

export const EMPTY_FILTERS: SearchFilters = {
  q: "",
  collectionId: null,
  categoryId: null,
  materialId: null,
  conservationStateId: null,
  locationId: null,
  tenureRegime: null,
  hasInventoryCode: null,
  epochStartYear: null,
  epochEndYear: null,
  hasAlerts: null,
};

/** Nombre del filtro en la API (`PieceFilter`) para cada filtro de la pantalla. */
const API_KEYS: Record<keyof SearchFilters, string> = {
  q: "q",
  collectionId: "collection_id",
  categoryId: "category_id",
  materialId: "material_id",
  conservationStateId: "conservation_state_id",
  locationId: "location_id",
  tenureRegime: "tenure_regime",
  hasInventoryCode: "has_inventory_code",
  epochStartYear: "epoch_start_year",
  epochEndYear: "epoch_end_year",
  hasAlerts: "has_alerts",
};

export const FILTER_LABELS: Record<keyof SearchFilters, string> = {
  q: "Búsqueda",
  collectionId: "Colección",
  categoryId: "Categoría",
  materialId: "Material",
  conservationStateId: "Estado de conservación",
  locationId: "Ubicación",
  tenureRegime: "Régimen de tenencia",
  hasInventoryCode: "Código I",
  epochStartYear: "Época desde",
  epochEndYear: "Época hasta",
  hasAlerts: "Completitud",
};

/** Filtros activos en el formato de la API: query de `GET /search` y `filters` de la exportación. */
export function apiFilters(filters: SearchFilters): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const key of Object.keys(API_KEYS) as (keyof SearchFilters)[]) {
    const value = filters[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    result[API_KEYS[key]] = typeof value === "string" ? value.trim() : value;
  }
  return result;
}

export interface FilterChip {
  key: keyof SearchFilters;
  label: string;
  value: string;
}

/**
 * Un chip por filtro activo, con su valor en lenguaje claro. `names` traduce los identificadores
 * (colección, término, ubicación) a su nombre; sin nombre conocido se muestra «(seleccionada)».
 */
export function activeChips(filters: SearchFilters, names: Record<string, string> = {}): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (key: keyof SearchFilters, value: string) => chips.push({ key, label: FILTER_LABELS[key], value });
  if (filters.q.trim()) add("q", `«${filters.q.trim()}»`);
  for (const key of ["collectionId", "categoryId", "materialId", "conservationStateId", "locationId"] as const) {
    const id = filters[key];
    if (id) add(key, names[id] ?? "(seleccionada)");
  }
  if (filters.tenureRegime) add("tenureRegime", filters.tenureRegime);
  if (filters.hasInventoryCode !== null) add("hasInventoryCode", filters.hasInventoryCode ? "Con código I" : "Sin código I");
  if (filters.epochStartYear !== null) add("epochStartYear", String(filters.epochStartYear));
  if (filters.epochEndYear !== null) add("epochEndYear", String(filters.epochEndYear));
  if (filters.hasAlerts !== null) add("hasAlerts", filters.hasAlerts ? "Solo piezas incompletas" : "Solo piezas completas");
  return chips;
}

export function removeFilter(filters: SearchFilters, key: keyof SearchFilters): SearchFilters {
  return { ...filters, [key]: EMPTY_FILTERS[key] };
}

const IDENTIFIER_TYPE_LABELS: Record<string, string> = {
  I: "código I",
  COLECCION: "código de colección",
  INC: "código INC",
  RN: "registro nacional",
  PUCP: "código PUCP",
};

const FIELD_LABELS: Record<string, string> = {
  denomination: "denominación",
  author: "autor",
  provenance: "procedencia",
  epoch: "época",
  category: "categoría",
  conservation_state: "estado de conservación",
  material: "material",
};

function joinSpanish(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Qué coincidió, en una frase: «Coincide por código de colección «M.M.Z. 15»» (design D2). */
export function matchReasonText(hit: Pick<SearchHit, "match_reason">): string | null {
  const reason = hit.match_reason as Record<string, unknown> | null | undefined;
  if (!reason) return null;
  if (reason.kind === "identifier") {
    const type = String(reason.type ?? "");
    const label = IDENTIFIER_TYPE_LABELS[type] ?? `código ${type}`;
    const historical = reason.historical ? " (código histórico)" : "";
    return `Coincide por ${label} «${String(reason.original ?? "")}»${historical}`;
  }
  if (reason.kind === "text" && Array.isArray(reason.fields)) {
    const fields = reason.fields.map((field) => FIELD_LABELS[String(field)] ?? String(field));
    return fields.length ? `Coincide en ${joinSpanish(fields)}` : null;
  }
  return null;
}

/** Nombre de la pantalla para cada filtro de la API (para «Quitar el filtro …»). */
const LABEL_BY_API_KEY: Record<string, string> = {
  ...Object.fromEntries((Object.keys(API_KEYS) as (keyof SearchFilters)[]).map((key) => [API_KEYS[key], FILTER_LABELS[key]])),
  collection_code: "Colección",
  alert_code: "Completitud",
};

/** Una sugerencia de la API sin resultados (`remove_filter:<filtro>`, …) en lenguaje claro. */
export function suggestionText(suggestion: string): string {
  if (suggestion.startsWith("remove_filter:")) {
    const key = suggestion.slice("remove_filter:".length);
    return `Quite el filtro «${LABEL_BY_API_KEY[key] ?? key}».`;
  }
  if (suggestion === "check_code_format") return "Revise cómo escribió el código: pruebe sin puntos, guiones ni ceros a la izquierda.";
  if (suggestion === "search_historical") return "Busque también por un código anterior de la pieza (los códigos históricos se conservan).";
  return suggestion;
}

/** La pantalla del filtro que corresponde a una sugerencia `remove_filter:<filtro>`, si existe. */
export function filterOfSuggestion(suggestion: string): keyof SearchFilters | null {
  if (!suggestion.startsWith("remove_filter:")) return null;
  const apiKey = suggestion.slice("remove_filter:".length);
  const entry = (Object.entries(API_KEYS) as [keyof SearchFilters, string][]).find(([, key]) => key === apiKey);
  return entry ? entry[0] : null;
}

export const SEARCH_ERROR_MESSAGES: Record<string, string> = {
  ...IMPORT_ERROR_MESSAGES,
  filter_not_allowed: "Su rol no puede filtrar por ese campo.",
  unknown_export_column: "Una de las columnas elegidas no existe: recargue la página.",
  not_implemented: "Ese filtro todavía no está disponible.",
  gone: "El archivo de esa exportación ya caducó: genérela de nuevo.",
  conflict: "La exportación todavía no está lista.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

export async function fetchSearch(
  filters: SearchFilters,
  page = 1,
  devUser?: string,
  pageSize = SEARCH_PAGE_SIZE,
): Promise<ImportResult<SearchPage>> {
  return call(
    () =>
      client(devUser).GET("/api/v1/search", {
        params: { query: { ...(apiFilters(filters) as SearchQuery), page, limit: pageSize } },
      }) as Promise<{ data?: SearchPage; error?: unknown }>,
    SEARCH_ERROR_MESSAGES,
  );
}

// ---------------------------------------------------------------------------------------------
// Exportación de resultados (tarea 4.2)
// ---------------------------------------------------------------------------------------------

/** Columnas de la exportación, en el orden del archivo (`app/modules/exports/results.py`). */
export const EXPORT_COLUMNS: { key: string; label: string; sensitive?: boolean }[] = [
  { key: "code_i", label: "Código I" },
  { key: "denomination", label: "Denominación" },
  { key: "collection", label: "Colección" },
  { key: "tenure_regime", label: "Régimen de tenencia" },
  { key: "category", label: "Categoría" },
  { key: "conservation_state", label: "Estado de conservación" },
  { key: "location", label: "Ubicación" },
  { key: "author", label: "Autor" },
  { key: "provenance", label: "Procedencia" },
  { key: "period", label: "Época" },
  { key: "lender_name", label: "Comodante", sensitive: true },
  { key: "loan_agreement_ref", label: "Convenio de préstamo", sensitive: true },
];

export const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.filter((column) => !column.sensitive).map((column) => column.key);

export type ExportDownload = { kind: "file"; blob: Blob; fileName: string; omitted: string[] } | { kind: "job"; job: ExportJob };

/** `POST /reports/export-excel`: el archivo (hasta el umbral) o el trabajo en segundo plano (202). */
export async function exportResults(
  filters: SearchFilters,
  columns: string[],
  format: ExportFormat,
  devUser?: string,
): Promise<ImportResult<ExportDownload> | ImportFailure> {
  if (getApiMode() === "mock") return { status: "unavailable", message: "Disponible con la API (modo live)." };
  if (columns.length === 0) return { status: "rejected", code: "no_columns", message: "Elija al menos una columna." };
  try {
    const { data, error, response } = await client(devUser).POST("/api/v1/reports/export-excel", {
      body: { filters: apiFilters(filters), columns, format },
      parseAs: "blob",
    });
    if (error !== undefined || !data) {
      const result = await call(async () => ({ error }), SEARCH_ERROR_MESSAGES);
      return result.status === "ok" ? { status: "unavailable", message: "No se pudo generar la exportación." } : result;
    }
    if (response.status === 202) {
      const job = JSON.parse(await (data as unknown as Blob).text()) as ExportJob;
      return { status: "ok", value: { kind: "job", job } };
    }
    const omitted = (response.headers.get("x-omited-columns") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return { status: "ok", value: { kind: "file", blob: data as unknown as Blob, fileName: `resultados-busqueda.${format}`, omitted } };
  } catch {
    return { status: "unavailable", message: "No se pudo conectar con el servidor. Intente nuevamente." };
  }
}

/** «Mis exportaciones»: los trabajos del usuario (todos, para el Administrador), recientes primero. */
export async function fetchExportJobs(devUser?: string): Promise<ImportResult<ExportJob[]>> {
  return call(() => client(devUser).GET("/api/v1/exports/jobs", { params: { query: { limit: 20 } } }), SEARCH_ERROR_MESSAGES);
}

export async function fetchExportJob(jobId: string, devUser?: string): Promise<ImportResult<ExportJob>> {
  return call(() => client(devUser).GET("/api/v1/exports/jobs/{job_id}", { params: { path: { job_id: jobId } } }), SEARCH_ERROR_MESSAGES);
}

/** Enlace de descarga de corta duración; un archivo caducado responde 410 (`gone`). */
export async function fetchExportDownloadUrl(jobId: string, devUser?: string): Promise<ImportResult<string>> {
  const result = await call(
    () => client(devUser).GET("/api/v1/exports/jobs/{job_id}/download-url", { params: { path: { job_id: jobId } } }),
    SEARCH_ERROR_MESSAGES,
  );
  if (result.status !== "ok") return result;
  const url = result.value.download_url;
  return url ? { status: "ok", value: url } : { status: "unavailable", message: "La exportación no tiene archivo." };
}

/** `GET /exports/full` (RF-044): inicia el paquete completo o devuelve el que está en curso. */
export async function startFullExport(devUser?: string): Promise<ImportResult<ExportJob>> {
  return call(() => client(devUser).GET("/api/v1/exports/full", { params: { query: { format: "xlsx" } } }), SEARCH_ERROR_MESSAGES);
}

const JOB_KIND_LABELS: Record<string, string> = {
  results: "Resultados de búsqueda",
  full: "Base completa",
  report: "Reporte",
};

const JOB_STATUS_LABELS: Record<ExportJob["status"], string> = {
  PENDING: "En cola",
  RUNNING: "Preparándose",
  READY: "Lista",
  FAILED: "Falló",
};

export function jobKindLabel(job: Pick<ExportJob, "kind">): string {
  return JOB_KIND_LABELS[job.kind ?? ""] ?? "Exportación";
}

export function jobStatusLabel(job: Pick<ExportJob, "status" | "expires_at">, now: Date = new Date()): string {
  if (job.status === "READY" && isExpired(job, now)) return "Caducada";
  return JOB_STATUS_LABELS[job.status];
}

export function isExpired(job: Pick<ExportJob, "expires_at">, now: Date = new Date()): boolean {
  return job.expires_at ? new Date(job.expires_at).getTime() < now.getTime() : false;
}

export function canDownload(job: Pick<ExportJob, "status" | "expires_at">, now: Date = new Date()): boolean {
  return job.status === "READY" && !isExpired(job, now);
}

/** Hay trabajos en cola o en preparación: la lista se vuelve a consultar. */
export function hasPendingJobs(jobs: Pick<ExportJob, "status">[]): boolean {
  return jobs.some((job) => job.status === "PENDING" || job.status === "RUNNING");
}
