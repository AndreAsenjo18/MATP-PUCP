import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio, MIN_TEXT_CONTRAST, relativeLuminance } from "./contrast";
import { CONTRAST_PAIRS } from "./contrast-pairs";

const GLOBALS_CSS = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf-8");

function readTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    tokens.set(match[1], match[2].toLowerCase());
  }
  return tokens;
}

const TOKENS = readTokens(GLOBALS_CSS);

function resolve(name: string): string {
  if (name === "white") return "#ffffff";
  const value = TOKENS.get(name);
  if (!value) throw new Error(`El token "${name}" no está definido en globals.css`);
  return value;
}

const REQUIRED_TOKENS = [
  "terracota",
  "terracota-dark",
  "terracota-light",
  "tinta",
  "crema",
  "crema-light",
  "borde",
  "gris-texto",
  "verde-exito",
  "verde-bg",
  "ambar-alerta",
  "ambar-bg",
  "ambar-texto",
  "carmin-peligro",
  "carmin-bg",
  "carmin-texto",
];

describe("contrastRatio", () => {
  it("da 21 para negro sobre blanco y 1 para colores iguales", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#a23c16", "#a23c16")).toBeCloseTo(1, 5);
  });

  it("es simétrica", () => {
    expect(contrastRatio("#a23c16", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#a23c16"), 10);
  });

  it("rechaza colores con formato inválido", () => {
    expect(() => relativeLuminance("red")).toThrow(/Color no válido/);
  });
});

describe("tokens del sistema de diseño (globals.css)", () => {
  it("define los 16 colores institucionales", () => {
    expect([...TOKENS.keys()].sort()).toEqual([...REQUIRED_TOKENS].sort());
  });

  it("define las tipografías heading y sans con respaldo del sistema", () => {
    expect(GLOBALS_CSS).toMatch(/--font-heading:[^;]*system-ui/);
    expect(GLOBALS_CSS).toMatch(/--font-sans:[^;]*system-ui/);
  });

  it.each(CONTRAST_PAIRS)("$text sobre $background ($usage) cumple contraste AA", ({ text, background }) => {
    expect(contrastRatio(resolve(text), resolve(background))).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("no declara como texto los colores de alerta que no alcanzan contraste sobre su fondo", () => {
    const forbidden = [
      ["ambar-alerta", "ambar-bg"],
      ["carmin-peligro", "carmin-bg"],
    ];
    for (const [text, background] of forbidden) {
      expect(contrastRatio(resolve(text), resolve(background))).toBeLessThan(MIN_TEXT_CONTRAST);
      expect(CONTRAST_PAIRS.some((pair) => pair.text === text && pair.background === background)).toBe(false);
    }
  });
});
