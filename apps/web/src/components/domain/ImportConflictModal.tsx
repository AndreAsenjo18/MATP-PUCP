"use client";

/**
 * Diálogo de revisión de una fila de importación en conflicto o posible duplicado (docs/system-design.md
 * §4; `ModalImportacion` en el documento del equipo): compara el valor actual del catálogo con el de la
 * fila y registra la decisión humana aceptar / excluir / rechazar (RF-026, RF-028, RN-005). La regla de
 * decisión es la función pura `resolveConflictDecision`.
 */
import { Ban, Check, MinusCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { ApiSchemas } from "@/lib/api/client";

import { importClassificationStatus } from "./status-intents";
import { StatusBadge } from "./StatusBadges";

type ImportRow = ApiSchemas["ImportRowOut"];
export type ConflictDecision = Exclude<ApiSchemas["RowDecision"], "PENDING">;

export const DEFAULT_EXCLUSION_REASON = "Excluida manualmente en la previsualización.";

export type ConflictResolution = { ok: true; decision: ConflictDecision; reason: string | null } | { ok: false; error: string };

/** Valida la decisión: rechazar exige motivo; excluir usa un motivo por defecto si no se indica. */
export function resolveConflictDecision(decision: ConflictDecision, reason: string): ConflictResolution {
  const trimmed = reason.trim();
  switch (decision) {
    case "ACCEPTED":
      return { ok: true, decision, reason: trimmed || null };
    case "EXCLUDED":
      return { ok: true, decision, reason: trimmed || DEFAULT_EXCLUSION_REASON };
    case "REJECTED":
      return trimmed
        ? { ok: true, decision, reason: trimmed }
        : { ok: false, error: "Indique el motivo del rechazo: quedará registrado en la bitácora de la carga." };
    default:
      return { ok: false, error: "Decisión no reconocida." };
  }
}

function display(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export interface ImportConflictModalProps {
  row: ImportRow;
  open: boolean;
  onClose: () => void;
  onDecide: (decision: ConflictDecision, reason: string | null) => void;
}

export function ImportConflictModal({ row, open, onClose, onDecide }: ImportConflictModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const decide = (decision: ConflictDecision) => {
    const result = resolveConflictDecision(decision, reason);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDecide(result.decision, result.reason);
    onClose();
  };

  const titleId = `conflicto-${row.id}-titulo`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => {
        setReason("");
        setError(null);
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-borde bg-white p-0 text-tinta backdrop:bg-tinta/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold text-tinta">
              Revisar fila {row.source_row_number}
            </h2>
            <StatusBadge status={importClassificationStatus(row.classification)} />
          </div>
          <Button variant="secondary" icon={X} aria-label="Cerrar" onClick={() => dialogRef.current?.close()} />
        </div>

        {row.diff.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base">
              <caption className="pb-2 text-left text-sm text-gris-texto">Diferencias entre el catálogo y la fila del Excel</caption>
              <thead className="text-sm text-gris-texto">
                <tr>
                  <th className="py-1 pr-4 font-medium">Campo</th>
                  <th className="py-1 pr-4 font-medium">Valor actual en el catálogo</th>
                  <th className="py-1 pr-4 font-medium">Valor de la fila</th>
                </tr>
              </thead>
              <tbody>
                {row.diff.map((d) => (
                  <tr key={d.field} className="border-t border-borde">
                    <td className="py-1 pr-4 font-medium">{d.field}</td>
                    <td className="py-1 pr-4">{display(d.current_value)}</td>
                    <td className="py-1 pr-4 font-medium text-terracota-dark">{display(d.incoming_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-base text-gris-texto">La fila no modifica ningún campo existente.</p>
        )}

        {row.validation_errors.length > 0 && (
          <p className="rounded-md bg-carmin-bg p-3 text-sm text-carmin-texto">
            {row.validation_errors.map((e) => (e as { message?: string }).message ?? JSON.stringify(e)).join("; ")}
          </p>
        )}

        <Textarea
          label="Motivo (obligatorio para rechazar)"
          rows={2}
          value={reason}
          error={error ?? undefined}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
        />

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" icon={Check} onClick={() => decide("ACCEPTED")}>
            Aceptar fila
          </Button>
          <Button variant="secondary" icon={MinusCircle} onClick={() => decide("EXCLUDED")}>
            Excluir
          </Button>
          <Button variant="danger" icon={Ban} onClick={() => decide("REJECTED")}>
            Rechazar
          </Button>
        </div>
      </div>
    </dialog>
  );
}
