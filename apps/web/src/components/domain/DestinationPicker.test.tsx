import { describe, expect, it } from "vitest";

import type { DestinationOption } from "@/lib/data/locations";
import { render, visibleText } from "@/test/render";

import { DestinationPicker } from "./DestinationPicker";

// Datos sintéticos (RNF-014).
const noop = () => {};
const OPTIONS: DestinationOption[] = [
  { id: "n1", label: "Sede › Depósito 1 › Rack A › Nivel 1", level: "Nivel" },
  { id: "c1", label: "Sede › Depósito 1 › Rack A › Nivel 2 › Caja 01", level: "Contenedor" },
];

describe("DestinationPicker", () => {
  it("lista solo los destinos recibidos con su ruta completa y explica por qué", () => {
    const html = render(<DestinationPicker options={OPTIONS} value="" onChange={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Mover a");
    expect(text).toContain("Buscar destino");
    expect(text).toContain("Sede › Depósito 1 › Rack A › Nivel 1");
    expect(text).toContain("Solo lugares finales");
  });

  it("sin lugares finales remite a Administración", () => {
    const text = visibleText(render(<DestinationPicker options={[]} value="" onChange={noop} />));
    expect(text).toContain("No hay lugares finales disponibles");
    expect(text).toContain("Administración");
  });
});
