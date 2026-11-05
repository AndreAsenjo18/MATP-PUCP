import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteTemplate, renameTemplate, templateMetaBody, templateMetaError, type MappingTemplate } from "@/lib/data/import-templates";
import type { ImportBatch } from "@/lib/data/imports";
import { draftFromTemplate } from "@/lib/data/mapping-editor";
import { render, visibleText } from "@/test/render";

import { ADMIN_TEMPLATES_HREF, MappingEditor } from "./ImportMappingEditor";
import { TemplateAdminList, filterTemplates, groupTemplatesBySource } from "./MappingTemplatesAdmin";

// Datos sintéticos (RNF-014); cabeceras ilustrativas de la sábana sintética [SUPUESTO A1].

const noop = () => {};
const BASE_URL = "http://api.test";
const DEV_USER = "curadora@matp.local";
const TEMPLATE_ID = "01920000-0000-7000-8000-000000000621";

function template(overrides: Partial<MappingTemplate> = {}): MappingTemplate {
  return {
    id: TEMPLATE_ID,
    name: "Plantilla sábana sintética v1",
    source_name: "Sábana consultoría (sintética)",
    header_signature: "a".repeat(64),
    columns: [
      { source_column: "CÓDIGOS", target_field: "identifier", identifier_type_code: null, split_compound: true, transforms: ["trim", "absence_markers"], value_map: null },
      { source_column: "OBS.", target_field: null, identifier_type_code: null, split_compound: false, transforms: [], value_map: null },
    ],
    defaults: {},
    description: "[SUPUESTO] Columnas ilustrativas.",
    created_at: "2026-10-22T10:00:00Z",
    ...overrides,
  };
}

function button(html: string, label: string): string | null {
  return html.match(new RegExp(`<button[^>]*>(?:(?!</button>)[\\s\\S])*${label}(?:(?!</button>)[\\s\\S])*</button>`))?.[0] ?? null;
}

function list(extra: Partial<Parameters<typeof TemplateAdminList>[0]> = {}): string {
  return render(
    <TemplateAdminList templates={[template()]} canEdit canDelete busyId={null} errors={{}} onRename={noop} onDelete={noop} {...extra} />,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("lista de plantillas", () => {
  it("muestra nombre, fuente, columnas plegadas con destino y transformaciones", () => {
    const html = list();
    const text = visibleText(html);
    expect(text).toContain("Plantilla sábana sintética v1");
    expect(text).toContain("Sábana consultoría (sintética) · 2 columnas · creada el 22/10/2026");
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Columnas \(2\)<\/summary>/);
    expect(text).toContain("Códigos (se reconoce el tipo de cada uno)");
    expect(text).toContain("trim → absence_markers");
    expect(text).toContain("Dato de origen (se conserva sin mapear)");
  });

  it("con imports.approve ofrece eliminar con motivo; sin él lo explica", () => {
    expect(button(list(), "Eliminar")).not.toBeNull();
    const html = list({ canDelete: false });
    expect(button(html, "Eliminar")).toBeNull();
    expect(visibleText(html)).toContain("Eliminar un formato corresponde al Gestor de colecciones o al Administrador.");
  });

  it("sin imports.prepare no ofrece editar, y muestra el error de la plantilla", () => {
    expect(button(list(), "Editar")).not.toBeNull();
    expect(button(list({ canEdit: false }), "Editar")).toBeNull();
    const text = visibleText(list({ errors: { [TEMPLATE_ID]: "Ya existe una plantilla activa llamada «X»." } }));
    expect(text).toContain("Ya existe una plantilla activa llamada «X».");
  });

  it("sin plantillas explica dónde se crean", () => {
    expect(visibleText(list({ templates: [] }))).toContain("Los formatos nuevos se crean desde el asistente de importación.");
  });
});

describe("formatos por fuente", () => {
  const libro = template({ id: "l1", name: "Libro de inventario general", source_name: "Libro de inventario (sintético)" });
  const sabanaB = template({ id: "s2", name: "Sábana 2025", source_name: "Sábana consultoría (sintética)" });
  const sabanaA = template({ id: "s1", name: "Plantilla sábana sintética v1", source_name: "Sábana consultoría (sintética)" });

  it("agrupa por fuente en orden alfabético y ordena los formatos de cada fuente por nombre", () => {
    const groups = groupTemplatesBySource([sabanaB, libro, sabanaA]);
    expect(groups.map((group) => group.source)).toEqual(["Libro de inventario (sintético)", "Sábana consultoría (sintética)"]);
    expect(groups[1].templates.map((item) => item.name)).toEqual(["Plantilla sábana sintética v1", "Sábana 2025"]);
  });

  it("la lista muestra cada fuente como encabezado con su número de formatos", () => {
    const text = visibleText(list({ templates: [libro, sabanaA, sabanaB] }));
    expect(text).toContain("Libro de inventario (sintético) · 1 formato");
    expect(text).toContain("Sábana consultoría (sintética) · 2 formatos");
  });

  it("busca por nombre o por fuente sin distinguir mayúsculas ni tildes", () => {
    const all = [libro, sabanaA, sabanaB];
    expect(filterTemplates(all, "libro").map((item) => item.id)).toEqual(["l1"]);
    expect(filterTemplates(all, "SABANA").map((item) => item.id)).toEqual(["s1", "s2"]);
    expect(filterTemplates(all, "2025").map((item) => item.id)).toEqual(["s2"]);
    expect(filterTemplates(all, "")).toHaveLength(3);
    expect(filterTemplates(all, "word")).toEqual([]);
  });

  it("los botones de la lista son compactos", () => {
    const html = list();
    expect(html).toContain("min-h-8");
    expect(visibleText(html)).not.toMatch(/\b(RF|RN)-0/);
  });
});

describe("enlace desde el editor de mapeo", () => {
  it("abre la pestaña de plantillas aparte, sin perder el borrador", () => {
    const batch = { id: "b-1", status: "UPLOADED", source_name: "Sábana", sheet_names: ["SABANA"], sheet_name: "SABANA", header_row: 1, headers: ["CÓDIGOS", "OBS."] } as ImportBatch;
    const html = render(
      <MappingEditor
        batch={batch}
        draft={draftFromTemplate(template(), batch)}
        vocabularies={[]}
        errors={{}}
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
    expect(ADMIN_TEMPLATES_HREF).toBe("/administracion?pestana=plantillas");
    const link = html.match(/<a [^>]*>(?:(?!<\/a>)[\s\S])*Administrar formatos/)?.[0] ?? "";
    expect(link).toContain('href="/administracion?pestana=plantillas"');
    expect(link).toContain('target="_blank"');
  });
});

describe("capa de datos de la edición", () => {
  it("exige nombre y fuente y envía solo nombre, fuente y descripción", () => {
    expect(templateMetaError({ name: " ", sourceName: "S", description: "" })).toBe("Indique el nombre de la plantilla.");
    expect(templateMetaError({ name: "N", sourceName: "", description: "" })).toBe("Indique la fuente del archivo.");
    expect(templateMetaBody({ name: " Sábana 2025 ", sourceName: " Sábana ", description: " " })).toEqual({ name: "Sábana 2025", source_name: "Sábana", description: null });
  });

  it("modo live: PATCH sin columnas y DELETE con motivo", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", BASE_URL);
    const fetchMock = vi.fn(async (request: Request) =>
      request.method === "DELETE"
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(template({ name: "Sábana 2025" })), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await renameTemplate(TEMPLATE_ID, { name: "Sábana 2025", sourceName: "Sábana", description: "" }, DEV_USER)).toMatchObject({ status: "ok", value: { name: "Sábana 2025" } });
    expect(await deleteTemplate(TEMPLATE_ID, " Duplicada ", DEV_USER)).toEqual({ status: "ok", value: null });

    const [patch, del] = fetchMock.mock.calls.map((call) => call[0] as Request);
    expect(patch.method).toBe("PATCH");
    expect(await patch.json()).toEqual({ name: "Sábana 2025", source_name: "Sábana", description: null });
    expect(del.url).toBe(`${BASE_URL}/api/v1/import-templates/${TEMPLATE_ID}?reason=Duplicada`);
    expect(del.headers.get("X-MATP-User")).toBe(DEV_USER);
  });

  it("modo mock: no elimina", async () => {
    expect((await deleteTemplate(TEMPLATE_ID, "Duplicada")).status).toBe("unavailable");
  });
});
