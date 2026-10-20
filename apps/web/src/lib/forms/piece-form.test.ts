import { describe, expect, it } from "vitest";

import { getPieceDetail, ids } from "@/lib/fixtures";

import { EMPTY_PIECE_FORM, pieceFormSchema, toCreateInput, toFormValues, toUpdateInput, type PieceFormValues } from "./piece-form";

const VALUES: PieceFormValues = {
  ...EMPTY_PIECE_FORM,
  denomination: "  Toro de Pucará  ",
  description: "Cerámica policroma",
  author: "  Taller Santos  ",
  provenance: "Puno",
  period_text: " s. XX ",
  dimensions_text: "20 x 15 cm",
  material_term_ids: ["m-1", "m-2"],
  conservation_state_id: "c-1",
  notes: "   ",
};

describe("pieceFormSchema", () => {
  it("cubre los campos de las seis secciones de design D8", () => {
    expect(Object.keys(EMPTY_PIECE_FORM).sort()).toEqual(
      [
        "denomination",
        "tenure_regime",
        "code_i",
        "collection_id",
        "category_id",
        "object_type_term_id",
        "availability_term_id",
        "lender_name",
        "loan_agreement_ref",
        "description",
        "author",
        "provenance",
        "period_text",
        "acquisition_method_term_id",
        "entry_date",
        "dimensions_text",
        "material_term_ids",
        "conservation_state_id",
        "notes",
      ].sort(),
    );
  });

  it("solo la denominación es obligatoria", () => {
    expect(pieceFormSchema.safeParse(EMPTY_PIECE_FORM).success).toBe(false);
    expect(pieceFormSchema.safeParse({ ...EMPTY_PIECE_FORM, denomination: "Toro" }).success).toBe(true);
  });
});

describe("toFormValues", () => {
  it("toma de la ficha los campos que el editor muestra", () => {
    const piece = getPieceDetail(ids.piece(1));
    if (!piece) throw new Error("El fixture de la pieza 1 no existe");

    const values = toFormValues(piece);

    expect(values.denomination).toBe(piece.denomination);
    expect(values.author).toBe(piece.author ?? "");
    expect(values.period_text).toBe(piece.period.text ?? "");
    expect(values.material_term_ids).toEqual(piece.materials.map((material) => material.id));
    expect(values.conservation_state_id).toBe(piece.conservation_status?.id ?? "");
    expect(values.collection_id).toBe(piece.collection?.id ?? "");
    expect(values.category_id).toBe(piece.category?.id ?? "");
    expect(values.object_type_term_id).toBe(piece.object_type?.id ?? "");
    expect(values.availability_term_id).toBe(piece.availability?.id ?? "");
    expect(values.acquisition_method_term_id).toBe(piece.acquisition_method?.id ?? "");
    expect(values.entry_date).toBe(piece.entry_date ?? "");
    expect(values.code_i).toBe("");
  });
});

describe("toCreateInput", () => {
  it("recorta el texto y convierte los campos vacíos en null", () => {
    const input = toCreateInput(VALUES);

    expect(input).toMatchObject({
      denomination: "Toro de Pucará",
      author: "Taller Santos",
      period: { text: "s. XX" },
      material_term_ids: ["m-1", "m-2"],
      conservation_state_id: "c-1",
      notes: null,
      code_i: null,
    });
  });

  it("sin época, materiales ni estado de conservación envía null", () => {
    const input = toCreateInput({ ...EMPTY_PIECE_FORM, denomination: "Toro" });

    expect(input.period).toBeNull();
    expect(input.material_term_ids).toBeNull();
    expect(input.conservation_state_id).toBeNull();
    expect(input.author).toBeNull();
    expect(input.collection_id).toBeNull();
    expect(input.availability_term_id).toBeNull();
    expect(input.entry_date).toBeNull();
  });

  it("envía colección, categoría, tipo de bien, adquisición, disponibilidad y fecha de ingreso", () => {
    const input = toCreateInput({
      ...VALUES,
      collection_id: "col-1",
      category_id: "cat-1",
      object_type_term_id: "ot-1",
      acquisition_method_term_id: "aq-1",
      availability_term_id: "av-1",
      entry_date: "1998-05-12",
    });

    expect(input).toMatchObject({
      collection_id: "col-1",
      category_id: "cat-1",
      object_type_term_id: "ot-1",
      acquisition_method_term_id: "aq-1",
      availability_term_id: "av-1",
      entry_date: "1998-05-12",
    });
  });

  it("envía comodante y convenio solo con régimen Comodato", () => {
    const loan = { lender_name: "  Familia Bermúdez  ", loan_agreement_ref: "Conv. 2024-03" };

    expect(toCreateInput({ ...VALUES, ...loan, tenure_regime: "Comodato" })).toMatchObject({
      lender_name: "Familia Bermúdez",
      loan_agreement_ref: "Conv. 2024-03",
    });
    const owned = toCreateInput({ ...VALUES, ...loan, tenure_regime: "Propiedad" });
    expect(owned).not.toHaveProperty("lender_name");
    expect(owned).not.toHaveProperty("loan_agreement_ref");
  });
});

describe("toUpdateInput", () => {
  it("envía los campos del editor y no incluye código I ni régimen", () => {
    const input = toUpdateInput(VALUES);

    expect(input).toMatchObject({
      denomination: "Toro de Pucará",
      author: "Taller Santos",
      material_term_ids: ["m-1", "m-2"],
      conservation_state_id: "c-1",
      notes: null,
    });
    expect(input).not.toHaveProperty("code_i");
    expect(input).not.toHaveProperty("tenure_regime");
  });

  it("conserva el tipo y el rango de años de la época al cambiar solo el texto", () => {
    const input = toUpdateInput(VALUES, { text: "ca. 1950", type: "APPROXIMATE", year_from: 1948, year_to: 1952 });

    expect(input.period).toEqual({ text: "s. XX", type: "APPROXIMATE", year_from: 1948, year_to: 1952 });
  });

  it("vaciar la época deja el texto en null sin tocar el resto", () => {
    const input = toUpdateInput({ ...VALUES, period_text: "" }, { text: "s. XX", year_from: 1900, year_to: 1999 });

    expect(input.period).toEqual({ text: null, year_from: 1900, year_to: 1999 });
  });

  it("vaciar los materiales envía una lista vacía (no null)", () => {
    expect(toUpdateInput({ ...VALUES, material_term_ids: [] }).material_term_ids).toEqual([]);
  });

  it("envía los campos de catálogo y la fecha de ingreso; vaciarlos envía null", () => {
    const filled = toUpdateInput({
      ...VALUES,
      collection_id: "col-1",
      category_id: "cat-1",
      object_type_term_id: "ot-1",
      acquisition_method_term_id: "aq-1",
      availability_term_id: "av-1",
      entry_date: "1998-05-12",
    });
    const cleared = toUpdateInput(VALUES);

    expect(filled).toMatchObject({
      collection_id: "col-1",
      category_id: "cat-1",
      object_type_term_id: "ot-1",
      acquisition_method_term_id: "aq-1",
      availability_term_id: "av-1",
      entry_date: "1998-05-12",
    });
    expect(cleared).toMatchObject({ collection_id: null, availability_term_id: null, entry_date: null });
  });

  it("con régimen Comodato envía comodante y convenio; con otro régimen no los toca", () => {
    const loan = { lender_name: "Familia Bermúdez", loan_agreement_ref: "Conv. 2024-03" };

    expect(toUpdateInput({ ...VALUES, ...loan, tenure_regime: "Comodato" })).toMatchObject(loan);
    expect(toUpdateInput({ ...VALUES, ...loan, tenure_regime: "Propiedad" })).not.toHaveProperty("lender_name");
  });

  it("no reenvía los datos de comodato que el rol no puede ver (campos enmascarados)", () => {
    const values = { ...VALUES, tenure_regime: "Comodato" as const, lender_name: "", loan_agreement_ref: "" };

    const input = toUpdateInput(values, undefined, ["lender_name", "loan_agreement_ref"]);
    const onlyAgreementMasked = toUpdateInput({ ...values, lender_name: "Familia Bermúdez" }, undefined, ["loan_agreement_ref"]);

    expect(input).not.toHaveProperty("lender_name");
    expect(input).not.toHaveProperty("loan_agreement_ref");
    expect(onlyAgreementMasked).toMatchObject({ lender_name: "Familia Bermúdez" });
    expect(onlyAgreementMasked).not.toHaveProperty("loan_agreement_ref");
  });

  it("no envía propietario legal, registrado por ni otros campos derivados", () => {
    const input = toUpdateInput({ ...VALUES, tenure_regime: "Comodato" });

    for (const derived of ["legal_owner", "recorded_by", "temporary_inventory_number", "parent_piece_id", "identifiers"]) {
      expect(input).not.toHaveProperty(derived);
    }
  });
});
