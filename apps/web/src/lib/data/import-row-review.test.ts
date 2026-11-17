import { describe, expect, it } from "vitest";

import { geminiOpinion, nextToDecide, opinionTitle, rowCode, toDecide } from "./import-row-review";
import type { ImportRow, ImportRowVerdict } from "./imports";

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

function verdict(piece: string, value: "same" | "distinct" | "unsure", confidence = 0.95, overrides: Partial<ImportRowVerdict> = {}): ImportRowVerdict {
  return { row_id: "row-1", piece_id: piece, verdict: value, confidence, reason: `Motivo ${piece}`, source: "ai", ...overrides };
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

describe("geminiOpinion", () => {
  it("sin veredictos no opina", () => {
    expect(geminiOpinion(row(), [], 0.85)).toBeNull();
  });

  it("«misma pieza» con confianza preselecciona esa pieza", () => {
    const opinion = geminiOpinion(row(), [verdict("p-1", "same"), verdict("p-2", "distinct")], 0.85);
    expect(opinion).toMatchObject({ verdict: "same", pieceId: "p-1", pick: "p-1", reason: "Motivo p-1" });
  });

  it("«distintas» con todas las candidatas preselecciona «es una pieza nueva»", () => {
    expect(geminiOpinion(row(), [verdict("p-1", "distinct"), verdict("p-2", "distinct")], 0.85)).toMatchObject({ verdict: "distinct", pick: "new" });
  });

  it("si falta juzgar una candidata, no marca nada", () => {
    expect(geminiOpinion(row(), [verdict("p-1", "distinct")], 0.85)).toMatchObject({ verdict: "unsure", pick: null });
  });

  it("con poca confianza o con dudas, no marca nada", () => {
    expect(geminiOpinion(row(), [verdict("p-1", "same", 0.6)], 0.85)).toMatchObject({ verdict: "unsure", pick: null });
    expect(geminiOpinion(row(), [verdict("p-1", "unsure", 0.9)], 0.85)).toMatchObject({ verdict: "unsure", pick: null });
  });

  it("si cree que se parece a dos piezas, deja elegir a la persona", () => {
    const opinion = geminiOpinion(row(), [verdict("p-1", "same"), verdict("p-2", "same")], 0.85);
    expect(opinion).toMatchObject({ verdict: "unsure", pick: null, reason: "Gemini cree que la fila se parece a más de una pieza: elija usted." });
  });

  it("lo que una persona sacó de su grupo no cuenta como seguro", () => {
    expect(geminiOpinion(row(), [verdict("p-1", "same", 0.99, { source: "review" })], 0.85)).toMatchObject({ pick: null });
  });

  it("titula el recuadro con la pieza", () => {
    const opinion = geminiOpinion(row(), [verdict("p-1", "same")], 0.85);
    expect(opinion && opinionTitle(opinion, "Arpa")).toBe("Es la misma pieza que «Arpa»");
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
