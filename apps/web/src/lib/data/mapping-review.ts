/**
 * «Así quedarían las piezas» (change `importacion-mapeo-asistido`; RF-022, RF-023, RNF-010, RN-009).
 *
 * Reglas puras de la vista que comprueba el mapeo por dato del catálogo, no por columna (ADR-012):
 * las filas de la tabla con sus valores de ejemplo, quién propuso cada columna, qué es dudoso,
 * asignar una columna a un dato y qué columnas quedan sin usar. El borrador es el mismo del editor
 * por columna (`EditorDraft`), así que las dos vistas se pueden alternar sin perder cambios.
 */
import { TARGET_OPTIONS } from "./imports";
import { canonicalColumn, setColumnTarget, type ColumnOrigin, type EditorDraft } from "./mapping-editor";

/** Por debajo de esta confianza, una columna que propuso la IA se marca para confirmar [SUPUESTO] (D2). */
export const DOUBT_CONFIDENCE = 0.8;

export interface ReviewField {
  target: string;
  label: string;
  /** Sin este dato no se valida. */
  required?: boolean;
  /** Puede salir de varias columnas (los códigos). */
  multiple?: boolean;
}

/** Los datos que se muestran siempre, en este orden (D1). */
export const REVIEW_FIELDS: readonly ReviewField[] = [
  { target: "identifier:I", label: "Código I", multiple: true },
  { target: "identifier:COLECCION", label: "Código de colección", multiple: true },
  { target: "collection", label: "Colección (sigla)" },
  { target: "denomination", label: "Denominación", required: true },
  { target: "description", label: "Descripción" },
  { target: "terms:MATERIAL", label: "Materiales" },
  { target: "provenance", label: "Procedencia" },
  { target: "epoch_original_text", label: "Época" },
  { target: "dimensions_text", label: "Medidas" },
  { target: "author", label: "Autor" },
  { target: "location", label: "Ubicación" },
  { target: "tenure_regime", label: "Régimen de tenencia" },
  { target: "notes", label: "Observaciones" },
];

const MULTIPLE_PREFIXES = ["identifier"];

export type SampleRow = Record<string, unknown>;

export interface ReviewColumn {
  source: string;
  origin: ColumnOrigin | null;
}

export interface ReviewRow extends ReviewField {
  columns: ReviewColumn[];
  /** Un valor por fila de ejemplo; `null` si la fila no trae nada para este dato. */
  values: (string | null)[];
  /** Motivo de la duda de la IA, si la hay (D2). */
  doubt: string | null;
}

function targetOf(column: Parameters<typeof canonicalColumn>[0]): string | null {
  return canonicalColumn(column).target_field ?? null;
}

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** Etiqueta de un destino que no está entre los datos principales. */
export function targetLabel(target: string, vocabularies: Record<string, string> = {}): string {
  const known = REVIEW_FIELDS.find((field) => field.target === target)?.label ?? TARGET_OPTIONS.find((option) => option.value === target)?.label;
  if (known) return known;
  if (target.startsWith("terms:")) return vocabularies[target.slice(6)] ?? target.slice(6);
  return target;
}

function isMultiple(target: string): boolean {
  return REVIEW_FIELDS.find((field) => field.target === target)?.multiple ?? MULTIPLE_PREFIXES.some((prefix) => target === prefix || target.startsWith(`${prefix}:`));
}

/** Las filas de la tabla: los datos principales y, después, cualquier otro destino ya asignado (D1). */
export function reviewRows(draft: EditorDraft, sampleRows: readonly SampleRow[], vocabularies: Record<string, string> = {}): ReviewRow[] {
  const byTarget = new Map<string, string[]>();
  for (const column of draft.columns) {
    const target = targetOf(column);
    if (target) byTarget.set(target, [...(byTarget.get(target) ?? []), column.source_column]);
  }
  const extras: ReviewField[] = [...byTarget.keys()]
    .filter((target) => !REVIEW_FIELDS.some((field) => field.target === target))
    .map((target) => ({ target, label: targetLabel(target, vocabularies), multiple: isMultiple(target) }));
  return [...REVIEW_FIELDS, ...extras].map((field) => {
    const sources = byTarget.get(field.target) ?? [];
    const columns = sources.map((source) => ({ source, origin: draft.origins?.[source] ?? null }));
    const values = sampleRows.map((row) => {
      const parts = sources.map((source) => cellText(row[source])).filter((text): text is string => text !== null);
      return parts.length > 0 ? parts.join(" · ") : null;
    });
    return { ...field, columns, values, doubt: doubtOf(draft, sources, field.label) };
  });
}

function doubtOf(draft: EditorDraft, sources: readonly string[], label: string): string | null {
  for (const source of sources) {
    const note = draft.aiNotes?.[source];
    if (draft.origins?.[source] !== "ai" || !note || note.confidence >= DOUBT_CONFIDENCE) continue;
    return note.reason ?? `«${source}» no se parece del todo a «${label}»: confírmelo.`;
  }
  return null;
}

/** Cuántos datos tienen columna y cuántos están por confirmar, para el resumen de la vista. */
export function reviewSummary(rows: readonly ReviewRow[]): { found: number; total: number; doubts: number } {
  const main = rows.slice(0, REVIEW_FIELDS.length);
  return { found: main.filter((row) => row.columns.length > 0).length, total: main.length, doubts: rows.filter((row) => row.doubt).length };
}

/**
 * Elegir de qué columna sale un dato (D3). `source = null` = «No usar ninguna columna». Un dato de
 * valor único deja de salir de la columna que lo tenía; los códigos admiten varias columnas. La
 * columna elegida pierde el destino que tuviera antes.
 */
export function assignColumn(draft: EditorDraft, target: string, source: string | null): EditorDraft {
  const multiple = isMultiple(target);
  let next = draft;
  draft.columns.forEach((column, index) => {
    const current = targetOf(column);
    const isChosen = column.source_column === source;
    if (current === target && !isChosen && (!multiple || source === null)) next = setColumnTarget(next, index, "");
  });
  if (source !== null) {
    const index = next.columns.findIndex((column) => column.source_column === source);
    if (index >= 0) next = targetOf(next.columns[index]) === target ? confirmColumn(next, source) : setColumnTarget(next, index, target);
  }
  return next;
}

/** La persona confirma la columna que propuso la IA: deja de estar en duda (D2). */
export function confirmColumn(draft: EditorDraft, source: string): EditorDraft {
  return { ...draft, origins: { ...(draft.origins ?? {}), [source]: "user" } };
}

/** Confirmar un dato: todas sus columnas pasan a ser de la persona. */
export function confirmTarget(draft: EditorDraft, target: string): EditorDraft {
  return draft.columns.filter((column) => targetOf(column) === target).reduce((acc, column) => confirmColumn(acc, column.source_column), draft);
}

/** Columnas del archivo sin destino: quedan en el registro de origen de cada fila. */
export function unusedColumns(draft: EditorDraft): string[] {
  return draft.columns.filter((column) => !targetOf(column)).map((column) => column.source_column);
}

export interface ColumnChoice {
  source: string;
  /** Valores de ejemplo de la columna, para reconocerla. */
  examples: string;
  /** Dato al que va hoy, si va a alguno. */
  current: string | null;
}

/** Las columnas del archivo para el menú de un dato, con sus ejemplos; filtradas por `query`. */
export function columnChoices(draft: EditorDraft, sampleRows: readonly SampleRow[], query = "", vocabularies: Record<string, string> = {}): ColumnChoice[] {
  const wanted = fold(query);
  return draft.columns
    .map((column) => {
      const values = sampleRows.map((row) => cellText(row[column.source_column])).filter((text): text is string => text !== null);
      const target = targetOf(column);
      return {
        source: column.source_column,
        examples: values.length > 0 ? values.join(" · ") : "(vacía en las primeras filas)",
        current: target ? targetLabel(target, vocabularies) : null,
      };
    })
    .filter((choice) => !wanted || fold(choice.source).includes(wanted) || fold(choice.examples).includes(wanted));
}

/** Por qué no se puede validar todavía desde esta vista, o `null`. */
export function reviewBlocker(draft: EditorDraft): string | null {
  const hasDenomination = draft.columns.some((column) => targetOf(column) === "denomination") || Boolean(draft.templateDefaults.denomination);
  return hasDenomination ? null : "Falta indicar de qué columna sale la denominación.";
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
