import { afterEach, describe, expect, it, vi } from "vitest";

import { resetMockDuplicates } from "./duplicates";
import {
  PENDING_TABS,
  UNKNOWN_COUNTS,
  fetchPendingCounts,
  initialTab,
  pendingTabs,
  tabForPath,
  tabLabel,
  type PendingCounts,
} from "./pending";

// Change revisar-pendientes-unificado, tareas 2.1 y 2.2. Datos sintéticos (RNF-014): `fetch` simulado,
// sin API real ni red.

const BASE_URL = "http://api.test";
const DEV_USER = "curadora@matp.local";
const ALL = ["duplicates.resolve", "ai.review", "reports.view"];

function permissions(...codes: string[]) {
  return (code: string) => codes.includes(code);
}

function counts(partial: Partial<PendingCounts>): PendingCounts {
  return { ...UNKNOWN_COUNTS, ...partial };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function page(total: number) {
  return { items: [], total, page: 1, page_size: 1 };
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
  resetMockDuplicates();
});

describe("pestañas visibles por permiso (design D2)", () => {
  it("con los tres permisos, las tres en el orden fijo", () => {
    expect(pendingTabs(permissions(...ALL)).map((t) => t.href)).toEqual([
      "/pendientes/duplicados",
      "/pendientes/sugerencias",
      "/pendientes/incompletas",
    ]);
  });

  it("con un solo permiso, solo su pestaña", () => {
    expect(pendingTabs(permissions("reports.view")).map((t) => t.key)).toEqual(["incomplete"]);
  });

  it("sin ninguno, ninguna", () => {
    expect(pendingTabs(permissions())).toEqual([]);
  });
});

describe("pestaña inicial (design D2)", () => {
  const all = pendingTabs(permissions(...ALL));

  it("la primera con pendientes", () => {
    expect(initialTab(all, counts({ duplicates: 9, suggestions: 2, incomplete: 117 }))?.key).toBe("duplicates");
  });

  it("si la primera no tiene pendientes, la siguiente que sí", () => {
    expect(initialTab(all, counts({ duplicates: 0, suggestions: 2, incomplete: 117 }))?.key).toBe("suggestions");
  });

  it("un total desconocido no cuenta como pendiente", () => {
    expect(initialTab(all, counts({ duplicates: null, suggestions: null, incomplete: 3 }))?.key).toBe("incomplete");
  });

  it("si ninguna tiene pendientes o no se conocen, la primera visible", () => {
    expect(initialTab(all, counts({ duplicates: 0, suggestions: 0, incomplete: 0 }))?.key).toBe("duplicates");
    expect(initialTab(all, UNKNOWN_COUNTS)?.key).toBe("duplicates");
  });

  it("solo entre las visibles para el rol", () => {
    const onlyIncomplete = pendingTabs(permissions("reports.view"));
    expect(initialTab(onlyIncomplete, counts({ duplicates: 9, incomplete: 0 }))?.key).toBe("incomplete");
  });

  it("sin pestañas visibles, ninguna", () => {
    expect(initialTab([], counts({ duplicates: 9 }))).toBeNull();
  });
});

describe("nombre y dirección de las pestañas", () => {
  it("el número va entre paréntesis solo si se conoce (incluido el cero)", () => {
    const [duplicates] = PENDING_TABS;
    expect(tabLabel(duplicates, 9)).toBe("Posibles duplicados (9)");
    expect(tabLabel(duplicates, 0)).toBe("Posibles duplicados (0)");
    expect(tabLabel(duplicates, null)).toBe("Posibles duplicados");
  });

  it("reconoce la pestaña de una dirección y de sus subrutas", () => {
    expect(tabForPath("/pendientes/sugerencias")?.key).toBe("suggestions");
    expect(tabForPath("/pendientes/duplicados/otra")?.key).toBe("duplicates");
    expect(tabForPath("/pendientes")).toBeUndefined();
    expect(tabForPath("/pendientes/duplicadosx")).toBeUndefined();
    expect(tabForPath(null)).toBeUndefined();
  });
});

describe("contadores desde las consultas existentes (modo live, design D3)", () => {
  function byPath(totals: Record<string, Response | (() => never)>) {
    return async (request: Request) => {
      const handler = totals[new URL(request.url).pathname];
      if (!handler) return json(404, { code: "not_found" });
      if (typeof handler === "function") return handler();
      return handler.clone();
    };
  }

  it("pide una sola fila de cada cola y lee su total, con la identidad de la sesión", async () => {
    const fetchMock = useLive(
      byPath({
        "/api/v1/quality/duplicates": json(200, page(9)),
        "/api/v1/ai/suggestions": json(200, page(2)),
        "/api/v1/quality/incomplete": json(200, page(117)),
      }),
    );
    const result = await fetchPendingCounts(["duplicates", "suggestions", "incomplete"], { devUser: DEV_USER });
    expect(result).toEqual({ duplicates: 9, suggestions: 2, incomplete: 117 });

    const urls = fetchMock.mock.calls.map(([request]) => new URL(request.url));
    expect(urls.map((u) => u.pathname).sort()).toEqual(["/api/v1/ai/suggestions", "/api/v1/quality/duplicates", "/api/v1/quality/incomplete"]);
    for (const url of urls) expect(url.searchParams.get("page_size")).toBe("1");
    expect(urls.find((u) => u.pathname === "/api/v1/quality/duplicates")?.searchParams.get("status")).toBe("PENDING");
    expect(urls.find((u) => u.pathname === "/api/v1/ai/suggestions")?.searchParams.get("status")).toBe("PENDING");
    for (const [request] of fetchMock.mock.calls) expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
  });

  it("un total que falla queda sin número y no afecta a los demás", async () => {
    useLive(
      byPath({
        "/api/v1/quality/duplicates": json(200, page(9)),
        "/api/v1/ai/suggestions": json(500, { code: "internal_error" }),
        "/api/v1/quality/incomplete": json(200, page(117)),
      }),
    );
    expect(await fetchPendingCounts(["duplicates", "suggestions", "incomplete"])).toEqual({ duplicates: 9, suggestions: null, incomplete: 117 });
  });

  it("sin conexión, todos quedan sin número", async () => {
    useLive(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchPendingCounts(["duplicates", "suggestions", "incomplete"])).toEqual(UNKNOWN_COUNTS);
  });

  it("una respuesta sin total numérico queda sin número", async () => {
    useLive(byPath({ "/api/v1/ai/suggestions": json(200, { items: [] }) }));
    expect((await fetchPendingCounts(["suggestions"])).suggestions).toBeNull();
  });

  it("solo consulta las pestañas pedidas", async () => {
    const fetchMock = useLive(byPath({ "/api/v1/quality/incomplete": json(200, page(4)) }));
    expect(await fetchPendingCounts(["incomplete"])).toEqual({ duplicates: null, suggestions: null, incomplete: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("contadores en modo demostración (design D3)", () => {
  it("duplicados e incompletas salen de los datos sintéticos; las sugerencias, del número que se pasa", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchPendingCounts(["duplicates", "suggestions", "incomplete"], { mockPendingSuggestions: 3 });
    expect(result.suggestions).toBe(3);
    expect(result.duplicates).toEqual(expect.any(Number));
    expect(result.duplicates).toBeGreaterThan(0);
    expect(result.incomplete).toEqual(expect.any(Number));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin número de sugerencias, la pestaña queda sin número", async () => {
    expect((await fetchPendingCounts(["suggestions"])).suggestions).toBeNull();
  });
});
