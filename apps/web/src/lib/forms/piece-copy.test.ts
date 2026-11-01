import { afterEach, describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { maskPieceForRole } from "@/lib/data/masking";
import { PIECES, getPieceDetail } from "@/lib/fixtures";

import { clearPieceCopy, offerPieceCopy, pendingPieceCopy, repeatableCopy, similarPieceCopy } from "./piece-copy";
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
