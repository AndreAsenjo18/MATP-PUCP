import { describe, expect, it } from "vitest";

import type { MappingTemplate } from "@/lib/data/import-templates";
import { formatFileSize, isSpreadsheetFile } from "@/lib/data/imports";
import { render, visibleText } from "@/test/render";

import { AUTO_FORMAT, DropZone, FormatPicker, UploadPanel } from "./ImportUpload";

// Spec importacion-datos — Subida guiada con formato elegido de antemano. Datos sintéticos (RNF-014).

const noop = () => {};

function template(id: string, name: string, description: string | null = "Columnas de la sábana sintética."): MappingTemplate {
  return {
    id,
    name,
    source_name: "Sábana (sintética)",
    header_signature: "a".repeat(64),
    columns: [],
    defaults: {},
    description,
    created_at: "2026-10-22T10:00:00Z",
  };
}

describe("tipos de archivo admitidos", () => {
  it("acepta .xlsx y .csv sin importar mayúsculas y rechaza el resto", () => {
    expect(isSpreadsheetFile("lote_demo_sabana.xlsx")).toBe(true);
    expect(isSpreadsheetFile("Inventario.CSV")).toBe(true);
    expect(isSpreadsheetFile("informe.docx")).toBe(false);
    expect(isSpreadsheetFile("foto.xlsx.pdf")).toBe(false);
    expect(isSpreadsheetFile("")).toBe(false);
  });

  it("escribe el tamaño en unidades legibles", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(84 * 1024)).toBe("84 KB");
    expect(formatFileSize(Math.round(2.5 * 1024 * 1024))).toMatch(/^2[.,]5 MB$/);
  });
});

describe("zona de subida", () => {
  it("en reposo invita a arrastrar o elegir, y solo anuncia Excel o CSV", () => {
    const html = render(<DropZone file={null} error={null} onFile={noop} onReject={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Arrastre aquí su archivo");
    expect(text).toContain("Excel (.xlsx) o CSV");
    expect(html).toContain('accept=".xlsx,.csv"');
    expect(html).toContain('type="file"');
  });

  it("con un archivo elegido muestra su nombre y su tamaño", () => {
    const file = new File([new Uint8Array(84 * 1024)], "lote_demo_sabana.xlsx");
    const text = visibleText(render(<DropZone file={file} error={null} onFile={noop} onReject={noop} />));
    expect(text).toContain("lote_demo_sabana.xlsx");
    expect(text).toContain("84 KB");
  });

  it("muestra el aviso de un archivo no admitido como alerta", () => {
    const html = render(<DropZone file={null} error="Solo se admiten archivos Excel (.xlsx) o CSV." onFile={noop} onReject={noop} />);
    expect(html).toContain('role="alert"');
    expect(visibleText(html)).toContain("Solo se admiten archivos Excel (.xlsx) o CSV.");
  });
});

describe("elección de formato", () => {
  it("«Detectar automáticamente» viene elegido y cada formato guardado trae su descripción", () => {
    const html = render(
      <FormatPicker templates={[template("tpl-1", "Sábana de la consultoría"), template("tpl-2", "Inventario 1998", null)]} loading={false} value={AUTO_FORMAT} onChange={noop} />,
    );
    const text = visibleText(html);
    expect(text).toContain("Detectar automáticamente");
    expect(text).toContain("Sábana de la consultoría");
    expect(text).toContain("Columnas de la sábana sintética.");
    // Sin descripción se usa la fuente del archivo.
    expect(text).toContain("Sábana (sintética)");
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toMatch(/value="auto"[^>]*checked=""|checked=""[^>]*value="auto"/);
  });

  it("con un formato elegido solo ese queda marcado", () => {
    const html = render(<FormatPicker templates={[template("tpl-1", "Sábana de la consultoría")]} loading={false} value="tpl-1" onChange={noop} />);
    expect(html).toMatch(/value="tpl-1"[^>]*checked=""|checked=""[^>]*value="tpl-1"/);
    expect(html).not.toMatch(/value="auto"[^>]*checked=""|checked=""[^>]*value="auto"/);
  });

  it("mientras busca los formatos guardados lo indica y deja la detección automática", () => {
    const text = visibleText(render(<FormatPicker templates={null} loading value={AUTO_FORMAT} onChange={noop} />));
    expect(text).toContain("Buscando formatos guardados…");
    expect(text).toContain("Detectar automáticamente");
  });
});

describe("panel de subida", () => {
  it("trae la guía de cinco líneas, el régimen por defecto en «Más opciones» y no sube sin archivo", () => {
    const html = render(<UploadPanel busy={false} templates={[]} loadingTemplates={false} onUpload={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Antes de subir");
    expect(text).toContain("Una fila por pieza.");
    expect(html.match(/<li[ >]/g)).toHaveLength(5);
    expect(text).toContain("Más opciones");
    expect(text).toContain("Si el archivo no trae régimen de tenencia");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Subir y revisar/);
  });

  it("no menciona identificadores de requisitos", () => {
    const text = visibleText(render(<UploadPanel busy={false} templates={[template("tpl-1", "Sábana")]} loadingTemplates={false} onUpload={noop} />));
    expect(text).not.toMatch(/\b(RF|RN|RNF|RIA)-\d+/);
  });
});
