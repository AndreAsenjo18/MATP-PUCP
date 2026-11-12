import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { PIECE_DETAIL_TABS, PieceDetailPanel, PieceDetailTabs } from "./PieceDetailTabs";

const noop = () => {};

describe("Ficha unificada: navegación por secciones (C9)", () => {
  it("muestra siete secciones, sin repetir origen y auditoría", () => {
    const html = render(<PieceDetailTabs activeTab="Datos generales" onChange={noop} pendingSuggestions={2} />);
    expect((html.match(/role="tab"/g) ?? []).length).toBe(7);
    expect(PIECE_DETAIL_TABS).toHaveLength(7);
    expect(visibleText(html)).toContain("Origen y auditoría");
    expect(visibleText(html)).toContain("Sugerencias IA 2");
  });

  it("indica la sección seleccionada y ofrece navegación por teclado", () => {
    const html = render(<PieceDetailTabs activeTab="Identificadores" onChange={noop} />);
    expect(html).toContain('id="piece-tab-identifiers"');
    expect(html).toMatch(/id="piece-tab-identifiers"[^>]*aria-selected="true"/);
    expect(html).toContain('aria-controls="piece-panel-identifiers"');
    expect(html).toContain('tabindex="0"');
  });

  it("mantiene oculto el contenido de una sección visitada para preservar el formulario", () => {
    const html = render(<PieceDetailPanel tab="Fotografías" activeTab="Datos generales" visited><p>Borrador de foto</p></PieceDetailPanel>);
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('hidden=""');
    expect(html).toContain('Borrador de foto');
  });

  it("no monta el contenido de secciones que aún no fueron abiertas", () => {
    const html = render(<PieceDetailPanel tab="Fotografías" activeTab="Datos generales" visited={false}><p>Subir foto</p></PieceDetailPanel>);
    expect(html).not.toContain("Subir foto");
  });
});
