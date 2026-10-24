/**
 * Plantillas de mapeo en el asistente de importación, modo `live` (change
 * `plantillas-mapeo-y-normalizacion`, tarea 4.1A; spec importacion-datos: RF-022, RF-023, RNF-010).
 *
 * Sugerencia por cabeceras (`POST /import-templates/suggest`, design D3), lista de plantillas
 * activas, vista previa de normalización por columna (`POST /import-templates/{id}/dry-run`,
 * design D4) y el cuerpo de `PUT /imports/{batch_id}/mapping`, que lleva una plantilla
 * (`template_id`, fase 2 de design D1) o las columnas, nunca ambas cosas. Cada llamada envía
 * la identidad de la sesión simulada, como `imports.ts`; en modo `mock` responden `unavailable`.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";

import { IMPORT_ERROR_MESSAGES, TARGET_OPTIONS, call, mappingRequest, type ColumnMapping, type ImportBatch, type ImportFailure, type ImportResult, type MappingRequest } from "./imports";
import { apiBaseUrl } from "./mode";

export type MappingTemplate = ApiSchemas["MappingTemplateOut"];
export type TemplateSuggestion = ApiSchemas["TemplateSuggestion"];
export type TemplateDryRun = ApiSchemas["TemplateDryRunOut"];
export type DryRunColumn = ApiSchemas["DryRunColumn"];
export type DryRunExample = ApiSchemas["DryRunExample"];
export type DryRunTraceStep = ApiSchemas["DryRunTraceStep"];
export type DryRunStatus = DryRunExample["status"];

/** Estados de una celda en la vista previa, en el orden en que se muestran (design D4). */
export const DRY_RUN_STATUSES: readonly DryRunStatus[] = ["NORMALIZED", "UNPARSEABLE", "ABSENT", "SPLIT_PROPOSED"];

/** Mensajes para los errores de plantillas y vista previa; el resto, los del asistente. */
export const TEMPLATE_ERROR_MESSAGES: Record<string, string> = {
  ...IMPORT_ERROR_MESSAGES,
  template_not_found: "La plantilla ya no existe o fue eliminada: elija otra.",
  template_with_columns: "Indique una plantilla o las columnas, no ambas: la plantilla ya define el mapeo.",
  batch_not_found: "El lote de importación no existe.",
  batch_not_ingested: "El archivo todavía se está leyendo: espere a que termine.",
  batch_not_previewable: "La vista previa de una plantilla solo se calcula antes de validar el lote.",
};

const UNKNOWN_COLUMN_MESSAGE = "La plantilla usa columnas que este archivo no trae: elija otra plantilla o empiece desde cero.";

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

// ---------------------------------------------------------------------------------------------
// Reglas de la pantalla
// ---------------------------------------------------------------------------------------------

/** Lo que se envía en `PUT /mapping`: una plantilla guardada o las columnas del panel actual. */
export type BatchMappingSource =
  | { kind: "template"; templateId: string; tenureDefault?: string | null }
  | { kind: "columns"; columns: readonly ColumnMapping[]; sheetName?: string | null; headerRow?: number | null; tenureDefault?: string | null };

/**
 * Cuerpo de `PUT /imports/{batch_id}/mapping`. Con plantilla no lleva columnas (la API responde
 * `template_with_columns` si llegan las dos cosas) ni hoja ni fila de cabeceras: se usan las del
 * lote. El régimen por defecto, si se indica, se impone al de la plantilla.
 */
export function batchMappingRequest(source: BatchMappingSource): MappingRequest {
  if (source.kind === "template") {
    return {
      template_id: source.templateId,
      sheet_name: null,
      header_row: null,
      columns: [],
      defaults: source.tenureDefault ? { tenure_regime: source.tenureDefault } : {},
    };
  }
  return { ...mappingRequest(source.columns, source), template_id: null };
}

/** Columnas de la plantilla que el archivo no trae: aplicarla tal cual respondería 422 (design D1). */
export function missingColumns(template: Pick<MappingTemplate, "columns">, headers: readonly string[]): string[] {
  const known = new Set(headers);
  return template.columns.map((column) => column.source_column).filter((source) => !known.has(source));
}

/** Por qué no se puede usar la plantilla en este lote, o `null` si se puede. */
export function applyBlocker(template: Pick<MappingTemplate, "columns">, batch: Pick<ImportBatch, "headers">): string | null {
  const missing = missingColumns(template, batch.headers ?? []);
  if (missing.length === 0) return null;
  return `La plantilla usa columnas que este archivo no trae (${missing.join(", ")}): elija otra plantilla o empiece desde cero.`;
}

/** Plantillas activas que no están entre las sugeridas, para la lista completa. */
export function otherTemplates(templates: readonly MappingTemplate[], suggestions: readonly TemplateSuggestion[]): MappingTemplate[] {
  const suggested = new Set(suggestions.map((suggestion) => suggestion.template.id));
  return templates.filter((template) => !suggested.has(template.id));
}

/** «100 %», «72 %». */
export function scoreLabel(score: number): string {
  return `${Math.round(score * 100)} %`;
}

/** Nombre en español del destino de una columna (`terms:MATERIAL` → «Términos del vocabulario MATERIAL»). */
export function targetLabel(column: Pick<ColumnMapping, "target_field" | "identifier_type_code">): string {
  const target = column.target_field ?? "";
  if (target.startsWith("terms:")) return `Términos del vocabulario ${target.slice("terms:".length)}`;
  const value = target === "identifier" && column.identifier_type_code ? `identifier:${column.identifier_type_code}` : target;
  return TARGET_OPTIONS.find((option) => option.value === value)?.label ?? target;
}

/** Conteos de una columna en el orden de `DRY_RUN_STATUSES`; los que no llegan cuentan 0. */
export function statusCounts(column: Pick<DryRunColumn, "counts">): [DryRunStatus, number][] {
  return DRY_RUN_STATUSES.map((status) => [status, column.counts[status] ?? 0]);
}

/** Una columna merece abrirse en la vista previa si algo no se normalizó o quedó sin término. */
export function columnNeedsAttention(column: Pick<DryRunColumn, "counts" | "unmatched_values" | "in_file">): boolean {
  return !column.in_file || (column.counts.UNPARSEABLE ?? 0) > 0 || (column.counts.SPLIT_PROPOSED ?? 0) > 0 || column.unmatched_values.length > 0;
}

/** Un valor de la vista previa en texto: «madera» o «madera · pasta de papa»; vacío = «(vacío)». */
export function previewValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(vacío)";
  if (Array.isArray(value)) return value.map(previewValue).join(" · ");
  if (typeof value === "object") return JSON.stringify(value);
  return `«${String(value)}»`;
}

const TRACE_NOTES: Record<string, string> = {
  excel_date_cell: "celda de fecha de Excel, se toma tal cual",
  not_recognized: "no se reconoció el texto",
};

/** Un paso de la traza: «trim: «  x » → «x»», con la nota en español si la hay. */
export function traceStepText(step: DryRunTraceStep): string {
  const note = step.note ? ` (${TRACE_NOTES[step.note] ?? step.note})` : "";
  return `${step.transform}: ${previewValue(step.before)} → ${previewValue(step.after)}${note}`;
}

/** Mensaje de un mapeo rechazado: los errores por columna de `invalid_mapping` en una frase. */
export function mappingFailureMessage(failure: ImportFailure): string {
  if (failure.status !== "rejected" || failure.code !== "invalid_mapping") return failure.message;
  const errors = Array.isArray(failure.details?.errors) ? failure.details.errors : [];
  const items = errors.filter((item): item is { code?: string; message?: string } => typeof item === "object" && item !== null);
  if (items.some((item) => item.code === "unknown_column")) return UNKNOWN_COLUMN_MESSAGE;
  const messages = items.map((item) => item.message).filter(Boolean);
  return messages.length ? `${failure.message} ${messages.join(" ")}` : failure.message;
}

// ---------------------------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------------------------

/** `POST /import-templates/suggest`: hasta 3 plantillas para las cabeceras, de mayor a menor puntaje. */
export async function suggestTemplates(headers: readonly string[], devUser?: string): Promise<ImportResult<TemplateSuggestion[]>> {
  return call(() => client(devUser).POST("/api/v1/import-templates/suggest", { body: { headers: [...headers] } }), TEMPLATE_ERROR_MESSAGES);
}

/** `GET /import-templates`: las plantillas activas, por nombre. */
export async function fetchTemplates(devUser?: string): Promise<ImportResult<MappingTemplate[]>> {
  return call(() => client(devUser).GET("/api/v1/import-templates"), TEMPLATE_ERROR_MESSAGES);
}

/** `POST /import-templates/{id}/dry-run`: vista previa sobre una muestra del lote; no escribe nada. */
export async function dryRunTemplate(templateId: string, batchId: string, devUser?: string): Promise<ImportResult<TemplateDryRun>> {
  return call(
    () => client(devUser).POST("/api/v1/import-templates/{template_id}/dry-run", { params: { path: { template_id: templateId } }, body: { batch_id: batchId } }),
    TEMPLATE_ERROR_MESSAGES,
  );
}

/** `PUT /imports/{batch_id}/mapping` con una plantilla o con columnas (`batchMappingRequest`). */
export async function saveBatchMapping(batchId: string, source: BatchMappingSource, devUser?: string): Promise<ImportResult<ImportBatch>> {
  return call(
    () => client(devUser).PUT("/api/v1/imports/{batch_id}/mapping", { params: { path: { batch_id: batchId } }, body: batchMappingRequest(source) }),
    TEMPLATE_ERROR_MESSAGES,
  );
}
