import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { groupByList, UnresolvedTermsPanel, type UnresolvedTerm } from "./ImportTermFix";

// Change importacion-agregar-terminos (D2, D3). Datos sintéticos (RNF-014).

const ITEMS: UnresolvedTerm[] = [
  { vocabulary: "MATERIAL", vocabulary_name: "Materiales", text: "Piedra sintética", rows: 30 },
  { vocabulary: "OBJECT_TYPE", vocabulary_name: "Tipos de bien", text: "Escultura", rows: 1 },
  { vocabulary: "MATERIAL", vocabulary_name: "Materiales", text: "Calabaza", rows: 2, inactive_term: "Calabaza" },
];
const noop = () => {};

describe("UnresolvedTermsPanel", () => {
  it("sin valores pendientes no muestra nada", () => {
    expect(render(<UnresolvedTermsPanel items={[]} canManage busy={false} onAdd={noop} />)).toBe("");
  });

  it("agrupa por lista", () => {
    expect(groupByList(ITEMS).map((group) => [group.name, group.items.map((item) => item.text)])).toEqual([
      ["Materiales", ["Piedra sintética", "Calabaza"]],
      ["Tipos de bien", ["Escultura"]],
    ]);
  });

  it("quien administra las listas puede agregar o reactivar cada valor", () => {
    const text = visibleText(render(<UnresolvedTermsPanel items={ITEMS} canManage busy={false} decidedNotice="Se pierden 2 decisiones." onAdd={noop} />));
    expect(text).toContain("Valores del archivo que no están en las listas");
    expect(text).toContain("«Piedra sintética» · 30 filas");
    expect(text).toContain("«Escultura» · 1 fila");
    expect(text).toContain("Agregar a la lista y validar de nuevo");
    expect(text).toContain("está en la lista, desactivado");
    expect(text).toContain("Reactivar y validar de nuevo");
    expect(text).toContain("Se pierden 2 decisiones.");
  });

  it("los demás ven los valores y a quién pedirlos, sin botones", () => {
    const text = visibleText(render(<UnresolvedTermsPanel items={ITEMS} canManage={false} busy={false} onAdd={noop} />));
    expect(text).toContain("«Escultura»");
    expect(text).toContain("pídalo a quien administra las listas");
    expect(text).not.toContain("Agregar a la lista");
  });
});
