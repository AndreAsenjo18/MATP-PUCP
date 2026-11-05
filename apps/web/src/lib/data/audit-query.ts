/**
 * Capa de datos de la consulta global de auditoría (tarea 5.2 de
 * `auditoria-y-soft-delete-transversal`; requirement «Consulta agrupada y exportable de la
 * auditoría», RF-040, RF-041). Complementa a `lib/data/audit.ts` (que lee el historial de **una**
 * pieza) con la lectura de todo el sistema:
 *
 * - `GET /audit-logs?group_by=change_set` + filtros: conjuntos de cambios paginados.
 * - `GET /audit-logs?change_set_id=…`: las filas campo a campo de un conjunto (su detalle).
 * - `GET /audit-logs?format=csv[&group_by=change_set]`: la exportación la genera y envía el
 *   servidor en streaming; aquí solo se construye el enlace de descarga con los filtros activos
 *   (el navegador no arma el archivo).
 *
 * Igual que `lib/data/audit.ts`, en modo `mock` (la pantalla pasa las filas de la sesión de
 * demostración en `demoEntries`) todo se calcula en memoria, sin red; en modo `live` se llama a
 * la API. Los valores de campos sensibles llegan en `null` con `values_masked` y nunca se
 * inventan (RF-041).
 */
import { apiErrorMessage, createApiClient } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";

import { CONNECTION_MESSAGE, groupEntriesIntoChangeSets, type AuditChangeSetSummary, type AuditEntryView } from "./audit";
import { apiBaseUrl, getApiMode } from "./mode";
import { dayEndIso, dayStartIso, isCalendarDate, validateDateRange, type DateRangeErrors } from "./trash";

type AuditQuery = NonNullable<paths["/api/v1/audit-logs"]["get"]["parameters"]["query"]>;

/** Conjuntos de cambios por página de la consulta global. */
export const AUDIT_PAGE_SIZE = 20;
/** Filas campo a campo que se cargan cada vez al abrir el detalle de un conjunto. */
export const AUDIT_DETAIL_PAGE_SIZE = 50;

export const AUDIT_FORBIDDEN_MESSAGE = "Su rol no tiene permiso para consultar la auditoría (RF-040).";

function client() {
  return createApiClient({ baseUrl: apiBaseUrl() });
}

// ---------------------------------------------------------------------------------------------
// Tipos de registro, orígenes y acciones que se pueden filtrar
// ---------------------------------------------------------------------------------------------

/** Tipos de registro tal como los escribe la auditoría (nombre de tabla), con su nombre en español. */
export const AUDIT_ENTITY_TYPES: ReadonlyArray<{ value: string; singular: string; plural: string }> = [
  { value: "piece", singular: "pieza", plural: "piezas" },
  { value: "piece_identifier", singular: "identificador de pieza", plural: "identificadores de pieza" },
  { value: "media_asset", singular: "fotografía o documento", plural: "fotografías o documentos" },
  { value: "piece_movement", singular: "movimiento de ubicación", plural: "movimientos de ubicación" },
  { value: "piece_source_record", singular: "dato de origen", plural: "datos de origen" },
  { value: "conservation_assessment", singular: "evaluación de conservación", plural: "evaluaciones de conservación" },
  { value: "collection", singular: "colección", plural: "colecciones" },
  { value: "term", singular: "término de vocabulario", plural: "términos de vocabulario" },
  { value: "vocabulary", singular: "vocabulario", plural: "vocabularios" },
  { value: "location", singular: "ubicación", plural: "ubicaciones" },
  { value: "import_mapping_template", singular: "plantilla de mapeo", plural: "plantillas de mapeo" },
  { value: "import_batch", singular: "carga de importación", plural: "cargas de importación" },
  { value: "duplicate_candidate", singular: "candidato a duplicado", plural: "candidatos a duplicado" },
  { value: "ai_suggestion", singular: "sugerencia de IA", plural: "sugerencias de IA" },
  { value: "app_user", singular: "usuario", plural: "usuarios" },
];

/** Nombres con que algunos fixtures antiguos escriben los mismos tipos. */
const ENTITY_ALIASES: Readonly<Record<string, string>> = { piece_media: "media_asset", vocabulary_term: "term" };

/** Nombre de un tipo de registro en singular o plural; si no se conoce, se muestra tal cual. */
export function auditEntityLabel(entityType: string, count = 1): string {
  const known = AUDIT_ENTITY_TYPES.find((type) => type.value === (ENTITY_ALIASES[entityType] ?? entityType));
  if (!known) return count === 1 ? `registro de tipo ${entityType}` : `registros de tipo ${entityType}`;
  return count === 1 ? known.singular : known.plural;
}

export const AUDIT_ORIGINS = ["MANUAL", "IMPORT", "AI", "SYSTEM"] as const;
export const AUDIT_ACTIONS = ["CREATE", "UPDATE", "SOFT_DELETE", "RESTORE", "CORRECTION", "MERGE", "REVERT"] as const;

// ---------------------------------------------------------------------------------------------
// Filtros (funciones puras)
// ---------------------------------------------------------------------------------------------

/** Filtros aplicados a la consulta; `""` significa «sin filtro». Las fechas son `aaaa-mm-dd`. */
export interface AuditQueryFilters {
  entityType: string;
  origin: string;
  action: string;
  /** Lote de importación o sugerencia de IA que originó el cambio. */
  originRef: string;
  changeSetId: string;
  entityId: string;
  userId: string;
  from: string;
  to: string;
}

export const EMPTY_AUDIT_FILTERS: AuditQueryFilters = {
  entityType: "",
  origin: "",
  action: "",
  originRef: "",
  changeSetId: "",
  entityId: "",
  userId: "",
  from: "",
  to: "",
};

export function hasActiveAuditFilters(filters: AuditQueryFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== "");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export const UUID_INVALID = "Escriba el identificador completo, con sus guiones (por ejemplo 01920000-0000-7000-8000-000000000a00).";

export interface AuditFilterErrors extends DateRangeErrors {
  changeSetId?: string;
  entityId?: string;
}

/** Errores de los filtros; objeto vacío si se pueden aplicar (el servidor rechazaría un UUID mal escrito). */
export function validateAuditFilters(filters: AuditQueryFilters): AuditFilterErrors {
  const errors: AuditFilterErrors = validateDateRange(filters.from, filters.to);
  if (filters.changeSetId.trim() && !isUuid(filters.changeSetId)) errors.changeSetId = UUID_INVALID;
  if (filters.entityId.trim() && !isUuid(filters.entityId)) errors.entityId = UUID_INVALID;
  return errors;
}

/** Parámetros de `GET /audit-logs` para unos filtros (sin paginación ni agrupación). */
export function auditQuery(filters: AuditQueryFilters): AuditQuery {
  const text = (value: string) => value.trim() || undefined;
  return {
    entity_type: text(filters.entityType),
    origin: (text(filters.origin) as AuditQuery["origin"]) ?? undefined,
    action: (text(filters.action) as AuditQuery["action"]) ?? undefined,
    origin_ref: text(filters.originRef),
    change_set_id: text(filters.changeSetId),
    entity_id: text(filters.entityId),
    user_id: text(filters.userId),
    occurred_from: filters.from ? dayStartIso(filters.from) : undefined,
    occurred_to: filters.to ? dayEndIso(filters.to) : undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// Exportación a CSV (la genera el servidor)
// ---------------------------------------------------------------------------------------------

/** Qué se descarga: un renglón por conjunto de cambios, o una fila por campo cambiado. */
export type AuditCsvView = "change_sets" | "entries";

/** La descarga solo existe con servidor: en la demostración no hay quien genere el archivo. */
export function csvDownloadAvailable(): boolean {
  return getApiMode() === "live";
}

/**
 * Enlace de descarga del CSV con los filtros activos. Lo atiende la API (cabeceras en inglés y BOM
 * UTF-8 para que Excel muestre bien las tildes); el navegador solo sigue el enlace. Los valores de
 * campos sensibles salen enmascarados según el rol, igual que en pantalla (RF-041).
 */
export function auditCsvUrl(filters: AuditQueryFilters, view: AuditCsvView): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(auditQuery(filters))) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  if (view === "change_sets") params.set("group_by", "change_set");
  params.set("format", "csv");
  return `${apiBaseUrl().replace(/\/+$/, "")}/api/v1/audit-logs?${params.toString()}`;
}

// ---------------------------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------------------------

export interface AuditPageRequest {
  filters: AuditQueryFilters;
  page: number;
  pageSize: number;
  /** Filas de la sesión de demostración: si se pasan, no se consulta la red (modo `mock`). */
  demoEntries?: readonly AuditEntryView[];
}

export type AuditChangeSetsResult =
  | { status: "ok"; changeSets: AuditChangeSetSummary[]; total: number }
  | { status: "forbidden"; message: string }
  | { status: "unavailable"; message: string };

export type AuditEntriesResult =
  | { status: "ok"; entries: AuditEntryView[]; total: number }
  | { status: "forbidden"; message: string }
  | { status: "unavailable"; message: string };

function failure(error: unknown, response: Response): { status: "forbidden" | "unavailable"; message: string } {
  if (response.status === 403) return { status: "forbidden", message: AUDIT_FORBIDDEN_MESSAGE };
  return { status: "unavailable", message: apiErrorMessage(error) };
}

/**
 * Filas que cumplen los filtros, igual que lo hace el servidor. En la demostración `origin_ref`
 * busca por parte del texto (los lotes sintéticos tienen nombre); en la API es el identificador.
 */
export function filterAuditEntries(entries: readonly AuditEntryView[], filters: AuditQueryFilters): AuditEntryView[] {
  const from = filters.from && isCalendarDate(filters.from) ? Date.parse(dayStartIso(filters.from)) : null;
  const to = filters.to && isCalendarDate(filters.to) ? Date.parse(dayEndIso(filters.to)) : null;
  const originRef = filters.originRef.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.entityType && entry.entity_type !== filters.entityType) return false;
    if (filters.origin && entry.origin !== filters.origin) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.changeSetId.trim() && entry.change_set_id !== filters.changeSetId.trim()) return false;
    if (filters.entityId.trim() && entry.entity_id !== filters.entityId.trim()) return false;
    if (filters.userId && entry.user_id !== filters.userId) return false;
    if (originRef && !(entry.origin_ref ?? "").toLowerCase().includes(originRef)) return false;
    const occurredAt = Date.parse(entry.occurred_at);
    if (from !== null && occurredAt < from) return false;
    if (to !== null && occurredAt > to) return false;
    return true;
  });
}

/**
 * Conjuntos de cambios que tienen al menos una fila que cumple los filtros, resumidos completos
 * (un conjunto es una operación entera, aunque el filtro solo alcance parte de ella).
 */
export function filterChangeSets(entries: readonly AuditEntryView[], filters: AuditQueryFilters): AuditChangeSetSummary[] {
  const matching = new Set(filterAuditEntries(entries, filters).map((entry) => entry.change_set_id));
  return groupEntriesIntoChangeSets(entries).filter((summary) => matching.has(summary.change_set_id));
}

/** Página de conjuntos de cambios, del más reciente al más antiguo. */
export async function fetchAuditChangeSets({ filters, page, pageSize, demoEntries }: AuditPageRequest): Promise<AuditChangeSetsResult> {
  if (demoEntries) {
    const all = filterChangeSets(demoEntries, filters);
    const start = (page - 1) * pageSize;
    return { status: "ok", changeSets: all.slice(start, start + pageSize), total: all.length };
  }
  try {
    const { data, error, response } = await client().GET("/api/v1/audit-logs", {
      params: { query: { ...auditQuery(filters), group_by: "change_set", page, page_size: pageSize } },
    });
    if (error) return failure(error, response);
    return { status: "ok", changeSets: data.change_sets ?? [], total: data.total };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** Página de filas campo a campo, de la más reciente a la más antigua (el mismo orden que la API). */
export async function fetchAuditEntries({ filters, page, pageSize, demoEntries }: AuditPageRequest): Promise<AuditEntriesResult> {
  if (demoEntries) {
    const all = filterAuditEntries(demoEntries, filters).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    const start = (page - 1) * pageSize;
    return { status: "ok", entries: all.slice(start, start + pageSize), total: all.length };
  }
  try {
    const { data, error, response } = await client().GET("/api/v1/audit-logs", {
      params: { query: { ...auditQuery(filters), page, page_size: pageSize } },
    });
    if (error) return failure(error, response);
    return { status: "ok", entries: data.items ?? [], total: data.total };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}
