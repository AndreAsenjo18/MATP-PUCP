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

/** Tipos de archivo que admite la subida. */
export const UPLOAD_EXTENSIONS = [".xlsx", ".csv"] as const;
export const UPLOAD_TYPES_MESSAGE = "Solo se admiten archivos Excel (.xlsx) o CSV.";

/** El archivo es una hoja de cálculo que el asistente puede leer (por su extensión). */
export function isSpreadsheetFile(fileName: string): boolean {
  const name = fileName.trim().toLowerCase();
  return UPLOAD_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/** «84 KB», «2,3 MB». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("es-PE", { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}

/** Régimen de tenencia que se puede asignar a las filas que no lo traen. */
export const TENURE_DEFAULT_OPTIONS = [
  { value: "Propiedad", label: "Propiedad" },
  { value: "Comodato", label: "Comodato" },
  { value: "Préstamo Temporal", label: "Préstamo temporal" },
] as const;

/** Filas por página de la previsualización. */
export const IMPORT_PAGE_SIZE = 25;
/** Cada cuánto se consulta el avance de una etapa en segundo plano. */
export const IMPORT_POLL_MS = 1500;

export const SUMMARY_CHANGED_CODE = "summary_changed";
export const REVERT_CONFLICTS_CODE = "revert_has_conflicts";
const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";
const MOCK_MESSAGE = "El asistente conectado a la API solo funciona con NEXT_PUBLIC_API_MODE=live.";

/** Mensajes de la pantalla para los errores conocidos; el resto usa el mensaje de la API. */
export const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  file_too_large: "El archivo supera el tamaño máximo por lote: divídalo en varios archivos.",
  invalid_mapping: "El mapeo de columnas tiene errores: revise las columnas marcadas.",
  batch_processing: "El lote se está procesando: espere a que termine.",
  conflict_unresolved: "Resuelva la fila antes de aceptarla: elija la pieza destino o márquela como nueva.",
  row_has_errors: "Esta fila tiene errores y no se puede aceptar. Puede dejarla fuera o rechazarla.",
  reason_required: "Indique el motivo del rechazo: queda en la bitácora del lote.",
  inventory_code_mismatch: "La fila trae un código I distinto del de la pieza elegida. El código I no cambia en una importación.",
  inventory_code_in_use: "El código I de la fila ya pertenece a una pieza del catálogo: elija esa pieza como destino o rechace la fila.",
  [SUMMARY_CHANGED_CODE]: "El resumen cambió desde que lo revisó (otra persona modificó decisiones): revise el resumen actual y vuelva a aprobar.",
  nothing_to_apply: "El lote no tiene filas para aplicar.",
  batch_not_applied: "Las imágenes se asocian después de aplicar el lote, cuando la pieza ya existe en el catálogo.",
  image_already_associated: "La imagen ya está asociada a una pieza.",
  piece_required: "Indique la pieza: la imagen no está anclada en una fila aplicada.",
  permission_denied: "Su rol no tiene permiso para esta operación.",
  [REVERT_CONFLICTS_CODE]: "Alguien editó piezas de este lote después de aplicarlo: revise la lista antes de revertir también esas ediciones.",
  admin_required: "Solo un Administrador puede revertir un lote.",
  invalid_batch_transition: "El lote ya no está aplicado: recargue la página para ver su estado.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Referencias a requisitos entre paréntesis, p. ej. «(RN-002)» o «(RF-027, RNF-010)». */
const REQUIREMENT_IN_PARENTHESES = /\s*\(\s*(?:RF|RNF|RN|RIA)-\d+(?:\s*[,;]\s*(?:RF|RNF|RN|RIA)-\d+)*\s*\)/g;
const REQUIREMENT_BARE = /\b(?:RF|RNF|RN|RIA)-\d+\b/g;

/** Quita de un mensaje las referencias a requisitos (RF-, RN-, RNF-, RIA-) y deja el resto intacto. */
export function plainMessage(text: string): string {
  return text
    .replace(REQUIREMENT_IN_PARENTHESES, "")
    .replace(REQUIREMENT_BARE, "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Opciones de `call`: las pantallas que aún muestran referencias a requisitos las conservan. */
export interface CallOptions {
  keepReferences?: boolean;
}

function failureFrom(error: unknown, messages: Record<string, string> = IMPORT_ERROR_MESSAGES, options: CallOptions = {}): ImportFailure {
  const plain = (text: string) => (options.keepReferences ? text : plainMessage(text));
  if (isNotImplemented(error)) return { status: "unavailable", message: plain(apiErrorMessage(error)) };
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "error";
  const details = isRecord(error) && isRecord(error.details) ? error.details : undefined;
  return {
    status: "rejected",
    code,
    message: plain(messages[code] ?? apiErrorMessage(error)),
    ...(details ? { details } : {}),
  };
}

/** Llamada a la API con el resultado del asistente; `messages` traduce los códigos de error conocidos. */
export async function call<T>(
  request: () => Promise<{ data?: T; error?: unknown }>,
  messages: Record<string, string> = IMPORT_ERROR_MESSAGES,
  options: CallOptions = {},
): Promise<ImportResult<T>> {
  if (getApiMode() === "mock") return { status: "unavailable", message: MOCK_MESSAGE };
  try {
    const { data, error } = await request();
    if (error !== undefined || data === undefined) return failureFrom(error, messages, options);
    return { status: "ok", value: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

// ---------------------------------------------------------------------------------------------
// Reglas de la pantalla
// ---------------------------------------------------------------------------------------------

export const WIZARD_STEPS = ["Subir archivo", "Mapeo", "Validación", "Previsualización", "Aprobación", "Bitácora"] as const;

/** Los cuatro pasos que ve la persona; el sistema tiene más estados (`wizardStep`). */
export const PROGRESS_STEPS = ["Archivo", "Revisión", "Aprobación", "Resultado"] as const;

/** Paso (0 a 3) de `PROGRESS_STEPS` que corresponde al estado del lote. */
export function progressStep(batch: Pick<ImportBatch, "status"> | null): number {
  if (!batch) return 0;
  switch (batch.status) {
    case "UPLOADED":
    case "MAPPED":
    case "VALIDATED":
    case "FAILED_INGESTION":
      return 0;
    case "IN_PREVIEW":
    case "FAILED_APPLY":
      return 1;
    case "APPROVED":
      return 2;
    case "APPLIED":
    case "REVERTED":
    case "ABANDONED":
      return 3;
  }
}

const BATCH_STATE_TEXT: Record<string, string> = {
  UPLOADED: "Archivo leído",
  MAPPED: "Columnas asignadas",
  VALIDATED: "Validado",
  IN_PREVIEW: "Listo para revisar",
  APPROVED: "Aplicando al catálogo",
  APPLIED: "Aplicado al catálogo",
  FAILED_APPLY: "No se pudo aplicar: revise las filas",
  FAILED_INGESTION: "No se pudo leer el archivo",
  REVERTED: "Revertido",
  ABANDONED: "Abandonado",
};

/** Estado del lote en palabras de todos los días; con una etapa en curso, su avance en filas. */
export function batchStateText(batch: Pick<ImportBatch, "status" | "processing" | "progress">): string {
  if (isProcessing(batch)) return progressText(batch.progress);
  return BATCH_STATE_TEXT[batch.status] ?? "Estado desconocido";
}

/** Fracción (0 a 1) de la etapa en curso, o `null` si no se conoce el total. */
export function stageFraction(progress: ImportBatch["progress"]): number | null {
  if (!isRecord(progress)) return null;
  const done = typeof progress.done === "number" ? progress.done : 0;
  const total = typeof progress.total === "number" ? progress.total : 0;
  return total > 0 ? Math.min(1, done / total) : null;
}

export interface ValidationHint {
  /** Qué puede hacer la persona, en una línea. */
  hint: string;
  /** Acción directa que la pantalla ofrece, si existe. */
  action?: "assign_tenure";
}

/** Sugerencia por código de error de validación de una fila. */
export const VALIDATION_HINTS: Record<string, ValidationHint> = {
  tenure_required: { hint: "Elija un régimen para las filas que no lo traen, o complete esa celda en el archivo.", action: "assign_tenure" },
  title_required: { hint: "Complete la denominación en el archivo y vuelva a subirlo, o deje la fila fuera." },
  loan_for_use_with_inventory_code: { hint: "Quite el código I de la fila o cambie su régimen; también puede dejarla fuera." },
  temporary_loan_with_code: { hint: "Quite los códigos de la fila o cambie su régimen; también puede dejarla fuera." },
  invalid_inventory_code: { hint: "Corrija esa celda en el archivo y vuelva a subirlo, o deje la fila fuera." },
};

/** Sugerencia para un error de validación, o `null` si el código no es conocido. */
export function validationHint(code: unknown): ValidationHint | null {
  return typeof code === "string" ? (VALIDATION_HINTS[code] ?? null) : null;
}

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
  /** Denominación de la pieza, o «Pieza no disponible» si ya no está en el catálogo. */
  title: string;
  /** «Colección Mochica · Código I-0236» o «… · Sin código I». */
  detail: string;
  /** Por qué coincide: «Mismo código I I-0236 (vigente)» o «Se parece 82 %». */
  reason: string;
  available: boolean;
  /** Texto de una línea para elegirla; distingue a las piezas que de otro modo se verían iguales. */
  label: string;
}

function matchReason(match: Record<string, unknown>): string | null {
  if (match.kind === "piece" && Array.isArray(match.identifiers)) {
    const codes = match.identifiers
      .filter(isRecord)
      .map((item) => `${String(item.value)} (${item.via === "historical" ? "histórico" : "vigente"})`)
      .join(", ");
    return codes ? `Mismo código: ${codes}` : "Mismo código";
  }
  if (match.kind === "similar_piece" && typeof match.score === "number") return `Se parece ${Math.round(match.score * 100)} %`;
  return null;
}

function candidateDetail(match: Record<string, unknown>): string {
  const collection = typeof match.collection_name === "string" && match.collection_name ? match.collection_name : typeof match.collection_acronym === "string" ? match.collection_acronym : null;
  const code = typeof match.inventory_code === "string" && match.inventory_code ? `Código ${match.inventory_code}` : "Sin código I";
  return [collection, code].filter(Boolean).join(" · ");
}

/**
 * Piezas que la persona puede elegir como destino: coincidencias por código y parecidas. Una pieza
 * que coincide por dos vías aparece una sola vez con ambos motivos; las que se verían iguales
 * (misma denominación, colección y código) se distinguen con un identificador corto.
 */
export function candidatePieces(row: Pick<ImportRow, "matches">): CandidatePiece[] {
  const byPiece = new Map<string, { match: Record<string, unknown>; reasons: string[] }>();
  for (const match of row.matches ?? []) {
    if (!isRecord(match) || typeof match.piece_id !== "string") continue;
    const reason = matchReason(match);
    if (!reason) continue;
    const found = byPiece.get(match.piece_id);
    if (found) found.reasons.push(reason);
    else byPiece.set(match.piece_id, { match, reasons: [reason] });
  }
  const candidates = [...byPiece.entries()].map(([pieceId, { match, reasons }]) => {
    const available = match.available !== false;
    const title = available && typeof match.denomination === "string" && match.denomination ? match.denomination : available ? "Pieza sin denominación" : "Pieza no disponible";
    const detail = available ? candidateDetail(match) : "ya no está en el catálogo";
    const reason = reasons.join("; ");
    return { pieceId, title, detail, reason, available, label: `${title} · ${detail} — ${reason}` };
  });
  const seen = new Map<string, number>();
  for (const candidate of candidates) seen.set(candidate.label, (seen.get(candidate.label) ?? 0) + 1);
  return candidates.map((candidate) => ((seen.get(candidate.label) ?? 0) > 1 ? { ...candidate, label: `${candidate.label} (n.º ${candidate.pieceId.slice(-6)})` } : candidate));
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

/** Nombre en español de los campos que puede cambiar una actualización. */
const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  [
    ["denomination", "Denominación"],
    ["description", "Descripción"],
    ["tenure_regime", "Régimen de tenencia"],
    ["collection", "Colección"],
    ["author", "Autor"],
    ["provenance", "Procedencia"],
    ["epoch_original_text", "Época"],
    ["dimensions_text", "Medidas"],
    ["notes", "Observaciones"],
    ["recorded_by", "Registrador"],
    ["lender_name", "Comodante"],
    ["loan_agreement_ref", "Contrato de comodato"],
    ["temporary_inventory_number", "Inventario temporal"],
    ["identifiers", "Códigos"],
  ],
);

/** «provenance» → «Procedencia»; un campo desconocido se muestra tal cual. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
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

/** El error es «falta el régimen de tenencia» (`tenure_required`). */
export function hasTenureError(row: Pick<ImportRow, "validation_errors">): boolean {
  return row.validation_errors.some((error) => isRecord(error) && error.code === "tenure_required");
}

/** Páginas de 100 filas con errores que se recorren como máximo al contar las que no traen régimen. */
const TENURE_COUNT_MAX_PAGES = 20;

/**
 * Cuántas filas del lote no traen régimen de tenencia. Recorre las filas con errores de a 100;
 * si hay más de `TENURE_COUNT_MAX_PAGES` páginas devuelve lo contado hasta ahí (`complete: false`).
 */
export async function countTenureErrors(batchId: string, devUser?: string): Promise<ImportResult<{ count: number; complete: boolean }>> {
  let count = 0;
  for (let page = 1; page <= TENURE_COUNT_MAX_PAGES; page += 1) {
    const result = await fetchImportDiffs(batchId, { onlyErrors: true, page, pageSize: 100 }, devUser);
    if (result.status !== "ok") return result;
    count += result.value.items.filter(hasTenureError).length;
    if (result.value.page * result.value.pageSize >= result.value.total) return { status: "ok", value: { count, complete: true } };
  }
  return { status: "ok", value: { count, complete: false } };
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

/**
 * `POST /imports/{batch_id}/rollback` (RNF-007): deshace un lote aplicado. Sin `confirmConflicts`,
 * una edición posterior responde 409 `revert_has_conflicts` con la lista (`revertConflicts`).
 */
export async function rollbackImportBatch(batchId: string, reason: string, confirmConflicts: boolean, devUser?: string): Promise<ImportResult<ImportBatch>> {
  return call(() =>
    client(devUser).POST("/api/v1/imports/{batch_id}/rollback", {
      params: { path: { batch_id: batchId } },
      body: { reason: reason.trim(), confirm_conflicts: confirmConflicts },
    }),
  );
}

/** Campo editado a mano después de aplicar el lote, que la reversión pisaría. */
export interface RevertConflict {
  entityType: string;
  entityId: string;
  field: string | null;
  message: string;
}

/** Conflictos que acompañan a un 409 `revert_has_conflicts`; `null` para cualquier otro fallo. */
export function revertConflicts(failure: ImportFailure): RevertConflict[] | null {
  if (failure.status !== "rejected" || failure.code !== REVERT_CONFLICTS_CODE) return null;
  const conflicts = failure.details?.conflicts;
  if (!Array.isArray(conflicts)) return [];
  return conflicts.filter(isRecord).map((conflict) => ({
    entityType: String(conflict.entity_type ?? ""),
    entityId: String(conflict.entity_id ?? ""),
    field: typeof conflict.field === "string" ? conflict.field : null,
    message: String(conflict.message ?? ""),
  }));
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
