import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EMPTY_OPTIONS, SearchFiltersPanel } from "@/components/domain/SearchFilters";
import { SessionProvider } from "@/lib/auth/session";
import {
  PREVIEW_COLUMN_LIMIT,
  groupTitle,
  previewColumns,
  previewColumnsNotice,
  reportNumber,
  totalsText,
  type Report,
} from "@/lib/data/reports";
import { EMPTY_FILTERS, secondaryFiltersCount } from "@/lib/data/search";
import { PIECES, computeByCollectionReport, computeByLocationReport, computeInventoryReport } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { DisclosureSummary, withActiveCount } from "./DisclosureSummary";
import { ReportPreview } from "./ReportPreview";
import { IncompleteReportPanel } from "./IncompleteReportPanel";
import { ReportSelector } from "./ReportSelector";
import { READABLE, ReportFilters } from "./ReportsLive";

// Change reportes-vista-simplificada, secciones 1 a 3. HTML estático (ADR-012); datos sintéticos (RNF-014).

const noop = () => {};

/** Las 19 columnas del inventario de la API (`INVENTORY_COLUMNS`, apps/api/app/modules/reports/builders.py). */
const INVENTORY_COLUMNS = [
  "Código I",
  "Código de colección",
  "INC / RN",
  "Código PUCP",
  "Denominación",
  "Descripción",
  "Colección",
  "Régimen",
  "Propietario legal",
  "Forma de adquisición",
  "Fecha de ingreso",
  "Autor",
  "Procedencia",
  "Época",
  "Tipo de bien",
  "Materiales",
  "Medidas",
  "Estado de conservación",
  "Ubicación",
];
const LOCATION_COLUMNS = ["Código I", "Código de colección", "Denominación", "Descripción", "Ubicación", "Última vez vista", "Días desde la última verificación"];
const MAIN = ["Código I", "Código de colección", "Denominación", "Descripción", "Colección", "Régimen"];

function row(columns: readonly string[], n: number): string[] {
  return columns.map((column) => `${column} ${n}`);
}

function report(overrides: Partial<Report> = {}): Report {
  const columns = overrides.columns ?? INVENTORY_COLUMNS;
  return {
    report_type: "inventory",
    title: "Inventario general",
    generated_at: "2026-11-11T12:00:00Z",
    generated_by: "curadora@matp.local",
    filters: { Colección: "Colección RA (ficticia)" },
    columns,
    rows: [row(columns, 1), row(columns, 2)],
    totals: { Piezas: 2, Propiedad: 1, Comodato: 1 },
    subtotals: [
      { group: "Régimen", label: "Comodato", count: 1, level: 0 },
      { group: "Régimen", label: "Propiedad", count: 1, level: 0 },
    ],
    masked_columns: [],
    message: null,
    download_url: null,
    total_rows: 2,
    page: 1,
    page_size: 25,
    ...overrides,
  };
}

/** Encabezados de columna de la tabla (sin los de grupo, que usan `scope="colgroup"`). */
function headers(html: string): string[] {
  return [...html.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
}

describe("columnas principales (Req: Vista previa del reporte fiel a la descarga; design D1)", () => {
  it("inventario de 19 columnas: las 6 principales, en el orden del reporte", () => {
    const visible = previewColumns(report(), false);
    expect(visible.map((i) => INVENTORY_COLUMNS[i])).toEqual(MAIN);
  });

  it("agrupado de 20 columnas (con la del grupo): las mismas 6", () => {
    const columns = ["Grupo", ...INVENTORY_COLUMNS];
    expect(previewColumns({ report_type: "by-attribute", columns }, false).map((i) => columns[i])).toEqual(MAIN);
  });

  it("por ubicación: sus 6 principales de 7", () => {
    const visible = previewColumns({ report_type: "by-location", columns: LOCATION_COLUMNS }, false);
    expect(visible.map((i) => LOCATION_COLUMNS[i])).toEqual(LOCATION_COLUMNS.slice(0, 6));
  });

  it("con 6 columnas o menos, todas", () => {
    const columns = ["Denominación", "Colección", "Alertas"];
    expect(previewColumns({ report_type: "inventory", columns }, false)).toEqual([0, 1, 2]);
    expect(PREVIEW_COLUMN_LIMIT).toBe(6);
  });

  it("una principal que no viene se omite sin error; un tipo sin principales muestra todas", () => {
    const columns = INVENTORY_COLUMNS.filter((c) => c !== "Código de colección");
    expect(previewColumns({ report_type: "inventory", columns }, false).map((i) => columns[i])).toEqual(MAIN.filter((c) => c !== "Código de colección"));
    expect(previewColumns({ report_type: "valuation", columns: INVENTORY_COLUMNS }, false)).toHaveLength(19);
  });

  it("al pedir todas, las 19 en el orden de la descarga", () => {
    expect(previewColumns(report(), true)).toEqual(INVENTORY_COLUMNS.map((_, i) => i));
  });

  it("la línea dice cuántas se ven y que el Excel las trae todas; sin recorte, nada", () => {
    expect(previewColumnsNotice(6, 19)).toBe("En pantalla: 6 de 19 columnas. El Excel las trae todas.");
    expect(previewColumnsNotice(3, 3)).toBeNull();
  });
});

describe("vista previa con columnas principales (Req: Vista previa del reporte fiel a la descarga)", () => {
  it("muestra las 6 principales, la línea y «Ver las 19 columnas»", () => {
    const html = render(<ReportPreview report={report()} />);
    expect(headers(html)).toEqual(MAIN);
    expect(visibleText(html)).toContain("En pantalla: 6 de 19 columnas. El Excel las trae todas.");
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>(?:(?!<\/button>)[\s\S])*Ver las 19 columnas<\/button>/);
    // Cada fila tiene tantas celdas como columnas visibles.
    expect(html.match(/<tr class="border-t border-borde"><td/g)).toHaveLength(2);
    expect((html.split('<tr class="border-t border-borde">')[1].match(/<td/g) ?? []).length).toBe(6);
  });

  it("con todas a la vista: las 19 en su orden y «Ver solo las principales»; filas, subtotales y totales iguales", () => {
    const few = render(<ReportPreview report={report()} />);
    const all = render(<ReportPreview report={report()} initialShowAll />);
    expect(headers(all)).toEqual(INVENTORY_COLUMNS);
    expect(visibleText(all)).toContain("Ver solo las principales");
    const summary = (html: string) => visibleText(html).match(/2 piezas · 1 en propiedad · 1 en comodato/)?.[0];
    expect(summary(few)).toBe(summary(all));
    for (const text of ["Régimen: Comodato — 1", "Régimen: Propiedad — 1"]) {
      expect(visibleText(few)).toContain(text);
      expect(visibleText(all)).toContain(text);
    }
  });

  it("un reporte de pocas columnas no muestra el control ni la línea", () => {
    const html = render(<ReportPreview report={report({ columns: ["Denominación", "Colección", "Ubicación"] })} />);
    expect(visibleText(html)).not.toContain("En pantalla:");
    expect(visibleText(html)).not.toContain("Ver las");
  });

  it("el aviso de permisos sigue aunque Ubicación no esté entre las principales", () => {
    const html = render(<ReportPreview report={report({ masked_columns: ["Ubicación"] })} />);
    expect(headers(html)).not.toContain("Ubicación");
    expect(visibleText(html)).toMatch(/Ubicación limitada/);
  });
});

describe("desplegables reconocibles (Req: Desplegables de filtros y subtotales reconocibles)", () => {
  it("la cabecera dibuja su flecha, que gira al abrir, y mide 44 px", () => {
    const html = render(
      <details className="group">
        <DisclosureSummary>Filtros</DisclosureSummary>
      </details>,
    );
    const summary = html.match(/<summary\b[^>]*>/)?.[0] ?? "";
    expect(summary).toMatch(/class="[^"]*min-h-11[^"]*list-none/);
    expect(summary).toContain('data-variant="plain"');
    expect(summary).not.toContain("border-terracota");
    const arrow = html.match(/<svg\b[^>]*>/)?.[0] ?? "";
    expect(arrow).toContain('data-disclosure-arrow=""');
    expect(arrow).toMatch(/class="[^"]*group-open:rotate-90/);
    expect(visibleText(html)).toBe("Filtros");
  });

  it("cuenta los activos en singular y plural", () => {
    expect(withActiveCount("Filtros", 0)).toBe("Filtros");
    expect(withActiveCount("Filtros", 1)).toBe("Filtros (1 activo)");
    expect(withActiveCount("Filtros", 2)).toBe("Filtros (2 activos)");
  });

  it("«Filtros» de Reportes: desplegado de entrada, cabecera con aspecto de botón, flecha y «(2 activos)»", () => {
    const html = render(<ReportFilters filters={{ ...EMPTY_FILTERS, denomination: "mate", collectionId: "c1" }} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />);
    expect(html).toMatch(/^<details open="" class="group/);
    const summary = html.match(/<summary\b[^>]*>/)?.[0] ?? "";
    expect(summary).toContain('data-variant="button"');
    expect(summary).toMatch(/class="[^"]*\bborder\b[^"]*border-terracota[^"]*bg-white/);
    expect(html).toContain("data-disclosure-arrow");
    expect(visibleText(html)).toContain("Filtros (2 activos)");
  });

  it("«Más filtros» de Búsqueda conserva su aspecto: sin borde de botón y plegado sin filtros secundarios", () => {
    const html = render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />);
    const summary = html.match(/<summary\b[^>]*>/)?.[0] ?? "";
    expect(summary).toContain('data-variant="plain"');
    expect(summary).not.toContain("border-terracota");
    expect(html).toContain('<details class="group">');
  });

  it("«Más filtros» de Búsqueda: flecha y cuántos de los suyos están activos", () => {
    const filters = { ...EMPTY_FILTERS, author: "Huamán", collectionId: "c1", denomination: "mate" };
    expect(secondaryFiltersCount(filters)).toBe(2);
    const html = render(<SearchFiltersPanel filters={filters} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />);
    expect(html).toContain('<details open="" class="group">');
    expect(html).toContain("data-disclosure-arrow");
    expect(visibleText(html)).toContain("Más filtros (2 activos)");
    expect(visibleText(render(<SearchFiltersPanel filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />))).toContain("Más filtros");
  });

  it("«Subtotales» de la vista previa: flecha y su número", () => {
    const html = render(<ReportPreview report={report()} />);
    expect(html).toMatch(/<details[^>]*class="group[^"]*"[^>]*><summary[\s\S]*?data-disclosure-arrow[\s\S]*?Subtotales \(2\)/);
  });
});

describe("textos y números en lenguaje llano (Req: Textos y números de Reportes en lenguaje llano)", () => {
  it("los totales se leen como frases, con número es-PE", () => {
    expect(totalsText({ totals: { Piezas: 14 } })).toBe("14 piezas");
    expect(totalsText({ totals: { piezas: 1 } })).toBe("1 pieza");
    expect(totalsText({ totals: { Piezas: 25000, Propiedad: 24000, Comodato: 1000 } })).toBe("25,000 piezas · 24,000 en propiedad · 1,000 en comodato");
    expect(totalsText({ totals: { Piezas: 3, "Nunca verificadas": 1 } })).toBe("3 piezas · 1 nunca verificada");
    expect(totalsText({ totals: { Piezas: 1, "Apariciones en grupos": 2 } })).toBe("1 pieza · 2 apariciones en grupos");
    expect(totalsText({ totals: { colecciones: 6 } })).toBe("6 colecciones");
  });

  it("lo que no tiene frase queda como nombre y valor, con el número formateado", () => {
    expect(totalsText({ totals: { "Total PEN": 12345.5 } })).toBe("Total PEN: 12,345.5");
    expect(reportNumber(25000)).toBe((25000).toLocaleString("es-PE"));
    expect(reportNumber("texto")).toBe("texto");
  });

  it("los grupos de la tabla llevan el número con el mismo formato", () => {
    expect(groupTitle({ heading: "Colección", label: "RA", count: 10000 })).toBe("Colección: RA — 10,000 piezas");
  });

  it("los reportes de demostración, en pantalla, sin identificadores ni claves internas", () => {
    const REQUIREMENT = /\b(RF-0\d{2}|RNF-0\d{2}|RN-0\d{2}|RIA-0\d)\b|\[SUPUESTO\]|\b[a-z]+_[a-z_]+\b/;
    for (const mock of [computeInventoryReport(), computeByCollectionReport(), computeByLocationReport()]) {
      const text = visibleText(render(<ReportPreview report={mock} />));
      expect(text).not.toMatch(REQUIREMENT);
      expect(text).not.toMatch(/\b(piezas|colecciones): \d/);
    }
  });
});

describe("demostración con las reglas del inventario (Req: Inventario de demostración con las reglas del inventario)", () => {
  const temporary = PIECES.filter((piece) => piece.tenure_regime === "Préstamo Temporal");

  it("los datos de ejemplo tienen un préstamo temporal (la regla tiene algo que excluir)", () => {
    expect(temporary.length).toBeGreaterThan(0);
  });

  it("el inventario no incluye préstamos temporales ni los cuenta en su total", () => {
    const inventory = computeInventoryReport();
    const names = inventory.rows.map((cells) => cells[0]);
    for (const piece of temporary) expect(names).not.toContain(piece.denomination);
    expect(inventory.totals.piezas).toBe(PIECES.length - temporary.length);
    expect(inventory.rows).toHaveLength(PIECES.length - temporary.length);
    expect(inventory.columns).toContain("Régimen");
  });

  it("por colección y por ubicación cuentan las mismas piezas", () => {
    const expected = PIECES.length - temporary.length;
    const byCollection = computeByCollectionReport().rows.reduce((sum, cells) => sum + Number(cells[1]), 0);
    const byLocation = computeByLocationReport();
    expect(byCollection).toBe(expected);
    expect(byLocation.totals.piezas).toBe(expected);
    expect(byLocation.rows.reduce((sum, cells) => sum + Number(cells[1]), 0)).toBe(expected);
  });
});

describe("legibilidad de Reportes (Req: Legibilidad de Reportes)", () => {
  /** Etiquetas HTML con una clase de letra menor de 16 px. */
  function smallTags(markup: string): string[] {
    return (markup.match(/<[a-z]+ [^>]*>/g) ?? []).filter((tag) => /class="[^"]*\btext-(xs|sm)\b/.test(tag));
  }
  const selector = render(<ReportSelector selected="inventory" onSelect={noop} />);
  const preview = render(<ReportPreview report={report()} />);
  const incomplete = render(
    <SessionProvider>
      <IncompleteReportPanel canDownload />
    </SessionProvider>,
  );
  const TREE = [{ id: "sede", name: "Sede (sintética)", level_type: "Sede", children: [{ id: "dep", name: "Depósito 1", level_type: "Depósito", children: [] }] }];
  const filters = render(
    <div className={READABLE}>
      <ReportFilters filters={EMPTY_FILTERS} options={{ ...EMPTY_OPTIONS, locationTree: TREE } as typeof EMPTY_OPTIONS} onChange={noop} onClear={noop} />
    </div>,
  );

  it("selector, vista previa e incompletas sin letra de menos de 16 px", () => {
    for (const html of [selector, preview, incomplete]) expect(smallTags(html)).toEqual([]);
  });

  it("en los filtros, lo pequeño es de `Field` (Base) o del árbol de ubicaciones (P3), y el contenedor lo sube a 16 px", () => {
    // Etiqueta y ayuda de `Field`; leyenda, botones y etiquetas del árbol, que van dentro de su `fieldset`.
    const overridden = (tag: string) => /^<(label|p|legend) /.test(tag) || /^<button /.test(tag) || /^<span [^>]*rounded-full/.test(tag);
    expect(smallTags(filters).filter((tag) => !overridden(tag))).toEqual([]);
    expect(filters).toMatch(/<fieldset[\s\S]*?<button/);
    for (const variant of ["[&_label]:text-base", "[&_p]:text-base", "[&_legend]:text-base", "[&_fieldset_button]:text-base", "[&_fieldset_span.rounded-full]:text-base", "[&_select]:min-h-11"]) {
      expect(READABLE).toContain(variant);
    }
  });

  it("botones, desplegables, casillas y campos de incompletas miden al menos 44 px", () => {
    for (const html of [preview, incomplete]) {
      for (const button of html.match(/<button\b[^>]*>/g) ?? []) expect(button).toMatch(/\bmin-h-11\b/);
    }
    for (const html of [preview, incomplete, filters]) {
      for (const summary of html.match(/<summary\b[^>]*>/g) ?? []) expect(summary).toMatch(/\bmin-h-11\b/);
    }
    // En los filtros, los botones del árbol (P3) miden 44 px solo por debajo de lg: el contenedor los mantiene en 44 px.
    for (const button of filters.match(/<button\b[^>]*>/g) ?? []) expect(button).toMatch(/\b(min-h-11|size-11)\b/);
    expect(READABLE).toContain("[&_fieldset_button]:min-h-11");
    // En incompletas, cada casilla va dentro de una etiqueta de 44 px y el selector de colección mide 44 px.
    const checkboxLabels = incomplete.match(/<label[^>]*>(?=<input type="checkbox")/g) ?? [];
    expect(checkboxLabels.length).toBeGreaterThan(0);
    for (const label of checkboxLabels) expect(label).toMatch(/\bmin-h-11\b/);
    for (const select of incomplete.match(/<select\b[^>]*>/g) ?? []) expect(select).toMatch(/\bmin-h-11\b.*\bmax-w-full\b|\bmax-w-full\b.*\bmin-h-11\b/);
  });

  it("en incompletas con datos, las etiquetas de alerta van a 16 px y los enlaces a cada pieza miden 44 px (recorrido 7.1)", () => {
    // Las filas solo existen con datos (se cargan en un efecto): el contenedor se comprueba pintado y
    // el enlace, en el código; el recorrido en Chrome de 7.1 lo mide con datos.
    expect(incomplete).toMatch(/^<div class="[^"]*\[&amp;_span\.rounded-full\]:text-base/);
    const panel = readFileSync(path.resolve(__dirname, "IncompleteReportPanel.tsx"), "utf-8");
    expect(panel).toMatch(/<Link href=\{`\/piezas\/\$\{item\.piece_id\}`\} className="inline-flex min-h-11 items-center/);
  });

  it("la tabla de incompletas se desplaza dentro de su recuadro, no la página", () => {
    expect(incomplete).toMatch(/class="[^"]*\bmin-w-0\b/);
  });
});
