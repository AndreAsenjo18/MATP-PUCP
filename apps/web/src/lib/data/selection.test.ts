import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";

import { EMPTY_SELECTION, batchMoveRequest, pageSelectionState, setPageSelected, toggleSelected, verificationBody } from "./selection";

// Resultados sintéticos (RNF-014).
function hit(id: string, locationId: string | null = `loc-${id}`): ApiSchemas["SearchHit"] {
  return {
    piece: {
      id,
      denomination: `Pieza ${id} (sintética)`,
      collection: null,
      tenure_regime: "Propiedad",
      code_i: `I-${id}`,
      codes: [],
      category: null,
      conservation_status: null,
      period_text: null,
      location_label: "Sede Central › Depósito 2",
      media_count: 0,
      has_location: true,
      updated_at: "2026-11-01T12:00:00Z",
    } as ApiSchemas["PieceSummary"],
    match_type: "TITLE",
    ...(locationId ? { location_id: locationId } : {}),
  };
}

describe("selección de piezas", () => {
  it("elige y suelta una pieza, con lo que la confirmación necesita y la ubicación que se vio", () => {
    const one = toggleSelected(EMPTY_SELECTION, hit("1"));
    expect(one.get("1")).toEqual({
      id: "1",
      denomination: "Pieza 1 (sintética)",
      codeI: "I-1",
      locationLabel: "Sede Central › Depósito 2",
      locationId: "loc-1",
    });
    expect(toggleSelected(one, hit("1")).size).toBe(0);
    expect(toggleSelected(EMPTY_SELECTION, hit("2", null)).get("2")?.locationId).toBeNull();
    expect(EMPTY_SELECTION.size).toBe(0);
  });

  it("elige o suelta toda la página sin tocar lo elegido en otras páginas", () => {
    const fromOtherPage = toggleSelected(EMPTY_SELECTION, hit("9"));
    const page = [hit("1"), hit("2")];
    const all = setPageSelected(fromOtherPage, page, true);
    expect([...all.keys()].sort()).toEqual(["1", "2", "9"]);
    expect(pageSelectionState(all, page)).toBe("all");
    expect([...setPageSelected(all, page, false).keys()]).toEqual(["9"]);
  });

  it("sabe si la página está elegida entera, en parte o nada", () => {
    const page = [hit("1"), hit("2")];
    expect(pageSelectionState(EMPTY_SELECTION, page)).toBe("none");
    expect(pageSelectionState(toggleSelected(EMPTY_SELECTION, hit("2")), page)).toBe("some");
  });
});

describe("acciones del depósito con la selección", () => {
  it("mueve la selección en un solo lote con la ubicación que se vio de cada pieza", () => {
    const selection = setPageSelected(EMPTY_SELECTION, [hit("1"), hit("2", null)], true);
    expect(batchMoveRequest(selection, "nivel-1", "  Reorganización del estante ")).toEqual({
      movement_type: "MOVE",
      to_location_id: "nivel-1",
      reason: "Reorganización del estante",
      items: [
        { piece_id: "1", expected_from_location_id: "loc-1" },
        { piece_id: "2", expected_from_location_id: null },
      ],
    });
    expect(batchMoveRequest(selection, "nivel-1", "   ").reason).toBeNull();
  });

  it("verifica con la misma operación que la vista de depósito", () => {
    expect(verificationBody()).toEqual({ movement_type: "VERIFICATION" });
  });
});
