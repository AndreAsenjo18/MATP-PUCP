/**
 * Copiar datos a un alta nueva (change `crud-manual-completo`, design D4; RF-006, RF-043, RN-001).
 *
 * Todo ocurre en el cliente y la copia nunca pasa por la URL, porque puede llevar datos sensibles como
 * el comodante. No se copian códigos, fotos, movimientos, evaluaciones, valorizaciones ni piezas hijas:
 * solo los campos que nombran las listas de aquí abajo. La pieza nueva recibe su propio identificador
 * interno al guardarse.
 */
import type { ApiSchemas } from "@/lib/api/client";

import { EMPTY_PIECE_FORM, toFormValues, type PieceFormValues } from "./piece-form";
import type { PieceFormField } from "./piece-issues";

/** Lo que suele repetirse entre piezas de un mismo ingreso, como las de una donación. */
const REPEATABLE_FIELDS = ["tenure_regime", "collection_id", "acquisition_method_term_id", "entry_date", "recorded_by"] as const satisfies readonly PieceFormField[];

/** Solo tienen sentido con régimen Comodato. */
const LOAN_FIELDS = ["lender_name", "loan_agreement_ref"] as const satisfies readonly PieceFormField[];

/**
 * Lo repetible más lo que describe a la pieza. Quedan fuera la disponibilidad y el estado de
 * conservación, que dicen cómo está esa pieza en concreto. D4 nombra también las técnicas, pero la
 * ficha aún no las escribe.
 */
const DESCRIPTIVE_FIELDS = [
  ...REPEATABLE_FIELDS,
  "denomination",
  "category_id",
  "object_type_term_id",
  "description",
  "author",
  "provenance",
  "period_text",
  "dimensions_text",
  "material_term_ids",
  "notes",
] as const satisfies readonly PieceFormField[];

export interface PieceCopy {
  /** De dónde salen los datos, para el aviso: «Datos copiados de …». */
  source: string;
  values: PieceFormValues;
  /** Campos que llegaron con dato: se resaltan hasta que la persona los toca. */
  fields: readonly PieceFormField[];
}

function hasValue(value: PieceFormValues[PieceFormField]): boolean {
  return value.length > 0;
}

function copyFields(from: PieceFormValues, source: string, names: readonly PieceFormField[]): PieceCopy {
  const picked = Object.fromEntries(names.map((name) => [name, from[name]]));
  return { source, values: { ...EMPTY_PIECE_FORM, ...picked }, fields: names.filter((name) => hasValue(from[name])) };
}

function withLoanFields(from: PieceFormValues, names: readonly PieceFormField[]): readonly PieceFormField[] {
  return from.tenure_regime === "Comodato" ? [...names, ...LOAN_FIELDS] : names;
}

/** «Guardar y registrar otra»: los datos repetibles de la pieza recién guardada; lo demás, vacío. */
export function repeatableCopy(saved: PieceFormValues): PieceCopy {
  return copyFields(saved, "la pieza anterior", withLoanFields(saved, REPEATABLE_FIELDS));
}

/**
 * «Registrar a partir de esta pieza»: parte de la ficha tal como la ve el rol, así que un dato
 * restringido llega vacío y no se copia.
 */
export function similarPieceCopy(piece: ApiSchemas["PieceDetail"]): PieceCopy {
  const from = toFormValues(piece);
  return copyFields(from, `«${piece.denomination}»`, withLoanFields(from, DESCRIPTIVE_FIELDS));
}

/**
 * La copia que espera el alta. Vive en la memoria de la pestaña: no pasa por la URL ni por el
 * almacenamiento del navegador, y se pierde al recargar.
 */
let pendingCopy: PieceCopy | null = null;

export function offerPieceCopy(copy: PieceCopy): void {
  pendingCopy = copy;
}

export function pendingPieceCopy(): PieceCopy | null {
  return pendingCopy;
}

export function clearPieceCopy(): void {
  pendingCopy = null;
}
