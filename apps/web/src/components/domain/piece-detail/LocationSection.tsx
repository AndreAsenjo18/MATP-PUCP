"use client";

import { ShieldCheck, Truck } from "lucide-react";
import { useState } from "react";

import { PieceCurrentLocation } from "@/components/domain/PieceSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { LOCATIONS, locationPath } from "@/lib/fixtures";

type PieceDetail = ApiSchemas["PieceDetail"];
type MovementOut = ApiSchemas["MovementOut"];

export function LocationSection({
  pieceId,
  piece,
  movements,
}: {
  pieceId: string;
  piece: PieceDetail;
  movements: MovementOut[];
}) {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [targetLocationId, setTargetLocationId] = useState(LOCATIONS[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-4">
      <PieceCurrentLocation location={piece.location} />

      {hasPermission("movements.register") && (
        <Card
          as="section"
          aria-label="Registrar movimiento"
          className="flex flex-wrap items-end gap-3"
        >
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              const location = LOCATIONS.find((l) => l.id === targetLocationId);
              if (!location) return;
              store.registerMovement(
                pieceId,
                { id: location.id, code: location.code, name: location.name, level: location.level },
                "MOVE",
                "Movimiento registrado desde la ficha (maqueta).",
                currentUser?.full_name ?? currentRole?.name ?? "Persona sintética",
                currentUser?.id ?? "",
              );
            }}
          >
            <Select label="Nueva ubicación" value={targetLocationId} onChange={(event) => setTargetLocationId(event.target.value)} fieldClassName="w-full min-w-0 lg:w-auto lg:flex-1">
              {LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {locationPath(location.id).map((l) => l.name).join(" / ")}
                </option>
              ))}
            </Select>
            <Button type="submit" size="lg" icon={Truck} className="w-full sm:w-auto">
              Registrar movimiento
            </Button>
            <Button
              variant="outline"
              size="lg"
              icon={ShieldCheck}
              className="w-full sm:w-auto"
              onClick={() =>
                store.registerMovement(
                  pieceId,
                  piece.location.path.at(-1) ?? { id: "", code: "", name: "sin ubicación", level: "Sede" },
                  "VERIFICATION",
                  "Verificación física registrada desde la ficha.",
                  currentUser?.full_name ?? currentRole?.name ?? "Persona sintética",
                  currentUser?.id ?? "",
                )
              }
            >
              Registrar verificación física
            </Button>
          </form>
        </Card>
      )}

      <Card as="section" aria-label="Historial de movimientos">
        <h3 className="text-base font-semibold text-tinta">Historial de movimientos</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {movements
            .slice()
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
            .map((m) => (
              <li key={m.id} className="border-t border-borde pt-2 text-base text-tinta first:border-t-0 first:pt-0">
                <span className="font-medium">{m.movement_type === "MOVE" ? "Movimiento" : m.movement_type === "VERIFICATION" ? "Verificación física" : "Corrección"}</span>{" "}
                — {new Date(m.occurred_at).toLocaleString("es-PE")} · {m.performed_by_label ?? "—"}
                {m.movement_type === "MOVE" && (
                  <p className="text-sm text-gris-texto">
                    {m.from_location?.name ?? "Sin ubicación"} → {m.to_location?.name ?? "Sin ubicación"}
                  </p>
                )}
                {m.reason && <p className="text-sm text-gris-texto">{m.reason}</p>}
              </li>
            ))}
          {movements.length === 0 && <li className="text-base text-gris-texto">Sin movimientos registrados.</li>}
        </ul>
      </Card>
    </div>
  );
}
