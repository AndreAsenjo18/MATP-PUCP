import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/layout/PageHeader";
import { EMPTY_FILTERS } from "@/lib/data/search";
import { render, visibleText } from "@/test/render";

import { AI_SEARCH_HINT, AiSearchBox, applyInterpretation } from "./AiSearchBox";
import { SearchFilterBar, panelFilterKeys } from "./SearchFilterBar";
import { SEARCH_BOX_HINT, SearchBox, type SearchOptions } from "./SearchFilters";

// Spec busqueda-reportes — Filtros compactos y búsqueda con IA separada (change
// `busqueda-barra-compacta-ia`). Datos sintéticos (RNF-014).

const noop = () => {};
const OPTIONS: SearchOptions = {
  collections: [{ id: "col-ra", label: "Colección RA (ficticia)" }],
  categories: [{ id: "cat-ret", label: "Retablo" }],
  materials: [{ id: "mat-madera", label: "Madera" }],
  conservationStates: [{ id: "est-reg", label: "Regular" }],
  locations: [{ id: "loc-d1", label: "Sede Central (ficticia) › Depósito 1" }],
  locationTree: [
    {
      id: "sede-1",
      name: "Sede Central (ficticia)",
      level_type: "Sede",
      children: [{ id: "loc-d1", name: "Depósito 1", level_type: "Depósito", children: [] }],
    },
  ],
};

function bar(filters = EMPTY_FILTERS, total: number | null = 118) {
  return render(<SearchFilterBar filters={filters} options={OPTIONS} total={total} onChange={noop} onRemove={noop} onClear={noop} />);
}

describe("barra compacta de filtros", () => {
  it("muestra cinco píldoras, «Más filtros» y nada de la cuadrícula de campos ni «Ver por ubicación»", () => {
    const html = bar();
    const text = visibleText(html.slice(0, html.indexOf("<dialog")));
    for (const label of ["Categoría", "Material", "Colección", "Ubicación", "Código I", "Más filtros"]) expect(text).toContain(label);
    for (const label of ["Categoría", "Material", "Colección", "Código I"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html).not.toContain("Ver por ubicación");
  });

  it("un filtro activo muestra su valor y un botón para quitarlo", () => {
    const html = bar({ ...EMPTY_FILTERS, hasInventoryCode: false, categoryId: "cat-ret" });
    const text = visibleText(html.slice(0, html.indexOf("<dialog")));
    expect(text).toContain("Código I: Sin código I");
    expect(text).toContain("Categoría: Retablo");
    expect(html).toContain('aria-label="Quitar el filtro Código I: Sin código I"');
    expect(html).toContain("bg-terracota-light");
  });

  it("la ubicación muestra el último lugar de la ruta; los filtros de «Más filtros» activos también son píldoras y se cuentan", () => {
    const html = bar({ ...EMPTY_FILTERS, locationId: "loc-d1", conservationStateId: "est-reg", author: "Huamán" });
    const text = visibleText(html.slice(0, html.indexOf("<dialog")));
    expect(text).toContain("Ubicación: Depósito 1");
    expect(text).toContain("Estado de conservación: Regular");
    expect(text).toContain("Autor: «Huamán»");
    expect(text).toMatch(/Más filtros\s*2 activos/);
  });

  it("«Más filtros» es un diálogo con tres bloques, el árbol con desplazamiento propio y «Ver N piezas»", () => {
    const html = bar(EMPTY_FILTERS, 41);
    const dialog = html.slice(html.indexOf("<dialog"));
    const text = visibleText(dialog);
    const order = ["La pieza", "Dónde está", "Origen, época y ficha"].map((title) => text.indexOf(title));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const label of ["Denominación", "Descripción contiene", "Estado de conservación", "Régimen de tenencia", "Autor", "Procedencia", "Época desde (año)", "Época hasta (año)", "Completitud de la ficha"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Depósito 1");
    expect(dialog).toContain("max-h-80 overflow-y-auto");
    expect(text).toContain("Ver 41 piezas");
    expect(dialog).toContain('aria-label="Cerrar «Más filtros»"');
  });

  it("los filtros del panel son todos menos la caja de texto y los de la barra", () => {
    const keys = panelFilterKeys(EMPTY_FILTERS);
    expect(keys).not.toContain("q");
    expect(keys).not.toContain("categoryId");
    expect(keys).toContain("conservationStateId");
    expect(keys).toContain("hasAlerts");
  });
});

describe("caja «Código o nombre» compacta", () => {
  it("tiene etiqueta y ayuda para lectores de pantalla, sin ocupar alto, y no ofrece IA", () => {
    const html = render(<SearchBox compacta value="" onChange={noop} />);
    expect(html).toMatch(/<label[^>]*class="sr-only"[^>]*>Código o nombre<\/label>/);
    expect(html).toMatch(/<p id="q-hint" class="sr-only">/);
    expect(html).toContain(`title="${SEARCH_BOX_HINT}"`);
    expect(html).not.toContain("Gemini");
  });
});

describe("búsqueda con IA de la banda", () => {
  it("se identifica con Gemini, tiene su propio botón y avisa en una región viva", () => {
    const html = render(<AiSearchBox options={OPTIONS} onFilters={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Pídalo con sus palabras");
    expect(text).toContain("Powered by Gemini");
    expect(text).toContain("Buscar con IA");
    expect(text).toContain(AI_SEARCH_HINT);
    expect(html).toContain('placeholder="p. ej. «retablos del depósito 1»"');
    expect(html).toContain("data-borde-ia");
    expect(html).toMatch(/<p[^>]*role="status"/);
  });

  it("con filtros reconocidos los reemplaza todos y dice cuáles aplicó", () => {
    const current = { ...EMPTY_FILTERS, hasInventoryCode: false };
    const { filters, applied } = applyInterpretation(
      current,
      "retablos del depósito 1 en estado regular",
      { q: "", categoryId: "cat-ret", locationId: "loc-d1", conservationStateId: "est-reg" },
      { "cat-ret": "Retablo", "loc-d1": "Depósito 1", "est-reg": "Regular" },
    );
    expect(filters.hasInventoryCode).toBeNull();
    expect(filters).toMatchObject({ categoryId: "cat-ret", locationId: "loc-d1", conservationStateId: "est-reg" });
    expect(applied).toEqual(["Categoría Retablo", "Estado de conservación Regular", "Ubicación Depósito 1"]);
  });

  it("sin IA o sin filtros reconocidos busca la frase como texto y conserva los demás filtros", () => {
    const current = { ...EMPTY_FILTERS, hasInventoryCode: false };
    expect(applyInterpretation(current, " charango ", null)).toEqual({ filters: { ...current, q: "charango" }, applied: [] });
    expect(applyInterpretation(current, "algo", { q: "algo" }).filters).toEqual({ ...current, q: "algo" });
  });
});

describe("cabecera compacta de Búsqueda", () => {
  it("con trama animada y contenido debajo, sin la imagen fija de la trama", () => {
    const html = render(<PageHeader title="Búsqueda" tramaAnimada debajo={<p>Caja de IA</p>} />);
    expect(html).not.toContain("trama-rombos");
    expect(html).toMatch(/data-trama=""[^>]*w-\[40%\]/);
    expect(html).toContain('<div class="mt-3 md:pr-[36%]"><p>Caja de IA</p></div>');
  });
});
