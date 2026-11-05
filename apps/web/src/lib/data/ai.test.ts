import { afterEach, describe, expect, it, vi } from "vitest";

import { ids } from "@/lib/fixtures";

import {
  AI_ERROR_MESSAGES,
  approveAiSuggestion,
  fieldValueText,
  fieldsOf,
  listPendingAiSuggestions,
  rejectAiSuggestion,
  suggestCataloging,
} from "./ai";

// Modo `mock` es el valor por defecto sin NEXT_PUBLIC_API_MODE; `useLive` sustituye `fetch` por un
// simulacro (sin API real ni red) y fija la URL base, igual que en audit.test.ts.

const BASE_URL = "http://api.test";
const PIECE = ids.piece(1);
const SUGGESTION = ids.aiSuggestion(1);

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

function requestAt(fetchMock: { mock: { calls: Array<[Request]> } }, index: number): Request {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`fetch no recibió la llamada ${index}`);
  return call[0];
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("suggestCataloging", () => {
  it("pide la sugerencia sobre el campo indicado", async () => {
    const suggestion = { id: SUGGESTION, status: "PENDING", provider: "mock", output_data: { fields: [] } };
    const fetchMock = useLive(async () => json(201, suggestion));

    const result = await suggestCataloging(PIECE, "notes");

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/api/v1/ai/suggest-cataloging");
    expect(await request.json()).toEqual({ piece_id: PIECE, field: "notes" });
    expect(result).toEqual({ status: "ok", value: suggestion });
  });

  it("un 503 del proveedor se traduce al mensaje de «no disponible»", async () => {
    useLive(async () => json(503, { code: "ai_unavailable", message: "El proveedor de IA no respondió." }));

    const result = await suggestCataloging(PIECE, "notes");

    expect(result).toEqual({ status: "rejected", code: "ai_unavailable", message: AI_ERROR_MESSAGES.ai_unavailable });
  });

  it("un campo de origen no permitido llega como 422", async () => {
    useLive(async () => json(422, { code: "source_field_not_allowed", message: "x" }));

    const result = await suggestCataloging(PIECE, "lender_name");

    expect(result).toEqual({
      status: "rejected",
      code: "source_field_not_allowed",
      message: AI_ERROR_MESSAGES.source_field_not_allowed,
    });
  });

  it("en modo mock no llama a la red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await suggestCataloging(PIECE, "notes");

    expect(result.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("approveAiSuggestion", () => {
  it("envía los ítems aprobados y la confirmación de valores vigentes", async () => {
    const approved = { id: SUGGESTION, status: "APPROVED" };
    const fields = [{ field: "dimensions", value: { dimension: "alto", value: 35, unit: "cm" }, source_fragment: "Alto 35 cm", confidence: 0.8 }];
    const fetchMock = useLive(async () => json(200, approved));

    const result = await approveAiSuggestion(SUGGESTION, fields);

    const request = requestAt(fetchMock, 0);
    expect(new URL(request.url).pathname).toBe(`/api/v1/ai/suggestions/${SUGGESTION}/approve`);
    expect(await request.json()).toEqual({ approved_data: { fields }, acknowledge_current_values: false });
    expect(result).toEqual({ status: "ok", value: approved });
  });

  it("una sugerencia ya revisada llega como 409", async () => {
    useLive(async () => json(409, { code: "suggestion_already_reviewed", message: "x" }));

    const result = await approveAiSuggestion(SUGGESTION, []);

    expect(result).toEqual({
      status: "rejected",
      code: "suggestion_already_reviewed",
      message: AI_ERROR_MESSAGES.suggestion_already_reviewed,
    });
  });
});

describe("rejectAiSuggestion", () => {
  it("envía el motivo del rechazo", async () => {
    const rejected = { id: SUGGESTION, status: "REJECTED", rejection_reason: "No corresponde" };
    const fetchMock = useLive(async () => json(200, rejected));

    const result = await rejectAiSuggestion(SUGGESTION, "No corresponde");

    const request = requestAt(fetchMock, 0);
    expect(new URL(request.url).pathname).toBe(`/api/v1/ai/suggestions/${SUGGESTION}/reject`);
    expect(await request.json()).toEqual({ reason: "No corresponde" });
    expect(result).toEqual({ status: "ok", value: rejected });
  });
});

describe("listPendingAiSuggestions", () => {
  it("pide las pendientes, y con pieceId las de esa pieza", async () => {
    const fetchMock = useLive(async () => json(200, { items: [], total: 0, page: 1, page_size: 50 }));

    const result = await listPendingAiSuggestions(undefined, PIECE);

    const request = requestAt(fetchMock, 0);
    const url = new URL(request.url);
    expect(url.pathname).toBe("/api/v1/ai/suggestions");
    expect(url.searchParams.get("status")).toBe("PENDING");
    expect(url.searchParams.get("piece_id")).toBe(PIECE);
    expect(result).toEqual({ status: "ok", value: [] });
  });

  it("sin pieceId no filtra por pieza", async () => {
    const fetchMock = useLive(async () => json(200, { items: [], total: 0, page: 1, page_size: 50 }));

    await listPendingAiSuggestions();

    const url = new URL(requestAt(fetchMock, 0).url);
    expect(url.searchParams.has("piece_id")).toBe(false);
  });
});

describe("fieldsOf", () => {
  it("lee la lista de fields; sin datos devuelve vacío", () => {
    expect(fieldsOf({ fields: [{ field: "x", value: 1, source_fragment: null, confidence: 1 }] })).toHaveLength(1);
    expect(fieldsOf(null)).toEqual([]);
    expect(fieldsOf(undefined)).toEqual([]);
    expect(fieldsOf({})).toEqual([]);
  });
});

describe("fieldValueText", () => {
  it("formatea cada tipo de dato propuesto en español llano", () => {
    expect(fieldValueText({ field: "dimensions", value: { dimension: "alto", value: 35, unit: "cm" } })).toBe("alto: 35 cm");
    expect(fieldValueText({ field: "conservation_status", value: "BUENO" })).toBe("BUENO");
    expect(fieldValueText({ field: "review_marks", value: { year: 2019 } })).toBe("Revisado en 2019");
    expect(fieldValueText({ field: "review_marks", value: { year: null } })).toBe("Revisado (sin año en el texto)");
    expect(fieldValueText({ field: "exhibitions", value: { description: "Muestra de retablos", year: 1998 } })).toBe("Muestra de retablos (1998)");
  });
});
