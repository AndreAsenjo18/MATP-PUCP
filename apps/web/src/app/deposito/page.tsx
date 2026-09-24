"use client";

/**
 * Pantalla 11 — Vista móvil de depósito (RNF-001): buscar por código, ver fotos y ubicación,
 * registrar movimiento o verificación física. Diseño de una sola columna, botones grandes,
 * pensado para un teléfono de ~360 px de ancho usado de pie en el depósito.
 */
import { ArrowLeft, ArrowRight, CircleCheck, MapPin, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
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
  const actor = currentUser?.full_name ?? currentRole?.name ?? "Persona sintética";

  if (!hasPermission("movements.register")) {
    return <PermissionNotice>Su rol no tiene permiso para registrar movimientos desde el depósito. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-tinta">Vista de depósito</h1>
        <p className="text-base text-gris-texto">Busque por código para verificar o mover una pieza.</p>
      </header>

      <Input
        label="Código de la pieza"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setSelectedId(null);
          setConfirmation(null);
        }}
        placeholder="p. ej. I-0236"
        className="p-4 text-lg"
        autoFocus
      />

      {!selected && (
        <ul className="flex flex-col gap-2">
          {results.map((piece) => (
            <li key={piece.id}>
              <button type="button" onClick={() => setSelectedId(piece.id)} className={cardClassName({ interactive: true, className: "w-full text-left" })}>
                <p className="text-lg font-semibold text-tinta">{piece.title}</p>
                <p className="text-base text-gris-texto">
                  <span className="font-mono font-bold text-terracota">{piece.inventory_code ?? "Sin código I"}</span> · {piece.location_label ?? "Sin ubicación"}
                </p>
              </button>
            </li>
          ))}
          {q.trim() && results.length === 0 && <p className="text-base text-gris-texto">Sin resultados.</p>}
        </ul>
      )}

      {selected && (
        <Card className="flex flex-col gap-4">
          <button type="button" onClick={() => setSelectedId(null)} className="flex min-h-11 items-center gap-1 self-start text-base text-gris-texto underline hover:text-terracota">
            <ArrowLeft size={18} aria-hidden="true" />
            Buscar otra pieza
          </button>
          <h2 className="text-xl font-bold text-tinta">{selected.title}</h2>
          {media[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- foto sintética en data: URI
            <img src={media[0].download_url ?? undefined} alt={selected.title} className="aspect-[4/3] w-full rounded-md object-cover" />
          )}
          <p className="flex items-start gap-2 text-lg text-tinta">
            <MapPin size={20} aria-hidden="true" className="mt-1 shrink-0 text-terracota" />
            <span>
              Ubicación actual: <strong>{selected.location.path.length > 0 ? selected.location.path.map((l) => l.name).join(" / ") : "Sin ubicación"}</strong>
            </span>
          </p>
          <Link href={`/piezas/${selected.id}`} className="inline-flex items-center gap-1 text-base text-terracota underline">
            Ver ficha completa
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <div className="flex flex-col gap-2 border-t border-borde pt-4">
            <Button
              size="lg"
              icon={ShieldCheck}
              onClick={() => {
                store.registerMovement(
                  selected.id,
                  selected.location.path.at(-1) ?? { id: "", code: "", name: "sin ubicación", level: "SITE" },
                  "VERIFICATION",
                  "Verificación física desde vista de depósito.",
                  actor,
                  currentUser?.id ?? "",
                );
                setConfirmation("Verificación física registrada.");
              }}
            >
              Registrar verificación física
            </Button>

            <Select label="Mover a" value={targetLocationId} onChange={(event) => setTargetLocationId(event.target.value)} className="p-3 text-lg">
              {LOCATIONS.map((location) => (
                <option key={location.id} value={location.id}>
                  {locationPath(location.id).map((l) => l.name).join(" / ")}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              size="lg"
              icon={Truck}
              onClick={() => {
                const location = LOCATIONS.find((l) => l.id === targetLocationId);
                if (!location) return;
                store.registerMovement(
                  selected.id,
                  { id: location.id, code: location.code, name: location.name, level: location.level },
                  "MOVE",
                  "Movimiento desde vista de depósito.",
                  actor,
                  currentUser?.id ?? "",
                );
                setConfirmation("Movimiento registrado.");
              }}
            >
              Registrar movimiento
            </Button>
            {confirmation && (
              <p role="status" className="flex items-center gap-2 rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">
                <CircleCheck size={18} aria-hidden="true" />
                {confirmation}
              </p>
            )}
          </div>
        </Card>
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
