import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_PENDING_ROUTES,
  PENDING_TABS,
  UNKNOWN_COUNTS,
  fetchPendingCounts,
  incompleteTotal,
  initialTab,
  legacyPendingTarget,
  pendingTabs,
  tabForPath,
  tabLabel,
} from "./pending";

// Change revisar-pendientes-unificado, tareas 2.1 y 2.2, y codigo-unico-y-ajustes-pantallas (se retira
// la pestaña de posibles duplicados). Datos sintéticos (RNF-014): `fetch` simulado, sin API real ni red.

const BASE_URL = "http://api.test";
const DEV_USER = "curadora@matp.local";

function permissions(...codes: string[]) {
  return (code: string) => codes.includes(code);
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
});

describe("pestañas visibles por permiso (design D2)", () => {
  it("solo «Piezas incompletas»: ya no hay posibles duplicados ni sugerencias de IA", () => {
    expect(PENDING_TABS.map((t) => t.href)).toEqual(["/pendientes/incompletas"]);
    expect(pendingTabs(permissions("duplicates.resolve", "ai.review", "reports.view")).map((t) => t.key)).toEqual(["incomplete"]);
  });

  it("sin permiso para ver reportes, ninguna", () => {
    expect(pendingTabs(permissions("duplicates.resolve", "ai.review"))).toEqual([]);
    expect(pendingTabs(permissions())).toEqual([]);
  });
});

describe("pestaña inicial (design D2)", () => {
  const visible = pendingTabs(permissions("reports.view"));

  it("la pestaña visible, tenga o no pendientes", () => {
    expect(initialTab(visible, { incomplete: 117 })?.key).toBe("incomplete");
    expect(initialTab(visible, { incomplete: 0 })?.key).toBe("incomplete");
    expect(initialTab(visible, UNKNOWN_COUNTS)?.key).toBe("incomplete");
  });

  it("sin pestañas visibles, ninguna", () => {
    expect(initialTab([], { incomplete: 9 })).toBeNull();
  });
});

describe("nombre y dirección de las pestañas", () => {
  it("el número va entre paréntesis solo si se conoce (incluido el cero)", () => {
    const [incomplete] = PENDING_TABS;
    expect(tabLabel(incomplete, 9)).toBe("Piezas incompletas (9)");
    expect(tabLabel(incomplete, 0)).toBe("Piezas incompletas (0)");
    expect(tabLabel(incomplete, null)).toBe("Piezas incompletas");
  });

  it("reconoce la pestaña de una dirección y de sus subrutas", () => {
    expect(tabForPath("/pendientes/incompletas")?.key).toBe("incomplete");
    expect(tabForPath("/pendientes/incompletas/otra")?.key).toBe("incomplete");
    expect(tabForPath("/pendientes/duplicados")).toBeUndefined();
    expect(tabForPath("/pendientes/sugerencias")).toBeUndefined();
    expect(tabForPath("/pendientes")).toBeUndefined();
    expect(tabForPath(null)).toBeUndefined();
  });
});

describe("contadores desde las consultas existentes (modo live, design D3)", () => {
  it("pide una sola fila de piezas incompletas y lee su total, con la identidad de la sesión", async () => {
    const fetchMock = useLive(async (request) =>
      new URL(request.url).pathname === "/api/v1/quality/incomplete" ? json(200, page(117)) : json(404, { code: "not_found" }),
    );
    expect(await fetchPendingCounts(["incomplete"], { devUser: DEV_USER })).toEqual({ incomplete: 117 });

    const urls = fetchMock.mock.calls.map(([request]) => new URL(request.url));
    expect(urls.map((u) => u.pathname)).toEqual(["/api/v1/quality/incomplete"]);
    expect(urls[0].searchParams.get("page_size")).toBe("1");
    expect(fetchMock.mock.calls[0][0].headers.get("X-MATP-User")).toBe(DEV_USER);
  });

  it("ya no consulta la cola de duplicados", async () => {
    const fetchMock = useLive(async () => json(200, page(4)));
    await fetchPendingCounts(["incomplete"]);
    expect(fetchMock.mock.calls.map(([request]) => new URL(request.url).pathname)).not.toContain("/api/v1/quality/duplicates");
  });

  it("un total que falla, o sin conexión, queda sin número", async () => {
    useLive(async () => json(500, { code: "internal_error" }));
    expect(await fetchPendingCounts(["incomplete"])).toEqual(UNKNOWN_COUNTS);
    vi.unstubAllGlobals();
    useLive(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchPendingCounts(["incomplete"])).toEqual(UNKNOWN_COUNTS);
  });

  it("una respuesta sin total numérico queda sin número", async () => {
    useLive(async () => json(200, { items: [] }));
    expect(await incompleteTotal()).toBeNull();
  });

  it("sin pestañas pedidas, no consulta nada", async () => {
    const fetchMock = useLive(async () => json(200, page(4)));
    expect(await fetchPendingCounts([])).toEqual(UNKNOWN_COUNTS);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("contadores en modo demostración (design D3)", () => {
  it("las incompletas salen de los datos sintéticos, sin red", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchPendingCounts(["incomplete"]);
    expect(result.incomplete).toEqual(expect.any(Number));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("direcciones antiguas (Req: Redirección de las direcciones antiguas a la bandeja)", () => {
  it("las de posibles duplicados y de sugerencias de IA llevan a la bandeja", () => {
    expect(LEGACY_PENDING_ROUTES["/duplicados"]).toBe("/pendientes");
    expect(LEGACY_PENDING_ROUTES["/pendientes/duplicados"]).toBe("/pendientes");
    expect(LEGACY_PENDING_ROUTES["/ia/sugerencias"]).toBe("/pendientes");
    expect(LEGACY_PENDING_ROUTES["/pendientes/sugerencias"]).toBe("/pendientes");
  });

  it("sin parámetros, la bandeja sola; con parámetros, todos, en su orden y con su codificación", () => {
    expect(legacyPendingTarget("/pendientes", new URLSearchParams())).toBe("/pendientes");
    const params = new URLSearchParams("status=POSTPONED&collection_id=c%201&x=1&x=2");
    expect(legacyPendingTarget("/pendientes", params)).toBe("/pendientes?status=POSTPONED&collection_id=c+1&x=1&x=2");
  });
});
