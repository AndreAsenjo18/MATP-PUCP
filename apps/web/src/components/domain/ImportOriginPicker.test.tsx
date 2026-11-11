import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { IMPORT_ORIGIN_OPTIONS, ImportOriginPicker } from "./ImportOriginPicker";

// Spec importacion-datos — Elección del origen de la importación. Datos sintéticos (RNF-014).

describe("elección del origen de la importación", () => {
  const html = render(<ImportOriginPicker />);
  const text = visibleText(html);

  it("abre con la pregunta y las tres tarjetas", () => {
    expect(text).toContain("¿Qué desea importar?");
    expect(text).toContain("Solo Excel");
    expect(text).toContain("Solo imágenes");
    expect(text).toContain("Excel e imágenes");
    expect(html.match(/<a /g)).toHaveLength(3);
  });

  it("cada tarjeta es un enlace a su flujo", () => {
    expect(html).toContain('href="/importacion?origen=excel"');
    expect(html).toContain('href="/importacion/fotos"');
    expect(html).toContain('href="/importacion?origen=excel-fotos"');
  });

  it("avisa que las fotos son para piezas ya registradas y que van después del Excel", () => {
    expect(text).toContain("ya están registradas");
    expect(text).toContain("no crea una pieza");
    expect(text).toContain("después del Excel");
  });

  it("no muestra formularios de subida ni identificadores de requisitos", () => {
    expect(html).not.toContain('type="file"');
    expect(text).not.toMatch(/\b(RF|RN|RNF|RIA)-\d+/);
    expect(IMPORT_ORIGIN_OPTIONS).toHaveLength(3);
  });
});
