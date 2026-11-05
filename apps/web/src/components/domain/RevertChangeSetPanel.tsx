"use client";

/**
 * Vista previa y confirmación de una reversión (tarea 5.1 de `auditoria-y-soft-delete-transversal`;
 * requirement «Reversión por conjunto de cambios con vista previa», RNF-007, RNF-010).
 *
 * Se abre debajo del conjunto de cambios, no como ventana modal: el plan puede ser largo y hay
 * que poder leerlo con calma en el depósito, en un teléfono. Antes de pulsar, la persona ve en
 * español llano qué va a pasar con cada registro, qué no se toca (los movimientos de ubicación,
 * que se corrigen con un movimiento correctivo) y qué se perdería si hay cambios posteriores.
 *
 * Reglas de la pantalla:
 * - El motivo es obligatorio: queda en la auditoría (RN-005).
 * - Con conflictos hace falta marcar una casilla: nunca se pisa un cambio posterior en silencio.
 * - Si el plan cambió entre la vista previa y la confirmación (`revert_plan_changed`), se explica
 *   que alguien editó mientras tanto y se ofrece volver a calcular.
 * - Un conjunto ya revertido se informa con el conjunto de reversión existente.
 *
 * Es presentacional: recibe el estado del plan y devuelve la confirmación con `onConfirm`.
 */
import { CircleAlert, RotateCcw, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { RevertChangeSetOut, RevertConflictOut, RevertItemOut, RevertPreviewOut } from "@/lib/data/audit";

import { changeSetAnchor, fieldLabel, formatAuditValue, formatMoment, joinWithAnd } from "./AuditChangeSetList";

/** Estado de la vista previa tal como lo ve la pantalla. */
export type RevertPanelState =
  | { status: "loading" }
  | { status: "ready"; preview: RevertPreviewOut }
  /** Ya revertido o sin permiso: no hay nada que confirmar. */
  | { status: "blocked"; message: string; revertedByChangeSetId?: string | null }
  /** El plan caducó: hay que volver a calcularlo. */
  | { status: "plan_changed"; message: string }
  /** Falló la consulta o la aplicación: se puede reintentar. */
  | { status: "failed"; message: string }
  | { status: "done"; result: RevertChangeSetOut; simulated: boolean };

export const REVERT_REASON_REQUIRED = "Indique el motivo de la reversión: quedará registrado en la auditoría con su usuario (RN-005).";
export const CONFLICTS_CONFIRM_REQUIRED = "Marque la casilla para confirmar que los cambios posteriores se descartarán.";
export const CONFLICTS_CONFIRM_LABEL = "Entiendo que los cambios posteriores listados arriba se descartarán.";
export const NOTHING_TO_REVERT = "Este conjunto no tiene nada que revertir: solo contiene registros que no se modifican (como los movimientos de ubicación).";

export interface RevertFormErrors {
  reason?: string;
  confirmConflicts?: string;
}

/** Errores del formulario de confirmación; objeto vacío si se puede enviar. */
export function validateRevertForm(input: { reason: string; confirmConflicts: boolean; hasConflicts: boolean }): RevertFormErrors {
  const errors: RevertFormErrors = {};
  if (!input.reason.trim()) errors.reason = REVERT_REASON_REQUIRED;
  if (input.hasConflicts && !input.confirmConflicts) errors.confirmConflicts = CONFLICTS_CONFIRM_REQUIRED;
  return errors;
}

// ---------------------------------------------------------------------------------------------
// El plan en frases (funciones puras, probadas sin DOM)
// ---------------------------------------------------------------------------------------------

function countOf(items: readonly RevertItemOut[], kind: RevertItemOut["kind"]): number {
  return items.filter((item) => item.kind === kind && item.applicable).length;
}

/** Qué va a pasar, en una lista de frases cortas y sin tecnicismos. */
export function revertPlanSentences(preview: RevertPreviewOut): string[] {
  const items = preview.items ?? [];
  const sentences: string[] = [];
  const restored = countOf(items, "RESTORE_VALUE");
  const corrections = countOf(items, "CORRECT_INVENTORY_CODE");
  const softDeleted = countOf(items, "SOFT_DELETE_ENTITY");
  const restoredEntities = countOf(items, "RESTORE_ENTITY");
  const untouched = items.filter((item) => item.kind === "APPEND_ONLY_NOTE").length;

  if (restored > 0) {
    sentences.push(restored === 1 ? "Se devolverá 1 campo a su valor anterior." : `Se devolverán ${restored} campos a su valor anterior.`);
  }
  if (corrections > 0) {
    sentences.push(
      corrections === 1
        ? "Se deshará 1 corrección de código I con el procedimiento auditado: hace falta el rol Administrador (RN-002)."
        : `Se desharán ${corrections} correcciones de código I con el procedimiento auditado: hace falta el rol Administrador (RN-002).`,
    );
  }
  if (softDeleted > 0) {
    sentences.push(
      softDeleted === 1
        ? "Se eliminará lógicamente 1 registro creado por este cambio: no se borra, queda en la papelera y puede restaurarse (RN-005)."
        : `Se eliminarán lógicamente ${softDeleted} registros creados por este cambio: no se borran, quedan en la papelera y pueden restaurarse (RN-005).`,
    );
  }
  if (restoredEntities > 0) {
    sentences.push(
      restoredEntities === 1
        ? "Se restaurará 1 registro que este cambio había eliminado."
        : `Se restaurarán ${restoredEntities} registros que este cambio había eliminado.`,
    );
  }
  if (untouched > 0) {
    sentences.push(
      untouched === 1
        ? "1 registro de solo lectura (por ejemplo un movimiento de ubicación) no se modificará."
        : `${untouched} registros de solo lectura (por ejemplo movimientos de ubicación) no se modificarán.`,
    );
  }
  if (sentences.length === 0) sentences.push(NOTHING_TO_REVERT);
  return sentences;
}

/** Un conflicto en una frase legible: quién lo cambió después, cuándo y qué dice hoy el dato. */
export function conflictSentence(conflict: RevertConflictOut): string {
  if (conflict.reason === "entity_missing") {
    return `${fieldLabel(conflict.field)}: el registro ya no existe en el catálogo, así que no se puede restaurar.`;
  }
  if (conflict.reason === "already_deleted") {
    return `${fieldLabel(conflict.field)}: el registro ya está eliminado, así que la reversión no lo tocará.`;
  }
  if (conflict.reason === "not_deleted") {
    return `${fieldLabel(conflict.field)}: el registro ya está activo, así que la reversión no lo tocará.`;
  }
  if (conflict.reason === "no_soft_delete") {
    return `${fieldLabel(conflict.field)}: este tipo de registro no admite eliminación lógica, así que la reversión no lo tocará.`;
  }
  return `${fieldLabel(conflict.field)}: otra persona lo volvió a cambiar después de este conjunto. Si continúa, se perderá ese cambio más reciente.`;
}

/**
 * Detalle legible de un conflicto por cambio posterior: cuándo se modificó, qué dice hoy el dato
 * y qué había dejado el conjunto. `null` cuando el servidor no envía esos datos.
 */
export function conflictDetailSentence(conflict: RevertConflictOut): string | null {
  if (conflict.reason !== "changed_after") return null;
  const parts: string[] = [];
  if (conflict.changed_at) parts.push(`Modificado el ${formatMoment(conflict.changed_at)}`);
  parts.push(`hoy dice «${formatAuditValue(conflict.current_value)}»`);
  parts.push(`este conjunto lo había dejado en «${formatAuditValue(conflict.expected_value)}»`);
  return `${parts.join("; ")}.`;
}

/** Texto del botón que confirma, con el número de elementos y el aviso de conflictos. */
export function revertConfirmLabel(preview: RevertPreviewOut): string {
  const conflicts = preview.conflicts?.length ?? 0;
  const base = preview.applicable_count === 1 ? "Revertir 1 cambio" : `Revertir ${preview.applicable_count} cambios`;
  if (conflicts === 0) return base;
  return `${base} y descartar ${conflicts === 1 ? "1 cambio posterior" : `${conflicts} cambios posteriores`}`;
}

/** Resumen de lo aplicado, para el aviso final. */
export function revertResultSentence(result: RevertChangeSetOut): string {
  const parts: string[] = [];
  if (result.reverted_fields > 0) parts.push(result.reverted_fields === 1 ? "1 campo devuelto a su valor anterior" : `${result.reverted_fields} campos devueltos a su valor anterior`);
  if (result.deleted_entities > 0) parts.push(result.deleted_entities === 1 ? "1 registro eliminado lógicamente" : `${result.deleted_entities} registros eliminados lógicamente`);
  if (result.restored_entities > 0) parts.push(result.restored_entities === 1 ? "1 registro restaurado" : `${result.restored_entities} registros restaurados`);
  const detail = parts.length > 0 ? `${joinWithAnd(parts)}.` : "Sin cambios que aplicar.";
  return `Reversión registrada: ${detail} Quedó en la auditoría como un conjunto nuevo, que a su vez puede revertirse.`;
}

// ---------------------------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------------------------

export interface RevertChangeSetPanelProps {
  state: RevertPanelState;
  /** Vuelve a pedir la vista previa (plan caducado o fallo de conexión). */
  onRecalculate: () => void;
  onCancel: () => void;
  /** Aplica la reversión; el panel ya validó motivo y confirmación de conflictos. */
  onConfirm: (input: { reason: string; confirmConflicts: boolean }) => void;
  /** Mientras la confirmación corre, el formulario se bloquea. */
  busy?: boolean;
  /** Mensaje de error de la última confirmación (motivo rechazado, permiso, etc.). */
  error?: string | null;
  /** Recarga el historial tras aplicar la reversión; si falta, no se ofrece. */
  onReload?: () => void;
}

export function RevertChangeSetPanel({ state, onRecalculate, onCancel, onConfirm, busy = false, error, onReload }: RevertChangeSetPanelProps) {
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [confirmConflicts, setConfirmConflicts] = useState(false);
  const [errors, setErrors] = useState<RevertFormErrors>({});

  return (
    <section aria-labelledby={titleId} className="mt-2 flex flex-col gap-3 rounded-md border border-ambar-alerta bg-ambar-bg p-4">
      <h3 id={titleId} className="flex items-center gap-2 text-base font-semibold text-tinta">
        <RotateCcw size={18} aria-hidden="true" />
        Revertir este conjunto de cambios
      </h3>

      {state.status === "loading" && (
        <p role="status" className="text-base text-ambar-texto">
          Calculando qué pasaría al revertir…
        </p>
      )}

      {state.status === "blocked" && (
        <>
          <p role="alert" className="text-base text-ambar-texto">
            {state.message}
          </p>
          {state.revertedByChangeSetId && (
            <p className="text-sm text-ambar-texto">
              <a href={`#${changeSetAnchor(state.revertedByChangeSetId)}`} className="text-terracota underline">
                Ver el conjunto de reversión
              </a>
              , que a su vez puede revertirse.
            </p>
          )}
          <Button variant="secondary" onClick={onCancel} className="self-start">
            Cerrar
          </Button>
        </>
      )}

      {(state.status === "plan_changed" || state.status === "failed") && (
        <>
          <p role="alert" className="flex items-start gap-2 text-base text-carmin-texto">
            <CircleAlert size={18} aria-hidden="true" className="mt-1 shrink-0" />
            {state.message}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" icon={RotateCcw} onClick={onRecalculate}>
              Volver a calcular la reversión
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </>
      )}

      {state.status === "done" && (
        <>
          <p role="status" className="text-base text-tinta">
            {revertResultSentence(state.result)}
          </p>
          {state.simulated && (
            <p className="text-sm text-ambar-texto">
              Modo demostración: la reversión no modificó ningún dato real.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {onReload && (
              <Button variant="primary" onClick={onReload}>
                Actualizar el historial
              </Button>
            )}
            <Button variant="secondary" onClick={onCancel}>
              Cerrar
            </Button>
          </div>
        </>
      )}

      {state.status === "ready" && (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const hasConflicts = (state.preview.conflicts?.length ?? 0) > 0;
            const found = validateRevertForm({ reason, confirmConflicts, hasConflicts });
            setErrors(found);
            if (found.reason || found.confirmConflicts) return;
            onConfirm({ reason: reason.trim(), confirmConflicts });
          }}
        >
          <div>
            <p className="text-base font-medium text-tinta">Antes de confirmar, esto es lo que va a pasar:</p>
            <ul aria-label="Qué hará la reversión" className="mt-1 flex list-disc flex-col gap-1 pl-5 text-base text-tinta">
              {revertPlanSentences(state.preview).map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ul>
          </div>

          <RevertItemDetails items={state.preview.items ?? []} />

          {(state.preview.notes ?? []).length > 0 && (
            <ul aria-label="Avisos" className="flex flex-col gap-1 text-sm text-ambar-texto">
              {(state.preview.notes ?? []).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}

          <RevertConflicts conflicts={state.preview.conflicts ?? []} />

          {state.preview.requires_admin && (
            <p className="text-sm text-ambar-texto">
              Esta reversión afecta un código I: solo un Administrador puede aplicarla (RN-002). Si su rol no lo es, el servidor la rechazará.
            </p>
          )}

          <Textarea
            label="Motivo de la reversión (obligatorio)"
            hint="Explique en una frase por qué se revierte; lo verá quien revise la auditoría."
            required
            rows={2}
            value={reason}
            error={errors.reason}
            disabled={busy}
            onChange={(event) => {
              setReason(event.target.value);
              setErrors((current) => ({ ...current, reason: undefined }));
            }}
          />

          {(state.preview.conflicts?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2 text-base text-tinta">
                <input
                  type="checkbox"
                  checked={confirmConflicts}
                  disabled={busy}
                  className="mt-1 size-5 accent-carmin-peligro"
                  onChange={(event) => {
                    setConfirmConflicts(event.target.checked);
                    setErrors((current) => ({ ...current, confirmConflicts: undefined }));
                  }}
                />
                {CONFLICTS_CONFIRM_LABEL}
              </label>
              {errors.confirmConflicts && (
                <p role="alert" className="text-sm font-medium text-carmin-texto">
                  {errors.confirmConflicts}
                </p>
              )}
            </div>
          )}

          {busy && (
            <p role="status" className="text-sm font-medium text-gris-texto">
              Aplicando la reversión…
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="danger"
              icon={RotateCcw}
              disabled={busy || state.preview.applicable_count === 0}
            >
              {revertConfirmLabel(state.preview)}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function RevertItemDetails({ items }: { items: readonly RevertItemOut[] }) {
  const detailed = items.filter((item) => item.kind === "RESTORE_VALUE" || item.kind === "CORRECT_INVENTORY_CODE");
  if (detailed.length === 0) return null;
  return (
    <ul aria-label="Valores que se restaurarán" className="flex flex-col gap-1 rounded-md bg-white p-3 text-base text-tinta">
      {detailed.map((item) => (
        <li key={`${item.entity_id}-${item.field ?? item.kind}`}>
          <span className="font-medium">{fieldLabel(item.field)}</span>: {formatAuditValue(item.current_value)} → {formatAuditValue(item.target_value)}
        </li>
      ))}
    </ul>
  );
}

function RevertConflicts({ conflicts }: { conflicts: readonly RevertConflictOut[] }) {
  if (conflicts.length === 0) {
    return <p className="text-sm text-gris-texto">Nadie modificó estos datos después de este cambio: no hay conflictos.</p>;
  }
  return (
    <div className="rounded-md border border-carmin-peligro bg-carmin-bg p-3">
      <p className="flex items-center gap-2 text-base font-semibold text-carmin-texto">
        <TriangleAlert size={18} aria-hidden="true" />
        {conflicts.length === 1 ? "1 cambio posterior en conflicto" : `${conflicts.length} cambios posteriores en conflicto`}
      </p>
      <ul aria-label="Conflictos con cambios posteriores" className="mt-1 flex flex-col gap-2 text-base text-carmin-texto">
        {conflicts.map((conflict, index) => {
          const detail = conflictDetailSentence(conflict);
          return (
            <li key={`${conflict.entity_id}-${conflict.field ?? "entidad"}-${index}`}>
              {conflict.message || conflictSentence(conflict)}
              {detail && <span className="block text-sm">{detail}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
