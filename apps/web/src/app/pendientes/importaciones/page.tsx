"use client";

/**
 * Pestaña «Importaciones pendientes» de la bandeja (change `digitalizacion-libro-registros`):
 * lotes listos para que un Gestor de colecciones o un Administrador los revise y apruebe.
 */
import { PendingImports } from "@/components/domain/PendingImports";
import { PendingTabBody } from "@/components/domain/PendingInbox";
import { useSession } from "@/lib/auth/session";

export default function PendientesImportacionesPage() {
  const { hasPermission, currentUser } = useSession();
  return (
    <PendingTabBody tabKey="imports" allowed={hasPermission("imports.approve")}>
      <PendingImports devUser={currentUser?.email} />
    </PendingTabBody>
  );
}
