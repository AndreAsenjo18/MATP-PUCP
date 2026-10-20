/**
 * Borrador del formulario de pieza en `sessionStorage` (change `ficha-pieza-crud`, tarea 4.3;
 * ADR-015 punto 5; RNF-012 escenario «Sesión expirada»).
 *
 * Qué se guarda: los campos del formulario, la fecha del guardado y `base`, la marca
 * `updated_at` de la ficha sobre la que se escribió (permite avisar si la ficha cambió después).
 * No se guardan datos de la API ni identificadores de sesión. `sessionStorage` vive solo en la
 * pestaña y se borra al cerrarla; si el navegador lo bloquea, el borrador simplemente no existe.
 */
import { z } from "zod";

import { pieceFormSchema, type PieceFormValues } from "./piece-form";

export const DRAFT_VERSION = 1;
/** Espera (ms) tras el último cambio antes de guardar el borrador mientras se escribe. */
export const DRAFT_SAVE_DELAY_MS = 600;

/**
 * El borrador conserva el texto tal como está escrito: la denominación puede estar vacía. Los campos
 * añadidos después de la primera versión tienen valor por defecto para que un borrador anterior
 * (con los siete campos originales) se siga recuperando.
 */
const draftSchema = z.object({
  v: z.literal(DRAFT_VERSION),
  savedAt: z.string(),
  base: z.string().nullable(),
  values: pieceFormSchema.extend({
    denomination: z.string(),
    collection_id: z.string().default(""),
    category_id: z.string().default(""),
    object_type_term_id: z.string().default(""),
    availability_term_id: z.string().default(""),
    lender_name: z.string().default(""),
    loan_agreement_ref: z.string().default(""),
    author: z.string().default(""),
    period_text: z.string().default(""),
    acquisition_method_term_id: z.string().default(""),
    entry_date: z.string().default(""),
    material_term_ids: z.array(z.string()).default([]),
    conservation_state_id: z.string().default(""),
  }),
});

export interface PieceDraft {
  savedAt: string;
  /** `updated_at` de la ficha al guardar el borrador; `null` en un alta. */
  base: string | null;
  values: PieceFormValues;
}

export type DraftTarget = { kind: "new" } | { kind: "edit"; pieceId: string };
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function draftKey(target: DraftTarget): string {
  return target.kind === "new" ? "matp:borrador-pieza:nueva" : `matp:borrador-pieza:${target.pieceId}`;
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // acceso bloqueado (modo privado, política del navegador)
  }
}

/** Guarda el borrador. Devuelve `false` si no hay almacenamiento o está lleno. */
export function saveDraft(
  key: string,
  values: PieceFormValues,
  base: string | null,
  storage: DraftStorage | null = browserStorage(),
  now: Date = new Date(),
): boolean {
  if (!storage) return false;
  try {
    const draft = { v: DRAFT_VERSION, savedAt: now.toISOString(), base, values };
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Lee el borrador; un contenido corrupto o de otra versión se ignora (y no rompe el formulario). */
export function loadDraft(key: string, storage: DraftStorage | null = browserStorage()): PieceDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const { savedAt, base, values } = parsed.data;
    return { savedAt, base, values };
  } catch {
    return null;
  }
}

export function clearDraft(key: string, storage: DraftStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Sin acceso al almacenamiento no hay nada que borrar.
  }
}

export function sameFormValues(a: PieceFormValues, b: PieceFormValues): boolean {
  return (Object.keys(a) as Array<keyof PieceFormValues>).every((field) => {
    const left = a[field];
    const right = b[field];
    if (Array.isArray(left) && Array.isArray(right)) {
      return left.length === right.length && left.every((item, index) => item === right[index]);
    }
    return left === right;
  });
}
