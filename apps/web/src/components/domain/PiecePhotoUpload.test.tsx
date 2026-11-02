import { describe, expect, it } from "vitest";

import type { PiecePhotoProgress } from "@/lib/data/media";
import { render, visibleText } from "@/test/render";

import { PHOTO_ACCEPT, PiecePhotoUploadView, piecePhotoStatus, uploadSentence, type PiecePhotoUploadViewProps } from "./PiecePhotoUpload";

// Agregar fotografías desde la ficha (fotografias-multiples-por-pieza 3.2). Datos sintéticos (RNF-014).
const item = (relativePath: string, overrides: Partial<PiecePhotoProgress> = {}): PiecePhotoProgress => ({ relativePath, size: 1000, status: "pending", loaded: 0, ...overrides });

function view(props: Partial<PiecePhotoUploadViewProps> = {}) {
  return render(<PiecePhotoUploadView viewTypes={[{ id: "v-1", label: "Frontal" }]} viewTypeId="" progress={[]} ignored={null} running={false} message={null} error={null} {...props} />);
}

describe("elegir las fotos", () => {
  it("permite elegir varias, de los formatos admitidos, sin pedir una carpeta", () => {
    const html = view();
    expect(html).toContain('type="file"');
    expect(html).toContain("multiple");
    expect(html).toContain(`accept="${PHOTO_ACCEPT}"`);
    expect(html).not.toContain("webkitdirectory");
  });

  it("en una tableta deja elegir entre la galería y la cámara, con un botón ancho", () => {
    const html = view();
    expect(html).not.toContain("capture");
    expect(html).toContain("min-h-14");
    expect(visibleText(html)).toContain("Elegir fotografías");
  });

  it("el tipo de vista es opcional: se puede elegir después", () => {
    const text = visibleText(view());
    expect(text).toContain("Tipo de vista de estas fotos");
    expect(text).toContain("Elegir después");
    expect(text).toContain("Frontal");
  });

  it("sin tipos de vista cargados, igual se puede subir", () => {
    const html = view({ viewTypes: [] });
    expect(visibleText(html)).not.toContain("Tipo de vista de estas fotos");
    expect(html).toContain('type="file"');
  });

  it("dice qué archivos ignoró y por qué", () => {
    expect(visibleText(view({ ignored: { hidden: 0, system: 0, unsupported: 2 } }))).toContain("Se ignoraron 2 archivos: 2 con extensión no admitida.");
  });

  it("mientras sube no deja elegir otras", () => {
    expect(view({ running: true })).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
  });
});

describe("avance de la subida", () => {
  it("muestra el avance global y el estado de cada foto", () => {
    const html = view({ progress: [item("a.jpg", { status: "uploading", loaded: 450 }), item("b.jpg", { status: "registered", loaded: 1000 })] });
    const text = visibleText(html);
    expect(html).toContain('role="progressbar"');
    expect(text).toContain("1 de 2 fotos listas");
    expect(text).toContain("Subiendo 45 %");
    expect(text).toContain("Agregada");
  });

  it("cada estado se explica en lenguaje claro", () => {
    expect(piecePhotoStatus(item("a"))).toBe("Pendiente");
    expect(piecePhotoStatus(item("a", { status: "hashing" }))).toBe("Preparando");
    expect(piecePhotoStatus(item("a", { status: "uploaded" }))).toBe("Verificando");
    expect(piecePhotoStatus(item("a", { status: "rejected", reason: "No es una imagen." }))).toBe("Rechazada: No es una imagen.");
    expect(piecePhotoStatus(item("a", { status: "failed", reason: "Sin conexión." }))).toBe("Falló: Sin conexión.");
    expect(piecePhotoStatus(item("a", { status: "rejected", duplicate: true, reason: "Esta foto ya está en la pieza." }))).toBe("Esta foto ya está en la pieza.");
  });

  it("«Autorización de subida vencida»: ofrece reintentar lo que falló", () => {
    const failed = [item("a.jpg", { status: "failed", reason: "El almacenamiento no aceptó la subida (HTTP 403)." })];
    expect(visibleText(view({ progress: failed, onRetry: () => {} }))).toContain("Reintentar");
    expect(visibleText(view({ progress: failed, onRetry: () => {}, running: true }))).not.toContain("Reintentar");
    expect(visibleText(view({ progress: [item("a.jpg", { status: "registered" })], onRetry: () => {} }))).not.toContain("Reintentar");
  });

  it("una foto repetida ofrece subirla de todos modos, y una rechazada no", () => {
    const repeated = item("a.jpg", { status: "rejected", duplicate: true, reason: "Esta foto ya está en la pieza." });
    expect(visibleText(view({ progress: [repeated], onUploadRepeated: () => {} }))).toContain("Subir de todos modos");
    const rejected = item("b.jpg", { status: "rejected", reason: "No es una imagen." });
    expect(visibleText(view({ progress: [rejected], onUploadRepeated: () => {} }))).not.toContain("Subir de todos modos");
  });

  it("resume la pasada sin contar las repetidas como rechazadas", () => {
    expect(
      uploadSentence([
        item("a", { status: "registered" }),
        item("b", { status: "registered" }),
        item("c", { status: "rejected", duplicate: true }),
        item("d", { status: "rejected" }),
        item("e", { status: "failed" }),
      ]),
    ).toBe("2 fotos agregadas · 1 ya estaba en la pieza · 1 rechazada · 1 pendiente de reintentar.");
    expect(uploadSentence([item("a", { status: "registered" })])).toBe("1 foto agregada.");
  });

  it("no cita requisitos", () => {
    expect(visibleText(view({ progress: [item("a.jpg", { status: "failed" })] }))).not.toMatch(/\b(RF|RN|RNF)-\d/);
  });
});
