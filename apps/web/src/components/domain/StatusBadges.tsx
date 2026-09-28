/**
 * Badges con reglas del museo, construidos sobre `Badge` (docs/system-design.md §3). La intención y
 * el texto de cada estado salen de `status-intents.ts`, así que se ven igual en todas las pantallas.
 */
import { Lock, TriangleAlert } from "lucide-react";

import { Badge, type BadgeIntent } from "@/components/ui/Badge";
import type { ApiSchemas } from "@/lib/api/client";

import { alertStatus, tenureStatus, type StatusStyle } from "./status-intents";

/** Régimen de tenencia (Propia, Comodato, Préstamo temporal). */
export function TenureBadge({ regime }: { regime: ApiSchemas["TenureRegime"] }) {
  const { label, intent } = tenureStatus(regime);
  return <Badge intent={intent}>{label}</Badge>;
}

/** Alerta de completitud de una pieza; no se muestra si no aplica. */
export function AlertBadge({ alert }: { alert: ApiSchemas["PieceAlert"] }) {
  if (!alert.applies) return null;
  const { label, intent } = alertStatus(alert.type);
  return (
    <Badge intent={intent} icon={TriangleAlert} title={alert.message}>
      {label}
    </Badge>
  );
}

/** Código I bloqueado una vez asignado (RN-002), con icono accesible en lugar de emoji. */
export function LockBadge({ label = "Código I bloqueado" }: { label?: string }) {
  return (
    <Badge intent="default" icon={Lock}>
      {label}
    </Badge>
  );
}

export type StatusTone = "pending" | "approved" | "rejected" | "neutral";

const TONE_INTENT: Record<StatusTone, BadgeIntent> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  neutral: "default",
};

/**
 * Estado genérico. Acepta un `StatusStyle` de `status-intents.ts` (`status`) o, por compatibilidad
 * con la maqueta, un `label` con `tone`.
 */
export function StatusBadge(props: { status: StatusStyle } | { label: string; tone: StatusTone }) {
  const { label, intent } = "status" in props ? props.status : { label: props.label, intent: TONE_INTENT[props.tone] ?? "default" };
  return <Badge intent={intent}>{label}</Badge>;
}
