/**
 * Mapeos puros de los estados del museo a la intención visual de `Badge` y a su texto en español
 * (docs/system-design.md §3, requirement «Representación uniforme de estados de pieza»). Un valor
 * no mapeado (p. ej. un tipo nuevo añadido en la API) se muestra como `default` con texto legible.
 */
import type { BadgeIntent } from "@/components/ui/Badge";
import type { ApiSchemas } from "@/lib/api/client";

export interface StatusStyle {
  label: string;
  intent: BadgeIntent;
}

type TenureRegime = ApiSchemas["TenureRegime"];
type AlertType = ApiSchemas["PieceAlert"]["type"];
type RowClassification = ApiSchemas["RowClassification"];
type RowDecision = ApiSchemas["RowDecision"];
type SuggestionStatus = ApiSchemas["SuggestionStatus"];
type DuplicateStatus = ApiSchemas["DuplicateStatus"];
type AuditAction = ApiSchemas["AuditAction"];

function lookup<K extends string>(table: Record<K, StatusStyle>, value: string | null | undefined, fallbackLabel: string): StatusStyle {
  return (value != null && table[value as K]) || { label: value ? `${fallbackLabel}: ${value}` : fallbackLabel, intent: "default" };
}

const TENURE: Record<TenureRegime, StatusStyle> = {
  OWNED: { label: "Propia", intent: "default" },
  LOAN_FOR_USE: { label: "Comodato", intent: "info" },
  TEMPORARY_LOAN: { label: "Préstamo temporal", intent: "info" },
};

/** Régimen de tenencia: comodato y préstamo temporal siempre `info` (RN-003, RN-004, RN-008). */
export function tenureStatus(regime: TenureRegime | string | null | undefined): StatusStyle {
  return lookup(TENURE, regime, "Tenencia no reconocida");
}

const ALERTS: Record<AlertType, StatusStyle> = {
  WITHOUT_INVENTORY_CODE: { label: "Sin código I", intent: "warning" },
  WITHOUT_PHOTO: { label: "Sin foto", intent: "warning" },
  WITHOUT_LOCATION: { label: "Sin ubicación", intent: "warning" },
  MISSING_REQUIRED_FIELDS: { label: "Campos obligatorios incompletos", intent: "warning" },
  UNPARSEABLE_CODE: { label: "Código no normalizable", intent: "danger" },
};

/** Alertas de completitud: información incompleta `warning`; código no normalizable `danger`. */
export function alertStatus(type: AlertType | string | null | undefined): StatusStyle {
  return lookup(ALERTS, type, "Alerta");
}

const CLASSIFICATION: Record<RowClassification, StatusStyle> = {
  NEW: { label: "Nuevo", intent: "success" },
  UPDATE: { label: "Actualización", intent: "default" },
  POSSIBLE_DUPLICATE: { label: "Posible duplicado", intent: "warning" },
  CONFLICT: { label: "Conflicto", intent: "danger" },
};

export function importClassificationStatus(classification: RowClassification | string | null | undefined): StatusStyle {
  if (classification == null) return { label: "Sin clasificar", intent: "default" };
  return lookup(CLASSIFICATION, classification, "Clasificación");
}

const DECISION: Record<RowDecision, StatusStyle> = {
  PENDING: { label: "Pendiente", intent: "warning" },
  ACCEPTED: { label: "Aceptada", intent: "success" },
  EXCLUDED: { label: "Excluida", intent: "default" },
  REJECTED: { label: "Rechazada", intent: "danger" },
};

export function importDecisionStatus(decision: RowDecision | string | null | undefined): StatusStyle {
  return lookup(DECISION, decision, "Decisión");
}

type ImportBatchStatus = ApiSchemas["ImportBatchStatus"];

const BATCH: Record<ImportBatchStatus, StatusStyle> = {
  UPLOADED: { label: "Archivo subido", intent: "default" },
  FAILED_INGESTION: { label: "Error al leer el archivo", intent: "danger" },
  MAPPED: { label: "Columnas mapeadas", intent: "default" },
  VALIDATED: { label: "Validado", intent: "default" },
  IN_PREVIEW: { label: "En previsualización", intent: "warning" },
  APPROVED: { label: "Aprobado", intent: "success" },
  APPLIED: { label: "Aplicado", intent: "success" },
  FAILED_APPLY: { label: "Error al aplicar", intent: "danger" },
  ABANDONED: { label: "Abandonado", intent: "default" },
  REVERTED: { label: "Revertido", intent: "info" },
};

export function importBatchStatus(status: ImportBatchStatus | string | null | undefined): StatusStyle {
  return lookup(BATCH, status, "Estado");
}

const SUGGESTION: Record<SuggestionStatus, StatusStyle> = {
  PENDING: { label: "Pendiente de revisión", intent: "warning" },
  APPROVED: { label: "Aprobada", intent: "success" },
  PARTIALLY_APPROVED: { label: "Parcialmente aprobada", intent: "success" },
  REJECTED: { label: "Rechazada", intent: "danger" },
};

/** Sugerencias de IA: siempre `warning` hasta la revisión humana (RN-009). */
export function suggestionStatus(status: SuggestionStatus | string | null | undefined): StatusStyle {
  return lookup(SUGGESTION, status, "Estado");
}

const DUPLICATE: Record<DuplicateStatus, StatusStyle> = {
  PENDING: { label: "Pendiente", intent: "warning" },
  MERGED: { label: "Fusionado", intent: "success" },
  DISTINCT: { label: "Distinto", intent: "default" },
  POSTPONED: { label: "Pospuesto", intent: "default" },
};

export function duplicateStatus(status: DuplicateStatus | string | null | undefined): StatusStyle {
  return lookup(DUPLICATE, status, "Estado");
}

const AUDIT: Record<AuditAction, StatusStyle> = {
  CREATE: { label: "Creación", intent: "default" },
  UPDATE: { label: "Modificación", intent: "default" },
  SOFT_DELETE: { label: "Baja lógica", intent: "danger" },
  RESTORE: { label: "Restauración", intent: "success" },
  CORRECTION: { label: "Corrección", intent: "danger" },
  MERGE: { label: "Fusión", intent: "info" },
  REVERT: { label: "Reversión", intent: "info" },
};

export function auditActionStatus(action: AuditAction | string | null | undefined): StatusStyle {
  return lookup(AUDIT, action, "Acción");
}

/** Identificador vigente o histórico (todo código histórico se conserva). */
export function identifierCurrencyStatus(isCurrent: boolean): StatusStyle {
  return isCurrent ? { label: "Vigente", intent: "success" } : { label: "Histórico", intent: "default" };
}
