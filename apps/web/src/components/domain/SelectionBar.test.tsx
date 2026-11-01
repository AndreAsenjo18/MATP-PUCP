import { describe, expect, it } from "vitest";

import type { ApiSchemas } from "@/lib/api/client";
import { finalLocations, type LocationNode } from "@/lib/data/locations";
import { EMPTY_SELECTION, setPageSelected } from "@/lib/data/selection";
import { render, visibleText } from "@/test/render";

import { SelectionBar } from "./SelectionBar";

// Ubicaciones y piezas sintéticas (RNF-014). «Estante B» es un mueble con niveles: no es destino.
const TREE: LocationNode[] = [
  {
    id: "sede-1",
    name: "Sede Central (ficticia)",
    level_type: "Sede",
    children: [
      {
        id: "dep-2",
        name: "Depósito 2",
        level_type: "Depósito",
        children: [
          { id: "est-b", name: "Estante B", level_type: "Mueble", children: [{ id: "est-b-1", name: "Nivel 1", level_type: "Nivel", children: [] }] },
          { id: "est-c", name: "Estante C", level_type: "Mueble", children: [{ id: "est-c-1", name: "Nivel 1", level_type: "Nivel", children: [] }] },
        ],
      },
    ],
  },
];
const DESTINATIONS = finalLocations(TREE);

function hit(id: string, denomination: string): ApiSchemas["SearchHit"] {
  return {
    piece: {
      id,
      denomination,
      collection: null,
      tenure_regime: "Propiedad",
      code_i: `I-${id}`,
      codes: [],
      category: null,
      conservation_status: null,
      period_text: null,
      location_label: "Sede Central (ficticia) › Depósito 2 › Estante B › Nivel 1",
      media_count: 0,
      has_location: true,
      updated_at: "2026-11-01T12:00:00Z",
    } as ApiSchemas["PieceSummary"],
    match_type: "TITLE",
    location_id: "est-b-1",
  };
}

const SELECTION = setPageSelected(EMPTY_SELECTION, [hit("101", "Manta sintética"), hit("102", "Faja sintética")], true);
const noop = () => {};

describe("barra de acciones de la selección", () => {
  it("con piezas elegidas ofrece verificar y mover; sin ellas no se muestra", () => {
    const text = visibleText(render(<SelectionBar selection={SELECTION} destinations={DESTINATIONS} onVerify={noop} onMove={noop} />));
    expect(text).toContain("2 piezas seleccionadas");
    expect(text).toContain("Verificar");
    expect(text).toContain("Mover a…");
    expect(render(<SelectionBar selection={EMPTY_SELECTION} destinations={DESTINATIONS} onVerify={noop} onMove={noop} />)).toBe("");
  });

  it("al mover solo ofrece lugares finales: un mueble con niveles no es destino", () => {
    const html = render(<SelectionBar selection={SELECTION} destinations={DESTINATIONS} onVerify={noop} onMove={noop} initialStage="choose" />);
    expect(html).toContain(">Sede Central (ficticia) › Depósito 2 › Estante C › Nivel 1</option>");
    expect(html).not.toContain(">Sede Central (ficticia) › Depósito 2 › Estante C</option>");
    expect(visibleText(html)).toContain("Mover 2 piezas a");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Revisar el traslado/);
  });

  it("confirma con la lista de piezas, dónde están ahora y el destino", () => {
    const text = visibleText(
      render(
        <SelectionBar selection={SELECTION} destinations={DESTINATIONS} onVerify={noop} onMove={noop} initialStage="confirm" initialDestination="est-c-1" />,
      ),
    );
    expect(text).toContain("¿Mover 2 piezas a Sede Central (ficticia) › Depósito 2 › Estante C › Nivel 1?");
    expect(text).toContain("I-101 Manta sintética · ahora en Sede Central (ficticia) › Depósito 2 › Estante B › Nivel 1");
    expect(text).toContain("I-102 Faja sintética");
    expect(text).toContain("Confirmar el traslado");
  });

  it("muestra el resultado de la última acción, también cuando la selección ya se vació", () => {
    const ok = render(
      <SelectionBar selection={EMPTY_SELECTION} destinations={DESTINATIONS} onVerify={noop} onMove={noop} feedback={{ kind: "ok", text: "2 piezas movidas a Nivel 1." }} />,
    );
    expect(ok).toContain('role="status"');
    expect(visibleText(ok)).toContain("2 piezas movidas a Nivel 1.");
    const error = render(
      <SelectionBar selection={SELECTION} destinations={DESTINATIONS} onVerify={noop} onMove={noop} feedback={{ kind: "error", text: "No se movió ninguna pieza." }} />,
    );
    expect(error).toContain('role="alert"');
  });
});

describe("barra de acciones en tableta (fusion-busqueda-deposito 3.4)", () => {
  it("va fija abajo y a todo el ancho por debajo de lg, con botones táctiles", () => {
    const html = render(<SelectionBar selection={SELECTION} destinations={DESTINATIONS} onVerify={noop} onMove={noop} />);
    const section = html.match(/<section[^>]*>/)?.[0] ?? "";
    for (const token of ["fixed", "inset-x-0", "bottom-0", "lg:static"]) expect(section).toContain(token);
    expect(html.match(/<button[^>]*class="[^"]*min-h-11[^"]*md:min-h-9/g)).toHaveLength(2);
  });
});
