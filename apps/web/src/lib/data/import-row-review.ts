/**
 * Revisión de filas compacta con Gemini (change `importacion-revision-filas-compacta`; RF-025,
 * RF-026, RIA-02, RN-009).
 *
 * Reglas puras (ADR-012): el código que identifica cada fila en la lista, qué opina Gemini de las
 * candidatas de una fila, qué opción se preselecciona con esa opinión y cuál es la siguiente fila por
 * decidir. Una opinión solo preselecciona: la fila se decide cuando la persona la acepta.
 */
import { candidatePieces, isResolved, needsResolution, type ImportRow, type ImportRowVerdict } from "./imports";

export type GeminiVerdict = "same" | "distinct" | "unsure";

export interface GeminiOpinion {
  verdict: GeminiVerdict;
  /** La pieza que Gemini cree que es la misma, si la hay. */
  pieceId: string | null;
  reason: string;
  confidence: number;
  /** Lo que se preselecciona en el panel: una pieza, «es nueva» o nada. */
  pick: string | "new" | null;
}

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

/**
 * Qué opina Gemini de las candidatas de una fila (D3). Con confianza suficiente: «misma pieza» marca
 * esa pieza; «distintas» con todas sus candidatas marca «es una pieza nueva». Si duda, o cree que se
 * parece a más de una, no marca nada.
 */
export function geminiOpinion(row: Pick<ImportRow, "id" | "matches">, verdicts: readonly ImportRowVerdict[], minConfidence: number): GeminiOpinion | null {
  const mine = verdicts.filter((item) => item.row_id === row.id);
  if (mine.length === 0) return null;
  const sure = (item: ImportRowVerdict) => item.confidence >= minConfidence && item.source !== "review";
  const same = mine.filter((item) => item.verdict === "same" && sure(item)).sort((a, b) => b.confidence - a.confidence);
  if (same.length === 1) {
    const [best] = same;
    return { verdict: "same", pieceId: best.piece_id, reason: best.reason, confidence: best.confidence, pick: best.piece_id };
  }
  const candidates = candidatePieces(row).map((candidate) => candidate.pieceId);
  const distinct = mine.filter((item) => item.verdict === "distinct" && sure(item));
  const allDistinct = same.length === 0 && distinct.length > 0 && candidates.every((id) => distinct.some((item) => item.piece_id === id));
  if (allDistinct) {
    const best = [...distinct].sort((a, b) => b.confidence - a.confidence)[0];
    return { verdict: "distinct", pieceId: null, reason: best.reason, confidence: best.confidence, pick: "new" };
  }
  const shown = [...mine].sort((a, b) => b.confidence - a.confidence)[0];
  return {
    verdict: "unsure",
    pieceId: null,
    reason: same.length > 1 ? "Gemini cree que la fila se parece a más de una pieza: elija usted." : shown.reason,
    confidence: shown.confidence,
    pick: null,
  };
}

export const OPINION_LABELS: Record<GeminiVerdict, string> = {
  same: "Gemini: misma pieza",
  distinct: "Gemini: pieza distinta",
  unsure: "Gemini: no está seguro",
};

/** El título del recuadro de Gemini en el panel. */
export function opinionTitle(opinion: GeminiOpinion, pieceLabel: string | null): string {
  if (opinion.verdict === "same") return pieceLabel ? `Es la misma pieza que «${pieceLabel}»` : "Es la misma pieza que una del catálogo";
  if (opinion.verdict === "distinct") return "Es una pieza distinta";
  return "No está seguro";
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
