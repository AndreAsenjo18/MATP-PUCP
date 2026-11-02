/**
 * Copiar datos a un alta nueva (change `crud-manual-completo`, design D4; RF-006, RF-043, RN-001).
 *
 * Todo ocurre en el cliente y la copia nunca pasa por la URL, porque puede llevar datos sensibles como
 * el comodante. No se copian códigos, fotos, movimientos, evaluaciones, valorizaciones ni piezas hijas:
 * solo los campos que nombran las listas de aquí abajo. La pieza nueva recibe su propio identificador
 * interno al guardarse.
 */
import type { ApiSchemas } from "@/lib/api/client";
import type { DestinationOption } from "@/lib/data/locations";
import { fetchPieceCatalogs, type PieceFormCatalogs } from "@/lib/data/pieces";

import { EMPTY_PIECE_FORM, toFormValues, type PieceFormValues } from "./piece-form";
import type { PieceFormField } from "./piece-issues";

/** Lo que suele repetirse entre piezas de un mismo ingreso, como las de una donación. */
const REPEATABLE_FIELDS = ["tenure_regime", "collection_id", "acquisition_method_term_id", "entry_date", "recorded_by", "initial_location_id"] as const satisfies readonly PieceFormField[];

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
  /** Lo que se dejó vacío porque ya no se ofrece, con el aviso que va junto al campo. */
  dropped: Partial<Record<PieceFormField, string>>;
  /** No se pudieron cargar las listas para comprobarlo: lo revisará el servidor al guardar. */
  unchecked: boolean;
}

function hasValue(value: PieceFormValues[PieceFormField]): boolean {
  return value.length > 0;
}

function copyFields(from: PieceFormValues, source: string, names: readonly PieceFormField[]): PieceCopy {
  const picked = Object.fromEntries(names.map((name) => [name, from[name]]));
  return { source, values: { ...EMPTY_PIECE_FORM, ...picked }, fields: names.filter((name) => hasValue(from[name])), dropped: {}, unchecked: false };
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
 * restringido llega vacío y no se copia. La ubicación solo se copia si el rol la ve exacta.
 */
export function similarPieceCopy(piece: ApiSchemas["PieceDetail"]): PieceCopy {
  const from = { ...toFormValues(piece), initial_location_id: piece.location.is_exact ? (piece.location.path.at(-1)?.id ?? "") : "" };
  return copyFields(from, `«${piece.denomination}»`, withLoanFields(from, DESCRIPTIVE_FIELDS));
}

/** Cada lista de un solo valor que se copia, y qué decir si lo copiado ya no está en ella. */
const COPIED_CHOICES = [
  { field: "collection_id", options: "collections", notice: "Aviso: la colección copiada fue retirada o desactivada. Elija otra o deje la pieza sin colección." },
  { field: "category_id", options: "categories", notice: "Aviso: la categoría copiada ya no se ofrece. Elija otra." },
  { field: "object_type_term_id", options: "objectTypes", notice: "Aviso: el tipo de bien copiado ya no se ofrece. Elija otro." },
  { field: "acquisition_method_term_id", options: "acquisitionMethods", notice: "Aviso: la forma de adquisición copiada ya no se ofrece. Elija otra." },
] as const;

/**
 * Vacía lo copiado que se retiró o desactivó entre una pieza y la siguiente, y lo dice. Sin
 * `destinations` no se ofrece la ubicación inicial, así que la copiada se quita sin aviso.
 */
export function revalidateCopy(copy: PieceCopy, catalogs: PieceFormCatalogs, destinations: readonly Pick<DestinationOption, "id">[] | null = null): PieceCopy {
  const values = { ...copy.values };
  const dropped: PieceCopy["dropped"] = {};
  for (const { field, options, notice } of COPIED_CHOICES) {
    if (values[field] && !catalogs[options].some((option) => option.id === values[field])) {
      values[field] = "";
      dropped[field] = notice;
    }
  }
  const materials = values.material_term_ids.filter((id) => catalogs.materials.some((option) => option.id === id));
  if (materials.length < values.material_term_ids.length) {
    values.material_term_ids = materials;
    dropped.material_term_ids = "Aviso: se quitaron materiales copiados que ya no se ofrecen.";
  }
  if (values.initial_location_id && !destinations?.some((option) => option.id === values.initial_location_id)) {
    values.initial_location_id = "";
    if (destinations) dropped.initial_location_id = "Aviso: la ubicación copiada ya no se ofrece como destino. Elija otra o déjela vacía.";
  }
  return { ...copy, values, dropped, fields: copy.fields.filter((field) => hasValue(values[field])) };
}

export interface PreparedCopy {
  copy: PieceCopy;
  /** Las listas ya cargadas al comprobar, para no pedirlas otra vez. */
  catalogs?: PieceFormCatalogs;
}

/** Comprueba la colección y los términos copiados antes de mostrar el formulario (design D4). */
export async function prepareCopy(copy: PieceCopy, destinations: readonly Pick<DestinationOption, "id">[] | null = null): Promise<PreparedCopy> {
  const result = await fetchPieceCatalogs();
  if (result.status !== "ok") return { copy: { ...copy, unchecked: true } };
  return { copy: revalidateCopy(copy, result.catalogs, destinations), catalogs: result.catalogs };
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
