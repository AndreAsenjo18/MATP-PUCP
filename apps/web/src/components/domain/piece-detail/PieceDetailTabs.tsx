"use client";

import { type KeyboardEvent, type ReactNode } from "react";

import { TAB_LIST_CLASS, tabClassName } from "@/components/ui/Tabs";

/** Navegación común para fichas simuladas y conectadas (C9).
 * Agrupa origen y auditoría para no saturar la interfaz con ocho opciones.
 */
export const PIECE_DETAIL_TABS = [
  "Datos generales",
  "Identificadores",
  "Fotografías",
  "Ubicación e historial",
  "Conservación",
  "Origen y auditoría",
] as const;

export type PieceDetailTab = (typeof PIECE_DETAIL_TABS)[number];

const TAB_IDS: Record<PieceDetailTab, string> = {
  "Datos generales": "general",
  "Identificadores": "identifiers",
  "Fotografías": "photos",
  "Ubicación e historial": "location",
  "Conservación": "conservation",
  "Origen y auditoría": "origin-audit",
};

export function PieceDetailTabs({
  activeTab,
  onChange,
}: {
  activeTab: PieceDetailTab;
  onChange: (tab: PieceDetailTab) => void;
}) {
  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = PIECE_DETAIL_TABS.length - 1;
    let next = index;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    onChange(PIECE_DETAIL_TABS[next]);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="Secciones de la ficha" className={TAB_LIST_CLASS}>
      {PIECE_DETAIL_TABS.map((tab, index) => (
        <button
          key={tab}
          id={`piece-tab-${TAB_IDS[tab]}`}
          aria-controls={`piece-panel-${TAB_IDS[tab]}`}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          tabIndex={activeTab === tab ? 0 : -1}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => selectWithKeyboard(event, index)}
          className={tabClassName(activeTab === tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

/** Mantiene montados los formularios de una sección visitada al navegar a otra,
 * para no borrar accidentalmente lo que la persona estuviera escribiendo.
 */
export function PieceDetailPanel({
  tab,
  activeTab,
  visited,
  children,
}: {
  tab: PieceDetailTab;
  activeTab: PieceDetailTab;
  visited: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`piece-panel-${TAB_IDS[tab]}`}
      role="tabpanel"
      aria-labelledby={`piece-tab-${TAB_IDS[tab]}`}
      aria-hidden={activeTab !== tab}
      hidden={activeTab !== tab}
      className={activeTab === tab ? "flex flex-col gap-4" : "hidden"}
    >
      {(visited || activeTab === tab) && children}
    </section>
  );
}
