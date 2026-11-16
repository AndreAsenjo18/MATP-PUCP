import { describe, expect, it } from "vitest";

import { computeIncompletePieces, missingFieldsOf } from "@/lib/fixtures/kpis-reports";
import { PIECES } from "@/lib/fixtures/pieces";
import { render, visibleText } from "@/test/render";

import { ALERT_CARDS, FIELD_LABELS, IncompleteTriage, missingLabels, updateFromForm } from "./IncompleteTriage";

// Spec calidad-datos — Completar piezas incompletas desde la bandeja (change
// `completar-piezas-incompletas`). Datos sintéticos (RNF-014).

describe("qué le falta a una pieza", () => {
  it("dice lo físico con palabras cortas y los campos por su nombre, sin códigos internos", () => {
    const labels = missingLabels({
      alerts: ["MISSING_INVENTORY_CODE", "MISSING_PHOTO", "MISSING_LOCATION", "MISSING_RECOMMENDED_FIELDS"],
      missing_fields: ["category_id", "materials"],
    });
    expect(labels).toEqual({ alerts: ["Código I", "Foto", "Ubicación"], fields: "categoría, materiales" });
    expect(missingLabels({ alerts: ["MISSING_PHOTO"], missing_fields: [] })).toEqual({ alerts: ["Foto"], fields: null });
  });

  it("cada campo de las reglas de completitud tiene su nombre en llano", () => {
    for (const field of ["denomination", "tenure_regime", "collection_id", "category_id", "description", "epoch_original_text", "materials", "dimensions_text", "conservation_state_id", "provenance"]) {
      expect(FIELD_LABELS[field]).toMatch(/^[a-záéíóúñ ]+$/);
    }
  });
});

describe("cambios que guarda el panel", () => {
  it("solo los campos con valor, recortados; la época va en el período", () => {
    expect(
      updateFromForm({ category_id: "cat-1", provenance: "  Ayacucho ", description: "   ", epoch_original_text: "Siglo XX", materials: ["m-1", "m-2"] }),
    ).toEqual({ category_id: "cat-1", provenance: "Ayacucho", period: { text: "Siglo XX" }, material_term_ids: ["m-1", "m-2"] });
    expect(updateFromForm({})).toEqual({});
  });
});

describe("pestaña «Piezas incompletas»", () => {
  it("abre con «¿Qué les falta?» y una tarjeta que filtra por cada alerta, en llano", () => {
    const html = render(<IncompleteTriage canDownload canEdit canMove canUpload />);
    const text = visibleText(html);
    expect(text).toContain("¿Qué les falta?");
    for (const card of ALERT_CARDS) expect(text).toContain(card.label);
    expect(text).not.toContain("Código no normalizable");
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(ALERT_CARDS.length);
    expect(text).toContain("Descargar");
    expect(html).not.toMatch(/<input[^>]*type="checkbox"/);
  });

  it("sin permiso de exportar no ofrece descargar", () => {
    expect(visibleText(render(<IncompleteTriage canDownload={false} canEdit canMove canUpload />))).not.toContain("Descargar");
  });
});

describe("campos faltantes en la demostración", () => {
  it("se calculan con las reglas por omisión y acompañan a la alerta de campos recomendados", () => {
    for (const piece of PIECES) {
      const missing = missingFieldsOf(piece);
      expect(missing.every((field) => field in FIELD_LABELS)).toBe(true);
    }
    const withRecommended = computeIncompletePieces().filter((item) => item.alerts.includes("MISSING_RECOMMENDED_FIELDS"));
    for (const item of withRecommended) expect(item.missing_fields?.length ?? 0).toBeGreaterThan(0);
  });
});
