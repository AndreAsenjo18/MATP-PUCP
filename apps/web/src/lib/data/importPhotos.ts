/**
 * Fotografías del lote de importación (change `importacion-masiva-fotografias`, tarea 6.1; spec
 * importacion-datos, «Fotografías del lote con subida reanudable»; diseño D2 y D8).
 *
 * El navegador lista la carpeta con la ruta relativa de cada archivo, calcula su huella SHA-256 en
 * un Web Worker y sube las fotos por tandas de hasta 100, directo al almacenamiento con las URL
 * prefirmadas que entrega la API (`POST /imports/{batch_id}/photos/upload-urls`), cuatro a la vez
 * y con reintentos de espera exponencial. Al terminar cada tanda avisa a la API
 * (`POST .../photos/complete`) y el servidor verifica las fotos en segundo plano.
 *
 * Reanudar es volver a enviar la misma carpeta: el servidor responde `already_registered` para
 * las fotos que ya tiene y una URL nueva para las que faltan, así que nada se sube dos veces.
 *
 * En modo `mock` no hay red: las fotos se dan por subidas tras calcular su huella, para recorrer
 * la pantalla con la maqueta.
 */
import { createApiClient, type ApiSchemas } from "@/lib/api/client";
import { call, type ImportBatch, type ImportResult } from "./imports";
import { apiBaseUrl, getApiMode } from "./mode";

export type PhotoUploadItem = ApiSchemas["PhotoUploadItemOut"];

/** Archivos por llamada a `upload-urls` y `complete` (diseño D2). */
export const PHOTO_BATCH_SIZE = 100;
/** Subidas simultáneas al almacenamiento. */
export const PHOTO_CONCURRENCY = 4;
/** Esperas antes de cada reintento de una subida: 1 s, 2 s y 4 s. */
export const PHOTO_RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
};
const SYSTEM_FILES = new Set(["thumbs.db", "desktop.ini", ".ds_store"]);

/** Estados en los que el lote admite fotos y el panel se muestra (Validación y Previsualización). */
const PHOTO_STATES = new Set<ImportBatch["status"]>(["MAPPED", "VALIDATED", "IN_PREVIEW"]);
/** Un lote de solo fotos no tiene mapeo ni validación (`importacion-fotos-a-catalogo`, D1). */
const PHOTO_BATCH_STATES = new Set<ImportBatch["status"]>(["UPLOADED", "IN_PREVIEW"]);

export function acceptsPhotos(batch: Pick<ImportBatch, "status"> & { kind?: ImportBatch["kind"] }): boolean {
  return (batch.kind === "PHOTOS" ? PHOTO_BATCH_STATES : PHOTO_STATES).has(batch.status);
}

// ---------------------------------------------------------------------------------------------
// Listado de la carpeta
// ---------------------------------------------------------------------------------------------

export interface PhotoFile {
  file: Blob;
  /** Carpeta y nombre tal como los da el navegador (`MMZ 045/DSC_0001.jpg`). */
  relativePath: string;
  contentType: string;
}

export interface IgnoredFiles {
  /** Archivos o carpetas ocultos (empiezan con punto). */
  hidden: number;
  /** Archivos del sistema operativo: `Thumbs.db`, `.DS_Store`, `desktop.ini`. */
  system: number;
  /** Extensiones que no son JPEG, PNG ni TIFF. */
  unsupported: number;
}

export interface FolderListing {
  files: PhotoFile[];
  ignored: IgnoredFiles;
}

export function ignoredTotal(ignored: IgnoredFiles): number {
  return ignored.hidden + ignored.system + ignored.unsupported;
}

/** Separa las fotos de lo que se ignora, contando cada motivo (nada se descarta en silencio). */
export function listPhotoFiles(entries: { file: Blob; relativePath: string }[]): FolderListing {
  const ignored: IgnoredFiles = { hidden: 0, system: 0, unsupported: 0 };
  const files: PhotoFile[] = [];
  for (const { file, relativePath } of entries) {
    const parts = relativePath.split("/");
    const name = parts[parts.length - 1] ?? "";
    if (SYSTEM_FILES.has(name.toLowerCase())) {
      ignored.system += 1;
    } else if (parts.some((part) => part.startsWith("."))) {
      ignored.hidden += 1;
    } else {
      const extension = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
      const contentType = EXTENSION_TYPES[extension];
      if (contentType === undefined) ignored.unsupported += 1;
      else files.push({ file, relativePath, contentType });
    }
  }
  return { files, ignored };
}

/** Archivos de un `<input webkitdirectory>`: cada uno trae su ruta relativa. */
export function entriesFromInput(list: ArrayLike<File>): { file: File; relativePath: string }[] {
  return Array.from(list, (file) => ({ file, relativePath: file.webkitRelativePath || file.name }));
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (success: (file: File) => void, failure: (error: unknown) => void) => void;
  createReader?: () => { readEntries: (success: (entries: FileSystemEntryLike[]) => void, failure: (error: unknown) => void) => void };
}

async function walk(entry: FileSystemEntryLike, out: { file: File; relativePath: string }[]): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
    out.push({ file, relativePath: entry.fullPath.replace(/^\//, "") });
  } else if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    // `readEntries` devuelve las entradas por partes: se llama hasta que no queden.
    for (;;) {
      const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, out);
    }
  }
}

/** Carpetas o archivos soltados en la zona de arrastre (`DataTransferItem.webkitGetAsEntry`). */
export async function entriesFromDrop(items: ArrayLike<{ webkitGetAsEntry?: () => unknown }>): Promise<{ file: File; relativePath: string }[]> {
  const out: { file: File; relativePath: string }[] = [];
  const entries = Array.from(items, (item) => item.webkitGetAsEntry?.() as FileSystemEntryLike | null | undefined);
  for (const entry of entries) if (entry) await walk(entry, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Huella SHA-256
// ---------------------------------------------------------------------------------------------

function toHex(digest: ArrayBuffer): string {
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 en el hilo actual: respaldo donde no hay Web Worker (pruebas, navegadores antiguos). */
export async function sha256Here(file: Blob): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
}

/** Worker en `public/`: JavaScript plano servido desde el mismo origen (la CSP no admite `blob:`). */
export const SHA256_WORKER_URL = "/sha256-worker.js";

let worker: Worker | null | undefined;
let nextRequest = 0;
const pending = new Map<number, { resolve: (hex: string) => void; reject: (error: Error) => void }>();

function hashWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === "undefined" ? null : new Worker(SHA256_WORKER_URL);
  } catch {
    worker = null;
  }
  if (worker) {
    worker.onmessage = (event: MessageEvent<{ id: number; hex?: string; error?: string }>) => {
      const request = pending.get(event.data.id);
      pending.delete(event.data.id);
      if (!request) return;
      if (event.data.hex) request.resolve(event.data.hex);
      else request.reject(new Error(event.data.error ?? "No se pudo calcular la huella."));
    };
    // A worker that does not load (404, CSP) must not leave the hashes waiting: the pending ones
    // and the next ones are computed in this thread.
    worker.onerror = () => {
      worker = null;
      for (const request of pending.values()) request.reject(new Error("worker"));
      pending.clear();
    };
  }
  return worker;
}

/** SHA-256 de un archivo en el Web Worker, o en el hilo actual si no hay worker o falla. */
export async function sha256(file: Blob): Promise<string> {
  const target = hashWorker();
  if (!target) return sha256Here(file);
  const id = ++nextRequest;
  try {
    return await new Promise<string>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      target.postMessage({ id, file });
    });
  } catch {
    return sha256Here(file);
  }
}

// ---------------------------------------------------------------------------------------------
// Subida
// ---------------------------------------------------------------------------------------------

export type PhotoStatus = "pending" | "hashing" | "uploading" | "uploaded" | "registered" | "rejected" | "failed";

export interface PhotoProgress {
  relativePath: string;
  size: number;
  status: PhotoStatus;
  /** Bytes enviados de esta foto. */
  loaded: number;
  photoId?: string;
  sha256?: string;
  reason?: string;
}

export interface UploadSummary {
  uploaded: number;
  registered: number;
  rejected: number;
  failed: number;
}

/** `PUT` de un archivo a su URL prefirmada; avisa los bytes enviados. */
export type PutFile = (
  upload: { url: string; method: string; headers: Record<string, string> },
  file: Blob,
  onProgress: (loaded: number) => void,
) => Promise<void>;

export interface UploadOptions {
  hash?: (file: Blob) => Promise<string>;
  put?: PutFile;
  sleep?: (ms: number) => Promise<void>;
  batchSize?: number;
  concurrency?: number;
}

/** Subida con `XMLHttpRequest`: `fetch` no informa el avance de un envío. */
export const xhrPut: PutFile = (upload, file, onProgress) =>
  new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(upload.method || "PUT", upload.url);
    for (const [name, value] of Object.entries(upload.headers ?? {})) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`HTTP ${request.status}`)));
    request.onerror = () => reject(new Error("Sin conexión con el almacenamiento."));
    request.send(file);
  });

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Estado inicial de cada foto, conservando lo ya sabido de una pasada anterior (reanudar). */
export function initialProgress(files: PhotoFile[], previous: PhotoProgress[] = []): PhotoProgress[] {
  const known = new Map(previous.map((item) => [item.relativePath, item]));
  return files.map((photo) => {
    const before = known.get(photo.relativePath);
    if (before && (before.status === "uploaded" || before.status === "registered" || before.status === "rejected")) return before;
    return { relativePath: photo.relativePath, size: photo.file.size, status: "pending", loaded: 0, sha256: before?.sha256 };
  });
}

async function withRetries(attempt: () => Promise<void>, sleep: (ms: number) => Promise<void>): Promise<void> {
  for (let index = 0; ; index += 1) {
    try {
      return await attempt();
    } catch (error) {
      const delay = PHOTO_RETRY_DELAYS_MS[index];
      if (delay === undefined) throw error;
      await sleep(delay);
    }
  }
}

async function inPool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane));
}

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

/**
 * Sube las fotos del lote por tandas y devuelve cuántas quedaron en cada estado. `onUpdate`
 * recibe el avance completo cada vez que una foto cambia. Si la API rechaza una tanda (lote ya
 * aprobado, tope de fotos) se detiene con ese error y lo pendiente queda para reanudar.
 */
export async function uploadBatchPhotos(
  batchId: string,
  files: PhotoFile[],
  onUpdate: (progress: PhotoProgress[]) => void,
  { previous = [], devUser, options = {} }: { previous?: PhotoProgress[]; devUser?: string; options?: UploadOptions } = {},
): Promise<ImportResult<UploadSummary>> {
  const hash = options.hash ?? sha256;
  const put = options.put ?? xhrPut;
  const sleep = options.sleep ?? wait;
  const progress = initialProgress(files, previous);
  const set = (index: number, change: Partial<PhotoProgress>) => {
    progress[index] = { ...(progress[index] as PhotoProgress), ...change };
    onUpdate([...progress]);
  };
  onUpdate([...progress]);
  const todo = progress.map((item, index) => index).filter((index) => ["pending", "failed", "uploading", "hashing"].includes(progress[index]!.status));
  const live = getApiMode() === "live";

  const size = options.batchSize ?? PHOTO_BATCH_SIZE;
  for (let start = 0; start < todo.length; start += size) {
    const group = todo.slice(start, start + size);
    for (const index of group) {
      if (progress[index]!.sha256) continue;
      set(index, { status: "hashing" });
      set(index, { sha256: await hash(files[index]!.file), status: "pending" });
    }
    if (!live) {
      for (const index of group) set(index, { status: "uploaded", loaded: progress[index]!.size });
      continue;
    }
    const answer = await call(() =>
      client(devUser).POST("/api/v1/imports/{batch_id}/photos/upload-urls", {
        params: { path: { batch_id: batchId } },
        body: {
          files: group.map((index) => ({
            relative_path: files[index]!.relativePath,
            size_bytes: files[index]!.file.size,
            content_type: files[index]!.contentType,
            content_sha256: progress[index]!.sha256!,
          })),
        },
      }),
    );
    if (answer.status !== "ok") return answer;
    const toUpload: { index: number; item: PhotoUploadItem }[] = [];
    answer.value.items.forEach((item, position) => {
      const index = group[position]!;
      if (item.result === "rejected") set(index, { status: "rejected", reason: item.reason ?? undefined });
      else if (item.result === "already_registered") set(index, { status: "registered", photoId: item.photo_id ?? undefined, loaded: progress[index]!.size });
      else toUpload.push({ index, item });
    });
    const uploaded: string[] = [];
    await inPool(toUpload, options.concurrency ?? PHOTO_CONCURRENCY, async ({ index, item }) => {
      set(index, { status: "uploading", loaded: 0, photoId: item.photo_id ?? undefined });
      try {
        await withRetries(
          () =>
            put(
              { url: item.upload_url ?? "", method: item.method ?? "PUT", headers: item.headers ?? {} },
              files[index]!.file,
              (loaded) => set(index, { loaded }),
            ),
          sleep,
        );
        set(index, { status: "uploaded", loaded: progress[index]!.size });
        if (item.photo_id) uploaded.push(item.photo_id);
      } catch (error) {
        set(index, { status: "failed", reason: error instanceof Error ? error.message : String(error) });
      }
    });
    if (uploaded.length > 0) {
      const done = await call(() =>
        client(devUser).POST("/api/v1/imports/{batch_id}/photos/complete", {
          params: { path: { batch_id: batchId } },
          body: { photo_ids: uploaded },
        }),
      );
      if (done.status !== "ok") return done;
    }
  }
  return { status: "ok", value: summarize(progress) };
}

export function summarize(progress: PhotoProgress[]): UploadSummary {
  const count = (status: PhotoStatus) => progress.filter((item) => item.status === status).length;
  return { uploaded: count("uploaded"), registered: count("registered"), rejected: count("rejected"), failed: count("failed") + count("pending") + count("uploading") + count("hashing") };
}

const FINISHED = new Set<PhotoStatus>(["uploaded", "registered", "rejected"]);

/** Avance global en bytes (0 a 100) y fotos terminadas; una foto terminada cuenta entera. */
export function overallProgress(progress: PhotoProgress[]): { percent: number; done: number; total: number } {
  const total = progress.reduce((sum, item) => sum + item.size, 0);
  const loaded = progress.reduce((sum, item) => sum + (FINISHED.has(item.status) ? item.size : Math.min(item.loaded, item.size)), 0);
  const done = progress.filter((item) => FINISHED.has(item.status)).length;
  return { percent: total === 0 ? 0 : Math.round((loaded / total) * 100), done, total: progress.length };
}

/** Hay fotos que reanudar: pendientes, fallidas o interrumpidas a mitad de subida. */
export function canResume(progress: PhotoProgress[]): boolean {
  return progress.some((item) => ["pending", "failed", "uploading", "hashing"].includes(item.status));
}

// ---------------------------------------------------------------------------------------------
// Bandeja: fotos ambiguas o sin emparejar y su asignación a una fila (tareas 4.1 y 4.2, diseño D4)
// ---------------------------------------------------------------------------------------------

export type TrayPhoto = ApiSchemas["ImportPhotoOut"];

/** Fotos que pide revisar la bandeja mínima: las que no tienen una fila propuesta. */
export const TRAY_MATCH_STATUSES = ["AMBIGUOUS", "UNMATCHED"] as const;
/** Páginas de 100 que la bandeja y el índice de filas leen como máximo (lotes de la demo). */
const MAX_PAGES = 20;

export interface TrayRow {
  id: string;
  number: number;
  label: string;
}

/** Fotos ambiguas y sin emparejar del lote, verificadas, con su miniatura firmada. */
export async function fetchTrayPhotos(batchId: string, devUser?: string): Promise<ImportResult<TrayPhoto[]>> {
  const photos: TrayPhoto[] = [];
  for (const matchStatus of TRAY_MATCH_STATUSES) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await call(() =>
        client(devUser).GET("/api/v1/imports/{batch_id}/photos", {
          params: { path: { batch_id: batchId }, query: { match_status: matchStatus, status: "VERIFIED", page, limit: 100 } },
        }),
      );
      if (result.status !== "ok") return result;
      photos.push(...result.value.items);
      if (page * result.value.page_size >= result.value.total) break;
    }
  }
  return { status: "ok", value: photos };
}

/** Número de fila del Excel → fila del lote, para asignar escribiendo el número que ve la persona. */
export async function fetchTrayRows(batchId: string, devUser?: string): Promise<ImportResult<TrayRow[]>> {
  const rows: TrayRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await call(() =>
      client(devUser).GET("/api/v1/imports/{batch_id}/diffs", {
        params: { path: { batch_id: batchId }, query: { page, page_size: 100 } },
      }),
    );
    if (result.status !== "ok") return result;
    for (const row of result.value.items) {
      const fields = (row.mapped_data as { fields?: Record<string, unknown> } | null)?.fields;
      const denomination = typeof fields?.denomination === "string" ? fields.denomination : null;
      rows.push({ id: row.id, number: row.source_row_number, label: denomination ? `Fila ${row.source_row_number}: ${denomination}` : `Fila ${row.source_row_number}` });
    }
    if (page * result.value.page_size >= result.value.total) break;
  }
  return { status: "ok", value: rows };
}

/** `PATCH /imports/{batch_id}/photos` con `assign`: las fotos quedan asignadas a mano a la fila. */
export async function assignPhotos(batchId: string, photoIds: string[], rowId: string, devUser?: string): Promise<ImportResult<TrayPhoto[]>> {
  const result = await call(() =>
    client(devUser).PATCH("/api/v1/imports/{batch_id}/photos", {
      params: { path: { batch_id: batchId } },
      body: { op: "assign", photo_ids: photoIds, row_id: rowId },
    }),
  );
  return result.status === "ok" ? { status: "ok", value: result.value.photos } : result;
}
