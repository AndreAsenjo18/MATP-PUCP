import { describe, expect, it } from "vitest";

import { SessionProvider } from "@/lib/auth/session";
import type { LocationNode } from "@/lib/data/locations";
import { EMPTY_FILTERS } from "@/lib/data/search";
import { render, visibleText } from "@/test/render";

import { LocationTreeSelect } from "./LocationTreeSelect";
import { SEARCH_BOX_HINT, SearchBox, SearchFiltersPanel, EMPTY_OPTIONS } from "./SearchFilters";
import { ExportResultsPanel, FullExportPanel } from "./SearchLive";

// Change rediseno-ux-busqueda. Datos sintéticos (RNF-014). La regex busca identificadores reales de
// requisitos: un código de pieza como «RN-004521» no lo es.
const REQUIREMENT = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b|AI_PROVIDER/;
const noop = () => {};

describe("buscador siempre visible (rediseno-ux-busqueda D1, D2)", () => {
  it("es un campo de búsqueda con una sola ayuda", () => {
    const html = render(<SearchBox value="" onChange={noop} />);
    expect(html).toContain('role="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain('id="q"');
    expect(visibleText(html)).toContain("Código o texto");
    expect(visibleText(html)).toContain(SEARCH_BOX_HINT);
    expect(html).toContain('spellCheck="false"');
  });

  it("es una píldora con el botón oscuro «Buscar» dentro, en un formulario, y la ayuda enlazada (maqueta B)", () => {
    const html = render(<SearchBox value="" onChange={noop} />);
    expect(html).toMatch(/<form[^>]*role="search"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*class="[^"]*bg-tinta[^"]*"[^>]*>Buscar<\/button>/);
    expect(html).toContain('for="q"');
    expect(html).toContain('aria-describedby="q-hint"');
    expect(html).toContain("sm:rounded-full");
  });

  it("en Búsqueda los filtros van en fila, sin tarjeta propia, compactos y con campos de 44 px; Reportes los conserva en columna", () => {
    const row = render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} withQuery={false} layout="fila" />);
    expect(row).not.toContain('aria-label="Filtros de búsqueda"');
    expect(row).toContain("xl:grid-cols-4");
    expect(row).toContain("gap-y-3");
    expect(row).not.toContain("min-h-13");
    const column = render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />);
    expect(column).toContain('aria-label="Filtros de búsqueda"');
    expect(column).not.toContain("min-h-13");
  });

  it("en Búsqueda ya no está dentro del panel de filtros; Reportes lo conserva", () => {
    const search = render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} withQuery={false} />);
    expect(search).not.toContain('id="q"');
    expect(visibleText(search)).not.toContain("Código o texto");
    const reports = render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />);
    expect(visibleText(reports)).toContain("Código o texto");
  });
});

describe("exportación plegada (rediseno-ux-busqueda D5)", () => {
  it("«Exportar resultados» está plegado por defecto", () => {
    const html = render(
      <SessionProvider>
        <ExportResultsPanel filters={EMPTY_FILTERS} onJobCreated={noop} />
      </SessionProvider>,
    );
    expect(html).toMatch(/^<details[^>]*aria-label="Exportar resultados"/);
    expect(html).not.toMatch(/^<details[^>]*\sopen/);
    expect(html).toContain("<summary");
  });
});

describe("árbol de ubicaciones táctil (rediseno-ux-busqueda D7)", () => {
  const TREE: LocationNode[] = [
    { id: "sede", name: "Sede (sintética)", level_type: "Sede", children: [{ id: "dep", name: "Depósito 1", level_type: "Depósito", children: [] }] },
  ];

  it("abrir y elegir un lugar miden 44 px por debajo de lg y son compactos desde lg", () => {
    const html = render(<LocationTreeSelect nodes={TREE} value={null} onChange={noop} label="Ubicación" />);
    expect(html).toMatch(/aria-label="Cerrar Sede \(sintética\)"[^>]*class="[^"]*size-11[^"]*lg:size-6/);
    expect(html.match(/aria-pressed="false"[^>]*class="[^"]*min-h-11[^"]*lg:min-h-0/g)).toHaveLength(2);
  });
});

describe("textos de la búsqueda sin identificadores internos", () => {
  it("buscador, filtros, exportación y exportación completa", () => {
    const texts = [
      render(<SearchBox value="" onChange={noop} />),
      render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} openMore />),
      render(
        <SessionProvider>
          <ExportResultsPanel filters={EMPTY_FILTERS} onJobCreated={noop} />
          <FullExportPanel />
        </SessionProvider>,
      ),
    ].map(visibleText);
    for (const text of texts) expect(text).not.toMatch(REQUIREMENT);
    expect(texts[2]).toContain("Exportación completa de la base");
  });
});
