"use client";

/**
 * Pantalla 2 — Inicio como guía de tareas (change `inicio-guia-de-tareas`): «¿Qué desea hacer?»,
 * tarjetas de tarea según el rol y el estado del catálogo (RF-035, RF-039).
 *
 * Diseño: change `remodelacion-visual` (docs/guia-visual.md). El buscador interpreta la frase con IA
 * y lleva a Búsqueda con los filtros (change `inicio-busqueda-ia`).
 *
 * El tablero de completitud (tabla por colección, evolución de 14 días, últimas cargas y tabla de
 * piezas incompletas) ya no está aquí: los indicadores siguen en la API y en Reportes ›
 * Información incompleta. En modo real no se lee el almacén de demostración.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CatalogStatusChips, HomeSearch, TaskCards, type HomeSearchOutcome } from "@/components/domain/HomeGuide";
import { loadSearchOptions, optionNames, type SearchOptions } from "@/components/domain/SearchFilters";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireSession } from "@/components/layout/RequireSession";
import { useSession } from "@/lib/auth/session";
import { getApiMode } from "@/lib/data/mode";
import { incompleteTotal } from "@/lib/data/pending";
import { fetchDashboardKpis, type AlertType, type CompletenessKpis } from "@/lib/data/quality";
import { homeSearchTarget, interpretSearch } from "@/lib/data/search";
import { visibleTasks, type CatalogStatus } from "@/lib/help/tasks";

function numerator(kpis: CompletenessKpis, alert: AlertType): number {
  return kpis.alerts.find((item) => item.alert === alert)?.numerator ?? 0;
}

function InicioContent() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const demo = getApiMode() === "mock";
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const canSeeIncomplete = hasPermission("reports.view");
  const router = useRouter();
  const [thinking, setThinking] = useState(false);
  // Las listas que la IA necesita para reconocer colecciones, materiales, etc. Se piden en segundo
  // plano al entrar; si aún no llegaron al buscar, se esperan (change `inicio-busqueda-ia`, D1).
  const optionsRef = useRef<Promise<SearchOptions> | null>(null);

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

  // Número de pendientes: las piezas incompletas (los posibles duplicados ya no existen, change
  // `codigo-unico-y-ajustes-pantallas`).
  useEffect(() => {
    let active = true;
    if (!canSeeIncomplete) return;
    incompleteTotal(devUser).then((total) => {
      if (active) setPending(total ?? 0);
    });
    return () => {
      active = false;
    };
  }, [canSeeIncomplete, devUser]);

  const tasks = visibleTasks(hasPermission);
  const searchTask = tasks.find((task) => task.id === "search");

  useEffect(() => {
    if (demo || !searchTask) return;
    optionsRef.current = loadSearchOptions(devUser);
  }, [demo, devUser, searchTask]);

  // En modo demostración no hay IA: se busca la frase como texto, como antes.
  const searchWithAi = useCallback(
    async (text: string): Promise<HomeSearchOutcome> => {
      if (demo) return { href: homeSearchTarget(text, null).href, summary: null };
      const options = await (optionsRef.current ?? (optionsRef.current = loadSearchOptions(devUser)));
      const result = await interpretSearch(text, options, devUser);
      const target = homeSearchTarget(text, result.status === "ok" ? result.value : null, optionNames(options));
      return { href: target.href, summary: target.chips.length > 0 ? target.chips.map((chip) => chip.value).join(" · ") : null };
    },
    [demo, devUser],
  );

  // La insignia de demostración vive solo en el menú.
  return (
    <div className="flex flex-col gap-5">
      <PageHeader size="grande" tramaPensando={thinking} eyebrow={<span translate="no">Museo de Artes y Tradiciones Populares «Luis Repetto Málaga»</span>} title="¿Qué desea hacer?">
        {searchTask && <HomeSearch task={searchTask} onSearch={searchWithAi} onNavigate={(href) => router.push(href)} onThinkingChange={setThinking} />}
      </PageHeader>

      <TaskCards tasks={tasks} pending={pending} />

      <section aria-labelledby="catalog-status-title" className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 id="catalog-status-title" className="text-base font-semibold text-gris-texto">
          El catálogo hoy
        </h2>
        <CatalogStatusChips status={status} failed={statusFailed} />
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
