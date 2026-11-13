"use client";

/**
 * Cola de posibles duplicados (RF-030, calidad-datos; change `deteccion-duplicados-y-cola-revision`,
 * tareas 4.1 y 4.2): filtros, comparación lado a lado con las señales resaltadas, resolución como
 * distinto o pospuesto, fusión con el asistente (`MergeWizard`) y detección completa bajo demanda.
 * Nunca se borra ninguna pieza (RN-005). Lee la API real en modo `live` y los fixtures en modo `mock`
 * a través de `lib/data/duplicates`. Tras una fusión la cola se recarga y el aviso enlaza a la ficha
 * de la pieza conservada. Movida desde `app/duplicados/page.tsx` sin cambiar su comportamiento
 * (change `revisar-pendientes-unificado`, tarea 1.2); la página y la bandeja de pendientes la montan.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_FILTERS,
  DistinctDialog,
  DuplicateCandidateCard,
  DuplicateCandidateRow,
  DuplicateFilters,
  IdentifierTypeNamesProvider,
  PostponeDialog,
  QueuePager,
  ScanPanel,
  formatDate,
  type DuplicateFilterValue,
} from "@/components/domain/DuplicateReview";
import { PageHeader } from "@/components/layout/PageHeader";
import { MergeWizard, type MergeSubmission } from "@/components/domain/MergeWizard";
import type { DialogOutcome } from "@/components/domain/PieceActionDialogs";
import { PermissionNotice } from "@/components/layout/PermissionNotice";
import { Card } from "@/components/ui/Card";
import type { ApiSchemas } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import {
  DUPLICATE_PAGE_SIZE,
  fetchComparedPieces,
  fetchDuplicateCollections,
  fetchDuplicateQueue,
  fetchIdentifierTypeNames,
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

/** La fusión guarda las dos fichas al abrirse: una recarga de la cola no cierra el asistente. */
type DialogState =
  | { kind: "distinct" | "postpone"; candidate: DuplicateCandidate }
  | { kind: "merge"; candidate: DuplicateCandidate; pieceA: PieceDetail; pieceB: PieceDetail }
  | null;
type Notice = { tone: "success" | "warning"; text: string; link?: { href: string; label: string } } | null;

export interface DuplicateQueueProps {
  /**
   * Dentro de la bandeja «Revisar pendientes» el título lo pone la bandeja: se omite el `h1` propio
   * y queda la línea de ayuda (change `revisar-pendientes-unificado`, tarea 2.5).
   */
  embedded?: boolean;
  /** Se llama cada vez que la cola se recarga tras resolver un par o terminar una detección. */
  onQueueChanged?: () => void;
}

export function DuplicateQueue({ embedded = false, onQueueChanged }: DuplicateQueueProps = {}) {
  const { currentUser, hasPermission } = useSession();
  const devUser = currentUser?.email;
  const canResolve = hasPermission("duplicates.resolve");

  const [filters, setFilters] = useState<DuplicateFilterValue>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [pieces, setPieces] = useState<{ key: string; byId: Record<string, PieceDetail | null> } | null>(null);
  const [collections, setCollections] = useState<CollectionOut[]>([]);
  const [typeNames, setTypeNames] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<DialogState>(null);
  // Referencia de los límites para posponer: se fija al abrir el diálogo, no al pintar.
  const [today, setToday] = useState(() => new Date());
  const [notice, setNotice] = useState<Notice>(null);
  const [scan, setScan] = useState<{ job: QualityJob | null; error: string | null; starting: boolean }>({ job: null, error: null, starting: false });
  // Un solo par abierto a la vez (design D4).
  const [openId, setOpenId] = useState<string | null>(null);
  // Tras resolver, el foco va a la fila que ocupa el mismo lugar o, si no queda ninguna, al aviso.
  const focusAfterReload = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

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
    fetchIdentifierTypeNames(devUser).then((names) => {
      if (active) setTypeNames(names);
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

  // Toda recarga posterior a la primera viene de una resolución o de una detección terminada.
  useEffect(() => {
    if (reload > 0) onQueueChanged?.();
  }, [reload, onQueueChanged]);

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

  useEffect(() => {
    const index = focusAfterReload.current;
    if (index === null || loading || queue?.status !== "ready") return;
    focusAfterReload.current = null;
    const toggles = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-review-toggle]");
    if (toggles && toggles.length > 0) toggles[Math.min(index, toggles.length - 1)]?.focus();
    else noticeRef.current?.focus();
  }, [queue, loading]);

  /** Cierra el par resuelto y recuerda su lugar para mover el foco cuando llegue la cola nueva. */
  function afterResolution(candidate: DuplicateCandidate) {
    focusAfterReload.current = Math.max(0, items.findIndex((c) => c.id === candidate.id));
    setOpenId(null);
    setReload((n) => n + 1);
  }

  function openMerge(candidate: DuplicateCandidate) {
    const pieceA = byId[candidate.piece_a_id];
    const pieceB = candidate.piece_b_id ? byId[candidate.piece_b_id] : null;
    if (pieceA && pieceB) setDialog({ kind: "merge", candidate, pieceA, pieceB });
  }

  /** Cambia de página y vuelve al principio de la lista (también desde los controles de abajo). */
  function goToPage(next: number) {
    setPage(next);
    setOpenId(null);
    window.scrollTo({ top: 0 });
  }

  function changeFilters(next: DuplicateFilterValue) {
    setFilters(next);
    setPage(1);
    setOpenId(null);
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
  async function resolve(candidate: DuplicateCandidate, input: DuplicateResolutionInput, merged?: { surviving: PieceDetail; absorbed: PieceDetail }): Promise<DialogOutcome> {
    const result = await resolveDuplicate(candidate.id, input, devUser);
    if (result.status === "ok") {
      if (merged) {
        setNotice({
          tone: "success",
          text: `Piezas fusionadas: «${merged.absorbed.denomination}» quedó fusionada en «${merged.surviving.denomination}», que la enlaza desde su ficha.`,
          link: { href: `/piezas/${merged.surviving.id}`, label: `Ver la ficha de «${merged.surviving.denomination}»` },
        });
      } else {
        setNotice({
          tone: "success",
          text:
            result.candidate.status === "POSTPONED"
              ? `Par pospuesto hasta el ${formatDate(result.candidate.postponed_until)}.`
              : "Par marcado como piezas distintas.",
        });
      }
      afterResolution(candidate);
      return { ok: true };
    }
    if (isClosedPairFailure(result)) {
      setNotice({ tone: "warning", text: result.message });
      afterResolution(candidate);
      return { ok: true };
    }
    return { ok: false, message: result.message };
  }

  return (
    <IdentifierTypeNamesProvider names={typeNames}>
      <div className="flex flex-col gap-6">
        {embedded ? (
          <p className="text-base text-gris-texto">Compare cada par y decida. No se borra ninguna pieza.</p>
        ) : (
          <PageHeader title="Cola de posibles duplicados" description="Compare cada par y decida. No se borra ninguna pieza." />
        )}

        <ScanPanel job={scan.job} error={scan.error} starting={scan.starting} canScan={canResolve} onStart={() => void startScan()} />

        <DuplicateFilters value={filters} collections={collections} onChange={changeFilters} />

        {notice && (
          <p
            ref={noticeRef}
            tabIndex={-1}
            role={notice.tone === "warning" ? "alert" : "status"}
            className={notice.tone === "warning" ? "rounded-md bg-ambar-bg p-3 text-base text-ambar-texto" : "rounded-md bg-verde-bg p-3 text-base text-verde-exito"}
          >
            {notice.text}
            {notice.link && (
              <>
                {" "}
                <Link href={notice.link.href} className="font-medium underline">
                  {notice.link.label}
                </Link>
              </>
            )}
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
            <div className="flex flex-col gap-2">
              <p className="text-lg font-bold text-tinta">{total === 1 ? "1 par" : `${total} pares`}</p>
              <QueuePager page={page} pageCount={pageCount} label="Páginas de la cola, arriba" onPage={goToPage} />
            </div>
            {items.length > 0 ? (
              <ul ref={listRef} aria-label="Posibles duplicados" className="flex flex-col gap-3">
                {items.map((candidate) => {
                  const pieceA = byId[candidate.piece_a_id];
                  const pieceB = candidate.piece_b_id ? byId[candidate.piece_b_id] : null;
                  const open = openId === candidate.id;
                  return (
                    <DuplicateCandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      pieceA={pieceA}
                      pieceB={pieceB}
                      piecesLoading={piecesLoading}
                      open={open}
                      onToggle={() => setOpenId(open ? null : candidate.id)}
                    >
                      <DuplicateCandidateCard
                        candidate={candidate}
                        pieceA={pieceA}
                        pieceB={pieceB}
                        piecesLoading={piecesLoading}
                        canResolve={canResolve}
                        onMerge={() => openMerge(candidate)}
                        onDistinct={() => setDialog({ kind: "distinct", candidate })}
                        onPostpone={() => {
                          setToday(new Date());
                          setDialog({ kind: "postpone", candidate });
                        }}
                      />
                    </DuplicateCandidateRow>
                  );
                })}
              </ul>
            ) : (
              <Card className="border-dashed text-center text-base text-gris-texto">No hay pares con estos filtros.</Card>
            )}
            <QueuePager page={page} pageCount={pageCount} label="Páginas de la cola, abajo" onPage={goToPage} />
          </>
        )}

        {dialog?.kind === "merge" && (
          <MergeWizard
            key={dialog.candidate.id}
            candidate={dialog.candidate}
            pieceA={dialog.pieceA}
            pieceB={dialog.pieceB}
            onClose={() => setDialog(null)}
            onSubmit={(submission: MergeSubmission) => {
              const surviving = submission.survivingPieceId === dialog.pieceB.id ? dialog.pieceB : dialog.pieceA;
              const absorbed = surviving === dialog.pieceA ? dialog.pieceB : dialog.pieceA;
              return resolve(dialog.candidate, { resolution: "MERGED", ...submission }, { surviving, absorbed });
            }}
          />
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
    </IdentifierTypeNamesProvider>
  );
}
