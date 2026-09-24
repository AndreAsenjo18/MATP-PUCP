/**
 * Detección de colores fuera del sistema de diseño (design.md D8): clases de la paleta genérica de
 * Tailwind (`bg-stone-900`, `text-red-700`...) y colores hexadecimales escritos a mano. Se permiten
 * `white`, `black`, `transparent` y los tokens institucionales de globals.css.
 */

const PREFIXES = "bg|text|border|ring|divide|outline|from|to|via|fill|stroke|decoration|accent|caret|shadow|placeholder";
const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const GENERIC_CLASS = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:${PREFIXES})(?:-[trblxyse])?-(?:${PALETTE})-\\d{2,3}(?:/\\d{1,3})?(?![\\w-])`, "g");
const HEX_COLOR = /(?<![\w&])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?![\w-])/g;

/** Token sugerido para reemplazar una clase genérica, según el color y su uso. */
const SUGGESTIONS: Record<string, string> = {
  stone: "tinta / gris-texto / borde / crema",
  gray: "tinta / gris-texto / borde / crema",
  slate: "tinta / gris-texto / borde / crema",
  zinc: "tinta / gris-texto / borde / crema",
  neutral: "tinta / gris-texto / borde / crema",
  red: "carmin-peligro / carmin-bg / carmin-texto",
  rose: "carmin-peligro / carmin-bg / carmin-texto",
  amber: "ambar-alerta / ambar-bg / ambar-texto",
  yellow: "ambar-alerta / ambar-bg / ambar-texto",
  orange: "terracota / terracota-light / terracota-dark",
  emerald: "verde-exito / verde-bg",
  green: "verde-exito / verde-bg",
  sky: "terracota-light / terracota-dark (info)",
  blue: "terracota-light / terracota-dark (info)",
};

export interface PaletteViolation {
  line: number;
  match: string;
  suggestion: string;
}

export function findPaletteViolations(source: string): PaletteViolation[] {
  const violations: PaletteViolation[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    for (const match of text.matchAll(GENERIC_CLASS)) {
      const color = new RegExp(`-(${PALETTE})-`).exec(match[0])?.[1] ?? "";
      violations.push({ line: index + 1, match: match[0], suggestion: SUGGESTIONS[color] ?? "un token de globals.css" });
    }
    for (const match of text.matchAll(HEX_COLOR)) {
      violations.push({ line: index + 1, match: match[0], suggestion: "un token de globals.css (no escriba colores hexadecimales)" });
    }
  });
  return violations;
}

export function describeViolations(file: string, violations: PaletteViolation[]): string[] {
  return violations.map((v) => `${file}:${v.line} usa "${v.match}"; reemplácelo por ${v.suggestion}.`);
}
