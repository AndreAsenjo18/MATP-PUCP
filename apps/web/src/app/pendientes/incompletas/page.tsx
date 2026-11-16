"use client";

/**
 * Pestaña «Piezas incompletas» de la bandeja (change `revisar-pendientes-unificado`, tarea 2.5;
 * rediseñada en `completar-piezas-incompletas`): qué les falta a las piezas, con tarjetas que filtran,
 * y un panel para completarlas sin salir de la lista. Reportes conserva su reporte.
 */
import { IncompleteTriage } from "@/components/domain/IncompleteTriage";
import { PendingTabBody } from "@/components/domain/PendingInbox";
import { useSession } from "@/lib/auth/session";

export default function PendientesIncompletasPage() {
  const { hasPermission, currentUser } = useSession();
  return (
    <PendingTabBody tabKey="incomplete" allowed={hasPermission("reports.view")}>
      <IncompleteTriage
        devUser={currentUser?.email}
        canDownload={hasPermission("exports.run")}
        canEdit={hasPermission("pieces.update")}
        canMove={hasPermission("movements.register")}
        canUpload={hasPermission("media.upload")}
        // Aceptar una propuesta de Gemini es aprobar una salida de la IA (ia-completar-ficha, D6).
        canUseAi={hasPermission("ai.request") && hasPermission("ai.review")}
      />
    </PendingTabBody>
  );
}
