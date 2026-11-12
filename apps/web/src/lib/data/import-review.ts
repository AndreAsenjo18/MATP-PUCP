/**
 * Datos de la pantalla de revisión del asistente de importación (change
 * `importacion-revision-simplificada`): resumen que suma el total, errores repetidos agrupados y
 * el formato como causa probable. Funciones puras, sin React ni red, para probarlas directamente.
 *
 * Tarea 1.1: la API ya entrega lo necesario sin cambiar el contrato. `counts` del lote trae las
 * filas por clasificación (`NEW`, `UPDATE`, `POSSIBLE_DUPLICATE`, `CONFLICT`, que suman el total
 * porque toda fila tiene una) y `ERRORS` (filas con error, que se solapa con las anteriores).
 * El listado de diferencias combina `classification` y `only_errors`, de modo que recorrer las
 * filas con error (`scanErrorRows`) da cuántas de cada clasificación tienen error y qué error.
 */
import type { MappingTemplate } from "@/lib/data/import-templates";
import { needsResolution, type ImportRow, type RowClassification } from "@/lib/data/imports";

/** Filas iguales a partir de las cuales un error se muestra una sola vez [SUPUESTO]. */
export const REPEATED_ERROR_MIN_ROWS = 3;

/** Proporción de filas afectadas desde la que se culpa al formato [SUPUESTO]. */
export const FORMAT_CAUSE_RATIO = 0.8;

export interface RowError {
  code: string;
  message: string;
}

/** Lo mínimo de una fila con error que necesitan el resumen y los grupos. */
export interface ErrorRow {
  id: string;
  rowNumber: number;
  classification: RowClassification | null;
  decision: string;
  errors: RowError[];
}

export function toErrorRow(row: ImportRow): ErrorRow {
  const errors = row.validation_errors.flatMap((error): RowError[] => {
    if (typeof error !== "object" || error === null || Array.isArray(error)) return [];
    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message.trim() : "";
    return message ? [{ code: typeof record.code === "string" ? record.code : "", message }] : [];
  });
  return { id: row.id, rowNumber: row.source_row_number, classification: row.classification ?? null, decision: row.decision, errors };
}

export interface ReviewSummary {
  total: number;
  /** Filas con error: cada fila se cuenta aquí y en ninguna otra situación. */
  errors: number;
  conflicts: number;
  duplicates: number;
  updates: number;
  news: number;
}

const SITUATIONS: { key: RowClassification; field: "conflicts" | "duplicates" | "updates" | "news" }[] = [
  { key: "CONFLICT", field: "conflicts" },
  { key: "POSSIBLE_DUPLICATE", field: "duplicates" },
  { key: "UPDATE", field: "updates" },
  { key: "NEW", field: "news" },
];

/**
 * Cuenta cada fila una sola vez, con prioridad: errores → conflictos → posibles duplicados →
 * actualizaciones → nuevas. `null` si todavía no se puede calcular con exactitud (hay filas con
 * error y aún no se leyeron): nunca se muestran cifras aproximadas.
 */
export function reviewSummary(counts: Record<string, number> | null | undefined, errorRows: readonly ErrorRow[] | null): ReviewSummary | null {
  const errors = counts?.ERRORS ?? 0;
  if (errors > 0 && (errorRows === null || errorRows.length !== errors)) return null;
  const summary: ReviewSummary = { total: counts?.rows ?? 0, errors, conflicts: 0, duplicates: 0, updates: 0, news: 0 };
  for (const { key, field } of SITUATIONS) {
    const withError = (errorRows ?? []).filter((row) => row.classification === key).length;
    summary[field] = Math.max(0, (counts?.[key] ?? 0) - withError);
  }
  return summary;
}

/** Filas con error que siguen sin decidir, y conflictos o posibles duplicados sin resolver (según `counts`). */
export function pendingWork(summary: ReviewSummary | null, errorRows: readonly ErrorRow[] | null): { errors: number; conflicts: number } {
  const errors = (errorRows ?? []).filter((row) => row.decision === "PENDING").length;
  return { errors, conflicts: summary ? summary.conflicts + summary.duplicates : 0 };
}

/** Qué falta para poder aprobar, en una frase. */
export function approvalSentence(summary: ReviewSummary | null, pending: { errors: number; conflicts: number }): string {
  if (!summary) return "Calculando el resumen…";
  if (summary.total === 0) return "El archivo no trajo filas: no hay nada que aprobar.";
  const parts = [
    pending.errors > 0 && `${pending.errors.toLocaleString("es-PE")} ${pending.errors === 1 ? "fila con error sin decidir" : "filas con error sin decidir"}`,
    pending.conflicts > 0 && `${pending.conflicts.toLocaleString("es-PE")} ${pending.conflicts === 1 ? "fila por resolver" : "filas por resolver"} (conflictos o posibles duplicados)`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return "No hay nada pendiente: puede aprobar la carga.";
  return `Falta decidir: ${parts.join(" y ")}. Lo que no se decida no se importa.`;
}

export interface ErrorGroup {
  key: string;
  code: string;
  message: string;
  rowIds: string[];
  rowNumbers: number[];
  /** Filas del grupo que todavía no tienen una decisión. */
  undecided: number;
}

/** Agrupa las filas por código y texto de error; solo devuelve los grupos de `min` filas o más. */
export function groupRepeatedErrors(rows: readonly ErrorRow[], min: number = REPEATED_ERROR_MIN_ROWS): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const error of row.errors) {
      const key = `${error.code}|${error.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key) ?? { key, code: error.code, message: error.message, rowIds: [], rowNumbers: [], undecided: 0 };
      group.rowIds.push(row.id);
      group.rowNumbers.push(row.rowNumber);
      if (row.decision === "PENDING") group.undecided += 1;
      groups.set(key, group);
    }
  }
  return [...groups.values()].filter((group) => group.rowIds.length >= min).sort((a, b) => b.rowIds.length - a.rowIds.length);
}

/** Una fila se compacta si todos sus errores están agrupados y no hay una decisión que tomar sobre ella. */
export function isCompactRow(row: Pick<ImportRow, "classification" | "validation_errors">, groups: readonly ErrorGroup[]): boolean {
  if (needsResolution(row)) return false;
  const errors = toErrorRow(row as ImportRow).errors;
  if (errors.length === 0) return false;
  const grouped = new Set(groups.map((group) => group.key));
  return errors.every((error) => grouped.has(`${error.code}|${error.message}`));
}

/** Campo del mapeo que cada error de «falta el dato» necesita. */
export const FIELD_BY_ERROR: Record<string, { field: string; label: string }> = {
  tenure_required: { field: "tenure_regime", label: "régimen de tenencia" },
  title_required: { field: "denomination", label: "denominación" },
};

export interface FormatCause {
  formatName: string;
  columnLabel: string;
}

/**
 * El formato es la causa probable si el error es de un dato que falta, el formato aplicado no trae
 * esa columna ni un valor por defecto, y el grupo abarca el 80 % o más de las filas del lote.
 */
export function formatCause(group: Pick<ErrorGroup, "code" | "rowIds">, template: MappingTemplate | null, totalRows: number): FormatCause | null {
  const needed = FIELD_BY_ERROR[group.code];
  if (!needed || !template || totalRows <= 0) return null;
  if (group.rowIds.length / totalRows < FORMAT_CAUSE_RATIO) return null;
  const hasColumn = template.columns.some((column) => column.target_field === needed.field);
  const hasDefault = Boolean((template.defaults as Record<string, unknown> | null | undefined)?.[needed.field]);
  if (hasColumn || hasDefault) return null;
  return { formatName: template.name, columnLabel: needed.label };
}

export function formatCauseSentence(cause: FormatCause): string {
  return `El formato «${cause.formatName}» no trae la columna de ${cause.columnLabel}.`;
}
