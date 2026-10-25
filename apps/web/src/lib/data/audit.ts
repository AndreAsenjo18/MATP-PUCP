/**
 * Capa de datos de la auditoría consciente del modo (igual que `lib/data/pieces.ts`): en modo
 * `mock` agrupa las filas sintéticas de `lib/fixtures` sin tocar la red; en modo `live` llama a
 * las operaciones del change `auditoria-y-soft-delete-transversal`:
 *
 * - `GET /audit-logs?group_by=change_set` (conjuntos de cambios) y la misma consulta sin agrupar
 *   (filas campo a campo de la pieza, con `values_masked` cuando el rol no puede ver los valores).
 * - `POST /audit/change-sets/{id}/revert-preview` (plan con valores a restaurar, registros a
 *   eliminar o restaurar, conflictos y `preview_token`).
 * - `POST /audit/change-sets/{id}/revert` (aplica la reversión ligada a esa vista previa).
 *
 * Los códigos de error estables del contrato (`revert_plan_changed`, `already_reverted`,
 * `revert_has_conflicts`) se traducen aquí a estados con un mensaje en español llano (RNF-010);
 * la pantalla no interpreta códigos HTTP.
 *
 * En modo `mock` la reversión se simula (no hay servidor que la aplique): la vista previa se
 * construye a partir de las filas de auditoría de la sesión de demostración y la confirmación
 * devuelve `simulated: true` sin modificar nada.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";
import { auditForPiece } from "@/lib/fixtures";

import { apiBaseUrl, getApiMode } from "./mode";

type AuditEntryOut = ApiSchemas["AuditEntryOut"];
export type AuditEntryView = ApiSchemas["AuditEntryView"];
export type AuditChangeSetSummary = ApiSchemas["AuditChangeSetSummary"];
export type RevertPreviewOut = ApiSchemas["RevertPreviewOut"];
export type RevertChangeSetOut = ApiSchemas["RevertChangeSetOut"];
export type RevertConflictOut = ApiSchemas["RevertConflictOut"];
export type RevertItemOut = ApiSchemas["RevertItemOut"];

/** Códigos de error estables de la reversión (design D1 del change). */
export const REVERT_PLAN_CHANGED = "revert_plan_changed";
export const ALREADY_REVERTED = "already_reverted";
export const REVERT_HAS_CONFLICTS = "revert_has_conflicts";

export const PLAN_CHANGED_MESSAGE =
  "Alguien editó estos datos mientras usted revisaba la vista previa, así que el plan ya no es el mismo. Vuelva a calcular la reversión para ver qué cambiaría ahora.";
export const CONFLICTS_NOT_CONFIRMED_MESSAGE =
  "La reversión tiene cambios posteriores en conflicto: marque la casilla de confirmación para continuar.";
export const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";
/** Hasta cuántos conjuntos y filas se piden por página en la pestaña de la ficha. */
export const CHANGE_SETS_PAGE_SIZE = 50;
export const ENTRIES_PAGE_SIZE = 100;

function client() {
  return createApiClient({ baseUrl: apiBaseUrl() });
}

// ---------------------------------------------------------------------------------------------
// Agrupación (función pura: la usa el modo mock y la prueba)
// ---------------------------------------------------------------------------------------------

/** Completa una fila del store de demostración con la marca de enmascarado (en mock nada se oculta). */
export function toEntryView(entry: AuditEntryOut | AuditEntryView): AuditEntryView {
  return { values_masked: false, ...entry };
}

function pushUnique<T>(values: T[], value: T): void {
  if (!values.includes(value)) values.push(value);
}

/**
 * Agrupa filas campo a campo en conjuntos de cambios, con la misma forma que
 * `GET /audit-logs?group_by=change_set`. Un conjunto se considera revertido cuando otra entrada
 * de tipo `REVERT` lo referencia en `origin_ref`.
 */
export function groupEntriesIntoChangeSets(entries: readonly AuditEntryView[]): AuditChangeSetSummary[] {
  const revertedBy = new Map<string, string>();
  for (const entry of entries) {
    if (entry.action === "REVERT" && entry.origin_ref) revertedBy.set(entry.origin_ref, entry.change_set_id);
  }

  const groups = new Map<string, { summary: AuditChangeSetSummary; entityIds: Map<string, Set<string>> }>();
  for (const entry of entries) {
    let group = groups.get(entry.change_set_id);
    if (!group) {
      group = {
        summary: {
          change_set_id: entry.change_set_id,
          actions: [],
          actor_label: entry.actor_label,
          user_id: entry.user_id,
          occurred_at: entry.occurred_at,
          last_occurred_at: entry.occurred_at,
          origin: entry.origin,
          origin_ref: entry.origin_ref,
          reason: entry.reason,
          entity_counts: {},
          entity_count: 0,
          field_count: 0,
          reverted: revertedBy.has(entry.change_set_id),
          reverted_by_change_set_id: revertedBy.get(entry.change_set_id) ?? null,
        },
        entityIds: new Map(),
      };
      groups.set(entry.change_set_id, group);
    }
    const { summary, entityIds } = group;
    pushUnique(summary.actions, entry.action);
    summary.actor_label ??= entry.actor_label;
    summary.user_id ??= entry.user_id;
    summary.reason ??= entry.reason;
    summary.origin_ref ??= entry.origin_ref;
    if (entry.occurred_at < summary.occurred_at) summary.occurred_at = entry.occurred_at;
    if (entry.occurred_at > summary.last_occurred_at) summary.last_occurred_at = entry.occurred_at;
    if (entry.field) summary.field_count += 1;
    const ofType = entityIds.get(entry.entity_type) ?? new Set<string>();
    ofType.add(entry.entity_id);
    entityIds.set(entry.entity_type, ofType);
  }

  return [...groups.values()]
    .map(({ summary, entityIds }) => {
      for (const [entityType, idsOfType] of entityIds) summary.entity_counts[entityType] = idsOfType.size;
      summary.entity_count = Object.values(summary.entity_counts).reduce((total, count) => total + count, 0);
      return summary;
    })
    .sort((a, b) => b.last_occurred_at.localeCompare(a.last_occurred_at));
}

/** Filas de cada conjunto de cambios, de la más antigua a la más reciente. */
export function entriesByChangeSet(entries: readonly AuditEntryView[]): Record<string, AuditEntryView[]> {
  const grouped: Record<string, AuditEntryView[]> = {};
  for (const entry of [...entries].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    (grouped[entry.change_set_id] ??= []).push(entry);
  }
  return grouped;
}

// ---------------------------------------------------------------------------------------------
// Lectura del historial de una pieza
// ---------------------------------------------------------------------------------------------

export interface AuditTrail {
  changeSets: AuditChangeSetSummary[];
  entries: AuditEntryView[];
  /** Conjuntos que existen en el servidor; mayor que `changeSets.length` si hay más páginas. */
  total: number;
}

export type AuditTrailResult =
  | { status: "ok"; trail: AuditTrail }
  | { status: "forbidden"; message: string }
  | { status: "unavailable"; message: string };

/**
 * Historial de una pieza agrupado por conjunto de cambios, con sus filas campo a campo.
 *
 * [SUPUESTO] Se filtra por `entity_id` de la pieza: el conjunto se resume completo (p. ej. «54
 * piezas» de una carga), pero las filas de detalle son las de esta pieza. Los cambios sobre sus
 * identificadores o fotos se ven en la consulta global de auditoría (Administración), donde se
 * puede filtrar por tipo de entidad.
 */
export async function fetchPieceAuditTrail(pieceId: string): Promise<AuditTrailResult> {
  if (getApiMode() === "mock") {
    const entries = auditForPiece(pieceId).map(toEntryView);
    const changeSets = groupEntriesIntoChangeSets(entries);
    return { status: "ok", trail: { changeSets, entries, total: changeSets.length } };
  }
  const api = client();
  const grouped = await api.GET("/api/v1/audit-logs", {
    params: { query: { entity_id: pieceId, group_by: "change_set", page_size: CHANGE_SETS_PAGE_SIZE } },
  });
  if (grouped.error) return trailFailure(grouped.error, grouped.response);
  const rows = await api.GET("/api/v1/audit-logs", {
    params: { query: { entity_id: pieceId, page_size: ENTRIES_PAGE_SIZE } },
  });
  if (rows.error) return trailFailure(rows.error, rows.response);
  return {
    status: "ok",
    trail: {
      changeSets: grouped.data.change_sets ?? [],
      entries: rows.data.items ?? [],
      total: grouped.data.total,
    },
  };
}

function trailFailure(error: unknown, response: Response): AuditTrailResult {
  if (response.status === 403) return { status: "forbidden", message: apiErrorMessage(error) };
  return { status: "unavailable", message: apiErrorMessage(error) };
}

// ---------------------------------------------------------------------------------------------
// Reversión
// ---------------------------------------------------------------------------------------------

export type RevertPreviewResult =
  | { status: "ok"; preview: RevertPreviewOut }
  | { status: "already_reverted"; message: string; revertedByChangeSetId: string | null }
  | { status: "forbidden"; message: string }
  | { status: "rejected"; code: string; message: string }
  | { status: "unavailable"; message: string };

export type RevertConfirmResult =
  | { status: "ok"; result: RevertChangeSetOut; simulated: boolean }
  | { status: "plan_changed"; message: string }
  | { status: "needs_conflict_confirmation"; message: string }
  | { status: "already_reverted"; message: string; revertedByChangeSetId: string | null }
  | { status: "forbidden"; message: string }
  | { status: "rejected"; code: string; message: string }
  | { status: "unavailable"; message: string };

export interface RevertConfirmInput {
  previewToken: string;
  reason: string;
  confirmConflicts: boolean;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "error";
}

function errorDetail(error: unknown, key: string): string | null {
  const details = (error as { details?: Record<string, unknown> } | null)?.details;
  const value = details?.[key];
  return typeof value === "string" ? value : null;
}

/** Vista previa del plan de reversión; en modo mock se construye con las filas de la pieza. */
export async function previewRevert(changeSetId: string, mockEntries?: readonly AuditEntryView[]): Promise<RevertPreviewResult> {
  if (getApiMode() === "mock") {
    return { status: "ok", preview: buildMockRevertPreview(changeSetId, mockEntries ?? []) };
  }
  const { data, error, response } = await client().POST("/api/v1/audit/change-sets/{change_set_id}/revert-preview", {
    params: { path: { change_set_id: changeSetId } },
  });
  if (!error) return { status: "ok", preview: data };
  if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
  const code = errorCode(error);
  if (code === ALREADY_REVERTED) {
    return {
      status: "already_reverted",
      message: apiErrorMessage(error),
      revertedByChangeSetId: errorDetail(error, "reverted_by_change_set_id"),
    };
  }
  if (response.status === 403) return { status: "forbidden", message: apiErrorMessage(error) };
  if (response.status >= 500) return { status: "unavailable", message: apiErrorMessage(error) };
  return { status: "rejected", code, message: apiErrorMessage(error) };
}

/** Aplica la reversión ligada a la vista previa (`preview_token` obligatorio). */
export async function confirmRevert(changeSetId: string, input: RevertConfirmInput): Promise<RevertConfirmResult> {
  if (getApiMode() === "mock") {
    return { status: "ok", result: mockRevertResult(changeSetId), simulated: true };
  }
  const { data, error, response } = await client().POST("/api/v1/audit/change-sets/{change_set_id}/revert", {
    params: { path: { change_set_id: changeSetId } },
    body: { preview_token: input.previewToken, reason: input.reason, confirm_conflicts: input.confirmConflicts },
  });
  if (!error) return { status: "ok", result: data, simulated: false };
  if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
  const code = errorCode(error);
  if (code === REVERT_PLAN_CHANGED) return { status: "plan_changed", message: PLAN_CHANGED_MESSAGE };
  if (code === REVERT_HAS_CONFLICTS) return { status: "needs_conflict_confirmation", message: CONFLICTS_NOT_CONFIRMED_MESSAGE };
  if (code === ALREADY_REVERTED) {
    return {
      status: "already_reverted",
      message: apiErrorMessage(error),
      revertedByChangeSetId: errorDetail(error, "reverted_by_change_set_id"),
    };
  }
  if (response.status === 403) return { status: "forbidden", message: apiErrorMessage(error) };
  if (response.status >= 500) return { status: "unavailable", message: apiErrorMessage(error) };
  return { status: "rejected", code, message: apiErrorMessage(error) };
}

// ---------------------------------------------------------------------------------------------
// Simulación del plan en modo demostración
// ---------------------------------------------------------------------------------------------

/** Tablas de solo inserción: la reversión no las toca, solo informa (design D1). */
const APPEND_ONLY_TYPES = new Set(["piece_movement", "piece_source_record", "conservation_assessment"]);

export const MOVEMENT_NOTE =
  "Los movimientos de ubicación registrados en este conjunto no se modifican: corríjalos registrando un movimiento correctivo desde la pestaña «Ubicación e historial».";

function mockItem(entry: AuditEntryView): RevertItemOut {
  const base = { entity_type: entry.entity_type, entity_id: entry.entity_id, field: entry.field, source_action: entry.action };
  if (APPEND_ONLY_TYPES.has(entry.entity_type)) {
    return { ...base, kind: "APPEND_ONLY_NOTE", applicable: false, description: MOVEMENT_NOTE };
  }
  if (entry.action === "CREATE") {
    return { ...base, kind: "SOFT_DELETE_ENTITY", applicable: true, description: "Eliminar lógicamente el registro creado por este cambio (queda en el historial)." };
  }
  if (entry.action === "SOFT_DELETE") {
    return { ...base, kind: "RESTORE_ENTITY", applicable: true, description: "Restaurar el registro que este cambio había eliminado." };
  }
  if (entry.action === "CORRECTION") {
    return {
      ...base,
      kind: "CORRECT_INVENTORY_CODE",
      applicable: true,
      current_value: entry.new_value,
      target_value: entry.old_value,
      description: "Deshacer la corrección con un procedimiento auditado de código I (solo Administrador).",
    };
  }
  return {
    ...base,
    kind: "RESTORE_VALUE",
    applicable: true,
    current_value: entry.new_value,
    target_value: entry.old_value,
    description: `Restaurar el campo «${entry.field ?? "sin nombre"}» a su valor anterior.`,
  };
}

/**
 * Plan de reversión simulado para la demostración: mismas formas que `RevertPreviewOut`, sin red
 * y sin conflictos (en la demostración nadie edita en paralelo).
 */
export function buildMockRevertPreview(changeSetId: string, entries: readonly AuditEntryView[]): RevertPreviewOut {
  const own = entries.filter((entry) => entry.change_set_id === changeSetId);
  const items = own.map(mockItem);
  const touchesInventoryCode = own.some((entry) => entry.field === "inventory_code" || entry.entity_type === "piece_identifier");
  const origin = own[0]?.origin ?? "MANUAL";
  return {
    change_set: {
      change_set_id: changeSetId,
      actions: [...new Set(own.map((entry) => entry.action))],
      actor_label: own[0]?.actor_label ?? null,
      user_id: own[0]?.user_id ?? null,
      occurred_at: own[0]?.occurred_at ?? new Date().toISOString(),
      origin,
      origin_ref: own[0]?.origin_ref ?? null,
      reason: own.find((entry) => entry.reason)?.reason ?? null,
      entities: [...new Set(own.map((entry) => `${entry.entity_type}|${entry.entity_id}`))].map((key) => {
        const [entity_type, entity_id] = key.split("|");
        return { entity_type, entity_id, field_count: own.filter((e) => e.entity_id === entity_id && e.field).length };
      }),
      entity_count: new Set(own.map((entry) => entry.entity_id)).size,
      field_count: own.filter((entry) => entry.field).length,
      reverted: false,
      reverted_by_change_set_id: null,
    },
    items,
    conflicts: [],
    notes: items.some((item) => item.kind === "APPEND_ONLY_NOTE") ? [MOVEMENT_NOTE] : [],
    applicable_count: items.filter((item) => item.applicable).length,
    preview_token: `demostracion-${changeSetId}`,
    required_permissions: origin === "IMPORT" ? ["imports.revert"] : ["pieces.update"],
    requires_admin: touchesInventoryCode,
    touches_inventory_code: touchesInventoryCode,
  };
}

function mockRevertResult(changeSetId: string): RevertChangeSetOut {
  return {
    reverted_change_set_id: changeSetId,
    new_change_set_id: `demostracion-reversion-${changeSetId}`,
    reverted_fields: 0,
    restored_entities: 0,
    deleted_entities: 0,
    conflicts: [],
    notes: [],
  };
}
