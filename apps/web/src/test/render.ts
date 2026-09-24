/**
 * Renderizado de componentes para pruebas en el entorno `node` de Vitest, sin jsdom (ADR-012):
 * se obtiene el HTML estático y se inspecciona como texto.
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function render(element: ReactElement): string {
  return renderToStaticMarkup(element);
}

/** Texto visible del HTML (sin etiquetas ni espacios repetidos). */
export function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
