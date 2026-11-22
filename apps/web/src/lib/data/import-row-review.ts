/**
 * Revisión de filas compacta (change `importacion-revision-filas-compacta`; RF-025, RF-026).
 *
 * Reglas puras (ADR-012): el código que identifica cada fila en la lista y cuál es la siguiente fila
 * por decidir. La opinión de Gemini sobre las filas se retiró con la cola de duplicados (change
 * `retirar-cola-duplicados`): una fila con el código de una pieza ya es actualización o conflicto.
 */
import { isResolved, needsResolution, type ImportRow } from "./imports";

/** El primer código de la fila tal como se leyó (el de colección o el I), para reconocerla. */
export function rowCode(row: Pick<ImportRow, "mapped_data">): string | null {
  const data = row.mapped_data as { identifiers?: { type?: string; original_value?: string | null; normalized_value?: string | null }[] } | null;
  const identifiers = data?.identifiers ?? [];
  const preferred = identifiers.find((item) => item.type === "COLECCION") ?? identifiers.find((item) => item.type === "I") ?? identifiers[0];
  return preferred ? (preferred.normalized_value ?? preferred.original_value ?? null) : null;
}

/** La fila todavía pide elegir a qué pieza corresponde. */
export function toDecide(row: Pick<ImportRow, "classification" | "resolution" | "decision">): boolean {
  return needsResolution(row) && !isResolved(row) && row.decision === "PENDING";
}

/** La siguiente fila por decidir después de `currentId`, dando la vuelta; `null` si no queda ninguna. */
export function nextToDecide<T extends Pick<ImportRow, "id" | "classification" | "resolution" | "decision">>(rows: readonly T[], currentId: string, decided: ReadonlySet<string> = new Set()): T | null {
  const start = rows.findIndex((row) => row.id === currentId);
  for (let step = 1; step <= rows.length; step += 1) {
    const row = rows[(start + step + rows.length) % rows.length];
    if (row.id !== currentId && !decided.has(row.id) && toDecide(row)) return row;
  }
  return null;
}
