"use client";

/**
 * Pestaña «Sugerencias de IA» de la bandeja (change `revisar-pendientes-unificado`, tarea 2.5): la
 * cola de siempre (`AiSuggestionsQueue`, de P4) sin su encabezado; su revisión no cambia (RN-009).
 * En modo conectado avisa a la bandeja al aprobar o rechazar; en demostración el contador sale del
 * almacén y se actualiza solo. `useSearchParams` (para `?resaltar=`) va dentro de `Suspense`: sin él,
 * `next build` falla (tarea 1.1).
 */
import { Suspense } from "react";

import { AiSuggestionsQueue } from "@/components/domain/AiSuggestionsQueue";
import { PendingTabBody, usePendingInbox } from "@/components/domain/PendingInbox";
import { useSession } from "@/lib/auth/session";

export default function PendientesSugerenciasPage() {
  const { hasPermission } = useSession();
  const { refresh } = usePendingInbox();
  return (
    <PendingTabBody tabKey="suggestions" allowed={hasPermission("ai.review")}>
      <Suspense fallback={null}>
        <AiSuggestionsQueue embedded onQueueChanged={refresh} />
      </Suspense>
    </PendingTabBody>
  );
}
