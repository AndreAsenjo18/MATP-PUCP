import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyBlocker,
  batchMappingRequest,
  columnNeedsAttention,
  dryRunTemplate,
  fetchTemplates,
  mappingFailureMessage,
  missingColumns,
  otherTemplates,
  previewValue,
  saveBatchMapping,
  scoreLabel,
  statusCounts,
  suggestTemplates,
  targetLabel,
  traceStepText,
  type DryRunColumn,
  type MappingTemplate,
  type TemplateSuggestion,
} from "./import-templates";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).
// Datos sintéticos (RNF-014); cabeceras ilustrativas de la sábana sintética [SUPUESTO A1].

const BASE_URL = "http://api.test";
const DEV_USER = "curadora@matp.local";
const BATCH = "01920000-0000-7000-8000-000000000601";
const TEMPLATE_ID = "01920000-0000-7000-8000-000000000621";

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

function template(overrides: Partial<MappingTemplate> = {}): MappingTemplate {
  return {
    id: TEMPLATE_ID,
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana consultoría 2024/25 (sintética)",
    header_signature: "a".repeat(64),
    columns: [
      { source_column: "DENOMINACIÓN", target_field: "denomination", identifier_type_code: null, split_compound: false, transforms: ["trim"], value_map: null },
      { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: ["trim", "split:,"], value_map: null },
    ],
    defaults: {},
    description: null,
    created_at: "2026-10-22T10:00:00Z",
    ...overrides,
  };
}

function suggestion(item: MappingTemplate, score = 1): TemplateSuggestion {
  return { template: item, score, missing_columns: [], new_columns: [] };
}

function column(overrides: Partial<DryRunColumn> = {}): DryRunColumn {
  return {
    mapping: { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: [], value_map: null },
    in_file: true,
    counts: { NORMALIZED: 10, UNPARSEABLE: 0, ABSENT: 0, SPLIT_PROPOSED: 0 },
    empty: 2,
    unmatched_values: [],
    examples: [],
    ...overrides,
  };
}

describe("cuerpo de PUT /mapping: plantilla o columnas, nunca ambas (design D1)", () => {
  it("con plantilla envía solo template_id y el régimen por defecto", () => {
    const body = batchMappingRequest({ kind: "template", templateId: TEMPLATE_ID, tenureDefault: "Propiedad" });
    expect(body).toEqual({ template_id: TEMPLATE_ID, sheet_name: null, header_row: null, columns: [], defaults: { tenure_regime: "Propiedad" } });
  });

  it("con plantilla y sin régimen deja los valores por defecto de la plantilla", () => {
    expect(batchMappingRequest({ kind: "template", templateId: TEMPLATE_ID }).defaults).toEqual({});
  });

  it("con columnas no envía plantilla", () => {
    const body = batchMappingRequest({
      kind: "columns",
      columns: [
        { source_column: "DENOMINACIÓN", target_field: "denomination", identifier_type_code: null, split_compound: false },
        { source_column: "OBS.", target_field: null, identifier_type_code: null, split_compound: false },
      ],
      sheetName: "SABANA",
      tenureDefault: "Comodato",
    });
    expect(body.template_id).toBeNull();
    expect(body.columns?.map((c) => c.source_column)).toEqual(["DENOMINACIÓN"]);
    expect(body.sheet_name).toBe("SABANA");
    expect(body.defaults).toEqual({ tenure_regime: "Comodato" });
  });
});

describe("elegir plantilla (design D3)", () => {
  it("avisa de las columnas que el archivo no trae: aplicarla respondería 422", () => {
    const item = template();
    expect(missingColumns(item, ["DENOMINACIÓN"])).toEqual(["MATERIAL"]);
    expect(applyBlocker(item, { headers: ["DENOMINACIÓN"] })).toContain("(MATERIAL)");
    expect(applyBlocker(item, { headers: ["DENOMINACIÓN", "MATERIAL", "FOTO"] })).toBeNull();
  });

  it("la lista completa no repite las sugeridas", () => {
    const seed = template();
    const other = template({ id: "otra", name: "Otra" });
    expect(otherTemplates([seed, other], [suggestion(seed)]).map((t) => t.id)).toEqual(["otra"]);
  });

  it("explica el puntaje y el destino en español", () => {
    expect(scoreLabel(1)).toBe("100 %");
    expect(scoreLabel(0.7234)).toBe("72 %");
    expect(targetLabel({ target_field: "terms:MATERIAL", identifier_type_code: null })).toBe("Términos del vocabulario MATERIAL");
    expect(targetLabel({ target_field: "identifier", identifier_type_code: "I" })).toBe("Código I (inventario general)");
    expect(targetLabel({ target_field: "identifier", identifier_type_code: null })).toBe("Códigos (se reconoce el tipo de cada uno)");
    expect(targetLabel({ target_field: "denomination", identifier_type_code: null })).toBe("Denominación");
  });
});

describe("vista previa por columna (design D4)", () => {
  it("ordena los conteos y cuenta 0 los que faltan", () => {
    expect(statusCounts(column({ counts: { ABSENT: 3, NORMALIZED: 20 } }))).toEqual([
      ["NORMALIZED", 20],
      ["UNPARSEABLE", 0],
      ["ABSENT", 3],
      ["SPLIT_PROPOSED", 0],
    ]);
  });

  it("abre las columnas con problemas", () => {
    expect(columnNeedsAttention(column())).toBe(false);
    expect(columnNeedsAttention(column({ counts: { UNPARSEABLE: 1 } }))).toBe(true);
    expect(columnNeedsAttention(column({ counts: { SPLIT_PROPOSED: 1 } }))).toBe(true);
    expect(columnNeedsAttention(column({ unmatched_values: [{ value: "maguey", count: 3 }] }))).toBe(true);
    expect(columnNeedsAttention(column({ in_file: false }))).toBe(true);
  });

  it("muestra valores y pasos de la traza en lenguaje claro", () => {
    expect(previewValue("arcilla")).toBe("«arcilla»");
    expect(previewValue(["madera", "pasta de papa"])).toBe("«madera» · «pasta de papa»");
    expect(previewValue(null)).toBe("(vacío)");
    expect(traceStepText({ transform: "split:,", before: "madera, yeso", after: ["madera", "yeso"] })).toBe("split:,: «madera, yeso» → «madera» · «yeso»");
    expect(traceStepText({ transform: "propose_period", before: "fines del s. XIX", after: null, note: "not_recognized" })).toContain("(no se reconoció el texto)");
  });

  it("resume un mapeo rechazado: columnas que faltan o los errores de cada columna", () => {
    const unknown = { status: "rejected" as const, code: "invalid_mapping", message: "El mapeo tiene errores.", details: { errors: [{ code: "unknown_column", message: "x", column: "N° INV" }] } };
    expect(mappingFailureMessage(unknown)).toContain("columnas que este archivo no trae");
    const other = { status: "rejected" as const, code: "invalid_mapping", message: "El mapeo tiene errores.", details: { errors: [{ code: "invalid_default", message: "«X» no es un régimen." }] } };
    expect(mappingFailureMessage(other)).toBe("El mapeo tiene errores. «X» no es un régimen.");
    expect(mappingFailureMessage({ status: "unavailable", message: "Sin conexión." })).toBe("Sin conexión.");
  });
});

describe("modo mock", () => {
  it("no llama a la API", async () => {
    expect((await suggestTemplates(["DENOMINACIÓN"])).status).toBe("unavailable");
    expect((await dryRunTemplate(TEMPLATE_ID, BATCH)).status).toBe("unavailable");
  });
});

describe("modo live", () => {
  it("pide sugerencias con las cabeceras y la identidad de la sesión", async () => {
    const fetchMock = useLive(async () => json(200, [suggestion(template())]));

    const result = await suggestTemplates(["N°", "DENOMINACIÓN"], DEV_USER);

    expect(result).toMatchObject({ status: "ok", value: [{ score: 1 }] });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${BASE_URL}/api/v1/import-templates/suggest`);
    expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
    expect(await request.json()).toEqual({ headers: ["N°", "DENOMINACIÓN"] });
  });

  it("lista las plantillas activas", async () => {
    const fetchMock = useLive(async () => json(200, [template()]));

    const result = await fetchTemplates(DEV_USER);

    expect(result.status).toBe("ok");
    expect((fetchMock.mock.calls[0][0] as Request).url).toBe(`${BASE_URL}/api/v1/import-templates`);
  });

  it("pide la vista previa de la plantilla para el lote y traduce el 409", async () => {
    const fetchMock = useLive(async () => json(409, { code: "batch_not_previewable", message: "x", details: { current_status: "VALIDATED" } }));

    const result = await dryRunTemplate(TEMPLATE_ID, BATCH, DEV_USER);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toBe(`${BASE_URL}/api/v1/import-templates/${TEMPLATE_ID}/dry-run`);
    expect(await request.json()).toEqual({ batch_id: BATCH });
    expect(result).toMatchObject({ status: "rejected", code: "batch_not_previewable", message: expect.stringContaining("antes de validar") });
  });

  it("aplica la plantilla al lote con template_id y sin columnas", async () => {
    const fetchMock = useLive(async () => json(422, { code: "template_with_columns", message: "x", details: {} }));

    const result = await saveBatchMapping(BATCH, { kind: "template", templateId: TEMPLATE_ID, tenureDefault: "Propiedad" }, DEV_USER);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(`${BASE_URL}/api/v1/imports/${BATCH}/mapping`);
    expect(await request.json()).toMatchObject({ template_id: TEMPLATE_ID, columns: [] });
    expect(result).toMatchObject({ status: "rejected", message: expect.stringContaining("no ambas") });
  });
});
