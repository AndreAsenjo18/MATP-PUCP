/**
 * Capa de datos del asistente de importación en modo `live` (change
 * `importacion-pipeline-reconciliacion`, tareas 6.1 y 6.2; spec importacion-datos, RF-021..RF-029).
 *
 * Usa el cliente tipado contra `/imports`: subida, lote, mapeo, validación, previsualización con
 * diff, decisiones por fila y por campo, aprobación con `summary_token`, bitácora (JSON y Excel) y
 * asociación de imágenes extraídas. Cada llamada envía como identidad provisional (`X-MATP-User`,
 * ADR-005) el correo del usuario de la sesión simulada.
 *
 * En modo `mock` el asistente de la maqueta sigue usando `mock-store` y los fixtures; estas
 * operaciones responden `unavailable` para que ninguna pantalla crea que guardó algo.
 *
 * Además reúne las reglas que la pantalla necesita para explicar el lote en lenguaje claro
 * (RNF-010): paso del asistente según el estado, sugerencia de mapeo por cabecera, si una fila se
 * puede aceptar y el resumen de la aprobación.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";

import { apiBaseUrl, getApiMode } from "./mode";

export type ImportBatch = ApiSchemas["ImportBatchOut"];
export type ImportBatchStatus = ApiSchemas["ImportBatchStatus"];
export type ImportRow = ApiSchemas["ImportRowOut"];
export type ImportImage = ApiSchemas["ImportImageOut"];
export type ImportLog = ApiSchemas["ImportLog"];
export type ImportLogEntry = ApiSchemas["ImportLogEntry"];
export type ApprovalSummary = ApiSchemas["ApprovalSummaryOut"];
export type ColumnMapping = ApiSchemas["ColumnMapping"];
export type MappingRequest = ApiSchemas["MappingRequest"];
export type RowClassification = ApiSchemas["RowClassification"];
export type ClassificationRule = ApiSchemas["ClassificationRule"];

export interface ImportDiffs {
  items: ImportRow[];
  total: number;
  page: number;
  pageSize: number;
  rules: ClassificationRule[];
  unassignedImages: ImportImage[];
}

export type ImportFailure =
  | { status: "rejected"; code: string; message: string; details?: Record<string, unknown> }
  | { status: "unavailable"; message: string };

export type ImportResult<T> = { status: "ok"; value: T } | ImportFailure;

export type RowDecisionValue = "ACCEPTED" | "EXCLUDED" | "REJECTED";
export type FieldAction = "accept" | "exclude";

export interface RowDecisionInput {
  decision: RowDecisionValue;
  reason?: string | null;
  targetPieceId?: string | null;
  asNew?: boolean;
  fieldDecisions?: Record<string, FieldAction>;
}

/** Filas por página de la previsualización. */
export const IMPORT_PAGE_SIZE = 25;
/** Cada cuánto se consulta el avance de una etapa en segundo plano. */
export const IMPORT_POLL_MS = 1500;

export const SUMMARY_CHANGED_CODE = "summary_changed";
const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";
const MOCK_MESSAGE = "El asistente conectado a la API solo funciona con NEXT_PUBLIC_API_MODE=live.";

/** Mensajes de la pantalla para los errores conocidos; el resto usa el mensaje de la API. */
export const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  file_too_large: "El archivo supera el tamaño máximo por lote: divídalo en varios archivos.",
  invalid_mapping: "El mapeo de columnas tiene errores: revise las columnas marcadas.",
  batch_processing: "El lote se está procesando: espere a que termine.",
  conflict_unresolved: "Resuelva la fila antes de aceptarla: elija la pieza destino o márquela como nueva.",
  row_has_errors: "La fila tiene errores de validación: corríjalos en el archivo o rechácela.",
  reason_required: "Indique el motivo del rechazo: queda en la bitácora del lote.",
  inventory_code_mismatch: "La fila trae un código I distinto del de la pieza elegida: el código I no cambia en una importación (RN-002).",
  inventory_code_in_use: "El código I de la fila ya pertenece a una pieza del catálogo: elija esa pieza como destino o rechace la fila.",
  [SUMMARY_CHANGED_CODE]: "El resumen cambió desde que lo revisó (otra persona modificó decisiones): revise el resumen actual y vuelva a aprobar.",
  nothing_to_apply: "El lote no tiene filas para aplicar.",
  batch_not_applied: "Las imágenes se asocian después de aplicar el lote, cuando la pieza ya existe en el catálogo.",
  image_already_associated: "La imagen ya está asociada a una pieza.",
  piece_required: "Indique la pieza: la imagen no está anclada en una fila aplicada.",
  permission_denied: "Su rol no tiene permiso para esta operación.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureFrom(error: unknown): ImportFailure {
  if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "error";
  const details = isRecord(error) && isRecord(error.details) ? error.details : undefined;
  return {
    status: "rejected",
    code,
    message: IMPORT_ERROR_MESSAGES[code] ?? apiErrorMessage(error),
    ...(details ? { details } : {}),
  };
}

async function call<T>(request: () => Promise<{ data?: T; error?: unknown }>): Promise<ImportResult<T>> {
  if (getApiMode() === "mock") return { status: "unavailable", message: MOCK_MESSAGE };
  try {
    const { data, error } = await request();
    if (error !== undefined || data === undefined) return failureFrom(error);
    return { status: "ok", value: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

// ---------------------------------------------------------------------------------------------
// Reglas de la pantalla
// ---------------------------------------------------------------------------------------------

export const WIZARD_STEPS = ["Subir archivo", "Mapeo", "Validación", "Previsualización", "Aprobación", "Bitácora"] as const;

/** Paso del asistente que corresponde al estado del lote. */
export function wizardStep(batch: Pick<ImportBatch, "status"> | null): number {
  if (!batch) return 0;
  switch (batch.status) {
    case "UPLOADED":
      return 1;
    case "MAPPED":
    case "VALIDATED":
      return 2;
    case "IN_PREVIEW":
    case "FAILED_APPLY":
      return 3;
    case "APPROVED":
      return 4;
    case "FAILED_INGESTION":
    case "APPLIED":
    case "REVERTED":
    case "ABANDONED":
      return 5;
  }
}

/** Hay una etapa en segundo plano: la pantalla consulta el avance hasta que termine. */
export function isProcessing(batch: Pick<ImportBatch, "processing" | "status"> | null): boolean {
  return batch != null && (batch.processing === true || batch.status === "APPROVED");
}

const STAGE_LABELS: Record<string, string> = {
  INGEST: "Leyendo el archivo",
  VALIDATE: "Validando y buscando coincidencias",
  APPLY: "Aplicando al catálogo",
};

/** «Validando y buscando coincidencias: 1 200 de 8 000 filas». */
export function progressText(progress: ImportBatch["progress"]): string {
  if (!isRecord(progress)) return "Procesando…";
  const label = STAGE_LABELS[String(progress.stage)] ?? "Procesando";
  const done = typeof progress.done === "number" ? progress.done : 0;
  const total = typeof progress.total === "number" ? progress.total : null;
  const format = (n: number) => n.toLocaleString("es-PE");
  return total ? `${label}: ${format(done)} de ${format(total)} filas` : `${label}…`;
}

export interface TargetOption {
  value: string;
  label: string;
}

/** Destinos de una columna (valor `""` = se conserva como dato de origen, RF-008). */
export const TARGET_OPTIONS: TargetOption[] = [
  { value: "", label: "Dato de origen (se conserva sin mapear)" },
  { value: "denomination", label: "Denominación" },
  { value: "description", label: "Descripción" },
  { value: "tenure_regime", label: "Régimen de tenencia" },
  { value: "collection", label: "Colección (sigla)" },
  { value: "author", label: "Autor" },
  { value: "provenance", label: "Procedencia" },
  { value: "epoch_original_text", label: "Época (texto original)" },
  { value: "dimensions_text", label: "Medidas (texto)" },
  { value: "notes", label: "Observaciones" },
  { value: "recorded_by", label: "Registrador" },
  { value: "lender_name", label: "Comodante" },
  { value: "loan_agreement_ref", label: "Referencia del contrato de comodato" },
  { value: "temporary_inventory_number", label: "Número de inventario temporal" },
  { value: "identifier", label: "Códigos (se reconoce el tipo de cada uno)" },
  { value: "identifier:I", label: "Código I (inventario general)" },
  { value: "identifier:COLECCION", label: "Código de colección" },
  { value: "identifier:INC_RN", label: "Código INC / Ministerio de Cultura" },
  { value: "identifier:PUCP", label: "Código PUCP" },
  { value: "identifier:PROPIETARIO", label: "Código del propietario" },
  { value: "identifier:OTRO", label: "Otro código histórico" },
];

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SUGGESTIONS: [RegExp, string][] = [
  [/\b(denominacion|nombre|titulo|objeto)\b/, "denomination"],
  [/\b(codigos?|cod|n inventario|inventario)\b/, "identifier"],
  [/\b(regimen|tenencia)\b/, "tenure_regime"],
  [/\bcoleccion\b/, "collection"],
  [/\bautor(a|es)?\b/, "author"],
  [/\bprocedencia\b/, "provenance"],
  [/\b(epoca|periodo|fecha)\b/, "epoch_original_text"],
  [/\b(medidas?|dimensiones?)\b/, "dimensions_text"],
  [/\bdescripcion\b/, "description"],
];

/**
 * Mapeo sugerido para las cabeceras del archivo [SUPUESTO: nombres habituales de las sábanas].
 * Es solo un punto de partida: la persona lo revisa antes de guardarlo. Las columnas sin
 * sugerencia, como las observaciones de la consultoría, quedan como datos de origen.
 */
export function suggestMapping(headers: readonly string[]): ColumnMapping[] {
  const taken = new Set<string>();
  return headers.map((header) => {
    const folded = fold(header);
    const match = SUGGESTIONS.find(([pattern, target]) => pattern.test(folded) && (target === "identifier" || !taken.has(target)));
    const target = match?.[1] ?? null;
    if (target && target !== "identifier") taken.add(target);
    return {
      source_column: header,
      target_field: target,
      identifier_type_code: null,
      split_compound: target === "identifier",
    };
  });
}

/** Cuerpo de `PUT /imports/{batch_id}/mapping` con las columnas mapeadas (las demás, de origen). */
export function mappingRequest(columns: readonly ColumnMapping[], options: { sheetName?: string | null; headerRow?: number | null; tenureDefault?: string | null }): MappingRequest {
  return {
    sheet_name: options.sheetName ?? null,
    header_row: options.headerRow ?? null,
    columns: columns.filter((column) => column.target_field).map((column) => ({ ...column, split_compound: column.target_field === "identifier" || column.split_compound })),
    defaults: options.tenureDefault ? { tenure_regime: options.tenureDefault } : {},
  };
}

const RESOLVABLE = new Set<RowClassification>(["CONFLICT", "POSSIBLE_DUPLICATE"]);

export function needsResolution(row: Pick<ImportRow, "classification">): boolean {
  return row.classification != null && RESOLVABLE.has(row.classification);
}

export function isResolved(row: Pick<ImportRow, "resolution">): boolean {
  const resolution = row.resolution;
  return isRecord(resolution) && (resolution.as_new === true || typeof resolution.target_piece_id === "string");
}

/** Motivo por el que la fila no se puede aceptar, o `null` si se puede (D5). */
export function acceptBlocker(row: Pick<ImportRow, "classification" | "resolution" | "has_validation_errors">): string | null {
  if (row.has_validation_errors) return IMPORT_ERROR_MESSAGES.row_has_errors;
  if (needsResolution(row) && !isResolved(row)) return IMPORT_ERROR_MESSAGES.conflict_unresolved;
  return null;
}

export interface CandidatePiece {
  pieceId: string;
  /** «Código I-0236 (vigente)» o «Similitud 82 %». */
  reason: string;
}

/** Piezas que la persona puede elegir como destino: coincidencias por código y similares. */
export function candidatePieces(row: Pick<ImportRow, "matches">): CandidatePiece[] {
  const seen = new Set<string>();
  const result: CandidatePiece[] = [];
  for (const match of row.matches ?? []) {
    if (!isRecord(match) || typeof match.piece_id !== "string" || seen.has(match.piece_id)) continue;
    let reason: string | null = null;
    if (match.kind === "piece" && Array.isArray(match.identifiers)) {
      reason = match.identifiers
        .filter(isRecord)
        .map((item) => `Código ${String(item.identifier_type)} ${String(item.value)} (${item.via === "historical" ? "histórico" : "vigente"})`)
        .join(", ");
    } else if (match.kind === "similar_piece" && typeof match.score === "number") {
      reason = `Similitud ${Math.round(match.score * 100)} %`;
    }
    if (reason) {
      seen.add(match.piece_id);
      result.push({ pieceId: match.piece_id, reason });
    }
  }
  return result;
}

/** Otras filas del lote con el mismo código I (conflicto dentro del lote). */
export function conflictingRows(row: Pick<ImportRow, "matches">): number[] {
  return (row.matches ?? []).filter((m) => isRecord(m) && m.kind === "batch_row" && typeof m.row_number === "number").map((m) => (m as { row_number: number }).row_number);
}

/** Acción efectiva de cada campo del diff: la elegida o la propuesta (`keep` = conservar). */
export function fieldAction(row: Pick<ImportRow, "resolution">, field: string, defaultAction: string | null | undefined): FieldAction {
  const chosen = isRecord(row.resolution) && isRecord(row.resolution.field_decisions) ? row.resolution.field_decisions[field] : undefined;
  if (chosen === "accept" || chosen === "exclude") return chosen;
  return defaultAction === "keep" ? "exclude" : "accept";
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creará una pieza nueva",
  UPDATE: "Actualizará una pieza existente",
  SKIP: "No se aplicará",
};

export function actionLabel(action: string | null | undefined): string {
  return (action && ACTION_LABELS[action]) ?? "Sin decidir";
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("es-PE")} ${count === 1 ? one : many}`;
}

/** Resumen de la aprobación en lenguaje claro (RF-027, RNF-010). */
export function summarySentence(summary: Pick<ApprovalSummary, "create" | "update" | "skip">): string {
  return (
    `Se crearán ${plural(summary.create, "pieza nueva", "piezas nuevas")}, ` +
    `se actualizarán ${plural(summary.update, "pieza", "piezas")} y ` +
    `${plural(summary.skip, "fila no se aplicará", "filas no se aplicarán")}.`
  );
}

// ---------------------------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------------------------

/** `POST /imports/upload`: guarda el archivo original y lo lee en segundo plano (RF-021). */
export async function uploadImportFile(file: Blob, fileName: string, devUser?: string): Promise<ImportResult<ApiSchemas["ImportBatchSummary"]>> {
  return call(() =>
    client(devUser).POST("/api/v1/imports/upload", {
      body: { file: fileName },
      bodySerializer: () => {
        const form = new FormData();
        form.append("file", file, fileName);
        return form;
      },
    }),
  );
}

/** `GET /imports/{batch_id}`: estado, etapa en curso y resumen para aprobar. */
export async function fetchImportBatch(batchId: string, devUser?: string): Promise<ImportResult<ImportBatch>> {
  return call(() => client(devUser).GET("/api/v1/imports/{batch_id}", { params: { path: { batch_id: batchId } } }));
}

/** `PUT /imports/{batch_id}/mapping`: errores de mapeo llegan como `invalid_mapping` con su lista. */
export async function saveImportMapping(batchId: string, body: MappingRequest, devUser?: string): Promise<ImportResult<ImportBatch>> {
  return call(() => client(devUser).PUT("/api/v1/imports/{batch_id}/mapping", { params: { path: { batch_id: batchId } }, body }));
}

/** `POST /imports/{batch_id}/validate`: responde de inmediato; el avance se consulta en el lote. */
export async function startImportValidation(batchId: string, devUser?: string): Promise<ImportResult<ApiSchemas["ValidationSummary"]>> {
  return call(() => client(devUser).POST("/api/v1/imports/{batch_id}/validate", { params: { path: { batch_id: batchId } } }));
}

export interface ImportDiffFilters {
  classification?: RowClassification | null;
  onlyErrors?: boolean;
  page?: number;
  pageSize?: number;
}

/** `GET /imports/{batch_id}/diffs`: filas con diff, reglas de clasificación e imágenes. */
export async function fetchImportDiffs(batchId: string, filters: ImportDiffFilters = {}, devUser?: string): Promise<ImportResult<ImportDiffs>> {
  const result = await call(() =>
    client(devUser).GET("/api/v1/imports/{batch_id}/diffs", {
      params: {
        path: { batch_id: batchId },
        query: {
          classification: filters.classification ?? undefined,
          only_errors: filters.onlyErrors ?? false,
          page: filters.page ?? 1,
          page_size: filters.pageSize ?? IMPORT_PAGE_SIZE,
        },
      },
    }),
  );
  if (result.status !== "ok") return result;
  const page = result.value;
  return {
    status: "ok",
    value: {
      items: page.items,
      total: page.total,
      page: page.page,
      pageSize: page.page_size,
      rules: page.classification_rules,
      unassignedImages: page.unassigned_images ?? [],
    },
  };
}

/** `PATCH /imports/{batch_id}/rows/{row_id}`: decisión de fila, de campos y resolución (D5). */
export async function decideImportRow(batchId: string, rowId: string, input: RowDecisionInput, devUser?: string): Promise<ImportResult<ImportRow>> {
  return call(() =>
    client(devUser).PATCH("/api/v1/imports/{batch_id}/rows/{row_id}", {
      params: { path: { batch_id: batchId, row_id: rowId } },
      body: {
        decision: input.decision,
        reason: input.reason?.trim() || null,
        target_piece_id: input.targetPieceId ?? null,
        as_new: input.asNew ?? false,
        field_decisions: input.fieldDecisions ?? {},
      },
    }),
  );
}

/** `POST /imports/{batch_id}/confirm` con el resumen confirmado; 409 trae el resumen actual. */
export async function confirmImportBatch(batchId: string, summary: ApprovalSummary, comment: string | null, devUser?: string): Promise<ImportResult<ImportBatch>> {
  return call(() =>
    client(devUser).POST("/api/v1/imports/{batch_id}/confirm", {
      params: { path: { batch_id: batchId } },
      body: {
        summary_token: summary.summary_token,
        confirm_counts: { create: summary.create, update: summary.update, skip: summary.skip },
        comment: comment?.trim() || null,
      },
    }),
  );
}

/** Resumen actual que acompaña a un 409 `summary_changed`, para mostrarlo sin recargar. */
export function changedSummary(failure: ImportFailure): ApprovalSummary | null {
  if (failure.status !== "rejected" || failure.code !== SUMMARY_CHANGED_CODE) return null;
  const summary = failure.details?.summary;
  return isRecord(summary) && typeof summary.summary_token === "string" ? (summary as unknown as ApprovalSummary) : null;
}

/** `GET /imports/{batch_id}/log`: bitácora con motivos (RF-028). */
export async function fetchImportLog(batchId: string, devUser?: string): Promise<ImportResult<ImportLog>> {
  // The 200 response also declares the spreadsheet, so the JSON body is typed explicitly.
  return call(
    () =>
      client(devUser).GET("/api/v1/imports/{batch_id}/log", { params: { path: { batch_id: batchId }, query: { format: "json" } } }) as Promise<{
        data?: ImportLog;
        error?: unknown;
      }>,
  );
}

/**
 * Bitácora en Excel. Se descarga con `fetch` y no con un enlace porque la petición debe llevar la
 * identidad de la sesión.
 */
export async function downloadImportLog(batchId: string, devUser?: string): Promise<ImportResult<Blob>> {
  if (getApiMode() === "mock") return { status: "unavailable", message: MOCK_MESSAGE };
  try {
    const { data, error } = await client(devUser).GET("/api/v1/imports/{batch_id}/log", {
      params: { path: { batch_id: batchId }, query: { format: "xlsx" } },
      parseAs: "blob",
    });
    if (error !== undefined || !data) return failureFrom(error);
    return { status: "ok", value: data as unknown as Blob };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** `POST /imports/{batch_id}/images/{image_id}/associate` (RF-029): solo tras aplicar el lote. */
export async function associateImportImage(batchId: string, imageId: string, pieceId: string | null, devUser?: string): Promise<ImportResult<ImportImage>> {
  return call(() =>
    client(devUser).POST("/api/v1/imports/{batch_id}/images/{image_id}/associate", {
      params: { path: { batch_id: batchId, image_id: imageId } },
      body: { piece_id: pieceId?.trim() || null },
    }),
  );
}
