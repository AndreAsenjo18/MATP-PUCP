import { describe, expect, it } from "vitest";

import { getPieceDetail, ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { dimensionsLine, PieceGeneralData } from "./PieceSheet";

// Revisión de flujos (2026-11-17). Datos sintéticos (RNF-014).

describe("medidas de la ficha", () => {
  it("las medidas detalladas se leen como texto: con mayúscula y el formato de números es-PE", () => {
    const line = dimensionsLine([
      { dimension: "alto", value: 25, unit: "cm" },
      { dimension: "espesor", value: 2.3, unit: "cm" },
    ]);
    expect(line).toBe("Alto 25 cm · Espesor 2.3 cm");
  });

  it("con medidas detalladas, el texto libre se rotula como texto original", () => {
    const piece = getPieceDetail(ids.piece(1))!;
    const withDetail = { ...piece, dimensions_text: "Alto 25 cm", dimensions: [{ dimension: "alto", value: 25, unit: "cm" }] };
    const text = visibleText(render(<PieceGeneralData piece={withDetail} />));
    expect(text).toContain("Medidas (texto original)");
    expect(text).toContain("Medidas detalladas");
    const plain = visibleText(render(<PieceGeneralData piece={{ ...piece, dimensions: [] }} />));
    expect(plain).not.toContain("Medidas (texto original)");
  });
});
