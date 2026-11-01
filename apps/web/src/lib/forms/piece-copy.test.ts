import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { maskPieceForRole } from "@/lib/data/masking";
import { initialPieceCatalogs, type PieceFormCatalogs } from "@/lib/data/pieces";
import { PIECES, getPieceDetail } from "@/lib/fixtures";

import { clearPieceCopy, offerPieceCopy, pendingPieceCopy, prepareCopy, repeatableCopy, revalidateCopy, similarPieceCopy } from "./piece-copy";
import { EMPTY_PIECE_FORM, toCreateInput, type PieceFormValues } from "./piece-form";

// Copiar datos a un alta nueva (crud-manual-completo, design D4). Datos sintéticos (RNF-014).
const SAVED: PieceFormValues = {
  ...EMPTY_PIECE_FORM,
  denomination: "Retablo ayacuchano (ficticio)",
  tenure_regime: "Propiedad",
  code_i: "I-9001",
  collection_id: "col-abc",
  category_id: "cat-1",
  object_type_term_id: "obj-1",
  availability_term_id: "av-1",
  description: "Retablo de dos pisos",
  author: "Persona sintética",
  provenance: "Ayacucho",
  period_text: "Siglo XX",
  acquisition_method_term_id: "don-1",
  entry_date: "2026-10-15",
  recorded_by: "Registrador sintético",
  dimensions_text: "40 x 30 cm",
  material_term_ids: ["mat-1"],
  conservation_state_id: "cons-1",
  notes: "Con una grieta",
};

describe("«Guardar y registrar otra»", () => {
  it("«Registrar varias piezas de una donación»: repite colección, régimen, adquisición, ingreso y registrador", () => {
    const { values, source } = repeatableCopy(SAVED);
    expect(source).toBe("la pieza anterior");
    expect(values).toMatchObject({
      tenure_regime: "Propiedad",
      collection_id: "col-abc",
      acquisition_method_term_id: "don-1",
      entry_date: "2026-10-15",
      recorded_by: "Registrador sintético",
    });
  });

  it("deja vacío todo lo demás, incluidos los códigos y la denominación", () => {
    const { values } = repeatableCopy(SAVED);
    expect(values).toEqual({
      ...EMPTY_PIECE_FORM,
      tenure_regime: "Propiedad",
      collection_id: "col-abc",
      acquisition_method_term_id: "don-1",
      entry_date: "2026-10-15",
      recorded_by: "Registrador sintético",
    });
    expect(toCreateInput(values).code_i).toBeNull();
  });

  it("solo resalta los campos que llegaron con dato", () => {
    const { fields } = repeatableCopy({ ...SAVED, collection_id: "", recorded_by: "" });
    expect(fields).toEqual(["tenure_regime", "acquisition_method_term_id", "entry_date"]);
  });

  it("«Comodato copiado»: conserva el régimen y el comodante, nunca un código I", () => {
    const { values, fields } = repeatableCopy({
      ...SAVED,
      tenure_regime: "Comodato",
      code_i: "",
      lender_name: "Comodante sintético",
      loan_agreement_ref: "CONV-001",
    });
    expect(values).toMatchObject({ tenure_regime: "Comodato", lender_name: "Comodante sintético", loan_agreement_ref: "CONV-001", code_i: "" });
    expect(fields).toEqual(expect.arrayContaining(["lender_name", "loan_agreement_ref"]));
  });

  it("los datos del comodato no pasan a una pieza con otro régimen", () => {
    const { values, fields } = repeatableCopy({ ...SAVED, lender_name: "Quedó de antes", loan_agreement_ref: "CONV-002" });
    expect(values.lender_name).toBe("");
    expect(values.loan_agreement_ref).toBe("");
    expect(fields).not.toContain("lender_name");
  });
});

describe("«Registrar a partir de esta pieza»", () => {
  const term = (id: string, label: string) => ({ id, code: id.toUpperCase(), label });
  const base = getPieceDetail(PIECES[0]?.id ?? "") as ApiSchemas["PieceDetail"];
  const similar: ApiSchemas["PieceDetail"] = {
    ...base,
    denomination: "Mate burilado (ficticio)",
    tenure_regime: "Propiedad",
    code_i: "I-0236",
    author: "Persona sintética",
    provenance: "Huancayo",
    dimensions_text: "12 cm de diámetro",
    description: "Mate con escenas",
    notes: "Revisar la base",
    period: { ...base.period, text: "Siglo XX" },
    materials: [term("mat-1", "Calabaza")],
    availability: term("av-1", "En sala"),
    conservation_status: term("cons-1", "Regular"),
  };

  it("trae denominación, autor, procedencia, materiales y medidas, y dice de qué pieza vienen", () => {
    const { values, source, fields } = similarPieceCopy(similar);
    expect(source).toBe("«Mate burilado (ficticio)»");
    expect(values).toMatchObject({
      denomination: "Mate burilado (ficticio)",
      author: "Persona sintética",
      provenance: "Huancayo",
      dimensions_text: "12 cm de diámetro",
      description: "Mate con escenas",
      notes: "Revisar la base",
      period_text: "Siglo XX",
      material_term_ids: ["mat-1"],
    });
    expect(fields).toEqual(expect.arrayContaining(["denomination", "author", "provenance", "dimensions_text", "material_term_ids"]));
  });

  it("sin el código I ni el estado concreto de esa pieza: disponibilidad y conservación", () => {
    const { values, fields } = similarPieceCopy(similar);
    expect(values.code_i).toBe("");
    expect(values.availability_term_id).toBe("");
    expect(values.conservation_state_id).toBe("");
    for (const field of ["code_i", "availability_term_id", "conservation_state_id"] as const) expect(fields).not.toContain(field);
  });

  it("al guardar es una pieza nueva: nada identifica a la original", () => {
    const input = toCreateInput(similarPieceCopy(similar).values);
    expect(input.code_i).toBeNull();
    for (const field of ["id", "identifiers", "media", "movements", "location", "valuations", "parent_piece_id"]) expect(input).not.toHaveProperty(field);
  });

  it("un dato restringido para el rol no se copia", () => {
    const loan: ApiSchemas["PieceDetail"] = { ...similar, tenure_regime: "Comodato", code_i: null, lender_name: "Comodante sintético", loan_agreement_ref: "CONV-001" };
    const allowed = similarPieceCopy(maskPieceForRole(loan, () => true));
    expect(allowed.values.lender_name).toBe("Comodante sintético");
    const restricted = similarPieceCopy(maskPieceForRole(loan, () => false));
    expect(restricted.values.tenure_regime).toBe("Comodato");
    expect(restricted.values.lender_name).toBe("");
    expect(restricted.values.loan_agreement_ref).toBe("");
    expect(restricted.fields).not.toContain("lender_name");
  });
});

describe("la copia que espera el alta", () => {
  afterEach(() => clearPieceCopy());

  it("se ofrece, se lee las veces que haga falta y se limpia", () => {
    expect(pendingPieceCopy()).toBeNull();
    const copy = repeatableCopy(SAVED);
    offerPieceCopy(copy);
    expect(pendingPieceCopy()).toBe(copy);
    expect(pendingPieceCopy()).toBe(copy);
    clearPieceCopy();
    expect(pendingPieceCopy()).toBeNull();
  });
});

describe("datos copiados que ya no son válidos", () => {
  const option = (id: string) => ({ id, label: id });
  const CATALOGS: PieceFormCatalogs = {
    collections: [option("col-abc")],
    categories: [option("cat-1")],
    objectTypes: [option("obj-1")],
    acquisitionMethods: [option("don-1")],
    availabilities: [],
    materials: [option("mat-1")],
    conservationStates: [],
  };
  const SIMILAR = { ...SAVED, description: "", notes: "" };
  const descriptive = () => ({ source: "«Mate»", values: SIMILAR, fields: ["collection_id", "category_id", "object_type_term_id", "acquisition_method_term_id", "material_term_ids"] as const, dropped: {}, unchecked: false });

  it("todo vigente: nada cambia ni se avisa", () => {
    const copy = descriptive();
    const checked = revalidateCopy(copy, CATALOGS);
    expect(checked.values).toEqual(copy.values);
    expect(checked.fields).toEqual(copy.fields);
    expect(checked.dropped).toEqual({});
  });

  it("la colección retirada queda vacía, deja de marcarse como copiada y lo dice junto al campo", () => {
    const checked = revalidateCopy(descriptive(), { ...CATALOGS, collections: [option("otra")] });
    expect(checked.values.collection_id).toBe("");
    expect(checked.fields).not.toContain("collection_id");
    expect(checked.dropped.collection_id).toContain("la colección copiada fue retirada o desactivada");
    expect(toCreateInput(checked.values).collection_id).toBeNull();
  });

  it("también los términos que se desactivaron: categoría, tipo de bien y forma de adquisición", () => {
    const checked = revalidateCopy(descriptive(), { ...CATALOGS, categories: [], objectTypes: [], acquisitionMethods: [] });
    expect(checked.values).toMatchObject({ category_id: "", object_type_term_id: "", acquisition_method_term_id: "" });
    expect(Object.keys(checked.dropped).sort()).toEqual(["acquisition_method_term_id", "category_id", "object_type_term_id"]);
  });

  it("de los materiales se quita solo el que ya no se ofrece", () => {
    const copy = descriptive();
    const checked = revalidateCopy({ ...copy, values: { ...SIMILAR, material_term_ids: ["mat-1", "mat-retirado"] } }, CATALOGS);
    expect(checked.values.material_term_ids).toEqual(["mat-1"]);
    expect(checked.fields).toContain("material_term_ids");
    expect(checked.dropped.material_term_ids).toContain("se quitaron materiales");
  });

  it("un campo vacío no se considera retirado", () => {
    const empty = { ...descriptive(), values: EMPTY_PIECE_FORM, fields: [] };
    expect(revalidateCopy(empty, CATALOGS).dropped).toEqual({});
  });

  it("los datos de la maqueta siguen vigentes en sus propias listas", () => {
    const catalogs = initialPieceCatalogs();
    for (const piece of PIECES) {
      const detail = getPieceDetail(piece.id);
      if (detail) expect(revalidateCopy(similarPieceCopy(detail), catalogs).dropped).toEqual({});
    }
  });
});

describe("comprobar lo copiado antes de mostrar el formulario", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function useLive(handler: (path: string) => Response) {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");
    const fetchMock = vi.fn(async (request: Request) => handler(new URL(request.url).pathname));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("una colección retirada ya no viene en la lista, así que se vacía", async () => {
    useLive((path) => (path.endsWith("/collections") ? json([{ id: "otra", name: "Otra colección", is_active: true }]) : json([])));
    const { copy, catalogs } = await prepareCopy(repeatableCopy(SAVED));
    expect(copy.values.collection_id).toBe("");
    expect(copy.dropped.collection_id).toBeDefined();
    expect(copy.unchecked).toBe(false);
    expect(catalogs?.collections.map((item) => item.id)).toEqual(["otra"]);
  });

  it("si las listas no cargan, conserva los datos y avisa de que no se comprobaron", async () => {
    useLive(() => json({ code: "error", message: "Falla" }, 500));
    const { copy, catalogs } = await prepareCopy(repeatableCopy(SAVED));
    expect(copy.values.collection_id).toBe("col-abc");
    expect(copy.unchecked).toBe(true);
    expect(catalogs).toBeUndefined();
  });
});
