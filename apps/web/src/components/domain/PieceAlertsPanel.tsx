/**
 * Panel de alertas de completitud de la ficha (spec calidad-datos, RF-019, RNF-010; change
 * `alertas-y-reporte-incompletas`, tarea 3.1). Muestra las alertas activas con su mensaje y
 * acción sugerida, cada una con un enlace a dónde resolverla: sin código I, sin foto o sin
 * ubicación lleva a la pestaña correspondiente de esta misma ficha (ahí es donde se asigna un
 * código, se sube una foto o se registra la ubicación, no en el editor); campos obligatorios o
 * recomendados vacíos sí viven en el editor (`PieceForm`), así que esas dos llevan ahí. Se usa
 * `alert.type`, no `alert.fields` (el mock de los fixtures y la API no listan ahí lo mismo: la
 * API pone la sección, el fixture a veces los nombres de los campos vacíos).
 */
import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "next/link";

import type { ApiSchemas } from "@/lib/api/client";

import { alertStatus } from "./status-intents";

type PieceAlert = ApiSchemas["PieceAlert"];

/** A qué pestaña de la ficha lleva cada alerta; `null` = va al editor, no a una pestaña. */
const ALERT_TO_TAB: Record<PieceAlert["type"], string | null> = {
  MISSING_INVENTORY_CODE: "Identificadores",
  MISSING_PHOTO: "Fotografías",
  MISSING_LOCATION: "Ubicación e historial",
  UNNORMALIZABLE_IDENTIFIER: "Identificadores",
  MISSING_REQUIRED_FIELDS: null,
  MISSING_RECOMMENDED_FIELDS: null,
};

export function PieceAlertsPanel({
  pieceId,
  alerts,
  onNavigateToTab,
}: {
  pieceId: string;
  alerts: PieceAlert[];
  onNavigateToTab?: (tab: string) => void;
}) {
  const active = alerts.filter((alert) => alert.applies);
  if (active.length === 0) return null;
  return (
    <section aria-label="Alertas de completitud" className="flex flex-col gap-2 rounded-lg border border-ambar-alerta bg-ambar-bg p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-tinta">
        <TriangleAlert size={18} aria-hidden="true" className="text-ambar-texto" />
        {active.length === 1 ? "1 alerta de completitud" : `${active.length} alertas de completitud`}
      </h2>
      <ul className="flex flex-col gap-2">
        {active.map((alert) => {
          const tab = ALERT_TO_TAB[alert.type];
          return (
            <li key={alert.type} className="flex flex-wrap items-center justify-between gap-2 border-t border-ambar-alerta/40 pt-2 text-base text-tinta first:border-t-0 first:pt-0">
              <span>
                <span className="font-medium">{alertStatus(alert.type).label}:</span> {alert.message}
              </span>
              {tab && onNavigateToTab ? (
                <button
                  type="button"
                  onClick={() => onNavigateToTab(tab)}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-terracota underline"
                >
                  {alert.suggested_action}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : tab ? (
                <span className="shrink-0 text-sm text-gris-texto">{alert.suggested_action}</span>
              ) : (
                <Link href={`/piezas/${pieceId}/editar`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-terracota underline">
                  {alert.suggested_action}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
