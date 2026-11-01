/**
 * Reglas del asistente de fusión (change `deteccion-duplicados-y-cola-revision`, tarea 4.2; design D4;
 * spec calidad-datos, «Fusión con elección de valores y reasignación de datos relacionados»).
 *
 * Reproducen las reglas con las que la API fusiona (`apps/api/app/modules/quality/merge.py`) para que
 * la persona vea, antes de confirmar, qué valor queda en cada campo, qué pasa a la pieza conservada y
 * qué se queda en la absorbida. No deciden nada por su cuenta: la API vuelve a validar todo y es la
 * única que fusiona.
 *
 * - Bloqueos: una fila de importación no se fusiona; regímenes de tenencia distintos; dos códigos I
 *   vigentes distintos (RN-002). Si solo una pieza tiene código I vigente, esa debe conservarse.
 * - Campos: `field_choices` elige, por campo, el valor de la conservada (`SURVIVING`) o de la
 *   absorbida (`ABSORBED`). Sin elección queda el de la conservada y, si está vacío, el de la
 *   absorbida. Un valor vacío de la absorbida nunca reemplaza al de la conservada.
 */
import type { ApiSchemas } from "@/lib/api/client";

type PieceDetail = ApiSchemas["PieceDetail"];
type DuplicateCandidate = ApiSchemas["DuplicateCandidateOut"];
type IdentifierOut = ApiSchemas["IdentifierOut"];
type TermRef = ApiSchemas["TermRef"];

export type MergeChoice = "SURVIVING" | "ABSORBED";

/** Campos de la ficha cuyo valor se elige al fusionar (`MERGEABLE_FIELDS` de la API). */
export const MERGEABLE_FIELDS = [
  "denomination",
  "description",
  "collection_id",
  "category_id",
  "object_type_term_id",
  "author",
  "provenance",
  "epoch_original_text",
  "epoch_type",
  "epoch_start_year",
  "epoch_end_year",
  "dimensions_text",
  "dimensions",
  "conservation_state_id",
  "acquisition_method_term_id",
  "availability_term_id",
  "entry_date",
  "temporary_inventory_number",
  "recorded_by",
  "lender_name",
  "loan_agreement_ref",
  "notes",
] as const;
export type MergeableField = (typeof MERGEABLE_FIELDS)[number];
export type FieldChoices = Partial<Record<MergeableField, MergeChoice>>;

interface FieldAccess {
  /** Valor comparable, como lo compara la API (ids de términos y colección). */
  read: (piece: PieceDetail) => unknown;
  /** Copia el valor de `from` en el borrador de la ficha resultante. */
  copy: (draft: PieceDetail, from: PieceDetail) => void;
}

function plain<K extends keyof PieceDetail>(key: K): FieldAccess {
  return {
    read: (piece) => piece[key] ?? null,
    copy: (draft, from) => {
      draft[key] = from[key];
    },
  };
}

type RefKey = "collection" | "category" | "object_type" | "conservation_status" | "acquisition_method" | "availability";

function ref(key: RefKey): FieldAccess {
  return {
    read: (piece) => piece[key]?.id ?? null,
    copy: (draft, from) => {
      draft[key] = from[key] as never;
    },
  };
}

function period(key: "text" | "type" | "year_from" | "year_to"): FieldAccess {
  return {
    read: (piece) => piece.period?.[key] ?? null,
    copy: (draft, from) => {
      draft.period = { ...draft.period, [key]: from.period?.[key] ?? null };
    },
  };
}

const FIELDS: Record<MergeableField, FieldAccess> = {
  denomination: plain("denomination"),
  description: plain("description"),
  collection_id: ref("collection"),
  category_id: ref("category"),
  object_type_term_id: ref("object_type"),
  author: plain("author"),
  provenance: plain("provenance"),
  epoch_original_text: period("text"),
  epoch_type: period("type"),
  epoch_start_year: period("year_from"),
  epoch_end_year: period("year_to"),
  dimensions_text: plain("dimensions_text"),
  dimensions: plain("dimensions"),
  conservation_state_id: ref("conservation_status"),
  acquisition_method_term_id: ref("acquisition_method"),
  availability_term_id: ref("availability"),
  entry_date: plain("entry_date"),
  temporary_inventory_number: plain("temporary_inventory_number"),
  recorded_by: plain("recorded_by"),
  lender_name: plain("lender_name"),
  loan_agreement_ref: plain("loan_agreement_ref"),
  notes: plain("notes"),
};

function isEmpty(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && !value.trim());
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** De qué pieza sale el valor de un campo, con la misma regla que la API (design D4, paso 2). */
export function fieldSource(field: MergeableField, surviving: PieceDetail, absorbed: PieceDetail, choice?: MergeChoice): MergeChoice {
  const mine = FIELDS[field].read(surviving);
  const theirs = FIELDS[field].read(absorbed);
  const takeTheirs = choice === "ABSORBED" || (choice === undefined && isEmpty(mine));
  return takeTheirs && !isEmpty(theirs) && !same(mine, theirs) ? "ABSORBED" : "SURVIVING";
}

/** Ficha de la pieza conservada tal como quedará después de fusionar. */
export function mergedSheet(surviving: PieceDetail, absorbed: PieceDetail, choices: FieldChoices): PieceDetail {
  const draft: PieceDetail = { ...surviving, period: { ...surviving.period } };
  for (const field of MERGEABLE_FIELDS) {
    if (fieldSource(field, surviving, absorbed, choices[field]) === "ABSORBED") FIELDS[field].copy(draft, absorbed);
  }
  return draft;
}

// ---------------------------------------------------------------------------------------------
// Filas del asistente: un campo de la ficha o un grupo que se elige junto (época, medidas)
// ---------------------------------------------------------------------------------------------

export const EMPTY_VALUE = "Sin registrar";
export const RESTRICTED_VALUE = "Restringido para su rol";

function text(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : EMPTY_VALUE;
}

export function periodText(value: PieceDetail["period"]): string {
  const years =
    value?.year_from != null || value?.year_to != null
      ? value.year_from === value.year_to
        ? `${value.year_from ?? "?"}`
        : `${value.year_from ?? "?"}–${value.year_to ?? "?"}`
      : null;
  const original = value?.text?.trim() || null;
  if (original && years) return `${original} (${years})`;
  return original ?? years ?? EMPTY_VALUE;
}

export function dimensionsText(piece: Pick<PieceDetail, "dimensions_text" | "dimensions">): string {
  const structured = piece.dimensions?.length ? piece.dimensions.map((d) => `${d.dimension} ${d.value} ${d.unit}`).join(", ") : null;
  const original = piece.dimensions_text?.trim() || null;
  if (original && structured) return `${original} (${structured})`;
  return original ?? structured ?? EMPTY_VALUE;
}

export interface MergeRow {
  key: string;
  label: string;
  fields: readonly MergeableField[];
  display: (piece: PieceDetail) => string;
}

export const MERGE_ROWS: readonly MergeRow[] = [
  { key: "denomination", label: "Denominación", fields: ["denomination"], display: (p) => text(p.denomination) },
  { key: "description", label: "Descripción", fields: ["description"], display: (p) => text(p.description) },
  { key: "collection", label: "Colección", fields: ["collection_id"], display: (p) => p.collection?.name ?? "Sin colección (pieza suelta)" },
  { key: "category", label: "Categoría", fields: ["category_id"], display: (p) => text(p.category?.label) },
  { key: "object_type", label: "Tipo de bien", fields: ["object_type_term_id"], display: (p) => text(p.object_type?.label) },
  { key: "author", label: "Autor", fields: ["author"], display: (p) => text(p.author) },
  { key: "provenance", label: "Procedencia", fields: ["provenance"], display: (p) => text(p.provenance) },
  {
    key: "period",
    label: "Época",
    fields: ["epoch_original_text", "epoch_type", "epoch_start_year", "epoch_end_year"],
    display: (p) => periodText(p.period),
  },
  { key: "dimensions", label: "Medidas", fields: ["dimensions_text", "dimensions"], display: dimensionsText },
  { key: "conservation", label: "Estado de conservación", fields: ["conservation_state_id"], display: (p) => text(p.conservation_status?.label) },
  { key: "acquisition", label: "Forma de adquisición", fields: ["acquisition_method_term_id"], display: (p) => text(p.acquisition_method?.label) },
  { key: "availability", label: "Disponibilidad", fields: ["availability_term_id"], display: (p) => text(p.availability?.label) },
  { key: "entry_date", label: "Fecha de ingreso", fields: ["entry_date"], display: (p) => text(p.entry_date) },
  { key: "temporary_number", label: "Número de inventario temporal", fields: ["temporary_inventory_number"], display: (p) => text(p.temporary_inventory_number) },
  { key: "recorded_by", label: "Registrado por", fields: ["recorded_by"], display: (p) => text(p.recorded_by) },
  { key: "lender", label: "Comodante", fields: ["lender_name"], display: (p) => text(p.lender_name) },
  { key: "loan_agreement", label: "Convenio de comodato", fields: ["loan_agreement_ref"], display: (p) => text(p.loan_agreement_ref) },
  { key: "notes", label: "Observaciones", fields: ["notes"], display: (p) => text(p.notes) },
];

/**
 * - `conflict`: las dos piezas tienen valores distintos: la persona elige.
 * - `fill`: solo la absorbida tiene el valor: completa la conservada.
 * - `same`: iguales, solo en la conservada o vacíos en ambas: no cambia.
 * - `masked`: campo sensible que el rol no ve (RF-041): no se ofrece elegir y rige la regla por defecto.
 */
export type RowState = "conflict" | "fill" | "same" | "masked";

function isMasked(row: MergeRow, piece: PieceDetail): boolean {
  return row.fields.some((field) => piece.masked_fields?.includes(field));
}

export function rowState(row: MergeRow, surviving: PieceDetail, absorbed: PieceDetail): RowState {
  if (isMasked(row, surviving) || isMasked(row, absorbed)) return "masked";
  const values = row.fields.map((field) => [FIELDS[field].read(surviving), FIELDS[field].read(absorbed)] as const);
  if (values.some(([mine, theirs]) => !isEmpty(mine) && !isEmpty(theirs) && !same(mine, theirs))) return "conflict";
  if (values.some(([mine, theirs]) => isEmpty(mine) && !isEmpty(theirs))) return "fill";
  return "same";
}

/** Pieza elegida por la persona en cada fila en conflicto (id de pieza); sin elección, la conservada. */
export type RowPicks = Record<string, string>;

/**
 * `field_choices` del contrato: una elección explícita por cada campo de las filas en conflicto. Un
 * grupo (época, medidas) se elige completo de una sola pieza.
 */
export function fieldChoicesFor(picks: RowPicks, surviving: PieceDetail, absorbed: PieceDetail): FieldChoices {
  const choices: FieldChoices = {};
  for (const row of MERGE_ROWS) {
    if (rowState(row, surviving, absorbed) !== "conflict") continue;
    const choice: MergeChoice = (picks[row.key] ?? surviving.id) === absorbed.id ? "ABSORBED" : "SURVIVING";
    for (const field of row.fields) choices[field] = choice;
  }
  return choices;
}

export interface SheetChange {
  row: MergeRow;
  before: string;
  after: string;
  /** `chosen`: la persona eligió el valor de la absorbida; `filled`: completa un campo vacío. */
  kind: "chosen" | "filled";
}

/** Filas de la ficha conservada que cambian con la fusión. */
export function sheetChanges(surviving: PieceDetail, absorbed: PieceDetail, choices: FieldChoices): SheetChange[] {
  const merged = mergedSheet(surviving, absorbed, choices);
  return MERGE_ROWS.flatMap((row): SheetChange[] => {
    const fromAbsorbed = row.fields.some((field) => fieldSource(field, surviving, absorbed, choices[field]) === "ABSORBED");
    if (!fromAbsorbed) return [];
    const kind = row.fields.some((field) => choices[field] === "ABSORBED") ? "chosen" : "filled";
    return [{ row, before: row.display(surviving), after: row.display(merged), kind }];
  });
}

/** Mensaje si la época resultante quedaría incoherente (la API respondería 422 `invalid_period_range`). */
export function mergedPeriodError(surviving: PieceDetail, absorbed: PieceDetail, choices: FieldChoices): string | null {
  const { year_from: from, year_to: to } = mergedSheet(surviving, absorbed, choices).period ?? {};
  if (from == null || to == null || from <= to) return null;
  return `La época resultante sería incoherente (desde ${from} hasta ${to}): elija la época completa de una sola pieza.`;
}

// ---------------------------------------------------------------------------------------------
// Bloqueos y pieza que se conserva (design D4, paso 1)
// ---------------------------------------------------------------------------------------------

export type MergeBlockCode = "merge_requires_two_pieces" | "merge_blocked_tenure" | "merge_blocked_inventory_code";

export interface MergeBlock {
  code: MergeBlockCode;
  message: string;
}

export const IMPORT_ROW_MERGE_MESSAGE =
  "Una fila de importación no se fusiona desde la cola: se decide en su lote de importación (aceptar, excluir o rechazar).";

/**
 * Bloqueo que impide fusionar el par, o `null`. Con las dos fichas usa sus datos actuales; sin ellas,
 * la marca `blocking_conflict` de la detección.
 */
export function mergeBlock(
  candidate: Pick<DuplicateCandidate, "piece_b_id" | "blocking_conflict">,
  pieceA: Pick<PieceDetail, "tenure_regime" | "code_i"> | null | undefined,
  pieceB: Pick<PieceDetail, "tenure_regime" | "code_i"> | null | undefined,
): MergeBlock | null {
  if (candidate.piece_b_id === null) return { code: "merge_requires_two_pieces", message: IMPORT_ROW_MERGE_MESSAGE };
  if (pieceA && pieceB && pieceA.tenure_regime !== pieceB.tenure_regime) {
    return {
      code: "merge_blocked_tenure",
      message: `Las piezas tienen regímenes de tenencia distintos (${pieceA.tenure_regime} y ${pieceB.tenure_regime}). Primero corrija el régimen de una de ellas desde su ficha.`,
    };
  }
  const codesDiffer = pieceA && pieceB ? Boolean(pieceA.code_i && pieceB.code_i && pieceA.code_i !== pieceB.code_i) : candidate.blocking_conflict;
  if (codesDiffer) {
    const codes = pieceA?.code_i && pieceB?.code_i ? ` (${pieceA.code_i} y ${pieceB.code_i})` : "";
    return {
      code: "merge_blocked_inventory_code",
      message: `Las dos piezas tienen códigos I vigentes distintos${codes}. Un código I nunca cambia de pieza: corrija primero el código I con el procedimiento auditado.`,
    };
  }
  return null;
}

type SurvivorCandidate = Pick<PieceDetail, "id" | "denomination" | "code_i">;

/** Id de la única pieza con código I vigente, que debe conservarse; `null` si no hay obligación. */
export function requiredSurvivorId(pieceA: SurvivorCandidate, pieceB: SurvivorCandidate): string | null {
  if (pieceA.code_i && !pieceB.code_i) return pieceA.id;
  if (pieceB.code_i && !pieceA.code_i) return pieceB.id;
  return null;
}

/** Pieza propuesta como conservada: la única con código I o, si no, la pieza A del par. */
export function defaultSurvivorId(pieceA: SurvivorCandidate, pieceB: SurvivorCandidate): string {
  return requiredSurvivorId(pieceA, pieceB) ?? pieceA.id;
}

/** Motivo por el que una pieza no puede conservarse (solo la otra tiene código I), o `null`. */
export function survivorRestriction(candidateId: string, pieceA: SurvivorCandidate, pieceB: SurvivorCandidate): string | null {
  const required = requiredSurvivorId(pieceA, pieceB);
  if (!required || required === candidateId) return null;
  const holder = required === pieceA.id ? pieceA : pieceB;
  return `Solo «${holder.denomination}» tiene código I vigente (${holder.code_i}): debe conservarse esa pieza, porque un código I nunca cambia de pieza.`;
}

// ---------------------------------------------------------------------------------------------
// Qué pasa a la conservada y qué se queda en la absorbida (design D4, pasos 3 a 5)
// ---------------------------------------------------------------------------------------------

/**
 * - `moves`: pasa a la conservada tal cual.
 * - `moves_not_current`: pasa como no vigente porque repite un código de la conservada.
 * - `stays_inventory_code` / `stays_locked`: se queda en la absorbida (RN-002).
 */
export type IdentifierFate = "moves" | "moves_not_current" | "stays_inventory_code" | "stays_locked";

export const INVENTORY_CODE_TYPE = "I";

export function identifierFates(surviving: PieceDetail, absorbed: PieceDetail): { identifier: IdentifierOut; fate: IdentifierFate }[] {
  const existing = new Set(
    surviving.identifiers.filter((i) => i.normalized_value).map((i) => `${i.identifier_type_code}\u0000${i.normalized_value}`),
  );
  return absorbed.identifiers.map((identifier) => {
    if (identifier.identifier_type_code === INVENTORY_CODE_TYPE) return { identifier, fate: "stays_inventory_code" as const };
    if (identifier.is_locked) return { identifier, fate: "stays_locked" as const };
    const repeated = identifier.normalized_value && existing.has(`${identifier.identifier_type_code}\u0000${identifier.normalized_value}`);
    return { identifier, fate: repeated ? ("moves_not_current" as const) : ("moves" as const) };
  });
}

/** Materiales: la conservada queda con la unión; los repetidos se quedan en la absorbida. */
export function materialFates(surviving: PieceDetail, absorbed: PieceDetail): { moves: TermRef[]; stays: TermRef[] } {
  const terms = new Set(surviving.materials.map((m) => m.id));
  return {
    moves: absorbed.materials.filter((m) => !terms.has(m.id)),
    stays: absorbed.materials.filter((m) => terms.has(m.id)),
  };
}

/** Motivo mínimo que exige la API (`merge_reason_required`). */
export const MERGE_REASON_MIN_LENGTH = 3;
export const MERGE_REASON_REQUIRED = "Indique el motivo de la fusión (al menos 3 caracteres): queda en la auditoría.";

export function mergeReasonError(note: string): string | null {
  return note.trim().length >= MERGE_REASON_MIN_LENGTH ? null : MERGE_REASON_REQUIRED;
}

/** Motivo de la fusión sin el prefijo técnico que añade la baja lógica («Fusionada en <id>: …»). */
export function mergeReasonText(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return reason.replace(/^Fusionada en [0-9a-f-]{36}:\s*/i, "").trim() || null;
}
