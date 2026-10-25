import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_FILTERS,
  activeChips,
  apiFilters,
  canDownload,
  exportResults,
  fetchExportDownloadUrl,
  fetchSearch,
  filterOfSuggestion,
  hasPendingJobs,
  jobStatusLabel,
  matchReasonText,
  removeFilter,
  startFullExport,
  suggestionText,
  type SearchFilters,
} from "./search";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).

const BASE_URL = "http://api.test";
const DEV_USER = "curadora@matp.local";

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

const FILTERS: SearchFilters = {
  ...EMPTY_FILTERS,
  q: "  retablo ",
  collectionId: "col-ra",
  materialId: "mat-madera",
  tenureRegime: "Comodato",
  hasInventoryCode: false,
  epochStartYear: 1900,
  hasAlerts: true,
};

describe("filtros de la pantalla", () => {
  it("envía a la API solo los filtros activos, con los nombres del filtro único", () => {
    expect(apiFilters(FILTERS)).toEqual({
      q: "retablo",
      collection_id: "col-ra",
      material_id: "mat-madera",
      tenure_regime: "Comodato",
      has_inventory_code: false,
      epoch_start_year: 1900,
      has_alerts: true,
    });
    expect(apiFilters({ ...EMPTY_FILTERS, q: "   " })).toEqual({});
  });

  it("describe cada filtro activo en un chip y lo quita", () => {
    const chips = activeChips(FILTERS, { "col-ra": "Colección RA (ficticia)" });
    expect(chips.map((chip) => `${chip.label}: ${chip.value}`)).toEqual([
      "Búsqueda: «retablo»",
      "Colección: Colección RA (ficticia)",
      "Material: (seleccionada)",
      "Régimen de tenencia: Comodato",
      "Código I: Sin código I",
      "Época desde: 1900",
      "Completitud: Solo piezas incompletas",
    ]);
    const without = removeFilter(FILTERS, "collectionId");
    expect(without.collectionId).toBeNull();
    expect(without.materialId).toBe("mat-madera");
  });

  it("explica la coincidencia por código o por campos de texto", () => {
    expect(matchReasonText({ match_reason: { kind: "identifier", type: "COLECCION", original: "M.M.Z. 15", historical: false } })).toBe(
      "Coincide por código de colección «M.M.Z. 15»",
    );
    expect(matchReasonText({ match_reason: { kind: "identifier", type: "I", original: "I-0236", historical: true } })).toBe(
      "Coincide por código I «I-0236» (código histórico)",
    );
    expect(matchReasonText({ match_reason: { kind: "text", fields: ["denomination", "provenance"] } })).toBe(
      "Coincide en denominación y procedencia",
    );
    expect(matchReasonText({ match_reason: null })).toBeNull();
  });

  it("traduce las sugerencias sin resultados y sabe qué filtro quitar", () => {
    expect(suggestionText("remove_filter:collection_id")).toBe("Quite el filtro «Colección».");
    expect(suggestionText("check_code_format")).toContain("sin puntos");
    expect(suggestionText("search_historical")).toContain("código anterior");
    expect(filterOfSuggestion("remove_filter:material_id")).toBe("materialId");
    expect(filterOfSuggestion("remove_filter:collection_code")).toBeNull();
    expect(filterOfSuggestion("check_code_format")).toBeNull();
  });
});

describe("estado de las exportaciones", () => {
  const now = new Date("2026-10-25T12:00:00Z");

  it("solo se descarga una exportación lista y no caducada", () => {
    expect(canDownload({ status: "READY", expires_at: "2026-10-26T12:00:00Z" }, now)).toBe(true);
    expect(canDownload({ status: "READY", expires_at: "2026-10-24T12:00:00Z" }, now)).toBe(false);
    expect(jobStatusLabel({ status: "READY", expires_at: "2026-10-24T12:00:00Z" }, now)).toBe("Caducada");
    expect(canDownload({ status: "RUNNING", expires_at: null }, now)).toBe(false);
    expect(hasPendingJobs([{ status: "READY" }, { status: "PENDING" }])).toBe(true);
    expect(hasPendingJobs([{ status: "FAILED" }])).toBe(false);
  });
});

describe("modo live", () => {
  it("busca con el texto, los filtros y la página", async () => {
    const fetchMock = useLive(async () => json(200, { items: [], total: 0, page: 2, limit: 20 }));
    const result = await fetchSearch(FILTERS, 2, DEV_USER);
    expect(result.status).toBe("ok");
    const url = new URL((fetchMock.mock.calls[0][0] as Request).url);
    expect(url.pathname).toBe("/api/v1/search");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: "retablo",
      collection_id: "col-ra",
      tenure_regime: "Comodato",
      has_inventory_code: "false",
      has_alerts: "true",
      page: "2",
      limit: "20",
    });
  });

  it("informa un filtro no permitido para el rol", async () => {
    useLive(async () => json(403, { code: "filter_not_allowed", message: "x" }));
    const result = await fetchSearch(EMPTY_FILTERS, 1, DEV_USER);
    expect(result).toMatchObject({ status: "rejected", message: "Su rol no puede filtrar por ese campo." });
  });

  it("exporta con las columnas elegidas y descarga el archivo", async () => {
    const fetchMock = useLive(
      async () =>
        new Response(new Blob(["xlsx"]), {
          status: 200,
          headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "x-omited-columns": "lender_name, valuation" },
        }),
    );
    const result = await exportResults(FILTERS, ["denomination", "code_i"], "xlsx", DEV_USER);
    expect(result.status).toBe("ok");
    if (result.status !== "ok" || result.value.kind !== "file") throw new Error("se esperaba un archivo");
    expect(result.value.fileName).toBe("resultados-busqueda.xlsx");
    expect(result.value.omitted).toEqual(["lender_name", "valuation"]);
    const body = JSON.parse(await (fetchMock.mock.calls[0][0] as Request).text());
    expect(body).toEqual({ filters: apiFilters(FILTERS), columns: ["denomination", "code_i"], format: "xlsx" });
  });

  it("una exportación grande devuelve el trabajo en segundo plano", async () => {
    useLive(async () => json(202, { id: "job-1", status: "PENDING", format: "csv", row_count: 12000 }));
    const result = await exportResults(EMPTY_FILTERS, ["denomination"], "csv", DEV_USER);
    expect(result).toMatchObject({ status: "ok", value: { kind: "job", job: { id: "job-1", status: "PENDING" } } });
  });

  it("no exporta sin columnas", async () => {
    const fetchMock = useLive(async () => json(200, {}));
    const result = await exportResults(EMPTY_FILTERS, [], "xlsx", DEV_USER);
    expect(result).toMatchObject({ status: "rejected", code: "no_columns" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("avisa cuando el archivo de la exportación caducó", async () => {
    useLive(async () => json(410, { code: "gone", message: "El archivo de exportación ha caducado." }));
    const result = await fetchExportDownloadUrl("job-1", DEV_USER);
    expect(result).toMatchObject({ status: "rejected", message: "El archivo de esa exportación ya caducó: genérela de nuevo." });
  });

  it("inicia la exportación completa o devuelve la que está en curso", async () => {
    const fetchMock = useLive(async () => json(202, { id: "job-full", status: "RUNNING", format: "xlsx" }));
    const result = await startFullExport(DEV_USER);
    expect(result).toMatchObject({ status: "ok", value: { id: "job-full" } });
    expect(new URL((fetchMock.mock.calls[0][0] as Request).url).pathname).toBe("/api/v1/exports/full");
  });

  it("en modo mock no llama a la API", async () => {
    const result = await exportResults(EMPTY_FILTERS, ["denomination"], "xlsx");
    expect(result.status).toBe("unavailable");
  });
});
