import { describe, expect, it } from "vitest";

import { formatFileSize, isSpreadsheetFile } from "@/lib/data/imports";
import { render, visibleText } from "@/test/render";

import { DropZone, UploadPanel } from "./ImportUpload";

// Spec importacion-datos — Subida mínima con detección automática del formato. Datos sintéticos (RNF-014).

const noop = () => {};

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

describe("panel de subida", () => {
  it("muestra solo la zona de subida, el botón desactivado y la guía plegada, sin pedir un formato", () => {
    const html = render(<UploadPanel busy={false} onUpload={noop} />);
    const text = visibleText(html);
    expect(text).toContain("Arrastre aquí su archivo");
    expect(text).toContain("Subir y revisar");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Subir y revisar/);
    expect(text).not.toContain("Formato del archivo");
    expect(text).not.toContain("Detectar automáticamente");
    expect(text).not.toContain("Más opciones");
    expect(text).not.toContain("Antes de subir");
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain("<select");
  });

  it("la guía queda plegada bajo «¿Cómo preparo mi Excel?» con cinco líneas como máximo", () => {
    const html = render(<UploadPanel busy={false} onUpload={noop} />);
    expect(html).toMatch(/<details(?![^>]*open)[^>]*>\s*<summary[^>]*>[^<]*¿Cómo preparo mi Excel\?/);
    expect(visibleText(html)).toContain("Una fila por pieza.");
    expect(html.match(/<li[ >]/g)?.length ?? 0).toBeLessThanOrEqual(5);
  });

  it("no menciona identificadores de requisitos", () => {
    const text = visibleText(render(<UploadPanel busy={false} onUpload={noop} />));
    expect(text).not.toMatch(/(RF|RN|RNF|RIA)-\d+/);
  });
});
