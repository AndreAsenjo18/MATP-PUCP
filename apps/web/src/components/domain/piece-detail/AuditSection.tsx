"use client";

import { useMemo } from "react";

import { AuditTrailPanel } from "@/components/domain/AuditTrailPanel";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { useSession } from "@/lib/auth/session";
import { toEntryView } from "@/lib/data/audit";
import { useMockStore } from "@/lib/data/mock-store";
import { getApiMode } from "@/lib/data/mode";

/**
 * Pestaña «Auditoría»: historial agrupado por conjunto de cambios y reversión con vista previa
 * (RF-040, RF-041, RNF-007). Los permisos salen de la sesión aquí, no dentro del componente:
 * `pieces.update` para los cambios manuales, `imports.revert` para las cargas y Administrador
 * para el resto (design D1, [SUPUESTO B7]). El servidor los vuelve a comprobar.
 */
export function AuditSection({ pieceId, demoEntries }: { pieceId: string; demoEntries: ReturnType<typeof useMockStore>["auditLog"] }) {
  const { hasPermission, currentRole } = useSession();
  const live = getApiMode() === "live";
  // En modo demostración el historial son las filas del store de la sesión; en `live` las trae la API.
  const entries = useMemo(() => (live ? undefined : demoEntries.map(toEntryView)), [live, demoEntries]);

  if (!hasPermission("audit.read")) {
    return <PermissionNotice>Su rol no tiene permiso para consultar la auditoría.</PermissionNotice>;
  }
  return (
    <AuditTrailPanel
      pieceId={pieceId}
      access={{ hasPermission, isAdmin: currentRole?.code === "ADMIN" }}
      demoEntries={entries}
    />
  );
}
