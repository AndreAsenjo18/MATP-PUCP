"use client";

/**
 * La antigua vista de depósito lleva a la búsqueda, que ya permite verificar y mover (change
 * `fusion-busqueda-deposito`, tarea 4.1, design D3). Un enlace con el filtro de ubicación lo
 * conserva; en la primera carga Next.js hace la redirección desde el servidor.
 */
import { redirect, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { depositoRedirectTarget } from "@/lib/data/search";

function RedirectToSearch(): null {
  redirect(depositoRedirectTarget(useSearchParams()));
}

export default function DepositoPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToSearch />
    </Suspense>
  );
}
