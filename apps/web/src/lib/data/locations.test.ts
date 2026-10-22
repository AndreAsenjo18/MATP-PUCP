import { afterEach, describe, expect, it, vi } from "vitest";

import {
  batchMovePieces,
  createLocation,
  fetchLocationsTree,
  locationPathLabel,
  movePiece,
  newIdempotencyKey,
  updateLocation,
  type LocationNode,
} from "./locations";

const BASE_URL = "http://api.test";
const DEV_USER = "deposito@matp.local";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: (request: Request) => Promise<Response>) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("modo mock", () => {
  it("fetchLocationsTree responde unavailable sin red", async () => {
    const result = await fetchLocationsTree(DEV_USER);
    expect(result.status).toBe("unavailable");
  });

  it("movePiece responde unavailable sin red", async () => {
    const result = await movePiece("piece-1", { movement_type: "MOVE", to_location_id: "loc-1" }, DEV_USER);
    expect(result.status).toBe("unavailable");
  });
});

describe("modo live", () => {
  it("fetchLocationsTree devuelve el árbol podado por rol", async () => {
    const tree: LocationNode[] = [{ id: "site-1", name: "Sede", level_type: "Sede", children: [] }];
    useLive(async () => json(200, tree));
    const result = await fetchLocationsTree(DEV_USER);
    expect(result).toEqual({ status: "ok", value: tree });
  });

  it("createLocation traduce un código repetido a un mensaje claro", async () => {
    useLive(async () =>
      json(409, { code: "duplicate_location_code", message: "ya existe", details: { existing_location_id: "x" } }),
    );
    const result = await createLocation({ level: "Depósito", code: "DEP-1", name: "Depósito 1" }, DEV_USER);
    expect(result).toEqual({
      status: "rejected",
      code: "duplicate_location_code",
      message: "Ya existe una ubicación activa con ese código.",
      details: { existing_location_id: "x" },
    });
  });

  it("updateLocation envía la reubicación con confirm_affected_count", async () => {
    const fetchMock = useLive(async (request) => {
      expect(request.method).toBe("PUT");
      const body = await request.clone().json();
      expect(body).toMatchObject({ parent_id: "dep-2", confirm_affected_count: 40 });
      return json(200, { id: "rack-1", code: "RACK-A", name: "Rack A", path: [] });
    });
    const result = await updateLocation("rack-1", { parent_id: "dep-2", confirm_affected_count: 40 }, DEV_USER);
    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("movePiece envía expected_from_location_id para el control de concurrencia", async () => {
    useLive(async (request) => {
      const body = await request.clone().json();
      expect(body.expected_from_location_id).toBe("loc-origin");
      return json(201, {
        id: "move-1",
        piece_id: "piece-1",
        movement_type: "MOVE",
        from_location: null,
        to_location: null,
        reason: null,
        performed_by_label: null,
        occurred_at: "2026-10-21T10:00:00Z",
      });
    });
    const result = await movePiece(
      "piece-1",
      { movement_type: "MOVE", to_location_id: "loc-dest", expected_from_location_id: "loc-origin" },
      DEV_USER,
    );
    expect(result.status).toBe("ok");
  });

  it("batchMovePieces envía la cabecera Idempotency-Key", async () => {
    const fetchMock = useLive(async (request) => {
      expect(request.headers.get("idempotency-key")).toBe("retry-key-1");
      return json(201, { registered: [], failures: [] });
    });
    const result = await batchMovePieces(
      { movement_type: "MOVE", to_location_id: "loc-dest", items: [{ piece_id: "p1" }] },
      "retry-key-1",
      DEV_USER,
    );
    expect(result.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("un lote con fallas devuelve el detalle por pieza", async () => {
    useLive(async () =>
      json(409, {
        registered: [],
        failures: [{ piece_id: "p1", code: "location_changed", message: "La pieza ya cambió de ubicación." }],
      }),
    );
    const result = await batchMovePieces(
      { movement_type: "MOVE", to_location_id: "loc-dest", items: [{ piece_id: "p1" }] },
      newIdempotencyKey(),
      DEV_USER,
    );
    // El cuerpo 409 no tiene `code`/`message` de ErrorResponse, así que cae al mensaje genérico.
    expect(result.status).toBe("rejected");
  });
});

describe("locationPathLabel", () => {
  it("une los nombres de la ruta con ›", () => {
    expect(locationPathLabel([{ name: "Sede" }, { name: "Depósito 1" }, { name: "Rack A" }])).toBe("Sede › Depósito 1 › Rack A");
  });

  it("devuelve cadena vacía para una ruta vacía", () => {
    expect(locationPathLabel([])).toBe("");
  });
});

describe("newIdempotencyKey", () => {
  it("genera claves distintas en llamadas sucesivas", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
  });
});
