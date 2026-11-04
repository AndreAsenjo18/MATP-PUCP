/**
 * Sugerencias de IA en modo `live` (change `ia-extraccion-texto-libre`, tareas 3.1 y 3.2; RIA-01,
 * RN-009). `POST /ai/suggest-cataloging` pide una propuesta al proveedor configurado
 * (`AI_PROVIDER`); queda PENDIENTE hasta que alguien con `ai.review` la aprueba (total, parcial o
 * editada) o la rechaza con motivo — ninguna sugerencia escribe el catálogo por sí sola.
 *
 * En modo `mock` estas operaciones responden `unavailable` (vía `call`, igual que el asistente de
 * importación): la pantalla de ejemplos de demostración en esta misma ruta (change
 * `rediseno-ux-sugerencias-ia`) sigue usando `mock-store` y no se toca aquí.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";

import { call, IMPORT_ERROR_MESSAGES, type ImportResult } from "./imports";
import { apiBaseUrl } from "./mode";

export type AiSuggestion = ApiSchemas["AiSuggestionOut"];
export type AiSuggestionStatus = ApiSchemas["SuggestionStatus"];

/** Forma real de cada elemento de `output_data.fields` / `approved_data.fields` (services/ai). */
export interface ProposedField {
  field: string;
  value: unknown;
  source_fragment: string | null;
  confidence: number;
}

/** Campos de origen que se pueden enviar a la IA (`ai_suggestions/privacy.py`). */
export const AI_SOURCE_FIELDS: { value: string; label: string }[] = [
  { value: "notes", label: "Notas" },
  { value: "description", label: "Descripción" },
];

export const FIELD_LABELS: Record<string, string> = {
  dimensions: "Medida",
  conservation_status: "Estado de conservación",
  review_marks: "Marca de revisión",
  exhibitions: "Exposición (se guarda, pero no se aplica todavía)",
};

export const AI_ERROR_MESSAGES: Record<string, string> = {
  ...IMPORT_ERROR_MESSAGES,
  source_field_not_allowed: "Ese campo no se puede enviar a la IA.",
  source_field_empty: "La ficha no tiene texto en ese campo para analizar.",
  empty_approval: "Apruebe al menos un dato propuesto.",
  suggestion_already_reviewed: "Esta sugerencia ya fue revisada por otra persona.",
  suggestion_not_approved: "La sugerencia no está aprobada.",
  missing_reviewer: "Falta la persona que revisó la sugerencia.",
  ai_unavailable: "El servicio de IA no está disponible en este momento. El catálogo no cambió.",
  invalid_conservation_term: "Ese estado de conservación no es un término activo: elija uno vigente.",
  invalid_conservation_value: "El estado de conservación propuesto tiene un formato no válido.",
  invalid_dimension_value: "La medida propuesta tiene un formato no válido.",
  unknown_suggestion_field: "Hay un dato propuesto con un tipo que esta pantalla no reconoce.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Los `ProposedField` de una sugerencia (`output_data` o `approved_data`); vacío si no hay. */
export function fieldsOf(data: Record<string, unknown> | null | undefined): ProposedField[] {
  const raw = data?.fields;
  return Array.isArray(raw) ? (raw as ProposedField[]) : [];
}

/** El valor propuesto en una línea, en español llano (RNF-010). */
export function fieldValueText(item: Pick<ProposedField, "field" | "value">): string {
  const { field, value } = item;
  if (field === "dimensions" && isRecord(value)) {
    return `${value.dimension}: ${value.value} ${value.unit ?? "cm"}`;
  }
  if (field === "conservation_status") {
    return String(value);
  }
  if (field === "review_marks" && isRecord(value)) {
    return value.year ? `Revisado en ${value.year}` : "Revisado (sin año en el texto)";
  }
  if (field === "exhibitions" && isRecord(value)) {
    return `${value.description ?? "Exposición"}${value.year ? ` (${value.year})` : ""}`;
  }
  return JSON.stringify(value);
}

/** Pide una sugerencia a la IA sobre un campo de texto libre de la pieza (RIA-01). */
export async function suggestCataloging(
  pieceId: string,
  field: string,
  devUser?: string,
): Promise<ImportResult<AiSuggestion>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/ai/suggest-cataloging", {
        body: { piece_id: pieceId, field },
      }) as Promise<{ data?: AiSuggestion; error?: unknown }>,
    AI_ERROR_MESSAGES,
  );
}

/** Aprueba (total o parcialmente, con o sin ediciones) los ítems indicados. */
export async function approveAiSuggestion(
  suggestionId: string,
  approvedFields: ProposedField[],
  devUser?: string,
): Promise<ImportResult<AiSuggestion>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/ai/suggestions/{suggestion_id}/approve", {
        params: { path: { suggestion_id: suggestionId } },
        body: { approved_data: { fields: approvedFields }, acknowledge_current_values: false },
      }) as Promise<{ data?: AiSuggestion; error?: unknown }>,
    AI_ERROR_MESSAGES,
  );
}

/** Rechaza la sugerencia; el motivo es obligatorio (RN-009). */
export async function rejectAiSuggestion(
  suggestionId: string,
  reason: string,
  devUser?: string,
): Promise<ImportResult<AiSuggestion>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/ai/suggestions/{suggestion_id}/reject", {
        params: { path: { suggestion_id: suggestionId } },
        body: { reason },
      }) as Promise<{ data?: AiSuggestion; error?: unknown }>,
    AI_ERROR_MESSAGES,
  );
}

/**
 * Sugerencias pendientes de revisión, de la más reciente a la más antigua; con `pieceId`, solo las
 * de esa pieza. Una vez aprobada o rechazada, una sugerencia deja de aparecer aquí — su resultado
 * ya se ve en la propia ficha (medidas, conservación, notas).
 */
export async function listPendingAiSuggestions(
  devUser?: string,
  pieceId?: string,
): Promise<ImportResult<AiSuggestion[]>> {
  const result = await call(
    () =>
      client(devUser).GET("/api/v1/ai/suggestions", {
        params: { query: { status: "PENDING", page_size: 50, ...(pieceId ? { piece_id: pieceId } : {}) } },
      }) as Promise<{ data?: { items: AiSuggestion[] }; error?: unknown }>,
    AI_ERROR_MESSAGES,
  );
  return result.status === "ok" ? { status: "ok", value: result.value.items } : result;
}
