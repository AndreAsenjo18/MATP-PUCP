"use client";

/**
 * `/pendientes` sin pestaña (change `revisar-pendientes-unificado`, tarea 2.4; design D2): espera los
 * contadores y lleva a la primera pestaña visible con pendientes, o a la primera visible. Si el rol
 * no ve ninguna, el layout ya muestra el aviso y esta página no se monta.
 */
import { redirect } from "next/navigation";

import { PendingLoading, usePendingInbox } from "@/components/domain/PendingInbox";
import { initialTab } from "@/lib/data/pending";

export default function PendientesPage() {
  const { tabs, counts, loaded } = usePendingInbox();
  if (!loaded) return <PendingLoading />;
  const target = initialTab(tabs, counts);
  if (target) redirect(target.href);
  return null;
}
