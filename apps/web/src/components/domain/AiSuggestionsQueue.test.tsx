import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { AiSuggestionsLive } from "./AiSuggestionsLive";

// Change revisar-pendientes-unificado, tarea 1.3: la cola de sugerencias se movió de
// `app/ia/sugerencias/page.tsx` a `AiSuggestionsQueue` sin cambiar su lógica; `embedded` solo quita
// el encabezado cuando la monta la bandeja «Revisar pendientes». HTML estático (ADR-012).
//
// La rama de demostración de `AiSuggestionsQueue` necesita una sesión con `ai.review`, y en HTML
// estático la sesión siempre está vacía (`getServerSnapshot`): se comprueba en el navegador (6.1).

describe("cola de sugerencias en modo conectado (tarea 1.3)", () => {
  it("sin `embedded` se ve como antes: su título y su línea de ayuda", () => {
    const html = render(<AiSuggestionsLive canReview />);
    expect(html.match(/<h1\b[^>]*>([^<]+)</)?.[1]).toBe("Sugerencias de IA");
    expect(visibleText(html)).toContain("Propuestas de la IA pendientes de revisión, de cualquier pieza.");
    expect(visibleText(html)).toContain("Cargando…");
  });

  it("con `embedded` no repite el título ni la ayuda; el resto de la cola sigue igual", () => {
    const html = render(<AiSuggestionsLive canReview embedded />);
    expect(html).not.toContain("<h1");
    expect(visibleText(html)).not.toContain("Propuestas de la IA pendientes de revisión");
    expect(visibleText(html)).toContain("Cargando…");
  });

  it("sin permiso para revisar, el mismo aviso con o sin `embedded`", () => {
    const standalone = visibleText(render(<AiSuggestionsLive canReview={false} />));
    expect(standalone).toMatch(/Su rol no puede revisar sugerencias de IA/);
    expect(visibleText(render(<AiSuggestionsLive canReview={false} embedded />))).toBe(standalone);
  });
});
