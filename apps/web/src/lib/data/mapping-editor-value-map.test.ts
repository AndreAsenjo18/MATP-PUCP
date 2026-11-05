import { afterEach, describe, expect, it, vi } from "vitest";

import type { MappingTemplate } from "./import-templates";
import type { ImportBatch } from "./imports";
import {
  applyRequest,
  associateTerm,
  draftFromTemplate,
  draftStatus,
  dropMapping,
  fetchVocabularyTerms,
  foldText,
  pendingTerm,
  previewBlocker,
  putMapping,
  saveErrors,
  setColumnTarget,
  setColumnValueMap,
  syncValueMapTransform,
  templateCreateBody,
  termLabel,
  termsVocabulary,
  valueMapError,
  withValueMap,
} from "./mapping-editor";

// Spec importacion-datos — Correspondencia de valores con vocabularios controlados (4.1C).
// Datos sintéticos (RNF-014); términos del vocabulario MATERIAL sembrado [SUPUESTO T6].

const BASE_URL = "http://api.test";
const DEV_USER = "admin@matp.local";
const HEADERS = ["DENOMINACIÓN", "MATERIAL", "OBS."];
const BATCH = { headers: HEADERS, sheet_name: "SABANA", header_row: 1, source_name: "Sábana (sintética)" } as ImportBatch;
const TERMS = [
  { code: "MADERA", label: "Madera" },
  { code: "YESO", label: "Yeso" },
];

function template(): MappingTemplate {
  return {
    id: "tpl-1",
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana (sintética)",
    header_signature: "a".repeat(64),
    columns: [
      { source_column: "DENOMINACIÓN", target_field: "denomination", identifier_type_code: null, split_compound: false, transforms: ["trim"], value_map: null },
      { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: ["trim", "split:,"], value_map: null },
    ],
    defaults: {},
    description: null,
    created_at: "2026-10-22T10:00:00Z",
  };
}

const MATERIAL = 1;

function loaded() {
  return draftFromTemplate(template(), BATCH);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("tabla de correspondencias", () => {
  it("solo las columnas con destino terms:<VOCABULARIO> tienen vocabulario", () => {
    expect(termsVocabulary({ target_field: "terms:MATERIAL" })).toBe("MATERIAL");
    expect(termsVocabulary({ target_field: "denomination" })).toBeNull();
    expect(termsVocabulary({ target_field: null })).toBeNull();
  });

  it("compara los textos como la API: sin mayúsculas, tildes ni espacios repetidos", () => {
    expect(foldText("  Madera   Policromáda ")).toBe("madera policromada");
  });

  it("añade, cambia y quita correspondencias; el mismo texto con otras tildes reemplaza la anterior", () => {
    let map = putMapping({}, " madera policromada ", "MADERA");
    expect(map).toEqual({ "madera policromada": "MADERA" });
    map = putMapping(map, "yeso policromado", "YESO");
    map = putMapping(map, "madera policromada", "YESO");
    expect(map).toEqual({ "madera policromada": "YESO", "yeso policromado": "YESO" });
    expect(putMapping(map, "Madera  Policromada", "MADERA")).toEqual({ "yeso policromado": "YESO", "Madera  Policromada": "MADERA" });
    expect(dropMapping(map, "yeso policromado")).toEqual({ "madera policromada": "YESO" });
  });

  it("explica por qué no se puede añadir", () => {
    const map = { "madera policromada": "MADERA" };
    expect(valueMapError(map, " ", "MADERA")).toBe("Escriba el texto de origen.");
    expect(valueMapError(map, "Madera Policromada", "MADERA")).toBe("Ya hay una correspondencia para «madera policromada».");
    expect(valueMapError(map, "maguey", "")).toBe("Elija el término.");
    expect(valueMapError(map, "maguey", "MADERA")).toBeNull();
  });

  it("nombra el término o señala un código que no está entre los activos", () => {
    expect(termLabel(TERMS, "MADERA")).toBe("Madera");
    expect(termLabel(TERMS, "BARRO")).toBe("BARRO (no es un término activo)");
  });
});

describe("la cadena lleva value_map si y solo si hay correspondencias", () => {
  it("lo agrega al final si falta y lo quita si la tabla queda vacía", () => {
    expect(syncValueMapTransform(["trim", "split:,"], true)).toEqual(["trim", "split:,", "value_map"]);
    expect(syncValueMapTransform(["value_map", "trim"], true)).toEqual(["value_map", "trim"]);
    expect(syncValueMapTransform(["trim", "value_map"], false)).toEqual(["trim"]);
  });

  it("al guardar la tabla en la columna la cadena queda al día", () => {
    const column = loaded().columns[MATERIAL];
    const mapped = withValueMap(column, { "madera policromada": "MADERA" });
    expect(mapped).toMatchObject({ value_map: { "madera policromada": "MADERA" }, transforms: ["trim", "split:,", "value_map"] });
    expect(withValueMap(mapped, {})).toMatchObject({ value_map: null, transforms: ["trim", "split:,"] });
  });

  it("cambiar el destino a uno que no es de términos quita las correspondencias", () => {
    const draft = setColumnValueMap(loaded(), MATERIAL, { "madera policromada": "MADERA" });
    expect(setColumnTarget(draft, MATERIAL, "description").columns[MATERIAL]).toMatchObject({ value_map: null, transforms: ["trim", "split:,"] });
    expect(setColumnTarget(draft, MATERIAL, "terms:TECHNIQUE").columns[MATERIAL].value_map).toEqual({ "madera policromada": "MADERA" });
  });
});

describe("«Asociar a término» desde la vista previa", () => {
  it("agrega la correspondencia a esa columna, la plantilla queda modificada y la vista previa pide guardar", () => {
    const draft = associateTerm(loaded(), "MATERIAL", "madera policromada", "MADERA");
    expect(draft.columns[MATERIAL]).toMatchObject({ value_map: { "madera policromada": "MADERA" }, transforms: ["trim", "split:,", "value_map"] });
    expect(draftStatus(draft)).toBe("modified");
    expect(previewBlocker(draft, BATCH)).toContain("Guarde la plantilla");
    expect(pendingTerm(draft, "MATERIAL", "Madera Policromada")).toBe("MADERA");
    expect(pendingTerm(draft, "MATERIAL", "maguey")).toBeNull();
  });

  it("sin columna o sin término no cambia nada", () => {
    expect(associateTerm(loaded(), "NO EXISTE", "x", "MADERA")).toEqual(loaded());
    expect(associateTerm(loaded(), "MATERIAL", "x", "")).toEqual(loaded());
  });

  it("al guardar o validar, la correspondencia viaja con value_map en la cadena", () => {
    const draft = associateTerm(loaded(), "MATERIAL", "madera policromada", "MADERA");
    const created = templateCreateBody(draft, { name: "Sábana 4.1C", sourceName: "Sábana", description: "" }, HEADERS);
    expect(created.columns[MATERIAL]).toMatchObject({ value_map: { "madera policromada": "MADERA" }, transforms: ["trim", "split:,", "value_map"] });
    const body = applyRequest(draft, BATCH);
    expect(body.template_id).toBeNull();
    expect(body.columns?.find((c) => c.source_column === "MATERIAL")?.value_map).toEqual({ "madera policromada": "MADERA" });
  });

  it("los 422 de término inexistente o inactivo van a su columna", () => {
    const failure = {
      status: "rejected" as const,
      code: "invalid_mapping",
      message: "El mapeo de la plantilla tiene errores.",
      details: {
        errors: [
          { code: "unknown_term", message: "«maguey» se asocia al término «MAGUEY», que no existe en el vocabulario «MATERIAL».", column: "MATERIAL" },
          { code: "inactive_term", message: "«yeso» se asocia al término «Yeso» (YESO), que está desactivado.", column: "MATERIAL" },
        ],
      },
    };
    expect(saveErrors(failure).columns).toEqual({
      MATERIAL: "«maguey» se asocia al término «MAGUEY», que no existe en el vocabulario «MATERIAL». «yeso» se asocia al término «Yeso» (YESO), que está desactivado.",
    });
  });
});

describe("modo live", () => {
  it("lee los términos activos del vocabulario con la identidad de la sesión", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", BASE_URL);
    const term = (code: string, label: string, isActive: boolean) => ({ id: code, code, label, name: label, is_active: isActive, vocabulary_code: "MATERIAL" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([term("MADERA", "Madera", true), term("BARRO", "Barro", false)]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchVocabularyTerms("MATERIAL", DEV_USER);

    expect(result).toEqual({ status: "ok", value: [{ code: "MADERA", label: "Madera" }] });
    const request = (fetchMock.mock.calls[0] as unknown as [Request])[0];
    expect(request.url).toBe(`${BASE_URL}/api/v1/vocabularies/MATERIAL/terms`);
    expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
  });

  it("en modo mock no llama a la API", async () => {
    expect((await fetchVocabularyTerms("MATERIAL")).status).toBe("unavailable");
  });
});
