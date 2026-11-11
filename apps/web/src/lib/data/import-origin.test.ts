import { describe, expect, it } from "vitest";

import { importHref, importScreen, originFromParams, showsPhotoStep } from "./import-origin";

// Spec importacion-datos — Elección del origen de la importación y Paso de fotografías según el origen.

const params = (query: string) => new URLSearchParams(query);

describe("originFromParams", () => {
  it("acepta solo «excel» y «excel-fotos»", () => {
    expect(originFromParams(params("origen=excel"))).toBe("excel");
    expect(originFromParams(params("origen=excel-fotos"))).toBe("excel-fotos");
  });

  it("devuelve null si falta o es desconocido", () => {
    expect(originFromParams(params(""))).toBeNull();
    expect(originFromParams(params("origen=otro"))).toBeNull();
    expect(originFromParams(params("origen=EXCEL"))).toBeNull();
    expect(originFromParams(null)).toBeNull();
  });
});

describe("importScreen", () => {
  it("sin lote ni origen muestra la elección", () => {
    expect(importScreen(params(""))).toBe("picker");
  });

  it("con un origen válido muestra el asistente", () => {
    expect(importScreen(params("origen=excel"))).toBe("wizard");
    expect(importScreen(params("origen=excel-fotos"))).toBe("wizard");
  });

  it("origen desconocido y sin lote: la elección, sin error", () => {
    expect(importScreen(params("origen=otro"))).toBe("picker");
  });

  it("un lote en curso se retoma sin pasar por la elección, con o sin origen", () => {
    expect(importScreen(params("lote=abc"))).toBe("wizard");
    expect(importScreen(params("lote=abc&origen=otro"))).toBe("wizard");
  });
});

describe("importHref", () => {
  it("conserva el origen en cada dirección del asistente", () => {
    expect(importHref({ origin: "excel", batchId: "abc" })).toBe("/importacion?lote=abc&origen=excel");
    expect(importHref({ origin: "excel-fotos" })).toBe("/importacion?origen=excel-fotos");
    expect(importHref({ batchId: "abc" })).toBe("/importacion?lote=abc");
    expect(importHref()).toBe("/importacion");
  });
});

describe("showsPhotoStep", () => {
  it("lo oculta con «excel» y lo muestra con «excel-fotos» o sin origen", () => {
    expect(showsPhotoStep("excel")).toBe(false);
    expect(showsPhotoStep("excel-fotos")).toBe(true);
    expect(showsPhotoStep(null)).toBe(true);
  });
});
