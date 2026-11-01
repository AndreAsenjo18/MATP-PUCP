"use client";

/**
 * Pantalla 11 — Vista de depósito (RNF-001): buscar por código o nombre, ver ubicación,
 * registrar movimiento o verificación física. Una columna con controles táctiles en celular (se usa
 * de pie, en el depósito) y dos columnas compactas desde `lg` (change `rediseno-ux-deposito`).
 */
import { CircleCheck, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  DepositoLayout,
  DestinationPicker,
  PieceResult,
  PiecePanel,
} from "@/components/domain/DepositoParts";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createApiClient, type ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import {
  batchMovePieces,
  fetchLocationsTree,
  finalLocations,
  finalLocationsFromList,
  LOCATION_ERROR_MESSAGES,
  locationPathLabel,
  movePiece,
  newIdempotencyKey,
  type DestinationOption,
  type LocationFailure,
} from "@/lib/data/locations";
import { apiBaseUrl, getApiMode } from "@/lib/data/mode";
import { useMockStore } from "@/lib/data/mock-store";
import { getPieceMedia, listPieces, LOCATIONS } from "@/lib/fixtures";

const NO_PERMISSION = "Su rol no tiene permiso para registrar movimientos desde el depósito. Cambie de rol desde la cabecera para probarlo.";
const SEARCH_HINT = "Busque por código o nombre para verificar o mover una pieza.";

function Confirmation({ children }: { children: string }) {
  return (
    <p role="status" className="flex items-center gap-2 rounded-md bg-verde-bg px-3 py-2 text-base text-verde-exito lg:text-sm">
      <CircleCheck size={18} aria-hidden="true" />
      {children}
    </p>
  );
}

function ErrorNotice({ children }: { children: string }) {
  return <p role="alert" className="rounded-md bg-carmin-peligro/10 px-3 py-2 text-base text-carmin-texto lg:text-sm">{children}</p>;
}

function NoResults() {
  return <p className="text-base text-gris-texto lg:text-sm">Sin resultados.</p>;
}

function DepositoContent() {
  const { hasPermission, currentUser, currentRole } = useSession();
  const store = useMockStore();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const destinations = useMemo(() => finalLocationsFromList(LOCATIONS), []);
  const [targetLocationId, setTargetLocationId] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const results = useMemo(() => (q.trim() ? listPieces({ q, pageSize: 8 }).items : []), [q]);
  const selected = selectedId ? store.pieces[selectedId] : undefined;
  const media = selectedId ? getPieceMedia(selectedId) : [];
  const actor = currentUser?.full_name ?? currentRole?.name ?? "Persona sintética";

  if (!hasPermission("movements.register")) {
    return <PermissionNotice>{NO_PERMISSION}</PermissionNotice>;
  }

  const search = (
    <>
      <Input
        label="Buscar pieza"
        type="search"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="p. ej. I-0236"
        className="p-3 lg:p-2 lg:text-sm"
        autoComplete="off"
        autoFocus
      />
      <ul className="flex flex-col gap-2">
        {results.map((piece) => (
          <li key={piece.id}>
            <PieceResult
              name={piece.denomination}
              code={piece.code_i}
              location={piece.location_label}
              active={piece.id === selectedId}
              onSelect={() => {
                setSelectedId(piece.id);
                setConfirmation(null);
              }}
            />
          </li>
        ))}
      </ul>
      {q.trim() && results.length === 0 && <NoResults />}
    </>
  );

  const detail = selected ? (
    <PiecePanel
      name={selected.denomination}
      code={selected.code_i}
      location={selected.location.path.length > 0 ? selected.location.path.map((l) => l.name).join(" › ") : "Sin ubicación"}
      href={`/piezas/${selected.id}`}
      photo={media[0]?.download_url ? { src: media[0].download_url, alt: selected.denomination } : undefined}
      onBack={() => setSelectedId(null)}
      verify={
        <Button
          size="touch"
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
          Registrar verificación
        </Button>
      }
      move={
        <>
          <DestinationPicker options={destinations} value={targetLocationId} onChange={setTargetLocationId} />
          <Button
            variant="outline"
            size="touch"
            icon={Truck}
            className="self-start"
            disabled={!targetLocationId}
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
        </>
      }
      feedback={confirmation ? <Confirmation>{confirmation}</Confirmation> : undefined}
    />
  ) : null;

  return <DepositoLayout title="Vista de depósito" subtitle={SEARCH_HINT} search={search} detail={detail} />;
}

// ------------------------------------------------------------------------------------- modo live
type PieceSummary = ApiSchemas["PieceSummary"];
type PieceDetail = ApiSchemas["PieceDetail"];

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
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [targetLocationId, setTargetLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchLocationsTree(devUser).then((result) => {
      if (result.status === "ok") setDestinations(finalLocations(result.value));
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
    setError(null);
    setMessage(null);
    const result = await movePiece(selected.id, { movement_type: "VERIFICATION" }, devUser);
    setBusy(false);
    if (result.status === "ok") {
      await loadDetail(selected.id);
      setMessage("Verificación física registrada.");
    } else {
      setError(describeFailure(result));
    }
  }

  async function handleMove() {
    if (!selected || !targetLocationId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
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
      await loadDetail(selected.id);
      setMessage("Movimiento registrado.");
    } else {
      setError(describeFailure(result));
    }
  }

  function addToBatch() {
    if (!selected || batch.some((item) => item.pieceId === selected.id)) return;
    setError(null);
    setBatch((current) => [
      ...current,
      { pieceId: selected.id, label: selected.denomination, expectedFromLocationId: selected.location.location_id },
    ]);
    setMessage(`${selected.denomination} agregada al lote (${batch.length + 1}).`);
  }

  async function sendBatch() {
    if (!targetLocationId || batch.length === 0) return;
    setBusy(true);
    setError(null);
    setMessage(null);
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

  if (!hasPermission("movements.register")) {
    return <PermissionNotice>{NO_PERMISSION}</PermissionNotice>;
  }

  const search = (
    <>
      <Input
        label="Buscar pieza"
        type="search"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="p. ej. I-0236"
        className="p-3 lg:p-2 lg:text-sm"
        autoComplete="off"
        autoFocus
      />
      <ul className="flex flex-col gap-2">
        {displayedResults.map((piece) => (
          <li key={piece.id}>
            <PieceResult
              name={piece.denomination}
              code={piece.code_i}
              location={piece.location_label}
              active={piece.id === selected?.id}
              onSelect={() => loadDetail(piece.id)}
            />
          </li>
        ))}
      </ul>
      {trimmedQuery && displayedResults.length === 0 && <NoResults />}
      {!selected && error && <ErrorNotice>{error}</ErrorNotice>}
    </>
  );

  const detail = selected ? (
    <PiecePanel
      name={selected.denomination}
      code={selected.code_i}
      location={selected.location.path.length > 0 ? locationPathLabel(selected.location.path) : "Sin ubicación"}
      href={`/piezas/${selected.id}`}
      onBack={() => {
        setSelected(null);
        setError(null);
        setMessage(null);
      }}
      verify={
        <Button size="touch" icon={ShieldCheck} disabled={busy} onClick={handleVerify}>
          Registrar verificación
        </Button>
      }
      move={
        <>
          <DestinationPicker options={destinations} value={targetLocationId} onChange={setTargetLocationId} />
          <Input label="Motivo (opcional)" value={reason} onChange={(event) => setReason(event.target.value)} className="p-3 lg:p-2 lg:text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="touch" icon={Truck} disabled={busy || !targetLocationId} onClick={handleMove}>
              Registrar movimiento
            </Button>
            <Button variant="secondary" size="touch" disabled={busy} onClick={addToBatch}>
              Agregar al lote ({batch.length})
            </Button>
          </div>
        </>
      }
      feedback={
        <>
          {message && <Confirmation>{message}</Confirmation>}
          {error && <ErrorNotice>{error}</ErrorNotice>}
        </>
      }
    />
  ) : null;

  const pending = batch.length > 0 && (
    <Card className="flex flex-col gap-3 lg:p-5">
      <h2 className="text-lg font-semibold text-tinta lg:text-base">Lote pendiente ({batch.length} pieza{batch.length === 1 ? "" : "s"})</h2>
      <ul className="flex flex-wrap gap-2">
        {batch.map((item) => (
          <li key={item.pieceId} className="rounded-md bg-crema px-2 py-1 text-sm font-medium text-tinta">
            {item.label}
          </li>
        ))}
      </ul>
      {!selected && message && <Confirmation>{message}</Confirmation>}
      {!selected && error && <ErrorNotice>{error}</ErrorNotice>}
      {selected === null && <DestinationPicker options={destinations} value={targetLocationId} onChange={setTargetLocationId} label="Destino del lote" />}
      <Button size="touch" icon={Truck} className="self-start" disabled={busy || !targetLocationId} onClick={sendBatch}>
        Enviar lote al destino elegido
      </Button>
    </Card>
  );

  return <DepositoLayout title="Vista de depósito" subtitle={SEARCH_HINT} search={search} detail={detail} extra={pending || undefined} />;
}

export default function DepositoPage() {
  return (
    <RequireSession>
      {getApiMode() === "live" ? <DepositoLive /> : <DepositoContent />}
    </RequireSession>
  );
}
