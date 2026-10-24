import { afterEach, describe, expect, it, vi } from "vitest";

import { createTemplate, updateTemplate, type MappingTemplate } from "./import-templates";
import type { ImportBatch } from "./imports";
import {
  addTransform,
  applyNotice,
  applyRequest,
  applySource,
  canonicalColumn,
  columnErrors,
  draftFromScratch,
  draftFromTemplate,
  draftStatus,
  droppedColumns,
  moveTransform,
  parseTransform,
  previewBlocker,
  removeTransform,
  saveErrors,
  saveFormError,
  setColumnTarget,
  setColumnTransforms,
  sourceChanged,
  targetOptions,
  templateDefaultsText,
  targetValue,
  templateCreateBody,
  templateUpdateBody,
  transformArgError,
  transformLabel,
  type EditorDraft,
} from "./mapping-editor";

// Datos sintéticos (RNF-014); cabeceras ilustrativas de la sábana sintética [SUPUESTO A1].

const BASE_URL = "http://api.test";
const DEV_USER = "admin@matp.local";
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

/** Como la devuelve la API: un código de tipo fijo llega como `identifier` + `identifier_type_code`. */
function template(overrides: Partial<MappingTemplate> = {}): MappingTemplate {
  return {
    id: TEMPLATE_ID,
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana (sintética)",
    header_signature: "a".repeat(64),
    columns: [
      { source_column: "N°", target_field: null, identifier_type_code: null, split_compound: false, transforms: [], value_map: null },
      { source_column: "N° INV", target_field: "identifier", identifier_type_code: "I", split_compound: false, transforms: ["absence_markers"], value_map: null },
      { source_column: "DENOMINACIÓN", target_field: "denomination", identifier_type_code: null, split_compound: false, transforms: ["trim"], value_map: null },
      { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: ["trim", "split:,"], value_map: null },
    ],
    defaults: { tenure_regime: "Propiedad", collection: "LRM" },
    description: null,
    created_at: "2026-10-22T10:00:00Z",
    ...overrides,
  };
}

const HEADERS = ["N°", "N° INV", "DENOMINACIÓN", "MATERIAL", "FOTO"];
const BATCH = { headers: HEADERS, sheet_name: "SABANA", header_row: 1, source_name: "Sábana (sintética)" } as ImportBatch;

function loaded(): EditorDraft {
  return draftFromTemplate(template(), BATCH);
}

describe("borrador a partir de una plantilla", () => {
  it("una columna por cabecera del archivo; las nuevas quedan como dato de origen", () => {
    const draft = loaded();
    expect(draft.columns.map((c) => [c.source_column, c.target_field])).toEqual([
      ["N°", null],
      ["N° INV", "identifier:I"],
      ["DENOMINACIÓN", "denomination"],
      ["MATERIAL", "terms:MATERIAL"],
      ["FOTO", null],
    ]);
    // El régimen del lote parte del de la plantilla; los de la plantilla se conservan tal cual.
    expect(draft.tenureDefault).toBe("Propiedad");
    expect(draft.templateDefaults).toEqual({ tenure_regime: "Propiedad", collection: "LRM" });
  });

  it("recién cargada está sin cambios; la forma `identifier` + tipo es la misma que `identifier:I`", () => {
    expect(draftStatus(loaded())).toBe("unchanged");
    expect(canonicalColumn({ source_column: "X", target_field: "identifier", identifier_type_code: "I", split_compound: false })).toMatchObject({
      target_field: "identifier:I",
      identifier_type_code: null,
    });
  });

  it("quita las columnas que el archivo no trae y entonces la plantilla queda modificada", () => {
    const batch = { ...BATCH, headers: ["N°", "DENOMINACIÓN", "MATERIAL"] } as ImportBatch;
    const draft = draftFromTemplate(template(), batch);
    expect(droppedColumns(draft, batch)).toEqual(["N° INV"]);
    expect(draft.columns.map((c) => c.source_column)).toEqual(["N°", "DENOMINACIÓN", "MATERIAL"]);
    expect(draftStatus(draft)).toBe("modified");
  });

  it("«Empezar desde cero» parte de la sugerencia por cabeceras y es un mapeo nuevo", () => {
    const draft = draftFromScratch(BATCH);
    expect(draft.base).toBeNull();
    expect(draftStatus(draft)).toBe("new");
    expect(draft.columns.find((c) => c.source_column === "DENOMINACIÓN")?.target_field).toBe("denomination");
  });
});

describe("estado del borrador", () => {
  it("cambiar destino o transformaciones la modifica; deshacerlo la deja sin cambios", () => {
    const draft = loaded();
    const retargeted = setColumnTarget(draft, 2, "description");
    expect(draftStatus(retargeted)).toBe("modified");
    expect(draftStatus(setColumnTarget(retargeted, 2, "denomination"))).toBe("unchanged");
    const extra = setColumnTransforms(draft, 2, ["trim", "upper"]);
    expect(draftStatus(extra)).toBe("modified");
    expect(draftStatus(setColumnTransforms(extra, 2, ["trim"]))).toBe("unchanged");
  });

  it("el régimen es un valor del lote: elegirlo o quitarlo no modifica la plantilla", () => {
    expect(draftStatus({ ...loaded(), tenureDefault: "Comodato" })).toBe("unchanged");
    expect(draftStatus({ ...loaded(), tenureDefault: "" })).toBe("unchanged");
  });

  it("explica los valores por defecto que trae la plantilla", () => {
    expect(templateDefaultsText({ tenure_regime: "Propiedad", collection: "LRM" })).toBe("régimen Propiedad, colección LRM");
    expect(templateDefaultsText({})).toBeNull();
  });

  it("detecta otra hoja u otra fila de cabeceras", () => {
    expect(sourceChanged(loaded(), BATCH)).toBe(false);
    expect(sourceChanged({ ...loaded(), sheetName: "Otra" }, BATCH)).toBe(true);
    expect(sourceChanged({ ...loaded(), headerRow: 3 }, BATCH)).toBe(true);
  });
});

describe("destino de una columna", () => {
  it("ofrece un destino de términos por vocabulario", () => {
    const options = targetOptions([{ code: "MATERIAL", name: "Materiales" }]);
    expect(options.find((o) => o.value === "terms:MATERIAL")?.label).toBe("Términos: Materiales");
    expect(options[0]).toEqual({ value: "", label: "Dato de origen (se conserva sin mapear)" });
  });

  it("los códigos sin tipo fijo se separan; con tipo fijo, no", () => {
    const draft = loaded();
    expect(setColumnTarget(draft, 1, "identifier").columns[1]).toMatchObject({ target_field: "identifier", split_compound: true });
    expect(setColumnTarget(draft, 1, "identifier:COLECCION").columns[1]).toMatchObject({ target_field: "identifier:COLECCION", split_compound: false });
    expect(targetValue(setColumnTarget(draft, 1, "").columns[1])).toBe("");
  });
});

describe("cadena de transformaciones (design D2)", () => {
  it("lee el argumento después del primer «:»", () => {
    expect(parseTransform("split:,")).toEqual({ code: "split", arg: "," });
    expect(parseTransform("split::")).toEqual({ code: "split", arg: ":" });
    expect(parseTransform("trim")).toEqual({ code: "trim", arg: null });
  });

  it("nombra cada paso en español", () => {
    expect(transformLabel("trim")).toBe("Quitar espacios");
    expect(transformLabel("split:,")).toBe("Separar por un carácter («,»)");
    expect(transformLabel("date:dd/mm/yyyy")).toBe("Leer como fecha («dd/mm/yyyy»)");
    expect(transformLabel("desconocida")).toBe("desconocida");
  });

  it("exige el argumento en split, date y default", () => {
    expect(transformArgError("split", "")).toBe("Indique separador.");
    expect(transformArgError("split", " ")).toBeNull();
    expect(transformArgError("date", "dd-mm")).toContain("dd/mm/yyyy o yyyy");
    expect(transformArgError("date", "yyyy")).toBeNull();
    expect(transformArgError("default", "")).toBe("Indique valor.");
    expect(transformArgError("trim", "")).toBeNull();
    expect(transformArgError("", "")).toBe("Elija una transformación.");
  });

  it("añade, quita, sube y baja pasos", () => {
    const chain = addTransform(addTransform(["trim"], "split", ";"), "upper");
    expect(chain).toEqual(["trim", "split:;", "upper"]);
    expect(addTransform(chain, "split", "")).toEqual(chain);
    expect(removeTransform(chain, 1)).toEqual(["trim", "upper"]);
    expect(moveTransform(chain, 2, -1)).toEqual(["trim", "upper", "split:;"]);
    expect(moveTransform(chain, 0, 1)).toEqual(["split:;", "trim", "upper"]);
    expect(moveTransform(chain, 0, -1)).toEqual(chain);
    expect(moveTransform(chain, 2, 1)).toEqual(chain);
  });
});

describe("guardar como plantilla", () => {
  const form = { name: "  Sábana 2025  ", sourceName: "Sábana (sintética)", description: "" };

  it("guardar como nueva exige nombre y fuente", () => {
    expect(saveFormError({ ...form, name: " " }, "new")).toBe("Indique un nombre para la plantilla.");
    expect(saveFormError({ ...form, sourceName: "" }, "new")).toBe("Indique la fuente del archivo.");
    expect(saveFormError({ ...form, name: "" }, "update")).toBeNull();
  });

  it("POST lleva todas las cabeceras y columnas, también las de origen, y los valores por defecto", () => {
    const body = templateCreateBody(setColumnTransforms(loaded(), 2, ["trim", "upper"]), form, HEADERS);
    expect(body.name).toBe("Sábana 2025");
    expect(body.headers).toEqual(HEADERS);
    expect(body.columns.map((c) => c.source_column)).toEqual(HEADERS);
    expect(body.columns[1]).toMatchObject({ target_field: "identifier:I", transforms: ["absence_markers"] });
    expect(body.columns[2].transforms).toEqual(["trim", "upper"]);
    expect(body.defaults).toEqual({ collection: "LRM", tenure_regime: "Propiedad" });
    expect(body.description).toBeNull();
  });

  it("una plantilla nueva toma como suyo el régimen elegido para el lote", () => {
    expect(templateCreateBody({ ...loaded(), tenureDefault: "Comodato" }, form, HEADERS).defaults).toEqual({ collection: "LRM", tenure_regime: "Comodato" });
    expect(templateCreateBody({ ...draftFromScratch(BATCH), tenureDefault: "Propiedad" }, form, HEADERS).defaults).toEqual({ tenure_regime: "Propiedad" });
    expect(templateCreateBody(draftFromScratch(BATCH), form, HEADERS).defaults).toEqual({});
  });

  it("PATCH solo cambia el nombre si se escribió otro", () => {
    expect(templateUpdateBody(loaded(), { ...form, name: "" }, HEADERS).name).toBeUndefined();
    expect(templateUpdateBody(loaded(), { ...form, name: "Plantilla sábana sintética v1" }, HEADERS).name).toBeUndefined();
    expect(templateUpdateBody(loaded(), form, HEADERS)).toMatchObject({ name: "Sábana 2025", headers: HEADERS });
  });

  it("PATCH conserva los valores por defecto de la plantilla: el régimen del lote no la cambia", () => {
    expect(templateUpdateBody({ ...loaded(), tenureDefault: "Comodato" }, form, HEADERS).defaults).toEqual({ tenure_regime: "Propiedad", collection: "LRM" });
    expect(templateUpdateBody({ ...loaded(), tenureDefault: "" }, form, HEADERS).defaults).toEqual({ tenure_regime: "Propiedad", collection: "LRM" });
  });

  it("el nombre repetido va al campo; los errores del mapeo, a su columna", () => {
    expect(saveErrors({ status: "rejected", code: "template_name_taken", message: "Ya existe una plantilla activa llamada «X»." })).toEqual({
      name: "Ya existe una plantilla activa llamada «X».",
      columns: {},
    });
    const invalid = {
      status: "rejected" as const,
      code: "invalid_mapping",
      message: "El mapeo tiene errores.",
      details: { errors: [{ column: "MATERIAL", message: "El vocabulario «X» no existe." }, { column: null, message: "Debe indicar la denominación." }] },
    };
    expect(saveErrors(invalid)).toEqual({ name: null, columns: { MATERIAL: "El vocabulario «X» no existe.", "": "Debe indicar la denominación." } });
    expect(columnErrors({ status: "unavailable", message: "Sin conexión." })).toEqual({ "": "Sin conexión." });
  });
});

describe("vista previa y validar (design D1, D4)", () => {
  it("la vista previa exige la plantilla guardada, sin cambios y con la misma hoja", () => {
    expect(previewBlocker(loaded(), BATCH)).toBeNull();
    expect(previewBlocker(setColumnTarget(loaded(), 2, "description"), BATCH)).toContain("Guarde la plantilla");
    expect(previewBlocker(draftFromScratch(BATCH), BATCH)).toContain("Guarde la plantilla");
    expect(previewBlocker({ ...loaded(), headerRow: 2 }, BATCH)).toContain("Cambió la hoja o la fila de cabeceras");
  });

  it("sin cambios valida con template_id y sin columnas", () => {
    expect(applySource(loaded(), BATCH)).toEqual({ kind: "template", templateId: TEMPLATE_ID, tenureDefault: "Propiedad" });
    const body = applyRequest(loaded(), BATCH);
    expect(body.template_id).toBe(TEMPLATE_ID);
    expect(body.columns).toEqual([]);
    expect(applyNotice(loaded(), BATCH)).toBeNull();
  });

  it("el régimen del lote viaja como defaults junto con template_id, sobre los de la plantilla", () => {
    const comodato = applyRequest({ ...loaded(), tenureDefault: "Comodato" }, BATCH);
    expect(comodato.template_id).toBe(TEMPLATE_ID);
    expect(comodato.columns).toEqual([]);
    expect(comodato.defaults).toEqual({ tenure_regime: "Comodato" });
    // Sin régimen elegido no se envía ninguno: la API aplica los de la plantilla.
    expect(applyRequest({ ...loaded(), tenureDefault: "" }, BATCH).defaults).toEqual({});
  });

  it("un borrador sin guardar valida con sus columnas (v1), sin plantilla, y avisa", () => {
    const draft = setColumnTransforms(loaded(), 2, ["trim", "upper"]);
    const body = applyRequest(draft, BATCH);
    expect(body.template_id).toBeNull();
    expect(body.columns?.map((c) => c.source_column)).toEqual(["N° INV", "DENOMINACIÓN", "MATERIAL"]);
    expect(body.columns?.[1].transforms).toEqual(["trim", "upper"]);
    expect(body.defaults).toEqual({ collection: "LRM", tenure_regime: "Propiedad" });
    expect(applyNotice(draft, BATCH)).toBe("Este mapeo se usará solo en este lote: no queda guardado como plantilla.");
    // Con columnas, los valores por defecto de la plantilla van con el régimen del lote encima.
    expect(applyRequest({ ...draft, tenureDefault: "Comodato" }, BATCH).defaults).toEqual({ collection: "LRM", tenure_regime: "Comodato" });
    expect(applyRequest({ ...draft, tenureDefault: "" }, BATCH).defaults).toEqual({ collection: "LRM", tenure_regime: "Propiedad" });
  });

  it("otra hoja se envía con las columnas para que el lote se vuelva a leer", () => {
    const body = applyRequest({ ...loaded(), sheetName: "Otra" }, BATCH);
    expect(body.template_id).toBeNull();
    expect(body.sheet_name).toBe("Otra");
  });
});

describe("modo live", () => {
  it("crea la plantilla con POST y la identidad de la sesión", async () => {
    const fetchMock = useLive(async () => json(201, template({ id: "nueva" })));
    const body = templateCreateBody(loaded(), { name: "Sábana 2025", sourceName: "Sábana", description: "" }, HEADERS);

    const result = await createTemplate(body, DEV_USER);

    expect(result).toMatchObject({ status: "ok", value: { id: "nueva" } });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${BASE_URL}/api/v1/import-templates`);
    expect(request.headers.get("X-MATP-User")).toBe(DEV_USER);
    expect(await request.json()).toEqual(body);
  });

  it("guarda cambios con PATCH y devuelve el 409 del nombre repetido", async () => {
    const fetchMock = useLive(async () => json(409, { code: "template_name_taken", message: "Ya existe una plantilla activa llamada «Sábana 2025».", details: {} }));

    const result = await updateTemplate(TEMPLATE_ID, templateUpdateBody(loaded(), { name: "Sábana 2025", sourceName: "", description: "" }, HEADERS), DEV_USER);

    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe(`${BASE_URL}/api/v1/import-templates/${TEMPLATE_ID}`);
    expect(result).toMatchObject({ status: "rejected", code: "template_name_taken", message: expect.stringContaining("Sábana 2025") });
  });
});
