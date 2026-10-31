import { describe, expect, it } from "vitest";

import type { AcronymAlias, NormalizationImpact } from "@/lib/data/normalization-admin";
import { render, visibleText } from "@/test/render";

import { AliasesEditor, MarkersEditor, NormalizationImpactNotice, SeparatorsEditor, TenureAliasesEditor } from "./NormalizationAdmin";

// Datos sintéticos (RNF-014); «NO REGISTRA» y «REP» son ilustrativos [SUPUESTO A5, A3].

const noop = () => {};

const IMPACT: NormalizationImpact = {
  affected: 7,
  remaining: 5,
  examples: [
    { typeCode: "I", originalValue: "I-9101", normalizedValue: "I-9101", proposedValue: "I-9101", reason: "separation" },
    { typeCode: "PUCP", originalValue: "S/N", normalizedValue: null, proposedValue: "S/N", reason: "normalization" },
  ],
};

function button(html: string, label: string): string | null {
  return html.match(new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*${label}(?:(?!</button>)[\\s\\S])*</button>`))?.[0] ?? null;
}

function markers(extra: Partial<Parameters<typeof MarkersEditor>[0]> = {}): string {
  return render(
    <MarkersEditor
      saved={["", "S/N"]}
      draft={["", "S/N"]}
      isDefault
      busy={false}
      error={null}
      impact={null}
      onChange={noop}
      onSave={noop}
      onDiscard={noop}
      {...extra}
    />,
  );
}

describe("aviso de impacto (409 normalization_change_requires_preview)", () => {
  it("dice que no se guardó nada, cuántos cambiarían, los ejemplos y cuántos más", () => {
    const html = render(<NormalizationImpactNotice impact={IMPACT} onDiscard={noop} />);
    const text = visibleText(html);
    expect(html).toContain('role="alert"');
    expect(text).toContain("No se guardó nada.");
    expect(text).toContain("Este cambio alteraría 7 identificadores ya registrados.");
    expect(text).toContain("todavía no está disponible desde esta pantalla");
    expect(text).toContain("I I-9101 I-9101 I-9101 Cambia cómo se separa su celda");
    expect(text).toContain("PUCP S/N (sin código) S/N Cambia su forma normalizada");
    expect(text).toContain("… y 5 más.");
    expect(button(html, "Descartar el cambio")).not.toBeNull();
  });

  it("en singular con un solo identificador y sin «más»", () => {
    const text = visibleText(render(<NormalizationImpactNotice impact={{ affected: 1, remaining: 0, examples: [IMPACT.examples[1]] }} />));
    expect(text).toContain("alteraría 1 identificador ya registrado.");
    expect(text).not.toContain("más.");
  });
});

describe("marcadores de ausencia", () => {
  it("indica si son los del código y muestra cada marcador para quitarlo", () => {
    const html = markers();
    const text = visibleText(html);
    expect(text).toContain("Valores del código");
    expect(text).toContain("(celda vacía)");
    expect(html).toContain('aria-label="Quitar «S/N»"');
    expect(button(html, "Guardar cambios")).toContain('disabled=""');
    expect(text).not.toContain("Hay cambios sin guardar.");
  });

  it("con cambios en el borrador deja guardar o descartar", () => {
    const html = markers({ isDefault: false, draft: ["", "S/N", "NO REGISTRA"] });
    const text = visibleText(html);
    expect(text).toContain("Personalizado");
    expect(text).toContain("NO REGISTRA");
    expect(button(html, "Guardar cambios")).not.toContain('disabled=""');
    expect(button(html, "Descartar")).not.toContain('disabled=""');
    expect(text).toContain("Hay cambios sin guardar.");
  });

  it("muestra el aviso de impacto y los demás errores", () => {
    expect(visibleText(markers({ impact: IMPACT }))).toContain("No se guardó nada.");
    expect(visibleText(markers({ error: "El valor no es válido para este parámetro." }))).toContain("El valor no es válido para este parámetro.");
  });
});

describe("separadores", () => {
  it("nombra cada separador, ofrece los especiales y los marcadores que no se separan", () => {
    const value = { separators: ["/", ",", "\n"], unsplit_markers: ["S/N", "S/C"] };
    const html = render(<SeparatorsEditor saved={value} draft={value} isDefault busy={false} error={null} impact={null} onChange={noop} onSave={noop} onDiscard={noop} />);
    const text = visibleText(html);
    expect(html).toContain('aria-label="Quitar «coma ,»"');
    expect(html).toContain('aria-label="Quitar «salto de línea»"');
    expect(html).toMatch(/<option value="\r">retorno de carro<\/option>/);
    expect(text).toContain("Marcadores que no se separan");
    expect(html).toContain('aria-label="Quitar «S/C»"');
    expect(html).toMatch(/maxlength="1"/i);
  });

  it("quitar un separador deja el cambio sin guardar", () => {
    const saved = { separators: ["/", ","], unsplit_markers: ["S/N"] };
    const html = render(
      <SeparatorsEditor saved={saved} draft={{ ...saved, separators: ["/"] }} isDefault={false} busy={false} error={null} impact={IMPACT} onChange={noop} onSave={noop} onDiscard={noop} />,
    );
    expect(visibleText(html)).toContain("Hay cambios sin guardar.");
    expect(visibleText(html)).toContain("No se guardó nada.");
  });
});

describe("siglas históricas", () => {
  const ALIAS = {
    id: "a-1",
    alias: "R.E.P.",
    alias_normalized: "REP",
    collection_id: "c-1",
    collection_name: "Colección Luis Repetto (sintética)",
    collection_acronym: "LRM",
    created_at: "2026-10-24T10:00:00Z",
  } as AcronymAlias;

  it("lista cada sigla con su colección, deja eliminarla con motivo y registrar otra", () => {
    const html = render(
      <AliasesEditor
        aliases={[ALIAS]}
        collections={[{ id: "c-1", name: "Colección Luis Repetto (sintética)", acronym: "LRM" }]}
        busy={false}
        fieldError={null}
        error={null}
        impact={null}
        onCreate={noop}
        onDelete={noop}
        onDismissImpact={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("REP (R.E.P.) → Colección Luis Repetto (sintética) (LRM)");
    expect(button(html, "Eliminar")).not.toBeNull();
    expect(html).toMatch(/<option value="c-1">Colección Luis Repetto \(sintética\) \(LRM\)<\/option>/);
    expect(button(html, "Registrar sigla")).toContain('disabled=""');
  });

  it("muestra en el campo la sigla repetida y aparte el impacto", () => {
    const html = render(
      <AliasesEditor
        aliases={[]}
        collections={[]}
        busy={false}
        fieldError="La sigla «REP» ya es un alias de la colección LRM."
        error={null}
        impact={IMPACT}
        onCreate={noop}
        onDelete={noop}
        onDismissImpact={noop}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("No hay siglas históricas registradas.");
    expect(text).toContain("La sigla «REP» ya es un alias de la colección LRM.");
    expect(html).toMatch(/aria-invalid="true"/);
    expect(text).toContain("No se guardó nada.");
  });
});

describe("forma de adquisición → régimen (ajustes-lectura-importacion)", () => {
  const saved = { "cesion de uso": "Comodato", donacion: "Propiedad" };

  function tenure(extra: Partial<Parameters<typeof TenureAliasesEditor>[0]> = {}): string {
    return render(
      <TenureAliasesEditor saved={saved} draft={saved} isDefault busy={false} error={null} onChange={noop} onSave={noop} onDiscard={noop} {...extra} />,
    );
  }

  it("muestra cada forma de adquisición con su régimen y deja quitarla", () => {
    const html = tenure();
    const text = visibleText(html);
    expect(text).toContain("cesion de uso");
    expect(html).toContain('aria-label="Quitar «donacion»"');
    expect(html).toContain("Régimen de «cesion de uso»");
    expect(button(html, "Guardar cambios")).toContain('disabled=""');
  });

  it("con una correspondencia nueva deja guardar", () => {
    const html = tenure({ isDefault: false, draft: { ...saved, deposito: "Comodato" } });
    const text = visibleText(html);
    expect(text).toContain("Personalizado");
    expect(text).toContain("deposito");
    expect(button(html, "Guardar cambios")).not.toContain('disabled=""');
  });

  it("muestra el error del servidor", () => {
    expect(visibleText(tenure({ error: "«Arriendo» no es un régimen de tenencia." }))).toContain("«Arriendo» no es un régimen de tenencia.");
  });
});
