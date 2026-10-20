"use client";

/**
 * Confirmación de la restauración de un registro de la papelera (tarea 5.2 de
 * `auditoria-y-soft-delete-transversal`; requirement «Papelera con restauración que verifica
 * dependencias», RNF-006, RN-005, RNF-010).
 *
 * Se abre dentro de la tarjeta del registro, no como ventana modal, para poder leer con calma qué
 * hay que restaurar antes. Estados:
 *
 * - `confirm`: pide un motivo opcional y restaura. Un fallo de permisos o de conexión se muestra
 *   en `error` sin perder lo escrito.
 * - `blocked`: una dependencia sigue eliminada (409 `restore_dependency`). Dice en español llano
 *   qué hay que restaurar primero y ofrece ir a ese elemento; si lo que bloquea es una pieza
 *   activa con el mismo código I (RN-002), ofrece abrir su ficha.
 * - `stale`: el registro ya no está en la papelera o ya no existe; se ofrece actualizar la lista.
 *
 * Es presentacional: la llamada a la API y la navegación las hace quien lo monta.
 */
import { ArrowRight, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Button, buttonClassName } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { blockerDestination, trashTypeLabel, type RestoreBlocker, type TrashEntry } from "@/lib/data/trash";

export type TrashRestoreState =
  | { status: "confirm" }
  | { status: "blocked"; message: string; blockers: readonly RestoreBlocker[] }
  | { status: "stale"; message: string };

/** Qué hará la restauración, sin tecnicismos. */
export function restoreDescription(entry: Pick<TrashEntry, "entity_label" | "type_label">): string {
  return `«${entry.entity_label}» (${entry.type_label.toLowerCase()}) volverá a estar disponible. El sistema comprueba antes que lo que necesita siga activo, y la restauración queda en la auditoría con su usuario (RN-005).`;
}

/** Encabezado cuando una dependencia bloquea la restauración. */
export function blockedHeadline(entry: Pick<TrashEntry, "entity_label">): string {
  return `Todavía no se puede restaurar «${entry.entity_label}».`;
}

/**
 * Qué hay que hacer primero, en una frase. Casi siempre es restaurar otro registro; si lo que
 * bloquea es una pieza **activa** con el mismo código I (RN-002), hay que revisar esa ficha.
 */
export function blockerSentence(entry: Pick<TrashEntry, "entity_type">, blocker: RestoreBlocker): string {
  if (blockerDestination(entry, blocker).kind === "piece") {
    return `Antes de restaurar, revise la pieza «${blocker.label}»: sigue activa y ya usa el mismo código I.`;
  }
  return `Primero restaure: ${trashTypeLabel(blocker.entityType)} «${blocker.label}».`;
}

export interface TrashRestorePanelProps {
  entry: TrashEntry;
  state: TrashRestoreState;
  /** Mientras la restauración corre, el formulario se bloquea. */
  busy?: boolean;
  /** Mensaje de error de la última restauración (sin permiso, sin conexión…). */
  error?: string | null;
  onConfirm: (reason: string | null) => void;
  onCancel: () => void;
  /** Lleva a la dependencia que hay que restaurar primero (otro registro de la papelera). */
  onGoTo: (blocker: RestoreBlocker) => void;
  /** Vuelve a cargar la lista cuando el registro ya cambió. */
  onRefresh: () => void;
}

export function TrashRestorePanel({ entry, state, busy = false, error, onConfirm, onCancel, onGoTo, onRefresh }: TrashRestorePanelProps) {
  const titleId = useId();
  const [reason, setReason] = useState("");

  return (
    <section aria-labelledby={titleId} className="mt-1 flex flex-col gap-3 rounded-md border border-ambar-alerta bg-ambar-bg p-4">
      <h4 id={titleId} className="flex items-center gap-2 text-base font-semibold text-tinta">
        <RotateCcw size={18} aria-hidden="true" />
        Restaurar «{entry.entity_label}»
      </h4>

      {state.status === "confirm" && (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm(reason.trim() || null);
          }}
        >
          <p className="text-base text-tinta">{restoreDescription(entry)}</p>
          <Textarea
            label="Motivo de la restauración (opcional)"
            hint="Una frase basta; la verá quien revise la auditoría."
            rows={2}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
          {busy && (
            <p role="status" className="text-sm font-medium text-gris-texto">
              Restaurando…
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" icon={RotateCcw} disabled={busy}>
              Restaurar
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {state.status === "blocked" && (
        <>
          <p role="alert" className="flex items-start gap-2 text-base font-medium text-carmin-texto">
            <TriangleAlert size={18} aria-hidden="true" className="mt-1 shrink-0" />
            {blockedHeadline(entry)}
          </p>
          <ul aria-label="Qué hay que restaurar primero" className="flex flex-col gap-3">
            {state.blockers.length === 0 && <li className="text-base text-tinta">{state.message}</li>}
            {state.blockers.map((blocker) => (
              <BlockerItem key={`${blocker.entityType}-${blocker.entityId ?? blocker.label}`} entry={entry} blocker={blocker} onGoTo={onGoTo} />
            ))}
          </ul>
          <Button variant="secondary" onClick={onCancel} className="self-start">
            Cerrar
          </Button>
        </>
      )}

      {state.status === "stale" && (
        <>
          <p role="alert" className="text-base text-ambar-texto">
            {state.message}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button icon={RotateCcw} onClick={onRefresh}>
              Actualizar la lista
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              Cerrar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function BlockerItem({ entry, blocker, onGoTo }: { entry: TrashEntry; blocker: RestoreBlocker; onGoTo: (blocker: RestoreBlocker) => void }) {
  const destination = blockerDestination(entry, blocker);
  return (
    <li className="flex flex-col gap-1 rounded-md bg-white p-3 text-base text-tinta">
      <span className="font-medium">{blockerSentence(entry, blocker)}</span>
      <span className="text-sm text-gris-texto">{blocker.message}</span>
      {destination.kind === "trash" && (
        <Button variant="outline" icon={ArrowRight} className="self-start" onClick={() => onGoTo(blocker)}>
          Ir a «{blocker.label}»
        </Button>
      )}
      {destination.kind === "piece" && (
        <Link href={destination.href} className={buttonClassName({ variant: "outline", className: "self-start" })}>
          Abrir la ficha de «{blocker.label}»
        </Link>
      )}
    </li>
  );
}
