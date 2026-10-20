/**
 * Formulario de pieza (change `ficha-pieza-crud`, tarea 4.2; ADR-015).
 *
 * Zod valida aquí **solo formato y tipos locales** (campo vacío, valor del desplegable). Las
 * reglas de negocio (código I duplicado, transiciones de régimen, rango de época…) las ejecuta
 * el servidor mediante `validatePiece`; no se duplican en este archivo.
 *
 * ADR-015 adopta `react-hook-form` y `zod` sin `@hookform/resolvers`, por eso el resolver que
 * conecta ambos es el pequeño adaptador `pieceFormResolver`.
 *
 * Cobertura de design D8 (secciones del editor → campos de `PieceCreate`/`PieceUpdate` que la
 * persona escribe y que la ficha muestra):
 * - Identificación: `denomination`, `tenure_regime` (solo en el alta), `code_i` (solo en el alta),
 *   `collection_id`, `category_id`, `object_type_term_id`, `availability_term_id`, y — solo con
 *   régimen Comodato — `lender_name` y `loan_agreement_ref` (sensibles, RF-041).
 * - Descripción: `description`, `author`.
 * - Procedencia y época: `provenance`, `period_text` (= `period.text`), `acquisition_method_term_id`,
 *   `entry_date`.
 * - Medidas y materiales: `dimensions_text`, `material_term_ids`.
 * - Conservación: `conservation_state_id`.
 * - Observaciones: `notes`.
 *
 * Fuera del formulario: `legal_owner` (no está en el contrato de escritura: lo fija el servidor
 * según el régimen, RN-006), `recorded_by`, `temporary_inventory_number`, `parent_piece_id`,
 * `dimensions[]`, `identifiers` (otros flujos o derivados) y los datos de fotos, ubicación,
 * alertas y auditoría (otros changes).
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
  /** Id de la colección; cadena vacía = pieza suelta (sin colección). */
  collection_id: z.string(),
  /** Id de la categoría (vocabulario CATEGORY); cadena vacía = sin registrar. */
  category_id: z.string(),
  /** Id del término de OBJECT_TYPE; cadena vacía = sin registrar. */
  object_type_term_id: z.string(),
  /** Id del término de AVAILABILITY; cadena vacía = sin registrar. */
  availability_term_id: z.string(),
  /** Comodante (solo se envía con régimen Comodato; dato sensible, RF-041). */
  lender_name: z.string(),
  /** Convenio de comodato (solo se envía con régimen Comodato; dato sensible, RF-041). */
  loan_agreement_ref: z.string(),
  description: z.string(),
  author: z.string(),
  provenance: z.string(),
  /** Texto original de la época (`period.text`). El rango de años lo valida el servidor. */
  period_text: z.string(),
  /** Id del término de ACQUISITION_METHOD; cadena vacía = sin registrar. */
  acquisition_method_term_id: z.string(),
  /** Fecha de ingreso en formato AAAA-MM-DD; cadena vacía = sin registrar. */
  entry_date: z.string(),
  dimensions_text: z.string(),
  /** Ids de los términos del vocabulario MATERIAL. */
  material_term_ids: z.array(z.string()),
  /** Id del término del vocabulario CONSERVATION_STATUS; cadena vacía = sin registrar. */
  conservation_state_id: z.string(),
  notes: z.string(),
});

export type PieceFormValues = z.infer<typeof pieceFormSchema>;

export const EMPTY_PIECE_FORM: PieceFormValues = {
  denomination: "",
  tenure_regime: "Propiedad",
  code_i: "",
  collection_id: "",
  category_id: "",
  object_type_term_id: "",
  availability_term_id: "",
  lender_name: "",
  loan_agreement_ref: "",
  description: "",
  author: "",
  provenance: "",
  period_text: "",
  acquisition_method_term_id: "",
  entry_date: "",
  dimensions_text: "",
  material_term_ids: [],
  conservation_state_id: "",
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
    collection_id: piece.collection?.id ?? "",
    category_id: piece.category?.id ?? "",
    object_type_term_id: piece.object_type?.id ?? "",
    availability_term_id: piece.availability?.id ?? "",
    lender_name: piece.lender_name ?? "",
    loan_agreement_ref: piece.loan_agreement_ref ?? "",
    description: piece.description ?? "",
    author: piece.author ?? "",
    provenance: piece.provenance ?? "",
    period_text: piece.period.text ?? "",
    acquisition_method_term_id: piece.acquisition_method?.id ?? "",
    entry_date: piece.entry_date ?? "",
    dimensions_text: piece.dimensions_text ?? "",
    material_term_ids: piece.materials.map((material) => material.id),
    conservation_state_id: piece.conservation_status?.id ?? "",
    notes: piece.notes ?? "",
  };
}

/** Los datos del comodato solo se capturan (y se envían) cuando el régimen es Comodato. */
function lenderFields(values: PieceFormValues, maskedFields: readonly string[] = []): { lender_name?: string | null; loan_agreement_ref?: string | null } {
  if (values.tenure_regime !== "Comodato") return {};
  return {
    ...(maskedFields.includes("lender_name") ? {} : { lender_name: blankToNull(values.lender_name) }),
    ...(maskedFields.includes("loan_agreement_ref") ? {} : { loan_agreement_ref: blankToNull(values.loan_agreement_ref) }),
  };
}

/** Cuerpo de `POST /pieces` y de `POST /pieces/validate`. */
export function toCreateInput(values: PieceFormValues): PieceCreateInput {
  const periodText = blankToNull(values.period_text);
  return {
    denomination: values.denomination.trim(),
    tenure_regime: values.tenure_regime,
    code_i: blankToNull(values.code_i),
    collection_id: blankToNull(values.collection_id),
    category_id: blankToNull(values.category_id),
    object_type_term_id: blankToNull(values.object_type_term_id),
    availability_term_id: blankToNull(values.availability_term_id),
    ...lenderFields(values),
    description: blankToNull(values.description),
    author: blankToNull(values.author),
    provenance: blankToNull(values.provenance),
    period: periodText === null ? null : { text: periodText },
    acquisition_method_term_id: blankToNull(values.acquisition_method_term_id),
    entry_date: blankToNull(values.entry_date),
    dimensions_text: blankToNull(values.dimensions_text),
    material_term_ids: values.material_term_ids.length > 0 ? values.material_term_ids : null,
    conservation_state_id: blankToNull(values.conservation_state_id),
    notes: blankToNull(values.notes),
  };
}

/**
 * Cuerpo de `PUT /pieces/{id}`: solo los campos del editor (sin código I ni régimen).
 *
 * `basePeriod` es la época de la ficha tal como se abrió: el editor solo cambia el texto, así que
 * el tipo y el rango de años que ya tenga la ficha se reenvían sin tocar (el `PUT` es un merge
 * parcial y un objeto `period` incompleto podría vaciarlos).
 *
 * `maskedFields` (`PieceDetail.masked_fields`): un dato restringido para el rol llega como `null`
 * y no se reenvía, para no vaciarlo sin querer.
 */
export function toUpdateInput(
  values: PieceFormValues,
  basePeriod?: ApiSchemas["PieceDetail"]["period"],
  maskedFields: readonly string[] = [],
): PieceUpdateInput {
  return {
    denomination: values.denomination.trim(),
    collection_id: blankToNull(values.collection_id),
    category_id: blankToNull(values.category_id),
    object_type_term_id: blankToNull(values.object_type_term_id),
    availability_term_id: blankToNull(values.availability_term_id),
    ...lenderFields(values, maskedFields),
    description: blankToNull(values.description),
    author: blankToNull(values.author),
    provenance: blankToNull(values.provenance),
    period: { ...basePeriod, text: blankToNull(values.period_text) },
    acquisition_method_term_id: blankToNull(values.acquisition_method_term_id),
    entry_date: blankToNull(values.entry_date),
    dimensions_text: blankToNull(values.dimensions_text),
    material_term_ids: values.material_term_ids,
    conservation_state_id: blankToNull(values.conservation_state_id),
    notes: blankToNull(values.notes),
  };
}
