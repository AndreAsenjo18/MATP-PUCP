import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PRINT_LIMIT,
  downloadReport,
  fetchPrintableReport,
  groupByCollection,
  missingParameter,
  paramsFromSearch,
  printHref,
  type Report,
} from "./reports";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).

const BASE_URL = "http://api.test";
const DEV_USER = "admin@matp.local";

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

function report(overrides: Partial<Report> = {}): Report {
  return {
    report_type: "inventory",
    title: "Inventario general",
    generated_at: "2026-10-25T12:00:00Z",
    generated_by: "admin@matp.local",
    filters: {},
    columns: ["Denominación", "Colección"],
    rows: [],
    totals: { Piezas: 0 },
    subtotals: [],
    masked_columns: [],
    message: null,
    download_url: null,
    total_rows: 0,
    page: 1,
    page_size: 100,
    ...overrides,
  };
}

describe("reglas de la pantalla", () => {
  it("lleva los parámetros a la vista imprimible y los lee de vuelta", () => {
    const href = printHref("by-location", { locationId: "loc-1", notVerifiedSinceDays: 365, includeLoansForUse: true });
    expect(href).toBe("/reportes/imprimir/by-location?location_id=loc-1&not_verified_since_days=365");
    const params = paramsFromSearch(new URL(`http://x${href}`).searchParams);
    expect(params).toEqual({ collectionId: null, locationId: "loc-1", includeLoansForUse: true, notVerifiedSinceDays: 365 });
    expect(printHref("inventory", { includeLoansForUse: false })).toBe("/reportes/imprimir/inventory?include_loans_for_use=false");
  });

  it("pide la colección o la ubicación antes de consultar", () => {
    expect(missingParameter("by-collection", {})).toBe("Elija la colección.");
    expect(missingParameter("by-location", {})).toBe("Elija la ubicación.");
    expect(missingParameter("inventory", {})).toBeNull();
  });

  it("agrupa las filas por colección para los saltos de página", () => {
    const groups = groupByCollection({ columns: ["Denominación", "Colección"], rows: [["a", "RA"], ["b", "RA"], ["c", "MMZ"]] });
    expect(groups.map((g) => [g.label, g.rows.length])).toEqual([
      ["RA", 2],
      ["MMZ", 1],
    ]);
    expect(groupByCollection({ columns: ["Espacio", "Piezas"], rows: [["Depósito 1", 3]] })).toEqual([{ label: null, rows: [["Depósito 1", 3]] }]);
  });
});

describe("operaciones en modo live", () => {
  it("lee el reporte completo por páginas para imprimirlo", async () => {
    const fetchMock = useLive(async (request) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      const rows = page === 1 ? Array.from({ length: 100 }, (_, i) => [`p${i}`, "RA"]) : [["p100", "RA"]];
      return json(200, report({ rows, total_rows: 101, page }));
    });

    const result = await fetchPrintableReport("inventory", {}, DEV_USER);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status === "ok" && result.value.rows.length).toBe(101);
    expect(result.status === "ok" && result.value.tooLarge).toBe(false);
  });

  it("no descarga un reporte que supera el límite de impresión", async () => {
    const fetchMock = useLive(async () => json(200, report({ rows: [["x", "RA"]], total_rows: PRINT_LIMIT + 1 })));

    const result = await fetchPrintableReport("inventory", {}, DEV_USER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.status === "ok" && result.value.tooLarge).toBe(true);
  });

  it("un reporte grande se genera en segundo plano (202)", async () => {
    useLive(async () => json(202, { id: "job-1", status: "PENDING", format: "xlsx", row_count: 9000 }));

    const result = await downloadReport("inventory", {}, DEV_USER);

    expect(result.status === "ok" && result.value.kind).toBe("job");
  });

  it("traduce el 403 del detalle por debajo del espacio", async () => {
    useLive(async () => json(403, { code: "exact_location_required", message: "x", details: { aggregate_available: true } }));

    const result = await downloadReport("by-location", { locationId: "rack" }, DEV_USER);

    expect(result.status === "rejected" && result.message).toContain("agregado por espacio");
  });
});
