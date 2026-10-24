import { describe, expect, it } from "vitest";

import type { MappingTemplate, TemplateDryRun, TemplateSuggestion } from "@/lib/data/import-templates";
import { render, visibleText } from "@/test/render";

import { DryRunPanel, TemplatePicker } from "./ImportTemplatePanels";
import { dryRunValueStatus } from "./status-intents";

// Datos sintéticos (RNF-014); cabeceras ilustrativas de la sábana sintética [SUPUESTO A1].

const noop = () => {};

function template(overrides: Partial<MappingTemplate> = {}): MappingTemplate {
  return {
    id: "tpl-1",
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana (sintética)",
    header_signature: "a".repeat(64),
    columns: [
      { source_column: "CÓDIGOS", target_field: "identifier", identifier_type_code: null, split_compound: true, transforms: ["trim", "absence_markers", "split_concatenated"], value_map: null },
      { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: ["trim", "split:,"], value_map: null },
      { source_column: "OBS.", target_field: null, identifier_type_code: null, split_compound: false, transforms: [], value_map: null },
    ],
    defaults: {},
    description: "[SUPUESTO] Columnas ilustrativas.",
    created_at: "2026-10-22T10:00:00Z",
    ...overrides,
  };
}

const DRY_RUN: TemplateDryRun = {
  template_id: "tpl-1",
  batch_id: "batch-1",
  total_rows: 40,
  sampled_rows: 40,
  missing_columns: ["OBS."],
  columns: [
    {
      mapping: { source_column: "CÓDIGOS", target_field: "identifier", identifier_type_code: null, split_compound: true, transforms: [], value_map: null },
      in_file: true,
      counts: { NORMALIZED: 20, UNPARSEABLE: 0, ABSENT: 10, SPLIT_PROPOSED: 4 },
      empty: 6,
      unmatched_values: [],
      examples: [
        {
          source_row_number: 2,
          status: "SPLIT_PROPOSED",
          original: "I-0236 / M.M.Z. 015",
          value: ["I-0236", "M.M.Z. 015"],
          trace: [{ transform: "split_concatenated", before: "I-0236 / M.M.Z. 015", after: ["I-0236", "M.M.Z. 015"] }],
          proposals: {},
          identifiers: [
            { type_code: "I", original_value: "I-0236", normalized_value: "I-236", status: "NORMALIZED", is_absent: false },
            { type_code: "COLECCION", original_value: "M.M.Z. 015", normalized_value: "MMZ 15", status: "NORMALIZED", is_absent: false },
          ],
          matched_terms: {},
          unmatched_terms: [],
          errors: [],
        },
      ],
    },
    {
      mapping: { source_column: "PROCEDENCIA", target_field: "provenance", identifier_type_code: null, split_compound: false, transforms: [], value_map: null },
      in_file: true,
      counts: { NORMALIZED: 35, UNPARSEABLE: 0, ABSENT: 0, SPLIT_PROPOSED: 0 },
      empty: 5,
      unmatched_values: [],
      examples: [],
    },
    {
      mapping: { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: [], value_map: null },
      in_file: true,
      counts: { NORMALIZED: 10, UNPARSEABLE: 3, ABSENT: 0, SPLIT_PROPOSED: 0 },
      empty: 27,
      unmatched_values: [
        { value: "maguey", count: 3 },
        { value: "totora", count: 1 },
      ],
      examples: [
        {
          source_row_number: 6,
          status: "UNPARSEABLE",
          original: "maguey",
          value: ["maguey"],
          trace: [],
          proposals: {},
          identifiers: [],
          matched_terms: {},
          unmatched_terms: ["maguey"],
          errors: [],
        },
      ],
    },
  ],
};

describe("selector de plantillas (design D3)", () => {
  it("lista las sugeridas con su puntaje y avisos, la lista completa y «Empezar desde cero»", () => {
    const seed = template();
    const partial: TemplateSuggestion = { template: template({ id: "tpl-2", name: "Sábana 2023" }), score: 0.72, missing_columns: ["N° INV"], new_columns: ["FOTO"] };
    const html = render(
      <TemplatePicker
        suggestions={[{ template: seed, score: 1, missing_columns: [], new_columns: [] }, partial]}
        templates={[seed, partial.template, template({ id: "tpl-3", name: "Inventario 1998" })]}
        loading={false}
        error={null}
        onUse={noop}
        onStartFromScratch={noop}
      />,
    );
    const text = visibleText(html);
    expect(text.indexOf("Plantilla sábana sintética v1 · coincidencia 100 %")).toBeLessThan(text.indexOf("Sábana 2023 · coincidencia 72 %"));
    expect(text).toContain("Faltan en el archivo: N° INV");
    expect(text).toContain("Columnas nuevas (irán a los datos de origen): FOTO");
    // La lista completa solo trae las no sugeridas, y «Usar esta plantilla» espera a que se elija una.
    expect(html).toMatch(/<option value="tpl-3">Inventario 1998<\/option>/);
    expect(html).not.toMatch(/<option value="tpl-2">/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Usar esta plantilla/);
    expect(text).toContain("Empezar desde cero");
  });

  it("sin sugerencias lo dice y deja empezar desde cero", () => {
    const text = visibleText(render(<TemplatePicker suggestions={[]} templates={[]} loading={false} error={null} onUse={noop} onStartFromScratch={noop} />));
    expect(text).toContain("Ninguna plantilla coincide con estas cabeceras.");
    expect(text).not.toContain("Otra plantilla guardada");
    expect(text).toContain("Empezar desde cero");
  });

  it("mientras busca lo indica", () => {
    const text = visibleText(render(<TemplatePicker suggestions={null} templates={null} loading error={null} onUse={noop} onStartFromScratch={noop} />));
    expect(text).toContain("Buscando plantillas…");
  });
});

describe("vista previa por columna (design D4)", () => {
  it("muestra los conteos con su estado, la muestra y las columnas que el lote no trae", () => {
    const html = render(<DryRunPanel result={DRY_RUN} />);
    const text = visibleText(html);
    expect(text).toContain("Calculada sobre 40 de 40 filas (máximo 200)");
    expect(text).toContain("Columnas de la plantilla que el lote no trae: OBS.");
    expect(text).toContain("Normalizado: 20");
    expect(text).toContain("Marcador de ausencia: 10");
    expect(text).toContain("Separación propuesta: 4");
    expect(text).not.toContain("No normalizable: 0");
    expect(text).toContain("Vacías: 6");
  });

  it("es plegable por columna y abre las que tienen problemas", () => {
    const html = render(<DryRunPanel result={DRY_RUN} />);
    const details = html.match(/<details[^>]*>/g) ?? [];
    expect(details).toHaveLength(3);
    expect(details[0]).toContain("open");
    expect(details[1]).not.toContain("open");
    expect(details[2]).toContain("open");
  });

  it("lista los valores sin término con su frecuencia y los ejemplos con su traza", () => {
    const text = visibleText(render(<DryRunPanel result={DRY_RUN} />));
    expect(text).toContain("maguey (3)");
    expect(text).toContain("totora (1)");
    expect(text).toContain("Sin término: maguey");
    expect(text).toContain("Fila 2 «I-0236 / M.M.Z. 015» → «I-0236» · «M.M.Z. 015»");
    expect(text).toContain("split_concatenated: «I-0236 / M.M.Z. 015» → «I-0236» · «M.M.Z. 015»");
    expect(text).toContain("Códigos: I I-236 · COLECCION MMZ 15");
  });

  it("cada estado tiene su etiqueta e intención", () => {
    expect(dryRunValueStatus("NORMALIZED")).toEqual({ label: "Normalizado", intent: "success" });
    expect(dryRunValueStatus("UNPARSEABLE")).toEqual({ label: "No normalizable", intent: "danger" });
    expect(dryRunValueStatus("ABSENT")).toEqual({ label: "Marcador de ausencia", intent: "default" });
    expect(dryRunValueStatus("SPLIT_PROPOSED")).toEqual({ label: "Separación propuesta", intent: "warning" });
  });
});
