import { describe, expect, it } from "vitest";

import type { MappingTemplate } from "@/lib/data/import-templates";
import type { ImportBatch } from "@/lib/data/imports";
import { draftFromScratch, draftFromTemplate, setColumnTarget, targetOptions, type EditorDraft } from "@/lib/data/mapping-editor";
import { render, visibleText } from "@/test/render";

import { ColumnMappingRow, MappingEditor, SaveTemplateForm, TransformChain } from "./ImportMappingEditor";
import { mappingDraftStatus } from "./status-intents";

// Datos sintéticos (RNF-014); cabeceras ilustrativas de la sábana sintética [SUPUESTO A1].

const noop = () => {};
const VOCABULARIES = [{ code: "MATERIAL", name: "Materiales" }];

function button(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*${label}(?:(?!</button>)[\\s\\S])*</button>`));
  if (!match) throw new Error(`No hay botón «${label}»`);
  return match[0];
}

function template(): MappingTemplate {
  return {
    id: "tpl-1",
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana (sintética)",
    header_signature: "a".repeat(64),
    columns: [
      { source_column: "DENOMINACIÓN", target_field: "denomination", identifier_type_code: null, split_compound: false, transforms: ["trim"], value_map: null },
      { source_column: "MATERIAL", target_field: "terms:MATERIAL", identifier_type_code: null, split_compound: false, transforms: ["trim", "split:,"], value_map: null },
      { source_column: "N° INV", target_field: "identifier", identifier_type_code: "I", split_compound: false, transforms: [], value_map: null },
    ],
    defaults: {},
    description: null,
    created_at: "2026-10-22T10:00:00Z",
  };
}

const BATCH = {
  id: "batch-1",
  status: "UPLOADED",
  source_name: "Sábana (sintética)",
  sheet_names: ["SABANA"],
  sheet_name: "SABANA",
  header_row: 1,
  headers: ["DENOMINACIÓN", "MATERIAL", "OBS."],
} as ImportBatch;

function editor(draft: EditorDraft, extra: { errors?: Record<string, string>; nameError?: string | null } = {}): string {
  return render(
    <MappingEditor
      batch={BATCH}
      draft={draft}
      vocabularies={VOCABULARIES}
      errors={extra.errors ?? {}}
      nameError={extra.nameError ?? null}
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
}

const UNCHANGED = draftFromTemplate({ ...template(), columns: template().columns.slice(0, 2) }, BATCH);

describe("editor de mapeo: estado del borrador", () => {
  it("sin cambios: lo indica, no ofrece guardar y permite la vista previa", () => {
    const html = editor(UNCHANGED);
    const text = visibleText(html);
    expect(text).toContain("Mapeo con la plantilla «Plantilla sábana sintética v1»");
    expect(text).toContain("Plantilla sin cambios");
    expect(text).not.toContain("Guardar como plantilla");
    expect(button(html, "Ver vista previa")).not.toContain('disabled=""');
    expect(text).not.toContain("no queda guardado como plantilla");
  });

  it("el régimen es del lote: elegir otro no modifica la plantilla y la ayuda lo dice", () => {
    const withDefaults = draftFromTemplate({ ...template(), columns: template().columns.slice(0, 2), defaults: { tenure_regime: "Propiedad" } }, BATCH);
    const html = editor({ ...withDefaults, tenureDefault: "Comodato" });
    const text = visibleText(html);
    expect(html).toMatch(/<option value="Comodato" selected="">Comodato<\/option>/);
    expect(text).toContain("Plantilla sin cambios");
    expect(text).toContain("Solo para este lote; no cambia la plantilla, que trae: régimen Propiedad.");
    expect(text).not.toContain("Guardar como plantilla");
    expect(button(html, "Ver vista previa")).not.toContain('disabled=""');
    expect(visibleText(editor(UNCHANGED))).toContain("Solo para este lote; no cambia la plantilla.");
  });

  it("modificada: «Guardar como nueva» es la principal, «Guardar cambios» la alternativa, y la vista previa espera", () => {
    const html = editor(setColumnTarget(UNCHANGED, 0, "description"));
    const text = visibleText(html);
    expect(text).toContain("Plantilla modificada");
    expect(button(html, "Guardar como nueva")).toContain("bg-terracota");
    expect(button(html, "Guardar cambios en «Plantilla sábana sintética v1»")).toContain("border-terracota");
    expect(button(html, "Ver vista previa")).toContain('disabled=""');
    expect(text).toContain("Guarde la plantilla para ver la vista previa");
    expect(text).toContain("Este mapeo se usará solo en este lote: no queda guardado como plantilla.");
    expect(button(html, "Usar este mapeo y validar")).not.toContain('disabled=""');
  });

  it("mapeo nuevo: solo «Guardar como plantilla»", () => {
    const text = visibleText(editor(draftFromScratch(BATCH)));
    expect(text).toContain("Mapeo de columnas");
    expect(text).toContain("Mapeo nuevo sin guardar");
    expect(text).toContain("Guardar como plantilla");
    expect(text).not.toContain("Guardar cambios en");
  });

  it("avisa de las columnas de la plantilla que el archivo no trae", () => {
    const text = visibleText(editor(draftFromTemplate(template(), BATCH)));
    expect(text).toContain("Se quitaron del mapeo las columnas de la plantilla que este archivo no trae: N° INV.");
    expect(text).toContain("Plantilla modificada");
  });

  it("muestra cada error del mapeo en su columna, los generales abajo y el nombre repetido en su campo", () => {
    const html = editor(setColumnTarget(UNCHANGED, 0, "description"), {
      errors: { MATERIAL: "El vocabulario «MATERIAL» no existe.", "": "Debe indicar la columna de la denominación." },
      nameError: "Ya existe una plantilla activa llamada «Sábana 2025».",
    });
    const text = visibleText(html);
    expect(text.indexOf("El vocabulario «MATERIAL» no existe.")).toBeGreaterThan(text.indexOf("MATERIAL"));
    expect(text.indexOf("El vocabulario «MATERIAL» no existe.")).toBeLessThan(text.indexOf("OBS."));
    expect(text).toContain("Debe indicar la columna de la denominación.");
    expect(text).toContain("Ya existe una plantilla activa llamada «Sábana 2025».");
    expect(html).toMatch(/aria-invalid="true"/);
  });

  it("cada estado tiene su etiqueta e intención", () => {
    expect(mappingDraftStatus("unchanged")).toEqual({ label: "Plantilla sin cambios", intent: "success" });
    expect(mappingDraftStatus("modified")).toEqual({ label: "Plantilla modificada", intent: "warning" });
    expect(mappingDraftStatus("new")).toEqual({ label: "Mapeo nuevo sin guardar", intent: "info" });
  });
});

describe("hoja, fila de cabeceras y destino (antes en MappingPanel)", () => {
  it("permite elegir hoja, fila de cabeceras y el destino de cada columna", () => {
    const batch = { ...BATCH, sheet_names: ["Resumen", "Inventario"], sheet_name: "Resumen", headers: ["DENOMINACIÓN"] } as ImportBatch;
    const html = render(
      <MappingEditor
        batch={batch}
        draft={draftFromScratch(batch)}
        vocabularies={VOCABULARIES}
        errors={{ "": "Debe indicar la columna de la denominación." }}
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
    expect(text).toContain("Inventario");
    expect(text).toContain("Fila de cabeceras");
    expect(html).toMatch(/<option value="denomination" selected="">Denominación<\/option>/);
    expect(text).toContain("Debe indicar la columna de la denominación.");
  });
});

describe("fila de columna", () => {
  it("elige el destino con un Select que incluye los vocabularios", () => {
    const html = render(<ColumnMappingRow column={UNCHANGED.columns[1]} options={targetOptions(VOCABULARIES)} error={null} onTarget={noop} onTransforms={noop} />);
    expect(html).toMatch(/<option value="terms:MATERIAL" selected="">Términos: Materiales<\/option>/);
    expect(html).toContain("Destino de MATERIAL");
    expect(html).not.toContain('draggable="true"');
  });
});

describe("cadena de transformaciones", () => {
  it("nombra cada paso en español con el código como texto secundario, y sube, baja y quita con etiqueta", () => {
    const html = render(<TransformChain source="MATERIAL" chain={["trim", "split:,"]} onChange={noop} />);
    const text = visibleText(html);
    expect(text).toContain("1. Quitar espacios trim");
    expect(text).toContain("2. Separar por un carácter («,») split:,");
    expect(html).toContain('<code class="font-mono text-xs text-gris-texto">split:,</code>');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Subir «Quitar espacios»"|<button[^>]*aria-label="Subir «Quitar espacios»"[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Bajar «Separar por un carácter \(«,»\)»"|<button[^>]*aria-label="Bajar «Separar por un carácter \(«,»\)»"[^>]*disabled=""/);
    expect(html).toContain('aria-label="Quitar «Separar por un carácter («,»)»"');
  });

  it("ofrece las transformaciones con su código y no deja añadir sin elegir", () => {
    const html = render(<TransformChain source="ÉPOCA" chain={[]} onChange={noop} />);
    expect(visibleText(html)).toContain("Sin transformaciones: el valor se toma tal cual.");
    expect(html).toContain("Proponer época (propose_period)");
    expect(html).toContain("Separar por un carácter (split:…)");
    expect(html).not.toContain("(value_map)");
    expect(button(html, "Añadir")).toContain('disabled=""');
  });
});

describe("guardar como plantilla", () => {
  it("en línea, con nombre y fuente; sin nombre no deja guardar como nueva", () => {
    const html = render(<SaveTemplateForm status="modified" baseName="Plantilla sábana sintética v1" defaultSourceName="Sábana (sintética)" nameError={null} busy={false} onSave={noop} />);
    const text = visibleText(html);
    expect(html).not.toContain("<dialog");
    expect(text).toContain("Nombre de la plantilla nueva");
    expect(html).toContain('value="Sábana (sintética)"');
    expect(button(html, "Guardar como nueva")).toContain('disabled=""');
    expect(button(html, "Guardar cambios en «Plantilla sábana sintética v1»")).not.toContain('disabled=""');
    expect(text).toContain("Indique un nombre para la plantilla.");
    expect(text).toContain("los lotes ya procesados conservan el mapeo");
  });
});
