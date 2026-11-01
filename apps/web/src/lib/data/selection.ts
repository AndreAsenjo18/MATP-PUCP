/**
 * Selección de piezas en los resultados de la búsqueda (change `fusion-busqueda-deposito`, tarea 3.1;
 * RF-016, RF-017): una, varias o toda la página, conservada al cambiar de página. La selección es el
 * lote del depósito: cada pieza guarda lo que la confirmación de «Mover a» necesita mostrar aunque ya
 * no esté en la página visible.
 */
import type { ApiSchemas } from "@/lib/api/client";

type PieceSummary = ApiSchemas["PieceSummary"];

export interface SelectedPiece {
  id: string;
  denomination: string;
  codeI: string | null;
  locationLabel: string | null;
}

export type Selection = ReadonlyMap<string, SelectedPiece>;

export const EMPTY_SELECTION: Selection = new Map();

export function selectedPiece(piece: PieceSummary): SelectedPiece {
  return { id: piece.id, denomination: piece.denomination, codeI: piece.code_i, locationLabel: piece.location_label };
}

/** Agrega la pieza si no estaba y la quita si estaba. */
export function toggleSelected(selection: Selection, piece: PieceSummary): Selection {
  const next = new Map(selection);
  if (next.has(piece.id)) next.delete(piece.id);
  else next.set(piece.id, selectedPiece(piece));
  return next;
}

/** Marca o desmarca todas las piezas de la página, sin tocar las de otras páginas. */
export function setPageSelected(selection: Selection, pieces: readonly PieceSummary[], selected: boolean): Selection {
  const next = new Map(selection);
  for (const piece of pieces) {
    if (selected) next.set(piece.id, selectedPiece(piece));
    else next.delete(piece.id);
  }
  return next;
}

/** Si la página está elegida entera, en parte o nada. */
export function pageSelectionState(selection: Selection, pieces: readonly PieceSummary[]): "all" | "some" | "none" {
  const chosen = pieces.filter((piece) => selection.has(piece.id)).length;
  if (chosen === 0) return "none";
  return chosen === pieces.length ? "all" : "some";
}
