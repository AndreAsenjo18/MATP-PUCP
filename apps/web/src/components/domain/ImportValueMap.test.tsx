import { describe, expect, it } from "vitest";

import type { MappingTemplate, TemplateDryRun } from "@/lib/data/import-templates";
import type { ImportBatch } from "@/lib/data/imports";
import { associateTerm, draftFromTemplate, pendingTerm, targetOptions } from "@/lib/data/mapping-editor";
import { render, visibleText } from "@/test/render";

import { ColumnMappingRow, MappingEditor, TransformChain, ValueMapEditor } from "./ImportMappingEditor";
import { DryRunPanel } from "./ImportTemplatePanels";

// Spec importacion-datos — Correspondencia de valores con vocabularios controlados (4.1C).
// Datos sintéticos (RNF-014); términos del vocabulario MATERIAL sembrado [SUPUESTO T6].

const noop = () => {};
const TERMS = [
  { code: "MADERA", label: "Madera" },
  { code: "YESO", label: "Yeso" },
];
const BATCH = { id: "batch-1", status: "UPLOADED", source_name: "Sábana", sheet_names: ["SABANA"], sheet_name: "SABANA", header_row: 1, headers: ["DENOMINACIÓN", "MATERIAL"] } as ImportBatch;

function button(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*${label}(?:(?!</button>)[\\s\\S])*</button>`));
  if (!match) throw new Error(`No hay botón «${label}»`);
  return match[0];
}

function template(): MappingTemplate {
  return {
    id: "tpl-1",
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana",
    header_signature: "a".repeat(64),
    columns: [
      { source_column: "DENOMINACIÓN", target_field: "denomination", identifier_type_code: null, split_compound: false, transforms: ["trim"], value_map: null },
      { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: ["trim", "split:,"], value_map: null },
    ],
    defaults: {},
    description: null,
    created_at: "2026-10-22T10:00:00Z",
  };
}

const DRY_RUN: TemplateDryRun = {
  template_id: "tpl-1",
  batch_id: "batch-1",
  total_rows: 40,
  sampled_rows: 40,
  missing_columns: [],
  columns: [
    {
      mapping: { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: [], value_map: null },
      in_file: true,
      counts: { NORMALIZED: 10, UNPARSEABLE: 2, ABSENT: 0, SPLIT_PROPOSED: 1 },
      empty: 27,
      unmatched_values: [
        { value: "madera policromada", count: 1 },
        { value: "maguey", count: 1 },
      ],
      examples: [],
    },
  ],
};

describe("editor de correspondencias", () => {
  it("lista «texto de origen → término activo» con cambiar y quitar, y deja añadir", () => {
    const html = render(<ValueMapEditor source="MATERIAL" vocabulary="MATERIAL" map={{ "madera policromada": "MADERA" }} terms={TERMS} onChange={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Correspondencias con el vocabulario MATERIAL");
    expect(text).toContain("Texto de origen Término");
    expect(text).toContain("madera policromada");
    expect(html).toMatch(/<option value="MADERA" selected="">Madera<\/option>/);
    expect(html).toContain('aria-label="Quitar la correspondencia de «madera policromada»"');
    expect(button(html, "Añadir correspondencia")).toContain('disabled=""');
    expect(text).toContain("nunca se crean términos");
  });

  it("un código que no está entre los activos se ve señalado", () => {
    const html = render(<ValueMapEditor source="MATERIAL" vocabulary="MATERIAL" map={{ yeso: "BARRO" }} terms={TERMS} onChange={noop} />);
    expect(html).toMatch(/<option value="BARRO" selected="">BARRO \(no es un término activo\)<\/option>/);
  });

  it("avisa si el vocabulario no tiene términos activos", () => {
    const text = visibleText(render(<ValueMapEditor source="MATERIAL" vocabulary="MATERIAL" map={{}} terms={[]} onChange={noop} />));
    expect(text).toContain("No hay términos activos en el vocabulario MATERIAL para asociar.");
  });

  it("solo aparece en las columnas de términos", () => {
    const draft = draftFromTemplate(template(), BATCH);
    const options = targetOptions([{ code: "MATERIAL", name: "Materiales" }]);
    const terms = render(<ColumnMappingRow column={draft.columns[1]} options={options} error={null} terms={TERMS} onTarget={noop} onTransforms={noop} onValueMap={noop} />);
    expect(visibleText(terms)).toContain("Correspondencias con el vocabulario MATERIAL");
    const field = render(<ColumnMappingRow column={draft.columns[0]} options={options} error={null} onTarget={noop} onTransforms={noop} onValueMap={noop} />);
    expect(visibleText(field)).not.toContain("Correspondencias");
  });

  it("value_map no se quita a mano mientras haya correspondencias", () => {
    const html = render(<TransformChain source="MATERIAL" chain={["trim", "value_map"]} locked={["value_map"]} onChange={noop} />);
    expect(visibleText(html)).toContain("2. Correspondencias de valores value_map");
    expect(html).toMatch(/<button[^>]*aria-label="Quitar «Correspondencias de valores»"[^>]*disabled=""/);
    expect(html).toContain("Se quita al dejar vacía la tabla de correspondencias.");
    expect(html).not.toMatch(/<button[^>]*aria-label="Quitar «Quitar espacios»"[^>]*disabled=""/);
  });

  it("el editor pasa los términos del vocabulario y muestra en la columna el 422 de término inactivo", () => {
    const draft = draftFromTemplate(template(), BATCH);
    const html = render(
      <MappingEditor
        batch={BATCH}
        draft={draft}
        vocabularies={[{ code: "MATERIAL", name: "Materiales" }]}
        terms={{ MATERIAL: TERMS }}
        errors={{ MATERIAL: "«yeso» se asocia al término «Yeso» (YESO), que está desactivado." }}
        nameError={null}
        busy={false}
        saving={false}
        previewBusy={false}
        onChange={noop}
        onSave={noop}
        onPreview={noop}
        onApply={noop}
        onBack={noop}
      />,
    );
    const text = visibleText(html);
    expect(text.indexOf("que está desactivado")).toBeGreaterThan(text.indexOf("MATERIAL"));
    expect(text.indexOf("que está desactivado")).toBeLessThan(text.indexOf("Correspondencias con el vocabulario MATERIAL"));
    expect(html).toMatch(/<option value="YESO">Yeso<\/option>/);
  });
});

describe("«Asociar a término» en la vista previa", () => {
  const association = (draft = draftFromTemplate(template(), BATCH)) => ({
    terms: { MATERIAL: TERMS },
    pending: (source: string, text: string) => pendingTerm(draft, source, text),
    onAssociate: noop,
  });

  it("ofrece elegir un término por cada valor sin término", () => {
    const html = render(<DryRunPanel result={DRY_RUN} association={association()} />);
    expect(html).toContain("Término para «madera policromada»");
    expect(html).toContain("Término para «maguey»");
    expect(button(html, "Asociar a término")).toContain('disabled=""');
  });

  it("un valor ya asociado en el borrador se ve pendiente de guardar, y la vista previa avisa que quedó desactualizada", () => {
    const draft = associateTerm(draftFromTemplate(template(), BATCH), "MATERIAL", "madera policromada", "MADERA");
    const html = render(<DryRunPanel result={DRY_RUN} stale association={association(draft)} />);
    const text = visibleText(html);
    expect(text).toContain("madera policromada (1) → Madera, pendiente de guardar");
    expect(html).not.toContain("Término para «madera policromada»");
    expect(html).toContain("Término para «maguey»");
    expect(text).toContain("guarde la plantilla y vuelva a pedir la vista previa");
  });

  it("sin asociación (o sin desactualizar) se ve como antes", () => {
    const text = visibleText(render(<DryRunPanel result={DRY_RUN} />));
    expect(text).toContain("madera policromada (1)");
    expect(text).not.toContain("Asociar a término");
    expect(text).not.toContain("vuelva a pedir la vista previa");
  });
});
