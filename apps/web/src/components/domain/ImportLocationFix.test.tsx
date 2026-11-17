import { describe, expect, it } from "vitest";

import type { LocationNode } from "@/lib/data/locations";
import { render, visibleText } from "@/test/render";

import { canHoldPieces, placeChoices, UnresolvedLocationsPanel } from "./ImportLocationFix";

// Change importacion-aplicar-vocabularios (D4). Datos sintéticos (RNF-014).

const TREE: LocationNode[] = [
  {
    id: "sede",
    name: "Sede central",
    level_type: "Sede",
    allowed_child_types: ["Depósito"],
    children: [{ id: "dep", name: "Depósito 1", level_type: "Depósito", allowed_child_types: ["Mueble"], children: [] }],
  },
];

const noop = () => {};
const create = async () => null;

describe("placeChoices y canHoldPieces", () => {
  it("lista todos los lugares con su ruta y lo que admiten dentro", () => {
    expect(placeChoices(TREE)).toEqual([
      { id: "sede", label: "Sede central", level: "Sede", childTypes: ["Depósito"] },
      { id: "dep", label: "Sede central › Depósito 1", level: "Depósito", childTypes: ["Mueble"] },
    ]);
  });

  it("una sede no guarda piezas; un depósito sí", () => {
    const [site, space] = placeChoices(TREE);
    expect(canHoldPieces(site)).toBe(false);
    expect(canHoldPieces(space)).toBe(true);
    expect(canHoldPieces(undefined)).toBe(false);
  });
});

describe("UnresolvedLocationsPanel", () => {
  it("sin ubicaciones pendientes no muestra nada", () => {
    expect(render(<UnresolvedLocationsPanel items={[]} tree={TREE} busy={false} onAssign={noop} onCreate={create} />)).toBe("");
  });

  it("muestra cada ubicación del archivo con sus filas, para elegir o crear una", () => {
    const html = render(<UnresolvedLocationsPanel items={[{ text: "Deposito N° 1", rows: 70 }]} tree={TREE} busy={false} decidedNotice="Se pierden 2 decisiones." onAssign={noop} onCreate={create} />);
    const text = visibleText(html);
    expect(text).toContain("Ubicaciones del archivo que no existen en el museo");
    expect(text).toContain("«Deposito N° 1» · 70 filas");
    expect(text).toContain("Sede central › Depósito 1");
    expect(text).toContain("Crear una ubicación");
    expect(text).toContain("Se pierden 2 decisiones.");
    // Sin elegir una ubicación no se puede aplicar.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Usar esta ubicación y validar de nuevo/);
  });
});
