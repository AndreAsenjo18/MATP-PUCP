import { describe, expect, it } from "vitest";

import { EMPTY_OPTIONS } from "@/components/domain/SearchFilters";
import { EMPTY_FILTERS } from "@/lib/data/search";
import { render, visibleText } from "@/test/render";

import { GroupBySelect, ReportActions, ReportFilters, ReportJobNotice } from "./ReportsLive";

// Datos sintéticos (RNF-014).

const noop = () => {};

describe("configuración de «Piezas agrupadas por…»", () => {
  it("ofrece los atributos que pidió el museo, sin elegir ninguno de antemano", () => {
    const html = render(<GroupBySelect value={null} onChange={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Agrupar por");
    expect(text).toContain("Elija un atributo");
    for (const label of ["Procedencia", "Denominación", "Autor", "Material", "Estado de conservación", "Categoría", "Colección"]) {
      expect(text).toContain(label);
    }
    expect(html).not.toMatch(/<option[^>]*selected=""[^>]*value="[a-z]/);
  });

  it("marca el atributo elegido", () => {
    expect(render(<GroupBySelect value="material" onChange={noop} />)).toMatch(/<option[^>]*selected=""[^>]*>Material</);
  });

  it("usa los mismos filtros de la búsqueda, desplegados de entrada y con cuántos hay activos", () => {
    // reportes-vista-simplificada, prueba humana 7.2: plegados no se reconocía que se podían abrir.
    const closed = render(<ReportFilters filters={EMPTY_FILTERS} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />);
    expect(closed).toContain("<details");
    expect(closed).toMatch(/<details[^>]*\sopen/);
    expect(closed).toContain('aria-label="Filtros de búsqueda"');
    expect(closed).toContain("Código o texto");
    expect(visibleText(closed)).not.toContain("activo");

    const one = visibleText(render(<ReportFilters filters={{ ...EMPTY_FILTERS, provenance: "Ayacucho" }} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />));
    expect(one).toContain("Filtros (1 activo)");
    const two = visibleText(render(<ReportFilters filters={{ ...EMPTY_FILTERS, provenance: "Ayacucho", author: "Anónimo" }} options={EMPTY_OPTIONS} onChange={noop} onClear={noop} />));
    expect(two).toContain("Filtros (2 activos)");
  });
});

describe("descargar e imprimir", () => {
  const actions = (total_rows: number, canExport = true) => (
    <ReportActions type="by-attribute" params={{ groupBy: "author" }} report={{ total_rows }} canExport={canExport} busy={false} onExport={noop} />
  );

  it("ofrece Excel y la vista imprimible con los mismos parámetros", () => {
    const html = render(actions(3));
    expect(visibleText(html)).toContain("Exportar a Excel");
    expect(visibleText(html)).toContain("Vista imprimible");
    expect(html).toContain("/reportes/imprimir/by-attribute?group_by=author");
  });

  it("no ofrece nada si no hay piezas con esos filtros", () => {
    expect(render(actions(0))).toBe("");
  });

  it("sin permiso de exportar deja solo la vista imprimible", () => {
    const text = visibleText(render(actions(3, false)));
    expect(text).not.toContain("Exportar a Excel");
    expect(text).toContain("Vista imprimible");
  });
});

describe("reporte en segundo plano", () => {
  it("dice que se está generando mientras está en cola o en preparación", () => {
    for (const status of ["PENDING", "RUNNING"] as const) {
      const html = render(<ReportJobNotice job={{ status }} />);
      expect(html).toContain('role="status"');
      expect(visibleText(html)).toContain("se está generando en segundo plano");
      expect(visibleText(html)).toContain("Mis exportaciones");
    }
  });

  it("avisa al terminar, y dónde descargarlo", () => {
    const html = render(<ReportJobNotice job={{ status: "READY" }} />);
    expect(html).toContain('role="status"');
    expect(visibleText(html)).toContain("ya está listo");
    expect(visibleText(html)).toContain("Mis exportaciones");
  });

  it("avisa si falló, como una alerta", () => {
    const html = render(<ReportJobNotice job={{ status: "FAILED" }} />);
    expect(html).toContain('role="alert"');
    expect(visibleText(html)).toContain("No se pudo generar el reporte");
  });
});
