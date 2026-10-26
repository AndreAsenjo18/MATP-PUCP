/**
 * Fotografías de una pieza para la galería de la ficha (change `fotografias-multiples-por-pieza`,
 * tarea 3.2; spec multimedia, «Gestión de galería con foto principal única» y «Restricción
 * efectiva heredada»).
 *
 * `GET /pieces/{piece_id}/media` entrega las fotos en orden, con su restricción de uso y dos URL
 * prefirmadas de corta duración: la miniatura (`thumbnail_url`) y la copia de visualización
 * (`download_url`). En modo `mock` se leen los fixtures de la maqueta.
 */
import { apiErrorMessage, createApiClient, type ApiSchemas } from "@/lib/api/client";
import { getPieceMedia } from "@/lib/fixtures";
import { apiBaseUrl, getApiMode } from "./mode";

export type PieceMedia = ApiSchemas["MediaAssetOut"];
export type PieceMediaResult = { status: "ok"; media: PieceMedia[] } | { status: "error"; message: string };

const CONNECTION_MESSAGE = "No se pudieron cargar las fotografías. Intente nuevamente.";

export async function fetchPieceMedia(pieceId: string, devUser?: string): Promise<PieceMediaResult> {
  if (getApiMode() === "mock") return { status: "ok", media: getPieceMedia(pieceId) };
  try {
    const client = createApiClient({ baseUrl: apiBaseUrl(), devUser });
    const { data, error } = await client.GET("/api/v1/pieces/{piece_id}/media", { params: { path: { piece_id: pieceId } } });
    if (error !== undefined || data === undefined) return { status: "error", message: apiErrorMessage(error) };
    return { status: "ok", media: data };
  } catch {
    return { status: "error", message: CONNECTION_MESSAGE };
  }
}

/** La foto que se ve primero: la principal, o la primera si ninguna lo es. */
export function initialPhoto(media: PieceMedia[]): PieceMedia | null {
  return media.find((asset) => asset.is_primary) ?? media[0] ?? null;
}

/** Restricción que se muestra junto a la foto (RN-008); «Sin restricción» no se muestra. */
export function restrictionLabel(asset: Pick<PieceMedia, "usage_restriction" | "restriction_note">): string | null {
  const restriction = asset.usage_restriction;
  if (!restriction || restriction.code === "SIN_RESTRICCION") return null;
  return asset.restriction_note ? `${restriction.label}: ${asset.restriction_note}` : restriction.label;
}
