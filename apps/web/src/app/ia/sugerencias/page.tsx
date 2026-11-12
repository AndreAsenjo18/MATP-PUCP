"use client";

/**
 * Las antiguas sugerencias de IA llevan a su pestaña de la bandeja «Revisar pendientes», con todos
 * los parámetros de la dirección, incluido `?resaltar=` (change `revisar-pendientes-unificado`,
 * tarea 4.2; mismo patrón que `app/deposito/page.tsx`). La cola vive en
 * `components/domain/AiSuggestionsQueue` y la bandeja exige la sesión y el permiso.
 */
import { redirect, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { LEGACY_PENDING_ROUTES, legacyPendingTarget } from "@/lib/data/pending";

function RedirectToPending(): null {
  redirect(legacyPendingTarget(LEGACY_PENDING_ROUTES["/ia/sugerencias"], useSearchParams()));
}

export default function SugerenciasIaPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToPending />
    </Suspense>
  );
}
