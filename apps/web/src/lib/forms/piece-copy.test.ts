import { describe, expect, it } from "vitest";

import { repeatableCopy } from "./piece-copy";
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
