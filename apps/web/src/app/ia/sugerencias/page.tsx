"use client";

/**
 * La dirección antigua de las sugerencias de IA lleva a la bandeja «Revisar pendientes»: la pestaña
 * de sugerencias se retiró (change `retirar-pestana-sugerencias-ia`).
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
