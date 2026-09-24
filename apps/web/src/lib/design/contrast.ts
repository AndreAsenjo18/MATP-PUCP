/**
 * Contraste de color según WCAG 2.2 (fórmula de luminancia relativa). Función pura usada por la
 * prueba de tokens del sistema de diseño (RNF-010).
 */

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const match = HEX_COLOR.exec(hex);
  if (!match) {
    throw new Error(`Color no válido: "${hex}". Use el formato #RRGGBB.`);
  }
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(match[1].slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). */
export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mínimo WCAG 2.2 AA para texto normal. */
export const MIN_TEXT_CONTRAST = 4.5;
