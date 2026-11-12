"use client";

import { useEffect, useState } from "react";

import { PieceCurrentLocation } from "@/components/domain/PieceSheet";
import { Card } from "@/components/ui/Card";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { fetchPieceLocationHistory, type MovementOut } from "@/lib/data/locations";

type PieceDetail = ApiSchemas["PieceDetail"];
type HistoryState = { status: "loading" } | { status: "ok"; entries: MovementOut[] } | { status: "error"; message: string };

/** Integración de solo lectura para la ficha. Las acciones Mover/Verificar siguen a cargo de P3. */
export function LiveLocationSection({ pieceId, piece }: { pieceId: string; piece: PieceDetail }) {
  const { currentUser } = useSession();
  const key = `${pieceId}|${currentUser?.email ?? ""}`;
  const [loaded, setLoaded] = useState<{ key: string; value: HistoryState } | null>(null);

  useEffect(() => {
    let active = true;
    fetchPieceLocationHistory(pieceId, currentUser?.email).then((result) => {
      if (!active) return;
      setLoaded({ key, value: result.status === "ok" ? { status: "ok", entries: result.value } : { status: "error", message: result.message } });
    }).catch(() => {
      if (active) setLoaded({ key, value: { status: "error", message: "No se pudo consultar el historial de ubicaciones." } });
    });
    return () => { active = false; };
  }, [pieceId, currentUser?.email, key]);

  const state: HistoryState = loaded?.key === key ? loaded.value : { status: "loading" };
  return (
    <div className="flex flex-col gap-4">
      <PieceCurrentLocation location={piece.location} />
      <Card as="section" aria-label="Historial de ubicaciones">
        <h2 className="text-base font-semibold text-tinta">Historial de ubicaciones</h2>
        {state.status === "loading" && <p role="status" className="mt-2 text-base text-gris-texto">Cargando movimientos…</p>}
        {state.status === "error" && <p role="alert" className="mt-2 text-base text-ambar-texto">{state.message}</p>}
        {state.status === "ok" && (state.entries.length === 0 ? (
          <p className="mt-2 text-base text-gris-texto">Todavía no hay movimientos registrados.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {state.entries.map((move) => (
              <li key={move.id} className="border-t border-borde pt-3 first:border-0 first:pt-0">
                <p className="text-base font-medium text-tinta">
                  {move.movement_type === "MOVE" ? "Movimiento" : move.movement_type === "VERIFICATION" ? "Verificación" : "Corrección"} · {new Date(move.occurred_at).toLocaleString("es-PE")}
                </p>
                {move.movement_type === "MOVE" && (
                  <p className="text-base text-tinta">{move.from_location?.name ?? "Sin ubicación"} → {move.to_location?.name ?? "Sin ubicación"}</p>
                )}
                {move.reason && <p className="text-base text-gris-texto">{move.reason}</p>}
              </li>
            ))}
          </ul>
        ))}
      </Card>
      <p className="text-base text-gris-texto">Para mover o verificar varias piezas, utiliza la pantalla de Búsqueda.</p>
    </div>
  );
}
