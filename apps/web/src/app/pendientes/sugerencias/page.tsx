"use client";

/**
 * Pestaña «Sugerencias de IA» de la bandeja (change `revisar-pendientes-unificado`, tarea 2.5). Hasta
 * que P4 confirme la tarea 1.3, enlaza a la pantalla actual conservando sus parámetros; la cola y su
 * revisión no cambian (RN-009). `useSearchParams` va dentro de `Suspense`: sin él, `next build`
 * falla (tarea 1.1).
 */
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PendingTabBody, SuggestionsPlaceholder } from "@/components/domain/PendingInbox";
import { useSession } from "@/lib/auth/session";

function SuggestionsTab() {
  const { hasPermission } = useSession();
  const searchParams = useSearchParams();
  return (
    <PendingTabBody tabKey="suggestions" allowed={hasPermission("ai.review")}>
      <SuggestionsPlaceholder query={searchParams.toString()} />
    </PendingTabBody>
  );
}

export default function PendientesSugerenciasPage() {
  return (
    <Suspense fallback={null}>
      <SuggestionsTab />
    </Suspense>
  );
}
