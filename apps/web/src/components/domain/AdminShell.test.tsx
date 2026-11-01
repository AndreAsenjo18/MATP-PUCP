import { describe, expect, it } from "vitest";

import { render, visibleText } from "@/test/render";

import { ADMIN_SECTIONS, AdminNav, AdminToolbar, FormDialog, Notice, SectionHeader, initialSection, sectionFromSlug, visibleAreas, visibleSections } from "./AdminShell";

// Spec plataforma — Administración agrupada por funciones; Barra superior con filtros y alta en diálogo.

const noop = () => {};
const allowing = (...permissions: string[]) => (permission: string) => permissions.includes(permission);

describe("secciones visibles por permiso", () => {
  it("un rol que administra ubicaciones y plantillas ve Catálogo e Importación, no Personas", () => {
    const sections = visibleSections(allowing("locations.manage", "imports.prepare"));
    expect(sections.map((section) => section.slug)).toEqual(["ubicaciones", "plantillas"]);
    expect(visibleAreas(sections).map((area) => area.id)).toEqual(["catalogo", "importacion"]);
  });

  it("el Administrador ve las cuatro áreas con todas sus secciones", () => {
    const all = visibleSections(() => true);
    expect(all).toHaveLength(ADMIN_SECTIONS.length);
    expect(visibleAreas(all).map((area) => area.label)).toEqual(["Personas", "Catálogo", "Importación", "Control"]);
  });

  it("un rol sin permisos de administración no ve ningún área", () => {
    expect(visibleSections(() => false)).toEqual([]);
    expect(visibleAreas([])).toEqual([]);
  });

  it("las listas de valores, los tipos y la lectura de códigos van con el permiso de vocabularios", () => {
    const sections = visibleSections(allowing("vocabularies.manage"));
    expect(sections.map((section) => section.slug)).toEqual(["colecciones", "vocabularios", "tipos", "normalizacion"]);
  });
});

describe("direcciones ?pestana=", () => {
  it("las direcciones antiguas abren su sección", () => {
    for (const [slug, label] of [
      ["colecciones", "Colecciones"],
      ["vocabularios", "Listas de valores"],
      ["tipos", "Tipos de código"],
      ["plantillas", "Formatos de archivo"],
      ["normalizacion", "Lectura de códigos"],
      ["exportacion", "Exportación completa"],
    ]) {
      expect(sectionFromSlug(slug)?.label).toBe(label);
    }
    expect(sectionFromSlug("nada")).toBeUndefined();
    expect(sectionFromSlug(null)).toBeUndefined();
  });

  it("si la persona no puede ver la sección pedida, se abre la primera que sí puede", () => {
    const sections = visibleSections(allowing("locations.manage", "imports.prepare"));
    expect(initialSection("plantillas", sections)?.slug).toBe("plantillas");
    expect(initialSection("usuarios", sections)?.slug).toBe("ubicaciones");
    expect(initialSection(null, sections)?.slug).toBe("ubicaciones");
    expect(initialSection("usuarios", [])).toBeUndefined();
  });
});

describe("AdminNav", () => {
  it("muestra las áreas, marca la actual y lista solo las secciones de esa área", () => {
    const html = render(<AdminNav sections={visibleSections(() => true)} current="vocabularios" onSelect={noop} />);
    const text = visibleText(html);
    for (const area of ["Personas", "Catálogo", "Importación", "Control"]) expect(text).toContain(area);
    expect(html).toContain('aria-label="Secciones de Catálogo"');
    for (const section of ["Colecciones", "Ubicaciones", "Listas de valores", "Tipos de código"]) expect(text).toContain(section);
    expect(text).not.toContain("Papelera");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-selected="true"[^>]*>(?:(?!<\/button>)[\s\S])*Listas de valores/);
    expect(html).toMatch(/aria-selected="true"[^>]*class="[^"]*bg-terracota[^"]*"[^>]*>(?:(?!<\/button>)[\s\S])*Catálogo/);
  });

  it("oculta las áreas sin secciones permitidas", () => {
    const text = visibleText(render(<AdminNav sections={visibleSections(allowing("trash.read", "audit.read"))} current="papelera" onSelect={noop} />));
    expect(text).toContain("Control");
    expect(text).not.toContain("Personas");
    expect(text).not.toContain("Catálogo");
  });

  it("no pinta nada si no hay secciones", () => {
    expect(render(<AdminNav sections={[]} current="" onSelect={noop} />)).toBe("");
  });
});

describe("barra, encabezado, avisos y diálogo", () => {
  it("la barra pone los filtros a la izquierda y la acción a la derecha", () => {
    const html = render(
      <AdminToolbar label="Filtros de colecciones" action={<button type="button">Nueva colección</button>}>
        <input aria-label="Buscar" />
      </AdminToolbar>,
    );
    expect(html).toContain('role="search"');
    expect(html.indexOf("Buscar")).toBeLessThan(html.indexOf("Nueva colección"));
    expect(html).toContain("justify-between");
  });

  it("sin acción la barra solo muestra los filtros", () => {
    const html = render(<AdminToolbar label="x">{<input aria-label="Buscar" />}</AdminToolbar>);
    expect(visibleText(html)).not.toContain("Nueva");
  });

  it("el encabezado lleva el título y su explicación", () => {
    const text = visibleText(render(<SectionHeader title="Listas de valores" description="Opciones que se eligen al llenar una ficha." />));
    expect(text).toBe("Listas de valores Opciones que se eligen al llenar una ficha.");
  });

  it("los avisos distinguen el resultado del error", () => {
    const html = render(<Notice message="Creada." error="No se pudo." />);
    expect(html).toContain('role="status"');
    expect(html).toContain('role="alert"');
    expect(render(<Notice message={null} error={null} />)).toBe("");
  });

  it("el diálogo trae su título, el formulario, el error y los botones", () => {
    const html = render(
      <FormDialog open={false} title="Nueva colección" description="Principal o subcolección." submitLabel="Crear colección" error="La sigla ya existe." onClose={noop} onSubmit={async () => true}>
        <input aria-label="Nombre" />
      </FormDialog>,
    );
    const text = visibleText(html);
    expect(text).toContain("Nueva colección");
    expect(text).toContain("Principal o subcolección.");
    expect(text).toContain("Crear colección");
    expect(text).toContain("Cancelar");
    expect(text).toContain("La sigla ya existe.");
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-label="Cerrar"');
  });
});
