/**
 * Reparto de los errores y avisos de `POST /pieces/validate` entre los campos del formulario
 * (change `ficha-pieza-crud`, tarea 4.3). Solo decide **dónde** se muestra cada mensaje; el
 * contenido y la gravedad (`severity`) los decide siempre el servidor (ADR-015).
 */
import type { PieceIssue } from "@/lib/data/pieces";

import type { PieceFormValues } from "./piece-form";

export type PieceFormField = keyof PieceFormValues;

export const ALL_FORM_FIELDS: readonly PieceFormField[] = [
  "denomination",
  "tenure_regime",
  "code_i",
  "description",
  "provenance",
  "dimensions_text",
  "notes",
];

/**
 * Campo del formulario al que apunta el `field` de una incidencia, o `null` si no corresponde a
 * ninguno. Se toma el primer segmento de la ruta (`code_i`, `period.year_from` → `period`,
 * `identifiers[0].value` → `identifiers`) y solo se acepta si es un campo del formulario.
 */
export function formFieldFor(serverField: string): PieceFormField | null {
  const root = serverField.trim().split(/[.[]/)[0] ?? "";
  return (ALL_FORM_FIELDS as readonly string[]).includes(root) ? (root as PieceFormField) : null;
}

export interface GroupedIssues {
  byField: Partial<Record<PieceFormField, PieceIssue[]>>;
  /** Incidencias sin campo propio en pantalla: se listan en el resumen general. */
  general: PieceIssue[];
}

/**
 * Agrupa las incidencias por campo. Las que apuntan a un campo que no se muestra en este
 * formulario (p. ej. `code_i` al editar, donde el código I no se edita) o a ningún campo van a
 * `general`, para que ningún mensaje del servidor se pierda.
 */
export function groupIssuesByField(issues: readonly PieceIssue[], visibleFields: readonly PieceFormField[] = ALL_FORM_FIELDS): GroupedIssues {
  const grouped: GroupedIssues = { byField: {}, general: [] };
  for (const issue of issues) {
    const field = formFieldFor(issue.field);
    if (field && visibleFields.includes(field)) {
      (grouped.byField[field] ??= []).push(issue);
    } else {
      grouped.general.push(issue);
    }
  }
  return grouped;
}

/** Mensajes de un campo separados por gravedad: los errores bloquean guardar, los avisos no. */
export function fieldMessages(grouped: GroupedIssues, field: PieceFormField): { errors: string[]; warnings: string[] } {
  const own = grouped.byField[field] ?? [];
  return {
    errors: own.filter((issue) => issue.severity === "error").map((issue) => issue.message),
    warnings: own.filter((issue) => issue.severity !== "error").map((issue) => issue.message),
  };
}
