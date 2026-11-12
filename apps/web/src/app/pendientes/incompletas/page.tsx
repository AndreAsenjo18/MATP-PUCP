"use client";

/**
 * Pestaña «Piezas incompletas» de la bandeja (change `revisar-pendientes-unificado`, tarea 2.5): el
 * mismo reporte de Reportes (RF-019, RF-035), sin cambios.
 */
import { IncompleteReportPanel } from "@/components/domain/IncompleteReportPanel";
import { PendingTabBody } from "@/components/domain/PendingInbox";
import { Card } from "@/components/ui/Card";
import { useSession } from "@/lib/auth/session";

export default function PendientesIncompletasPage() {
  const { hasPermission, currentUser } = useSession();
  return (
    <PendingTabBody tabKey="incomplete" allowed={hasPermission("reports.view")}>
      <Card as="section" aria-label="Piezas con información incompleta" className="flex flex-col gap-3">
        <IncompleteReportPanel devUser={currentUser?.email} canDownload={hasPermission("exports.run")} />
      </Card>
    </PendingTabBody>
  );
}
