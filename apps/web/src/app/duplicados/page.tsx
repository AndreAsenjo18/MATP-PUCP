"use client";

/**
 * Pantalla 7 — Cola de posibles duplicados (RF-030, calidad-datos; change
 * `deteccion-duplicados-y-cola-revision`, tarea 4.1): filtros, comparación lado a lado con las
 * señales resaltadas, resolución como distinto o pospuesto y detección completa bajo demanda.
 * Nunca se borra ninguna pieza (RN-005). Lee la API real en modo `live` y los fixtures en modo
 * `mock` a través de `lib/data/duplicates`; fusionar llega con el asistente de la tarea 4.2.
 */
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_FILTERS,
  DistinctDialog,
  DuplicateCandidateCard,
  DuplicateFilters,
  PostponeDialog,
  ScanPanel,
  formatDate,
  type DuplicateFilterValue,
} from "@/components/domain/DuplicateReview";
import type { DialogOutcome } from "@/components/domain/PieceActionDialogs";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { RequireSession } from "@/components/layout/RequireSession";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import {
  DUPLICATE_PAGE_SIZE,
  fetchComparedPieces,
  fetchDuplicateCollections,
  fetchDuplicateQueue,
  fetchQualityJob,
  isClosedPairFailure,
  resolveDuplicate,
  startDuplicateScan,
  type DuplicateCandidate,
  type DuplicatePage,
  type DuplicateResolutionInput,
  type QualityJob,
} from "@/lib/data/duplicates";

type PieceDetail = ApiSchemas["PieceDetail"];
type CollectionOut = ApiSchemas["CollectionOut"];

/** Cada cuánto se consulta el avance de una detección completa en curso. */
const SCAN_POLL_MS = 2000;

type QueueState =
  | { key: string; status: "ready"; page: DuplicatePage }
  | { key: string; status: "error"; message: string };

type DialogState = { kind: "distinct" | "postpone"; candidate: DuplicateCandidate } | null;
type Notice = { tone: "success" | "warning"; text: string } | null;

function DuplicadosContent() {
  const { hasPermission } = useSession();
  if (!hasPermission("duplicates.resolve")) {
    return <PermissionNotice>Su rol no tiene permiso para resolver duplicados (calidad-datos). Cambie de rol desde la cabecera para probarlo.</PermissionNotice>;
  }
  return <DuplicateQueue />;
}

function DuplicateQueue() {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const canResolve = hasPermission("duplicates.resolve");

  const [filters, setFilters] = useState<DuplicateFilterValue>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [pieces, setPieces] = useState<{ key: string; byId: Record<string, PieceDetail | null> } | null>(null);
  const [collections, setCollections] = useState<CollectionOut[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  // Referencia de los límites para posponer: se fija al abrir el diálogo, no al pintar.
  const [today, setToday] = useState(() => new Date());
  const [notice, setNotice] = useState<Notice>(null);
  const [scan, setScan] = useState<{ job: QualityJob | null; error: string | null; starting: boolean }>({ job: null, error: null, starting: false });

  const query = useMemo(
    () => ({
      status: filters.status || undefined,
      collectionId: filters.collectionId || undefined,
      minScore: filters.minScore ? Number(filters.minScore) : undefined,
      origin: filters.origin || undefined,
      page,
      pageSize: DUPLICATE_PAGE_SIZE,
    }),
    [filters, page],
  );
  const requestKey = JSON.stringify({ query, reload });
  const loading = queue?.key !== requestKey;

  useEffect(() => {
    let active = true;
    fetchDuplicateCollections(devUser).then((items) => {
      if (active) setCollections(items);
    });
    return () => {
      active = false;
    };
  }, [devUser]);

  useEffect(() => {
    let active = true;
    const key = requestKey;
    fetchDuplicateQueue(query, devUser).then(async (result) => {
      if (!active) return;
      if (result.status !== "ok") {
        setQueue({ key, status: "error", message: result.message });
        return;
      }
      setQueue({ key, status: "ready", page: result.page });
      const ids = result.page.items.flatMap((c) => [c.piece_a_id, ...(c.piece_b_id ? [c.piece_b_id] : [])]);
      const byId = await fetchComparedPieces(ids, devUser);
      if (active) setPieces({ key, byId });
    });
    return () => {
      active = false;
    };
  }, [query, requestKey, devUser]);

  const runningJobId = scan.job?.status === "RUNNING" ? scan.job.id : null;
  useEffect(() => {
    if (!runningJobId) return;
    const timer = window.setTimeout(() => {
      fetchQualityJob(runningJobId, devUser).then((result) => {
        if (result.status !== "ok") {
          setScan((current) => ({ ...current, error: result.message }));
          return;
        }
        setScan((current) => ({ ...current, job: result.job }));
        if (result.job.status === "SUCCEEDED") setReload((n) => n + 1);
      });
    }, SCAN_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [runningJobId, scan.job, devUser]);

  const items = queue?.status === "ready" ? queue.page.items : [];
  const total = queue?.status === "ready" ? queue.page.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / DUPLICATE_PAGE_SIZE));
  const byId = useMemo(() => (pieces?.key === queue?.key ? pieces?.byId : undefined) ?? {}, [pieces, queue]);
  const piecesLoading = pieces?.key !== queue?.key;

  function changeFilters(next: DuplicateFilterValue) {
    setFilters(next);
    setPage(1);
    setNotice(null);
  }

  async function startScan() {
    setScan({ job: scan.job, error: null, starting: true });
    const result = await startDuplicateScan(devUser);
    if (result.status === "ok") {
      setScan({ job: result.job, error: null, starting: false });
      if (result.job.status === "SUCCEEDED") setReload((n) => n + 1);
    } else if (result.status === "running") {
      setScan({ job: result.job, error: null, starting: false });
      setNotice({ tone: "warning", text: result.message });
    } else {
      setScan({ job: scan.job, error: result.message, starting: false });
    }
  }

  /** Aplica la resolución; un par ya cerrado u obsoleto cierra el diálogo y recarga la cola. */
  async function resolve(candidate: DuplicateCandidate, input: DuplicateResolutionInput): Promise<DialogOutcome> {
    const result = await resolveDuplicate(candidate.id, input, devUser);
    if (result.status === "ok") {
      setNotice({
        tone: "success",
        text:
          result.candidate.status === "POSTPONED"
            ? `Par pospuesto hasta el ${formatDate(result.candidate.postponed_until)}.`
            : "Par marcado como piezas distintas.",
      });
      setReload((n) => n + 1);
      return { ok: true };
    }
    if (isClosedPairFailure(result)) {
      setNotice({ tone: "warning", text: result.message });
      setReload((n) => n + 1);
      return { ok: true };
    }
    return { ok: false, message: result.message };
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-tinta">Cola de posibles duplicados</h1>
        <p className="text-base text-gris-texto">
          Pares detectados por identificadores normalizados, denominación, colección, autor, procedencia, época y medidas. Compare lado a lado y
          decida: nunca se elimina ninguna pieza, solo se registra la decisión (RN-005).
        </p>
      </header>

      <ScanPanel job={scan.job} error={scan.error} starting={scan.starting} canScan={canResolve} onStart={() => void startScan()} />

      <DuplicateFilters value={filters} collections={collections} onChange={changeFilters} />

      {notice && (
        <p
          role={notice.tone === "warning" ? "alert" : "status"}
          className={notice.tone === "warning" ? "rounded-md bg-ambar-bg p-3 text-base text-ambar-texto" : "rounded-md bg-verde-bg p-3 text-base text-verde-exito"}
        >
          {notice.text}
        </p>
      )}

      {loading && (
        <p role="status" className="text-base text-gris-texto">
          Cargando la cola…
        </p>
      )}
      {!loading && queue?.status === "error" && <PermissionNotice>{queue.message}</PermissionNotice>}
      {!loading && queue?.status === "ready" && (
        <>
          <p className="text-sm text-gris-texto">
            {total === 1 ? "1 par" : `${total} pares`} · página {page} de {pageCount}
          </p>
          <div className="flex flex-col gap-4">
            {items.map((candidate) => (
              <DuplicateCandidateCard
                key={candidate.id}
                candidate={candidate}
                pieceA={byId[candidate.piece_a_id]}
                pieceB={candidate.piece_b_id ? byId[candidate.piece_b_id] : null}
                piecesLoading={piecesLoading}
                canResolve={canResolve}
                onDistinct={() => setDialog({ kind: "distinct", candidate })}
                onPostpone={() => {
                  setToday(new Date());
                  setDialog({ kind: "postpone", candidate });
                }}
              />
            ))}
            {items.length === 0 && <Card className="border-dashed text-center text-base text-gris-texto">No hay pares con estos filtros.</Card>}
          </div>
          {pageCount > 1 && (
            <nav aria-label="Páginas de la cola" className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </nav>
          )}
        </>
      )}

      <DistinctDialog
        open={dialog?.kind === "distinct"}
        onClose={() => setDialog(null)}
        onSubmit={(note) => (dialog ? resolve(dialog.candidate, { resolution: "DISTINCT", note }) : Promise.resolve({ ok: true }))}
      />
      <PostponeDialog
        open={dialog?.kind === "postpone"}
        today={today}
        onClose={() => setDialog(null)}
        onSubmit={(postponedUntil, note) =>
          dialog ? resolve(dialog.candidate, { resolution: "POSTPONED", postponedUntil, note }) : Promise.resolve({ ok: true })
        }
      />
    </div>
  );
}

export default function DuplicadosPage() {
  return (
    <RequireSession>
      <DuplicadosContent />
    </RequireSession>
  );
}
