/**
 * Origen de una importación (change `importacion-elegir-origen`, D1/D2/D7): qué quiere cargar la
 * persona. Vive en la dirección (`?origen=`) para que recargar o compartir el enlace conserve el
 * mismo flujo. Funciones puras, sin React, para probarlas directamente.
 */

/** Solo Excel, o Excel con sus fotografías. «Solo imágenes» tiene su propia ruta. */
export type ImportOrigin = "excel" | "excel-fotos";

export const IMPORT_ORIGIN_PARAM = "origen";

const ORIGINS: readonly ImportOrigin[] = ["excel", "excel-fotos"];

/** Origen válido de la dirección; cualquier otro valor (o ninguno) es `null`. */
export function originFromParams(params: { get(name: string): string | null } | null | undefined): ImportOrigin | null {
  const value = params?.get(IMPORT_ORIGIN_PARAM) ?? null;
  return ORIGINS.find((origin) => origin === value) ?? null;
}

/** Dirección del asistente del Excel, conservando el origen si lo hay (y el lote, si ya existe). */
export function importHref({ origin, batchId }: { origin?: ImportOrigin | null; batchId?: string | null } = {}): string {
  const query = new URLSearchParams();
  if (batchId) query.set("lote", batchId);
  if (origin) query.set(IMPORT_ORIGIN_PARAM, origin);
  const text = query.toString();
  return text ? `/importacion?${text}` : "/importacion";
}

/** Decide qué muestra `/importacion`: la elección de origen o el asistente del Excel. */
export function importScreen(params: { get(name: string): string | null } | null | undefined): "picker" | "wizard" {
  if (params?.get("lote")) return "wizard";
  return originFromParams(params) ? "wizard" : "picker";
}

/** Con `excel` no se muestra el paso de fotos; con `excel-fotos` sí, como parte del recorrido; sin origen, como siempre. */
export function showsPhotoStep(origin: ImportOrigin | null): boolean {
  return origin !== "excel";
}

export const PHOTO_STEP_NOTE = "Ahora las fotos: se emparejan con las filas del Excel.";
