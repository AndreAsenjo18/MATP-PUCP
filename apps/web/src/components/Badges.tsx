import type { ApiSchemas } from "@/lib/api/client";

type TenureRegime = ApiSchemas["TenureRegime"];
type PieceAlert = ApiSchemas["PieceAlert"];

const TENURE_LABELS: Record<TenureRegime, { label: string; className: string }> = {
  OWNED: { label: "Propia", className: "bg-stone-100 text-stone-700" },
  LOAN_FOR_USE: { label: "Comodato", className: "bg-amber-100 text-amber-900" },
  TEMPORARY_LOAN: { label: "Préstamo temporal", className: "bg-sky-100 text-sky-900" },
};

export function TenureBadge({ regime }: { regime: TenureRegime }) {
  const style = TENURE_LABELS[regime];
  return <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${style.className}`}>{style.label}</span>;
}

const ALERT_LABELS: Record<PieceAlert["type"], string> = {
  WITHOUT_INVENTORY_CODE: "Sin código I",
  WITHOUT_PHOTO: "Sin foto",
  WITHOUT_LOCATION: "Sin ubicación",
  MISSING_REQUIRED_FIELDS: "Campos obligatorios incompletos",
  UNPARSEABLE_CODE: "Código no normalizable",
};

export function AlertBadge({ alert }: { alert: PieceAlert }) {
  if (!alert.applies) return null;
  return (
    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-900" title={alert.message}>
      {ALERT_LABELS[alert.type]}
    </span>
  );
}

export function LockBadge({ label = "Código I bloqueado" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-0.5 text-sm font-medium text-stone-800">
      🔒 {label}
    </span>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: "pending" | "approved" | "rejected" | "neutral" }) {
  const styles: Record<typeof tone, string> = {
    pending: "bg-amber-100 text-amber-900",
    approved: "bg-emerald-100 text-emerald-900",
    rejected: "bg-red-100 text-red-900",
    neutral: "bg-stone-100 text-stone-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${styles[tone]}`}>{label}</span>;
}
