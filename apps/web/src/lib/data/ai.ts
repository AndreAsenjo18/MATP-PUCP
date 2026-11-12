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

import { call, IMPORT_ERROR_MESSAGES, type ImportResult, type ImportRow } from "./imports";
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
  invalid_dimensions_text: "El texto de Medidas no puede quedar vacío.",
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

/**
 * Por qué no hay nada que aprobar: "campo vacío" ya se rechaza antes de llamar a la IA
 * (`source_field_empty`); esto cubre las otras dos razones, calculadas con reglas en el backend,
 * no por la IA (decisión del equipo, 2026-11-05): el texto no tenía nada reconocible, o lo que
 * detectó ya coincide con el dato vigente de la pieza.
 */
export function explanationOf(data: Record<string, unknown> | null | undefined): string | null {
  const message = data?.message;
  return typeof message === "string" && message.trim() ? message : null;
}

/** Forma de `value` cuando `field === "dimensions"`. */
export interface DimensionValue {
  dimension: string;
  value: number;
  unit: string;
}

export function isDimensionField(
  item: Pick<ProposedField, "field" | "value">,
): item is ProposedField & { value: DimensionValue } {
  return (
    item.field === "dimensions" &&
    isRecord(item.value) &&
    typeof item.value.dimension === "string" &&
    typeof item.value.value === "number"
  );
}

/**
 * Texto de "Medidas" (`dimensions_text`) a partir de las medidas propuestas, en el mismo formato
 * que ya usan los datos existentes ("alto 58 cm x ancho 37 cm") — punto de partida editable para
 * quien revisa, si decide también actualizar ese campo manual (decisión del equipo, 2026-11-04).
 */
export function dimensionsTextFrom(fields: ProposedField[]): string {
  return fields
    .filter(isDimensionField)
    .map((item) => `${item.value.dimension} ${item.value.value} ${item.value.unit || "cm"}`)
    .join(" x ");
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

/**
 * Aprueba (total o parcialmente, con o sin ediciones) los ítems indicados. `dimensionsText`,
 * cuando se manda, reemplaza también el texto libre de "Medidas" (`dimensions_text`) — la IA
 * nunca lo toca por sí sola, es una decisión explícita de quien revisa.
 */
export async function approveAiSuggestion(
  suggestionId: string,
  approvedFields: ProposedField[],
  devUser?: string,
  dimensionsText?: string,
): Promise<ImportResult<AiSuggestion>> {
  const approvedData: Record<string, unknown> = { fields: approvedFields };
  if (dimensionsText) approvedData.dimensions_text = dimensionsText;
  return call(
    () =>
      client(devUser).POST("/api/v1/ai/suggestions/{suggestion_id}/approve", {
        params: { path: { suggestion_id: suggestionId } },
        body: { approved_data: approvedData, acknowledge_current_values: false },
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

export type ColumnMappingSuggestion = ApiSchemas["ColumnMappingSuggestionOut"];

/**
 * Carga masiva con IA (change carga-masiva-con-ia, D2): mapeo de columnas propuesto cuando
 * ninguna plantilla guardada reconoció el archivo. Degrada a `ai_unavailable` sin bloquear el
 * editor de columnas, que sigue usando la heurística local (`suggestMapping`) mientras tanto.
 */
export async function suggestColumnMapping(
  headers: string[],
  devUser?: string,
): Promise<ImportResult<ColumnMappingSuggestion>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/ai/suggest-column-mapping", {
        body: { headers, sample_rows: [] },
      }) as Promise<{ data?: ColumnMappingSuggestion; error?: unknown }>,
    AI_ERROR_MESSAGES,
  );
}

/**
 * Carga masiva con IA (change carga-masiva-con-ia, D3): pide la extracción de IA del texto libre
 * sin mapear de una fila del lote. En una fila de actualización, compara contra el valor vigente
 * de la pieza (`current_value` en cada campo; `unchanged_fields` para lo que ya coincide).
 */
export async function suggestRowAiFields(
  batchId: string,
  rowId: string,
  devUser?: string,
): Promise<ImportResult<AiSuggestion>> {
  return call(
    () =>
      client(devUser).POST("/api/v1/imports/{batch_id}/rows/{row_id}/ai-suggestion", {
        params: { path: { batch_id: batchId, row_id: rowId } },
      }) as Promise<{ data?: AiSuggestion; error?: unknown }>,
    AI_ERROR_MESSAGES,
  );
}

/**
 * Carga masiva con IA (change carga-masiva-con-ia, D4/D6): guarda, campo por campo, el valor
 * elegido o editado en la hoja de revisión. No escribe en el catálogo (RN-009); se aplica recién
 * al aprobar el lote. Un valor `null` quita ese campo de lo que se aplicará.
 */
export async function setRowAiFields(
  batchId: string,
  rowId: string,
  fields: Record<string, unknown>,
  devUser?: string,
): Promise<ImportResult<ImportRow>> {
  return call(
    () =>
      client(devUser).PATCH("/api/v1/imports/{batch_id}/rows/{row_id}/ai-fields", {
        params: { path: { batch_id: batchId, row_id: rowId } },
        body: { fields },
      }) as Promise<{ data?: ImportRow; error?: unknown }>,
    AI_ERROR_MESSAGES,
  );
}
