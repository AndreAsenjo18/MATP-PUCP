import { describe, expect, it } from "vitest";

import type { LocationNode } from "@/lib/data/locations";
import { render, visibleText } from "@/test/render";

import { LOCATION_LEVELS, LocationTreeView, flattenLocationTree } from "./LocationsAdmin";

// Datos sintéticos (RNF-014).

const tree = [
  {
    id: "s1",
    name: "Sede Pueblo Libre",
    level_type: "Sede",
    children: [
      {
        id: "d1",
        name: "Depósito 1",
        level_type: "Depósito",
        children: [{ id: "m1", name: "Rack A", level_type: "Mueble", children: [{ id: "c1", name: "Caja 3", level_type: "Contenedor", children: [] }] }],
      },
    ],
  },
] as unknown as LocationNode[];

describe("árbol de ubicaciones", () => {
  it("muestra cada nivel en una etiqueta con su nombre y sangra a los hijos", () => {
    const html = render(<LocationTreeView nodes={tree} />);
    const text = visibleText(html);
    for (const level of ["Sede", "Depósito", "Mueble", "Contenedor"]) expect(text).toContain(level);
    expect(text).toContain("Sede Sede Pueblo Libre");
    expect(html).toContain("padding-left:20px");
    expect(html).toContain("padding-left:60px");
    expect(html).toContain("bg-verde-bg"); // Depósito
    expect(html).toContain("bg-ambar-bg"); // Mueble
  });

  it("solo los contenedores se pueden desactivar, con un botón de icono que nombra la ubicación", () => {
    const html = render(<LocationTreeView nodes={tree} onDeactivate={() => {}} />);
    expect(html.match(/aria-label="Desactivar /g)).toHaveLength(1);
    expect(html).toContain('aria-label="Desactivar Caja 3"');
    expect(html).toContain("min-h-8");
    expect(render(<LocationTreeView nodes={tree} />)).not.toContain("Desactivar");
  });

  it("lista los cinco niveles y aplana el árbol con su ruta para elegir el padre", () => {
    expect(LOCATION_LEVELS).toEqual(["Sede", "Depósito", "Mueble", "Nivel", "Contenedor"]);
    expect(flattenLocationTree(tree).map((item) => item.label)).toEqual([
      "Sede Pueblo Libre",
      "Sede Pueblo Libre › Depósito 1",
      "Sede Pueblo Libre › Depósito 1 › Rack A",
      "Sede Pueblo Libre › Depósito 1 › Rack A › Caja 3",
    ]);
  });
});
