/**
 * Capa de datos de piezas consciente del modo (spec plataforma: "Prototipo navegable en modo
 * simulado"): en modo `mock` responde con los fixtures sintéticos (sin red, sin async real);
 * en modo `live` llama a la API real a través del cliente tipado de `contratos-api-borrador`.
 *
 * Escritura y validación en línea (change `ficha-pieza-crud`, tarea 4.2): `createPiece`,
 * `updatePiece` y `validatePiece`, más `createPieceValidator` (debounce + `AbortController`).
 * La validación de negocio vive solo en el servidor (ADR-015, design D1): la rama `mock` solo
 * simula su respuesta con dos reglas de demostración y la rama `live` no reimplementa nada.
 *
 * Alcance deliberado de la primera versión (solo lectura): piezas (listado con `q` y ficha
 * por id), porque son las **únicas** operaciones de piezas que `contratos-api-borrador`
 * implementó de verdad (el resto siguen siendo stubs `501`). Las pantallas de esta fase
 * (`app/busqueda`, `app/piezas/[id]`) todavía consumen `lib/fixtures` de forma directa y
 * síncrona porque ya están verificadas en modo mock; conectarlas a este módulo y probarlas
 * contra una API real es un pendiente explícito (requiere Docker/PostgreSQL, ver
 * `docs/estado-arranque.md`). Este módulo existe para que esa conexión sea un cambio pequeño y
 * localizado, no una reescritura de pantalla.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";
import { getPieceDetail, listPieces, PIECES } from "@/lib/fixtures";
import { COLLECTIONS } from "@/lib/fixtures/collections";
import { TERMS, termsByVocabulary } from "@/lib/fixtures/reference-data";

import { apiBaseUrl, getApiMode } from "./mode";

type PieceSummary = ApiSchemas["PieceSummary"];
type PieceDetail = ApiSchemas["PieceDetail"];

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PiecesQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

/** `null` cuando la operación existe pero no hay datos que mostrar (p. ej. detalle no encontrado). */
export type PieceLookupResult = { status: "ok"; piece: PieceDetail } | { status: "not_found" } | { status: "unavailable"; message: string };

function client() {
  return createApiClient({ baseUrl: apiBaseUrl() });
}

export async function fetchPieces(query: PiecesQuery): Promise<Page<PieceSummary>> {
  if (getApiMode() === "mock") {
    const result = listPieces({ q: query.q, page: query.page, pageSize: query.pageSize });
    return { items: result.items, total: result.total, page: result.page, limit: result.page_size };
  }
  const { data, error } = await client().GET("/api/v1/pieces", {
    params: { query: { q: query.q || undefined, page: query.page, limit: query.pageSize } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function fetchPieceDetail(id: string): Promise<PieceLookupResult> {
  if (getApiMode() === "mock") {
    const piece = getPieceDetail(id);
    return piece ? { status: "ok", piece } : { status: "not_found" };
  }
  const { data, error } = await client().GET("/api/v1/pieces/{piece_id}", { params: { path: { piece_id: id } } });
  if (error) {
    if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
    if ((error as { code?: unknown }).code === "not_found") return { status: "not_found" };
    return { status: "unavailable", message: apiErrorMessage(error) };
  }
  return { status: "ok", piece: data };
}

// ---------------------------------------------------------------------------------------------
// Escritura y validación (change ficha-pieza-crud, tarea 4.2)
// ---------------------------------------------------------------------------------------------

/** Cuerpo de `POST /pieces` (también el de `POST /pieces/validate`). */
export type PieceCreateInput = NonNullable<paths["/api/v1/pieces"]["post"]["requestBody"]>["content"]["application/json"];
/** Cuerpo de `PUT /pieces/{piece_id}`: solo se envían los campos que cambian. */
export type PieceUpdateInput = NonNullable<paths["/api/v1/pieces/{piece_id}"]["put"]["requestBody"]>["content"]["application/json"];
/** Respuesta de `POST /pieces/validate`: `{ is_valid, issues[] }` (el contrato manda sobre design D1). */
export type PieceValidationResult = paths["/api/v1/pieces/validate"]["post"]["responses"][200]["content"]["application/json"];
export type PieceIssue = PieceValidationResult["issues"][number];

/**
 * Fallos de una operación de escritura o validación. `rejected`: la API respondió con un error
 * de negocio o de permisos (`code` y `message` del cuerpo de error). `unavailable`: la operación
 * es un stub 501 en este entorno o no hubo conexión.
 */
export type PieceWriteFailure =
  | {
      status: "rejected";
      code: string;
      message: string;
      /** `details` del cuerpo de error (p. ej. la pieza que ya usa un código I), si la API lo envía. */
      details?: Record<string, unknown>;
    }
  | { status: "unavailable"; message: string };

export type PieceCreateResult = { status: "ok"; piece: PieceSummary } | PieceWriteFailure;
/**
 * `conflict`: la pieza cambió mientras se editaba (409 `edit_conflict`, design D2). Los demás 409
 * (`immutable_inventory_code`, `integrity_conflict`…) siguen siendo `rejected` con su mensaje.
 */
export type PieceUpdateResult =
  | { status: "ok"; piece: PieceDetail }
  | { status: "conflict"; message: string }
  | PieceWriteFailure;

/** Código de error de la edición concurrente (design D2 de `ficha-pieza-crud`). */
export const EDIT_CONFLICT_CODE = "edit_conflict";
/** `aborted`: la validación fue reemplazada o cancelada; quien llama debe ignorarla. */
export type PieceValidationOutcome =
  | { status: "ok"; result: PieceValidationResult }
  | { status: "aborted" }
  | PieceWriteFailure;

export interface ValidatePieceOptions {
  /** Pieza en edición (query `piece_id`); omitir al crear. */
  pieceId?: string;
  signal?: AbortSignal;
}

const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";

function failureFrom(error: unknown): PieceWriteFailure {
  if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
  const code = (error as { code?: unknown } | null)?.code;
  const details = (error as { details?: unknown } | null)?.details;
  return {
    status: "rejected",
    code: typeof code === "string" ? code : "error",
    message: apiErrorMessage(error),
    ...(isRecord(details) ? { details } : {}),
  };
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

function isEditConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === EDIT_CONFLICT_CODE;
}

/** Respuesta simulada de `POST /pieces` en modo mock: no persiste nada (no hay store de altas). */
function mockSummaryFrom(input: PieceCreateInput): PieceSummary {
  const codeI = input.code_i?.trim() || null;
  return {
    id: crypto.randomUUID(),
    denomination: input.denomination.trim(),
    collection: null,
    tenure_regime: input.tenure_regime,
    code_i: codeI,
    codes: codeI ? [{ identifier_type_code: "I", original_value: codeI, normalized_value: codeI }] : [],
    category: null,
    conservation_status: null,
    period_text: input.period?.text ?? null,
    location_label: null,
    media_count: 0,
    has_location: false,
    updated_at: new Date().toISOString(),
  };
}

/** Término del catálogo de fixtures por id (modo mock); `undefined` si el id no existe. */
function mockTermRef(id: string): PieceDetail["materials"][number] | undefined {
  const term = TERMS.find((candidate) => candidate.id === id);
  return term ? { id: term.id, code: term.code, label: term.label } : undefined;
}

/** Resuelve un id de término opcional: `undefined` = no cambia, `null` = se vacía, id desconocido = no cambia. */
function mockTermUpdate(
  currentValue: PieceDetail["materials"][number] | null,
  id: string | null | undefined,
): PieceDetail["materials"][number] | null {
  if (id === undefined) return currentValue;
  if (id === null) return null;
  return mockTermRef(id) ?? currentValue;
}

/** Respuesta simulada de `PUT /pieces/{id}` en modo mock: aplica solo los campos del editor. */
function mockApplyUpdate(current: PieceDetail, input: PieceUpdateInput): PieceDetail {
  const collectionId = input.collection_id;
  const collection =
    collectionId === undefined
      ? current.collection
      : collectionId === null
        ? null
        : (COLLECTIONS.find((candidate) => candidate.id === collectionId) ?? null);
  return {
    ...current,
    denomination: input.denomination ?? current.denomination,
    collection: collection && "name" in collection ? { id: collection.id, name: collection.name, acronym: collection.acronym } : null,
    category: mockTermUpdate(current.category, input.category_id),
    object_type: mockTermUpdate(current.object_type, input.object_type_term_id),
    acquisition_method: mockTermUpdate(current.acquisition_method, input.acquisition_method_term_id),
    availability: mockTermUpdate(current.availability, input.availability_term_id),
    lender_name: input.lender_name === undefined ? current.lender_name : input.lender_name,
    loan_agreement_ref: input.loan_agreement_ref === undefined ? current.loan_agreement_ref : input.loan_agreement_ref,
    entry_date: input.entry_date === undefined ? current.entry_date : input.entry_date,
    description: input.description === undefined ? current.description : input.description,
    provenance: input.provenance === undefined ? current.provenance : input.provenance,
    period: input.period ? { ...current.period, ...input.period } : current.period,
    dimensions_text: input.dimensions_text === undefined ? current.dimensions_text : input.dimensions_text,
    notes: input.notes === undefined ? current.notes : input.notes,
    author: input.author === undefined ? current.author : input.author,
    conservation_status: mockTermUpdate(current.conservation_status, input.conservation_state_id),
    materials: input.material_term_ids
      ? input.material_term_ids.map(mockTermRef).filter((term): term is NonNullable<typeof term> => term !== undefined)
      : current.materials,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Respuesta simulada de `POST /pieces/validate` en modo mock. Solo dos reglas de demostración
 * (denominación vacía y código I ya usado por otra pieza de los fixtures): la fuente de verdad
 * de las reglas es `validate_piece_payload()` en el servidor.
 */
function mockValidation(input: PieceCreateInput, pieceId: string | undefined): PieceValidationResult {
  const issues: PieceIssue[] = [];
  if (!input.denomination.trim()) {
    issues.push({ field: "denomination", code: "denomination_required", message: "La denominación es obligatoria.", severity: "error" });
  }
  const codeI = input.code_i?.trim().toUpperCase();
  if (codeI) {
    const owner = PIECES.find((piece) => piece.id !== pieceId && piece.code_i?.toUpperCase() === codeI);
    if (owner) {
      issues.push({
        field: "code_i",
        code: "duplicate_inventory_code",
        message: `El código I ${input.code_i?.trim()} ya pertenece a «${owner.denomination}».`,
        severity: "error",
      });
    }
  }
  return { is_valid: issues.every((issue) => issue.severity !== "error"), issues };
}

/** `POST /pieces`. En modo mock devuelve un resumen sintético y no conserva la pieza. */
export async function createPiece(input: PieceCreateInput): Promise<PieceCreateResult> {
  if (getApiMode() === "mock") return { status: "ok", piece: mockSummaryFrom(input) };
  try {
    const { data, error } = await client().POST("/api/v1/pieces", { body: input });
    if (error) return failureFrom(error);
    return { status: "ok", piece: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/**
 * `PUT /pieces/{piece_id}` (actualización parcial). Un 409 `edit_conflict` se informa como
 * `conflict`. Todavía no envía `If-Match`: la columna `version` y la precondición (409/428) llegan
 * con las tareas 1.1 y 2.2 del backend, y `PieceDetail` aún no expone `version`. En modo mock
 * nunca hay conflicto (una sola sesión).
 */
export async function updatePiece(id: string, input: PieceUpdateInput): Promise<PieceUpdateResult> {
  if (getApiMode() === "mock") {
    const current = getPieceDetail(id);
    if (!current) return { status: "rejected", code: "not_found", message: "La pieza no existe." };
    return { status: "ok", piece: mockApplyUpdate(current, input) };
  }
  try {
    const { data, error } = await client().PUT("/api/v1/pieces/{piece_id}", {
      params: { path: { piece_id: id } },
      body: input,
    });
    if (error) {
      if (isEditConflict(error)) return { status: "conflict", message: apiErrorMessage(error) };
      return failureFrom(error);
    }
    return { status: "ok", piece: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/**
 * `POST /pieces/validate` (RF-043): ejecuta las reglas del servidor sin persistir. Con `signal`
 * abortada (antes o durante la petición) devuelve `aborted`. Hoy el endpoint es un stub 501, que
 * se informa como `unavailable` (tarea 2.3 del backend).
 */
export async function validatePiece(input: PieceCreateInput, options: ValidatePieceOptions = {}): Promise<PieceValidationOutcome> {
  const { pieceId, signal } = options;
  if (signal?.aborted) return { status: "aborted" };
  if (getApiMode() === "mock") return { status: "ok", result: mockValidation(input, pieceId) };
  try {
    const { data, error } = await client().POST("/api/v1/pieces/validate", {
      params: { query: { piece_id: pieceId } },
      body: input,
      signal,
    });
    if (error) return failureFrom(error);
    return { status: "ok", result: data };
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) return { status: "aborted" };
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** Espera (ms) tras la última modificación antes de validar (design D1: ~400 ms). */
export const VALIDATION_DEBOUNCE_MS = 400;

export interface PieceValidator {
  /**
   * Programa una validación. Cada llamada cancela la anterior: el temporizador pendiente se
   * descarta y la petición en vuelo se aborta. Las llamadas reemplazadas resuelven `aborted`.
   */
  validate(input: PieceCreateInput, options?: { pieceId?: string }): Promise<PieceValidationOutcome>;
  /** Cancela la validación pendiente o en vuelo (p. ej. al desmontar el formulario). */
  cancel(): void;
}

export function createPieceValidator({ delayMs = VALIDATION_DEBOUNCE_MS }: { delayMs?: number } = {}): PieceValidator {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let supersede: (() => void) | undefined;

  function cancel(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    controller?.abort();
    controller = undefined;
    supersede?.();
    supersede = undefined;
  }

  function validate(input: PieceCreateInput, options: { pieceId?: string } = {}): Promise<PieceValidationOutcome> {
    cancel();
    return new Promise<PieceValidationOutcome>((resolve) => {
      supersede = () => resolve({ status: "aborted" });
      timer = setTimeout(() => {
        timer = undefined;
        const current = new AbortController();
        controller = current;
        void validatePiece(input, { pieceId: options.pieceId, signal: current.signal }).then((outcome) => {
          if (controller === current) {
            controller = undefined;
            supersede = undefined;
          }
          resolve(outcome);
        });
      }, delayMs);
    });
  }

  return { validate, cancel };
}

// ---------------------------------------------------------------------------------------------
// Catálogos del editor (design D8: materiales y estado de conservación)
// ---------------------------------------------------------------------------------------------

/** Una opción de un vocabulario: el `id` es el que viaja en `material_term_ids` / `conservation_state_id`. */
export interface TermOption {
  id: string;
  label: string;
}

export interface PieceFormCatalogs {
  collections: TermOption[];
  categories: TermOption[];
  objectTypes: TermOption[];
  acquisitionMethods: TermOption[];
  availabilities: TermOption[];
  materials: TermOption[];
  conservationStates: TermOption[];
}

/** Códigos de los vocabularios del seed que alimentan las listas del editor. */
export const MATERIAL_VOCABULARY = "MATERIAL";
export const CONSERVATION_VOCABULARY = "CONSERVATION_STATUS";
export const OBJECT_TYPE_VOCABULARY = "OBJECT_TYPE";
export const ACQUISITION_VOCABULARY = "ACQUISITION_METHOD";
export const AVAILABILITY_VOCABULARY = "AVAILABILITY";
export const CATEGORY_VOCABULARY = "CATEGORY";

function mockOptions(vocabularyCode: string): TermOption[] {
  return termsByVocabulary(vocabularyCode)
    .filter((term) => term.is_active)
    .map((term) => ({ id: term.id, label: term.label }));
}

function mockCollectionOptions(): TermOption[] {
  return COLLECTIONS.filter((collection) => collection.is_active).map((collection) => ({ id: collection.id, label: collection.name }));
}

/**
 * Catálogos con los que arranca el formulario. En modo mock salen de los fixtures al instante (el
 * primer render ya los tiene); en modo `live` empiezan vacíos hasta que `fetchPieceCatalogs` responda.
 */
export function initialPieceCatalogs(): PieceFormCatalogs {
  if (getApiMode() === "mock") {
    return {
      collections: mockCollectionOptions(),
      categories: mockOptions(CATEGORY_VOCABULARY),
      objectTypes: mockOptions(OBJECT_TYPE_VOCABULARY),
      acquisitionMethods: mockOptions(ACQUISITION_VOCABULARY),
      availabilities: mockOptions(AVAILABILITY_VOCABULARY),
      materials: mockOptions(MATERIAL_VOCABULARY),
      conservationStates: mockOptions(CONSERVATION_VOCABULARY),
    };
  }
  return { collections: [], categories: [], objectTypes: [], acquisitionMethods: [], availabilities: [], materials: [], conservationStates: [] };
}

export type PieceCatalogsResult = { status: "ok"; catalogs: PieceFormCatalogs } | { status: "unavailable"; message: string };

async function fetchTermOptions(vocabularyCode: string): Promise<TermOption[] | null> {
  const { data, error } = await client().GET("/api/v1/vocabularies/{vocabulary_code}/terms", {
    params: { path: { vocabulary_code: vocabularyCode } },
  });
  if (error) return null;
  return data.filter((term) => term.is_active).map((term) => ({ id: term.id, label: term.label }));
}

/** `GET /categories`: las categorías (tipologías) activas; el contrato las expone como términos. */
async function fetchCategoryOptions(): Promise<TermOption[] | null> {
  const { data, error } = await client().GET("/api/v1/categories", {});
  if (error) return null;
  return data.filter((term) => term.is_active).map((term) => ({ id: term.id, label: term.label }));
}

/** `GET /collections`: las colecciones activas. */
async function fetchCollectionOptions(): Promise<TermOption[] | null> {
  const { data, error } = await client().GET("/api/v1/collections", {});
  if (error) return null;
  return data.filter((collection) => collection.is_active).map((collection) => ({ id: collection.id, label: collection.name }));
}

/**
 * Carga las siete listas del editor: colecciones, categorías, tipos de bien, formas de adquisición,
 * disponibilidad, materiales y estados de conservación (solo elementos activos). Si una falla, se informa
 * `unavailable` y el formulario sigue usable con los valores que ya tiene la pieza.
 */
export async function fetchPieceCatalogs(): Promise<PieceCatalogsResult> {
  if (getApiMode() === "mock") return { status: "ok", catalogs: initialPieceCatalogs() };
  try {
    const [collections, categories, objectTypes, acquisitionMethods, availabilities, materials, conservationStates] = await Promise.all([
      fetchCollectionOptions(),
      fetchCategoryOptions(),
      fetchTermOptions(OBJECT_TYPE_VOCABULARY),
      fetchTermOptions(ACQUISITION_VOCABULARY),
      fetchTermOptions(AVAILABILITY_VOCABULARY),
      fetchTermOptions(MATERIAL_VOCABULARY),
      fetchTermOptions(CONSERVATION_VOCABULARY),
    ]);
    if (!collections || !categories || !objectTypes || !acquisitionMethods || !availabilities || !materials || !conservationStates) {
      return { status: "unavailable", message: "No se pudieron cargar todas las listas del formulario (colecciones, categorías, materiales…)." };
    }
    return {
      status: "ok",
      catalogs: { collections, categories, objectTypes, acquisitionMethods, availabilities, materials, conservationStates },
    };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

// ---------------------------------------------------------------------------------------------
// Eliminar, restaurar e identificadores (change ficha-pieza-crud, tarea 4.4)
// ---------------------------------------------------------------------------------------------

type IdentifierOut = ApiSchemas["IdentifierOut"];

/**
 * Cuerpo de `POST /pieces/{id}/identifiers`. `confirmed_split` (design D5) todavía no figura en
 * `IdentifierCreate` del contrato: el tipo lo añade aquí y el cuerpo lo envía igualmente. Pendiente
 * de backend/OpenAPI (tareas 3.1 y 5.2).
 */
export type IdentifierCreateInput = ApiSchemas["IdentifierCreate"] & { confirmed_split?: boolean };
/** Cuerpo de `POST .../identifiers/{identifier_id}/correction` (design D6). */
export type InventoryCodeCorrectionInput = ApiSchemas["InventoryCodeCorrection"];

/** Código de error 422 cuando el valor reune varios códigos (design D5). */
export const CONCATENATED_IDENTIFIER_CODE = "concatenated_identifier";

/** Un identificador propuesto por el servidor al separar un valor concatenado (nunca se separa solo). */
export interface SplitProposal {
  identifier_type_code: string;
  original_value: string;
  normalized_value: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Lee `details.proposals` de un 422 `concatenated_identifier`. La forma de cada propuesta no está
 * en el contrato (solo en design D5: tipo, valor original, normalizado); si no coincide con
 * `identifier_type_code` / `original_value` / `normalized_value`, devuelve `[]` y el error se
 * muestra como un rechazo normal en lugar de proponer algo inventado.
 */
export function parseSplitProposals(details: unknown): SplitProposal[] {
  const raw = isRecord(details) ? details.proposals : undefined;
  if (!Array.isArray(raw)) return [];
  const proposals: SplitProposal[] = [];
  for (const item of raw) {
    if (!isRecord(item)) return [];
    const { identifier_type_code: type, original_value: value, normalized_value: normalized } = item;
    if (typeof type !== "string" || typeof value !== "string") return [];
    proposals.push({ identifier_type_code: type, original_value: value, normalized_value: typeof normalized === "string" ? normalized : null });
  }
  return proposals;
}

const PIECE_MISSING: PieceWriteFailure = { status: "rejected", code: "not_found", message: "La pieza no existe." };

/** Resultado de una operación sin datos de vuelta (`DELETE` responde 204). */
export type PieceActionResult = { status: "ok" } | PieceWriteFailure;
export type PieceRestoreResult = { status: "ok"; piece: PieceDetail } | PieceWriteFailure;
/** `needs_split`: 422 `concatenated_identifier`; hay que mostrar las propuestas y pedir confirmación. */
export type IdentifierAddResult =
  | { status: "ok"; identifier: IdentifierOut }
  | { status: "needs_split"; message: string; proposals: SplitProposal[] }
  | PieceWriteFailure;
export type InventoryCorrectionResult = { status: "ok"; identifier: IdentifierOut } | PieceWriteFailure;
/**
 * Registro de varios identificadores confirmados por separado. No es atómico (cada uno es una
 * petición): si uno falla, `identifiers` trae los que ya quedaron registrados.
 */
export type SplitIdentifiersResult =
  | { status: "ok"; identifiers: IdentifierOut[] }
  | { status: "failed"; identifiers: IdentifierOut[]; failedValue: string; failure: PieceWriteFailure };

function normalizedForMock(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Identificador sintético del modo mock (no se conserva en ningún store). */
function mockIdentifier(pieceId: string, input: Pick<IdentifierCreateInput, "identifier_type_code" | "value" | "source" | "notes">): IdentifierOut {
  return {
    id: crypto.randomUUID(),
    piece_id: pieceId,
    identifier_type_code: input.identifier_type_code,
    original_value: input.value.trim(),
    normalized_value: normalizedForMock(input.value),
    detected_format: null,
    normalization_status: "NORMALIZED",
    is_current: true,
    is_locked: input.identifier_type_code === "I",
    notes: input.notes ?? null,
    source: input.source ?? null,
    recorded_at: new Date().toISOString(),
    replaced_by_id: null,
  };
}

/** Detección de concatenados del modo mock: solo separa por «/» o «;». El normalizador real es del servidor. */
function mockSplitProposals(value: string): SplitProposal[] {
  const parts = value
    .split(/[/;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  return parts.map((part) => ({
    identifier_type_code: /^I[\s.-]?\d/i.test(part) ? "I" : "COLLECTION",
    original_value: part,
    normalized_value: normalizedForMock(part),
  }));
}

/**
 * `DELETE /pieces/{piece_id}?reason=...` (eliminación lógica, RN-005). El contrato manda el motivo
 * como *query*, no en el cuerpo que describe design D7. Sin motivo no se llama a la API.
 */
export async function deletePiece(id: string, reason: string): Promise<PieceActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) return { status: "rejected", code: "validation_failed", message: "Indique el motivo de la eliminación." };
  if (getApiMode() === "mock") return getPieceDetail(id) ? { status: "ok" } : PIECE_MISSING;
  try {
    const { error } = await client().DELETE("/api/v1/pieces/{piece_id}", {
      params: { path: { piece_id: id }, query: { reason: trimmed } },
    });
    if (error) return failureFrom(error);
    return { status: "ok" };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** `POST /pieces/{piece_id}/restore` (motivo opcional, como *query* según el contrato). 409 si el código I ya lo usa otra pieza activa. */
export async function restorePiece(id: string, reason?: string | null): Promise<PieceRestoreResult> {
  const trimmed = reason?.trim() || undefined;
  if (getApiMode() === "mock") {
    const current = getPieceDetail(id);
    return current ? { status: "ok", piece: current } : PIECE_MISSING;
  }
  try {
    const { data, error } = await client().POST("/api/v1/pieces/{piece_id}/restore", {
      params: { path: { piece_id: id }, query: { reason: trimmed } },
    });
    if (error) return failureFrom(error);
    return { status: "ok", piece: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/**
 * `POST /pieces/{piece_id}/identifiers`. Un 422 `concatenated_identifier` con propuestas legibles se
 * informa como `needs_split`; el cliente nunca separa por su cuenta (RF-023). En modo mock la
 * detección es una simulación simple y no se conserva nada.
 */
export async function addIdentifier(pieceId: string, input: IdentifierCreateInput): Promise<IdentifierAddResult> {
  if (getApiMode() === "mock") {
    if (!getPieceDetail(pieceId)) return PIECE_MISSING;
    if (!input.value.trim()) return { status: "rejected", code: "validation_failed", message: "Escriba el código que quiere registrar." };
    if (!input.confirmed_split) {
      const proposals = mockSplitProposals(input.value);
      if (proposals.length > 0) {
        return { status: "needs_split", message: "El valor parece reunir varios códigos; confirme cómo separarlos.", proposals };
      }
    }
    return { status: "ok", identifier: mockIdentifier(pieceId, input) };
  }
  try {
    const { data, error } = await client().POST("/api/v1/pieces/{piece_id}/identifiers", {
      params: { path: { piece_id: pieceId } },
      body: input,
    });
    if (error) {
      if ((error as { code?: unknown }).code === CONCATENATED_IDENTIFIER_CODE) {
        const proposals = parseSplitProposals((error as { details?: unknown }).details);
        if (proposals.length > 0) return { status: "needs_split", message: apiErrorMessage(error), proposals };
      }
      return failureFrom(error);
    }
    return { status: "ok", identifier: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/**
 * Registra **cada** propuesta por separado con `confirmed_split: true` (design D5), en orden y
 * deteniéndose en el primer fallo. Solo se llama tras la confirmación explícita de la persona.
 */
export async function registerSplitIdentifiers(
  pieceId: string,
  proposals: readonly SplitProposal[],
  extras: { source?: string | null; notes?: string | null } = {},
): Promise<SplitIdentifiersResult> {
  const identifiers: IdentifierOut[] = [];
  for (const proposal of proposals) {
    const result = await addIdentifier(pieceId, {
      identifier_type_code: proposal.identifier_type_code,
      value: proposal.original_value,
      source: extras.source ?? null,
      notes: extras.notes ?? null,
      confirmed_split: true,
    });
    if (result.status === "ok") {
      identifiers.push(result.identifier);
      continue;
    }
    const failure: PieceWriteFailure =
      result.status === "needs_split" ? { status: "rejected", code: CONCATENATED_IDENTIFIER_CODE, message: result.message } : result;
    return { status: "failed", identifiers, failedValue: proposal.original_value, failure };
  }
  return { status: "ok", identifiers };
}

/**
 * `POST /pieces/{piece_id}/identifiers/{identifier_id}/correction` (design D6; permiso
 * `identifiers.correct_inventory_code`). 409 con `details` si el nuevo valor es de otra pieza.
 */
export async function correctInventoryCode(
  pieceId: string,
  identifierId: string,
  input: InventoryCodeCorrectionInput,
): Promise<InventoryCorrectionResult> {
  const newValue = input.new_value.trim();
  const reason = input.reason.trim();
  if (!newValue || !reason) {
    return { status: "rejected", code: "validation_failed", message: "Indique el código I nuevo y el motivo de la corrección." };
  }
  if (getApiMode() === "mock") {
    if (!getPieceDetail(pieceId)) return PIECE_MISSING;
    const owner = PIECES.find((piece) => piece.id !== pieceId && piece.code_i?.toUpperCase() === newValue.toUpperCase());
    if (owner) {
      return {
        status: "rejected",
        code: "duplicate_inventory_code",
        message: `El código I ${newValue} ya pertenece a «${owner.denomination}».`,
        details: { piece_id: owner.id },
      };
    }
    return { status: "ok", identifier: mockIdentifier(pieceId, { identifier_type_code: "I", value: newValue }) };
  }
  try {
    const { data, error } = await client().POST("/api/v1/pieces/{piece_id}/identifiers/{identifier_id}/correction", {
      params: { path: { piece_id: pieceId, identifier_id: identifierId } },
      body: { new_value: newValue, reason },
    });
    if (error) return failureFrom(error);
    return { status: "ok", identifier: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}
