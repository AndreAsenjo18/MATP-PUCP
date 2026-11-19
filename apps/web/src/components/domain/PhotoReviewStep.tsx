"use client";

/**
 * Paso 3 del asistente «Importar fotografías al catálogo»: revisar y aprobar (change
 * `importacion-fotos-a-catalogo`, tarea 7.4; spec importacion-datos, «Asignación manual de fotos a
 * piezas existentes» y «Foto sin pieza al aprobar»; diseño D8 y D10; RNF-010).
 *
 * Cuadrícula de miniaturas filtrada por carpeta y estado; se eligen con clic (o Espacio/Enter con
 * el teclado), Mayús + clic elige el rango y «Seleccionar todas las de la carpeta» las que se ven.
 * La barra de acciones asigna a una pieza buscada con `/search`, quita, descarta, restaura o
 * confirma una repetida. El panel lateral muestra la pieza propuesta de la foto enfocada con su
 * galería actual, para comparar. Arriba los contadores y, antes de aprobar, lo que quedará fuera.
 *
 * Avance en tiempo real (change `importacion-fotos-progreso`): mientras el servidor prepara las fotos
 * o las aplica, un aviso con barra dice en qué va y si ya se puede salir; se consulta cada 2 s. Al
 * terminar ofrece «Ver las piezas en Búsqueda», filtrada por las piezas que recibieron las fotos.
 */
import { Check, CheckSquare, ImageOff, Search, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { StatusBadge } from "@/components/domain/StatusBadges";
import { Button, DISABLED_STYLES, buttonClassName } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { confirmImportBatch, fetchImportBatch, type ImportBatch } from "@/lib/data/imports";
import { fetchPieceMedia, type PieceMedia } from "@/lib/data/media";
import { getApiMode } from "@/lib/data/mode";
import { fetchPieceDetail } from "@/lib/data/pieces";
import {
  REASON_LABELS,
  TRAY_STATE_LABELS,
  approvalSentence,
  approvalWarnings,
  decidePhotos,
  fetchBatchPhotos,
  fetchPhotoFolders,
  fetchPhotoSummary,
  isPhotoWorkRunning,
  mockPiece,
  photoBatchSearchHref,
  photoProgress,
  searchPieces,
  toggleSelection,
  trayState,
  type BatchPhoto,
  type PhotoOperation,
  type PhotoProgress,
  type PhotoSummary,
  type PieceOption,
  type TrayState,
} from "@/lib/data/photoBatches";

/** Cada cuánto se consulta el avance mientras el servidor trabaja. */
export const PHOTO_PROGRESS_POLL_MS = 2000;

/** «Preparando las fotos: 40 de 120 listas», con su barra y, al terminar, el enlace a la búsqueda. */
export function PhotoProgressPanel({ progress, batchId }: { progress: PhotoProgress; batchId: string }) {
  if (progress.phase === "ready") return null;
  const tone =
    progress.phase === "failed" ? "border-carmin-texto bg-carmin-bg" : progress.phase === "applied" ? "border-verde-exito bg-crema-light" : "border-ambar-alerta bg-ambar-bg/40";
  return (
    <Card as="section" aria-label="Avance de las fotos" aria-live="polite" className={cn("flex flex-col gap-3 border-2", tone)}>
      <h2 className="text-lg font-semibold text-tinta">{progress.title}</h2>
      {progress.phase !== "failed" && (
        <div
          className="h-2 overflow-hidden rounded-full bg-crema"
          role="progressbar"
          aria-label="Avance"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.fraction === null ? undefined : Math.round(progress.fraction * 100)}
        >
          <div
            className={cn("h-full rounded-full bg-terracota transition-[width] duration-300 motion-reduce:transition-none", progress.fraction === null && "w-1/3 animate-pulse motion-reduce:animate-none")}
            style={progress.fraction === null ? undefined : { width: `${Math.max(4, Math.round(progress.fraction * 100))}%` }}
          />
        </div>
      )}
      {progress.hint && <p className={cn("text-base", progress.phase === "failed" ? "text-carmin-texto" : "text-gris-texto")}>{progress.hint}</p>}
      {progress.phase === "applied" && (
        <Link href={photoBatchSearchHref(batchId)} className={cn(buttonClassName({ variant: "primary" }), "self-start")}>
          <Search size={18} aria-hidden="true" />
          Ver las piezas en Búsqueda
        </Link>
      )}
    </Card>
  );
}

const STATE_INTENTS: Record<TrayState, "success" | "warning" | "danger" | "default" | "info"> = {
  proposed: "success",
  manual: "success",
  warning: "warning",
  ambiguous: "warning",
  repeated: "warning",
  unassigned: "default",
  discarded: "info",
};

export interface ReviewFilter {
  folder: string;
  state: TrayState | "";
}

/** Fotos que se ven con el filtro, en el orden de la bandeja. */
export function visiblePhotos(photos: BatchPhoto[], filter: ReviewFilter): BatchPhoto[] {
  return photos.filter(
    (photo) => (!filter.folder || photo.relative_path.startsWith(`${filter.folder}/`)) && (!filter.state || trayState(photo) === filter.state),
  );
}

/** Espacio o Enter eligen la foto enfocada; con Mayús, el rango (RNF-010). */
export function photoKeyDown(photo: BatchPhoto, onPhotoClick?: (photo: BatchPhoto, range: boolean) => void) {
  return (event: Pick<KeyboardEvent<HTMLElement>, "key" | "shiftKey" | "preventDefault">) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onPhotoClick?.(photo, event.shiftKey);
    }
  };
}

/** Contadores de arriba: cuántas fotos hay en cada estado. */
export function stateCounts(photos: BatchPhoto[]): Record<TrayState, number> {
  const counts = Object.fromEntries(Object.keys(TRAY_STATE_LABELS).map((key) => [key, 0])) as Record<TrayState, number>;
  for (const photo of photos) counts[trayState(photo)] += 1;
  return counts;
}

export interface PhotoReviewViewProps {
  photos: BatchPhoto[];
  folders: string[];
  filter: ReviewFilter;
  selected: string[];
  focused: BatchPhoto | null;
  focusedPiece: PieceOption | null;
  focusedGallery: PieceMedia[];
  query: string;
  results: PieceOption[];
  batch: Pick<ImportBatch, "status" | "approval_summary"> | null;
  /** Avance del lote y su id, para el enlace a la búsqueda (change importacion-fotos-progreso). */
  progress?: PhotoProgress | null;
  batchId?: string;
  canApprove: boolean;
  busy: boolean;
  message: string | null;
  error: string | null;
  onFilter?: (filter: ReviewFilter) => void;
  onPhotoClick?: (photo: BatchPhoto, range: boolean) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onQuery?: (text: string) => void;
  onAssign?: (piece: PieceOption) => void;
  onOperation?: (op: PhotoOperation) => void;
  onApprove?: () => void;
}

/** Vista sin estado del paso (se prueba como HTML estático, ADR-012). */
export function PhotoReviewView({
  photos,
  folders,
  filter,
  selected,
  focused,
  focusedPiece,
  focusedGallery,
  query,
  results,
  batch,
  progress = null,
  batchId,
  canApprove,
  busy,
  message,
  error,
  onFilter,
  onPhotoClick,
  onSelectAll,
  onClearSelection,
  onQuery,
  onAssign,
  onOperation,
  onApprove,
}: PhotoReviewViewProps) {
  const shown = visiblePhotos(photos, filter);
  const counts = stateCounts(photos);
  const approval = batch?.approval_summary?.photos ?? null;
  const warnings = approval ? approvalWarnings(approval) : [];
  const preparing = progress?.phase === "processing";
  return (
    <div className="flex flex-col gap-4">
      {progress && batchId && <PhotoProgressPanel progress={progress} batchId={batchId} />}
      <Card as="section" aria-label="Resumen de las fotos" className="flex flex-wrap gap-3">
        {(Object.keys(TRAY_STATE_LABELS) as TrayState[]).map((state) => (
          <button
            key={state}
            type="button"
            aria-pressed={filter.state === state}
            onClick={() => onFilter?.({ ...filter, state: filter.state === state ? "" : state })}
            className={cn(
              "min-h-11 rounded-md px-3 py-1 text-left focus-visible:outline-2 focus-visible:outline-terracota",
              filter.state === state ? "bg-terracota-light" : "bg-crema-light hover:bg-crema",
            )}
          >
            <span className="block font-heading text-xl font-bold text-tinta">{counts[state]}</span>
            <span className="text-sm text-gris-texto">{TRAY_STATE_LABELS[state]}</span>
          </button>
        ))}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[2fr_minmax(16rem,1fr)]">
        <Card as="section" aria-label="Fotos del lote" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-tinta">
              Carpeta
              <select value={filter.folder} onChange={(event) => onFilter?.({ ...filter, folder: event.target.value })} className="min-h-11 rounded-md border border-borde px-3">
                <option value="">Todas</option>
                {folders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" icon={CheckSquare} onClick={onSelectAll} disabled={shown.length === 0}>
              Seleccionar todas las {filter.folder ? "de la carpeta" : "visibles"} ({shown.length})
            </Button>
            {selected.length > 0 && (
              <Button variant="secondary" icon={X} onClick={onClearSelection}>
                Quitar selección
              </Button>
            )}
          </div>
          <p className="text-sm text-gris-texto">Clic o Espacio para elegir una foto; Mayús + clic elige todas las que hay entre dos fotos.</p>

          {shown.length === 0 ? (
            <p className="text-base text-gris-texto">No hay fotos con este filtro.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="Cuadrícula de fotos">
              {shown.map((photo) => {
                const state = trayState(photo);
                const isSelected = selected.includes(photo.id);
                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${photo.relative_path}: ${TRAY_STATE_LABELS[state]}`}
                      onClick={(event: MouseEvent<HTMLButtonElement>) => onPhotoClick?.(photo, event.shiftKey)}
                      onKeyDown={photoKeyDown(photo, onPhotoClick)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-md border-2 p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota",
                        isSelected ? "border-terracota bg-terracota-light" : "border-borde hover:border-terracota",
                      )}
                    >
                      {photo.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatura firmada temporal
                        <img src={photo.thumbnail_url} alt="" className="aspect-square w-full rounded object-cover" />
                      ) : (
                        <span className="flex aspect-square w-full items-center justify-center rounded bg-crema text-gris-texto">
                          <ImageOff size={24} aria-hidden="true" />
                        </span>
                      )}
                      <span className="truncate text-sm text-tinta">{photo.original_filename}</span>
                      <StatusBadge status={{ label: TRAY_STATE_LABELS[state], intent: STATE_INTENTS[state] }} />
                      {photo.match_reason && <span className="text-xs text-gris-texto">{REASON_LABELS[photo.match_reason] ?? photo.match_reason}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card as="section" aria-label="Acciones sobre la selección" className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-tinta">{selected.length === 0 ? "Elija fotos para decidir" : `${selected.length} fotos elegidas`}</h2>
            <label className="flex flex-col gap-1 text-sm text-tinta">
              Asignar a pieza…
              <span className="flex items-center gap-2 rounded-md border border-borde px-2">
                <Search size={16} aria-hidden="true" className="text-gris-texto" />
                <input
                  value={query}
                  onChange={(event) => onQuery?.(event.target.value)}
                  placeholder="Código o denominación (I-0236, Toro…)"
                  className="min-h-11 w-full bg-transparent text-base outline-none"
                  disabled={selected.length === 0}
                />
              </span>
            </label>
            {results.length > 0 && selected.length > 0 && (
              <ul className="flex flex-col gap-1" aria-label="Piezas encontradas">
                {results.map((piece) => (
                  <li key={piece.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onAssign?.(piece)}
                      className={`flex min-h-11 w-full flex-col rounded-md px-2 py-1 text-left hover:bg-crema focus-visible:outline-3 focus-visible:outline-terracota ${DISABLED_STYLES}`}
                    >
                      <span className="text-base text-tinta">{piece.label}</span>
                      <span className="text-sm text-gris-texto">
                        {piece.codes}
                        {piece.collection && ` · ${piece.collection}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={Undo2} disabled={busy || selected.length === 0} onClick={() => onOperation?.("unassign")}>
                Quitar
              </Button>
              <Button variant="secondary" icon={Trash2} disabled={busy || selected.length === 0} onClick={() => onOperation?.("discard")}>
                Descartar
              </Button>
              <Button variant="secondary" disabled={busy || selected.length === 0} onClick={() => onOperation?.("restore")}>
                Restaurar
              </Button>
              <Button variant="secondary" disabled={busy || selected.length === 0} onClick={() => onOperation?.("confirm_duplicate")}>
                Confirmar repetida
              </Button>
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-verde-exito" aria-live="polite">
                {message}
              </p>
            )}
          </Card>

          <Card as="aside" aria-label="Comparar con la pieza" className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-tinta">Comparar</h2>
            {!focused ? (
              <p className="text-sm text-gris-texto">Elija una foto para ver su pieza propuesta y las fotos que ya tiene.</p>
            ) : (
              <>
                <p className="text-sm text-tinta">{focused.relative_path}</p>
                {focused.width_px && focused.height_px && (
                  <p className="text-sm text-gris-texto">
                    {focused.width_px} × {focused.height_px} px
                  </p>
                )}
                {focusedPiece ? (
                  <p className="text-base text-tinta">
                    Pieza: <strong>{focusedPiece.label}</strong> <span className="text-sm text-gris-texto">{focusedPiece.codes}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gris-texto">{focused.piece_id ? "Pieza propuesta" : "Sin pieza"}</p>
                )}
                {focusedGallery.length > 0 && (
                  <ul className="grid grid-cols-3 gap-2" aria-label="Fotos que ya tiene la pieza">
                    {focusedGallery.map((asset) => (
                      <li key={asset.id}>
                        {asset.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- miniatura firmada temporal
                          <img src={asset.thumbnail_url} alt={asset.original_filename ?? ""} className="aspect-square w-full rounded object-cover" />
                        ) : (
                          <span className="block aspect-square rounded bg-crema" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        </div>
      </div>

      <Card as="section" aria-label="Aprobar el lote" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-tinta">Aprobar</h2>
        {batch?.status === "APPLIED" ? (
          <StatusBadge status={{ label: "Fotos aplicadas a sus piezas", intent: "success" }} />
        ) : batch?.status === "APPROVED" ? (
          <StatusBadge status={{ label: "Aprobado: aplicando las fotos", intent: "info" }} />
        ) : approval ? (
          <>
            <p className="text-base text-tinta">{approvalSentence(approval)}</p>
            {/* Cuota de fotos (importacion-masiva-fotografias 5.5): avisa, no bloquea. */}
            {batch?.approval_summary?.photo_quota_warning && (
              <p role="status" className="rounded-md bg-ambar-bg p-3 text-sm text-ambar-texto">
                {batch.approval_summary.photo_quota_warning}
              </p>
            )}
            {warnings.length > 0 && (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ambar-texto" aria-label="Antes de aprobar">
                {warnings.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {canApprove ? (
              <Button icon={Check} className="self-start" disabled={busy || preparing || approval.to_apply === 0} onClick={onApprove}>
                Aprobar y aplicar {approval.to_apply} fotos
              </Button>
            ) : (
              <p className="text-sm text-gris-texto">Su rol puede revisar las fotos pero no aprobar el lote.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gris-texto">El resumen aparece cuando terminan de verificarse las fotos.</p>
        )}
      </Card>
    </div>
  );
}

/** Paso con estado: carga las fotos, decide sobre la selección y aprueba. */
export function PhotoReviewStep({ batchId, devUser, canApprove }: { batchId: string; devUser?: string; canApprove: boolean }) {
  const [photos, setPhotos] = useState<BatchPhoto[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [summary, setSummary] = useState<PhotoSummary | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>({ folder: "", state: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // Galería y ficha de la pieza enfocada, con el id de la pieza a la que pertenecen.
  const [gallery, setGallery] = useState<{ pieceId: string; media: PieceMedia[] } | null>(null);
  const [pieceInfo, setPieceInfo] = useState<PieceOption | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PieceOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, tree, current, counts] = await Promise.all([
      fetchBatchPhotos(batchId, {}, devUser),
      fetchPhotoFolders(batchId, devUser),
      fetchImportBatch(batchId, devUser),
      fetchPhotoSummary(batchId, devUser),
    ]);
    if (list.status === "ok") setPhotos(list.value);
    else setError(list.message);
    if (tree.status === "ok") setFolders(tree.value.folders.map((folder) => folder.path));
    if (current.status === "ok") setBatch(current.value);
    if (counts.status === "ok") setSummary(counts.value);
  }, [batchId, devUser]);

  // Avance en tiempo real: mientras el servidor trabaja se consultan el lote y el resumen (livianos);
  // la cuadrícula se vuelve a leer solo cuando cambia cuántas fotos faltan o el estado del lote.
  const progress = photoProgress(batch, summary);
  const running = isPhotoWorkRunning(progress.phase);
  const seen = useRef("");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void Promise.all([fetchImportBatch(batchId, devUser), fetchPhotoSummary(batchId, devUser)]).then(([current, counts]) => {
        const key = `${current.status === "ok" ? current.value.status : ""}:${counts.status === "ok" ? counts.value.processing : ""}`;
        if (current.status === "ok") setBatch(current.value);
        if (counts.status === "ok") setSummary(counts.value);
        if (seen.current && key !== seen.current) void load();
        seen.current = key;
      });
    }, PHOTO_PROGRESS_POLL_MS);
    return () => clearInterval(timer);
  }, [running, batchId, devUser, load]);

  useEffect(() => {
    // Carga al mostrarse; la función actualiza el estado cuando responde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const focused = photos.find((photo) => photo.id === focusedId) ?? null;
  const focusedPieceId = focused?.piece_id ?? null;
  useEffect(() => {
    if (!focusedPieceId) return;
    void fetchPieceMedia(focusedPieceId, devUser).then((result) => result.status === "ok" && setGallery({ pieceId: focusedPieceId, media: result.media }));
    if (getApiMode() === "mock") return;
    void fetchPieceDetail(focusedPieceId).then((result) => {
      if (result.status !== "ok") return;
      const { piece } = result;
      setPieceInfo({ id: piece.id, label: piece.denomination, codes: piece.code_i ?? "", collection: piece.collection?.name ?? null });
    });
  }, [focusedPieceId, devUser]);
  const focusedPiece = !focusedPieceId ? null : getApiMode() === "mock" ? mockPiece(focusedPieceId) : pieceInfo?.id === focusedPieceId ? pieceInfo : null;
  const focusedGallery = gallery && gallery.pieceId === focusedPieceId ? gallery.media : [];

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchPieces(query, devUser).then((result) => setResults(result.status === "ok" ? result.value : []));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, devUser]);

  const order = useMemo(() => visiblePhotos(photos, filter).map((photo) => photo.id), [photos, filter]);

  const decide = async (op: PhotoOperation, pieceId: string | null = null) => {
    setBusy(true);
    setError(null);
    const result = await decidePhotos(batchId, op, selected, pieceId, devUser);
    setBusy(false);
    if (result.status !== "ok") return setError(result.message);
    setMessage(`${result.value.length} fotos: ${op === "assign" ? "asignadas a la pieza" : "decisión registrada en la bitácora del lote"}.`);
    setSelected([]);
    setQuery("");
    await load();
  };

  return (
    <PhotoReviewView
      photos={photos}
      folders={folders}
      filter={filter}
      selected={selected}
      focused={focused}
      focusedPiece={focusedPiece}
      focusedGallery={focusedGallery}
      query={query}
      results={results}
      batch={batch}
      progress={progress}
      batchId={batchId}
      canApprove={canApprove}
      busy={busy}
      message={message}
      error={error}
      onFilter={setFilter}
      onPhotoClick={(photo, range) => {
        setSelected((current) => toggleSelection(order, current, photo.id, anchor, range));
        setAnchor(photo.id);
        setFocusedId(photo.id);
      }}
      onSelectAll={() => setSelected(order)}
      onClearSelection={() => setSelected([])}
      onQuery={setQuery}
      onAssign={(piece) => void decide("assign", piece.id)}
      onOperation={(op) => void decide(op)}
      onApprove={async () => {
        const summary = batch?.approval_summary;
        if (!summary) return;
        setBusy(true);
        const result = await confirmImportBatch(batchId, summary, null, devUser);
        setBusy(false);
        if (result.status !== "ok") return setError(result.message);
        setBatch(result.value);
        setMessage(null);
      }}
    />
  );
}
