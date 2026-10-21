import { afterEach, describe, expect, it, vi } from "vitest";

import { DUPLICATE_CANDIDATES, ids } from "@/lib/fixtures";

import {
  MAX_POSTPONE_DAYS,
  fetchComparedPieces,
  fetchDuplicateQueue,
  fetchPieceSheet,
  fetchQualityJob,
  isClosedPairFailure,
  postponeBounds,
  postponedUntilFromDate,
  postponementError,
  resetMockDuplicates,
  resolveDuplicate,
  startDuplicateScan,
  type QualityJob,
} from "./duplicates";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).

const BASE_URL = "http://api.test";
const DEV_USER = "curadora@matp.local";
const DAY = 24 * 60 * 60 * 1000;

type FetchHandler = (request: Request) => Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: FetchHandler) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestAt(fetchMock: { mock: { calls: Array<[Request]> } }, index = 0): Request {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch no recibió la llamada ${index}`);
  return call[0];
}

const JOB: QualityJob = {
  id: "01920000-0000-7000-8000-000000000921",
  job_type: "FULL_SCAN",
  status: "RUNNING",
  requested_by_id: null,
  started_at: "2026-10-20T10:00:00Z",
  heartbeat_at: "2026-10-20T10:00:05Z",
  finished_at: null,
  total_pieces: 298,
  processed_pieces: 120,
  pairs_evaluated: 610,
  candidates_created: 0,
  candidates_reopened: 0,
  duration_ms: null,
  error_message: null,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetMockDuplicates();
});

describe("cola de duplicados (modo mock)", () => {
  it("filtra por estado, origen y puntaje sin llamar a la red, de mayor a menor puntaje", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const pending = await fetchDuplicateQueue({ status: "PENDING" });
    expect(pending.status).toBe("ok");
    if (pending.status !== "ok") return;
    expect(pending.page.items.every((c) => c.status === "PENDING")).toBe(true);
    const scores = pending.page.items.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));

    const imported = await fetchDuplicateQueue({ origin: "IMPORT" });
    expect(imported.status === "ok" && imported.page.items.every((c) => c.import_row_id !== null)).toBe(true);
    const strong = await fetchDuplicateQueue({ minScore: 0.9 });
    expect(strong.status === "ok" && strong.page.items.map((c) => c.id)).toEqual([ids.duplicate(1)]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filtra por colección incluyendo sus subcolecciones", async () => {
    const mmz = await fetchDuplicateQueue({ collectionId: ids.collection(1) });
    expect(mmz.status === "ok" && mmz.page.items.map((c) => c.id)).toEqual([ids.duplicate(1)]);
    const none = await fetchDuplicateQueue({ collectionId: ids.collection(5) });
    expect(none.status === "ok" && none.page.total).toBe(0);
  });

  it("recuerda una resolución solo en memoria y rechaza fechas fuera de rango", async () => {
    const target = DUPLICATE_CANDIDATES.find((c) => c.status === "PENDING")!;
    const tooFar = new Date(Date.now() + (MAX_POSTPONE_DAYS + 2) * DAY).toISOString();
    const rejected = await resolveDuplicate(target.id, { resolution: "POSTPONED", postponedUntil: tooFar });
    expect(rejected).toMatchObject({ status: "rejected", code: "postpone_too_long" });

    const distinct = await resolveDuplicate(target.id, { resolution: "DISTINCT", note: "  Piezas distintas  " });
    expect(distinct).toMatchObject({ status: "ok", candidate: { status: "DISTINCT", resolution_note: "Piezas distintas" } });
    const pending = await fetchDuplicateQueue({ status: "PENDING" });
    expect(pending.status === "ok" && pending.page.items.some((c) => c.id === target.id)).toBe(false);
  });

  it("simula la fusión con los mismos bloqueos que la API y la recuerda solo en memoria", async () => {
    const pair = DUPLICATE_CANDIDATES[0]; // «Toro de Pucará» (I-0236) y «Toro de Pucará (3 cuernos)»
    const merge = (survivingPieceId: string, note = "Misma pieza") =>
      resolveDuplicate(pair.id, { resolution: "MERGED", survivingPieceId, fieldChoices: { provenance: "ABSORBED" }, note });
    expect(await merge(ids.piece(2))).toMatchObject({ status: "rejected", code: "merge_surviving_must_hold_inventory_code" });
    expect(await merge(ids.piece(1), "no")).toMatchObject({ status: "rejected", code: "merge_reason_required" });
    const importRow = DUPLICATE_CANDIDATES.find((c) => c.import_row_id !== null)!;
    expect(await resolveDuplicate(importRow.id, { resolution: "MERGED", survivingPieceId: ids.piece(9), fieldChoices: {}, note: "Misma pieza" })).toMatchObject({
      status: "rejected",
      code: "merge_requires_two_pieces",
    });

    expect(await merge(ids.piece(1))).toMatchObject({ status: "ok", candidate: { status: "MERGED", resolution_note: "Misma pieza" } });
    const merged = await fetchDuplicateQueue({ status: "MERGED" });
    expect(merged.status === "ok" && merged.page.items.map((c) => c.id)).toEqual([pair.id]);
    expect(await merge(ids.piece(1))).toMatchObject({ status: "rejected", code: "candidate_closed" });
  });

  it("las fichas comparadas salen de los fixtures; una pieza desconocida queda en null", async () => {
    const pieces = await fetchComparedPieces([ids.piece(1), ids.piece(1), "desconocida"]);
    expect(Object.keys(pieces)).toHaveLength(2);
    expect(pieces[ids.piece(1)]?.denomination).toBe("Toro de Pucará");
    expect(pieces.desconocida).toBeNull();
  });
});

describe("cola de duplicados (modo live)", () => {
  it("envía los filtros del contrato y la identidad provisional de la sesión", async () => {
    const fetchMock = useLive(async () => json(200, { items: [], total: 0, page: 2, page_size: 10 }));
    const result = await fetchDuplicateQueue(
      { status: "POSTPONED", collectionId: ids.collection(2), minScore: 0.7, origin: "CATALOG", page: 2, pageSize: 10 },
      DEV_USER,
    );
    expect(result).toEqual({ status: "ok", page: { items: [], total: 0, page: 2, pageSize: 10 } });
    const url = new URL(requestAt(fetchMock).url);
    expect(url.pathname).toBe("/api/v1/quality/duplicates");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "POSTPONED",
      collection_id: ids.collection(2),
      min_score: "0.7",
      origin: "CATALOG",
      page: "2",
      page_size: "10",
    });
    expect(requestAt(fetchMock).headers.get("X-MATP-User")).toBe(DEV_USER);
  });

  it("resuelve como pospuesto con postponed_until y nota", async () => {
    const until = new Date(Date.now() + 30 * DAY).toISOString();
    const fetchMock = useLive(async () => json(200, { ...DUPLICATE_CANDIDATES[0], status: "POSTPONED", postponed_until: until }));
    const result = await resolveDuplicate(ids.duplicate(1), { resolution: "POSTPONED", postponedUntil: until, note: " Esperar ficha " }, DEV_USER);
    expect(result.status).toBe("ok");
    const request = requestAt(fetchMock);
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe(`/api/v1/quality/duplicates/${ids.duplicate(1)}/resolve`);
    expect(await request.json()).toEqual({ resolution: "POSTPONED", postponed_until: until, note: "Esperar ficha" });
  });

  it.each([
    [409, "stale_candidate", /ya fue fusionada.*reemplazado/, true],
    [409, "candidate_closed", /ya se cerró/, true],
    [422, "postponed_until_in_past", /posterior a hoy/, false],
  ])("traduce el error %s %s a un mensaje claro", async (status, code, message, closed) => {
    useLive(async () => json(status, { code, message: "mensaje de la API" }));
    const result = await resolveDuplicate(ids.duplicate(1), { resolution: "DISTINCT", note: "x" }, DEV_USER);
    expect(result).toMatchObject({ status: "rejected", code });
    expect(result.status === "rejected" && result.message).toMatch(message);
    expect(isClosedPairFailure(result)).toBe(closed);
  });

  it("fusiona con la pieza conservada, field_choices y el motivo del contrato", async () => {
    const fetchMock = useLive(async () => json(200, { ...DUPLICATE_CANDIDATES[0], status: "MERGED" }));
    const result = await resolveDuplicate(
      ids.duplicate(1),
      { resolution: "MERGED", survivingPieceId: ids.piece(1), fieldChoices: { provenance: "ABSORBED", denomination: "SURVIVING", notes: undefined }, note: " Misma pieza " },
      DEV_USER,
    );
    expect(result).toMatchObject({ status: "ok", candidate: { status: "MERGED" } });
    const request = requestAt(fetchMock);
    expect(new URL(request.url).pathname).toBe(`/api/v1/quality/duplicates/${ids.duplicate(1)}/resolve`);
    expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
    expect(await request.json()).toEqual({
      resolution: "MERGED",
      surviving_piece_id: ids.piece(1),
      field_choices: { provenance: "ABSORBED", denomination: "SURVIVING" },
      note: "Misma pieza",
    });
  });

  it.each([
    ["merge_blocked_inventory_code", /códigos I vigentes distintos.*No se fusionó nada/],
    ["merge_blocked_tenure", /regímenes de tenencia distintos.*No se fusionó nada/],
    ["merge_surviving_must_hold_inventory_code", /conserve esa pieza, porque un código I nunca cambia de pieza/],
  ])("un 409 %s llega con un mensaje claro y no recarga la cola", async (code, message) => {
    useLive(async () => json(409, { code, message: "mensaje de la API" }));
    const result = await resolveDuplicate(ids.duplicate(1), { resolution: "MERGED", survivingPieceId: ids.piece(1), fieldChoices: {}, note: "Misma pieza" }, DEV_USER);
    expect(result).toMatchObject({ status: "rejected", code });
    expect(result.status === "rejected" && result.message).toMatch(message);
    expect(isClosedPairFailure(result)).toBe(false);
  });

  it("lee la ficha con la identidad de la sesión, también la de una pieza fusionada", async () => {
    const mergedInto = { piece_id: ids.piece(1), merged_at: "2026-10-20T15:00:00Z", reason: "Fusionada en x: Misma pieza" };
    const fetchMock = useLive(async (request) =>
      request.url.endsWith(ids.piece(2)) ? json(200, { id: ids.piece(2), denomination: "Toro", merged_into: mergedInto }) : json(404, { code: "not_found", message: "x" }),
    );
    const merged = await fetchPieceSheet(ids.piece(2), DEV_USER);
    expect(merged).toMatchObject({ status: "ok", piece: { merged_into: mergedInto } });
    expect(requestAt(fetchMock).headers.get("X-MATP-User")).toBe(DEV_USER);
    expect(await fetchPieceSheet(ids.piece(3), DEV_USER)).toEqual({ status: "not_found" });

    useLive(async () => json(401, { code: "authentication_required", message: "Debe identificarse." }));
    expect(await fetchPieceSheet(ids.piece(2))).toMatchObject({ status: "rejected", message: "Debe identificarse." });
    useLive(async () => {
      throw new TypeError("network");
    });
    expect((await fetchPieceSheet(ids.piece(2), DEV_USER)).status).toBe("unavailable");
  });

  it("el 422 por más de 180 días usa el máximo que envía la API", async () => {
    useLive(async () => json(422, { code: "postpone_too_long", message: "x", details: { max_days: 90 } }));
    const result = await resolveDuplicate(ids.duplicate(1), { resolution: "POSTPONED", postponedUntil: "2027-12-01T00:00:00Z" }, DEV_USER);
    expect(result.status === "rejected" && result.message).toBe("Solo se puede posponer hasta 90 días.");
  });

  it("un error desconocido conserva el mensaje de la API y sin conexión informa no disponible", async () => {
    useLive(async () => json(403, { code: "permission_denied_custom", message: "Sin permiso (duplicates.resolve)." }));
    const denied = await resolveDuplicate(ids.duplicate(1), { resolution: "DISTINCT", note: "x" }, DEV_USER);
    expect(denied.status === "rejected" && denied.message).toBe("Sin permiso (duplicates.resolve).");

    useLive(async () => {
      throw new TypeError("network");
    });
    const offline = await fetchDuplicateQueue({}, DEV_USER);
    expect(offline.status).toBe("unavailable");
  });

  it("lanza la detección y, si ya hay una en curso (409), sigue esa", async () => {
    const fetchMock = useLive(async () => json(202, JOB));
    expect(await startDuplicateScan(DEV_USER)).toEqual({ status: "ok", job: JOB });
    expect(new URL(requestAt(fetchMock).url).pathname).toBe("/api/v1/quality/duplicates/scan");

    useLive(async () => json(409, { code: "scan_in_progress", message: "x", details: { job: JOB } }));
    const running = await startDuplicateScan(DEV_USER);
    expect(running).toMatchObject({ status: "running", job: { id: JOB.id } });
  });

  it("consulta el avance de una detección", async () => {
    const fetchMock = useLive(async () => json(200, { ...JOB, status: "SUCCEEDED" }));
    const result = await fetchQualityJob(JOB.id, DEV_USER);
    expect(result).toMatchObject({ status: "ok", job: { status: "SUCCEEDED" } });
    expect(new URL(requestAt(fetchMock).url).pathname).toBe(`/api/v1/quality/jobs/${JOB.id}`);
  });

  it("una ficha que no se puede leer queda en null sin fallar la comparación", async () => {
    useLive(async (request) =>
      request.url.endsWith(ids.piece(1)) ? json(200, { id: ids.piece(1), denomination: "Toro" }) : json(404, { code: "not_found", message: "x" }),
    );
    const pieces = await fetchComparedPieces([ids.piece(1), ids.piece(2)], DEV_USER);
    expect(pieces[ids.piece(1)]?.denomination).toBe("Toro");
    expect(pieces[ids.piece(2)]).toBeNull();
  });
});

describe("reglas para posponer (design D5)", () => {
  const today = new Date(2026, 9, 20, 15, 30);

  it("admite desde mañana hasta 180 días y sugiere 30", () => {
    expect(postponeBounds(today)).toEqual({ min: "2026-10-21", max: "2027-04-18", suggested: "2026-11-19" });
  });

  it("convierte la fecha elegida al inicio del día local y rechaza fechas inválidas", () => {
    expect(postponedUntilFromDate("2026-11-19")).toBe(new Date(2026, 10, 19).toISOString());
    expect(postponedUntilFromDate("2026-02-30")).toBeNull();
    expect(postponedUntilFromDate("")).toBeNull();
  });

  it("valida igual que la API: obligatoria, futura y como máximo 180 días", () => {
    expect(postponementError(null, today)?.code).toBe("postponed_until_required");
    expect(postponementError(new Date(2026, 9, 20).toISOString(), today)?.code).toBe("postponed_until_in_past");
    expect(postponementError(new Date(2027, 3, 19).toISOString(), today)?.code).toBe("postpone_too_long");
    expect(postponementError(new Date(2027, 3, 18).toISOString(), today)).toBeNull();
  });
});
