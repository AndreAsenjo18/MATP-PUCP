import { describe, expect, it } from "vitest";

import { batchRowSummary, formatUploadedAt, pendingImportHref } from "./PendingImports";

// Change digitalizacion-libro-registros: pestaña «Importaciones pendientes» de la bandeja de
// pendientes, para que un lote listo para aprobar no dependa de que alguien pase su dirección a
// mano. Funciones puras (ADR-012); el ciclo de red se prueba en vivo, no aquí (no hay jsdom).

describe("resumen de una fila de la lista", () => {
  it("dice cuántas piezas nuevas y cuántas actualizaciones, solo si hay", () => {
    expect(batchRowSummary({ NEW: 9, UPDATE: 0 })).toBe("9 piezas nuevas");
    expect(batchRowSummary({ NEW: 1, UPDATE: 2 })).toBe("1 pieza nueva, 2 actualizaciones");
    expect(batchRowSummary({ NEW: 0, UPDATE: 1 })).toBe("1 actualización");
  });

  it("sin nada que crear ni actualizar, lo dice así", () => {
    expect(batchRowSummary({ NEW: 0, UPDATE: 0 })).toBe("Sin filas para aplicar todavía.");
    expect(batchRowSummary(null)).toBe("Sin filas para aplicar todavía.");
    expect(batchRowSummary(undefined)).toBe("Sin filas para aplicar todavía.");
  });
});

describe("fecha de subida", () => {
  it("en formato peruano", () => {
    expect(formatUploadedAt("2026-11-24T20:28:38.000Z")).not.toBe("2026-11-24T20:28:38.000Z");
  });

  it("una fecha que no se puede leer se muestra tal cual, sin reventar", () => {
    expect(formatUploadedAt("")).toBe("");
    expect(formatUploadedAt("no-es-una-fecha")).toBe("no-es-una-fecha");
  });
});

describe("dirección del lote", () => {
  it("lleva al asistente de importación con el lote ya elegido", () => {
    expect(pendingImportHref("01a2107c-58c2-7081-a4dd-a60e52933899")).toBe("/importacion?lote=01a2107c-58c2-7081-a4dd-a60e52933899");
  });
});
