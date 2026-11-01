/**
 * Lotes de solo fotografías para piezas existentes (change `importacion-fotos-a-catalogo`, tarea
 * 7.1; spec importacion-datos, RF-046; diseño D4, D7, D8 y D10).
 *
 * Modo `live`: el cliente tipado contra `/imports/photo-batches` y `/imports/{batch_id}/photos/…`
 * (crear el lote, carpetas, vista previa de la lectura, guardar la regla, lista de
 * correspondencias, bandeja y decisiones). La subida de la carpeta reutiliza
 * `importPhotos.uploadBatchPhotos`, la aprobación `imports.confirmImportBatch`.
 *
 * Modo `mock`: un lote sintético en memoria con las formas de nombre del archivo del museo (F1,
 * F4, F5 y F6, con datos inventados) para recorrer las tres pantallas sin red.
 *
 * Además reúne las reglas de la pantalla (RNF-010): los marcadores de la plantilla, el estado de
 * cada carpeta en palabras, el motivo de cada propuesta, la selección con Mayús y el aviso previo
 * a aprobar.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";
import { call, IMPORT_ERROR_MESSAGES, type ImportBatch, type ImportResult } from "./imports";
import { apiBaseUrl, getApiMode } from "./mode";

export type PhotoFolder = ApiSchemas["PhotoFolderOut"];
export type PhotoFolders = ApiSchemas["PhotoFoldersOut"];
export type ReadingRule = ApiSchemas["PhotoReadingRule"];
export type ReadingPreview = ApiSchemas["ReadingPreviewOut"];
export type Correspondences = ApiSchemas["CorrespondencesOut"];
export type BatchPhoto = ApiSchemas["ImportPhotoOut"];
export type PhotoApproval = ApiSchemas["PhotoApprovalOut"];
export type PhotoOperation = ApiSchemas["PhotoDecisionRequest"]["op"];
export type ReadingMode = NonNullable<ReadingRule["mode"]>;

export interface PieceOption {
  id: string;
  label: string;
  codes: string;
  collection: string | null;
}

export const PHOTO_BATCH_MESSAGES: Record<string, string> = {
  ...IMPORT_ERROR_MESSAGES,
  invalid_photo_template: "La plantilla no es válida.",
  batch_kind_mismatch: "Esta operación no corresponde a un lote de solo fotografías.",
  piece_not_available: "La pieza no existe o fue retirada: elija otra.",
  batch_not_reviewable: "El lote ya no admite cambios en sus fotos.",
  invalid_correspondences: "La lista necesita las columnas «archivo» y «codigo».",
  folder_not_in_batch: "La carpeta no está en el lote.",
};

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

const isMock = () => getApiMode() === "mock";

// ---------------------------------------------------------------------------------------------
// Reglas de la pantalla
// ---------------------------------------------------------------------------------------------

export const READING_MODES: { value: ReadingMode; label: string; help: string }[] = [
  { value: "auto", label: "Automática", help: "Se buscan códigos en el nombre (PUCP, INC, código I, sigla y número)." },
  { value: "camera", label: "Nombres de cámara", help: "No se busca código: las fotos se asignan a mano o con una lista." },
  { value: "template", label: "Plantilla", help: "Usted indica qué código ocupa cada parte del nombre." },
];

/** Marcadores que se insertan como chips: los tipos de identificador, `{n}` y `{*}`. */
export function templateMarkers(typeCodes: readonly string[]): { marker: string; label: string }[] {
  return [
    ...typeCodes.map((code) => ({ marker: `{${code}}`, label: code })),
    { marker: "{n}", label: "n.º en la colección" },
    { marker: "{*}", label: "parte que se ignora" },
  ];
}

/** Inserta un marcador en la posición del cursor, con un espacio delante si hace falta. */
export function insertMarker(template: string, marker: string, cursor = template.length): { text: string; cursor: number } {
  const before = template.slice(0, cursor);
  const after = template.slice(cursor);
  const glue = before === "" || /[\s_-]$/.test(before) ? "" : " ";
  const text = `${before}${glue}${marker}${after}`;
  return { text, cursor: before.length + glue.length + marker.length };
}

export type FolderState = "reads" | "suggestion" | "no-code" | "empty";

/** Cómo está la carpeta, en las tres marcas de la pantalla (diseño D10). */
export function folderState(folder: Pick<PhotoFolder, "photos" | "by_match_status" | "suggestion" | "rule">): FolderState {
  if (folder.photos === 0) return "empty";
  const matched = folder.by_match_status.MATCHED ?? 0;
  const manual = folder.by_match_status.MANUAL ?? 0;
  if (folder.rule.mode === "auto" && folder.suggestion?.template && matched < folder.photos) return "suggestion";
  if ((matched + manual) / folder.photos >= 0.5) return "reads";
  return "no-code";
}

export const FOLDER_STATE_LABELS: Record<FolderState, string> = {
  reads: "Se lee sola",
  suggestion: "Sugerencia pendiente",
  "no-code": "Sin código",
  empty: "Sin fotos",
};

export const REASON_LABELS: Record<string, string> = {
  discrepant_codes: "Códigos discrepantes",
  camera_name: "Nombre de cámara",
  template_mismatch: "El nombre no sigue la plantilla",
  bare_number_without_collection: "Número sin colección",
  other_collection: "La pieza es de otra colección",
  duplicate_name: "Nombre repetido en el lote",
  partial_codes: "Un código no existe",
  out_of_range: "Fuera del rango de la carpeta",
};

/** Estado de una foto en la cuadrícula, para los filtros y el color de la tarjeta. */
export type TrayState = "proposed" | "warning" | "ambiguous" | "unassigned" | "discarded" | "repeated" | "manual";

export function trayState(photo: Pick<BatchPhoto, "status" | "match_status" | "match_reason" | "piece_id" | "duplicate_of_existing" | "duplicate_confirmed">): TrayState {
  if (photo.status === "DISCARDED") return "discarded";
  if (photo.duplicate_of_existing && !photo.duplicate_confirmed) return "repeated";
  if (photo.match_status === "AMBIGUOUS") return "ambiguous";
  if (!photo.piece_id) return "unassigned";
  if (photo.match_status === "MANUAL") return "manual";
  if (photo.match_reason) return "warning";
  return "proposed";
}

export const TRAY_STATE_LABELS: Record<TrayState, string> = {
  proposed: "Propuesta",
  warning: "Con advertencia",
  ambiguous: "Ambigua",
  unassigned: "Sin asignar",
  discarded: "Descartada",
  repeated: "Repetida",
  manual: "Asignada a mano",
};

/** Selección con clic y Mayús + clic: el rango entre la última foto elegida y esta. */
export function toggleSelection(order: readonly string[], selected: readonly string[], id: string, anchor: string | null, range: boolean): string[] {
  if (range && anchor && order.includes(anchor)) {
    const [from, to] = [order.indexOf(anchor), order.indexOf(id)].sort((a, b) => a - b);
    return Array.from(new Set([...selected, ...order.slice(from, (to ?? from) + 1)]));
  }
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Lo que el aviso previo a aprobar dice, una frase por cosa que queda fuera o pide atención. */
export function approvalWarnings(photos: PhotoApproval): string[] {
  const lines: string[] = [];
  if (photos.unassigned) lines.push(`${plural(photos.unassigned, "foto quedará sin aplicar porque no tiene", "fotos quedarán sin aplicar porque no tienen")} pieza.`);
  if (photos.duplicates_pending) lines.push(`${plural(photos.duplicates_pending, "foto ya está", "fotos ya están")} en su pieza y no se aplicará salvo que la confirme.`);
  if (photos.collections_pending) lines.push(`${plural(photos.collections_pending, "carpeta tiene", "carpetas tienen")} la colección propuesta sin confirmar.`);
  if (photos.partial_codes) lines.push(`${plural(photos.partial_codes, "propuesta tiene", "propuestas tienen")} un código que no existe.`);
  if (photos.out_of_range) lines.push(`${plural(photos.out_of_range, "propuesta cae", "propuestas caen")} fuera del rango de su carpeta.`);
  if (photos.uploading) lines.push(`${plural(photos.uploading, "foto todavía se sube", "fotos todavía se suben")} o verifica.`);
  return lines;
}

export function approvalSentence(photos: PhotoApproval): string {
  return `Se aplicarán ${plural(photos.to_apply, "foto", "fotos")} a ${plural(photos.pieces, "pieza", "piezas")}, a continuación de las que ya tienen.`;
}

// ---------------------------------------------------------------------------------------------
// Maqueta en memoria (modo mock)
// ---------------------------------------------------------------------------------------------

const MOCK_BATCH = "mock-photo-batch";
const MOCK_PIECES: PieceOption[] = [
  { id: "mock-abc-1", label: "Toro de Pucará sintético", codes: "ABC 1 · PUCP 1234", collection: "Colección ABC sintética" },
  { id: "mock-abc-53", label: "Retablo sintético", codes: "ABC 53", collection: "Colección ABC sintética" },
  { id: "mock-abc-59", label: "Mate burilado sintético", codes: "ABC 59", collection: "Colección ABC sintética" },
  { id: "mock-i-0236", label: "Manta sintética", codes: "I-0236", collection: "Colección ABC sintética" },
];

interface MockState {
  photos: BatchPhoto[];
  rules: Record<string, ReadingRule>;
}

function mockPhoto(id: string, path: string, overrides: Partial<BatchPhoto> = {}): BatchPhoto {
  return {
    id,
    relative_path: path,
    original_filename: path.split("/").pop() ?? path,
    size_bytes: 120_000,
    status: "VERIFIED",
    rejection_reason: null,
    match_status: "UNMATCHED",
    match_source: null,
    row_id: null,
    candidate_row_ids: null,
    sort_key: null,
    piece_id: null,
    candidate_piece_ids: null,
    match_reason: null,
    width_px: 1200,
    height_px: 900,
    same_as_photo_id: null,
    duplicate_of_existing: false,
    duplicate_confirmed: false,
    thumbnail_url: null,
    ...overrides,
  };
}

function freshMock(): MockState {
  return {
    rules: {},
    photos: [
      mockPhoto("m1", "Fotos Coleccion ABC/ABC 001 - PUCP 1234 (1).JPG", { match_status: "MATCHED", match_source: "FILENAME", piece_id: "mock-abc-1", sort_key: 1 }),
      mockPhoto("m2", "Fotos Coleccion ABC/ABC 001 - PUCP 1234 (2).JPG", { match_status: "MATCHED", match_source: "FILENAME", piece_id: "mock-abc-1", sort_key: 2 }),
      mockPhoto("m3", "Fotos Coleccion ABC/ABC 002 - PUCP 1299.JPG", { match_status: "AMBIGUOUS", match_source: "FILENAME", candidate_piece_ids: ["mock-abc-1", "mock-abc-53"], match_reason: "discrepant_codes" }),
      mockPhoto("m4", "FOTOS 051-114/053-3269.jpg", { match_reason: "camera_name" }),
      mockPhoto("m5", "FOTOS 051-114/059-3225 x.jpg", { match_reason: "camera_name" }),
      mockPhoto("m6", "ALTAS/82LF4169 copy.jpg", { match_reason: "camera_name", width_px: 2400, height_px: 1800 }),
    ],
  };
}

let mock: MockState = freshMock();

/** Vuelve la maqueta a su estado inicial (pruebas). */
export function resetPhotoBatchMock(): void {
  mock = freshMock();
}

function mockFolders(): PhotoFolders {
  const paths = new Set<string>();
  for (const photo of mock.photos) {
    const parts = photo.relative_path.split("/").slice(0, -1);
    parts.forEach((_, depth) => paths.add(parts.slice(0, depth + 1).join("/")));
  }
  const folders = [...paths].sort().map((path): PhotoFolder => {
    const inside = mock.photos.filter((photo) => photo.relative_path.startsWith(`${path}/`));
    const counts: Record<string, number> = {};
    for (const photo of inside) counts[photo.match_status ?? "NONE"] = (counts[photo.match_status ?? "NONE"] ?? 0) + 1;
    const rule = mock.rules[path] ?? { mode: "auto" };
    const isRange = /\d+\s*-\s*\d+$/.test(path);
    const abc = path.includes("ABC") || isRange ? { id: "mock-col-abc", name: "Colección ABC sintética" } : null;
    return {
      path,
      name: path.split("/").pop() ?? path,
      depth: path.split("/").length - 1,
      photos: inside.length,
      by_match_status: counts,
      range: path === "FOTOS 051-114" ? [51, 114] : null,
      proposed_collection: path.includes("ABC") ? abc : null,
      collection: rule.collection_id ? abc : path.includes("ABC") ? abc : null,
      collection_pending: path.includes("ABC") && !mock.rules[path],
      rule,
      rule_from: mock.rules[path] ? path : null,
      suggestion: path === "FOTOS 051-114" ? { shape: "999-9999", template: "{n}-{*}", matching: 2, total: 2 } : null,
    };
  });
  return { batch_id: MOCK_BATCH, default_rule: { mode: "auto" }, folders };
}

function mockRead(folder: string, rule: ReadingRule): { photo: BatchPhoto; codes: string[]; piece: string | null; reason: string | null }[] {
  return mock.photos
    .filter((photo) => !folder || photo.relative_path.startsWith(`${folder}/`))
    .map((photo) => {
      const name = photo.original_filename.replace(/\.[^.]+$/, "");
      if (rule.mode === "camera") return { photo, codes: [], piece: null, reason: "camera_name" };
      if (rule.mode === "template" && rule.template?.startsWith("{n}")) {
        const match = /^(\d+)/.exec(name);
        if (!match) return { photo, codes: [], piece: null, reason: "template_mismatch" };
        const piece = MOCK_PIECES.find((item) => item.codes === `ABC ${Number(match[1])}`);
        return { photo, codes: [`n: ${match[1]}`], piece: piece?.id ?? null, reason: piece ? null : "template_mismatch" };
      }
      return { photo, codes: [], piece: photo.piece_id ?? null, reason: photo.match_reason ?? null };
    });
}

// ---------------------------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------------------------

/** `POST /imports/photo-batches`: el lote de solo fotos, con el nombre que le da la persona. */
export async function createPhotoBatch(name: string, devUser?: string): Promise<ImportResult<ImportBatch>> {
  if (isMock()) {
    resetPhotoBatchMock();
    return { status: "ok", value: { id: MOCK_BATCH, kind: "PHOTOS", file_name: name, source_name: name, status: "IN_PREVIEW" } as ImportBatch };
  }
  return call(() => client(devUser).POST("/api/v1/imports/photo-batches", { body: { name: name.trim() } }), PHOTO_BATCH_MESSAGES);
}

export async function fetchPhotoFolders(batchId: string, devUser?: string): Promise<ImportResult<PhotoFolders>> {
  if (isMock()) return { status: "ok", value: mockFolders() };
  return call(() => client(devUser).GET("/api/v1/imports/{batch_id}/photos/folders", { params: { path: { batch_id: batchId } } }), PHOTO_BATCH_MESSAGES);
}

export async function previewReading(batchId: string, folder: string, rule: ReadingRule, devUser?: string): Promise<ImportResult<ReadingPreview>> {
  if (isMock()) {
    const read = mockRead(folder, rule);
    return {
      status: "ok",
      value: {
        folder,
        total: read.length,
        not_fitting: read.filter((item) => item.reason === "template_mismatch").length,
        items: read.slice(0, 20).map(({ photo, codes, piece, reason }) => ({
          photo_id: photo.id,
          relative_path: photo.relative_path,
          codes,
          match_status: piece ? "MATCHED" : "UNMATCHED",
          piece_id: piece,
          candidate_piece_ids: [],
          match_reason: reason,
        })),
      },
    };
  }
  return call(
    () => client(devUser).POST("/api/v1/imports/{batch_id}/photos/reading-preview", { params: { path: { batch_id: batchId } }, body: { folder, rule } }),
    PHOTO_BATCH_MESSAGES,
  );
}

export async function saveReading(batchId: string, folder: string, rule: ReadingRule, devUser?: string): Promise<ImportResult<PhotoFolders>> {
  if (isMock()) {
    mock.rules[folder] = rule;
    for (const { photo, piece, reason } of mockRead(folder, rule)) {
      if (photo.match_status === "MANUAL" || photo.status === "DISCARDED") continue;
      Object.assign(photo, { piece_id: piece, match_status: piece ? "MATCHED" : "UNMATCHED", match_source: piece ? "TEMPLATE" : null, match_reason: reason });
    }
    return { status: "ok", value: mockFolders() };
  }
  return call(
    () => client(devUser).PUT("/api/v1/imports/{batch_id}/photos/reading", { params: { path: { batch_id: batchId } }, body: { folder, rule } }),
    PHOTO_BATCH_MESSAGES,
  );
}

export async function uploadCorrespondences(batchId: string, file: Blob, fileName: string, devUser?: string): Promise<ImportResult<Correspondences>> {
  if (isMock()) return { status: "ok", value: { batch_id: MOCK_BATCH, applied: 0, no_photo: 0, no_piece: 0, ambiguous: 0, lines: [] } };
  return call(
    () =>
      client(devUser).POST("/api/v1/imports/{batch_id}/photos/correspondences", {
        params: { path: { batch_id: batchId } },
        body: { file: fileName },
        bodySerializer: () => {
          const form = new FormData();
          form.append("file", file, fileName);
          return form;
        },
      }),
    PHOTO_BATCH_MESSAGES,
  );
}

export interface PhotoFilter {
  folder?: string | null;
  matchStatus?: BatchPhoto["match_status"];
  status?: BatchPhoto["status"];
  pieceId?: string | null;
}

/** Páginas de 100 que la cuadrícula lee como máximo (5 000 fotos por lote, IMPORT_MAX_PHOTOS). */
const MAX_PAGES = 50;

/** Fotos del lote con sus filtros, todas las páginas, en el orden de la bandeja. */
export async function fetchBatchPhotos(batchId: string, filter: PhotoFilter = {}, devUser?: string): Promise<ImportResult<BatchPhoto[]>> {
  if (isMock()) {
    return {
      status: "ok",
      value: mock.photos.filter(
        (photo) =>
          (!filter.folder || photo.relative_path.startsWith(`${filter.folder}/`)) &&
          (!filter.matchStatus || photo.match_status === filter.matchStatus) &&
          (!filter.status || photo.status === filter.status) &&
          (!filter.pieceId || photo.piece_id === filter.pieceId),
      ),
    };
  }
  const photos: BatchPhoto[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await call(
      () =>
        client(devUser).GET("/api/v1/imports/{batch_id}/photos", {
          params: {
            path: { batch_id: batchId },
            query: {
              page,
              limit: 100,
              folder: filter.folder ?? undefined,
              match_status: filter.matchStatus ?? undefined,
              status: filter.status ?? undefined,
              piece_id: filter.pieceId ?? undefined,
            },
          },
        }),
      PHOTO_BATCH_MESSAGES,
    );
    if (result.status !== "ok") return result;
    photos.push(...result.value.items);
    if (page * result.value.page_size >= result.value.total) break;
  }
  return { status: "ok", value: photos };
}

/** `PATCH /imports/{batch_id}/photos`: una decisión de la persona sobre varias fotos (D8). */
export async function decidePhotos(batchId: string, op: PhotoOperation, photoIds: string[], pieceId: string | null = null, devUser?: string): Promise<ImportResult<BatchPhoto[]>> {
  if (isMock()) {
    const chosen = mock.photos.filter((photo) => photoIds.includes(photo.id));
    chosen.forEach((photo, position) => {
      if (op === "assign") Object.assign(photo, { piece_id: pieceId, match_status: "MANUAL", match_source: "MANUAL", match_reason: null, candidate_piece_ids: null, sort_key: position + 1 });
      if (op === "unassign") Object.assign(photo, { piece_id: null, match_status: "MANUAL", match_source: "MANUAL", match_reason: null, sort_key: null });
      if (op === "discard") Object.assign(photo, { status: "DISCARDED", piece_id: null, match_status: "MANUAL" });
      if (op === "restore") Object.assign(photo, { status: "VERIFIED", piece_id: null, match_status: "MANUAL" });
      if (op === "confirm_duplicate") Object.assign(photo, { duplicate_confirmed: true });
    });
    return { status: "ok", value: chosen };
  }
  const result = await call(
    () =>
      client(devUser).PATCH("/api/v1/imports/{batch_id}/photos", {
        params: { path: { batch_id: batchId } },
        body: { op, photo_ids: photoIds, piece_id: pieceId },
      }),
    PHOTO_BATCH_MESSAGES,
  );
  return result.status === "ok" ? { status: "ok", value: result.value.photos } : result;
}

/** Piezas por código o denominación, con `GET /search` (no hay otro buscador, diseño D8). */
export async function searchPieces(text: string, devUser?: string): Promise<ImportResult<PieceOption[]>> {
  const q = text.trim();
  if (q.length < 2) return { status: "ok", value: [] };
  if (isMock()) {
    const needle = q.toLowerCase();
    return { status: "ok", value: MOCK_PIECES.filter((piece) => `${piece.label} ${piece.codes}`.toLowerCase().includes(needle)) };
  }
  const result = await call(() => client(devUser).GET("/api/v1/search", { params: { query: { q, page: 1, limit: 10 } } }), PHOTO_BATCH_MESSAGES);
  if (result.status !== "ok") return result;
  return {
    status: "ok",
    value: result.value.items.map((hit) => ({
      id: hit.piece.id,
      label: hit.piece.denomination,
      codes: hit.piece.codes.map((code) => code.normalized_value ?? code.original_value).join(" · "),
      collection: hit.piece.collection?.name ?? null,
    })),
  };
}

/** Pieza por id, para mostrar la propuesta: en mock, la de la maqueta. */
export function mockPiece(id: string | null | undefined): PieceOption | null {
  return MOCK_PIECES.find((piece) => piece.id === id) ?? null;
}
