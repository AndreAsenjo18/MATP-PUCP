"use client";

/**
 * La antigua cola de duplicados lleva a su pestaña de la bandeja «Revisar pendientes», con todos los
 * parámetros de la dirección (change `revisar-pendientes-unificado`, tarea 4.2; mismo patrón que
 * `app/deposito/page.tsx`). La bandeja exige la sesión y muestra el aviso si falta el permiso. La
 * página se prerenderiza estática y `useSearchParams` la deja para el navegador, así que la
 * redirección ocurre en el cliente: el servidor responde 200 (tarea 4.2).
 */
import { redirect, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { LEGACY_PENDING_ROUTES, legacyPendingTarget } from "@/lib/data/pending";

function RedirectToPending(): null {
  redirect(legacyPendingTarget(LEGACY_PENDING_ROUTES["/duplicados"], useSearchParams()));
}

export default function DuplicadosPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToPending />
    </Suspense>
  );
}
