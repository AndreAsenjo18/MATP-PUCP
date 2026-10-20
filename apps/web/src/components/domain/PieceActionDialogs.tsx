"use client";

/**
 * Diálogos de acción sobre una pieza (change `ficha-pieza-crud`, tarea 4.4):
 *
 * - `PieceDeleteDialog`: eliminación lógica con motivo obligatorio (design D7, RN-005).
 * - `PieceRestoreDialog`: restauración con motivo opcional; si el servidor responde 409 (el código I
 *   ya lo usa otra pieza activa) el mensaje se muestra dentro del diálogo.
 * - `InventoryCodeCorrectionDialog`: corrección auditada del código I con código nuevo y motivo
 *   obligatorios (design D6, RN-002). Quien lo monta decide si la persona tiene permiso
 *   (`identifiers.correct_inventory_code`); sin permiso no se muestra el botón que lo abre.
 * - `ConcatenatedCodesDialog`: muestra la separación propuesta por el servidor para un valor con varios
 *   códigos y pide confirmación explícita; nunca separa por su cuenta (design D5, RF-023).
 *
 * Son presentacionales: reciben la acción como `Promise<DialogOutcome>` y no conocen la capa de datos.
 * Mientras la acción corre bloquean el envío; si falla, el mensaje del servidor queda visible dentro
 * del diálogo y la persona puede corregir y reintentar sin perder lo escrito.
 */
import type { LucideIcon } from "lucide-react";
import { RotateCcw, Scissors, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

/** Resultado de la acción que ejecuta un diálogo: `message` es el texto que verá la persona. */
export type DialogOutcome = { ok: true } | { ok: false; message: string };

const GENERIC_FAILURE = "No se pudo completar la acción. Intente nuevamente.";

/** Traduce el resultado de la capa de datos (`status: "ok"` o un fallo con `message`) a `DialogOutcome`. */
export function toDialogOutcome(result: { status: string; message?: string }): DialogOutcome {
  return result.status === "ok" ? { ok: true } : { ok: false, message: result.message || GENERIC_FAILURE };
}

// ---------------------------------------------------------------------------------------------
// Reglas puras (se prueban sin DOM)
// ---------------------------------------------------------------------------------------------

export const DELETE_REASON_REQUIRED = "Indique el motivo de la eliminación: quedará registrado en la auditoría (RN-005).";
export const CORRECTION_CODE_REQUIRED = "Escriba el código I nuevo.";
export const CORRECTION_CODE_UNCHANGED = "El código nuevo es igual al actual: no hay nada que corregir.";
export const CORRECTION_REASON_REQUIRED = "Indique el motivo de la corrección: quedará registrado en la auditoría con su usuario (RN-002).";

/** `null` si el motivo de eliminación es válido (no vacío); si no, el mensaje que se muestra. */
export function validateDeleteReason(reason: string): string | null {
  return reason.trim() ? null : DELETE_REASON_REQUIRED;
}

/** Forma comparable de un código: sin espacios sobrantes y en mayúsculas. */
export function comparableCode(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export interface CorrectionErrors {
  newValue?: string;
  reason?: string;
}

/** Errores de la corrección del código I; objeto vacío si se puede enviar. */
export function validateCorrection(input: { currentCode: string; newValue: string; reason: string }): CorrectionErrors {
  const errors: CorrectionErrors = {};
  if (!input.newValue.trim()) errors.newValue = CORRECTION_CODE_REQUIRED;
  else if (comparableCode(input.newValue) === comparableCode(input.currentCode)) errors.newValue = CORRECTION_CODE_UNCHANGED;
  if (!input.reason.trim()) errors.reason = CORRECTION_REASON_REQUIRED;
  return errors;
}

/** Texto del botón que confirma la separación («Registrar 2 códigos por separado»). */
export function splitConfirmLabel(count: number): string {
  return count === 1 ? "Registrar 1 código" : `Registrar ${count} códigos por separado`;
}

// ---------------------------------------------------------------------------------------------
// Base común
// ---------------------------------------------------------------------------------------------

function useSubmitState() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setBusy(false);
    setError(null);
  }

  /** Ejecuta la acción una sola vez a la vez; en éxito llama a `onOk`, si no deja el mensaje en el diálogo. */
  async function run(action: () => Promise<DialogOutcome>, onOk: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    let outcome: DialogOutcome;
    try {
      outcome = await action();
    } catch {
      outcome = { ok: false, message: GENERIC_FAILURE };
    }
    setBusy(false);
    if (outcome.ok) onOk();
    else setError(outcome.message);
  }

  return { busy, error, reset, run };
}

interface DialogShellProps {
  open: boolean;
  /** Se llama cuando el diálogo ya se cerró (botón, Escape o cierre desde fuera): aquí se limpia el estado. */
  onClosed: () => void;
  titleId: string;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  submitLabel: string;
  submitVariant: ButtonVariant;
  submitIcon?: LucideIcon;
  cancelLabel?: string;
  submitDisabled?: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}

function DialogShell({
  open,
  onClosed,
  titleId,
  title,
  description,
  children,
  submitLabel,
  submitVariant,
  submitIcon,
  cancelLabel = "Cancelar",
  submitDisabled = false,
  busy,
  error,
  onSubmit,
}: DialogShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClosed}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40"
    >
      {/* noValidate: los mensajes de motivo obligatorio los muestra el diálogo, no el navegador. */}
      <form
        noValidate
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-tinta">
          {title}
        </h2>
        <div className="text-base text-gris-texto">{description}</div>
        {children}
        {busy && (
          <p role="status" className="text-sm font-medium text-gris-texto">
            Procesando…
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => dialogRef.current?.close()}>
            {cancelLabel}
          </Button>
          <Button type="submit" variant={submitVariant} icon={submitIcon} disabled={busy || submitDisabled}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Eliminar
// ---------------------------------------------------------------------------------------------

export interface PieceDeleteDialogProps {
  pieceName: string;
  open: boolean;
  onClose: () => void;
  /** Recibe el motivo ya sin espacios sobrantes; nunca se llama con el motivo vacío. */
  onDelete: (reason: string) => Promise<DialogOutcome>;
}

export function PieceDeleteDialog({ pieceName, open, onClose, onDelete }: PieceDeleteDialogProps) {
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const submit = useSubmitState();

  function handleClosed() {
    setReason("");
    setReasonError(null);
    submit.reset();
    onClose();
  }

  function handleSubmit() {
    const problem = validateDeleteReason(reason);
    setReasonError(problem);
    if (problem) return;
    void submit.run(() => onDelete(reason.trim()), onClose);
  }

  return (
    <DialogShell
      open={open}
      onClosed={handleClosed}
      titleId={titleId}
      title="Eliminar pieza"
      description={
        <>
          Va a eliminar la pieza <strong>{pieceName}</strong>. No se borra de forma definitiva: queda marcada como eliminada, conserva su historial
          y su código I, y puede restaurarse después (RN-005).
        </>
      }
      submitLabel="Eliminar pieza"
      submitVariant="danger"
      submitIcon={Trash2}
      busy={submit.busy}
      error={submit.error}
      onSubmit={handleSubmit}
    >
      <Textarea
        label="Motivo de la eliminación (obligatorio)"
        required
        rows={2}
        value={reason}
        error={reasonError ?? undefined}
        onChange={(event) => {
          setReason(event.target.value);
          setReasonError(null);
        }}
      />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Restaurar
// ---------------------------------------------------------------------------------------------

export interface PieceRestoreDialogProps {
  pieceName: string;
  open: boolean;
  onClose: () => void;
  /** Recibe el motivo sin espacios sobrantes, o `null` si la persona no escribió ninguno. */
  onRestore: (reason: string | null) => Promise<DialogOutcome>;
}

export function PieceRestoreDialog({ pieceName, open, onClose, onRestore }: PieceRestoreDialogProps) {
  const titleId = useId();
  const [reason, setReason] = useState("");
  const submit = useSubmitState();

  function handleClosed() {
    setReason("");
    submit.reset();
    onClose();
  }

  return (
    <DialogShell
      open={open}
      onClosed={handleClosed}
      titleId={titleId}
      title="Restaurar pieza"
      description={
        <>
          La pieza <strong>{pieceName}</strong> volverá a aparecer en el catálogo y en las búsquedas. Si su código I ya lo usa otra pieza activa, el
          sistema no permitirá restaurarla y se lo indicará aquí.
        </>
      }
      submitLabel="Restaurar pieza"
      submitVariant="primary"
      submitIcon={RotateCcw}
      busy={submit.busy}
      error={submit.error}
      onSubmit={() => void submit.run(() => onRestore(reason.trim() || null), onClose)}
    >
      <Textarea label="Motivo (opcional)" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Corregir código I
// ---------------------------------------------------------------------------------------------

export interface InventoryCodeCorrectionDialogProps {
  pieceName: string;
  /** Código I vigente que se va a reemplazar. */
  currentCode: string;
  open: boolean;
  onClose: () => void;
  /** Recibe el código nuevo y el motivo ya sin espacios sobrantes. */
  onCorrect: (input: { newValue: string; reason: string }) => Promise<DialogOutcome>;
}

export function InventoryCodeCorrectionDialog({ pieceName, currentCode, open, onClose, onCorrect }: InventoryCodeCorrectionDialogProps) {
  const titleId = useId();
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<CorrectionErrors>({});
  const submit = useSubmitState();

  function handleClosed() {
    setNewValue("");
    setReason("");
    setErrors({});
    submit.reset();
    onClose();
  }

  function handleSubmit() {
    const found = validateCorrection({ currentCode, newValue, reason });
    setErrors(found);
    if (found.newValue || found.reason) return;
    void submit.run(() => onCorrect({ newValue: newValue.trim(), reason: reason.trim() }), onClose);
  }

  return (
    <DialogShell
      open={open}
      onClosed={handleClosed}
      titleId={titleId}
      title="Corregir el código I"
      description={
        <>
          Va a reemplazar el código <strong>{currentCode}</strong> de <strong>{pieceName}</strong>. El código anterior no se borra: queda en el
          historial como no vigente, y la corrección queda registrada en la auditoría con su usuario y el motivo (RN-002, RN-005).
        </>
      }
      submitLabel="Corregir código I"
      submitVariant="danger"
      submitIcon={ShieldCheck}
      busy={submit.busy}
      error={submit.error}
      onSubmit={handleSubmit}
    >
      <Input
        id={`${titleId}-nuevo`}
        label="Código I nuevo (obligatorio)"
        required
        value={newValue}
        error={errors.newValue}
        onChange={(event) => {
          setNewValue(event.target.value);
          setErrors((current) => ({ ...current, newValue: undefined }));
        }}
      />
      <Textarea
        label="Motivo de la corrección (obligatorio)"
        required
        rows={2}
        value={reason}
        error={errors.reason}
        onChange={(event) => {
          setReason(event.target.value);
          setErrors((current) => ({ ...current, reason: undefined }));
        }}
      />
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Confirmar separación de códigos concatenados
// ---------------------------------------------------------------------------------------------

/** Un código propuesto por el servidor al separar un valor concatenado (forma de `SplitProposal`). */
export interface SplitProposalItem {
  identifier_type_code: string;
  original_value: string;
  normalized_value: string | null;
}

export interface ConcatenatedCodesDialogProps {
  /** Valor tal como lo escribió la persona. */
  originalValue: string;
  proposals: readonly SplitProposalItem[];
  open: boolean;
  onClose: () => void;
  /** Se llama solo tras la confirmación explícita; registra cada código por separado. */
  onConfirm: () => Promise<DialogOutcome>;
}

export function ConcatenatedCodesDialog({ originalValue, proposals, open, onClose, onConfirm }: ConcatenatedCodesDialogProps) {
  const titleId = useId();
  const submit = useSubmitState();

  function handleClosed() {
    submit.reset();
    onClose();
  }

  return (
    <DialogShell
      open={open}
      onClosed={handleClosed}
      titleId={titleId}
      title="Confirmar separación de códigos"
      description={
        <>
          El valor <strong>{originalValue}</strong> parece reunir {proposals.length === 1 ? "un código" : `${proposals.length} códigos`}. El sistema
          no los separa solo (RF-023): revise la propuesta y confirme que cada uno se registre por separado.
        </>
      }
      submitLabel={splitConfirmLabel(proposals.length)}
      submitVariant="primary"
      submitIcon={Scissors}
      cancelLabel="No separar, volver a editar"
      submitDisabled={proposals.length === 0}
      busy={submit.busy}
      error={submit.error}
      onSubmit={() => void submit.run(onConfirm, onClose)}
    >
      <ol aria-label="Códigos propuestos" className="flex flex-col gap-2">
        {proposals.map((proposal, index) => (
          <li key={`${proposal.identifier_type_code}-${proposal.original_value}-${index}`} className="rounded-md bg-crema-light p-3 text-base text-tinta">
            <span className="font-medium">{proposal.identifier_type_code}</span> — <span className="font-mono">{proposal.original_value}</span>
            <p className="text-sm text-gris-texto">
              {proposal.normalized_value ? (
                <>
                  Normalizado: <span className="font-mono">{proposal.normalized_value}</span>
                </>
              ) : (
                "No normalizable."
              )}
            </p>
          </li>
        ))}
        {proposals.length === 0 && <li className="text-base text-gris-texto">El servidor no propuso ninguna separación.</li>}
      </ol>
    </DialogShell>
  );
}
