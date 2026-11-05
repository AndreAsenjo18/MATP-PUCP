import { describe, expect, it } from "vitest";

import type { MappingTemplate, TemplateDryRun, TemplateSuggestion } from "@/lib/data/import-templates";
import { render, visibleText } from "@/test/render";

import { DryRunPanel, FormatProblemPanel } from "./ImportTemplatePanels";
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

describe("panel de formato (cuando no se aplicó solo)", () => {
  const props = { loading: false, busy: false, error: null, onUse: noop, onAdjust: noop };

  it("sin reconocer el archivo ofrece los formatos por parecido y «Ajustar columnas»", () => {
    const seed = template();
    const partial: TemplateSuggestion = { template: template({ id: "tpl-2", name: "Sábana 2023" }), score: 0.72, missing_columns: ["N° INV"], new_columns: [] };
    const html = render(
      <FormatProblemPanel {...props} issue={{ kind: "unrecognized" }} suggestions={[partial]} templates={[seed, partial.template]} />,
    );
    const text = visibleText(html);
    expect(text).toContain("No reconocemos el formato de este archivo");
    expect(text.indexOf("Sábana 2023 · se parece 72 %")).toBeLessThan(text.indexOf("Plantilla sábana sintética v1"));
    expect(text).toContain("Usar este formato");
    expect(text).toContain("Ajustar columnas");
  });

  it("un formato que no encaja nombra las columnas que faltan y no se ofrece a sí mismo", () => {
    const seed = template();
    const other = template({ id: "tpl-9", name: "Inventario 1998" });
    const text = visibleText(
      render(<FormatProblemPanel {...props} issue={{ kind: "missing", template: seed, missing: ["N° INV", "FOTO"] }} suggestions={[]} templates={[seed, other]} />),
    );
    expect(text).toContain("Este formato no encaja con el archivo");
    expect(text).toContain("N° INV, FOTO");
    expect(text).toContain("Inventario 1998");
    expect(text).not.toContain("Plantilla sábana sintética v1 ·");
    expect(text.match(/Usar este formato/g)).toHaveLength(1);
  });

  it("sin otros formatos lo dice y deja «Ajustar columnas» como acción principal", () => {
    const html = render(<FormatProblemPanel {...props} issue={{ kind: "unrecognized" }} suggestions={[]} templates={[]} />);
    expect(visibleText(html)).toContain("No hay otros formatos guardados.");
    expect(html).toMatch(/bg-terracota[^"]*"[^>]*>(?:(?!<\/button>)[\s\S])*Ajustar columnas/);
  });

  it("al cambiar de formato explica que se vuelve a leer y validar, sin ofrecer el actual", () => {
    const seed = template();
    const text = visibleText(
      render(<FormatProblemPanel {...props} issue={{ kind: "change", current: seed }} suggestions={[]} templates={[seed, template({ id: "tpl-3", name: "Inventario 1998" })]} />),
    );
    expect(text).toContain("Cambiar el formato");
    expect(text).toContain("se validará otra vez");
    expect(text).not.toContain("Plantilla sábana sintética v1");
    expect(text).toContain("Inventario 1998");
  });

  it("al cambiar de formato avisa cuántas decisiones se pierden, solo si hay", () => {
    const seed = template();
    const change = { kind: "change", current: seed } as const;
    expect(visibleText(render(<FormatProblemPanel {...props} issue={change} decided={12} suggestions={[]} templates={[seed]} />))).toContain("Las 12 decisiones que ya tomó se pierden");
    expect(visibleText(render(<FormatProblemPanel {...props} issue={change} decided={0} suggestions={[]} templates={[seed]} />))).not.toContain("se pierden");
  });

  it("al cambiar de formato deja volver a la revisión; en los demás casos no", () => {
    const seed = template();
    const withCancel = visibleText(render(<FormatProblemPanel {...props} issue={{ kind: "change", current: seed }} suggestions={[]} templates={[seed]} onCancel={noop} />));
    expect(withCancel).toContain("Volver a la revisión");
    expect(visibleText(render(<FormatProblemPanel {...props} issue={{ kind: "unrecognized" }} suggestions={[]} templates={[seed]} onCancel={noop} />))).not.toContain("Volver a la revisión");
  });

  it("mientras busca lo indica", () => {
    const text = visibleText(render(<FormatProblemPanel {...props} loading issue={{ kind: "unrecognized" }} suggestions={null} templates={null} />));
    expect(text).toContain("Buscando formatos…");
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
