"use client";

/**
 * Bandeja «Revisar pendientes» (change `revisar-pendientes-unificado`; spec calidad-datos, «Bandeja
 * única de pendientes con pestañas» y «Legibilidad de la bandeja de pendientes»; RF-030, RF-035,
 * RF-039, RNF-010).
 *
 * `PendingInbox` lo monta `app/pendientes/layout.tsx`: título, pestañas y contadores. Las pestañas
 * son enlaces (cada una es una página con su dirección, design D1) y la activa sale de la ruta, no
 * de los parámetros: un layout no se vuelve a pintar al navegar y no los recibe (tarea 1.1). Los
 * contadores se piden al montar y cuando una pestaña avisa con `refresh` (design D3).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { TAB_LIST_CLASS, tabClassName } from "@/components/ui/Tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import {
  UNKNOWN_COUNTS,
  fetchPendingCounts,
  pendingTabs,
  tabForPath,
  tabLabel,
  type PendingCounts,
  type PendingTab,
  type PendingTabKey,
} from "@/lib/data/pending";

export const PENDING_TITLE = "Revisar pendientes";
export const PENDING_HINT = "Lo que espera una decisión suya, en un solo lugar.";
export const NO_PENDING_TABS_NOTICE = "Su rol no tiene pendientes que revisar.";

/** Aviso de cada pestaña cuando se abre por su dirección sin el permiso (escenario de la spec). */
export const TAB_PERMISSION_NOTICES: Record<PendingTabKey, string> = {
  duplicates: "Su rol no puede resolver posibles duplicados.",
  suggestions: "Su rol no puede revisar sugerencias de IA.",
  incomplete: "Su rol no puede ver el reporte de piezas incompletas.",
};

// ---------------------------------------------------------------------------------------------
// Presentación (probada con HTML estático, ADR-012)
// ---------------------------------------------------------------------------------------------

/** Pestañas como enlaces: 16 px, 44 px de alto, la activa con `aria-current` y una marca gruesa. */
export function PendingTabsNav({
  tabs,
  counts,
  activeKey,
}: {
  tabs: readonly PendingTab[];
  counts: PendingCounts;
  activeKey?: PendingTabKey;
}) {
  if (tabs.length === 0) return null;
  return (
    <nav aria-label="Pendientes">
      <ul className={TAB_LIST_CLASS}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={tabClassName(active)}
              >
                {tabLabel(tab, counts[tab.key])}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const PENDING_LOADING_TEXT = "Buscando lo que tiene pendiente…";

/** Mientras `/pendientes` espera los contadores para elegir la pestaña. */
export function PendingLoading() {
  return (
    <p role="status" className="text-base text-gris-texto">
      {PENDING_LOADING_TEXT}
    </p>
  );
}

/** Contenido de una pestaña, o su aviso de permiso si el rol no puede abrirla. */
export function PendingTabBody({ tabKey, allowed, children }: { tabKey: PendingTabKey; allowed: boolean; children: ReactNode }) {
  if (!allowed) return <PermissionNotice>{TAB_PERMISSION_NOTICES[tabKey]}</PermissionNotice>;
  return <>{children}</>;
}

/** Marco de la bandeja: título, una línea de ayuda y las pestañas, o el aviso si el rol no ve ninguna. */
export function PendingInboxFrame({
  tabs,
  counts,
  activeKey,
  children,
}: {
  tabs: readonly PendingTab[];
  counts: PendingCounts;
  activeKey?: PendingTabKey;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={PENDING_TITLE} description={PENDING_HINT} />
      {tabs.length === 0 ? (
        <PermissionNotice>{NO_PENDING_TABS_NOTICE}</PermissionNotice>
      ) : (
        <>
          <PendingTabsNav tabs={tabs} counts={counts} activeKey={activeKey} />
          {children}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Estado: pestañas visibles, contadores y recarga
// ---------------------------------------------------------------------------------------------

interface PendingInboxValue {
  tabs: PendingTab[];
  counts: PendingCounts;
  /** `true` cuando ya terminó la primera consulta de los contadores (con o sin número). */
  loaded: boolean;
  /** Vuelve a pedir los contadores; lo llaman las pestañas al resolver algo. */
  refresh: () => void;
}

const PendingInboxContext = createContext<PendingInboxValue | null>(null);

export function usePendingInbox(): PendingInboxValue {
  const value = useContext(PendingInboxContext);
  if (!value) throw new Error("usePendingInbox debe usarse dentro de <PendingInbox>");
  return value;
}

export function PendingInbox({ children }: { children: ReactNode }) {
  const { hasPermission, currentUser } = useSession();
  const store = useMockStore();
  const pathname = usePathname();
  const devUser = currentUser?.email;

  const tabs = useMemo(() => pendingTabs(hasPermission), [hasPermission]);
  const keys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);
  // En demostración las sugerencias viven en el almacén de React (design D3).
  const mockPendingSuggestions = store.aiSuggestions.filter((s) => s.status === "PENDING").length;

  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; counts: PendingCounts } | null>(null);
  const refresh = useCallback(() => setVersion((n) => n + 1), []);
  const requestKey = JSON.stringify({ keys, devUser, mockPendingSuggestions, version });

  useEffect(() => {
    let active = true;
    const key = requestKey;
    fetchPendingCounts(keys, { devUser, mockPendingSuggestions }).then((counts) => {
      if (active) setLoaded({ key, counts });
    });
    return () => {
      active = false;
    };
  }, [keys, devUser, mockPendingSuggestions, requestKey]);

  // Mientras se recalculan, se conservan los números anteriores (sin parpadeo).
  const counts = loaded?.counts ?? UNKNOWN_COUNTS;
  const value = useMemo<PendingInboxValue>(() => ({ tabs, counts, loaded: loaded !== null, refresh }), [tabs, counts, loaded, refresh]);

  return (
    <PendingInboxContext.Provider value={value}>
      <PendingInboxFrame tabs={tabs} counts={counts} activeKey={tabForPath(pathname)?.key}>
        {children}
      </PendingInboxFrame>
    </PendingInboxContext.Provider>
  );
}
