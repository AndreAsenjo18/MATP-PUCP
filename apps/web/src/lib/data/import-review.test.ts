import { describe, expect, it } from "vitest";

import type { MappingTemplate } from "@/lib/data/import-templates";

import {
  approvalSentence,
  formatCause,
  formatCauseSentence,
  groupRepeatedErrors,
  isCompactRow,
  pendingWork,
  reviewSummary,
  type ErrorRow,
} from "./import-review";

// Spec importacion-datos — Resumen de la revisión, Errores repetidos agrupados, Formato como causa probable.
// Datos sintéticos (RNF-014).

const TENURE = { code: "tenure_required", message: "Falta el régimen de tenencia." };

function errorRows(count: number, classification: ErrorRow["classification"], error = TENURE, from = 1): ErrorRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${classification}-${from + i}`,
    rowNumber: from + i,
    classification,
    decision: "PENDING",
    errors: [error],
  }));
}

describe("resumen exclusivo de la revisión", () => {
  // Lote de 30 filas: 22 actualizaciones, 6 posibles duplicados y 2 conflictos; las 30 con el error de régimen.
  const counts = { rows: 30, NEW: 0, UPDATE: 22, POSSIBLE_DUPLICATE: 6, CONFLICT: 2, ERRORS: 30 };
  const withErrors = [...errorRows(22, "UPDATE"), ...errorRows(6, "POSSIBLE_DUPLICATE", TENURE, 23), ...errorRows(2, "CONFLICT", TENURE, 29)];

  it("cuenta cada fila una sola vez, con los errores primero, y suma el total", () => {
    const summary = reviewSummary(counts, withErrors);
    expect(summary).toEqual({ total: 30, errors: 30, conflicts: 0, duplicates: 0, updates: 0, news: 0 });
    expect(summary!.errors + summary!.conflicts + summary!.duplicates + summary!.updates + summary!.news).toBe(30);
  });

  it("en un lote sin errores reparte las filas entre las demás situaciones", () => {
    const summary = reviewSummary({ rows: 20, NEW: 12, UPDATE: 5, POSSIBLE_DUPLICATE: 2, CONFLICT: 1, ERRORS: 0 }, []);
    expect(summary).toEqual({ total: 20, errors: 0, conflicts: 1, duplicates: 2, updates: 5, news: 12 });
  });

  it("descuenta de cada situación solo las filas que tienen error", () => {
    const summary = reviewSummary({ rows: 10, NEW: 6, UPDATE: 4, POSSIBLE_DUPLICATE: 0, CONFLICT: 0, ERRORS: 3 }, errorRows(3, "NEW"));
    expect(summary).toMatchObject({ errors: 3, news: 3, updates: 4 });
    expect(summary!.errors + summary!.news + summary!.updates).toBe(10);
  });

  it("no inventa cifras: sin leer las filas con error, o si no coinciden, devuelve null", () => {
    expect(reviewSummary(counts, null)).toBeNull();
    expect(reviewSummary(counts, errorRows(5, "UPDATE"))).toBeNull();
  });

  it("un lote vacío tiene total 0", () => {
    expect(reviewSummary({ rows: 0 }, null)).toMatchObject({ total: 0, errors: 0 });
    expect(approvalSentence(reviewSummary({ rows: 0 }, null), { errors: 0, conflicts: 0 })).toContain("no trajo filas");
  });
});

describe("qué falta para aprobar", () => {
  it("dice cuántas filas con error y cuántos conflictos siguen sin decidir", () => {
    const summary = reviewSummary({ rows: 8, NEW: 3, UPDATE: 2, POSSIBLE_DUPLICATE: 1, CONFLICT: 2, ERRORS: 0 }, []);
    const pending = pendingWork(summary, errorRows(2, "NEW"));
    expect(pending).toEqual({ errors: 2, conflicts: 3 });
    const text = approvalSentence(summary, pending);
    expect(text).toContain("2 filas con error sin decidir");
    expect(text).toContain("3 filas por resolver");
  });

  it("con todo decidido dice que se puede aprobar", () => {
    const summary = reviewSummary({ rows: 5, NEW: 5, UPDATE: 0, POSSIBLE_DUPLICATE: 0, CONFLICT: 0, ERRORS: 0 }, []);
    expect(approvalSentence(summary, { errors: 0, conflicts: 0 })).toContain("puede aprobar");
  });
});

describe("errores repetidos agrupados", () => {
  it("30 filas con el mismo error forman un solo grupo", () => {
    const groups = groupRepeatedErrors(errorRows(30, "UPDATE"));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ code: "tenure_required", message: "Falta el régimen de tenencia.", undecided: 30 });
    expect(groups[0].rowIds).toHaveLength(30);
  });

  it("dos filas iguales no forman grupo, tres sí", () => {
    expect(groupRepeatedErrors(errorRows(2, "NEW"))).toEqual([]);
    expect(groupRepeatedErrors(errorRows(3, "NEW"))).toHaveLength(1);
  });

  it("separa los errores distintos y ordena por tamaño", () => {
    const title = { code: "title_required", message: "Falta la denominación." };
    const rows = [...errorRows(3, "NEW", title), ...errorRows(5, "UPDATE", TENURE, 10)];
    const groups = groupRepeatedErrors(rows);
    expect(groups.map((group) => group.code)).toEqual(["tenure_required", "title_required"]);
  });

  it("cuenta las filas ya decididas aparte", () => {
    const rows = errorRows(4, "NEW");
    rows[0].decision = "EXCLUDED";
    expect(groupRepeatedErrors(rows)[0].undecided).toBe(3);
  });

  it("una fila cuyo único problema es un error agrupado se compacta; una en conflicto no", () => {
    const groups = groupRepeatedErrors(errorRows(3, "NEW"));
    const errors = [TENURE];
    expect(isCompactRow({ classification: "NEW", validation_errors: errors }, groups)).toBe(true);
    expect(isCompactRow({ classification: "CONFLICT", validation_errors: errors }, groups)).toBe(false);
    expect(isCompactRow({ classification: "NEW", validation_errors: [{ code: "x", message: "Otro error." }] }, groups)).toBe(false);
    expect(isCompactRow({ classification: "NEW", validation_errors: [] }, groups)).toBe(false);
  });
});

function template(columns: string[], defaults: Record<string, unknown> = {}): MappingTemplate {
  return {
    id: "tpl-1",
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana (sintética)",
    header_signature: "a".repeat(64),
    columns: columns.map((target) => ({ source_column: target.toUpperCase(), target_field: target })),
    defaults,
    description: null,
    created_at: "2026-10-22T10:00:00Z",
  } as unknown as MappingTemplate;
}

describe("formato como causa probable", () => {
  const group = groupRepeatedErrors(errorRows(30, "UPDATE"))[0];

  it("culpa al formato si no trae la columna de régimen y afecta a casi todas las filas", () => {
    const cause = formatCause(group, template(["denomination", "identifier"]), 30);
    expect(cause).toEqual({ formatName: "Plantilla sábana sintética v1", columnLabel: "régimen de tenencia" });
    expect(formatCauseSentence(cause!)).toBe("El formato «Plantilla sábana sintética v1» no trae la columna de régimen de tenencia.");
  });

  it("no lo culpa si el formato sí trae la columna", () => {
    expect(formatCause(group, template(["denomination", "tenure_regime"]), 30)).toBeNull();
  });

  it("no lo culpa si el formato trae un régimen por defecto", () => {
    expect(formatCause(group, template(["denomination"], { tenure_regime: "PROPIEDAD" }), 30)).toBeNull();
  });

  it("no lo culpa si afecta a pocas filas", () => {
    expect(formatCause(group, template(["denomination"]), 100)).toBeNull();
  });

  it("no lo culpa en errores que no son de un dato que falta ni sin formato", () => {
    const other = { code: "invalid_inventory_code", rowIds: group.rowIds };
    expect(formatCause(other, template(["denomination"]), 30)).toBeNull();
    expect(formatCause(group, null, 30)).toBeNull();
  });
});
