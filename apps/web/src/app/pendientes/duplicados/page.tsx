"use client";

/**
 * Pestaña «Posibles duplicados» de la bandeja (change `revisar-pendientes-unificado`, tarea 2.5): la
 * cola de siempre, sin su título propio, y con aviso a la bandeja para recalcular los contadores al
 * resolver un par o terminar una detección (design D3).
 */
import { DuplicateQueue } from "@/components/domain/DuplicateQueue";
import { PendingTabBody, usePendingInbox } from "@/components/domain/PendingInbox";
import { useSession } from "@/lib/auth/session";

export default function PendientesDuplicadosPage() {
  const { hasPermission } = useSession();
  const { refresh } = usePendingInbox();
  return (
    <PendingTabBody tabKey="duplicates" allowed={hasPermission("duplicates.resolve")}>
      <DuplicateQueue embedded onQueueChanged={refresh} />
    </PendingTabBody>
  );
}
