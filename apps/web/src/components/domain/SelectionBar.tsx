"use client";

/**
 * Barra de acciones del depósito en la búsqueda (change `fusion-busqueda-deposito`, tarea 3.2; RF-016,
 * RF-017): con piezas elegidas, «Verificar» registra la verificación física de cada una y «Mover a»
 * lleva todas a un lugar final, con la misma operación de lote de la antigua vista de depósito. Antes de
 * mover se confirma con la lista de piezas y el destino (design, riesgo «seleccionar por error»).
 */
import { CircleCheck, ClipboardCheck, Truck } from "lucide-react";
import { useState } from "react";

import { DestinationPicker } from "@/components/domain/DepositoParts";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { DestinationOption } from "@/lib/data/locations";
import type { Selection } from "@/lib/data/selection";

export type SelectionBarStage = "idle" | "choose" | "confirm";

export interface SelectionFeedback {
  kind: "ok" | "error";
  text: string;
}

export interface SelectionBarProps {
  selection: Selection;
  /** Lugares finales (`finalLocations`): una pieza no queda en una sede ni en un mueble con niveles. */
  destinations: readonly DestinationOption[];
  busy?: boolean;
  feedback?: SelectionFeedback | null;
  onVerify: () => void;
  onMove: (toLocationId: string, reason: string) => void;
  /** Etapa y destino con los que abre (pruebas). */
  initialStage?: SelectionBarStage;
  initialDestination?: string;
}

export function SelectionBar({
  selection,
  destinations,
  busy = false,
  feedback,
  onVerify,
  onMove,
  initialStage = "idle",
  initialDestination = "",
}: SelectionBarProps) {
  const [stage, setStage] = useState<SelectionBarStage>(initialStage);
  const [destination, setDestination] = useState(initialDestination);
  const [reason, setReason] = useState("");
  const count = selection.size;
  if (count === 0 && !feedback) return null;
  const destinationLabel = destinations.find((option) => option.id === destination)?.label;
  const pieces = `${count} pieza${count === 1 ? "" : "s"}`;

  return (
    // En tableta, fija abajo y a todo el ancho, con botones táctiles; desde lg, en su lugar (design D4).
    <Card
      as="section"
      aria-label="Acciones con las piezas seleccionadas"
      padded={false}
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-none p-4 shadow-lg lg:static lg:z-auto lg:rounded-lg lg:shadow-sm"
    >
      {feedback &&
        (feedback.kind === "ok" ? (
          <p role="status" className="flex items-center gap-2 rounded-md bg-verde-bg px-3 py-2 text-sm text-verde-exito">
            <CircleCheck size={18} aria-hidden="true" />
            {feedback.text}
          </p>
        ) : (
          <p role="alert" className="rounded-md bg-carmin-bg px-3 py-2 text-sm text-carmin-texto">
            {feedback.text}
          </p>
        ))}
      {count > 0 && stage === "idle" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-tinta">{pieces} seleccionada{count === 1 ? "" : "s"}</span>
          <Button variant="secondary" size="touch" icon={ClipboardCheck} disabled={busy} onClick={onVerify}>
            Verificar
          </Button>
          <Button size="touch" icon={Truck} disabled={busy} onClick={() => setStage("choose")}>
            Mover a…
          </Button>
        </div>
      )}
      {count > 0 && stage === "choose" && (
        <div className="flex flex-col gap-3">
          <DestinationPicker options={destinations} value={destination} onChange={setDestination} label={`Mover ${pieces} a`} />
          <Input label="Motivo (opcional)" value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="touch" disabled={!destination} onClick={() => setStage("confirm")}>
              Revisar el traslado
            </Button>
            <Button variant="secondary" size="touch" onClick={() => setStage("idle")}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {count > 0 && stage === "confirm" && destinationLabel && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-tinta">
            ¿Mover {pieces} a {destinationLabel}?
          </h2>
          <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto text-sm text-tinta" aria-label="Piezas que se moverán">
            {[...selection.values()].map((piece) => (
              <li key={piece.id}>
                <span className="font-mono font-bold text-terracota">{piece.codeI ?? "Sin código I"}</span> {piece.denomination}
                <span className="text-gris-texto"> · ahora en {piece.locationLabel ?? "sin ubicación"}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              size="touch"
              icon={Truck}
              disabled={busy}
              onClick={() => {
                onMove(destination, reason);
                setStage("idle");
              }}
            >
              Confirmar el traslado
            </Button>
            <Button variant="secondary" size="touch" onClick={() => setStage("choose")}>
              Volver
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
