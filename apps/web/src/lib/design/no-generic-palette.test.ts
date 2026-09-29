/**
 * Ningún componente ni pantalla usa colores fuera del sistema de diseño (requirement «Sistema de
 * diseño institucional con tokens y contraste accesible», escenario «Clase de paleta genérica»).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { describeViolations, findPaletteViolations } from "./generic-palette";

const SRC = path.resolve(__dirname, "../..");

function tsxFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf-8" })
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
    .map((file) => path.join(SRC, file));
}

describe("findPaletteViolations", () => {
  it("detecta clases genéricas con variantes, opacidad y colores hexadecimales", () => {
    const source = [
      '<div className="bg-stone-900 hover:text-red-700 md:border-amber-300/50">',
      '<p style={{ color: "#1c1917" }}>',
    ].join("\n");
    const found = findPaletteViolations(source).map((v) => `${v.line}:${v.match}`);
    expect(found).toEqual(["1:bg-stone-900", "1:hover:text-red-700", "1:md:border-amber-300/50", "2:#1c1917"]);
  });

  it("acepta tokens institucionales, blanco, negro y entidades HTML", () => {
    const source = '<div className="bg-terracota text-white border-borde text-ambar-texto bg-black/40 hover:bg-white/10">&#8212;</div>';
    expect(findPaletteViolations(source)).toEqual([]);
  });

  it("sugiere el token equivalente en español", () => {
    const [violation] = findPaletteViolations('className="text-emerald-900"');
    expect(describeViolations("app/x.tsx", [violation])[0]).toBe('app/x.tsx:1 usa "text-emerald-900"; reemplácelo por verde-exito / verde-bg.');
  });
});

describe("paleta del frontend", () => {
  it("ningún .tsx de src/ usa clases de paleta genérica ni hex", () => {
    const violations = tsxFiles().flatMap((file) =>
      describeViolations(path.relative(SRC, file).replaceAll("\\", "/"), findPaletteViolations(readFileSync(file, "utf-8"))),
    );
    expect(violations).toEqual([]);
  });
});
