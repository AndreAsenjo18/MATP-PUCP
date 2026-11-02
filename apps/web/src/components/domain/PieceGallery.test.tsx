import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPieceMedia, initialPhoto, type PieceMedia } from "@/lib/data/media";
import { render, visibleText } from "@/test/render";
import { PieceGalleryView, type PieceGalleryActions } from "./PieceGallery";

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
    effective_restriction: null,
    restriction_origin: "ninguna",
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
    expect(html).toContain('aria-label="Ver foto 2: Vista sin especificar (principal)"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("muestra en el visor la foto elegida", () => {
    const media = [photo("a", { is_primary: true }), photo("b")];

    const html = render(<PieceGalleryView media={media} pieceTitle="Retablo" selectedId="b" />);

    expect(html).toContain('src="https://media.test/b/display.webp?firma"');
    expect(html).not.toContain("a/display.webp");
  });

  it("etiqueta la restricción efectiva con su origen (RN-008) y no ofrece descargas", () => {
    const media = [photo("c", { is_primary: true, effective_restriction: NO_PUBLICAR, restriction_origin: "colección" })];

    const html = render(<PieceGalleryView media={media} pieceTitle="Manta" selectedId={null} />);

    expect(visibleText(html)).toContain("No publicar (origen: colección)");
    expect(html).not.toMatch(/download=|Descargar/);
  });

  it("dice cuándo no hay fotos o no hay vista previa", () => {
    expect(visibleText(render(<PieceGalleryView media={[]} pieceTitle="Mate" selectedId={null} />))).toContain("Sin fotografías registradas.");

    const unsigned = render(<PieceGalleryView media={[photo("d", { download_url: null, thumbnail_url: null })]} pieceTitle="Mate" selectedId={null} />);
    expect(visibleText(unsigned)).toContain("Vista previa no disponible.");
    expect(unsigned).not.toContain("<img");
  });
});

describe("acciones sobre la foto elegida (fotografias-multiples-por-pieza 3.2)", () => {
  const noop = () => {};
  const VIEWS = [{ id: "vista-frontal", label: "Frontal" }, { id: "vista-perfil", label: "Perfil" }];
  const actions = (overrides: Partial<PieceGalleryActions> = {}): PieceGalleryActions => ({
    viewTypes: VIEWS,
    busy: false,
    canEdit: true,
    canRetire: true,
    message: null,
    error: null,
    onViewType: noop,
    onMakePrimary: noop,
    onMove: noop,
    onRetire: noop,
    ...overrides,
  });
  const GALLERY = [photo("a", { is_primary: true }), photo("b"), photo("c")];
  const view = (selectedId: string, extra: Partial<PieceGalleryActions> = {}, media = GALLERY) => render(<PieceGalleryView media={media} pieceTitle="Retablo" selectedId={selectedId} actions={actions(extra)} />);
  const button = (html: string, label: string) => html.match(new RegExp(`<button(?:(?!</button>).)*${label}`))?.[0];

  it("«Usuario sin permiso»: sin permisos o sin acciones, la galería solo se ve", () => {
    for (const html of [view("b", { canEdit: false, canRetire: false }), render(<PieceGalleryView media={GALLERY} pieceTitle="Retablo" selectedId="b" />)]) {
      const text = visibleText(html);
      for (const label of ["Marcar como principal", "Mover antes", "Retirar foto", "Tipo de vista"]) expect(text).not.toContain(label);
    }
  });

  it("quien sube fotos cambia tipo de vista, orden y principal, pero no retira sin su permiso", () => {
    const text = visibleText(view("b", { canRetire: false }));
    for (const label of ["Tipo de vista", "Marcar como principal", "Mover antes", "Mover después"]) expect(text).toContain(label);
    expect(text).not.toContain("Retirar foto");
  });

  it("quien solo retira no ve lo demás", () => {
    const text = visibleText(view("b", { canEdit: false }));
    expect(text).toContain("Retirar foto");
    for (const label of ["Tipo de vista", "Marcar como principal", "Mover antes"]) expect(text).not.toContain(label);
  });

  it("el selector ofrece los tipos de vista con el de la foto marcado", () => {
    const html = view("a");
    expect(html).toMatch(/<option value="vista-frontal" selected/);
    expect(visibleText(html)).toContain("Perfil");
  });

  it("una foto sin tipo de vista o con uno desactivado lo sigue mostrando", () => {
    const unset = view("x", {}, [photo("x", { view_type: null, is_primary: true })]);
    expect(visibleText(unset)).toContain("Vista sin especificar");
    const retired = view("y", {}, [photo("y", { view_type: { id: "vieja", code: "Vieja", label: "Vista vieja" }, is_primary: true })]);
    expect(retired).toMatch(/<option value="vieja" selected/);
  });

  it("«Cambio de principal»: solo se ofrece en una foto que no lo es", () => {
    expect(visibleText(view("b"))).toContain("Marcar como principal");
    expect(visibleText(view("a"))).not.toContain("Marcar como principal");
  });

  it("marca la principal también en su miniatura, y lo dice", () => {
    expect(view("b")).toContain('aria-label="Ver foto 1: Frontal (principal)"');
  });

  it("mover respeta los extremos, dice la posición y una sola foto no se mueve", () => {
    expect(visibleText(view("b"))).toContain("Foto 2 de 3");
    expect(button(view("a"), "Mover antes")).toMatch(/\sdisabled=""/);
    expect(button(view("a"), "Mover después")).not.toMatch(/\sdisabled=""/);
    expect(button(view("c"), "Mover después")).toMatch(/\sdisabled=""/);
    expect(button(view("c"), "Mover antes")).not.toMatch(/\sdisabled=""/);
    expect(visibleText(view("x", {}, [photo("x", { is_primary: true })]))).not.toContain("Mover antes");
  });

  it("en tableta: botones de 44 px en cualquier ancho y sin depender de arrastrar", () => {
    const html = view("b");
    for (const label of ["Marcar como principal", "Mover antes", "Mover después", "Retirar foto"]) {
      expect(button(html, label)).toContain("min-h-11");
      expect(button(html, label)).not.toContain("md:min-h-9");
    }
    expect(html).not.toContain("draggable");
    expect(html).toContain("h-20 w-20");
  });

  it("«Retiro de la foto principal»: pide un motivo y explica qué pasa", () => {
    const html = view("a");
    const text = visibleText(html);
    expect(text).toContain("Motivo (al menos 3 caracteres)");
    expect(html).toContain('minLength="3"');
    expect(text).toContain("no se borra");
    expect(text).toContain("Como es la principal, pasa a serlo la siguiente en orden.");
    expect(visibleText(view("b"))).not.toContain("Como es la principal");
  });

  it("con una operación en curso se desactivan las acciones", () => {
    const html = view("b", { busy: true });
    for (const label of ["Marcar como principal", "Mover antes", "Mover después", "Retirar foto"]) expect(button(html, label)).toMatch(/\sdisabled=""/);
    expect(html).toMatch(/<select[^>]*disabled=""/);
  });

  it("muestra el resultado de la última acción", () => {
    expect(visibleText(view("b", { message: "Orden guardado." }))).toContain("Orden guardado.");
    expect(view("b", { error: "No se pudo." })).toContain('role="alert"');
  });

  it("no cita requisitos", () => {
    const media = [photo("a", { is_primary: true, effective_restriction: NO_PUBLICAR, restriction_origin: "pieza", restriction_note: "Restricción contractual del comodato (RN-008)" })];
    expect(visibleText(view("a", {}, media))).not.toMatch(/\b(RF|RN|RNF)-\d/);
  });
});

describe("capa de datos de la galería", () => {
  it("elige la principal o la primera", () => {
    expect(initialPhoto([photo("a"), photo("b", { is_primary: true })])?.id).toBe("b");
    expect(initialPhoto([photo("a"), photo("b")])?.id).toBe("a");
    expect(initialPhoto([])).toBeNull();
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
