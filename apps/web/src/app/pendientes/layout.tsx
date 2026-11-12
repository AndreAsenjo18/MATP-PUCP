/**
 * Bandeja «Revisar pendientes» (change `revisar-pendientes-unificado`, tarea 2.3; design D1): exige
 * la sesión y pinta el título y las pestañas; cada pestaña es una página bajo `/pendientes/`.
 */
import type { ReactNode } from "react";

import { PendingInbox } from "@/components/domain/PendingInbox";
import { RequireSession } from "@/components/layout/RequireSession";

export default function PendientesLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <PendingInbox>{children}</PendingInbox>
    </RequireSession>
  );
}
