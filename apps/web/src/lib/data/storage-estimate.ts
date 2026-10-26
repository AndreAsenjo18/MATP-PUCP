/**
 * Estimación del volumen fotográfico para la tarjeta de Reportes (change
 * `fotografias-multiples-por-pieza`, tarea 3.3; spec multimedia, «Operación de estimación del
 * volumen fotográfico»; `importacion-masiva-fotografias` D6).
 *
 * `GET /media/storage-estimate` (permiso `reports.view`) entrega el volumen actual por tipo de
 * archivo, si se conservan los originales, la proyección para las fotos que espera el museo y, con
 * parámetros, una proyección a medida. En modo `mock` se calcula sobre las fotos sintéticas de los
 * fixtures con los mismos supuestos que el servidor.
 */
import { apiErrorMessage, createApiClient, type ApiSchemas } from "@/lib/api/client";
import { getAllPieceMedia } from "@/lib/fixtures";
import { apiBaseUrl, getApiMode } from "./mode";

export type StorageEstimate = ApiSchemas["StorageEstimateResponse"];
export type StorageEstimateResult = { status: "ok"; estimate: StorageEstimate } | { status: "error"; message: string };

/** Parámetros de la proyección a medida; los que faltan toman los promedios reales. */
export interface ProjectionParams {
  pieces?: number;
  photos_per_piece?: number;
  mb_per_photo?: number;
}

/** Proyección para las fotos esperadas (`expected_collection`). */
export interface ExpectedCollection {
  photos: number;
  mb_per_photo: number;
  original_bytes: number;
  display_bytes: number;
  thumb_bytes: number;
  total_bytes: number;
}

/** Proyección a medida (`projection`). */
export interface Projection {
  pieces: number;
  photos_per_piece: number;
  mb_per_photo: number;
  projected_originals_bytes: number;
  projected_derivatives_bytes: number;
  projected_total_bytes: number;
}

const CONNECTION_MESSAGE = "No se pudo calcular la estimación del volumen. Intente nuevamente.";

// Mismos supuestos que el servidor (`app/modules/media/volume.py`), solo para el modo mock.
const MIB = 1024 * 1024;
const DISPLAY_BYTES = 300 * 1024;
const THUMB_BYTES = 20 * 1024;
const EXPECTED_PHOTOS = 25_000;
const DEFAULT_MB_PER_PHOTO = 4;

export function expectedCollection(estimate: StorageEstimate): ExpectedCollection {
  return estimate.expected_collection as unknown as ExpectedCollection;
}

export function projectionOf(estimate: StorageEstimate): Projection | null {
  return (estimate.projection as unknown as Projection | null | undefined) ?? null;
}

/** Bytes en unidades decimales (GB = 10⁹), con el formato numérico de es-PE: «1.2 GB». */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString("es-PE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[unit]}`;
}

function mockEstimate(params: ProjectionParams): StorageEstimate {
  const media = getAllPieceMedia();
  const photos = media.length;
  const pieces = new Set(media.map((asset) => asset.piece_id)).size;
  const originals = media.reduce((total, asset) => total + asset.size_bytes, 0);
  const avgPhotos = pieces ? photos / pieces : null;
  const avgMb = photos ? originals / photos / MIB : null;
  const project = (count: number, mb: number) => ({
    original_bytes: Math.round(count * mb * MIB),
    display_bytes: Math.round(count * DISPLAY_BYTES),
    thumb_bytes: Math.round(count * THUMB_BYTES),
  });
  const expectedMb = avgMb ?? DEFAULT_MB_PER_PHOTO;
  const expected = project(EXPECTED_PHOTOS, expectedMb);
  const wantsProjection = Object.values(params).some((value) => value !== undefined);
  const planned = wantsProjection
    ? project((params.pieces ?? 0) * (params.photos_per_piece ?? avgPhotos ?? 0), params.mb_per_photo ?? avgMb ?? 0)
    : null;
  return {
    current_volume_bytes: originals + photos * (DISPLAY_BYTES + THUMB_BYTES),
    current_originals_bytes: originals,
    current_derivatives_bytes: photos * (DISPLAY_BYTES + THUMB_BYTES),
    avg_photos_per_piece: avgPhotos,
    avg_mb_per_photo: avgMb,
    keeps_originals: true,
    by_file_type: { original_bytes: originals, display_bytes: photos * DISPLAY_BYTES, thumb_bytes: photos * THUMB_BYTES },
    expected_collection: {
      photos: EXPECTED_PHOTOS,
      mb_per_photo: expectedMb,
      ...expected,
      total_bytes: expected.original_bytes + expected.display_bytes + expected.thumb_bytes,
    },
    projection: planned && {
      pieces: params.pieces ?? 0,
      photos_per_piece: params.photos_per_piece ?? avgPhotos ?? 0,
      mb_per_photo: params.mb_per_photo ?? avgMb ?? 0,
      projected_originals_bytes: planned.original_bytes,
      projected_derivatives_bytes: planned.display_bytes + planned.thumb_bytes,
      projected_total_bytes: planned.original_bytes + planned.display_bytes + planned.thumb_bytes,
    },
    quota_bytes: null,
    exceeds_quota: null,
  };
}

export async function fetchStorageEstimate(params: ProjectionParams = {}, devUser?: string): Promise<StorageEstimateResult> {
  if (getApiMode() === "mock") return { status: "ok", estimate: mockEstimate(params) };
  try {
    const client = createApiClient({ baseUrl: apiBaseUrl(), devUser });
    const { data, error } = await client.GET("/api/v1/media/storage-estimate", { params: { query: params } });
    if (error !== undefined || data === undefined) return { status: "error", message: apiErrorMessage(error) };
    return { status: "ok", estimate: data };
  } catch {
    return { status: "error", message: CONNECTION_MESSAGE };
  }
}
