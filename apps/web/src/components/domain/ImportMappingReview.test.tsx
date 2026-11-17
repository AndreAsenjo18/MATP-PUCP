import { describe, expect, it } from "vitest";

import { applyAiColumnMapping, draftFromScratch } from "@/lib/data/mapping-editor";
import { render, visibleText } from "@/test/render";

import { ImportMappingReview } from "./ImportMappingReview";

// Change importacion-mapeo-asistido. Datos sintéticos (RNF-014).

const noop = () => {};
const HEADERS = ["Nombre del objeto", "Lugar", "Observación interna"];
const SAMPLE = [
  { "Nombre del objeto": "Arpa sintética", Lugar: "Ayacucho", "Observación interna": "x" },
  { "Nombre del objeto": "Mate sintético", Lugar: "Huancayo", "Observación interna": null },
];

function draft() {
  return applyAiColumnMapping(draftFromScratch({ headers: HEADERS }), [
    { column: "Nombre del objeto", field: "denomination", confidence: 0.95, reason: null },
    { column: "Lugar", field: "provenance", confidence: 0.6, reason: "«Lugar» puede ser la procedencia o la ubicación." },
  ]);
}

function view(ai: "off" | "loading" | "ready" | "unavailable" = "ready") {
  return render(<ImportMappingReview draft={draft()} sampleRows={SAMPLE} ai={ai} busy={false} onChange={noop} onApply={noop} onAdvanced={noop} onBack={noop} />);
}

describe("ImportMappingReview", () => {
  it("muestra cómo quedarían las piezas con los valores reales de las primeras filas", () => {
    const text = visibleText(view());
    expect(text).toContain("Así quedarían las piezas");
    expect(text).toContain("Powered by Gemini");
    expect(text).toContain("Denominación");
    expect(text).toContain("Arpa sintética");
    expect(text).toContain("Huancayo");
  });

  it("marca la columna dudosa con su motivo y ofrece confirmarla", () => {
    const text = visibleText(view());
    expect(text).toContain("«Lugar» puede ser la procedencia o la ubicación.");
    expect(text).toContain("Es correcta");
    expect(text).toContain("1 por confirmar");
  });

  it("dice quién propuso cada columna", () => {
    expect(visibleText(view())).toContain("Nombre del objeto Gemini");
  });

  it("lista las columnas sin usar como datos que se conservan", () => {
    const text = visibleText(view());
    expect(text).toContain("Quedan sin usar 1 columna");
    expect(text).toContain("Observación interna");
  });

  it("mientras Gemini lee, lo dice y no deja validar", () => {
    const html = view("loading");
    expect(visibleText(html)).toContain("Gemini está leyendo las columnas…");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Se ve bien: validar/);
  });

  it("sin IA no muestra la insignia y sigue funcionando", () => {
    const text = visibleText(view("off"));
    expect(text).not.toContain("Powered by Gemini");
    expect(text).toContain("Ver todas las columnas");
  });
});
