"use client";

/**
 * Pantalla 2 — Inicio como guía de tareas (change `inicio-guia-de-tareas`): «¿Qué desea hacer?»,
 * tarjetas de tarea según el rol y una sola línea con el estado del catálogo (RF-035, RF-039).
 *
 * El tablero de completitud (tabla por colección, evolución de 14 días, últimas cargas y tabla de
 * piezas incompletas) ya no está aquí: los indicadores siguen en la API y en Reportes ›
 * Información incompleta. En modo real no se lee el almacén de demostración.
 */
import { useEffect, useState } from "react";

import { CatalogStatusLine, TaskCards } from "@/components/domain/HomeGuide";
import { RequireSession } from "@/components/layout/RequireSession";
import { useSession } from "@/lib/auth/session";
import { listPendingAiSuggestions } from "@/lib/data/ai";
import { fetchDuplicateQueue } from "@/lib/data/duplicates";
import { getApiMode } from "@/lib/data/mode";
import { fetchDashboardKpis, type AlertType, type CompletenessKpis } from "@/lib/data/quality";
import { visibleTasks, type CatalogStatus } from "@/lib/help/tasks";

function numerator(kpis: CompletenessKpis, alert: AlertType): number {
  return kpis.alerts.find((item) => item.alert === alert)?.numerator ?? 0;
}

function InicioContent() {
  const { currentRole, currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const demo = getApiMode() === "mock";
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const canReviewDuplicates = hasPermission("duplicates.resolve");
  const canReviewSuggestions = hasPermission("ai.review");

  useEffect(() => {
    let active = true;
    fetchDashboardKpis(false, devUser).then((result) => {
      if (!active) return;
      if (result.status === "ok") {
        setStatus({
          total: result.kpis.total_pieces,
          withoutInventoryCode: numerator(result.kpis, "MISSING_INVENTORY_CODE"),
          withoutPhoto: numerator(result.kpis, "MISSING_PHOTO"),
        });
        setStatusFailed(false);
      } else setStatusFailed(true);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  // Número de pendientes: posibles duplicados y sugerencias de IA. En modo demostración solo los duplicados de ejemplo.
  useEffect(() => {
    let active = true;
    if (!canReviewDuplicates && !canReviewSuggestions) return;
    Promise.all([
      canReviewDuplicates ? fetchDuplicateQueue({ status: "PENDING", pageSize: 1 }, devUser) : null,
      canReviewSuggestions && !demo ? listPendingAiSuggestions(devUser) : null,
    ]).then(([duplicates, suggestions]) => {
      if (!active) return;
      const fromDuplicates = duplicates && duplicates.status === "ok" ? duplicates.page.total : 0;
      const fromSuggestions = suggestions && suggestions.status === "ok" ? suggestions.value.length : 0;
      setPending(fromDuplicates + fromSuggestions);
    });
    return () => {
      active = false;
    };
  }, [canReviewDuplicates, canReviewSuggestions, demo, devUser]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">¿Qué desea hacer?</h1>
        {demo && (
          <p className="text-base text-gris-texto">
            Sesión de demostración como <strong className="text-tinta">{currentRole?.name}</strong>. Todos los datos son sintéticos y los cambios que haga
            aquí no se guardan al recargar la página.
          </p>
        )}
      </header>

      <TaskCards tasks={visibleTasks(hasPermission)} pending={pending} />

      <section aria-label="Estado del catálogo">
        <CatalogStatusLine status={status} failed={statusFailed} />
      </section>
    </div>
  );
}

export default function InicioPage() {
  return (
    <RequireSession>
      <InicioContent />
    </RequireSession>
  );
}
