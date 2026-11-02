import { describe, expect, it } from "vitest";

import type { Report } from "@/lib/data/reports";
import { render, visibleText } from "@/test/render";

import { PrintableReport } from "./PrintableReport";

// Datos sintéticos (RNF-014).

function report(overrides: Partial<Report> = {}): Report {
  return {
    report_type: "inventory",
    title: "Inventario general",
    generated_at: "2026-10-25T12:00:00Z",
    generated_by: "curadora@matp.local",
    filters: { collection: "Colección RA (ficticia)" },
    columns: ["Denominación", "Colección", "Ubicación"],
    rows: [
      ["Retablo de San Marcos", "Colección RA (ficticia)", "Sede Central › Depósito 1"],
      ["Toro de Pucará", "Colección MMZ (ficticia)", "Sede Central › Depósito 2"],
    ],
    totals: { Piezas: 2, Propiedad: 2 },
    subtotals: [
      { group: "Colección", label: "Colección MMZ (ficticia)", count: 1, level: 0 },
      { group: "Colección", label: "Colección RA (ficticia)", count: 1, level: 0 },
      { group: "Régimen", label: "Propiedad", count: 2, level: 0 },
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

describe("vista imprimible", () => {
  it("repite la cabecera por colección y salta de página entre colecciones", () => {
    const html = render(<PrintableReport report={report()} tooLarge={false} />);
    const text = visibleText(html);
    expect(text.match(/Inventario general/g)).toHaveLength(2);
    expect(text).toContain("Filtros: collection: Colección RA (ficticia)");
    expect(text).toContain("Colección: Colección MMZ (ficticia)");
    expect(html).toContain("print:break-before-page");
    expect(html).toContain("table-header-group");
  });

  it("sugiere Excel cuando supera el límite de impresión", () => {
    const text = visibleText(render(<PrintableReport report={report({ rows: [], total_rows: 9000 })} tooLarge />));
    expect(text).toContain("supera el límite de impresión");
    expect(text).toContain("Expórtelo a Excel");
    expect(text).not.toContain("Retablo de San Marcos");
  });
});

describe("descripción en la impresión", () => {
  const longText = "Descripción sintética de una pieza de prueba. ".repeat(50).slice(0, 2000);
  const withDescription = (description: string | null) =>
    report({ columns: ["Denominación", "Descripción"], rows: [["Mate burilado", description]], subtotals: [] });

  it("imprime completa una descripción de 2 000 caracteres, sin recortarla", () => {
    const html = render(<PrintableReport report={withDescription(longText)} tooLarge={false} />);
    expect(longText).toHaveLength(2000);
    expect(html).toContain(longText);
    expect(html).not.toContain("line-clamp");
    expect(html).not.toContain("ver más");
  });

  it("la ajusta en varias líneas dentro de su columna, sin desbordar la página", () => {
    const html = render(<PrintableReport report={withDescription(longText)} tooLarge={false} />);
    expect(html).toMatch(/<td[^>]*whitespace-pre-wrap[^>]*>Descripción sintética/);
    expect(html).toMatch(/<td[^>]*\[overflow-wrap:anywhere\][^>]*>Descripción sintética/);
    expect(html).toContain("size: landscape");
  });

  it("no parte una palabra larga fuera de la columna en ninguna otra celda", () => {
    const html = render(<PrintableReport report={withDescription("corta")} tooLarge={false} />);
    expect(html).toMatch(/<td[^>]*\[overflow-wrap:anywhere\][^>]*>Mate burilado/);
  });

  it("deja vacía la celda de una pieza sin descripción", () => {
    const text = visibleText(render(<PrintableReport report={withDescription(null)} tooLarge={false} />));
    expect(text).toContain("Mate burilado");
    expect(text).not.toContain("—");
  });
});

describe("reporte agrupado en la impresión", () => {
  const grouped = report({
    report_type: "by-attribute",
    title: "Piezas agrupadas por procedencia",
    columns: ["Grupo", "Denominación", "Colección"],
    rows: [
      ["Puno", "Mate", "RA"],
      ["Puno", "Toro", "MMZ"],
      ["Sin dato", "Retablo", "RA"],
    ],
    subtotals: [
      { group: "Procedencia", label: "Puno", count: 2, level: 0 },
      { group: "Procedencia", label: "Sin dato", count: 1, level: 0 },
    ],
    totals: { Piezas: 3 },
  });

  it("titula los grupos con su subtotal y no salta de página en cada uno", () => {
    const html = render(<PrintableReport report={grouped} tooLarge={false} />);
    const text = visibleText(html);
    expect(text).toContain("Procedencia: Puno — 2 piezas");
    expect(text).toContain("Procedencia: Sin dato — 1 pieza");
    expect(html).not.toContain("print:break-before-page");
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).toContain("table-header-group");
  });

  it("repite la cabecera una sola vez por tabla, con los totales al final", () => {
    const text = visibleText(render(<PrintableReport report={grouped} tooLarge={false} />));
    expect(text.match(/Piezas agrupadas por procedencia/g)).toHaveLength(1);
    expect(text).toContain("Piezas: 3");
  });

  it("explica por qué hay más apariciones que piezas", () => {
    const text = visibleText(render(<PrintableReport report={report({ message: "Una pieza con varios materiales aparece en cada grupo." })} tooLarge={false} />));
    expect(text).toContain("aparece en cada grupo");
  });

  it("avisa de lo limitado por permisos, igual que la vista previa y el archivo", () => {
    const text = visibleText(render(<PrintableReport report={report({ masked_columns: ["Ubicación"] })} tooLarge={false} />));
    expect(text).toContain("Ubicación limitada a sede y espacio por tus permisos");
  });
});
