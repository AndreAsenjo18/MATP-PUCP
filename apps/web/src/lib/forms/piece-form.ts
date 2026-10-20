/**
 * Formulario de pieza (change `ficha-pieza-crud`, tarea 4.2; ADR-015).
 *
 * Zod valida aquí **solo formato y tipos locales** (campo vacío, valor del desplegable). Las
 * reglas de negocio (código I duplicado, transiciones de régimen, rango de época…) las ejecuta
 * el servidor mediante `validatePiece`; no se duplican en este archivo.
 *
 * ADR-015 adopta `react-hook-form` y `zod` sin `@hookform/resolvers`, por eso el resolver que
 * conecta ambos es el pequeño adaptador `pieceFormResolver`.
 */
import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";

import type { ApiSchemas } from "@/lib/api/client";
import type { PieceCreateInput, PieceUpdateInput } from "@/lib/data/pieces";

/** Etiquetas del contrato para `tenure_regime` (ver `TenureRegimeLabel` en la API). */
export const TENURE_REGIMES = ["Propiedad", "Comodato", "Préstamo Temporal"] as const;

export const pieceFormSchema = z.object({
  denomination: z.string().trim().min(1, "La denominación es obligatoria."),
  tenure_regime: z.enum(TENURE_REGIMES),
  code_i: z.string(),
  description: z.string(),
  provenance: z.string(),
  dimensions_text: z.string(),
  notes: z.string(),
});

export type PieceFormValues = z.infer<typeof pieceFormSchema>;

export const EMPTY_PIECE_FORM: PieceFormValues = {
  denomination: "",
  tenure_regime: "Propiedad",
  code_i: "",
  description: "",
  provenance: "",
  dimensions_text: "",
  notes: "",
};

/** Adaptador mínimo Zod → React Hook Form (primer error de cada campo). */
export const pieceFormResolver: Resolver<PieceFormValues> = async (values) => {
  const parsed = pieceFormSchema.safeParse(values);
  if (parsed.success) return { values: parsed.data, errors: {} };
  const errors: FieldErrors<PieceFormValues> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    const key = field as keyof PieceFormValues;
    if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
  }
  return { values: {}, errors };
};

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Valores iniciales del editor a partir de la ficha. El código I no se edita aquí (RN-002). */
export function toFormValues(piece: ApiSchemas["PieceDetail"]): PieceFormValues {
  return {
    denomination: piece.denomination,
    tenure_regime: piece.tenure_regime,
    code_i: "",
    description: piece.description ?? "",
    provenance: piece.provenance ?? "",
    dimensions_text: piece.dimensions_text ?? "",
    notes: piece.notes ?? "",
  };
}

/** Cuerpo de `POST /pieces` y de `POST /pieces/validate`. */
export function toCreateInput(values: PieceFormValues): PieceCreateInput {
  return {
    denomination: values.denomination.trim(),
    tenure_regime: values.tenure_regime,
    code_i: blankToNull(values.code_i),
    description: blankToNull(values.description),
    provenance: blankToNull(values.provenance),
    dimensions_text: blankToNull(values.dimensions_text),
    notes: blankToNull(values.notes),
  };
}

/** Cuerpo de `PUT /pieces/{id}`: solo los campos del editor (sin código I ni régimen). */
export function toUpdateInput(values: PieceFormValues): PieceUpdateInput {
  return {
    denomination: values.denomination.trim(),
    description: blankToNull(values.description),
    provenance: blankToNull(values.provenance),
    dimensions_text: blankToNull(values.dimensions_text),
    notes: blankToNull(values.notes),
  };
}
