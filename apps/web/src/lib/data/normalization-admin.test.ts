import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addMarker,
  addSeparator,
  aliasFieldError,
  createAlias,
  deleteAlias,
  fetchAliases,
  fetchCollections,
  fetchSetting,
  hasChanges,
  aliasKey,
  tenureAliasError,
  tenureAliasesChanged,
  tenureAliasesValue,
  impactFrom,
  impactReasonLabel,
  markerError,
  markerKey,
  markersValue,
  removeItem,
  saveSetting,
  separatorError,
  separatorLabel,
  separatorsValue,
} from "./normalization-admin";

// Modo `mock` por defecto; `useLive` sustituye `fetch` por un simulacro (sin API real ni red).
// Datos sintéticos (RNF-014); «NO REGISTRA» y «REP» son ilustrativos [SUPUESTO A5, A3].

const BASE_URL = "http://api.test";
const DEV_USER = "admin@matp.local";
const ALIAS_ID = "01920000-0000-7000-8000-000000000901";
const COLLECTION_ID = "01920000-0000-7000-8000-000000000201";

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

const IMPACT = {
  status: "rejected" as const,
  code: "normalization_change_requires_preview",
  message: "El cambio alteraría 7 identificadores ya registrados.",
  details: {
    affected: 7,
    change: "colecciones-y-vocabularios-admin",
    examples: [
      { piece_id: "p-1", identifier_type_code: "I", original_value: "I-9101", normalized_value: "I-9101", proposed_value: "I-9101", reason: "separation" },
      { piece_id: "p-2", identifier_type_code: "PUCP", original_value: "S/N", normalized_value: null, proposed_value: "S/N", reason: "normalization" },
    ],
  },
};

describe("marcadores de ausencia", () => {
  it("se comparan como en el servidor: sin espacios ni diferencias de mayúsculas", () => {
    expect(markerKey("No  registra")).toBe("NOREGISTRA");
    expect(markerError(["S/N", "NO REGISTRA"], "no registra")).toBe("«NO REGISTRA» ya es un marcador.");
    expect(markerError(["", "S/N"], "  ")).toBe("La celda vacía ya es un marcador.");
    expect(markerError(["S/N"], " ")).toBe("Escriba el marcador.");
    expect(markerError(["S/N"], "SIN DATO")).toBeNull();
  });

  it("añade sin repetir y quita", () => {
    expect(addMarker(["S/N"], "  Sin dato ")).toEqual(["S/N", "Sin dato"]);
    expect(addMarker(["S/N"], "s / n")).toEqual(["S/N"]);
    expect(removeItem(["S/N", "-", "0"], "-")).toEqual(["S/N", "0"]);
  });
});

describe("separadores", () => {
  it("se nombran en lenguaje claro", () => {
    expect(separatorLabel(",")).toBe("coma ,");
    expect(separatorLabel("\n")).toBe("salto de línea");
    expect(separatorLabel("#")).toBe("«#»");
  });

  it("no admiten el espacio ni repetirse; el salto de línea sí se puede añadir", () => {
    expect(separatorError(["/"], " ")).toContain("no puede ser un espacio");
    expect(separatorError(["/"], "")).toBe("Escriba el separador.");
    expect(separatorError(["/", ","], ",")).toBe("coma , ya es un separador.");
    expect(separatorError(["/"], "\n")).toBeNull();
    expect(addSeparator(["/"], "+")).toEqual(["/", "+"]);
    expect(addSeparator(["/"], " ")).toEqual(["/"]);
  });

  it("detecta cambios sin importar el orden", () => {
    expect(hasChanges(["/", ","], [",", "/"])).toBe(false);
    expect(hasChanges(["/", ","], ["/"])).toBe(true);
  });

  it("lee el valor de cada parámetro", () => {
    expect(separatorsValue({ separators: ["/"], unsplit_markers: ["S/N"] })).toEqual({ separators: ["/"], unsplit_markers: ["S/N"] });
    expect(markersValue(["S/N"])).toEqual(["S/N"]);
    expect(markersValue({ separators: ["/"], unsplit_markers: [] })).toEqual([]);
  });
});

describe("409 de impacto (design D5, [SUPUESTO T10])", () => {
  it("cuenta los afectados, los ejemplos y los que no se muestran", () => {
    const impact = impactFrom(IMPACT);
    expect(impact).toEqual({
      affected: 7,
      remaining: 5,
      examples: [
        { typeCode: "I", originalValue: "I-9101", normalizedValue: "I-9101", proposedValue: "I-9101", reason: "separation" },
        { typeCode: "PUCP", originalValue: "S/N", normalizedValue: null, proposedValue: "S/N", reason: "normalization" },
      ],
    });
    expect(impactReasonLabel("separation")).toBe("Cambia cómo se separa su celda");
    expect(impactReasonLabel("normalization")).toBe("Cambia su forma normalizada");
  });

  it("otros errores no son de impacto", () => {
    expect(impactFrom({ status: "rejected", code: "invalid_setting_value", message: "x" })).toBeNull();
    expect(impactFrom({ status: "unavailable", message: "Sin conexión." })).toBeNull();
  });

  it("los rechazos de un alias van al campo de la sigla", () => {
    expect(aliasFieldError({ status: "rejected", code: "acronym_alias_taken", message: "Ya es un alias de LRM." })).toBe("Ya es un alias de LRM.");
    expect(aliasFieldError({ status: "rejected", code: "alias_is_current_acronym", message: "Es la sigla de MMZ." })).toBe("Es la sigla de MMZ.");
    expect(aliasFieldError(IMPACT)).toBeNull();
  });
});

describe("modo mock", () => {
  it("no llama a la API", async () => {
    expect((await fetchSetting("absence_markers")).status).toBe("unavailable");
    expect((await createAlias("REP", COLLECTION_ID)).status).toBe("unavailable");
  });
});

describe("modo live", () => {
  it("lee y guarda un parámetro con la identidad de la sesión", async () => {
    const fetchMock = useLive(async () => json(200, { key: "absence_markers", value: ["S/N", "NO REGISTRA"], is_default: false, updated_at: "2026-10-24T10:00:00Z" }));

    const saved = await saveSetting("absence_markers", ["S/N", "NO REGISTRA"], DEV_USER);

    expect(saved).toMatchObject({ status: "ok", value: { is_default: false } });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(`${BASE_URL}/api/v1/normalization-settings/absence_markers`);
    expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
    expect(await request.json()).toEqual({ value: ["S/N", "NO REGISTRA"] });
  });

  it("devuelve el 409 de impacto con sus detalles", async () => {
    useLive(async () => json(409, { code: IMPACT.code, message: IMPACT.message, details: IMPACT.details }));

    const result = await saveSetting("concatenation_separators", { separators: ["/"], unsplit_markers: [] }, DEV_USER);

    expect(result.status).toBe("rejected");
    if (result.status !== "ok") expect(impactFrom(result)?.affected).toBe(7);
  });

  it("lista, crea y elimina siglas históricas con motivo", async () => {
    const fetchMock = useLive(async (request) => {
      if (request.method === "DELETE") return new Response(null, { status: 204 });
      if (request.method === "POST") return json(201, { id: ALIAS_ID, alias: "R.E.P.", alias_normalized: "REP" });
      return json(200, []);
    });

    expect((await fetchAliases(DEV_USER)).status).toBe("ok");
    expect((await createAlias(" R.E.P. ", COLLECTION_ID, DEV_USER)).status).toBe("ok");
    expect(await deleteAlias(ALIAS_ID, " Sigla mal escrita ", DEV_USER)).toEqual({ status: "ok", value: null });

    const [list, post, del] = fetchMock.mock.calls.map((call) => call[0] as Request);
    expect(list.url).toBe(`${BASE_URL}/api/v1/collection-acronym-aliases`);
    expect(await post.json()).toEqual({ alias: "R.E.P.", collection_id: COLLECTION_ID });
    expect(del.url).toBe(`${BASE_URL}/api/v1/collection-acronym-aliases/${ALIAS_ID}?reason=Sigla%20mal%20escrita`);
  });

  it("ofrece solo las colecciones activas, por nombre", async () => {
    useLive(async () =>
      json(200, [
        { id: "c-2", name: "Retablos", acronym: "RA", is_active: true },
        { id: "c-1", name: "Mates", acronym: "MBB", is_active: true },
        { id: "c-3", name: "Antigua", acronym: "OLD", is_active: false },
      ]),
    );

    const result = await fetchCollections(DEV_USER);

    expect(result).toEqual({
      status: "ok",
      value: [
        { id: "c-1", name: "Mates", acronym: "MBB" },
        { id: "c-2", name: "Retablos", acronym: "RA" },
      ],
    });
  });
});

describe("correspondencias forma de adquisición → régimen", () => {
  it("compara como el servidor: sin tildes, mayúsculas ni espacios de más", () => {
    expect(aliasKey("  Cesión   de Uso ")).toBe("cesion de uso");
  });

  it("rechaza una forma vacía o repetida", () => {
    const aliases = { "cesion de uso": "Comodato" };
    expect(tenureAliasError(aliases, "  ")).toBe("Escriba la forma de adquisición.");
    expect(tenureAliasError(aliases, "Cesión de uso")).toBe("Esa forma de adquisición ya tiene un régimen.");
    expect(tenureAliasError(aliases, "Depósito")).toBeNull();
  });

  it("detecta cambios sin importar el orden", () => {
    expect(tenureAliasesChanged({ a: "Comodato", b: "Propiedad" }, { b: "Propiedad", a: "Comodato" })).toBe(false);
    expect(tenureAliasesChanged({ a: "Comodato" }, { a: "Propiedad" })).toBe(true);
  });

  it("lee solo un objeto de textos", () => {
    expect(tenureAliasesValue({ custodia: "Comodato" })).toEqual({ custodia: "Comodato" });
    expect(tenureAliasesValue(["S/N"])).toEqual({});
    expect(tenureAliasesValue({ separators: ["/"], unsplit_markers: [] })).toEqual({});
  });
});
