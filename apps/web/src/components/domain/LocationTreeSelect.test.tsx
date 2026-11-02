import { describe, expect, it } from "vitest";

import { locationTrail, locationTreeRows, type LocationNode } from "@/lib/data/locations";
import { render, visibleText } from "@/test/render";

import { LOCATION_TREE_HINT, LocationTreeSelect } from "./LocationTreeSelect";

// Ubicaciones sintéticas (RNF-014): sede › depósito › mueble › nivel.
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
          {
            id: "est-b",
            name: "Estante B",
            level_type: "Mueble",
            children: [
              { id: "est-b-1", name: "Nivel 1", level_type: "Nivel", children: [] },
              { id: "est-b-2", name: "Nivel 2", level_type: "Nivel", children: [] },
            ],
          },
          { id: "est-c", name: "Estante C", level_type: "Mueble", children: [] },
        ],
      },
    ],
  },
];
const noop = () => {};

describe("filas del árbol de ubicaciones", () => {
  it("sin búsqueda muestra solo las ramas abiertas, con su profundidad y ruta", () => {
    const rows = locationTreeRows(TREE, { expanded: new Set(["sede-1"]) });
    expect(rows.map((row) => [row.node.name, row.depth, row.hasChildren, row.expanded])).toEqual([
      ["Sede Central (ficticia)", 0, true, true],
      ["Depósito 2", 1, true, false],
    ]);
    expect(rows[1].path).toEqual(["Sede Central (ficticia)", "Depósito 2"]);
  });

  it("con búsqueda muestra lo que coincide con sus ascendientes, abierto y sin tildes", () => {
    const rows = locationTreeRows(TREE, { query: "deposito 2 ", expanded: new Set() });
    expect(rows.map((row) => row.node.name)).toEqual(["Sede Central (ficticia)", "Depósito 2"]);
    const nivel = locationTreeRows(TREE, { query: "nivel 2" });
    expect(nivel.map((row) => row.node.name)).toEqual(["Sede Central (ficticia)", "Depósito 2", "Estante B", "Nivel 2"]);
    expect(locationTreeRows(TREE, { query: "sótano" })).toEqual([]);
  });

  it("encuentra el camino desde la sede hasta un lugar", () => {
    expect(locationTrail(TREE, "est-b-1")?.map((node) => node.id)).toEqual(["sede-1", "dep-2", "est-b", "est-b-1"]);
    expect(locationTrail(TREE, "no-existe")).toBeNull();
  });
});

describe("selector de ubicación en árbol", () => {
  it("abre las sedes, explica que incluye lo que contiene y no marca ningún lugar", () => {
    const html = render(<LocationTreeSelect nodes={TREE} value={null} onChange={noop} label="Ubicación (con lo que contiene)" />);
    const text = visibleText(html);
    expect(text).toContain("Ubicación (con lo que contiene)");
    expect(text).toContain(LOCATION_TREE_HINT);
    expect(text).toContain("Sede Central (ficticia)");
    expect(text).toContain("Depósito 2");
    expect(text).not.toContain("Estante B");
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="Abrir Depósito 2"');
  });

  it("con un lugar elegido abre su ruta, lo marca y ofrece quitarlo", () => {
    const html = render(<LocationTreeSelect nodes={TREE} value="est-b" onChange={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Sede Central (ficticia) › Depósito 2 › Estante B");
    expect(text).toContain("Estante C");
    expect(text).not.toContain("Nivel 1");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('title="Sede Central (ficticia) › Depósito 2 › Estante B"');
    expect(html).toContain('aria-label="Quitar la ubicación"');
    expect(html).toContain('aria-label="Abrir Estante B"');
  });

  it("filtra por el buscador y avisa cuando nada coincide o no hay ubicaciones", () => {
    expect(visibleText(render(<LocationTreeSelect nodes={TREE} value={null} onChange={noop} initialQuery="nivel 1" />))).toContain("Nivel 1");
    expect(visibleText(render(<LocationTreeSelect nodes={TREE} value={null} onChange={noop} initialQuery="sótano" />))).toContain(
      "Ningún lugar coincide con «sótano».",
    );
    expect(visibleText(render(<LocationTreeSelect nodes={[]} value={null} onChange={noop} />))).toContain("No hay ubicaciones registradas.");
  });

  it("un lugar elegido que ya no está en el árbol se puede quitar igual", () => {
    const text = visibleText(render(<LocationTreeSelect nodes={TREE} value="retirada" onChange={noop} />));
    expect(text).toContain("Lugar elegido (ya no está en el árbol)");
  });
});
