"use client";

/**
 * Formulario para registrar un identificador en una pieza (change `ficha-pieza-crud`, tarea 4.4;
 * design D5; RF-002, RF-023).
 *
 * Si la API responde 422 `concatenated_identifier` con propuestas (`addIdentifier` lo informa como
 * `needs_split`), se abre `ConcatenatedCodesDialog`; solo al confirmarlo se registra **cada** código por
 * separado con `confirmed_split: true` (`registerSplitIdentifiers`). Nada se separa automáticamente.
 *
 * Ese registro no es atómico (una petición por código): si uno falla, el diálogo se queda con los códigos
 * que faltan, para que reintentar no duplique los que ya quedaron registrados.
 */
import { Plus } from "lucide-react";
import { useState } from "react";

import { ConcatenatedCodesDialog, type DialogOutcome } from "@/components/domain/PieceActionDialogs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { ApiSchemas } from "@/lib/api/client";
import {
  addIdentifier,
  registerSplitIdentifiers,
  type IdentifierAddResult,
  type SplitIdentifiersResult,
  type SplitProposal,
} from "@/lib/data/pieces";

type IdentifierOut = ApiSchemas["IdentifierOut"];

export const IDENTIFIER_VALUE_REQUIRED = "Escriba el código que quiere registrar.";
const GENERIC_FAILURE = "No se pudo registrar el identificador. Intente nuevamente.";

/** Lo que el formulario muestra tras intentar registrar un valor. */
export type AddFlowStatus =
  | { kind: "registered"; message: string }
  | { kind: "needs_split"; proposals: SplitProposal[] }
  | { kind: "error"; message: string };

/** Traduce el resultado de `addIdentifier` a lo que se muestra (función pura, se prueba sin DOM). */
export function statusFromAdd(result: IdentifierAddResult, value: string): AddFlowStatus {
  if (result.status === "ok") return { kind: "registered", message: `El código «${value}» quedó registrado.` };
  if (result.status === "needs_split") return { kind: "needs_split", proposals: result.proposals };
  return { kind: "error", message: result.message };
}

/** Propuestas que aún faltan registrar tras un fallo parcial (se registran en orden y se detienen en el primer error). */
export function remainingProposals(proposals: readonly SplitProposal[], registeredCount: number): SplitProposal[] {
  return proposals.slice(registeredCount);
}

export function splitSuccessMessage(count: number): string {
  return count === 1 ? "1 código quedó registrado." : `${count} códigos quedaron registrados por separado.`;
}

/** Resultado del diálogo de separación; en un fallo parcial avisa de lo que ya quedó registrado. */
export function outcomeFromSplit(result: SplitIdentifiersResult): DialogOutcome {
  if (result.status === "ok") return { ok: true };
  const done = result.identifiers.length;
  const reason = result.failure.message;
  if (done === 0) return { ok: false, message: `No se pudo registrar «${result.failedValue}»: ${reason}` };
  const registered = done === 1 ? "Ya quedó registrado 1 código" : `Ya quedaron registrados ${done} códigos`;
  return { ok: false, message: `${registered}; falló «${result.failedValue}»: ${reason} Al reintentar solo se enviarán los que faltan.` };
}

export interface IdentifierTypeOption {
  code: string;
  label: string;
}

export interface IdentifierAddFormProps {
  pieceId: string;
  types: readonly IdentifierTypeOption[];
  /** Identificadores que ya quedaron registrados; `originalValue` es el valor concatenado si hubo separación. */
  onRegistered?: (identifiers: IdentifierOut[], originalValue: string | null) => void;
}

interface PendingSplit {
  originalValue: string;
  proposals: SplitProposal[];
  source: string | null;
}

export function IdentifierAddForm({ pieceId, types, onRegistered }: IdentifierAddFormProps) {
  const [typeCode, setTypeCode] = useState(types[0]?.code ?? "");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [valueError, setValueError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingSplit | null>(null);

  async function handleSubmit() {
    if (busy) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setValueError(IDENTIFIER_VALUE_REQUIRED);
      return;
    }
    setValueError(null);
    setMessage(null);
    setBusy(true);
    const trimmedSource = source.trim() || null;
    let result: IdentifierAddResult;
    try {
      result = await addIdentifier(pieceId, { identifier_type_code: typeCode, value: trimmed, source: trimmedSource });
    } catch {
      result = { status: "unavailable", message: GENERIC_FAILURE };
    }
    setBusy(false);
    const status = statusFromAdd(result, trimmed);
    if (status.kind === "registered" && result.status === "ok") {
      onRegistered?.([result.identifier], null);
      setValue("");
      setMessage({ kind: "ok", text: status.message });
    } else if (status.kind === "needs_split") {
      setPending({ originalValue: trimmed, proposals: status.proposals, source: trimmedSource });
    } else if (status.kind === "error") {
      setMessage({ kind: "error", text: status.message });
    }
  }

  async function handleConfirmSplit(): Promise<DialogOutcome> {
    if (!pending) return { ok: false, message: GENERIC_FAILURE };
    let result: SplitIdentifiersResult;
    try {
      result = await registerSplitIdentifiers(pieceId, pending.proposals, { source: pending.source, splitFrom: pending.originalValue });
    } catch {
      return { ok: false, message: GENERIC_FAILURE };
    }
    if (result.identifiers.length > 0) onRegistered?.(result.identifiers, pending.originalValue);
    if (result.status === "ok") {
      setValue("");
      setMessage({ kind: "ok", text: splitSuccessMessage(result.identifiers.length) });
    } else {
      // Un reintento no debe volver a registrar los que ya quedaron.
      setPending({ ...pending, proposals: remainingProposals(pending.proposals, result.identifiers.length) });
    }
    return outcomeFromSplit(result);
  }

  return (
    <>
      <form
        noValidate
        aria-label="Registrar identificador"
        className="flex flex-col gap-3 rounded-md border border-borde p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <h3 className="text-base font-semibold text-tinta">Registrar un identificador</h3>
        <Select id="identifier-type" label="Tipo de código" value={typeCode} onChange={(event) => setTypeCode(event.target.value)} className="p-2.5">
          {types.map((type) => (
            <option key={type.code} value={type.code}>
              {type.label}
            </option>
          ))}
        </Select>
        <Input
          id="identifier-value"
          label="Código"
          value={value}
          error={valueError ?? undefined}
          hint="Escríbalo tal como figura en la fuente. Si junta varios códigos (por ejemplo «I 2362 / RA 28»), el sistema le propondrá separarlos."
          onChange={(event) => {
            setValue(event.target.value);
            setValueError(null);
          }}
          className="p-2.5"
        />
        <Input id="identifier-source" label="Fuente (opcional)" value={source} onChange={(event) => setSource(event.target.value)} className="p-2.5" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" icon={Plus} disabled={busy}>
            Registrar identificador
          </Button>
          {message && (
            <span role="status" className={message.kind === "ok" ? "text-base font-medium text-verde-exito" : "text-base font-medium text-carmin-texto"}>
              {message.text}
            </span>
          )}
        </div>
      </form>
      {/* Fuera del <form>: el diálogo trae su propio formulario y no pueden anidarse. */}
      {pending && (
        <ConcatenatedCodesDialog
          originalValue={pending.originalValue}
          proposals={pending.proposals}
          open
          onClose={() => setPending(null)}
          onConfirm={handleConfirmSplit}
        />
      )}
    </>
  );
}
