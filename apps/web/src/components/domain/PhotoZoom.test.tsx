import { describe, expect, it } from "vitest";

import type { PieceMedia } from "@/lib/data/media";
import { render, visibleText } from "@/test/render";

import { MAX_ZOOM, MIN_ZOOM, PhotoZoomViewer, zoomLabel, zoomStep } from "./PhotoZoomViewer";
import { PieceGalleryView } from "./PieceGallery";
import { GeneralDataWithPhoto, PrimaryPhotoView } from "./PiecePrimaryPhoto";

// Change codigo-unico-y-ajustes-pantallas, D3 y D4. HTML estático (ADR-012); fotos sintéticas.

function photo(id: string, overrides: Partial<PieceMedia> = {}): PieceMedia {
  return {
    id,
    piece_id: "pieza-sintetica",
    original_filename: `${id}.jpg`,
    content_type: "image/jpeg",
    size_bytes: 2048,
    content_sha256: "0".repeat(64),
    width_px: null,
    height_px: null,
    view_type: { id: "vista-frontal", code: "Frontal", label: "Frontal" },
    sort_order: 0,
    is_primary: true,
    photographer: null,
    taken_on: null,
    usage_restriction: null,
    effective_restriction: null,
    restriction_origin: "ninguna",
    restriction_note: null,
    download_url: `https://media.test/${id}/display.webp?firma`,
    thumbnail_url: `https://media.test/${id}/thumb.webp?firma`,
    created_at: "2026-11-21T10:00:00Z",
    ...overrides,
  };
}

describe("zoom de la foto", () => {
  it("acerca y aleja por pasos, entre la foto entera y seis veces", () => {
    expect(zoomStep(MIN_ZOOM, 1)).toBe(1.5);
    expect(zoomStep(1.5, 1)).toBe(2.25);
    expect(zoomStep(2.25, -1)).toBe(1.5);
    expect(zoomStep(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
    expect(zoomStep(5, 1)).toBe(MAX_ZOOM);
  });

  it("dice el zoom en palabras", () => {
    expect(zoomLabel(1)).toBe("Foto entera");
    expect(zoomLabel(2.25)).toBe("225 %");
  });

  it("el visor es un diálogo con título, botones de 44 px con nombre y la foto", () => {
    const html = render(<PhotoZoomViewer open={false} src="https://media.test/a.webp" alt="Retablo — Frontal" onClose={() => {}} />);
    expect(html).toMatch(/<dialog[^>]*aria-labelledby=/);
    expect(html).toContain('aria-label="Acercar"');
    expect(html).toContain('aria-label="Alejar"');
    expect(html).toContain('aria-label="Cerrar la foto"');
    expect(visibleText(html)).toContain("Ajustar a la pantalla");
    expect(visibleText(html)).toContain("Foto entera");
    expect(html).toContain('src="https://media.test/a.webp"');
    expect(html.match(/size-11/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("galería: la foto elegida se amplía", () => {
  it("la foto grande es un botón que la amplía, y hay un botón «Ampliar»", () => {
    const html = render(<PieceGalleryView media={[photo("a")]} pieceTitle="Retablo sintético" selectedId={null} />);
    expect(html).toContain('aria-label="Ampliar la foto: Frontal"');
    expect(visibleText(html)).toContain("Ampliar");
    expect(html).toContain("<dialog");
  });
});

describe("foto principal en «Datos generales»", () => {
  it("la muestra, se amplía y lleva a todas las fotos", () => {
    const html = render(<PrimaryPhotoView photo={photo("a")} total={3} pieceTitle="Retablo sintético" onShowAll={() => {}} />);
    expect(html).toContain('aria-label="Foto principal"');
    expect(html).toContain('alt="Retablo sintético — Frontal"');
    expect(html).toContain('aria-label="Ampliar la foto principal: Frontal"');
    expect(visibleText(html)).toContain("Ver las 3 fotos");
  });

  it("una sola foto: lo dice en singular", () => {
    const html = render(<PrimaryPhotoView photo={photo("a")} total={1} pieceTitle="Retablo" onShowAll={() => {}} />);
    expect(visibleText(html)).toContain("Ver la foto en Fotografías");
  });

  it("sin fotos, lo dice y lleva a «Fotografías»; mientras carga, un aviso", () => {
    expect(visibleText(render(<PrimaryPhotoView photo={null} total={0} pieceTitle="Retablo" onShowAll={() => {}} />))).toContain("La pieza aún no tiene fotos. Ir a Fotografías");
    expect(visibleText(render(<PrimaryPhotoView photo={undefined} total={0} pieceTitle="Retablo" />))).toBe("Cargando la foto…");
  });

  it("al lado de los datos en pantallas anchas y arriba en un celular", () => {
    const html = render(<GeneralDataWithPhoto photo={<p>foto</p>}>datos</GeneralDataWithPhoto>);
    expect(html).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,22rem\)\]/);
    expect(html.indexOf("foto")).toBeLessThan(html.indexOf("datos"));
    expect(html).toContain("lg:order-2");
  });
});
