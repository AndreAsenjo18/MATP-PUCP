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
  | { status: "rejected"; code: string; message: string }
  | { status: "unavailable"; message: string };

export type PieceCreateResult = { status: "ok"; piece: PieceSummary } | PieceWriteFailure;
export type PieceUpdateResult = { status: "ok"; piece: PieceDetail } | PieceWriteFailure;
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
  return { status: "rejected", code: typeof code === "string" ? code : "error", message: apiErrorMessage(error) };
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
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

/** Respuesta simulada de `PUT /pieces/{id}` en modo mock: aplica solo los campos de texto del editor. */
function mockApplyUpdate(current: PieceDetail, input: PieceUpdateInput): PieceDetail {
  return {
    ...current,
    denomination: input.denomination ?? current.denomination,
    description: input.description === undefined ? current.description : input.description,
    provenance: input.provenance === undefined ? current.provenance : input.provenance,
    dimensions_text: input.dimensions_text === undefined ? current.dimensions_text : input.dimensions_text,
    notes: input.notes === undefined ? current.notes : input.notes,
    author: input.author === undefined ? current.author : input.author,
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
 * `PUT /pieces/{piece_id}` (actualización parcial). Todavía no envía `If-Match`: la columna
 * `version` y el 409/428 llegan con las tareas 1.1 y 2.2 del backend; el conflicto es la 4.3.
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
    if (error) return failureFrom(error);
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
