"use client";

/**
 * Cola de posibles duplicados (RF-030, calidad-datos; change `deteccion-duplicados-y-cola-revision`,
 * tareas 4.1 y 4.2): filtros, comparación lado a lado con las señales resaltadas, resolución como
 * distinto o pospuesto, fusión con el asistente (`MergeWizard`) y detección completa bajo demanda.
 * Nunca se borra ninguna pieza (RN-005). Lee la API real en modo `live` y los fixtures en modo `mock`
 * a través de `lib/data/duplicates`. Tras una fusión la cola se recarga y el aviso enlaza a la ficha
 * de la pieza conservada. Movida desde `app/duplicados/page.tsx` sin cambiar su comportamiento
 * (change `revisar-pendientes-unificado`, tarea 1.2); la página y la bandeja de pendientes la montan.
 *
 * Change `revisar-duplicados-comparacion`: filtros en píldoras, la detección completa como un botón
 * discreto junto al número de pares, «Par N de M» para avanzar sin volver a la lista, y al decidir un
 * par se abre solo el siguiente. Un par con fila de Excel se decide aquí mismo (la fila actualiza la
 * pieza o entra como nueva) para quien prepara la carga.
 *
 * Change `ia-juicio-duplicados` (RIA-02, RN-009): con permiso para pedir y aprobar IA, «Deje que
 * Gemini los ordene» separa la cola en tres grupos. Al elegir uno, esta misma lista muestra sus pares
 * con el motivo de Gemini; «misma pieza» y «distintas» se aprueban en bloque (sacando los que no
 * correspondan) y «no está seguro» se revisa uno por uno con la tarjeta de siempre.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AI_GROUPS,
  AiVerdictLine,
  approvableCount,
  GeminiJudgeCard,
  GroupApprovalBar,
  IncludeInApproval,
  SampleCheck,
  sampleComplete,
  type SampleDecision,
} from "@/components/domain/GeminiDuplicates";
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
import { getApiMode } from "@/lib/data/mode";
import {
  AI_RUN_IN_PROGRESS_CODE,
  approveAiGroup,
  DUPLICATE_PAGE_SIZE,
  fetchAiGroup,
  fetchAiRun,
  fetchAiSample,
  fetchLatestAiRun,
  startAiJudgment,
  type AiDuplicateRun,
  type AiGroupName,
  type AiGroupPair,
  fetchComparedPieces,
  fetchDuplicateCollections,
  fetchDuplicateQueue,
  fetchIdentifierTypeNames,
  fetchQualityJob,
  decideDuplicateImportRow,
  isClosedPairFailure,
  resolveDuplicate,
  startDuplicateScan,
  type DuplicateCandidate,
  type DuplicatePage,
  type DuplicateResolutionInput,
  type ImportRowChoice,
  type QualityJob,
} from "@/lib/data/duplicates";

type PieceDetail = ApiSchemas["PieceDetail"];
type CollectionOut = ApiSchemas["CollectionOut"];

/** Cada cuánto se consulta el avance de una detección completa en curso. */
const SCAN_POLL_MS = 2000;
/** Cada cuánto se consulta el avance de Gemini (change `ia-juicio-duplicados`). */
const AI_POLL_MS = 1500;

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
  const canDecideRow = hasPermission("imports.prepare");
  // Pedir y aprobar el juicio de Gemini: los dos permisos de IA, como en «Completar ficha» (D8).
  const canUseAi = hasPermission("ai.request") && hasPermission("ai.review") && getApiMode() !== "mock";

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
  // Lugar de la lista que se abre cuando llegue la cola nueva: el del par resuelto, o el primero al
  // pasar de página con «Par siguiente». Sin pares, el foco va al aviso.
  const [pendingOpen, setPendingOpen] = useState<number | null>(null);
  // Sube cada vez que se abre un par por avance: el efecto lleva el foco a su título.
  const [focusTick, setFocusTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [rowDecision, setRowDecision] = useState<{ id: string; busy: boolean; error: string | null } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  // Gemini: la última corrida, el grupo elegido, lo sacado del grupo y la muestra (D5, D6).
  const [ai, setAi] = useState<{ run: AiDuplicateRun | null; error: string | null; starting: boolean }>({ run: null, error: null, starting: false });
  const [aiGroup, setAiGroup] = useState<AiGroupName | null>(null);
  const [aiItems, setAiItems] = useState<Record<string, AiGroupPair>>({});
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [sample, setSample] = useState<AiGroupPair[]>([]);
  const [sampleDecisions, setSampleDecisions] = useState<Record<string, SampleDecision>>({});
  const [approving, setApproving] = useState(false);
  const aiRunId = ai.run?.id ?? null;
  const aiRunDone = ai.run !== null && ai.run.status !== "RUNNING";
  const aiView = useMemo(() => (aiGroup && aiRunId && aiRunDone ? { runId: aiRunId, group: aiGroup } : null), [aiGroup, aiRunId, aiRunDone]);

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
  const requestKey = JSON.stringify({ query, reload, aiView });
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
    // Con un grupo de Gemini elegido, la misma lista muestra los pares de ese grupo.
    const request: Promise<{ status: "ok"; page: DuplicatePage } | { status: string; message: string }> = aiView
      ? fetchAiGroup(aiView.runId, aiView.group, query.page, DUPLICATE_PAGE_SIZE, devUser).then((r) => {
          if (r.status !== "ok") return r;
          if (active) setAiItems(Object.fromEntries(r.items.map((item) => [item.candidate.id, item])));
          return { status: "ok" as const, page: { items: r.items.map((item) => item.candidate), total: r.total, page: query.page, pageSize: DUPLICATE_PAGE_SIZE } };
        })
      : fetchDuplicateQueue(query, devUser);
    request.then(async (result) => {
      if (!active) return;
      if (result.status !== "ok" || !("page" in result)) {
        setQueue({ key, status: "error", message: "message" in result ? result.message : "No se pudo cargar la cola." });
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
  }, [query, requestKey, devUser, aiView]);

  // La última corrida de Gemini, al abrir la cola.
  useEffect(() => {
    if (!canUseAi) return;
    let active = true;
    fetchLatestAiRun(devUser).then((result) => {
      if (active && result.status === "ok") setAi((current) => ({ ...current, run: result.run }));
    });
    return () => {
      active = false;
    };
  }, [canUseAi, devUser]);

  // Avance en vivo mientras Gemini analiza (D7); al terminar, la lista se recarga.
  const aiRunningId = ai.run?.status === "RUNNING" ? ai.run.id : null;
  useEffect(() => {
    if (!aiRunningId) return;
    const timer = window.setTimeout(() => {
      fetchAiRun(aiRunningId, devUser).then((result) => {
        if (result.status !== "ok") {
          setAi((current) => ({ ...current, error: result.message }));
          return;
        }
        setAi((current) => ({ ...current, run: result.run }));
        if (result.run.status !== "RUNNING") setReload((n) => n + 1);
      });
    }, AI_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [aiRunningId, ai.run, devUser]);

  // La muestra al azar de «misma pieza» (D6).
  const sampleRunId = aiView?.group === "same" ? aiView.runId : null;
  useEffect(() => {
    if (!sampleRunId) return;
    let active = true;
    fetchAiSample(sampleRunId, devUser).then((result) => {
      if (active && result.status === "ok") setSample(result.items);
    });
    return () => {
      active = false;
    };
  }, [sampleRunId, reload, devUser]);

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

  // Tras resolver (o al pasar de página con «Par siguiente»), abre el par que corresponde y lleva el
  // foco a su título; sin pares, el foco va al aviso. Se ajusta al renderizar para evitar un efecto.
  if (pendingOpen !== null && !loading && queue?.status === "ready") {
    setOpenId(items[Math.min(pendingOpen, items.length - 1)]?.id ?? null);
    setPendingOpen(null);
    setFocusTick((tick) => tick + 1);
  }
  useEffect(() => {
    if (focusTick === 0) return;
    if (headingRef.current) headingRef.current.focus();
    else noticeRef.current?.focus();
  }, [focusTick]);

  /** Recuerda el lugar del par resuelto para abrir el siguiente cuando llegue la cola nueva. */
  function afterResolution(candidate: DuplicateCandidate) {
    setPendingOpen(Math.max(0, items.findIndex((c) => c.id === candidate.id)));
    setRowDecision(null);
    setReload((n) => n + 1);
  }

  /** «Es la misma pieza» / «Son piezas distintas» sobre la fila del Excel de un par. */
  async function decideRow(candidate: DuplicateCandidate, choice: ImportRowChoice) {
    setRowDecision({ id: candidate.id, busy: true, error: null });
    const result = await decideDuplicateImportRow(candidate, choice, devUser);
    if (result.status !== "ok") {
      setRowDecision({ id: candidate.id, busy: false, error: result.message });
      return;
    }
    const row = candidate.import_row;
    const piece = byId[candidate.piece_a_id]?.denomination ?? "la pieza del catálogo";
    setNotice({
      tone: "success",
      text:
        choice === "same"
          ? `Decidido: la fila ${row?.source_row_number ?? ""} actualizará «${piece}» al aprobar la carga.`
          : `Decidido: la fila ${row?.source_row_number ?? ""} entrará como pieza nueva al aprobar la carga.`,
    });
    afterResolution(candidate);
  }

  /** Abre el par de al lado; al final de la página pasa a la siguiente y abre su primer par. */
  function openSibling(index: number, step: -1 | 1) {
    const next = items[index + step];
    if (next) {
      setOpenId(next.id);
      return;
    }
    if (step === 1 && page < pageCount) {
      goToPage(page + 1);
      setPendingOpen(0);
    }
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

  async function startAi(resumeRunId?: string) {
    setAi((current) => ({ ...current, error: null, starting: true }));
    const result = await startAiJudgment(resumeRunId, devUser);
    if (result.status === "ok") {
      setAi({ run: result.run, error: null, starting: false });
      chooseAiGroup(null);
      return;
    }
    if (result.status === "rejected" && result.code === AI_RUN_IN_PROGRESS_CODE) {
      const current = await fetchLatestAiRun(devUser);
      setAi({ run: current.status === "ok" ? current.run : ai.run, error: null, starting: false });
      return;
    }
    setAi((current) => ({ ...current, error: result.message, starting: false }));
  }

  /** Elige un grupo de Gemini (o vuelve a toda la cola) y olvida lo marcado en el anterior. */
  function chooseAiGroup(group: AiGroupName | null) {
    setAiGroup(group);
    setExcluded(new Set());
    setSample([]);
    setSampleDecisions({});
    setPage(1);
    setOpenId(null);
    setNotice(null);
  }

  async function approveGroup(group: Exclude<AiGroupName, "unsure">) {
    if (!ai.run) return;
    setApproving(true);
    const sampleOut = Object.entries(sampleDecisions).filter(([, d]) => d === "excluded").map(([id]) => id);
    const confirmed = Object.entries(sampleDecisions).filter(([, d]) => d === "confirmed").map(([id]) => id);
    const result = await approveAiGroup(ai.run.id, group, [...new Set([...excluded, ...sampleOut])], confirmed, devUser);
    setApproving(false);
    if (result.status !== "ok") {
      setNotice({ tone: "warning", text: result.message });
      return;
    }
    const r = result.result;
    const skipped = r.skipped ?? [];
    const done =
      group === "same"
        ? [r.merged && `${r.merged} fusionados`, r.rows_decided && `${r.rows_decided} filas de Excel resueltas hacia su pieza`].filter(Boolean).join(" y ") || "ningún par"
        : `${r.resolved} pares marcados como distintos`;
    const rest = [
      r.excluded && `${r.excluded} sacados del grupo vuelven a la revisión a mano`,
      r.needs_choice && `${r.needs_choice} esperan que elija los valores`,
      skipped.length && `${skipped.length} no se pudieron aplicar`,
    ].filter(Boolean);
    setNotice({ tone: skipped.length ? "warning" : "success", text: `Aprobado: ${done}. ${rest.length ? `${rest.join("; ")}.` : ""}`.trim() });
    setExcluded(new Set());
    setSampleDecisions({});
    const refreshed = await fetchAiRun(ai.run.id, devUser);
    if (refreshed.status === "ok") setAi((current) => ({ ...current, run: refreshed.run }));
    setReload((n) => n + 1);
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

  /** Los dos lados del par en palabras, para la muestra. */
  function pairNames(candidate: DuplicateCandidate): [string, string] {
    const a = byId[candidate.piece_a_id]?.denomination ?? "Pieza del catálogo";
    const b = candidate.piece_b_id ? (byId[candidate.piece_b_id]?.denomination ?? "Pieza del catálogo") : `${candidate.import_row?.denomination ?? "Fila de Excel"} (fila ${candidate.import_row?.source_row_number ?? "?"})`;
    return [a, b];
  }

  /** El veredicto de Gemini bajo la fila y, en los grupos que se aprueban, la casilla para sacarlo. */
  function aiAside(item: AiGroupPair, group: AiGroupName) {
    const approvable = group !== "unsure" && !(group === "same" && item.ready_to_merge === false);
    return (
      <div className="flex flex-col gap-1">
        <AiVerdictLine item={item} />
        {approvable && canResolve && (
          <IncludeInApproval
            checked={!excluded.has(item.candidate.id)}
            label="Incluir en la aprobación"
            onChange={(checked) =>
              setExcluded((current) => {
                const next = new Set(current);
                if (checked) next.delete(item.candidate.id);
                else next.add(item.candidate.id);
                return next;
              })
            }
          />
        )}
      </div>
    );
  }

  return (
    <IdentifierTypeNamesProvider names={typeNames}>
      <div className="flex flex-col gap-6">
        {embedded ? (
          <p className="text-base text-gris-texto">Compare cada par y decida. No se borra ninguna pieza.</p>
        ) : (
          <PageHeader title="Cola de posibles duplicados" description="Compare cada par y decida. No se borra ninguna pieza." />
        )}

        {canUseAi && (
          <GeminiJudgeCard
            run={ai.run}
            error={ai.error}
            starting={ai.starting}
            selected={aiGroup}
            onStart={() => void startAi()}
            onResume={() => void (ai.run && startAi(ai.run.id))}
            onSelect={chooseAiGroup}
          />
        )}

        {aiView ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold text-tinta">{AI_GROUPS.find((g) => g.key === aiView.group)?.title}</h2>
            <button type="button" onClick={() => chooseAiGroup(null)} className="inline-flex min-h-11 items-center font-semibold text-terracota underline">
              Ver toda la cola
            </button>
          </div>
        ) : (
          <DuplicateFilters value={filters} collections={collections} onChange={changeFilters} />
        )}

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
              {/* El número de pares y, discreta a la derecha, la revisión de todo el catálogo. */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold text-tinta">{total === 1 ? "1 par" : `${total} pares`}</p>
                {!aiView && <ScanPanel job={scan.job} error={scan.error} starting={scan.starting} canScan={canResolve} onStart={() => void startScan()} />}
              </div>
              <QueuePager page={page} pageCount={pageCount} label="Páginas de la cola, arriba" onPage={goToPage} />
            </div>
            {aiView?.group === "same" && sample.length > 0 && (
              <SampleCheck
                items={sample}
                decisions={sampleDecisions}
                names={(item) => pairNames(item.candidate)}
                onDecide={(id, decision) =>
                  setSampleDecisions((current) => {
                    const next = { ...current };
                    if (decision) next[id] = decision;
                    else delete next[id];
                    return next;
                  })
                }
              />
            )}
            {aiView && aiView.group !== "unsure" && canResolve && items.length > 0 && (
              <GroupApprovalBar
                group={aiView.group}
                count={approvableCount(aiView.group, Object.values(aiItems), excluded) - Object.values(sampleDecisions).filter((d) => d === "excluded").length}
                needsChoice={Object.values(aiItems).filter((item) => item.ready_to_merge === false).length}
                blockedReason={aiView.group === "same" && !sampleComplete(sample, sampleDecisions) ? "Primero revise la muestra al azar." : null}
                busy={approving}
                onApprove={() => void approveGroup(aiView.group as "same" | "distinct")}
              />
            )}
            {items.length > 0 ? (
              <ul ref={listRef} aria-label="Posibles duplicados" className="flex flex-col gap-3">
                {items.map((candidate, index) => {
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
                      aside={aiView && aiItems[candidate.id] ? aiAside(aiItems[candidate.id], aiView.group) : undefined}
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
                        canDecideRow={canDecideRow}
                        onRowDecision={(choice) => void decideRow(candidate, choice)}
                        deciding={rowDecision?.id === candidate.id && rowDecision.busy}
                        decisionError={rowDecision?.id === candidate.id ? rowDecision.error : null}
                        position={{
                          index: (page - 1) * DUPLICATE_PAGE_SIZE + index + 1,
                          total,
                          onPrevious: index > 0 ? () => openSibling(index, -1) : undefined,
                          onNext: index < items.length - 1 || page < pageCount ? () => openSibling(index, 1) : undefined,
                        }}
                        onClose={() => setOpenId(null)}
                        headingRef={open ? headingRef : undefined}
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
