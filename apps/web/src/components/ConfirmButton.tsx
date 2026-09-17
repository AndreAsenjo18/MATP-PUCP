"use client";

/**
 * Botón para acciones irreversibles o masivas: siempre pide confirmación explícita en lenguaje
 * claro antes de aplicar el cambio (RNF-010, RN-005 — nunca "eliminar" definitivo, siempre
 * "marcar como...", "fusionar", "rechazar" o equivalente con motivo).
 */
import { useId, useRef, useState, type ReactNode } from "react";

interface ConfirmButtonProps {
  label: string;
  confirmTitle: string;
  confirmDescription: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger" | "primary";
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
  disabled?: boolean;
  className?: string;
}

const TONE_STYLES: Record<NonNullable<ConfirmButtonProps["tone"]>, string> = {
  default: "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
  primary: "bg-stone-900 text-white hover:bg-stone-800",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export function ConfirmButton({
  label,
  confirmTitle,
  confirmDescription,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  requireReason = false,
  reasonLabel = "Motivo",
  onConfirm,
  disabled,
  className,
}: ConfirmButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const reasonId = useId();

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
        className={`rounded-md px-4 py-2 text-base font-medium disabled:cursor-not-allowed disabled:opacity-50 ${TONE_STYLES[tone]} ${className ?? ""}`}
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-lg border border-stone-200 p-0 backdrop:bg-stone-900/40"
        onClose={() => setReason("")}
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-6"
          onSubmit={(event) => {
            if (requireReason && !reason.trim()) {
              event.preventDefault();
              return;
            }
            onConfirm(reason.trim());
          }}
        >
          <h2 className="text-lg font-semibold text-stone-900">{confirmTitle}</h2>
          <div className="text-base text-stone-700">{confirmDescription}</div>
          {requireReason && (
            <label htmlFor={reasonId} className="flex flex-col gap-1 text-sm text-stone-700">
              {reasonLabel}
              <textarea
                id={reasonId}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                className="rounded-md border border-stone-300 p-2 text-base text-stone-900"
              />
            </label>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-stone-300 px-4 py-2 text-base text-stone-700 hover:bg-stone-100"
            >
              {cancelLabel}
            </button>
            <button type="submit" className={`rounded-md px-4 py-2 text-base font-medium ${TONE_STYLES[tone === "default" ? "primary" : tone]}`}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
