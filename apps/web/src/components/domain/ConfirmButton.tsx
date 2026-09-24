"use client";

/**
 * Botón para acciones irreversibles o masivas: siempre pide confirmación explícita en lenguaje
 * claro antes de aplicar el cambio (RNF-010, RN-005 — nunca "eliminar" definitivo, siempre
 * "marcar como...", "fusionar", "rechazar" o equivalente con motivo). Se apoya en `Button`.
 */
import type { LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

export interface ConfirmButtonProps {
  label: string;
  confirmTitle: string;
  confirmDescription: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Variante del botón que confirma dentro del diálogo: peligro se mantiene, el resto es primaria. */
export function confirmVariant(variant: ButtonVariant): ButtonVariant {
  return variant === "danger" ? "danger" : "primary";
}

/** Motivo válido para confirmar: obligatorio (no vacío) cuando `requireReason`. */
export function canConfirm(requireReason: boolean, reason: string): boolean {
  return !requireReason || reason.trim().length > 0;
}

export function ConfirmButton({
  label,
  confirmTitle,
  confirmDescription,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "secondary",
  size,
  icon,
  requireReason = false,
  reasonLabel = "Motivo",
  onConfirm,
  disabled,
  className,
}: ConfirmButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  return (
    <>
      <Button variant={variant} size={size} icon={icon} disabled={disabled} onClick={() => dialogRef.current?.showModal()} className={className}>
        {label}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40"
        onClose={() => setReason("")}
      >
        <form
          method="dialog"
          className="flex flex-col gap-4 p-6"
          onSubmit={(event) => {
            if (!canConfirm(requireReason, reason)) {
              event.preventDefault();
              return;
            }
            onConfirm(reason.trim());
          }}
        >
          <h2 className="text-lg font-semibold text-tinta">{confirmTitle}</h2>
          <div className="text-base text-gris-texto">{confirmDescription}</div>
          {requireReason && (
            <Textarea label={reasonLabel} required value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
              {cancelLabel}
            </Button>
            <Button type="submit" variant={confirmVariant(variant)}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
