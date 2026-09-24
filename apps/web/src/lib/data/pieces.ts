/**
 * Capa de datos de piezas consciente del modo (spec plataforma: "Prototipo navegable en modo
 * simulado"): en modo `mock` responde con los fixtures sintéticos (sin red, sin async real);
 * en modo `live` llama a la API real a través del cliente tipado de `contratos-api-borrador`.
 *
 * Alcance deliberado de esta primera versión: solo lectura de piezas (listado con `q` y ficha
 * por id), porque son las **únicas** operaciones de piezas que `contratos-api-borrador`
 * implementó de verdad (el resto siguen siendo stubs `501`). Las pantallas de esta fase
 * (`app/busqueda`, `app/piezas/[id]`) todavía consumen `lib/fixtures` de forma directa y
 * síncrona porque ya están verificadas en modo mock; conectarlas a este módulo y probarlas
 * contra una API real es un pendiente explícito (requiere Docker/PostgreSQL, ver
 * `docs/estado-arranque.md`). Este módulo existe para que esa conexión sea un cambio pequeño y
 * localizado, no una reescritura de pantalla.
 */
import { apiErrorMessage, createApiClient, isNotImplemented, type ApiSchemas } from "@/lib/api/client";
import { getPieceDetail, listPieces } from "@/lib/fixtures";

import { apiBaseUrl, getApiMode } from "./mode";

type PieceSummary = ApiSchemas["PieceSummary"];
type PieceDetail = ApiSchemas["PieceDetail"];

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface PiecesQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

/** `null` cuando la operación existe pero no hay datos que mostrar (p. ej. detalle no encontrado). */
export type PieceLookupResult = { status: "ok"; piece: PieceDetail } | { status: "not_found" } | { status: "unavailable"; message: string };

function client() {
  return createApiClient({ baseUrl: apiBaseUrl() });
}

export async function fetchPieces(query: PiecesQuery): Promise<Page<PieceSummary>> {
  if (getApiMode() === "mock") {
    const result = listPieces({ q: query.q, page: query.page, pageSize: query.pageSize });
    return { items: result.items, total: result.total, page: result.page, page_size: result.page_size };
  }
  const { data, error } = await client().GET("/api/v1/pieces", {
    params: { query: { q: query.q || undefined, page: query.page, page_size: query.pageSize } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function fetchPieceDetail(id: string): Promise<PieceLookupResult> {
  if (getApiMode() === "mock") {
    const piece = getPieceDetail(id);
    return piece ? { status: "ok", piece } : { status: "not_found" };
  }
  const { data, error } = await client().GET("/api/v1/pieces/{piece_id}", { params: { path: { piece_id: id } } });
  if (error) {
    if (isNotImplemented(error)) return { status: "unavailable", message: apiErrorMessage(error) };
    if ((error as { code?: unknown }).code === "not_found") return { status: "not_found" };
    return { status: "unavailable", message: apiErrorMessage(error) };
  }
  return { status: "ok", piece: data };
}
