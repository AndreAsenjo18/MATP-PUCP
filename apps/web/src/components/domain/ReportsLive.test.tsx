import { describe, expect, it } from "vitest";

import type { Report } from "@/lib/data/reports";
import { render, visibleText } from "@/test/render";

import { PrintableReport, ReportPreview } from "./ReportsLive";

// Datos sintéticos (RNF-014).

const noop = () => {};

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

describe("vista previa del reporte", () => {
  it("muestra quién lo generó, el detalle, los subtotales y los totales", () => {
    const text = visibleText(render(<ReportPreview report={report()} onPage={noop} />));
    expect(text).toContain("Inventario general");
    expect(text).toContain("por curadora@matp.local");
    expect(text).toContain("Retablo de San Marcos");
    expect(text).toContain("Régimen: Propiedad — 2");
    expect(text).toContain("Piezas: 2 · Propiedad: 2");
    expect(text).not.toContain("Página");
  });

  it("avisa de las columnas limitadas, del reporte vacío y pagina", () => {
    const masked = visibleText(render(<ReportPreview report={report({ masked_columns: ["Ubicación"] })} />));
    expect(masked).toContain("Su rol ve limitadas estas columnas: Ubicación");

    const empty = visibleText(render(<ReportPreview report={report({ rows: [], total_rows: 0, totals: { Piezas: 0 }, message: "No hay piezas activas en el inventario con estos filtros: cero piezas." })} />));
    expect(empty).toContain("cero piezas");
    expect(empty).not.toContain("Denominación");

    const paged = visibleText(render(<ReportPreview report={report({ total_rows: 60 })} onPage={noop} />));
    expect(paged).toContain("Página 1 de 3 (60 filas)");
  });
});

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
