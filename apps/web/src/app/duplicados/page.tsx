"use client";

/**
 * Pantalla 7 — Cola de posibles duplicados (RF-030, calidad-datos; change
 * `deteccion-duplicados-y-cola-revision`, tareas 4.1 y 4.2). La cola vive en
 * `components/domain/DuplicateQueue` (change `revisar-pendientes-unificado`, tarea 1.2); esta
 * página exige la sesión y el permiso `duplicates.resolve` y la monta igual que antes.
 */
import { DuplicateQueue } from "@/components/domain/DuplicateQueue";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { useSession } from "@/lib/auth/session";

function DuplicadosContent() {
  const { hasPermission } = useSession();
  if (!hasPermission("duplicates.resolve")) {
    return <PermissionNotice>Su rol no tiene permiso para resolver duplicados. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }
  return <DuplicateQueue />;
}

export default function DuplicadosPage() {
  return (
    <RequireSession>
      <DuplicadosContent />
    </RequireSession>
  );
}
