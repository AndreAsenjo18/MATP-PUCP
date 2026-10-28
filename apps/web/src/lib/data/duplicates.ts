/**
 * Capa de datos de la cola de duplicados consciente del modo (change
 * `deteccion-duplicados-y-cola-revision`, tarea 4.1; spec calidad-datos, RF-030).
 *
 * En modo `live` usa el cliente tipado contra `GET /quality/duplicates`, `POST
 * /quality/duplicates/{candidate_id}/resolve`, `POST /quality/duplicates/scan`, `GET
 * /quality/jobs/{job_id}`, `GET /pieces/{piece_id}` y `GET /collections`. Cada llamada envía como
 * identidad provisional (`X-MATP-User`, ADR-005) el correo del usuario de la sesión simulada,
 * que coincide con los usuarios sintéticos del seed; la autenticación real la aporta
 * `autenticacion-y-matriz-permisos`.
 *
 * En modo `mock` responde con los fixtures (spec plataforma, «Recorrido completo sin backend»):
 * las resoluciones se recuerdan solo en memoria mientras dure la pestaña y nunca se guardan.
 *
 * Los errores 409 y 422 de la API llegan como `rejected` con un mensaje claro en español
 * (`DUPLICATE_ERROR_MESSAGES`); `stale_candidate` y `candidate_closed` indican que el par ya no
 * se puede resolver y la pantalla debe recargar la cola.
 *
 * Fusión (tarea 4.2, design D4): `resolveDuplicate` con `resolution: "MERGED"` envía la pieza
 * conservada, `field_choices` y el motivo obligatorio. Los bloqueos (regímenes distintos, códigos I
 * distintos, código I solo en la absorbida) llegan como 409 con su mensaje. `fetchPieceSheet` lee la
 * ficha con la identidad de la sesión para mostrar `merged_into` y `merged_from`.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";

import { plainMessage } from "./imports";
import { COLLECTIONS, DUPLICATE_CANDIDATES, getPieceDetail } from "@/lib/fixtures";

import { mergeBlock, mergeReasonError, survivorRestriction, type MergeChoice } from "./merge-plan";
import { apiBaseUrl, getApiMode } from "./mode";

export type DuplicateCandidate = ApiSchemas["DuplicateCandidateOut"];
export type DuplicateStatus = ApiSchemas["DuplicateStatus"];
export type QualityJob = ApiSchemas["QualityJobOut"];
type PieceDetail = ApiSchemas["PieceDetail"];
type CollectionOut = ApiSchemas["CollectionOut"];

/** Origen del par: dos piezas del catálogo o una fila de importación (contrato v1). */
export type DuplicateOrigin = "CATALOG" | "IMPORT";

export interface DuplicateQueueFilters {
  status?: DuplicateStatus;
  collectionId?: string;
  /** Entre 0 y 1. */
  minScore?: number;
  origin?: DuplicateOrigin;
  page?: number;
  pageSize?: number;
}

export interface DuplicatePage {
  items: DuplicateCandidate[];
  total: number;
  page: number;
  pageSize: number;
}

/** Pares por página de la cola: cada par pide hasta dos fichas para la comparación. */
export const DUPLICATE_PAGE_SIZE = 10;
/** Máximo para posponer un par (design D5) [SUPUESTO: F3, G8]. */
export const MAX_POSTPONE_DAYS = 180;

export const STALE_CANDIDATE_CODE = "stale_candidate";
export const CANDIDATE_CLOSED_CODE = "candidate_closed";
export const SCAN_IN_PROGRESS_CODE = "scan_in_progress";

/**
 * Mensajes de la pantalla para los errores conocidos de la cola. Los demás usan el mensaje que
 * envía la API.
 */
export const DUPLICATE_ERROR_MESSAGES: Record<string, string> = {
  [STALE_CANDIDATE_CODE]:
    "Una de las piezas ya fue fusionada con otra o dada de baja: el par quedó como reemplazado y no se modificó ninguna pieza.",
  [CANDIDATE_CLOSED_CODE]: "Este par ya se cerró con una fusión o fue reemplazado: no se puede cambiar su resolución.",
  postponed_until_required: "Indique hasta qué fecha se pospone la revisión.",
  postponed_until_in_past: "La fecha para posponer debe ser posterior a hoy.",
  postpone_too_long: `Solo se puede posponer hasta ${MAX_POSTPONE_DAYS} días.`,
  [SCAN_IN_PROGRESS_CODE]: "Ya hay una detección completa en curso: se muestra su avance.",
  permission_denied: "Su rol no tiene permiso para resolver duplicados.",
  merge_blocked_tenure: "Las piezas tienen regímenes de tenencia distintos: primero corrija el régimen de una de ellas. No se fusionó nada.",
  merge_blocked_inventory_code:
    "Las dos piezas tienen códigos I vigentes distintos: corrija primero el código I con el procedimiento auditado. No se fusionó nada.",
  merge_surviving_must_hold_inventory_code:
    "Solo la pieza que iba a absorberse tiene código I vigente: conserve esa pieza, porque un código I nunca cambia de pieza. No se fusionó nada.",
  merge_reason_required: "Indique el motivo de la fusión (al menos 3 caracteres): queda en la auditoría.",
  merge_requires_two_pieces: "Una fila de importación no se fusiona desde la cola: se decide en su lote de importación.",
  surviving_not_in_pair: "Elija cuál de las dos piezas del par se conserva.",
  unknown_merge_fields: "Uno de los campos elegidos ya no se puede fusionar. Recargue la cola e intente nuevamente.",
  invalid_period_range: "La época que resultaría de la fusión es incoherente (el año desde es mayor que el año hasta): elija la época completa de una sola pieza.",
};

export type DuplicateFailure =
  | { status: "rejected"; code: string; message: string; details?: Record<string, unknown> }
  | { status: "unavailable"; message: string };

export type DuplicateQueueResult = { status: "ok"; page: DuplicatePage } | DuplicateFailure;
export type DuplicateResolveResult = { status: "ok"; candidate: DuplicateCandidate } | DuplicateFailure;
/** `running`: ya había una detección en curso (409); se sigue esa en vez de lanzar otra. */
export type DuplicateScanResult = { status: "ok"; job: QualityJob } | { status: "running"; job: QualityJob; message: string } | DuplicateFailure;
export type QualityJobResult = { status: "ok"; job: QualityJob } | DuplicateFailure;

export type DuplicateResolutionInput =
  | { resolution: "DISTINCT"; note: string }
  | { resolution: "POSTPONED"; postponedUntil: string; note?: string | null }
  | { resolution: "MERGED"; survivingPieceId: string; fieldChoices: Partial<Record<string, MergeChoice>>; note: string };

export type PieceSheetResult = { status: "ok"; piece: PieceDetail } | { status: "not_found" } | DuplicateFailure;

const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Mensaje de un error de la cola: el propio para los códigos conocidos, si no el de la API. */
export function duplicateErrorMessage(code: string, details?: Record<string, unknown>, fallback?: string): string {
  if (code === "postpone_too_long" && typeof details?.max_days === "number") {
    return `Solo se puede posponer hasta ${details.max_days} días.`;
  }
  return DUPLICATE_ERROR_MESSAGES[code] ?? fallback ?? "No se pudo completar la operación. Intente nuevamente.";
}

function failureFrom(error: unknown): DuplicateFailure {
  if (isNotImplemented(error)) return { status: "unavailable", message: plainMessage(apiErrorMessage(error)) };
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "error";
  const details = isRecord(error) && isRecord(error.details) ? error.details : undefined;
  return {
    status: "rejected",
    code,
    message: duplicateErrorMessage(code, details, plainMessage(apiErrorMessage(error))),
    ...(details ? { details } : {}),
  };
}

/** True cuando el par ya no admite resolución y la cola debe recargarse (design D4). */
export function isClosedPairFailure(result: { status: string; code?: string }): boolean {
  return result.status === "rejected" && (result.code === STALE_CANDIDATE_CODE || result.code === CANDIDATE_CLOSED_CODE);
}

// ---------------------------------------------------------------------------------------------
// Modo mock: fixtures y resoluciones en memoria (no se guarda nada)
// ---------------------------------------------------------------------------------------------

const mockResolutions = new Map<string, DuplicateCandidate>();

/** Olvida las resoluciones simuladas (pruebas). */
export function resetMockDuplicates(): void {
  mockResolutions.clear();
}

function mockCandidates(): DuplicateCandidate[] {
  return DUPLICATE_CANDIDATES.map((candidate) => mockResolutions.get(candidate.id) ?? candidate);
}

/** Colección y sus subcolecciones, como el filtro de la API. */
function collectionFamily(collectionId: string): Set<string> {
  const family = new Set([collectionId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const collection of COLLECTIONS) {
      if (collection.parent_id && family.has(collection.parent_id) && !family.has(collection.id)) {
        family.add(collection.id);
        grew = true;
      }
    }
  }
  return family;
}

function mockQueue(filters: DuplicateQueueFilters): DuplicatePage {
  const family = filters.collectionId ? collectionFamily(filters.collectionId) : null;
  const inFamily = (pieceId: string | null) => {
    const collection = pieceId ? getPieceDetail(pieceId)?.collection : undefined;
    return collection ? family?.has(collection.id) === true : false;
  };
  const items = mockCandidates()
    .filter((c) => !filters.status || c.status === filters.status)
    .filter((c) => filters.minScore == null || c.score >= filters.minScore)
    .filter((c) => !filters.origin || (filters.origin === "CATALOG" ? c.piece_b_id !== null : c.import_row_id !== null))
    .filter((c) => !family || inFamily(c.piece_a_id) || inFamily(c.piece_b_id))
    .sort((a, b) => b.score - a.score);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DUPLICATE_PAGE_SIZE;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

function mockResolve(candidateId: string, input: DuplicateResolutionInput): DuplicateResolveResult {
  const current = mockCandidates().find((c) => c.id === candidateId);
  if (!current) return { status: "rejected", code: "not_found", message: "No existe ese candidato a duplicado." };
  if (current.status === "MERGED" || current.status === "SUPERSEDED") {
    return { status: "rejected", code: CANDIDATE_CLOSED_CODE, message: duplicateErrorMessage(CANDIDATE_CLOSED_CODE) };
  }
  if (input.resolution === "POSTPONED") {
    const problem = postponementError(input.postponedUntil, new Date());
    if (problem) return { status: "rejected", code: problem.code, message: problem.message };
  }
  if (input.resolution === "MERGED") return mockMerge(current, input);
  const resolved: DuplicateCandidate = {
    ...current,
    status: input.resolution,
    postponed_until: input.resolution === "POSTPONED" ? input.postponedUntil : null,
    resolution_note: input.note?.trim() || null,
    reviewed_at: new Date().toISOString(),
  };
  mockResolutions.set(candidateId, resolved);
  return { status: "ok", candidate: resolved };
}

function rejected(code: string): DuplicateFailure {
  return { status: "rejected", code, message: duplicateErrorMessage(code) };
}

/**
 * Fusión simulada: aplica los mismos bloqueos que la API sobre las fichas de los fixtures y solo
 * cambia el estado de los pares en memoria (no modifica ninguna ficha).
 */
function mockMerge(current: DuplicateCandidate, input: Extract<DuplicateResolutionInput, { resolution: "MERGED" }>): DuplicateResolveResult {
  const pieceA = getPieceDetail(current.piece_a_id);
  const pieceB = current.piece_b_id ? getPieceDetail(current.piece_b_id) : undefined;
  const block = mergeBlock(current, pieceA, pieceB);
  if (block) return rejected(block.code);
  if (!pieceA || !pieceB) return rejected(STALE_CANDIDATE_CODE);
  if (input.survivingPieceId !== pieceA.id && input.survivingPieceId !== pieceB.id) return rejected("surviving_not_in_pair");
  if (mergeReasonError(input.note)) return rejected("merge_reason_required");
  if (survivorRestriction(input.survivingPieceId, pieceA, pieceB)) return rejected("merge_surviving_must_hold_inventory_code");

  const absorbedId = input.survivingPieceId === pieceA.id ? pieceB.id : pieceA.id;
  const now = new Date().toISOString();
  const merged: DuplicateCandidate = { ...current, status: "MERGED", postponed_until: null, resolution_note: input.note.trim(), reviewed_at: now };
  mockResolutions.set(current.id, merged);
  for (const other of mockCandidates()) {
    const touchesAbsorbed = other.piece_a_id === absorbedId || other.piece_b_id === absorbedId;
    if (other.id !== current.id && touchesAbsorbed && other.status !== "MERGED" && other.status !== "SUPERSEDED") {
      mockResolutions.set(other.id, { ...other, status: "SUPERSEDED", reviewed_at: now });
    }
  }
  return { status: "ok", candidate: merged };
}

function mockScanJob(): QualityJob {
  const now = new Date().toISOString();
  return {
    id: "0f1c0000-0000-7000-0013-000000000001",
    job_type: "FULL_SCAN",
    status: "SUCCEEDED",
    requested_by_id: null,
    started_at: now,
    heartbeat_at: now,
    finished_at: now,
    total_pieces: 0,
    processed_pieces: 0,
    pairs_evaluated: 0,
    candidates_created: 0,
    candidates_reopened: 0,
    duration_ms: 0,
    error_message: null,
  };
}

// ---------------------------------------------------------------------------------------------
// Reglas de posposición (las mismas que valida la API; design D5)
// ---------------------------------------------------------------------------------------------

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** `YYYY-MM-DD` de una fecha local, para `<input type="date">`. */
export function toDateInput(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fechas admitidas al posponer: desde mañana hasta hoy + 180 días; 30 días por defecto. */
export function postponeBounds(today: Date): { min: string; max: string; suggested: string } {
  const start = dayStart(today);
  return {
    min: toDateInput(addDays(start, 1)),
    max: toDateInput(addDays(start, MAX_POSTPONE_DAYS)),
    suggested: toDateInput(addDays(start, 30)),
  };
}

/** Inicio del día local elegido, en ISO 8601, como lo espera `postponed_until`. */
export function postponedUntilFromDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime()) || toDateInput(date) !== value.trim()) return null;
  return date.toISOString();
}

/** `null` si la fecha (ISO) se puede usar para posponer; si no, el código y mensaje de la API. */
export function postponementError(postponedUntil: string | null, now: Date): { code: string; message: string } | null {
  const fail = (code: string) => ({ code, message: duplicateErrorMessage(code) });
  if (!postponedUntil) return fail("postponed_until_required");
  const until = new Date(postponedUntil);
  if (Number.isNaN(until.getTime())) return fail("postponed_until_required");
  if (until <= now) return fail("postponed_until_in_past");
  if (until > addDays(now, MAX_POSTPONE_DAYS)) return fail("postpone_too_long");
  return null;
}

// ---------------------------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------------------------

/** `GET /quality/duplicates`: pares de mayor a menor puntaje con los filtros de la cola (RF-030). */
export async function fetchDuplicateQueue(filters: DuplicateQueueFilters, devUser?: string): Promise<DuplicateQueueResult> {
  if (getApiMode() === "mock") return { status: "ok", page: mockQueue(filters) };
  try {
    const { data, error } = await client(devUser).GET("/api/v1/quality/duplicates", {
      params: {
        query: {
          status: filters.status,
          collection_id: filters.collectionId,
          min_score: filters.minScore,
          origin: filters.origin,
          page: filters.page ?? 1,
          page_size: filters.pageSize ?? DUPLICATE_PAGE_SIZE,
        },
      },
    });
    if (error) return failureFrom(error);
    return { status: "ok", page: { items: data.items, total: data.total, page: data.page, pageSize: data.page_size } };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/**
 * Fichas de las piezas que se comparan (`GET /pieces/{piece_id}` en paralelo). Una pieza que no se
 * puede leer queda como `null` y la tarjeta lo indica; no falla la cola entera.
 */
export async function fetchComparedPieces(pieceIds: readonly string[], devUser?: string): Promise<Record<string, PieceDetail | null>> {
  const unique = [...new Set(pieceIds)];
  if (getApiMode() === "mock") return Object.fromEntries(unique.map((id) => [id, getPieceDetail(id) ?? null]));
  const api = client(devUser);
  const entries = await Promise.all(
    unique.map(async (id): Promise<[string, PieceDetail | null]> => {
      try {
        const { data } = await api.GET("/api/v1/pieces/{piece_id}", { params: { path: { piece_id: id } } });
        return [id, data ?? null];
      } catch {
        return [id, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Ficha de una pieza con la identidad de la sesión (`GET /pieces/{piece_id}`), incluida una pieza
 * fusionada, que responde con `merged_into` en vez de 404 (tarea 3.4).
 */
export async function fetchPieceSheet(pieceId: string, devUser?: string): Promise<PieceSheetResult> {
  if (getApiMode() === "mock") {
    const piece = getPieceDetail(pieceId);
    return piece ? { status: "ok", piece } : { status: "not_found" };
  }
  try {
    const { data, error } = await client(devUser).GET("/api/v1/pieces/{piece_id}", { params: { path: { piece_id: pieceId } } });
    if (error) {
      const failure = failureFrom(error);
      return failure.status === "rejected" && failure.code === "not_found" ? { status: "not_found" } : failure;
    }
    return { status: "ok", piece: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** Colecciones para el filtro (`GET /collections`); vacío si no se pueden leer. */
export async function fetchDuplicateCollections(devUser?: string): Promise<CollectionOut[]> {
  if (getApiMode() === "mock") return COLLECTIONS;
  try {
    const { data } = await client(devUser).GET("/api/v1/collections", {});
    return data ?? [];
  } catch {
    return [];
  }
}

type ResolutionBody = NonNullable<ApiSchemas["DuplicateResolution"]>;

function resolutionBody(input: DuplicateResolutionInput): ResolutionBody {
  switch (input.resolution) {
    case "DISTINCT":
      return { resolution: input.resolution, note: input.note.trim() || null };
    case "POSTPONED":
      return { resolution: input.resolution, postponed_until: input.postponedUntil, note: input.note?.trim() || null };
    case "MERGED": {
      const fieldChoices: Record<string, MergeChoice> = {};
      for (const [field, choice] of Object.entries(input.fieldChoices)) if (choice) fieldChoices[field] = choice;
      return { resolution: input.resolution, surviving_piece_id: input.survivingPieceId, field_choices: fieldChoices, note: input.note.trim() };
    }
  }
}

/**
 * `POST /quality/duplicates/{candidate_id}/resolve`: distinto o pospuesto (design D5) o fusión con
 * la pieza conservada, `field_choices` y motivo (design D4).
 */
export async function resolveDuplicate(candidateId: string, input: DuplicateResolutionInput, devUser?: string): Promise<DuplicateResolveResult> {
  if (getApiMode() === "mock") return mockResolve(candidateId, input);
  const body = resolutionBody(input);
  try {
    const { data, error } = await client(devUser).POST("/api/v1/quality/duplicates/{candidate_id}/resolve", {
      params: { path: { candidate_id: candidateId } },
      body,
    });
    if (error) return failureFrom(error);
    return { status: "ok", candidate: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

function isQualityJob(value: unknown): value is QualityJob {
  return isRecord(value) && typeof value.id === "string" && typeof value.status === "string";
}

/** `POST /quality/duplicates/scan`; con 409 `scan_in_progress` devuelve la detección en curso (design D3). */
export async function startDuplicateScan(devUser?: string): Promise<DuplicateScanResult> {
  if (getApiMode() === "mock") return { status: "ok", job: mockScanJob() };
  try {
    const { data, error } = await client(devUser).POST("/api/v1/quality/duplicates/scan", {});
    if (error) {
      const failure = failureFrom(error);
      if (failure.status === "rejected" && failure.code === SCAN_IN_PROGRESS_CODE && isQualityJob(failure.details?.job)) {
        return { status: "running", job: failure.details.job, message: failure.message };
      }
      return failure;
    }
    return { status: "ok", job: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** `GET /quality/jobs/{job_id}`: estado y avance de una detección completa. */
export async function fetchQualityJob(jobId: string, devUser?: string): Promise<QualityJobResult> {
  if (getApiMode() === "mock") return { status: "ok", job: { ...mockScanJob(), id: jobId } };
  try {
    const { data, error } = await client(devUser).GET("/api/v1/quality/jobs/{job_id}", { params: { path: { job_id: jobId } } });
    if (error) return failureFrom(error);
    return { status: "ok", job: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}
