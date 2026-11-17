import { describe, expect, it } from "vitest";

import { applyAiColumnMapping, draftFromScratch, setColumnTarget, type EditorDraft } from "./mapping-editor";
import { assignColumn, columnChoices, confirmTarget, DOUBT_CONFIDENCE, reviewBlocker, reviewRows, reviewSummary, unusedColumns } from "./mapping-review";

// Change importacion-mapeo-asistido. Datos sintéticos (RNF-014).

const HEADERS = ["Nombre del objeto", "N° Inventario", "Lugar", "Fecha", "Registrado por"];
const SAMPLE = [
  { "Nombre del objeto": "Arpa sintética", "N° Inventario": "I-0001", Lugar: "Ayacucho", Fecha: "s. XX", "Registrado por": "Persona sintética" },
  { "Nombre del objeto": "Mate sintético", "N° Inventario": null, Lugar: "Huancayo", Fecha: "1975", "Registrado por": "Persona sintética" },
];

/** El mapeo por el nombre y, encima, lo que propone la IA. */
function proposed(): EditorDraft {
  return applyAiColumnMapping(draftFromScratch({ headers: HEADERS }), [
    { column: "Nombre del objeto", field: "denomination", confidence: 0.95, reason: null },
    { column: "N° Inventario", field: "identifier:I", confidence: 0.9, reason: null },
    { column: "Lugar", field: "provenance", confidence: 0.6, reason: "«Lugar» puede ser la procedencia o la ubicación." },
    { column: "Fecha", field: "epoch_original_text", confidence: 0.7, reason: null },
  ]);
}

function row(draft: EditorDraft, target: string) {
  const found = reviewRows(draft, SAMPLE).find((item) => item.target === target);
  if (!found) throw new Error(`Sin fila ${target}`);
  return found;
}

describe("reviewRows", () => {
  it("muestra por dato la columna, quién la propuso y los valores de las primeras filas", () => {
    const denomination = row(proposed(), "denomination");
    expect(denomination.columns).toEqual([{ source: "Nombre del objeto", origin: "ai" }]);
    expect(denomination.values).toEqual(["Arpa sintética", "Mate sintético"]);
    expect(row(proposed(), "identifier:I").values).toEqual(["I-0001", null]);
  });

  it("marca con el motivo de la IA lo que propuso con poca confianza", () => {
    expect(row(proposed(), "provenance").doubt).toBe("«Lugar» puede ser la procedencia o la ubicación.");
    expect(row(proposed(), "epoch_original_text").doubt).toBe("«Fecha» no se parece del todo a «Época»: confírmelo.");
    expect(row(proposed(), "denomination").doubt).toBeNull();
    expect(DOUBT_CONFIDENCE).toBe(0.8);
  });

  it("resume cuántos datos se encontraron y cuántos faltan confirmar", () => {
    expect(reviewSummary(reviewRows(proposed(), SAMPLE))).toMatchObject({ found: 4, doubts: 2 });
  });

  it("suma al final los destinos que no son datos principales", () => {
    const draft = setColumnTarget(proposed(), HEADERS.indexOf("Registrado por"), "recorded_by");
    const rows = reviewRows(draft, SAMPLE);
    expect(rows.at(-1)).toMatchObject({ target: "recorded_by", label: "Registrador" });
  });
});

describe("assignColumn y confirmTarget", () => {
  it("confirmar deja de marcar la duda y pasa la columna a «Usted»", () => {
    const draft = confirmTarget(proposed(), "provenance");
    expect(row(draft, "provenance")).toMatchObject({ doubt: null, columns: [{ source: "Lugar", origin: "user" }] });
  });

  it("elegir otra columna para un dato de valor único se la quita a la anterior", () => {
    const draft = assignColumn(proposed(), "epoch_original_text", "Registrado por");
    expect(row(draft, "epoch_original_text").columns).toEqual([{ source: "Registrado por", origin: "user" }]);
    expect(unusedColumns(draft)).toContain("Fecha");
  });

  it("los códigos admiten varias columnas", () => {
    const draft = assignColumn(proposed(), "identifier:I", "Fecha");
    expect(row(draft, "identifier:I").columns.map((column) => column.source)).toEqual(["N° Inventario", "Fecha"]);
  });

  it("«No usar ninguna columna» deja el dato sin columna", () => {
    const draft = assignColumn(proposed(), "provenance", null);
    expect(row(draft, "provenance").columns).toEqual([]);
    expect(unusedColumns(draft)).toContain("Lugar");
  });

  it("elegir la misma columna la confirma", () => {
    const draft = assignColumn(proposed(), "provenance", "Lugar");
    expect(row(draft, "provenance")).toMatchObject({ doubt: null, columns: [{ source: "Lugar", origin: "user" }] });
  });
});

describe("columnChoices", () => {
  it("lista las columnas del archivo con sus ejemplos y a qué dato van hoy", () => {
    const choices = columnChoices(proposed(), SAMPLE);
    expect(choices.find((choice) => choice.source === "Lugar")).toEqual({ source: "Lugar", examples: "Ayacucho · Huancayo", current: "Procedencia" });
  });

  it("filtra por el nombre o por los ejemplos, sin tildes", () => {
    expect(columnChoices(proposed(), SAMPLE, "huancayo").map((choice) => choice.source)).toEqual(["Lugar"]);
    expect(columnChoices(proposed(), SAMPLE, "N° INV").map((choice) => choice.source)).toEqual(["N° Inventario"]);
  });
});

describe("reviewBlocker", () => {
  it("no valida sin denominación", () => {
    expect(reviewBlocker(assignColumn(proposed(), "denomination", null))).toBe("Falta indicar de qué columna sale la denominación.");
    expect(reviewBlocker(proposed())).toBeNull();
  });
});

describe("applyAiColumnMapping con origen", () => {
  it("la IA no cambia lo que ya eligió la persona", () => {
    const mine = setColumnTarget(draftFromScratch({ headers: HEADERS }), 2, "notes");
    const draft = applyAiColumnMapping(mine, [{ column: "Lugar", field: "provenance", confidence: 0.9 }]);
    expect(row(draft, "notes").columns).toEqual([{ source: "Lugar", origin: "user" }]);
  });
});
