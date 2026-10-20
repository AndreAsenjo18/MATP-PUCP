"use client";

/**
 * Papelera de Administración (tarea 5.2 de `auditoria-y-soft-delete-transversal`; requirement
 * «Papelera con restauración que verifica dependencias», RNF-006, RN-005): lista de lo eliminado
 * con filtros, motivo y restauración con aviso de dependencia.
 *
 * Une la lista (`TrashEntryList`), los filtros (`TrashFilterBar`), la confirmación
 * (`TrashRestorePanel`) y la capa de datos `lib/data/trash`, que sigue el modo de la maqueta
 * (`lib/data/mode.ts`): en `live` llama a la API; en `mock` usa registros sintéticos en memoria,
 * sin red, y la restauración se simula durante la sesión.
 *
 * Los permisos los decide la pantalla (que conoce la sesión): abrir la papelera exige
 * `pieces.restore` y restaurar es solo del Administrador (`canRestore`); el servidor vuelve a
 * comprobarlos (403).
 */
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  blockerDestination,
  EMPTY_TRASH_FILTERS,
  fetchTrash,
  hasActiveTrashFilters,
  mergePeople,
  restoreFromTrash,
  TRASH_PAGE_SIZE,
  trashPeople,
  type Person,
  type RestoreBlocker,
  type TrashEntry,
  type TrashFilters,
  type TrashListResult,
  type TrashRestoreOutcome,
} from "@/lib/data/trash";

import { AuditLogPager, pageCount } from "./AuditLogPager";
import { TrashEntryList } from "./TrashEntryList";
import { TrashFilterBar } from "./TrashFilterBar";
import { TrashRestorePanel, type TrashRestoreState } from "./TrashRestorePanel";

export const TRASH_INTRO =
  "Aquí están los registros eliminados. Nada se borra de forma definitiva (RN-005): un Administrador puede restaurarlos, siempre que lo que necesitan siga activo.";
export const TRASH_VIEW_ONLY_NOTICE = "Su rol puede ver la papelera, pero solo un Administrador puede restaurar registros.";
export const TRASH_FOCUS_MISSING = "No se encontró ese registro en esta página de la papelera: puede estar en otra página o ya haber sido restaurado.";

/** Qué muestra la pantalla tras intentar restaurar: el aviso de éxito, el panel o el error. */
export interface RestoreView {
  /** Éxito: aviso para quien restauró; el panel se cierra y la lista se recarga. */
  notice?: string;
  /** El panel pasa a este estado (dependencia pendiente o registro desactualizado). */
  panel?: TrashRestoreState;
  /** Error dentro del formulario (sin permiso, sin conexión…); se puede reintentar. */
  error?: string;
}

/** Traduce el resultado de la capa de datos a lo que debe mostrar la pantalla. */
export function restoreOutcomeView(outcome: TrashRestoreOutcome): RestoreView {
  switch (outcome.status) {
    case "ok": {
      const demo = outcome.simulated ? " Modo demostración: no se modificó ningún dato real." : "";
      return {
        notice: `Se restauró «${outcome.result.entity_label}» (${outcome.result.type_label.toLowerCase()}). Ya está disponible y la restauración quedó en la auditoría.${demo}`,
      };
    }
    case "blocked":
      return { panel: { status: "blocked", message: outcome.message, blockers: outcome.blockers } };
    case "not_deleted":
    case "not_found":
      return { panel: { status: "stale", message: outcome.message } };
    default:
      return { error: outcome.message };
  }
}

type Loaded = { key: string; result: TrashListResult };

export interface TrashPanelProps {
  /** La persona puede restaurar (solo el Administrador). */
  canRestore: boolean;
}

export function TrashPanel({ canRestore }: TrashPanelProps) {
  const [filters, setFilters] = useState<TrashFilters>(EMPTY_TRASH_FILTERS);
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  const [target, setTarget] = useState<TrashEntry | null>(null);
  const [panel, setPanel] = useState<TrashRestoreState>({ status: "confirm" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<TrashEntry | null>(null);

  const requestKey = `${JSON.stringify(filters)}|${page}|${reloads}`;

  useEffect(() => {
    let active = true;
    void fetchTrash(filters, page).then((result) => {
      if (!active) return;
      setLoaded({ key: requestKey, result });
      if (result.status === "ok") setPeople((known) => mergePeople(known, trashPeople(result.data.entries)));
    });
    return () => {
      active = false;
    };
  }, [filters, page, reloads, requestKey]);

  const current = loaded?.key === requestKey ? loaded.result : null;
  const entries = current?.status === "ok" ? current.data.entries : [];

  function closePanel() {
    setTarget(null);
    setPanel({ status: "confirm" });
    setError(null);
  }

  function reload() {
    closePanel();
    setReloads((count) => count + 1);
  }

  function applyFilters(next: TrashFilters) {
    closePanel();
    setFocusId(null);
    setPage(1);
    setFilters(next);
  }

  function openRestore(entry: TrashEntry) {
    setTarget(entry);
    setPanel({ status: "confirm" });
    setError(null);
    setNotice(null);
  }

  async function confirmRestore(reason: string | null) {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    const outcome = await restoreFromTrash(target, reason);
    setBusy(false);
    const view = restoreOutcomeView(outcome);
    if (view.notice) {
      setNotice(view.notice);
      setFocusId(null);
      // Si era el único registro de la última página, se vuelve a la anterior para no mostrar una página vacía.
      if (entries.length === 1 && page > 1) setPage(page - 1);
      reload();
      return;
    }
    if (view.panel) setPanel(view.panel);
    if (view.error) setError(view.error);
  }

  function goTo(blocker: RestoreBlocker) {
    if (!target) return;
    const destination = blockerDestination(target, blocker);
    if (destination.kind !== "trash") return;
    setReturnTo(target);
    closePanel();
    setNotice(null);
    setPage(1);
    setFilters({ ...EMPTY_TRASH_FILTERS, entityType: destination.entityType });
    setFocusId(destination.entityId);
  }

  function backToPending() {
    if (!returnTo) return;
    const pending = returnTo;
    setReturnTo(null);
    closePanel();
    setPage(1);
    setFilters({ ...EMPTY_TRASH_FILTERS, entityType: pending.entity_type });
    setFocusId(pending.entity_id);
  }

  return (
    <section aria-label="Papelera" className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-tinta">Papelera</h2>
        <p className="text-base text-gris-texto">{TRASH_INTRO}</p>
        {!canRestore && <p className="text-sm text-ambar-texto">{TRASH_VIEW_ONLY_NOTICE}</p>}
      </header>

      <TrashFilterBar key={JSON.stringify(filters)} filters={filters} people={people} disabled={busy} onApply={applyFilters} />

      {notice && (
        <p role="status" className="rounded-md border border-verde-exito bg-verde-bg p-3 text-base text-tinta">
          {notice}
        </p>
      )}

      {returnTo && (
        <Card className="flex flex-col gap-2 border-ambar-alerta bg-ambar-bg">
          <p className="text-base text-tinta">
            Está restaurando primero lo que «{returnTo.entity_label}» necesitaba. Cuando termine, vuelva a «{returnTo.entity_label}» para restaurarlo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" icon={ArrowLeft} onClick={backToPending}>
              Volver a «{returnTo.entity_label}»
            </Button>
            <Button variant="secondary" onClick={() => setReturnTo(null)}>
              Descartar este aviso
            </Button>
          </div>
        </Card>
      )}

      {current === null && (
        <p role="status" className="text-base text-gris-texto">
          Cargando la papelera…
        </p>
      )}

      {current?.status === "forbidden" && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-ambar-alerta bg-ambar-bg p-4 text-base text-ambar-texto">
          <TriangleAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0" />
          {current.message}
        </p>
      )}

      {current?.status === "unavailable" && (
        <Card role="alert" className="flex flex-col gap-2 text-base text-carmin-texto">
          <p>{current.message}</p>
          <Button variant="secondary" className="self-start" onClick={() => setReloads((count) => count + 1)}>
            Reintentar
          </Button>
        </Card>
      )}

      {current?.status === "ok" && (
        <>
          {current.data.total > 0 && (
            <p aria-live="polite" className="text-sm text-gris-texto">
              {current.data.total === 1 ? "1 registro eliminado" : `${current.data.total} registros eliminados`}
            </p>
          )}
          {focusId && !entries.some((entry) => entry.entity_id === focusId) && <p className="text-sm text-ambar-texto">{TRASH_FOCUS_MISSING}</p>}
          <TrashEntryList
            entries={entries}
            canRestore={canRestore}
            hasFilters={hasActiveTrashFilters(filters)}
            highlightId={focusId}
            openEntryId={target?.entity_id ?? null}
            onRestore={openRestore}
            restorePanel={
              target && (
                <TrashRestorePanel
                  entry={target}
                  state={panel}
                  busy={busy}
                  error={error}
                  onConfirm={(reason) => void confirmRestore(reason)}
                  onCancel={closePanel}
                  onGoTo={goTo}
                  onRefresh={reload}
                />
              )
            }
          />
          <AuditLogPager
            page={current.data.page}
            pageSize={current.data.pageSize || TRASH_PAGE_SIZE}
            total={current.data.total}
            noun="registros"
            disabled={busy}
            onPageChange={(next) => {
              closePanel();
              setPage(Math.min(Math.max(1, next), pageCount(current.data.total, current.data.pageSize || TRASH_PAGE_SIZE)));
            }}
          />
        </>
      )}
    </section>
  );
}
