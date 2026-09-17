"use client";

/**
 * Pantalla 11 — Vista móvil de depósito (RNF-001): buscar por código, ver fotos y ubicación,
 * registrar movimiento o verificación física. Diseño de una sola columna, botones grandes,
 * pensado para un teléfono de ~360 px de ancho usado de pie en el depósito.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import { PermissionNotice } from "@/components/AppShell";
import { RequireSession } from "@/components/RequireSession";
import { useSession } from "@/lib/auth/session";
import { useMockStore } from "@/lib/data/mock-store";
import { getPieceMedia, listPieces, LOCATIONS, locationPath } from "@/lib/fixtures";

function DepositoContent() {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetLocationId, setTargetLocationId] = useState(LOCATIONS[0]?.id ?? "");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const results = useMemo(() => (q.trim() ? listPieces({ q, pageSize: 8 }).items : []), [q]);
  const selected = selectedId ? store.pieces[selectedId] : undefined;
  const media = selectedId ? getPieceMedia(selectedId) : [];

  if (!hasPermission("movements.register")) {
    return <PermissionNotice>Su rol no tiene permiso para registrar movimientos desde el depósito. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Vista de depósito</h1>
        <p className="text-base text-stone-700">Busque por código para verificar o mover una pieza.</p>
      </header>

      <input
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setSelectedId(null);
          setConfirmation(null);
        }}
        placeholder="Código de la pieza"
        className="rounded-md border border-stone-300 p-4 text-lg text-stone-900"
        autoFocus
      />

      {!selected && (
        <ul className="flex flex-col gap-2">
          {results.map((piece) => (
            <li key={piece.id}>
              <button
                type="button"
                onClick={() => setSelectedId(piece.id)}
                className="w-full rounded-lg border border-stone-200 bg-white p-4 text-left"
              >
                <p className="text-lg font-semibold text-stone-900">{piece.title}</p>
                <p className="text-base text-stone-600">{piece.inventory_code ?? "Sin código I"} · {piece.location_label ?? "Sin ubicación"}</p>
              </button>
            </li>
          ))}
          {q.trim() && results.length === 0 && <p className="text-base text-stone-600">Sin resultados.</p>}
        </ul>
      )}

      {selected && (
        <div className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4">
          <button type="button" onClick={() => setSelectedId(null)} className="self-start text-base text-stone-600 underline">
            ← Buscar otra pieza
          </button>
          <h2 className="text-xl font-bold text-stone-900">{selected.title}</h2>
          {media[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- foto sintética en data: URI
            <img src={media[0].download_url ?? undefined} alt={selected.title} className="aspect-[4/3] w-full rounded-md object-cover" />
          )}
          <p className="text-lg text-stone-900">
            Ubicación actual: <strong>{selected.location.path.length > 0 ? selected.location.path.map((l) => l.name).join(" / ") : "Sin ubicación"}</strong>
          </p>
          <Link href={`/piezas/${selected.id}`} className="text-base text-stone-700 underline">
            Ver ficha completa →
          </Link>

          <div className="flex flex-col gap-2 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={() => {
                store.registerMovement(selected.id, selected.location.path.at(-1) ?? { id: "", code: "", name: "sin ubicación", level: "SITE" }, "VERIFICATION", "Verificación física desde vista de depósito.", currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "");
                setConfirmation("Verificación física registrada.");
              }}
              className="rounded-md bg-stone-900 px-4 py-4 text-lg font-semibold text-white"
            >
              Registrar verificación física
            </button>

            <label className="flex flex-col gap-1 text-base text-stone-900">
              Mover a
              <select value={targetLocationId} onChange={(event) => setTargetLocationId(event.target.value)} className="rounded-md border border-stone-300 p-3 text-lg">
                {LOCATIONS.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationPath(location.id).map((l) => l.name).join(" / ")}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                const location = LOCATIONS.find((l) => l.id === targetLocationId);
                if (!location) return;
                store.registerMovement(selected.id, { id: location.id, code: location.code, name: location.name, level: location.level }, "MOVE", "Movimiento desde vista de depósito.", currentUser?.full_name ?? currentRole?.name ?? "Persona sintética", currentUser?.id ?? "");
                setConfirmation("Movimiento registrado.");
              }}
              className="rounded-md border border-stone-300 bg-white px-4 py-4 text-lg font-semibold text-stone-900"
            >
              Registrar movimiento
            </button>
            {confirmation && <p className="rounded-md bg-emerald-50 px-3 py-2 text-base text-emerald-900">{confirmation}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DepositoPage() {
  return (
    <RequireSession>
      <DepositoContent />
    </RequireSession>
  );
}
