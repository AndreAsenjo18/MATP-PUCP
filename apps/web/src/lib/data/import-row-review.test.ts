import { describe, expect, it } from "vitest";

import { nextToDecide, rowCode, toDecide } from "./import-row-review";
import type { ImportRow } from "./imports";

// Change importacion-revision-filas-compacta. Datos sintéticos (RNF-014).

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    id: "row-1",
    batch_id: "batch-1",
    source_row_number: 2,
    raw_data: { Nombre: "Arpa sintética" },
    mapped_data: { fields: { denomination: "Arpa sintética" }, identifiers: [{ type: "I", original_value: "I-0001", normalized_value: "I-0001" }, { type: "COLECCION", original_value: "MMZ 2", normalized_value: "MMZ 2" }] },
    classification: "POSSIBLE_DUPLICATE",
    has_validation_errors: false,
    validation_errors: [],
    matches: [
      { kind: "similar_piece", piece_id: "p-1", score: 0.9, denomination: "Arpa" },
      { kind: "similar_piece", piece_id: "p-2", score: 0.6, denomination: "Arpa pequeña" },
    ],
    diff: [],
    decision: "PENDING",
    decision_reason: null,
    target_piece_id: null,
    resolution: null,
    action: "CREATE",
    images: [],
    ...overrides,
  };
}


describe("rowCode y toDecide", () => {
  it("muestra el código de colección antes que el I", () => {
    expect(rowCode(row())).toBe("MMZ 2");
    expect(rowCode(row({ mapped_data: null }))).toBeNull();
  });

  it("una fila parecida y sin resolver pide decidir; resuelta o ya decidida, no", () => {
    expect(toDecide(row())).toBe(true);
    expect(toDecide(row({ resolution: { as_new: true } }))).toBe(false);
    expect(toDecide(row({ decision: "EXCLUDED" }))).toBe(false);
    expect(toDecide(row({ classification: "NEW" }))).toBe(false);
  });
});

describe("nextToDecide", () => {
  it("salta las filas ya decididas y da la vuelta", () => {
    const rows = [row({ id: "a" }), row({ id: "b", resolution: { as_new: true } }), row({ id: "c" })];
    expect(nextToDecide(rows, "a")?.id).toBe("c");
    expect(nextToDecide(rows, "c")?.id).toBe("a");
    expect(nextToDecide(rows, "a", new Set(["c"]))).toBeNull();
  });
});
