import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPieceMedia, initialPhoto, restrictionLabel, type PieceMedia } from "@/lib/data/media";
import { render, visibleText } from "@/test/render";
import { PieceGalleryView } from "./PieceGallery";

const PIECE = "01920000-0000-7000-8000-000000000101";

function photo(id: string, overrides: Partial<PieceMedia> = {}): PieceMedia {
  return {
    id,
    piece_id: PIECE,
    original_filename: `${id}.jpg`,
    content_type: "image/jpeg",
    size_bytes: 2048,
    content_sha256: "0".repeat(64),
    width_px: null,
    height_px: null,
    view_type: { id: "vista-frontal", code: "Frontal", label: "Frontal" },
    sort_order: 0,
    is_primary: false,
    photographer: null,
    taken_on: null,
    usage_restriction: null,
    restriction_note: null,
    download_url: `https://media.test/${id}/display.webp?firma`,
    thumbnail_url: `https://media.test/${id}/thumb.webp?firma`,
    created_at: "2026-10-25T10:00:00Z",
    ...overrides,
  };
}

const NO_PUBLICAR = { id: "restriccion", code: "NO_PUBLICAR", label: "No publicar" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("galería de la ficha (Req: Gestión de galería con foto principal única)", () => {
  it("muestra las miniaturas firmadas y la principal en el visor", () => {
    const media = [photo("a", { sort_order: 0 }), photo("b", { sort_order: 1, is_primary: true, view_type: null })];

    const html = render(<PieceGalleryView media={media} pieceTitle="Retablo sintético" selectedId={null} />);
    const text = visibleText(html);

    expect(html).toContain('src="https://media.test/a/thumb.webp?firma"');
    expect(html).toContain('src="https://media.test/b/thumb.webp?firma"');
    expect(html).toContain('src="https://media.test/b/display.webp?firma"'); // the primary one
    expect(html).toContain('alt="Retablo sintético — Vista sin especificar"');
    expect(text).toContain("Principal");
    expect(html).toContain('aria-label="Ver foto 2: Vista sin especificar"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("muestra en el visor la foto elegida", () => {
    const media = [photo("a", { is_primary: true }), photo("b")];

    const html = render(<PieceGalleryView media={media} pieceTitle="Retablo" selectedId="b" />);

    expect(html).toContain('src="https://media.test/b/display.webp?firma"');
    expect(html).not.toContain("a/display.webp");
  });

  it("etiqueta la restricción heredada del comodato (RN-008) y no ofrece descargas", () => {
    const media = [photo("c", { is_primary: true, usage_restriction: NO_PUBLICAR, restriction_note: "Restricción contractual del comodato (RN-008)" })];

    const html = render(<PieceGalleryView media={media} pieceTitle="Manta" selectedId={null} />);

    expect(visibleText(html)).toContain("No publicar: Restricción contractual del comodato (RN-008)");
    expect(html).not.toMatch(/download=|Descargar/);
  });

  it("dice cuándo no hay fotos o no hay vista previa", () => {
    expect(visibleText(render(<PieceGalleryView media={[]} pieceTitle="Mate" selectedId={null} />))).toContain("Sin fotografías registradas.");

    const unsigned = render(<PieceGalleryView media={[photo("d", { download_url: null, thumbnail_url: null })]} pieceTitle="Mate" selectedId={null} />);
    expect(visibleText(unsigned)).toContain("Vista previa no disponible.");
    expect(unsigned).not.toContain("<img");
  });
});

describe("capa de datos de la galería", () => {
  it("elige la principal o la primera y oculta «Sin restricción»", () => {
    expect(initialPhoto([photo("a"), photo("b", { is_primary: true })])?.id).toBe("b");
    expect(initialPhoto([photo("a"), photo("b")])?.id).toBe("a");
    expect(initialPhoto([])).toBeNull();
    expect(restrictionLabel({ usage_restriction: { id: "s", code: "SIN_RESTRICCION", label: "Sin restricción" }, restriction_note: null })).toBeNull();
    expect(restrictionLabel({ usage_restriction: NO_PUBLICAR, restriction_note: null })).toBe("No publicar");
  });

  it("en modo live lee GET /pieces/{piece_id}/media", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");
    const handler: (request: Request) => Promise<Response> = async () =>
      new Response(JSON.stringify([photo("a")]), { status: 200, headers: { "content-type": "application/json" } });
    const fetchMock = vi.fn(handler);
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPieceMedia(PIECE, "curadora@matp.local");

    expect(result).toEqual({ status: "ok", media: [photo("a")] });
    const request = fetchMock.mock.calls[0]![0];
    expect(new URL(request.url).pathname).toBe(`/api/v1/pieces/${PIECE}/media`);
  });

  it("informa si no se pueden cargar", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
    vi.stubEnv("API_INTERNAL_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("sin red"))));

    expect(await fetchPieceMedia(PIECE)).toEqual({ status: "error", message: "No se pudieron cargar las fotografías. Intente nuevamente." });
  });
});

describe("procedencia de la foto (importacion-fotos-a-catalogo, tarea 7.5)", () => {
  it("una foto del archivo muestra su ruta, su lote y la versión que reemplazó", () => {
    const imported = photo("alta", {
      is_primary: true,
      provenance: {
        source: "import",
        original_filename: "82LF4169 copy.jpg",
        relative_path: "FOTOS/ALTAS/82LF4169 copy.jpg",
        import_batch_id: "01920000-0000-7000-8000-000000000912",
        import_batch_name: "Lote 12 sintético",
        replaced_lower_resolution: ["FOTOS/82LF4169.jpg"],
      },
    });

    const text = visibleText(render(<PieceGalleryView media={[imported]} pieceTitle="Toro sintético" selectedId={null} onSelect={() => {}} />));

    expect(text).toContain(
      "Procedencia: FOTOS/ALTAS/82LF4169 copy.jpg · lote «Lote 12 sintético» · reemplazó a la versión de menor resolución FOTOS/82LF4169.jpg",
    );
  });

  it("una foto subida a mano lo dice, y sin procedencia no se muestra nada", () => {
    const manual = photo("frente", { is_primary: true, provenance: { source: "manual", original_filename: "frente.jpg", replaced_lower_resolution: [] } });

    expect(visibleText(render(<PieceGalleryView media={[manual]} pieceTitle="Toro" selectedId={null} onSelect={() => {}} />))).toContain(
      "Procedencia: frente.jpg · subida desde la ficha",
    );
    expect(visibleText(render(<PieceGalleryView media={[photo("x", { is_primary: true })]} pieceTitle="Toro" selectedId={null} onSelect={() => {}} />))).not.toContain(
      "Procedencia",
    );
  });
});
