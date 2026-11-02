import { describe, expect, it } from "vitest";

import { REPORT_TYPES } from "@/lib/data/reports";
import { render, visibleText } from "@/test/render";

import { ReportSelector } from "./ReportSelector";

const noop = () => {};

describe("selector de reportes", () => {
  it("muestra cada reporte con su título y una línea de lo que trae", () => {
    const text = visibleText(render(<ReportSelector selected="inventory" onSelect={noop} />));
    expect(REPORT_TYPES.map((report) => report.type)).toEqual(["inventory", "by-collection", "by-location", "by-attribute", "incomplete"]);
    for (const report of REPORT_TYPES) {
      expect(text).toContain(report.label);
      expect(text).toContain(report.summary);
    }
    expect(text).toContain("Piezas agrupadas por…");
  });

  it("marca solo el reporte elegido, de forma accesible", () => {
    const html = render(<ReportSelector selected="by-attribute" onSelect={noop} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(REPORT_TYPES.length - 1);
    expect(html).toMatch(/aria-pressed="true"[^>]*ring-terracota/);
    expect(html).toContain('aria-label="Tipo de reporte"');
  });

  it("deja tarjetas de al menos 44 px para el dedo", () => {
    const html = render(<ReportSelector selected="inventory" onSelect={noop} />);
    expect(html.match(/min-h-11/g)).toHaveLength(REPORT_TYPES.length);
  });
});
