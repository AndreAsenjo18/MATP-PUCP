/**
 * Asistente «Importar fotografías al catálogo» (change `importacion-fotos-a-catalogo`, tareas 7.2
 * a 7.4): las vistas sin estado de los tres pasos como HTML estático (ADR-012) y el manejo del
 * teclado de la cuadrícula. Datos sintéticos (RNF-014).
 */
import { describe, expect, it, vi } from "vitest";
import { PhotoImportEntry } from "@/app/importacion/page";
import type { BatchPhoto, PhotoFolder } from "@/lib/data/photoBatches";
import { render, visibleText } from "@/test/render";
import { PHOTO_WIZARD_STEPS, PhotoUploadStart, UPLOAD_HELP } from "./PhotoCatalogWizard";
import { draftFor, PhotoReadingView } from "./PhotoReadingStep";
import { photoKeyDown, PhotoReviewView, stateCounts, visiblePhotos } from "./PhotoReviewStep";

function folder(overrides: Partial<PhotoFolder> = {}): PhotoFolder {
  return {
    path: "FOTOS 051-114",
    name: "FOTOS 051-114",
    depth: 0,
    photos: 64,
    by_match_status: { UNMATCHED: 64 },
    range: [51, 114],
    proposed_collection: { id: "col-abc", name: "Colección ABC sintética" },
    collection: { id: "col-abc", name: "Colección ABC sintética" },
    collection_pending: true,
    rule: { mode: "auto" },
    rule_from: null,
    suggestion: { shape: "999-9999", template: "{n}-{*}", matching: 60, total: 64 },
    ...overrides,
  };
}

function photo(id: string, overrides: Partial<BatchPhoto> = {}): BatchPhoto {
  return {
    id,
    relative_path: `ALTAS/${id}.jpg`,
    original_filename: `${id}.jpg`,
    size_bytes: 1024,
    status: "VERIFIED",
    rejection_reason: null,
    match_status: "UNMATCHED",
    match_source: null,
    row_id: null,
    candidate_row_ids: null,
    sort_key: null,
    piece_id: null,
    candidate_piece_ids: null,
    match_reason: "camera_name",
    width_px: 2400,
    height_px: 1800,
    same_as_photo_id: null,
    duplicate_of_existing: false,
    duplicate_confirmed: false,
    thumbnail_url: `https://media.test/${id}/thumb.webp?firma`,
    ...overrides,
  };
}

describe("entrada y paso 1 «Subir carpeta»", () => {
  it("Importación ofrece la entrada separada de «Importar Excel»", () => {
    const html = render(<PhotoImportEntry />);
    expect(html).toContain('href="/importacion/fotos"');
    expect(visibleText(html)).toContain("Importar fotografías al catálogo");
  });

  it("pide el nombre del lote y explica cómo traer la carpeta de Drive", () => {
    const empty = render(<PhotoUploadStart name="" busy={false} error={null} />);
    expect(visibleText(empty)).toContain("Descargue la carpeta de Drive, descomprímala y arrástrela aquí");
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>.*Crear el lote/);
    const named = render(<PhotoUploadStart name="Fotos ABC" busy={false} error="El lote no se pudo crear." />);
    expect(named).not.toMatch(/<button[^>]*disabled=""/);
    expect(visibleText(named)).toContain("El lote no se pudo crear.");
    expect(UPLOAD_HELP).toContain("nada llega a una ficha hasta aprobar el lote");
    expect(PHOTO_WIZARD_STEPS).toEqual(["Subir carpeta", "Cómo se leen los nombres", "Revisar y aprobar"]);
  });
});

describe("paso 2 «Cómo se leen los nombres»", () => {
  const base = {
    folders: [folder(), folder({ path: "FOTOS 051-114/sub", name: "sub", depth: 1, photos: 0, by_match_status: {}, suggestion: null, range: null })],
    selected: "FOTOS 051-114",
    collections: [
      { id: "col-abc", name: "Colección ABC sintética", acronym: "ABC" },
      { id: "col-xyz", name: "Colección XYZ sintética", acronym: "XYZ" },
    ],
    typeCodes: ["COLECCION", "PUCP"],
    preview: null,
    previewError: null,
    saving: false,
    message: null,
    error: null,
    correspondences: null,
  };

  it("muestra el árbol, el rango, la colección propuesta y la sugerencia sin aplicarla", () => {
    const html = render(<PhotoReadingView {...base} draft={draftFor(folder())} />);
    const text = visibleText(html);
    expect(text).toContain("Sugerencia pendiente");
    expect(text).toContain("carpeta de rango 51–114");
    expect(text).toContain("60 de 64 nombres siguen la forma «999-9999»");
    expect(text).toContain("Usar la plantilla {n}-{*}");
    expect(text).toContain("Colección ABC sintética (propuesta)");
    expect(text).toContain("confírmela al guardar");
    expect(html).toContain('name="reading-mode" checked="" value="auto"');
    expect(html).not.toContain('id="photo-template"'); // la plantilla no se aplica sola
  });

  it("con la plantilla elegida ofrece los chips y la vista previa", () => {
    const preview = {
      folder: "FOTOS 051-114",
      total: 64,
      not_fitting: 1,
      items: [
        { photo_id: "a", relative_path: "FOTOS 051-114/053-3269.jpg", codes: ["n: 053"], match_status: "MATCHED" as const, piece_id: "p53", candidate_piece_ids: [], match_reason: null },
        { photo_id: "b", relative_path: "FOTOS 051-114/portada.jpg", codes: [], match_status: "UNMATCHED" as const, piece_id: null, candidate_piece_ids: [], match_reason: "template_mismatch" },
      ],
    };
    const html = render(<PhotoReadingView {...base} draft={{ mode: "template", template: "{n}-{*}", collection_id: "col-abc" }} preview={preview} />);
    const text = visibleText(html);
    expect(html).toContain('value="{n}-{*}"');
    for (const chip of ["{COLECCION}", "{PUCP}", "{n}", "{*}"]) expect(text).toContain(chip);
    expect(text).toContain("1 no siguen la plantilla");
    expect(text).toContain("053-3269.jpg n: 053 Pieza encontrada");
    expect(text).toContain("portada.jpg — Sin pieza · El nombre no sigue la plantilla");
  });

  it("explica una plantilla inválida y el resultado de la lista", () => {
    const html = render(
      <PhotoReadingView
        {...base}
        draft={{ mode: "template", template: "{XYZ}", collection_id: null }}
        previewError="«{XYZ}» no es un tipo de identificador activo."
        correspondences={{ batch_id: "b", applied: 3, no_photo: 1, no_piece: 0, ambiguous: 2, lines: [] }}
      />,
    );
    const text = visibleText(html);
    expect(text).toContain("«{XYZ}» no es un tipo de identificador activo.");
    expect(text).toContain("Lista: 3 aplicadas · 1 sin foto · 0 sin pieza · 2 ambiguas.");
  });
});

describe("paso 3 «Revisar y aprobar»", () => {
  const photos = [
    photo("82LF4169 copy"),
    photo("ABC 1", { relative_path: "Fotos ABC/ABC 1.jpg", match_status: "MATCHED", piece_id: "p1", match_reason: null }),
    photo("ABC 2", { relative_path: "Fotos ABC/ABC 2.jpg", match_status: "AMBIGUOUS", match_reason: "discrepant_codes", candidate_piece_ids: ["p1", "p2"] }),
  ];
  const approval = { to_apply: 1, pieces: 1, unassigned: 2, duplicates_pending: 0, uploading: 0, partial_codes: 0, out_of_range: 0, collections_pending: 1 };
  const base = {
    photos,
    folders: ["ALTAS", "Fotos ABC"],
    filter: { folder: "", state: "" as const },
    selected: [] as string[],
    focused: null,
    focusedPiece: null,
    focusedGallery: [],
    query: "",
    results: [],
    batch: { status: "IN_PREVIEW" as const, approval_summary: { create: 0, update: 0, skip: 0, summary_token: "t", photos: approval } },
    canApprove: true,
    busy: false,
    message: null,
    error: null,
  };

  it("cuenta por estado, filtra por carpeta y estado y avisa antes de aprobar", () => {
    expect(stateCounts(photos)).toMatchObject({ proposed: 1, ambiguous: 1, unassigned: 1 });
    expect(visiblePhotos(photos, { folder: "Fotos ABC", state: "" }).map((item) => item.id)).toEqual(["ABC 1", "ABC 2"]);
    expect(visiblePhotos(photos, { folder: "", state: "ambiguous" }).map((item) => item.id)).toEqual(["ABC 2"]);

    const text = visibleText(render(<PhotoReviewView {...base} />));
    expect(text).toContain("Se aplicarán 1 foto a 1 pieza");
    expect(text).toContain("2 fotos quedarán sin aplicar porque no tienen pieza.");
    expect(text).toContain("1 carpeta tiene la colección propuesta sin confirmar.");
    expect(text).toContain("Aprobar y aplicar 1 fotos");
    expect(text).toContain("Códigos discrepantes");
  });

  it("marca la selección, ofrece las piezas encontradas y compara con la galería", () => {
    const html = render(
      <PhotoReviewView
        {...base}
        filter={{ folder: "ALTAS", state: "" }}
        selected={["82LF4169 copy"]}
        focused={photos[0]!}
        query="I-0236"
        results={[{ id: "p9", label: "Manta sintética", codes: "I-0236", collection: "Colección ABC sintética" }]}
      />,
    );
    const text = visibleText(html);
    expect(html).toContain('aria-pressed="true"');
    expect(text).toContain("1 fotos elegidas");
    expect(text).toContain("Seleccionar todas las de la carpeta (1)");
    expect(text).toContain("Manta sintética I-0236 · Colección ABC sintética");
    expect(text).toContain("2400 × 1800 px");
  });

  it("sin permiso de aprobar no ofrece el botón", () => {
    const text = visibleText(render(<PhotoReviewView {...base} canApprove={false} />));
    expect(text).toContain("no aprobar el lote");
    expect(text).not.toContain("Aprobar y aplicar");
  });

  it("Espacio y Enter eligen la foto; con Mayús, el rango; otras teclas no", () => {
    const onPhotoClick = vi.fn();
    const target = photos[0]!;
    const key = (k: string, shiftKey = false) => ({ key: k, shiftKey, preventDefault: vi.fn() });

    const space = key(" ");
    photoKeyDown(target, onPhotoClick)(space);
    photoKeyDown(target, onPhotoClick)(key("Enter", true));
    photoKeyDown(target, onPhotoClick)(key("a"));

    expect(onPhotoClick.mock.calls).toEqual([
      [target, false],
      [target, true],
    ]);
    expect(space.preventDefault).toHaveBeenCalled();
  });
});
