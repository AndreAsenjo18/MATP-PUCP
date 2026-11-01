import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";

import { EMPTY_SELECTION, pageSelectionState, setPageSelected, toggleSelected } from "./selection";

// Piezas sintéticas (RNF-014).
function piece(id: string, denomination = `Pieza ${id} (sintética)`): ApiSchemas["PieceSummary"] {
  return {
    id,
    denomination,
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
  } as ApiSchemas["PieceSummary"];
}

describe("selección de piezas", () => {
  it("elige y suelta una pieza, con lo que la confirmación necesita", () => {
    const one = toggleSelected(EMPTY_SELECTION, piece("1"));
    expect(one.get("1")).toEqual({ id: "1", denomination: "Pieza 1 (sintética)", codeI: "I-1", locationLabel: "Sede Central › Depósito 2" });
    expect(toggleSelected(one, piece("1")).size).toBe(0);
    expect(EMPTY_SELECTION.size).toBe(0);
  });

  it("elige o suelta toda la página sin tocar lo elegido en otras páginas", () => {
    const fromOtherPage = toggleSelected(EMPTY_SELECTION, piece("9"));
    const page = [piece("1"), piece("2")];
    const all = setPageSelected(fromOtherPage, page, true);
    expect([...all.keys()].sort()).toEqual(["1", "2", "9"]);
    expect(pageSelectionState(all, page)).toBe("all");
    expect([...setPageSelected(all, page, false).keys()]).toEqual(["9"]);
  });

  it("sabe si la página está elegida entera, en parte o nada", () => {
    const page = [piece("1"), piece("2")];
    expect(pageSelectionState(EMPTY_SELECTION, page)).toBe("none");
    expect(pageSelectionState(toggleSelected(EMPTY_SELECTION, piece("2")), page)).toBe("some");
  });
});
