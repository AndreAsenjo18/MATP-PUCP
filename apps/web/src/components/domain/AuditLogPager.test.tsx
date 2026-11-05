import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { AuditLogPager, pageCount, pageRangeSentence } from "./AuditLogPager";

/** Cada botón con sus atributos, para saber cuál está desactivado. */
function buttons(html: string): string[] {
  return html.match(/<button[^>]*>.*?<\/button>/g) ?? [];
}

describe("reglas puras del paginador", () => {
  it("cuenta las páginas y siempre hay al menos una", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
    expect(pageCount(54, 20)).toBe(3);
    expect(pageCount(10, 0)).toBe(1);
  });

  it("dice qué filas se están viendo", () => {
    expect(pageRangeSentence(1, 20, 54, "registros")).toBe("Mostrando del 1 al 20 de 54 registros");
    expect(pageRangeSentence(3, 20, 54, "registros")).toBe("Mostrando del 41 al 54 de 54 registros");
    expect(pageRangeSentence(1, 20, 0, "registros")).toBe("");
  });
});

describe("AuditLogPager", () => {
  it("con una sola página no se muestra", () => {
    expect(render(<AuditLogPager page={1} pageSize={20} total={20} noun="registros" onPageChange={() => {}} />)).toBe("");
  });

  it("muestra la página actual, el rango y deja pasar de una página a otra", () => {
    const html = render(<AuditLogPager page={2} pageSize={20} total={54} noun="conjuntos de cambios" onPageChange={() => {}} />);
    const text = visibleText(html);
    const [previous, next] = buttons(html);

    expect(html).toContain('aria-label="Paginación"');
    expect(text).toContain("Página 2 de 3");
    expect(text).toContain("Mostrando del 21 al 40 de 54 conjuntos de cambios");
    expect(previous).not.toContain('disabled=""');
    expect(next).not.toContain('disabled=""');
  });

  it("en la primera página «Anterior» está desactivado y en la última «Siguiente»", () => {
    const [firstPrevious, firstNext] = buttons(render(<AuditLogPager page={1} pageSize={20} total={54} noun="registros" onPageChange={() => {}} />));
    const [lastPrevious, lastNext] = buttons(render(<AuditLogPager page={3} pageSize={20} total={54} noun="registros" onPageChange={() => {}} />));

    expect(firstPrevious).toContain('disabled=""');
    expect(firstNext).not.toContain('disabled=""');
    expect(lastPrevious).not.toContain('disabled=""');
    expect(lastNext).toContain('disabled=""');
  });

  it("mientras carga bloquea los dos botones", () => {
    const html = render(<AuditLogPager page={2} pageSize={20} total={54} noun="registros" disabled onPageChange={() => {}} />);

    expect(buttons(html).every((button) => button.includes('disabled=""'))).toBe(true);
  });
});
