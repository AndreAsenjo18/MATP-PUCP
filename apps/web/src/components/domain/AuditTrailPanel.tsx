"use client";

/**
 * Pestaña de auditoría de la ficha de pieza (tarea 5.1 de `auditoria-y-soft-delete-transversal`):
 * une la lista agrupada por conjunto de cambios (`AuditChangeSetList`) con la vista previa y la
 * confirmación de la reversión (`RevertChangeSetPanel`) y la capa de datos `lib/data/audit`.
 *
 * Modos (igual que el resto de la maqueta, `lib/data/mode.ts`): en modo `live` carga el historial
 * de la API (`GET /audit-logs?group_by=change_set` y las filas campo a campo de la pieza); en modo
 * `mock` la pantalla le pasa las filas de la sesión de demostración en `demoEntries` y aquí no se
 * hace ninguna llamada de red.
 *
 * Los permisos los decide la pantalla (que conoce la sesión) y llegan en `access`; el servidor
 * vuelve a comprobarlos en la vista previa y al aplicar.
 */
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import {
  confirmRevert,
  CONNECTION_MESSAGE,
  entriesByChangeSet,
  fetchPieceAuditTrail,
  groupEntriesIntoChangeSets,
  previewRevert,
  type AuditChangeSetSummary,
  type AuditEntryView,
  type AuditTrail,
} from "@/lib/data/audit";

import { AuditChangeSetList, type RevertAccess } from "./AuditChangeSetList";
import { RevertChangeSetPanel, type RevertPanelState } from "./RevertChangeSetPanel";

export const TRAIL_INTRO =
  "Cada tarjeta es una operación completa (una edición, una carga de Excel, una reversión), no un campo suelto: así se ve de un golpe qué se tocó, quién y por qué.";

export interface AuditTrailPanelProps {
  pieceId: string;
  access: RevertAccess;
  /**
   * Filas de auditoría ya conocidas (modo demostración): si se pasan, el panel no consulta la red
   * y agrupa estas filas. En modo `live` se omite.
   */
  demoEntries?: readonly AuditEntryView[];
}

export function AuditTrailPanel({ pieceId, access, demoEntries }: AuditTrailPanelProps) {
  const demoTrail = useMemo<AuditTrail | null>(() => {
    if (!demoEntries) return null;
    const changeSets = groupEntriesIntoChangeSets(demoEntries);
    return { changeSets, entries: [...demoEntries], total: changeSets.length };
  }, [demoEntries]);

  if (demoTrail) return <AuditTrailView trail={demoTrail} access={access} />;
  return <AuditTrailLoader pieceId={pieceId} access={access} />;
}

type LoadState = { status: "loading" } | { status: "ok"; trail: AuditTrail } | { status: "error"; message: string };

function AuditTrailLoader({ pieceId, access }: { pieceId: string; access: RevertAccess }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPieceAuditTrail(pieceId)
      .then((result) => {
        if (!active) return;
        setState(result.status === "ok" ? { status: "ok", trail: result.trail } : { status: "error", message: result.message });
      })
      .catch(() => {
        if (active) setState({ status: "error", message: CONNECTION_MESSAGE });
      });
    return () => {
      active = false;
    };
  }, [pieceId, reloads]);

  if (state.status === "loading") {
    return (
      <p role="status" className="text-base text-gris-texto">
        Cargando el historial de cambios…
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <Card className="text-base text-ambar-texto" role="alert">
        {state.message}
      </Card>
    );
  }
  return (
    <AuditTrailView
      trail={state.trail}
      access={access}
      onReload={() => {
        setState({ status: "loading" });
        setReloads((count) => count + 1);
      }}
    />
  );
}

interface AuditTrailViewProps {
  trail: AuditTrail;
  access: RevertAccess;
  /** Recarga el historial desde la API tras una reversión (solo en modo `live`). */
  onReload?: () => void;
}

function AuditTrailView({ trail, access, onReload }: AuditTrailViewProps) {
  const [target, setTarget] = useState<AuditChangeSetSummary | null>(null);
  const [panel, setPanel] = useState<RevertPanelState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entries = useMemo(() => entriesByChangeSet(trail.entries), [trail.entries]);

  async function loadPreview(changeSetId: string) {
    setError(null);
    setPanel({ status: "loading" });
    try {
      const result = await previewRevert(changeSetId, trail.entries);
      if (result.status === "ok") {
        setPanel({ status: "ready", preview: result.preview });
      } else if (result.status === "already_reverted") {
        setPanel({ status: "blocked", message: result.message, revertedByChangeSetId: result.revertedByChangeSetId });
      } else if (result.status === "forbidden") {
        setPanel({ status: "blocked", message: result.message });
      } else {
        setPanel({ status: "failed", message: result.message });
      }
    } catch {
      setPanel({ status: "failed", message: CONNECTION_MESSAGE });
    }
  }

  async function applyRevert(input: { reason: string; confirmConflicts: boolean }) {
    if (!target || panel.status !== "ready") return;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmRevert(target.change_set_id, {
        previewToken: panel.preview.preview_token,
        reason: input.reason,
        confirmConflicts: input.confirmConflicts,
      });
      if (result.status === "ok") {
        setPanel({ status: "done", result: result.result, simulated: result.simulated });
      } else if (result.status === "plan_changed") {
        setPanel({ status: "plan_changed", message: result.message });
      } else if (result.status === "already_reverted") {
        setPanel({ status: "blocked", message: result.message, revertedByChangeSetId: result.revertedByChangeSetId });
      } else {
        setError(result.message);
      }
    } catch {
      setError(CONNECTION_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setTarget(null);
    setError(null);
    setPanel({ status: "loading" });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gris-texto">{TRAIL_INTRO}</p>
      {trail.total > trail.changeSets.length && (
        <p className="text-sm text-gris-texto">
          Se muestran los {trail.changeSets.length} conjuntos más recientes de {trail.total}. La consulta completa está en Administración.
        </p>
      )}
      <AuditChangeSetList
        changeSets={trail.changeSets}
        entries={entries}
        access={access}
        openChangeSetId={target?.change_set_id ?? null}
        onRevert={(summary) => {
          setTarget(summary);
          void loadPreview(summary.change_set_id);
        }}
        revertPanel={
          target && (
            <RevertChangeSetPanel
              state={panel}
              busy={busy}
              error={error}
              onCancel={close}
              onRecalculate={() => void loadPreview(target.change_set_id)}
              onConfirm={(input) => void applyRevert(input)}
              onReload={
                onReload &&
                (() => {
                  close();
                  onReload();
                })
              }
            />
          )
        }
      />
    </div>
  );
}
