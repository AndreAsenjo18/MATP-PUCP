"use client";

/**
 * Pantalla 11 — Vista móvil de depósito (RNF-001): buscar por código, ver fotos y ubicación,
 * registrar movimiento o verificación física. Diseño de una sola columna, botones grandes,
 * pensado para un teléfono de ~360 px de ancho usado de pie en el depósito.
 */
import { ArrowLeft, ArrowRight, CircleCheck, MapPin, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card, cardClassName } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createApiClient, type ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import {
  batchMovePieces,
  fetchLocationsTree,
  LOCATION_ERROR_MESSAGES,
  locationPathLabel,
  movePiece,
  newIdempotencyKey,
  type LocationFailure,
  type LocationNode,
} from "@/lib/data/locations";
import { apiBaseUrl, getApiMode } from "@/lib/data/mode";
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
                <p className="text-lg font-semibold text-tinta">{piece.denomination}</p>
                <p className="text-base text-gris-texto">
                  <span className="font-mono font-bold text-terracota">{piece.code_i ?? "Sin código I"}</span> · {piece.location_label ?? "Sin ubicación"}
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
          <h2 className="text-xl font-bold text-tinta">{selected.denomination}</h2>
          {media[0] && (
            // eslint-disable-next-line @next/next/no-img-element -- foto sintética en data: URI
            <img src={media[0].download_url ?? undefined} alt={selected.denomination} className="aspect-[4/3] w-full rounded-md object-cover" />
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
                  selected.location.path.at(-1) ?? { id: "", code: "", name: "sin ubicación", level: "Sede" },
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

// ------------------------------------------------------------------------------------- modo live
type PieceSummary = ApiSchemas["PieceSummary"];
type PieceDetail = ApiSchemas["PieceDetail"];

interface FlatLocation {
  id: string;
  label: string;
}

function flattenTree(nodes: LocationNode[], prefix: string[] = []): FlatLocation[] {
  return nodes.flatMap((node) => {
    const path = [...prefix, node.name];
    return [{ id: node.id, label: path.join(" › ") }, ...flattenTree(node.children ?? [], path)];
  });
}

interface BatchItem {
  pieceId: string;
  label: string;
  expectedFromLocationId: string | null;
}

function DepositoLive() {
  const { hasPermission, currentUser } = useSession();
  const devUser = currentUser?.email;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PieceSummary[]>([]);
  const [selected, setSelected] = useState<PieceDetail | null>(null);
  const [destinations, setDestinations] = useState<FlatLocation[]>([]);
  const [targetLocationId, setTargetLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchLocationsTree(devUser).then((result) => {
      if (result.status === "ok") setDestinations(flattenTree(result.value));
    });
  }, [devUser]);

  const trimmedQuery = q.trim();

  useEffect(() => {
    if (!trimmedQuery) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const client = createApiClient({ baseUrl: apiBaseUrl(), devUser });
      client
        .GET("/api/v1/pieces", { params: { query: { q: trimmedQuery, limit: 8 } }, signal: controller.signal })
        .then(({ data }) => setResults(data?.items ?? []))
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, devUser]);

  const displayedResults = trimmedQuery ? results : [];

  async function loadDetail(pieceId: string) {
    setError(null);
    setMessage(null);
    const client = createApiClient({ baseUrl: apiBaseUrl(), devUser });
    const { data, error: apiError } = await client.GET("/api/v1/pieces/{piece_id}", { params: { path: { piece_id: pieceId } } });
    if (apiError || !data) {
      setError("No se pudo cargar la pieza.");
      return;
    }
    setSelected(data);
  }

  function describeFailure(failure: LocationFailure): string {
    if (failure.status === "unavailable") return failure.message;
    return LOCATION_ERROR_MESSAGES[failure.code] ?? failure.message;
  }

  async function handleVerify() {
    if (!selected) return;
    setBusy(true);
    const result = await movePiece(selected.id, { movement_type: "VERIFICATION" }, devUser);
    setBusy(false);
    if (result.status === "ok") {
      setMessage("Verificación física registrada.");
      await loadDetail(selected.id);
    } else {
      setError(describeFailure(result));
    }
  }

  async function handleMove() {
    if (!selected || !targetLocationId) return;
    setBusy(true);
    const result = await movePiece(
      selected.id,
      {
        movement_type: "MOVE",
        to_location_id: targetLocationId,
        expected_from_location_id: selected.location.location_id,
        reason: reason.trim() || null,
      },
      devUser,
    );
    setBusy(false);
    if (result.status === "ok") {
      setMessage("Movimiento registrado.");
      await loadDetail(selected.id);
    } else {
      setError(describeFailure(result));
    }
  }

  function addToBatch() {
    if (!selected || batch.some((item) => item.pieceId === selected.id)) return;
    setBatch((current) => [
      ...current,
      { pieceId: selected.id, label: selected.denomination, expectedFromLocationId: selected.location.location_id },
    ]);
    setMessage(`${selected.denomination} agregada al lote (${batch.length + 1}).`);
  }

  async function sendBatch() {
    if (!targetLocationId || batch.length === 0) return;
    setBusy(true);
    const result = await batchMovePieces(
      {
        movement_type: "MOVE",
        to_location_id: targetLocationId,
        reason: reason.trim() || null,
        items: batch.map((item) => ({ piece_id: item.pieceId, expected_from_location_id: item.expectedFromLocationId })),
      },
      newIdempotencyKey(),
      devUser,
    );
    setBusy(false);
    if (result.status === "ok") {
      const failures = result.value.failures ?? [];
      const registered = result.value.registered ?? [];
      if (failures.length === 0) {
        setMessage(`Lote registrado: ${registered.length} pieza(s) trasladadas.`);
        setBatch([]);
      } else {
        setError(`No se registró ningún movimiento: ${failures.length} pieza(s) con problemas.`);
      }
    } else {
      setError(describeFailure(result));
    }
  }

  const actor = currentUser?.full_name ?? "Persona de depósito";

  if (!hasPermission("movements.register")) {
    return <PermissionNotice>Su rol no tiene permiso para registrar movimientos desde el depósito. Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-tinta">Vista de depósito</h1>
        <p className="text-base text-gris-texto">
          Busque por código o denominación para verificar o mover una pieza. Conectado a la API ({actor}).
        </p>
      </header>

      <Input
        label="Buscar pieza"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setSelected(null);
          setMessage(null);
          setError(null);
        }}
        placeholder="p. ej. I-0236"
        className="p-4 text-lg"
        autoFocus
      />

      {!selected && (
        <ul className="flex flex-col gap-2">
          {displayedResults.map((piece) => (
            <li key={piece.id}>
              <button type="button" onClick={() => loadDetail(piece.id)} className={cardClassName({ interactive: true, className: "w-full text-left" })}>
                <p className="text-lg font-semibold text-tinta">{piece.denomination}</p>
                <p className="text-base text-gris-texto">
                  <span className="font-mono font-bold text-terracota">{piece.code_i ?? "Sin código I"}</span> · {piece.location_label ?? "Sin ubicación"}
                </p>
              </button>
            </li>
          ))}
          {trimmedQuery && displayedResults.length === 0 && <p className="text-base text-gris-texto">Sin resultados.</p>}
        </ul>
      )}

      {selected && (
        <Card className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setError(null);
            }}
            className="flex min-h-11 items-center gap-1 self-start text-base text-gris-texto underline hover:text-terracota"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Buscar otra pieza
          </button>
          <h2 className="text-xl font-bold text-tinta">{selected.denomination}</h2>
          <p className="flex items-start gap-2 text-lg text-tinta">
            <MapPin size={20} aria-hidden="true" className="mt-1 shrink-0 text-terracota" />
            <span>
              Ubicación actual: <strong>{selected.location.path.length > 0 ? locationPathLabel(selected.location.path) : "Sin ubicación"}</strong>
            </span>
          </p>
          <Link href={`/piezas/${selected.id}`} className="inline-flex items-center gap-1 text-base text-terracota underline">
            Ver ficha completa
            <ArrowRight size={18} aria-hidden="true" />
          </Link>

          <div className="flex flex-col gap-2 border-t border-borde pt-4">
            <Button size="lg" icon={ShieldCheck} disabled={busy} onClick={handleVerify}>
              Registrar verificación física
            </Button>

            <Select label="Mover a" value={targetLocationId} onChange={(event) => setTargetLocationId(event.target.value)} className="p-3 text-lg">
              <option value="">Seleccione un destino…</option>
              {destinations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.label}
                </option>
              ))}
            </Select>
            <Input label="Motivo (opcional)" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button variant="outline" size="lg" icon={Truck} disabled={busy || !targetLocationId} onClick={handleMove}>
              Registrar movimiento
            </Button>
            <Button variant="secondary" disabled={busy} onClick={addToBatch}>
              Agregar al lote ({batch.length})
            </Button>
            {message && (
              <p role="status" className="flex items-center gap-2 rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito">
                <CircleCheck size={18} aria-hidden="true" />
                {message}
              </p>
            )}
            {error && <p className="rounded-md bg-carmin-peligro/10 px-3 py-2 text-base text-carmin-texto">{error}</p>}
          </div>
        </Card>
      )}

      {batch.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-tinta">Lote pendiente ({batch.length} pieza(s))</h2>
          <ul className="list-disc pl-5 text-base text-tinta">
            {batch.map((item) => (
              <li key={item.pieceId}>{item.label}</li>
            ))}
          </ul>
          <Button size="lg" icon={Truck} disabled={busy || !targetLocationId} onClick={sendBatch}>
            Enviar lote al destino seleccionado
          </Button>
        </Card>
      )}
    </div>
  );
}

export default function DepositoPage() {
  return (
    <RequireSession>
      {getApiMode() === "live" ? <DepositoLive /> : <DepositoContent />}
    </RequireSession>
  );
}
