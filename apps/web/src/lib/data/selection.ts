/**
 * Selección de piezas en los resultados de la búsqueda (change `fusion-busqueda-deposito`, tareas 3.1 y
 * 3.2; RF-016, RF-017): una, varias o toda la página, conservada al cambiar de página. La selección es
 * el lote del depósito: cada pieza guarda lo que la confirmación de «Mover a» muestra aunque ya no esté
 * en la página visible, y la ubicación que se vio, para que la API detecte si alguien la movió antes.
 */
import type { ApiSchemas } from "@/lib/api/client";

import type { BatchMovementRequest, MovementCreateInput } from "./locations";

type SearchHit = ApiSchemas["SearchHit"];

export interface SelectedPiece {
  id: string;
  denomination: string;
  codeI: string | null;
  locationLabel: string | null;
  /** Ubicación exacta que se vio en el resultado (`expected_from_location_id`); null si no se ve. */
  locationId: string | null;
}

export type Selection = ReadonlyMap<string, SelectedPiece>;

export const EMPTY_SELECTION: Selection = new Map();

export function selectedPiece(hit: SearchHit): SelectedPiece {
  const { piece } = hit;
  return {
    id: piece.id,
    denomination: piece.denomination,
    codeI: piece.code_i,
    locationLabel: piece.location_label,
    locationId: hit.location_id ?? null,
  };
}

/** Agrega la pieza si no estaba y la quita si estaba. */
export function toggleSelected(selection: Selection, hit: SearchHit): Selection {
  const next = new Map(selection);
  if (next.has(hit.piece.id)) next.delete(hit.piece.id);
  else next.set(hit.piece.id, selectedPiece(hit));
  return next;
}

/** Marca o desmarca todas las piezas de la página, sin tocar las de otras páginas. */
export function setPageSelected(selection: Selection, hits: readonly SearchHit[], selected: boolean): Selection {
  const next = new Map(selection);
  for (const hit of hits) {
    if (selected) next.set(hit.piece.id, selectedPiece(hit));
    else next.delete(hit.piece.id);
  }
  return next;
}

/** Si la página está elegida entera, en parte o nada. */
export function pageSelectionState(selection: Selection, hits: readonly SearchHit[]): "all" | "some" | "none" {
  const chosen = hits.filter((hit) => selection.has(hit.piece.id)).length;
  if (chosen === 0) return "none";
  return chosen === hits.length ? "all" : "some";
}

/**
 * `POST /movements/batch` para mover la selección, como el lote de la antigua vista de depósito: todo o
 * nada, con la ubicación que se vio de cada pieza.
 */
export function batchMoveRequest(selection: Selection, toLocationId: string, reason: string): BatchMovementRequest {
  return {
    movement_type: "MOVE",
    to_location_id: toLocationId,
    reason: reason.trim() || null,
    items: [...selection.values()].map((piece) => ({ piece_id: piece.id, expected_from_location_id: piece.locationId })),
  };
}

/** La verificación física de una pieza, la misma operación que usaba la vista de depósito. */
export function verificationBody(): MovementCreateInput {
  return { movement_type: "VERIFICATION" };
}
