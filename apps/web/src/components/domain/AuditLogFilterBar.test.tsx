import { describe, expect, it } from "vitest";

import { EMPTY_AUDIT_FILTERS } from "@/lib/data/audit-query";
import { ids } from "@/lib/fixtures";
import { render, visibleText } from "@/test/render";

import { AuditLogFilterBar, capitalize, hasAdvancedAuditFilters } from "./AuditLogFilterBar";

const PEOPLE = [
  { id: ids.user(1), name: "Administrador MATP (sintético)" },
  { id: ids.user(2), name: "Gabriela Curadora (sintética)" },
];

describe("reglas puras de los filtros", () => {
  it("pone la primera letra en mayúscula", () => {
    expect(capitalize("carga masiva de Excel")).toBe("Carga masiva de Excel");
    expect(capitalize("")).toBe("");
  });

  it("sabe si hay filtros avanzados aplicados", () => {
    expect(hasAdvancedAuditFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
    expect(hasAdvancedAuditFilters({ ...EMPTY_AUDIT_FILTERS, origin: "IMPORT", from: "2026-09-01" })).toBe(false);
    expect(hasAdvancedAuditFilters({ ...EMPTY_AUDIT_FILTERS, originRef: "lote" })).toBe(true);
    expect(hasAdvancedAuditFilters({ ...EMPTY_AUDIT_FILTERS, userId: ids.user(1) })).toBe(true);
  });
});

describe("AuditLogFilterBar", () => {
  it("ofrece tipo, origen, acción y fechas a la vista, con etiquetas visibles", () => {
    const html = render(<AuditLogFilterBar filters={EMPTY_AUDIT_FILTERS} people={PEOPLE} onApply={() => {}} />);
    const text = visibleText(html);

    expect(html).toContain('aria-label="Filtros de la auditoría"');
    for (const label of ["Tipo de registro", "Origen del cambio", "Acción", "Desde", "Hasta", "Filtrar"]) {
      expect(text).toContain(label);
    }
    expect(html.match(/type="date"/g)).toHaveLength(2);
  });

  it("lista los orígenes y las acciones en español", () => {
    const text = visibleText(render(<AuditLogFilterBar filters={EMPTY_AUDIT_FILTERS} people={PEOPLE} onApply={() => {}} />));

    for (const label of ["Edición manual", "Carga masiva de Excel", "Sugerencia de inteligencia artificial", "Proceso del sistema"]) {
      expect(text).toContain(label);
    }
    for (const label of ["Creación", "Modificación", "Baja lógica", "Restauración", "Corrección", "Fusión", "Reversión"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Fotografía o documento");
    expect(text).toContain("Término de vocabulario");
  });

  it("deja lo menos usado en «Más filtros», cerrado si no hay ninguno aplicado", () => {
    const html = render(<AuditLogFilterBar filters={EMPTY_AUDIT_FILTERS} people={PEOPLE} onApply={() => {}} />);
    const text = visibleText(html);

    expect(text).toContain("Más filtros");
    expect(text).toContain("Persona que hizo el cambio");
    expect(text).toContain("Lote de importación o sugerencia de IA");
    expect(text).toContain("Registro concreto");
    expect(text).toContain("Conjunto de cambios concreto");
    expect(html).not.toMatch(/<details[^>]*\sopen=""/);
    expect(text).toContain("Gabriela Curadora (sintética)");
  });

  it("«Más filtros» se abre solo cuando alguno de ellos está aplicado", () => {
    const html = render(<AuditLogFilterBar filters={{ ...EMPTY_AUDIT_FILTERS, originRef: "lote" }} people={PEOPLE} onApply={() => {}} />);

    expect(html).toMatch(/<details[^>]*\sopen=""/);
    expect(html).toContain('value="lote"');
  });

  it("parte de los filtros aplicados y solo ofrece quitarlos si hay alguno", () => {
    const empty = visibleText(render(<AuditLogFilterBar filters={EMPTY_AUDIT_FILTERS} people={PEOPLE} onApply={() => {}} />));
    const html = render(<AuditLogFilterBar filters={{ ...EMPTY_AUDIT_FILTERS, origin: "IMPORT", from: "2026-09-01" }} people={PEOPLE} onApply={() => {}} />);

    expect(empty).not.toContain("Quitar filtros");
    expect(visibleText(html)).toContain("Quitar filtros");
    expect(html).toContain('value="2026-09-01"');
    expect(html).toMatch(/<option value="IMPORT" selected=""/);
  });

  it("mientras carga bloquea los campos", () => {
    const html = render(<AuditLogFilterBar filters={EMPTY_AUDIT_FILTERS} people={PEOPLE} disabled onApply={() => {}} />);

    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(8);
  });
});
