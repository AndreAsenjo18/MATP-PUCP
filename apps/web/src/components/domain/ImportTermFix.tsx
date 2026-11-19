"use client";

/**
 * «Valores del archivo que no están en las listas» en la revisión de un lote (change
 * `importacion-agregar-terminos`, D2 y D3; RF-011, RF-025, RN-010).
 *
 * Cada valor de una lista de la ficha (tipo de bien, materiales, forma de adquisición…) que no está
 * en ella, agrupado por lista y con cuántas filas lo usan. Quien administra las listas lo agrega ahí
 * mismo (o reactiva el término desactivado con ese nombre) y el lote se valida de nuevo, sin salir de
 * la importación. Los demás ven a quién pedírselo.
 */
import { ListPlus } from "lucide-react";

import { Button } from "@/components/ui/Button";

export interface UnresolvedTerm {
  vocabulary: string;
  vocabulary_name: string;
  text: string;
  rows: number;
  inactive_term?: string | null;
}

function rowsLabel(rows: number): string {
  return rows === 1 ? "1 fila" : `${rows.toLocaleString("es-PE")} filas`;
}

/** Los valores agrupados por lista, en el orden en que llegan. */
export function groupByList(items: readonly UnresolvedTerm[]): { name: string; items: UnresolvedTerm[] }[] {
  const groups = new Map<string, { name: string; items: UnresolvedTerm[] }>();
  for (const item of items) {
    const group = groups.get(item.vocabulary) ?? { name: item.vocabulary_name, items: [] };
    group.items.push(item);
    groups.set(item.vocabulary, group);
  }
  return [...groups.values()];
}

export function UnresolvedTermsPanel({
  items,
  canManage,
  busy,
  decidedNotice,
  onAdd,
}: {
  items: readonly UnresolvedTerm[];
  /** Puede administrar las listas (`vocabularies.manage`). */
  canManage: boolean;
  busy: boolean;
  /** Qué se pierde al validar de nuevo (decisiones ya tomadas). */
  decidedNotice?: string | null;
  onAdd: (item: UnresolvedTerm) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="valores-fuera-de-lista" className="flex flex-col gap-3 rounded-2xl border border-ambar-alerta bg-ambar-bg/40 p-4">
      <h2 id="valores-fuera-de-lista" className="flex items-center gap-2 text-lg font-semibold text-tinta">
        <ListPlus size={20} aria-hidden="true" className="text-ambar-texto" />
        Valores del archivo que no están en las listas
      </h2>
      <p className="text-base text-gris-texto">
        {canManage
          ? "Agréguelos a su lista aquí mismo: el lote se valida de nuevo y las piezas nuevas los reciben al aprobar. Si es una errata, corríjala en la fila en vez de agregarla."
          : "Mientras no estén en la lista, el texto se conserva en el registro de origen. Para agregarlos, pídalo a quien administra las listas (Administrador o Gestor de colecciones)."}
      </p>
      {canManage && decidedNotice && <p className="text-sm font-medium text-ambar-texto">{decidedNotice}</p>}
      {groupByList(items).map((group) => (
        <article key={group.name} aria-label={group.name} className="flex flex-col gap-2 rounded-xl border border-borde bg-white p-3">
          <h3 className="text-base font-semibold text-tinta">{group.name}</h3>
          <ul className="flex flex-col divide-y divide-borde">
            {group.items.map((item) => (
              <li key={`${item.vocabulary}:${item.text}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <p className="text-base text-tinta">
                  <b>«{item.text}»</b> · {rowsLabel(item.rows)}
                  {item.inactive_term && <span className="text-sm text-gris-texto"> · está en la lista, desactivado</span>}
                </p>
                {canManage && (
                  <Button variant="outline" icon={ListPlus} disabled={busy} onClick={() => onAdd(item)}>
                    {busy ? "Validando…" : item.inactive_term ? "Reactivar y validar de nuevo" : "Agregar a la lista y validar de nuevo"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
