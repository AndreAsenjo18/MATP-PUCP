import { describe, expect, it } from "vitest";

import type { Report } from "@/lib/data/reports";
import { render, visibleText } from "@/test/render";

import { DescriptionCell, ReportPreview } from "./ReportPreview";

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
  it("muestra el encabezado con quién lo generó y los filtros, el detalle, los subtotales y los totales", () => {
    const text = visibleText(render(<ReportPreview report={report()} onPage={noop} />));
    expect(text).toContain("Inventario general");
    expect(text).toContain("por curadora@matp.local");
    expect(text).toContain("Filtros: collection: Colección RA (ficticia)");
    expect(text).toContain("Retablo de San Marcos");
    expect(text).toContain("Régimen: Propiedad — 2");
    expect(text).toContain("2 piezas · 2 en propiedad");
    expect(text).not.toContain("Página");
  });

  it("pone los totales antes que la tabla", () => {
    const text = visibleText(render(<ReportPreview report={report()} onPage={noop} />));
    expect(text.indexOf("2 piezas · 2 en propiedad")).toBeLessThan(text.indexOf("Retablo de San Marcos"));
  });

  it("deja el encabezado de la tabla fijo al desplazarse", () => {
    const html = render(<ReportPreview report={report()} onPage={noop} />);
    expect(html.match(/<th[^>]*scope="col"[^>]*sticky top-0/g)).toHaveLength(3);
    expect(html).toMatch(/max-h-\[70vh\] overflow-auto/);
  });

  it("muestra las mismas columnas que el archivo, en el mismo orden", () => {
    const columns = ["Grupo", "Denominación", "Descripción", "Colección"];
    const html = render(<ReportPreview report={report({ columns, rows: [["Puno", "Mate", "Burilado", "RA"]] })} onPage={noop} />);
    const headers = Array.from(html.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)<\/th>/g), (match) => match[1]);
    expect(headers).toEqual(columns);
  });

  it("avisa de lo limitado por permisos con las palabras del archivo", () => {
    const masked = visibleText(render(<ReportPreview report={report({ masked_columns: ["Ubicación"] })} />));
    expect(masked).toContain("Ubicación limitada a sede y espacio por tus permisos");
    expect(visibleText(render(<ReportPreview report={report()} />))).not.toContain("por tus permisos");
  });

  it("muestra el mensaje del reporte vacío, sin tabla", () => {
    const empty = visibleText(render(<ReportPreview report={report({ rows: [], total_rows: 0, totals: { Piezas: 0 }, subtotals: [], message: "No hay piezas con estos filtros" })} />));
    expect(empty).toContain("No hay piezas con estos filtros");
    expect(empty).not.toContain("Denominación");
  });

  it("explica por qué una pieza con dos materiales suma más apariciones que piezas", () => {
    const text = visibleText(render(<ReportPreview report={report({ totals: { Piezas: 1, "Apariciones en grupos": 2 }, message: "Una pieza con varios materiales aparece en cada grupo." })} />));
    expect(text).toContain("1 pieza · 2 apariciones en grupos");
    expect(text).toContain("aparece en cada grupo");
  });

  it("pagina de 50 en 50 con cuántas filas hay", () => {
    const paged = visibleText(render(<ReportPreview report={report({ total_rows: 120, page_size: 50 })} onPage={noop} />));
    expect(paged).toContain("Página 1 de 3 (120 filas)");
  });

  it("no desactiva «Siguiente» en la primera página, y sí «Anterior»", () => {
    const html = render(<ReportPreview report={report({ total_rows: 120, page_size: 50 })} onPage={noop} />);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Anterior/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Siguiente/);
  });
});

describe("reporte muy grande", () => {
  it("muestra los totales de todo el reporte y solo la primera página", () => {
    const rows = Array.from({ length: 50 }, (_, index) => [`Pieza ${index}`, "RA", "Depósito"]);
    const html = render(
      <ReportPreview report={report({ rows, total_rows: 10000, page_size: 50, totals: { Piezas: 10000 }, subtotals: [{ group: "Colección", label: "RA", count: 10000, level: 0 }] })} onPage={noop} />,
    );
    const text = visibleText(html);
    expect(text).toContain("10,000 piezas");
    expect(text).toContain("Colección: RA — 10,000 piezas");
    expect(text).toContain("Página 1 de 200 (10000 filas)");
    expect(text).toContain("Pieza 49");
    expect(text).not.toContain("Pieza 50");
  });
});

describe("grupos plegables", () => {
  const grouped = report({
    columns: ["Grupo", "Denominación", "Descripción"],
    rows: [
      ["Puno", "Mate de Puno", "Burilado"],
      ["Puno", "Toro de Pucará", "Cerámica"],
      ["Sin dato", "Retablo sin procedencia", ""],
    ],
    subtotals: [
      { group: "Procedencia", label: "Puno", count: 80, level: 0 },
      { group: "Procedencia", label: "Sin dato", count: 1, level: 0 },
    ],
  });

  it("encabeza cada grupo con su subtotal de todo el reporte, en singular y plural", () => {
    const text = visibleText(render(<ReportPreview report={grouped} onPage={noop} />));
    expect(text).toContain("Procedencia: Puno — 80 piezas");
    expect(text).toContain("Procedencia: Sin dato — 1 pieza");
  });

  it("abre todos los grupos al inicio", () => {
    const html = render(<ReportPreview report={grouped} onPage={noop} />);
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(2);
    expect(html).not.toContain('aria-expanded="false"');
  });

  it("esconde solo las filas del grupo plegado y conserva su subtotal", () => {
    const html = render(<ReportPreview report={grouped} onPage={noop} initialCollapsed={["Puno"]} />);
    const text = visibleText(html);
    expect(html).toContain('aria-expanded="false"');
    expect(text).toContain("Procedencia: Puno — 80 piezas");
    expect(text).not.toContain("Mate de Puno");
    expect(text).toContain("Retablo sin procedencia");
  });

  it("deja el botón del grupo de al menos 44 px", () => {
    expect(render(<ReportPreview report={grouped} onPage={noop} />)).toMatch(/<button[^>]*aria-expanded[^>]*min-h-11/);
  });

  it("no inventa grupos en un reporte que no los tiene", () => {
    const html = render(<ReportPreview report={report({ columns: ["Espacio", "Piezas"], rows: [["Depósito 1", 3]], subtotals: [] })} onPage={noop} />);
    expect(html).not.toContain("aria-expanded");
    expect(visibleText(html)).toContain("Depósito 1");
  });
});

describe("descripción en la vista previa", () => {
  const long = "Descripción sintética de una pieza. ".repeat(20);

  it("recorta a dos líneas la larga y ofrece «ver más», con el texto completo disponible", () => {
    const html = render(<DescriptionCell text={long} />);
    expect(html).toContain("line-clamp-2");
    expect(html).toContain('aria-expanded="false"');
    expect(visibleText(html)).toContain("ver más");
    expect(visibleText(html)).toContain(long.trim());
  });

  it("al expandirla quita el recorte y ofrece «ver menos»", () => {
    const html = render(<DescriptionCell text={long} initialExpanded />);
    expect(html).not.toContain("line-clamp-2");
    expect(html).toContain('aria-expanded="true"');
    expect(visibleText(html)).toContain("ver menos");
  });

  it("no ofrece «ver más» en la corta", () => {
    const html = render(<DescriptionCell text="Mate burilado" />);
    expect(visibleText(html)).toBe("Mate burilado");
    expect(html).not.toContain("<button");
  });

  it("deja vacía la celda de una pieza sin descripción, sin texto de relleno", () => {
    const html = render(
      <ReportPreview report={report({ columns: ["Denominación", "Descripción"], rows: [["Mate", null]], subtotals: [] })} onPage={noop} />,
    );
    expect(visibleText(html)).not.toContain("—");
  });
});
