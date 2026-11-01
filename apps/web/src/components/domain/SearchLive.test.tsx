import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS, activeChips, type ExportJob, type SearchHit, type SearchPage } from "@/lib/data/search";
import { render, visibleText } from "@/test/render";

import { SearchFiltersPanel, type SearchOptions } from "./SearchFilters";
import { ActiveFilterChips, ExportColumnsPicker, ExportJobsList, SearchResults } from "./SearchLive";

// Datos sintéticos (RNF-014).

const noop = () => {};

function hit(overrides: Partial<SearchHit> = {}, piece: Partial<SearchHit["piece"]> = {}): SearchHit {
  return {
    piece: {
      id: "p-1",
      denomination: "Retablo de San Marcos (sintético)",
      collection: { id: "col-ra", name: "Colección RA (ficticia)", acronym: "RA" },
      tenure_regime: "Propiedad",
      code_i: "I-236",
      codes: [],
      category: null,
      conservation_status: null,
      period_text: "ca. 1950",
      location_label: "Sede Central › Depósito 2",
      media_count: 1,
      has_location: true,
      updated_at: "2026-10-25T12:00:00Z",
      ...piece,
    } as SearchHit["piece"],
    match_type: "IDENTIFIER",
    matched_identifier: null,
    match_reason: { kind: "identifier", type: "COLECCION", original: "M.M.Z. 15", historical: false },
    thumbnail_url: "https://s3.local/pieces/p-1/a-1/thumb.webp",
    ...overrides,
  };
}

function page(overrides: Partial<SearchPage> = {}): SearchPage {
  return { items: [hit()], total: 1, page: 1, limit: 20, ...overrides };
}

const OPTIONS: SearchOptions = {
  collections: [{ id: "col-ra", label: "Colección RA (ficticia)" }],
  categories: [{ id: "cat-ret", label: "Retablo" }],
  materials: [{ id: "mat-madera", label: "Madera" }],
  conservationStates: [{ id: "est-bueno", label: "Bueno" }],
  locations: [{ id: "loc-d2", label: "Sede Central (ficticia) › Depósito 2" }],
  locationTree: [
    {
      id: "sede-1",
      name: "Sede Central (ficticia)",
      level_type: "Sede",
      children: [{ id: "loc-d2", name: "Depósito 2", level_type: "Depósito", children: [] }],
    },
  ],
};

describe("resultados de la búsqueda", () => {
  it("muestra la miniatura de la foto principal y qué coincidió", () => {
    const html = render(<SearchResults page={page()} onPage={noop} />);
    expect(html).toContain('src="https://s3.local/pieces/p-1/a-1/thumb.webp"');
    const text = visibleText(html);
    expect(text).toContain("Retablo de San Marcos (sintético)");
    expect(text).toContain("Coincide por código de colección «M.M.Z. 15»");
    expect(text).not.toContain("Página");
  });

  it("sin foto ni texto buscado no muestra miniatura ni coincidencia", () => {
    const html = render(<SearchResults page={page({ items: [hit({ match_reason: null, thumbnail_url: null }, { media_count: 0 })] })} />);
    expect(html).not.toContain("<img");
    const text = visibleText(html);
    expect(text).toContain("Sin foto");
    expect(text).not.toContain("Coincide");
  });

  it("sin resultados sugiere acciones concretas", () => {
    const html = render(
      <SearchResults
        page={page({ items: [], total: 0, suggestions: ["remove_filter:material_id", "check_code_format"] })}
        onSuggestion={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("No se encontraron piezas con estos filtros.");
    expect(text).toContain("Quite el filtro «Material».");
    expect(text).toContain("Revise cómo escribió el código");
    // Quitar un filtro es un botón; revisar el formato es solo un consejo.
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it("sin resultados ofrece quitar los filtros uno por uno, aunque la API no sugiera nada", () => {
    const chips = activeChips({ ...EMPTY_FILTERS, denomination: "xyz" });
    const html = render(<SearchResults page={page({ items: [], total: 0 })} chips={chips} onRemoveChip={noop} />);
    const text = visibleText(html);
    expect(text).toContain("No se encontraron piezas con estos filtros.");
    expect(text).toContain("Quite el filtro Denominación: «xyz».");
    expect(html).toContain('aria-label="Quitar filtros uno por uno"');
  });

  it("con filtros aplicados no repite las sugerencias de quitar un filtro y conserva los consejos", () => {
    const chips = activeChips({ ...EMPTY_FILTERS, q: "I 0236", materialId: "mat-madera", tenureRegime: "Comodato" }, { "mat-madera": "Madera" });
    const html = render(
      <SearchResults
        page={page({ items: [], total: 0, suggestions: ["remove_filter:material_id", "check_code_format"] })}
        chips={chips}
        onRemoveChip={noop}
        onSuggestion={noop}
      />,
    );
    const text = visibleText(html);
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(text).toContain("Quite el filtro Material: Madera.");
    expect(text).not.toContain("Quite el filtro «Material».");
    expect(text).toContain("Revise cómo escribió el código");
  });

  it("avisa de las piezas con época solo en texto y pagina", () => {
    const text = visibleText(render(<SearchResults page={page({ total: 45, excluded_uninterpreted_period: 3 })} onPage={noop} />));
    expect(text).toContain("3 piezas cumplen los demás filtros, pero su época solo está escrita como texto");
    expect(text).toContain("Página 1 de 3");
  });
});

describe("filtros", () => {
  it("ofrece todos los filtros del filtro único", () => {
    const text = visibleText(render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={OPTIONS} onChange={noop} onClear={noop} />));
    for (const label of [
      "Código o texto",
      "Colección (con subcolecciones)",
      "Categoría",
      "Material",
      "Estado de conservación",
      "Ubicación (con lo que contiene)",
      "Régimen de tenencia",
      "Código I",
      "Época desde (año)",
      "Época hasta (año)",
      "Completitud de la ficha",
      "Denominación",
      "Descripción contiene",
      "Autor",
      "Procedencia",
    ]) {
      expect(text).toContain(label);
    }
    // La ubicación se elige en el árbol (fusion-busqueda-deposito 2.2), abierto desde la sede.
    expect(text).toContain("Depósito 2");
    expect(text).toContain("Al elegir un lugar se incluye todo lo que contiene.");
  });

  it("pone primero los cinco filtros del museo y el resto en «Más filtros», plegado", () => {
    const html = render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={OPTIONS} onChange={noop} onClear={noop} />);
    const text = visibleText(html);
    const order = ["Código o texto", "Denominación", "Categoría", "Material", "Descripción contiene", "Más filtros"].map((label) =>
      text.indexOf(label),
    );
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const secondary of ["Colección (con subcolecciones)", "Ubicación (con lo que contiene)", "Autor", "Procedencia", "Completitud de la ficha"]) {
      expect(text.indexOf(secondary)).toBeGreaterThan(text.indexOf("Más filtros"));
    }
    expect(html).toContain("<details>");
  });

  it("«Más filtros» aparece abierto cuando llega un filtro secundario, como la ubicación", () => {
    const withLocation = render(<SearchFiltersPanel filters={{ ...EMPTY_FILTERS, locationId: "loc-d2" }} options={OPTIONS} onChange={noop} onClear={noop} />);
    expect(withLocation).toContain('<details open="">');
    expect(visibleText(withLocation)).toContain("Sede Central (ficticia) › Depósito 2");
    const withAuthor = render(<SearchFiltersPanel filters={{ ...EMPTY_FILTERS, author: "Huamán" }} options={OPTIONS} onChange={noop} onClear={noop} />);
    expect(withAuthor).toContain('<details open="">');
    const onlyMain = render(<SearchFiltersPanel filters={{ ...EMPTY_FILTERS, denomination: "mate", description: "asa" }} options={OPTIONS} onChange={noop} onClear={noop} />);
    expect(onlyMain).toContain("<details>");
  });

  it("muestra un chip que se puede quitar por cada filtro activo", () => {
    const chips = activeChips({ ...EMPTY_FILTERS, q: "retablo", materialId: "mat-madera" }, { "mat-madera": "Madera" });
    const html = render(<ActiveFilterChips chips={chips} onRemove={noop} />);
    expect(visibleText(html)).toContain("Búsqueda: «retablo»");
    expect(visibleText(html)).toContain("Material: Madera");
    expect(html).toContain('aria-label="Quitar el filtro Material: Madera"');
    expect(render(<ActiveFilterChips chips={[]} onRemove={noop} />)).toBe("");
  });
});

describe("exportación", () => {
  it("las columnas restringidas solo aparecen con su permiso", () => {
    const without = visibleText(render(<ExportColumnsPicker selected={["denomination"]} canSeeSensitive={() => false} onChange={noop} />));
    expect(without).toContain("Denominación");
    expect(without).not.toContain("Comodante");
    const withPermission = visibleText(render(<ExportColumnsPicker selected={[]} canSeeSensitive={(key) => key === "lender_name"} onChange={noop} />));
    expect(withPermission).toContain("Comodante (dato restringido)");
    expect(withPermission).not.toContain("Convenio de préstamo");
  });

  it("«Mis exportaciones» muestra estado, caducidad y descarga solo lo disponible", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    const jobs: ExportJob[] = [
      { id: "j-1", kind: "results", status: "READY", format: "xlsx", row_count: 12000, created_at: "2026-10-25T10:00:00Z", expires_at: "2026-10-28T10:00:00Z", masked_fields: [] },
      { id: "j-2", kind: "full", status: "RUNNING", format: "xlsx", masked_fields: [] },
      { id: "j-3", kind: "results", status: "READY", format: "csv", expires_at: "2026-10-20T10:00:00Z", masked_fields: [] },
      { id: "j-4", kind: "report", status: "FAILED", format: "xlsx", error: "Sin espacio en el almacenamiento.", masked_fields: [] },
    ];
    const html = render(<ExportJobsList jobs={jobs} onDownload={noop} now={now} />);
    const text = visibleText(html);
    expect(text).toContain("Resultados de búsqueda · XLSX · 12");
    expect(text).toContain("Base completa · XLSX");
    expect(text).toContain("Preparándose");
    expect(text).toContain("Caducada");
    expect(text).toContain("Sin espacio en el almacenamiento.");
    expect(text.match(/Descargar/g)).toHaveLength(1);
    expect(visibleText(render(<ExportJobsList jobs={[]} onDownload={noop} />))).toBe("Todavía no tiene exportaciones.");
  });
});
