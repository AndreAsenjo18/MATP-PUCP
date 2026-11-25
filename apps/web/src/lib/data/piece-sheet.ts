/**
 * Ficha de una pieza y lista de colecciones, con la identidad de la sesión.
 *
 * Vivían en la capa de la cola de duplicados, que se retiró (change `retirar-cola-duplicados`, D3):
 * la ficha y las piezas incompletas las siguen usando. Una pieza fusionada antes responde con
 * `merged_into` en vez de 404, para que su ficha diga a cuál se unió.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";
import { COLLECTIONS, getPieceDetail } from "@/lib/fixtures";

import { plainMessage } from "./imports";
import { apiBaseUrl, getApiMode } from "./mode";

type PieceDetail = ApiSchemas["PieceDetail"];
type CollectionOut = ApiSchemas["CollectionOut"];

export type PieceSheetResult =
  | { status: "ok"; piece: PieceDetail }
  | { status: "not_found" }
  | { status: "rejected"; code: string; message: string }
  | { status: "unavailable"; message: string };

const CONNECTION_MESSAGE = "No se pudo conectar con el servidor. Intente nuevamente.";

function client(devUser: string | undefined) {
  return createApiClient({ baseUrl: apiBaseUrl(), devUser });
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : "error";
}

/** Ficha de una pieza (`GET /pieces/{piece_id}`), incluida una pieza fusionada. */
export async function fetchPieceSheet(pieceId: string, devUser?: string): Promise<PieceSheetResult> {
  if (getApiMode() === "mock") {
    const piece = getPieceDetail(pieceId);
    return piece ? { status: "ok", piece } : { status: "not_found" };
  }
  try {
    const { data, error } = await client(devUser).GET("/api/v1/pieces/{piece_id}", { params: { path: { piece_id: pieceId } } });
    if (error) {
      if (isNotImplemented(error)) return { status: "unavailable", message: plainMessage(apiErrorMessage(error)) };
      const code = errorCode(error);
      if (code === "not_found") return { status: "not_found" };
      return { status: "rejected", code, message: plainMessage(apiErrorMessage(error)) };
    }
    return { status: "ok", piece: data };
  } catch {
    return { status: "unavailable", message: CONNECTION_MESSAGE };
  }
}

/** Colecciones para un filtro (`GET /collections`); vacío si no se pueden leer. */
export async function fetchCollectionOptions(devUser?: string): Promise<CollectionOut[]> {
  if (getApiMode() === "mock") return COLLECTIONS;
  try {
    const { data } = await client(devUser).GET("/api/v1/collections", {});
    return data ?? [];
  } catch {
    return [];
  }
}
