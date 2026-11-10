"use client";

/**
 * Lista de la papelera (tarea 5.2 de `auditoria-y-soft-delete-transversal`; requirement «Papelera
 * con restauración que verifica dependencias», RNF-006, RN-005): cada registro eliminado con qué
 * es, cuándo y quién lo eliminó, el motivo y la acción «Restaurar».
 *
 * Es presentacional: recibe las filas ya cargadas y avisa con `onRestore`. Quien lo monta decide
 * si la persona puede restaurar (`canRestore`, solo el Administrador) y le pasa, ya montado, el
 * panel de restauración del registro abierto, que aparece debajo de su tarjeta.
 */
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { TRASH_ENTITY_TYPES, trashTypeLabel, type TrashEntry } from "@/lib/data/trash";

import { formatMoment } from "./AuditChangeSetList";

export const TRASH_EMPTY_MESSAGE = "La papelera está vacía: no hay registros eliminados.";
export const TRASH_NO_MATCH_MESSAGE = "Ningún registro eliminado coincide con estos filtros.";
export const NO_REASON_MESSAGE = "Sin motivo registrado.";
export const DEPENDENCY_FIRST_BADGE = "Restáurelo primero";

/** «Eliminado el 14/10/2026 por Administrador MATP»: quién y cuándo, en una frase. */
export function deletedBySentence(entry: Pick<TrashEntry, "deleted_at" | "deleted_by_id" | "deleted_by_name">): string {
  const who = entry.deleted_by_name ?? (entry.deleted_by_id ? "una persona sin nombre registrado" : "el sistema");
  return entry.deleted_at ? `Eliminado el ${formatMoment(entry.deleted_at)} por ${who}` : `Eliminado por ${who}`;
}

export interface TrashEntryListProps {
  entries: readonly TrashEntry[];
  /** La persona puede restaurar (solo el Administrador); si no, el botón se ve pero desactivado. */
  canRestore: boolean;
  /** Hay filtros aplicados: cambia el mensaje cuando no hay resultados. */
  hasFilters?: boolean;
  /** Registro que se destaca (la dependencia a la que se acaba de ir). */
  highlightId?: string | null;
  /** Registro cuyo panel de restauración está abierto. */
  openEntryId?: string | null;
  /** Panel de restauración del registro abierto (se recibe montado para no acoplar los datos aquí). */
  restorePanel?: ReactNode;
  onRestore: (entry: TrashEntry) => void;
}

/** Ancla estable de cada registro de la papelera. */
export function trashAnchor(entityId: string): string {
  return `papelera-${entityId}`;
}

export function TrashEntryList({ entries, canRestore, hasFilters = false, highlightId, openEntryId, restorePanel, onRestore }: TrashEntryListProps) {
  if (entries.length === 0) {
    return <Card className="border-dashed text-center text-base text-gris-texto">{hasFilters ? TRASH_NO_MATCH_MESSAGE : TRASH_EMPTY_MESSAGE}</Card>;
  }
  return (
    <ul aria-label="Registros eliminados" className={cardClassName({ padded: false, className: "flex flex-col divide-y divide-borde" })}>
      {entries.map((entry) => (
        <TrashEntryRow
          key={`${entry.entity_type}-${entry.entity_id}`}
          entry={entry}
          canRestore={canRestore}
          highlighted={highlightId === entry.entity_id}
          open={openEntryId === entry.entity_id}
          restorePanel={restorePanel}
          onRestore={onRestore}
        />
      ))}
    </ul>
  );
}

interface TrashEntryRowProps {
  entry: TrashEntry;
  canRestore: boolean;
  highlighted: boolean;
  open: boolean;
  restorePanel?: ReactNode;
  onRestore: (entry: TrashEntry) => void;
}

function TrashEntryRow({ entry, canRestore, highlighted, open, restorePanel, onRestore }: TrashEntryRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const typeLabel = TRASH_ENTITY_TYPES.some((type) => type.value === entry.entity_type) ? trashTypeLabel(entry.entity_type) : entry.type_label;
  const reason = entry.deletion_reason?.trim() ? entry.deletion_reason : NO_REASON_MESSAGE;

  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [highlighted]);

  // Una fila desde lg (qué · cuándo y quién · motivo · acción) y una tarjeta corta debajo (design D1).
  return (
    <li
      ref={rowRef}
      id={trashAnchor(entry.entity_id)}
      className={cn("flex flex-col gap-2 px-3 py-2.5", highlighted && "rounded-md border-2 border-terracota")}
    >
      <div className="flex flex-col gap-1 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_auto] lg:items-center lg:gap-4">
        {/* En celular «Restaurar» va a la derecha del nombre; desde lg, al final de la fila (`lg:contents`). */}
        <div className="flex items-start justify-between gap-2 lg:contents">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-base font-semibold text-tinta" title={entry.entity_label}>
              {entry.entity_label}
            </h3>
            <Badge>{typeLabel}</Badge>
            {highlighted && <Badge intent="warning">{DEPENDENCY_FIRST_BADGE}</Badge>}
          </div>
          {!open && (
            <Button
              variant="outline"
              size="touch"
              icon={RotateCcw}
              className="shrink-0 lg:order-last"
              disabled={!canRestore}
              title={canRestore ? undefined : "Solo un Administrador puede restaurar registros eliminados."}
              aria-label={`Restaurar ${typeLabel.toLowerCase()} «${entry.entity_label}»`}
              onClick={() => onRestore(entry)}
            >
              Restaurar
            </Button>
          )}
        </div>
        <p className="text-sm text-gris-texto">{deletedBySentence(entry)}</p>
        <p className="min-w-0 text-sm text-tinta lg:truncate" title={reason}>
          <span className="font-medium">Motivo: </span>
          {reason}
        </p>
      </div>
      {open && restorePanel}
    </li>
  );
}
