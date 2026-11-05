/**
 * Capa de datos de la papelera consciente del modo (igual que `lib/data/pieces.ts`): en modo
 * `mock` lee un conjunto sintético de registros eliminados sin tocar la red; en modo `live` llama
 * a las operaciones del change `auditoria-y-soft-delete-transversal`:
 *
 * - `GET /trash` (`listTrashEntries`): filtros por tipo, quién eliminó y rango de fechas, paginado.
 * - `POST /trash/{entity_type}/{entity_id}/restore` (`restoreTrashEntry`): restaura solo si las
 *   dependencias están activas; si no, 409 `restore_dependency` con la lista `blockers`.
 *
 * Los códigos y estados HTTP se traducen aquí a resultados con un mensaje en español llano
 * (RNF-010): la pantalla no interpreta códigos HTTP. La papelera nunca borra nada (RN-005):
 * restaurar solo quita la marca de eliminación y deja constancia en la auditoría.
 *
 * En modo `mock` la restauración se simula en memoria durante la sesión (el registro sale de la
 * lista y las dependencias se comprueban igual que en el servidor), sin modificar ningún dato real.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";
import { ids, USERS } from "@/lib/fixtures";

import { CONNECTION_MESSAGE } from "./audit";
import { apiBaseUrl, getApiMode } from "./mode";

export type TrashEntry = ApiSchemas["TrashEntryOut"];
export type TrashRestoreResult = ApiSchemas["TrashRestoreResult"];
type TrashQuery = NonNullable<paths["/api/v1/trash"]["get"]["parameters"]["query"]>;

/** Registros por página de la papelera. */
export const TRASH_PAGE_SIZE = 20;

/** Códigos de error estables de la restauración (design D2 del change). */
export const RESTORE_DEPENDENCY = "restore_dependency";
export const NOT_DELETED = "not_deleted";

export const TRASH_FORBIDDEN_MESSAGE = "Su rol no tiene permiso para abrir la papelera.";
export const RESTORE_FORBIDDEN_MESSAGE = "Solo un Administrador puede restaurar registros eliminados.";
export const NOT_DELETED_MESSAGE = "Este registro ya no está en la papelera: es probable que otra persona lo haya restaurado. Actualice la lista.";
export const NOT_FOUND_MESSAGE = "Este registro ya no existe. Actualice la lista.";

function client() {
  return createApiClient({ baseUrl: apiBaseUrl() });
}

// ---------------------------------------------------------------------------------------------
// Tipos de registro que se pueden restaurar
// ---------------------------------------------------------------------------------------------

/** Tipos que la API admite en la papelera, con su nombre en español (el mismo que envía `type_label`). */
export const TRASH_ENTITY_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "piece", label: "Pieza" },
  { value: "piece_identifier", label: "Identificador de pieza" },
  { value: "media_asset", label: "Fotografía o documento" },
  { value: "collection", label: "Colección" },
  { value: "term", label: "Término de vocabulario" },
  { value: "vocabulary", label: "Vocabulario" },
  { value: "location", label: "Ubicación" },
  { value: "import_mapping_template", label: "Plantilla de mapeo" },
];

/** Nombre en español de un tipo; si la API añade uno nuevo, se muestra tal cual. */
export function trashTypeLabel(entityType: string): string {
  return TRASH_ENTITY_TYPES.find((type) => type.value === entityType)?.label ?? entityType;
}

// ---------------------------------------------------------------------------------------------
// Filtros (funciones puras)
// ---------------------------------------------------------------------------------------------

/** Filtros aplicados a la papelera; `""` significa «sin filtro». Las fechas son `aaaa-mm-dd`. */
export interface TrashFilters {
  entityType: string;
  deletedBy: string;
  from: string;
  to: string;
}

export const EMPTY_TRASH_FILTERS: TrashFilters = { entityType: "", deletedBy: "", from: "", to: "" };

export function hasActiveTrashFilters(filters: TrashFilters): boolean {
  return Boolean(filters.entityType || filters.deletedBy || filters.from || filters.to);
}

/**
 * [SUPUESTO] El museo trabaja en hora de Lima, que es UTC-5 todo el año (sin horario de verano):
 * «Desde» abarca desde las 00:00 y «Hasta» hasta las 23:59 de ese día, también en hora de Lima,
 * sin depender de la zona horaria del navegador.
 */
const LIMA_OFFSET = "-05:00";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00${LIMA_OFFSET}`));
}

/** Inicio del día (hora de Lima) en el formato que espera la API. */
export function dayStartIso(date: string): string {
  return `${date}T00:00:00${LIMA_OFFSET}`;
}

/** Fin del día (hora de Lima) en el formato que espera la API. */
export function dayEndIso(date: string): string {
  return `${date}T23:59:59.999${LIMA_OFFSET}`;
}

export const DATE_RANGE_INVERTED = "La fecha «Hasta» no puede ser anterior a «Desde».";
export const DATE_INVALID = "Escriba una fecha válida.";

export interface DateRangeErrors {
  from?: string;
  to?: string;
}

/** Errores del rango de fechas de un filtro; objeto vacío si se puede aplicar. */
export function validateDateRange(from: string, to: string): DateRangeErrors {
  const errors: DateRangeErrors = {};
  if (from && !isCalendarDate(from)) errors.from = DATE_INVALID;
  if (to && !isCalendarDate(to)) errors.to = DATE_INVALID;
  if (!errors.from && !errors.to && from && to && from > to) errors.to = DATE_RANGE_INVERTED;
  return errors;
}

/** Parámetros de `GET /trash` para unos filtros y una página. */
export function trashQuery(filters: TrashFilters, page: number, pageSize: number): TrashQuery {
  return {
    entity_type: filters.entityType || undefined,
    deleted_by: filters.deletedBy || undefined,
    from: filters.from ? dayStartIso(filters.from) : undefined,
    to: filters.to ? dayEndIso(filters.to) : undefined,
    page,
    page_size: pageSize,
  };
}

// ---------------------------------------------------------------------------------------------
// Personas que aparecen en los filtros «quién»
// ---------------------------------------------------------------------------------------------

export interface Person {
  id: string;
  name: string;
}

/**
 * Suma a la lista conocida las personas de unas filas, sin repetir. [SUPUESTO] En modo `live` la
 * API de usuarios (`GET /users`) todavía no está disponible, así que las opciones de «quién» son
 * las personas que ya aparecieron en los resultados cargados.
 */
export function mergePeople(known: readonly Person[], candidates: ReadonlyArray<{ id: string | null; name: string | null }>): Person[] {
  const byId = new Map(known.map((person) => [person.id, person]));
  for (const candidate of candidates) {
    if (candidate.id && !byId.has(candidate.id)) byId.set(candidate.id, { id: candidate.id, name: candidate.name ?? "Persona sin nombre" });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Quién eliminó cada fila, para alimentar el filtro. */
export function trashPeople(entries: readonly TrashEntry[]): Array<{ id: string | null; name: string | null }> {
  return entries.map((entry) => ({ id: entry.deleted_by_id, name: entry.deleted_by_name }));
}

// ---------------------------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------------------------

export interface TrashPageData {
  entries: TrashEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export type TrashListResult =
  | { status: "ok"; data: TrashPageData }
  | { status: "forbidden"; message: string }
  | { status: "unavailable"; message: string };

/** Página de la papelera, de lo eliminado más reciente a lo más antiguo. */
export async function fetchTrash(filters: TrashFilters, page = 1, pageSize = TRASH_PAGE_SIZE): Promise<TrashListResult> {
  if (getApiMode() === "mock") return { status: "ok", data: demoTrashPage(filters, page, pageSize) };
  try {
    const { data, error, response } = await client().GET("/api/v1/trash", { params: { query: trashQuery(filters, page, pageSize) } });
    if (!error) return { status: "ok", data: { entries: data.items, total: data.total, page: data.page, pageSize: data.page_size } };
    if (response.status === 403) return { status: "forbidden", message: TRASH_FORBIDDEN_MESSAGE };
    return { status: "unavailable", message: apiErrorMessage(error) };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

// ---------------------------------------------------------------------------------------------
// Restauración
// ---------------------------------------------------------------------------------------------

/** Algo que sigue eliminado (o en conflicto) y hay que resolver antes de restaurar. */
export interface RestoreBlocker {
  entityType: string;
  entityId: string | null;
  label: string;
  /** Frase del servidor en español llano. */
  message: string;
}

export type TrashRestoreOutcome =
  | { status: "ok"; result: TrashRestoreResult; simulated: boolean }
  | { status: "blocked"; message: string; blockers: RestoreBlocker[] }
  | { status: "not_deleted"; message: string }
  | { status: "not_found"; message: string }
  | { status: "forbidden"; message: string }
  | { status: "rejected"; code: string; message: string }
  | { status: "unavailable"; message: string };

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Dependencias que bloquean la restauración, leídas del cuerpo del 409 `restore_dependency`:
 * `details.blockers` (lista completa) o, si falta, los campos `dependency_*` de la primera.
 */
export function parseRestoreBlockers(error: unknown): RestoreBlocker[] {
  const body = (error ?? {}) as { message?: unknown; details?: Record<string, unknown> };
  const details = body.details ?? {};
  const fallbackMessage = asText(body.message) ?? "Hay un registro relacionado que sigue eliminado.";
  const list = Array.isArray(details.blockers) ? (details.blockers as unknown[]) : [];
  const blockers: RestoreBlocker[] = [];
  for (const item of list) {
    const blocker = item as Record<string, unknown>;
    const entityType = asText(blocker.dependency_entity_type);
    if (!entityType) continue;
    const label = asText(blocker.dependency_label) ?? trashTypeLabel(entityType);
    blockers.push({ entityType, entityId: asText(blocker.dependency_entity_id), label, message: asText(blocker.message) ?? fallbackMessage });
  }
  if (blockers.length === 0) {
    const entityType = asText(details.dependency_entity_type);
    if (entityType) {
      blockers.push({
        entityType,
        entityId: asText(details.dependency_entity_id),
        label: asText(details.dependency_label) ?? trashTypeLabel(entityType),
        message: fallbackMessage,
      });
    }
  }
  return blockers;
}

/** Restaura un registro de la papelera; `reason` (opcional) queda en la auditoría. */
export async function restoreFromTrash(
  entry: Pick<TrashEntry, "entity_type" | "entity_id">,
  reason?: string | null,
): Promise<TrashRestoreOutcome> {
  const motive = reason?.trim() || null;
  if (getApiMode() === "mock") return demoRestore(entry);
  try {
    const { data, error, response } = await client().POST("/api/v1/trash/{entity_type}/{entity_id}/restore", {
      params: { path: { entity_type: entry.entity_type, entity_id: entry.entity_id }, query: motive ? { reason: motive } : {} },
    });
    if (!error) return { status: "ok", result: data, simulated: false };
    if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
    const code = (error as { code?: unknown }).code;
    if (code === RESTORE_DEPENDENCY) {
      return { status: "blocked", message: apiErrorMessage(error), blockers: parseRestoreBlockers(error) };
    }
    if (code === NOT_DELETED) return { status: "not_deleted", message: NOT_DELETED_MESSAGE };
    if (response.status === 403) return { status: "forbidden", message: RESTORE_FORBIDDEN_MESSAGE };
    if (response.status === 404) return { status: "not_found", message: NOT_FOUND_MESSAGE };
    if (response.status >= 500) return { status: "unavailable", message: apiErrorMessage(error) };
    return { status: "rejected", code: typeof code === "string" ? code : "error", message: apiErrorMessage(error) };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

// ---------------------------------------------------------------------------------------------
// A dónde lleva «Ir a» una dependencia
// ---------------------------------------------------------------------------------------------

export type BlockerDestination =
  | { kind: "trash"; entityType: string; entityId: string }
  | { kind: "piece"; href: string }
  | { kind: "none" };

/**
 * Dónde se resuelve una dependencia: casi siempre es otro registro de la papelera (se va a él
 * para restaurarlo primero). La excepción es una pieza que bloquea a otra pieza: solo ocurre por
 * el código I que ya usa una pieza **activa** (RN-002), que no está en la papelera y se corrige
 * desde su ficha.
 */
export function blockerDestination(item: Pick<TrashEntry, "entity_type">, blocker: RestoreBlocker): BlockerDestination {
  if (!blocker.entityId) return { kind: "none" };
  if (item.entity_type === "piece" && blocker.entityType === "piece") return { kind: "piece", href: `/piezas/${blocker.entityId}` };
  return { kind: "trash", entityType: blocker.entityType, entityId: blocker.entityId };
}

// ---------------------------------------------------------------------------------------------
// Datos de demostración (modo mock): sintéticos, sin datos reales del museo (RNF-014)
// ---------------------------------------------------------------------------------------------

/** Identificador sintético de plantilla de mapeo (no hay `ids.*` para ellas; mismo formato que `ids`). */
const TEMPLATE_ID = "0f1c0000-0000-7000-0014-000000000901";

const ADMIN_USER = USERS[0];
const MANAGER_USER = USERS[1];

function deletedBy(user: (typeof USERS)[number]) {
  return { deleted_by_id: user.id, deleted_by_name: user.full_name };
}

/** Registros eliminados de la demostración, ya ordenados del más reciente al más antiguo. */
const DEMO_ENTRIES: readonly TrashEntry[] = [
  {
    entity_type: "term",
    entity_id: ids.term(901),
    entity_label: "Totora",
    type_label: "Término de vocabulario",
    deleted_at: "2026-10-14T16:20:00Z",
    ...deletedBy(ADMIN_USER),
    deletion_reason: "Duplicado del término Totora",
  },
  {
    entity_type: "media_asset",
    entity_id: ids.media(901),
    entity_label: "retablo_duplicado_frontal.jpg",
    type_label: "Fotografía o documento",
    deleted_at: "2026-10-12T11:05:00Z",
    ...deletedBy(MANAGER_USER),
    deletion_reason: "Foto de una ficha duplicada",
  },
  {
    entity_type: "piece_identifier",
    entity_id: ids.identifier(901),
    entity_label: "RA 0412 (sintético)",
    type_label: "Identificador de pieza",
    deleted_at: "2026-10-12T11:04:00Z",
    ...deletedBy(MANAGER_USER),
    deletion_reason: "Código copiado por error de otra ficha",
  },
  {
    entity_type: "piece",
    entity_id: ids.piece(901),
    entity_label: "Retablo de cajón (sintético, ficha duplicada)",
    type_label: "Pieza",
    deleted_at: "2026-10-12T11:00:00Z",
    ...deletedBy(MANAGER_USER),
    deletion_reason: "Registro duplicado de la ficha del libro de inventario",
  },
  {
    entity_type: "term",
    entity_id: ids.term(902),
    entity_label: "Rojo carmín",
    type_label: "Término de vocabulario",
    deleted_at: "2026-10-08T09:30:00Z",
    ...deletedBy(ADMIN_USER),
    deletion_reason: "Se eliminó junto con el vocabulario de colores",
  },
  {
    entity_type: "vocabulary",
    entity_id: ids.vocabulary(901),
    entity_label: "Colores (sintético)",
    type_label: "Vocabulario",
    deleted_at: "2026-10-08T09:25:00Z",
    ...deletedBy(ADMIN_USER),
    deletion_reason: "Vocabulario creado por error",
  },
  {
    entity_type: "location",
    entity_id: ids.location(902),
    entity_label: "Rack C / Nivel 1 (sintético)",
    type_label: "Ubicación",
    deleted_at: "2026-09-30T15:10:00Z",
    ...deletedBy(ADMIN_USER),
    deletion_reason: "Mueble retirado del depósito",
  },
  {
    entity_type: "location",
    entity_id: ids.location(901),
    entity_label: "Depósito 3 (sintético)",
    type_label: "Ubicación",
    deleted_at: "2026-09-30T15:00:00Z",
    ...deletedBy(ADMIN_USER),
    deletion_reason: "Espacio dado de baja tras reorganizar el depósito",
  },
  {
    entity_type: "import_mapping_template",
    entity_id: TEMPLATE_ID,
    entity_label: "Plantilla de la sábana 2023 (sintética)",
    type_label: "Plantilla de mapeo",
    deleted_at: "2026-09-22T10:00:00Z",
    ...deletedBy(MANAGER_USER),
    deletion_reason: "Reemplazada por la versión 2024",
  },
  {
    entity_type: "collection",
    entity_id: ids.collection(901),
    entity_label: "Colección de prueba (ficticia)",
    type_label: "Colección",
    deleted_at: "2026-09-18T13:40:00Z",
    ...deletedBy(ADMIN_USER),
    deletion_reason: "Creada por error al probar la carga",
  },
];

/** De qué otro registro depende cada uno (el servidor lo comprueba con sus verificadores, design D2). */
const DEMO_DEPENDENCIES: Readonly<Record<string, ReadonlyArray<{ entityType: string; entityId: string }>>> = {
  [ids.media(901)]: [{ entityType: "piece", entityId: ids.piece(901) }],
  [ids.identifier(901)]: [{ entityType: "piece", entityId: ids.piece(901) }],
  [ids.term(902)]: [{ entityType: "vocabulary", entityId: ids.vocabulary(901) }],
  [ids.location(902)]: [{ entityType: "location", entityId: ids.location(901) }],
};

/** Registros restaurados durante la sesión de demostración (solo en memoria). */
const demoRestored = new Set<string>();

/** Vuelve la papelera de demostración a su estado inicial (la usan las pruebas). */
export function resetDemoTrash(): void {
  demoRestored.clear();
}

function demoRemaining(): TrashEntry[] {
  return DEMO_ENTRIES.filter((entry) => !demoRestored.has(entry.entity_id));
}

/** Filtra una lista de la papelera igual que lo hace el servidor (tipo, quién y rango de fechas). */
export function filterTrashEntries(entries: readonly TrashEntry[], filters: TrashFilters): TrashEntry[] {
  const from = filters.from && isCalendarDate(filters.from) ? Date.parse(dayStartIso(filters.from)) : null;
  const to = filters.to && isCalendarDate(filters.to) ? Date.parse(dayEndIso(filters.to)) : null;
  return entries
    .filter((entry) => {
      if (filters.entityType && entry.entity_type !== filters.entityType) return false;
      if (filters.deletedBy && entry.deleted_by_id !== filters.deletedBy) return false;
      const deletedAt = entry.deleted_at ? Date.parse(entry.deleted_at) : null;
      if (from !== null && (deletedAt === null || deletedAt < from)) return false;
      if (to !== null && (deletedAt === null || deletedAt > to)) return false;
      return true;
    })
    .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
}

function demoTrashPage(filters: TrashFilters, page: number, pageSize: number): TrashPageData {
  const matching = filterTrashEntries(demoRemaining(), filters);
  const start = (page - 1) * pageSize;
  return { entries: matching.slice(start, start + pageSize), total: matching.length, page, pageSize };
}

function demoRestore(entry: Pick<TrashEntry, "entity_type" | "entity_id">): TrashRestoreOutcome {
  const target = DEMO_ENTRIES.find((candidate) => candidate.entity_id === entry.entity_id && candidate.entity_type === entry.entity_type);
  if (!target) return { status: "not_found", message: NOT_FOUND_MESSAGE };
  if (demoRestored.has(target.entity_id)) return { status: "not_deleted", message: NOT_DELETED_MESSAGE };

  const blockers: RestoreBlocker[] = [];
  for (const dependency of DEMO_DEPENDENCIES[target.entity_id] ?? []) {
    if (demoRestored.has(dependency.entityId)) continue;
    const parent = DEMO_ENTRIES.find((candidate) => candidate.entity_id === dependency.entityId);
    if (!parent) continue;
    blockers.push({
      entityType: parent.entity_type,
      entityId: parent.entity_id,
      label: parent.entity_label,
      message: `No se puede restaurar: «${parent.entity_label}» (${parent.type_label}) sigue en la papelera. Restaure ese registro primero.`,
    });
  }
  if (blockers.length > 0) return { status: "blocked", message: blockers[0].message, blockers };

  demoRestored.add(target.entity_id);
  return {
    status: "ok",
    simulated: true,
    result: {
      entity_type: target.entity_type,
      entity_id: target.entity_id,
      entity_label: target.entity_label,
      type_label: target.type_label,
      previous_deletion_reason: target.deletion_reason,
      restored: true,
    },
  };
}
