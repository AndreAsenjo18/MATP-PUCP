/**
 * Capa de datos de los lotes de solo fotografías (change `importacion-fotos-a-catalogo`, tarea
 * 7.1): reglas de la pantalla, la maqueta en modo `mock` y las llamadas en modo `live` contra un
 * `fetch` simulado (sin API real ni red). Datos sintéticos (RNF-014).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approvalSentence,
  approvalWarnings,
  createPhotoBatch,
  decidePhotos,
  fetchBatchPhotos,
  fetchPhotoFolders,
  folderState,
  insertMarker,
  previewReading,
  resetPhotoBatchMock,
  saveReading,
  searchPieces,
  templateMarkers,
  toggleSelection,
  trayState,
  uploadCorrespondences,
  type BatchPhoto,
  type PhotoFolder,
} from "./photoBatches";

const BASE_URL = "http://api.test";
const BATCH = "01920000-0000-7000-8000-000000000901";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function useLive(handler: (request: Request) => Promise<Response>) {
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  vi.stubEnv("API_INTERNAL_URL", BASE_URL);
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => resetPhotoBatchMock());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const photo = (overrides: Partial<BatchPhoto> = {}) =>
  ({ status: "VERIFIED", match_status: "MATCHED", match_reason: null, piece_id: "p", duplicate_of_existing: false, duplicate_confirmed: false, ...overrides }) as BatchPhoto;

describe("reglas de la pantalla", () => {
  it("ofrece los tipos, {n} y {*} como chips e inserta en el cursor", () => {
    expect(templateMarkers(["PUCP"]).map((item) => item.marker)).toEqual(["{PUCP}", "{n}", "{*}"]);
    expect(insertMarker("", "{n}")).toEqual({ text: "{n}", cursor: 3 });
    expect(insertMarker("{n}-", "{*}").text).toBe("{n}-{*}");
    expect(insertMarker("{COLECCION}", "{n}").text).toBe("{COLECCION} {n}");
    expect(insertMarker("{n} x", "{COLECCION}", 0).text).toBe("{COLECCION}{n} x");
  });

  it("marca cada carpeta: se lee sola, sugerencia pendiente o sin código", () => {
    const folder = (overrides: Partial<PhotoFolder>) =>
      ({ photos: 4, by_match_status: {}, suggestion: null, rule: { mode: "auto" }, ...overrides }) as PhotoFolder;
    expect(folderState(folder({ by_match_status: { MATCHED: 3, UNMATCHED: 1 } }))).toBe("reads");
    expect(folderState(folder({ by_match_status: { UNMATCHED: 4 }, suggestion: { shape: "999-9999", template: "{n}-{*}", matching: 4, total: 4 } }))).toBe("suggestion");
    expect(folderState(folder({ by_match_status: { UNMATCHED: 4 } }))).toBe("no-code");
    expect(folderState(folder({ photos: 0 }))).toBe("empty");
  });

  it("da a cada foto su estado de la cuadrícula", () => {
    expect(trayState(photo())).toBe("proposed");
    expect(trayState(photo({ match_reason: "out_of_range" }))).toBe("warning");
    expect(trayState(photo({ match_status: "AMBIGUOUS", piece_id: null }))).toBe("ambiguous");
    expect(trayState(photo({ match_status: "UNMATCHED", piece_id: null }))).toBe("unassigned");
    expect(trayState(photo({ status: "DISCARDED" }))).toBe("discarded");
    expect(trayState(photo({ duplicate_of_existing: true }))).toBe("repeated");
    expect(trayState(photo({ match_status: "MANUAL" }))).toBe("manual");
  });

  it("elige con clic y un rango con Mayús + clic", () => {
    const order = ["a", "b", "c", "d"];
    expect(toggleSelection(order, [], "b", null, false)).toEqual(["b"]);
    expect(toggleSelection(order, ["b"], "b", "b", false)).toEqual([]);
    expect(toggleSelection(order, ["b"], "d", "b", true)).toEqual(["b", "c", "d"]);
    expect(toggleSelection(order, ["d"], "a", "d", true).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("avisa antes de aprobar lo que queda fuera", () => {
    const approval = { to_apply: 250, pieces: 110, unassigned: 40, duplicates_pending: 1, uploading: 0, partial_codes: 0, out_of_range: 2, collections_pending: 1 };
    expect(approvalSentence(approval)).toBe("Se aplicarán 250 fotos a 110 piezas, a continuación de las que ya tienen.");
    expect(approvalWarnings(approval)).toEqual([
      "40 fotos quedarán sin aplicar porque no tienen pieza.",
      "1 foto ya está en su pieza y no se aplicará salvo que la confirme.",
      "1 carpeta tiene la colección propuesta sin confirmar.",
      "2 propuestas caen fuera del rango de su carpeta.",
    ]);
  });
});

describe("modo mock", () => {
  it("recorre el lote sintético: carpetas, plantilla y asignación", async () => {
    const batch = await createPhotoBatch("Archivo fotográfico sintético");
    expect(batch.status).toBe("ok");
    const folders = await fetchPhotoFolders("mock-photo-batch");
    expect(folders.status === "ok" && folders.value.folders.map((folder) => folder.path)).toContain("FOTOS 051-114");

    const rule = { mode: "template" as const, template: "{n}-{*}", collection_id: "mock-col-abc" };
    const preview = await previewReading("mock-photo-batch", "FOTOS 051-114", rule);
    expect(preview.status === "ok" && preview.value.items.map((item) => item.piece_id)).toEqual(["mock-abc-53", "mock-abc-59"]);
    const before = await fetchBatchPhotos("mock-photo-batch", { folder: "FOTOS 051-114" });
    expect(before.status === "ok" && before.value.every((item) => item.piece_id === null)).toBe(true); // la vista previa no guarda

    await saveReading("mock-photo-batch", "FOTOS 051-114", rule);
    const after = await fetchBatchPhotos("mock-photo-batch", { folder: "FOTOS 051-114" });
    expect(after.status === "ok" && after.value.map((item) => item.piece_id)).toEqual(["mock-abc-53", "mock-abc-59"]);

    await decidePhotos("mock-photo-batch", "assign", ["m6"], "mock-i-0236");
    const altas = await fetchBatchPhotos("mock-photo-batch", { pieceId: "mock-i-0236" });
    expect(altas.status === "ok" && altas.value.map((item) => item.match_status)).toEqual(["MANUAL"]);
    const found = await searchPieces("i-0236");
    expect(found.status === "ok" && found.value.map((item) => item.id)).toEqual(["mock-i-0236"]);
  });
});

describe("modo live", () => {
  it("crea el lote, guarda la regla y decide con la pieza", async () => {
    const fetchMock = useLive(async (request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/photo-batches")) return json(201, { id: BATCH, kind: "PHOTOS", file_name: "Fotos ABC", status: "UPLOADED" });
      if (path.endsWith("/photos/reading")) return json(200, { batch_id: BATCH, default_rule: { mode: "auto" }, folders: [] });
      if (path.endsWith("/photos")) return json(200, { batch_id: BATCH, photos: [{ id: "f1" }] });
      return json(404, {});
    });

    expect((await createPhotoBatch(" Fotos ABC ")).status).toBe("ok");
    expect((await saveReading(BATCH, "FOTOS 051-114", { mode: "template", template: "{n}-{*}" })).status).toBe("ok");
    const decided = await decidePhotos(BATCH, "assign", ["f1"], "pieza-1");
    expect(decided.status === "ok" && decided.value).toEqual([{ id: "f1" }]);

    const bodies = await Promise.all(fetchMock.mock.calls.map(([request]) => (request as Request).clone().json()));
    expect(bodies[0]).toEqual({ name: "Fotos ABC" });
    expect(bodies[1]).toEqual({ folder: "FOTOS 051-114", rule: { mode: "template", template: "{n}-{*}" } });
    expect(bodies[2]).toEqual({ op: "assign", photo_ids: ["f1"], piece_id: "pieza-1" });
  });

  it("muestra el motivo de una plantilla inválida", async () => {
    useLive(async () => json(422, { code: "invalid_photo_template", message: "«{XYZ}» no es un tipo de identificador activo." }));

    const result = await previewReading(BATCH, "Nueva carpeta", { mode: "template", template: "{XYZ}" });

    expect(result.status).toBe("rejected");
    expect(result.status === "rejected" && result.code).toBe("invalid_photo_template");
  });

  it("sube la lista de correspondencias como formulario", async () => {
    const fetchMock = useLive(async () => json(200, { batch_id: BATCH, applied: 1, no_photo: 0, no_piece: 0, ambiguous: 0, lines: [] }));

    const result = await uploadCorrespondences(BATCH, new Blob(["archivo,codigo\n"]), "lista.csv");

    expect(result.status === "ok" && result.value.applied).toBe(1);
    const request = fetchMock.mock.calls[0]![0] as Request;
    expect(new URL(request.url).pathname).toBe(`/api/v1/imports/${BATCH}/photos/correspondences`);
    expect(request.headers.get("content-type")).toContain("multipart/form-data");
  });

  it("lee todas las páginas de la bandeja con sus filtros", async () => {
    const fetchMock = useLive(async (request) => {
      const page = Number(new URL(request.url).searchParams.get("page"));
      return json(200, { items: [{ id: `f${page}` }], total: 2, page, page_size: 1 });
    });

    const result = await fetchBatchPhotos(BATCH, { folder: "ALTAS" });

    expect(result.status === "ok" && result.value.map((item) => item.id)).toEqual(["f1", "f2"]);
    expect(new URL((fetchMock.mock.calls[0]![0] as Request).url).searchParams.get("folder")).toBe("ALTAS");
  });
});
