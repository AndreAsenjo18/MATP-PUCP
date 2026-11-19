"use client";

/**
 * Revisión de filas compacta con Gemini (change `importacion-revision-filas-compacta`; RF-025,
 * RF-026, RIA-02, RN-009).
 *
 * - `RowReviewNotice`: las filas sin problemas se importan solas al aprobar; «Pedir a Gemini que
 *   revise estas N» para las que parecen piezas que ya están.
 * - `RowList`: una línea por fila (número, denominación, código, qué pasa y lo que opina Gemini).
 * - `RowDecisionPanel`: un panel lateral para decidir a qué pieza corresponde una fila, con las
 *   candidatas como tarjetas, la opinión de Gemini preseleccionada y «Aceptar y siguiente». Una fila
 *   sin pieza que elegir (errores, actualizaciones) muestra su tarjeta de siempre.
 *
 * Las reglas están en `lib/data/import-row-review.ts`. Nada se decide por la opinión de Gemini: la
 * persona acepta cada fila (RN-009).
 */
import { Check, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/domain/StatusBadges";
import { importClassificationStatus, importDecisionStatus } from "@/components/domain/status-intents";
import { Button } from "@/components/ui/Button";
import { GeminiStar } from "@/components/ui/GeminiBadge";
import { cn } from "@/lib/cn";
import { OPINION_LABELS, opinionTitle, rowCode, toDecide, type GeminiOpinion } from "@/lib/data/import-row-review";
import { candidatePieces, needsResolution, type ImportRow, type RowDecisionInput } from "@/lib/data/imports";
import { searchPieces, type PieceOption } from "@/lib/data/photoBatches";

export type GeminiReviewState = "idle" | "asking" | "running" | "ready" | "unavailable";

export function RowReviewNotice({
  importedAlone,
  toDecideCount,
  gemini,
  progress,
  canAsk,
  onAsk,
}: {
  /** Filas que se importan al aprobar sin que nadie haga nada. */
  importedAlone: number;
  toDecideCount: number;
  gemini: GeminiReviewState;
  progress?: { done: number; total: number } | null;
  canAsk: boolean;
  onAsk: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-verde-bg px-4 py-3 text-base text-verde-exito">
      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-verde-exito text-white">
        <Check size={16} />
      </span>
      <p className="min-w-0 flex-1">
        <b>
          {importedAlone.toLocaleString("es-PE")} {importedAlone === 1 ? "fila no necesita" : "filas no necesitan"} nada:
        </b>{" "}
        se importan solas al aprobar.{toDecideCount > 0 ? " Decida las que parecen piezas que ya están." : ""}
      </p>
      {toDecideCount > 0 && canAsk && gemini === "idle" && (
        <button
          type="button"
          onClick={onAsk}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gemini-violeta/30 bg-white px-4 font-extrabold text-tinta shadow-[0_3px_14px_rgb(110_110_255/0.35)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
        >
          <GeminiStar size={16} />
          Pedir a Gemini que revise {toDecideCount === 1 ? "esta fila" : `estas ${toDecideCount.toLocaleString("es-PE")}`}
        </button>
      )}
      {(gemini === "asking" || gemini === "running") && (
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gris-texto" aria-live="polite">
          <GeminiStar size={16} />
          {progress && progress.total > 0 ? `Gemini está revisando: ${progress.done} de ${progress.total}` : "Gemini está revisando las filas…"}
        </span>
      )}
      {gemini === "ready" && (
        <span lang="en" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gris-texto">
          <GeminiStar size={16} />
          Powered by{" "}
          <b className="bg-linear-to-r from-gemini-azul-texto via-gemini-violeta-texto to-gemini-rosa-texto bg-clip-text font-extrabold text-transparent forced-colors:text-[CanvasText]">Gemini</b>
        </span>
      )}
      {gemini === "unavailable" && <span className="text-sm font-semibold text-gris-texto">Gemini no respondió: decida las filas igual.</span>}
    </div>
  );
}

const OPINION_CLASSES: Record<GeminiOpinion["verdict"], string> = {
  same: "bg-gemini-violeta/15 text-gemini-violeta-texto",
  distinct: "bg-anil-bg text-anil",
  unsure: "bg-ambar-bg text-ambar-texto",
};

export function OpinionChip({ opinion }: { opinion: GeminiOpinion }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold whitespace-nowrap", OPINION_CLASSES[opinion.verdict])}>
      <GeminiStar size={14} />
      {OPINION_LABELS[opinion.verdict]}
    </span>
  );
}

function rowState(row: ImportRow): ReactNode {
  if (row.has_validation_errors) return <StatusBadge status={{ label: "Con errores", intent: "danger" }} />;
  if (needsResolution(row) && toDecide(row)) return <StatusBadge status={importClassificationStatus(row.classification)} />;
  if (row.decision !== "PENDING") return <StatusBadge status={importDecisionStatus(row.decision)} />;
  if (row.classification === "UPDATE") return <StatusBadge status={{ label: `Actualiza una pieza · ${row.diff.length} ${row.diff.length === 1 ? "cambio" : "cambios"}`, intent: "info" }} />;
  if (needsResolution(row)) return <StatusBadge status={{ label: (row.resolution as { as_new?: boolean } | null)?.as_new ? "Pieza nueva" : "Corresponde a una pieza", intent: "success" }} />;
  return <StatusBadge status={{ label: "Se importa como nueva", intent: "success" }} />;
}

function rowTitleOf(row: ImportRow): string {
  const fields = (row.mapped_data as { fields?: Record<string, unknown> } | null)?.fields;
  const denomination = fields?.denomination;
  return typeof denomination === "string" && denomination.trim() ? denomination.trim() : "Sin denominación";
}

export interface RowPhotoThumb {
  url: string | null;
  count: number;
}

export function RowList({
  rows,
  opinions,
  onOpen,
  photos,
}: {
  rows: readonly ImportRow[];
  opinions: ReadonlyMap<string, GeminiOpinion>;
  onOpen: (row: ImportRow) => void;
  /** Miniatura y número de fotos de cada fila, si el lote trae fotos (fix importacion-esperar-fotos). */
  photos?: ReadonlyMap<string, RowPhotoThumb>;
}) {
  if (rows.length === 0) return <p className="text-base text-gris-texto">No hay filas en esta vista.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-borde">
      <table className="w-full min-w-[44rem] border-collapse text-left text-base">
        <caption className="sr-only">Filas del archivo, una por línea</caption>
        <thead className="bg-crema-light text-sm text-gris-texto">
          <tr>
            <th scope="col" className="w-16 px-4 py-2.5 font-semibold">
              Fila
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Denominación
            </th>
            <th scope="col" className="w-36 px-4 py-2.5 font-semibold">
              Código
            </th>
            {photos && (
              <th scope="col" className="w-24 px-4 py-2.5 font-semibold">
                Fotos
              </th>
            )}
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Qué pasa
            </th>
            <th scope="col" className="w-32 px-4 py-2.5">
              <span className="sr-only">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const opinion = opinions.get(row.id);
            const pending = toDecide(row);
            return (
              <tr key={row.id} className="border-t border-borde">
                <td className="px-4 py-2 text-gris-texto">{row.source_row_number}</td>
                <th scope="row" className="max-w-0 truncate px-4 py-2 text-left font-semibold text-tinta">
                  {rowTitleOf(row)}
                </th>
                <td className="px-4 py-2 font-mono text-sm font-bold text-terracota">{rowCode(row) ?? "—"}</td>
                {photos && (
                  <td className="px-4 py-2">
                    <RowPhotoCell thumb={photos.get(row.id)} />
                  </td>
                )}
                <td className="px-4 py-2">{pending && opinion ? <OpinionChip opinion={opinion} /> : rowState(row)}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant={pending || row.has_validation_errors ? "outline" : "secondary"} onClick={() => onOpen(row)}>
                    {pending ? "Decidir" : row.has_validation_errors ? "Ver" : row.classification === "UPDATE" ? "Ver cambios" : "Ver ficha"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowPhotoCell({ thumb }: { thumb?: RowPhotoThumb }) {
  if (!thumb || thumb.count === 0) return <span className="text-sm text-gris-texto">Sin foto</span>;
  return (
    <span className="inline-flex items-center gap-2">
      {thumb.url ? (
        // Miniatura firmada del almacenamiento: no pasa por el optimizador de imágenes.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.url} alt="" className="size-10 rounded-md border border-borde object-cover" />
      ) : (
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-md bg-crema text-xs text-gris-texto">
          …
        </span>
      )}
      <span className="text-sm text-gris-texto">{thumb.count === 1 ? "1 foto" : `${thumb.count} fotos`}</span>
    </span>
  );
}

export function RowDecisionPanel({
  row,
  position,
  opinion,
  busy,
  canDecide,
  devUser,
  fallback,
  onDecide,
  onClose,
}: {
  row: ImportRow;
  position: { index: number; total: number } | null;
  opinion: GeminiOpinion | null;
  busy: boolean;
  canDecide: boolean;
  devUser?: string;
  /** La tarjeta de siempre, para las filas sin pieza que elegir. */
  fallback: ReactNode;
  /** Guarda la decisión; `next` = pasar a la siguiente fila por decidir. */
  onDecide: (input: RowDecisionInput, next: boolean) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const resolvable = needsResolution(row) && toDecide(row);
  const candidates = candidatePieces(row);
  const [pick, setPick] = useState<string | "new" | null>(opinion?.pick ?? null);
  const [extra, setExtra] = useState<PieceOption | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PieceOption[]>([]);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      void searchPieces(query, devUser).then((result) => {
        if (active && result.status === "ok") setFound(result.value);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, devUser]);

  const accept = () => {
    if (pick === null) return;
    onDecide({ decision: "ACCEPTED", targetPieceId: pick === "new" ? null : pick, asNew: pick === "new" }, true);
  };
  const pieceLabel = (id: string | null) => candidates.find((candidate) => candidate.pieceId === id)?.title ?? null;
  const fileData = Object.entries(row.raw_data as Record<string, unknown>)
    .filter(([key, value]) => !key.startsWith("__") && value !== null && value !== "")
    .slice(0, 6);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && resolvable && pick !== null && !busy && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLButtonElement)) accept();
      }}
      className="fixed inset-y-2 right-2 left-auto m-0 h-auto max-h-none w-[calc(100vw-1rem)] max-w-none flex-col overflow-hidden rounded-panel bg-white p-0 text-tinta shadow-md backdrop:bg-tinta/30 open:flex sm:w-[38rem]"
    >
      <div className="flex flex-col gap-1 border-b border-borde px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-semibold text-gris-texto">
            {resolvable ? "¿A qué pieza corresponde?" : "Fila del archivo"}
            {position ? ` · ${position.index} de ${position.total.toLocaleString("es-PE")}` : ""}
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Cerrar el panel"
            className="grid size-11 place-items-center rounded-full border border-borde hover:bg-crema-light focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <h2 id={titleId} className="text-2xl font-extrabold break-words">
          Fila {row.source_row_number} · {rowTitleOf(row)}
        </h2>
      </div>

      {!resolvable ? (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {row.preview && (
            <details open className="rounded-2xl border border-borde bg-white">
              <summary className="cursor-pointer px-4 py-3 text-base font-extrabold text-tinta">Así quedaría la ficha</summary>
              <div className="px-4 pb-4">
                <PiecePreview preview={row.preview} />
              </div>
            </details>
          )}
          {fallback}
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
            <section aria-label="En el archivo" className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-2xl bg-crema-light p-4 text-sm sm:grid-cols-2">
              <h3 className="font-extrabold text-tinta sm:col-span-2">En el archivo</h3>
              {fileData.map(([key, value]) => (
                <p key={key} className="min-w-0 truncate">
                  <span className="font-semibold text-gris-texto">{key}</span> {String(value)}
                </p>
              ))}
            </section>
            {row.preview && (
              <details className="rounded-2xl border border-borde">
                <summary className="cursor-pointer px-4 py-3 text-base font-extrabold text-tinta">Así quedaría la ficha si es una pieza nueva</summary>
                <div className="px-4 pb-4">
                  <PiecePreview preview={row.preview} />
                </div>
              </details>
            )}

            {opinion && (
              <section aria-label="Lo que opina Gemini" className="flex flex-col gap-1 rounded-2xl border border-gemini-violeta/30 bg-gemini-violeta/5 p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
                  <GeminiStar size={16} />
                  {opinionTitle(opinion, pieceLabel(opinion.pieceId))}
                </p>
                <p className="text-gris-texto">{opinion.reason}</p>
                <p className="text-gris-texto">Revise y confirme: nada se guarda sin «Aceptar».</p>
              </section>
            )}

            <fieldset className="flex flex-col gap-2" disabled={!canDecide || busy}>
              <legend className="mb-2 text-base font-extrabold">Elija la pieza del catálogo, o márquela como nueva</legend>
              {candidates.map((candidate) => (
                <Choice
                  key={candidate.pieceId}
                  checked={pick === candidate.pieceId}
                  disabled={!candidate.available}
                  suggested={opinion?.pick === candidate.pieceId}
                  title={candidate.title}
                  detail={candidate.detail}
                  reason={candidate.reason}
                  onChoose={() => setPick(candidate.pieceId)}
                />
              ))}
              {extra && !candidates.some((candidate) => candidate.pieceId === extra.id) && (
                <Choice checked={pick === extra.id} title={extra.label} detail={[extra.codes, extra.collection].filter(Boolean).join(" · ")} reason="Elegida por usted con el buscador" onChoose={() => setPick(extra.id)} />
              )}
              <Choice checked={pick === "new"} suggested={opinion?.pick === "new"} title="Ninguna: es una pieza nueva" reason="Se crea una pieza nueva con los datos de la fila." onChoose={() => setPick("new")} />
            </fieldset>

            <div className="relative">
              <label className="flex min-h-11 items-center gap-2 rounded-full border border-borde px-4 text-base text-gris-texto focus-within:outline-3 focus-within:outline-terracota">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Buscar otra pieza por código o nombre</span>
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (event.target.value.trim().length < 2) setFound([]);
                  }}
                  placeholder="¿Es otra pieza? Búsquela por código o nombre"
                  className="min-w-0 flex-1 bg-transparent text-tinta outline-none"
                />
              </label>
              {found.length > 0 && (
                <ul className="absolute right-0 left-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-borde bg-white p-1 shadow-lg">
                  {found.map((piece) => (
                    <li key={piece.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setExtra(piece);
                          setPick(piece.id);
                          setQuery("");
                          setFound([]);
                        }}
                        className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-crema-light focus-visible:outline-3 focus-visible:outline-terracota"
                      >
                        <span className="font-bold text-tinta">{piece.label}</span>
                        <span className="text-sm text-gris-texto">{[piece.codes, piece.collection].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {canDecide && (
            <div className="flex flex-wrap items-center gap-3 border-t border-borde px-6 py-4">
              <Button variant="secondary" disabled={busy} onClick={() => onDecide({ decision: "EXCLUDED" }, true)}>
                Dejar fuera
              </Button>
              <Button variant="create" icon={Check} className="ml-auto" disabled={busy || pick === null} onClick={accept}>
                {busy ? "Guardando…" : "Aceptar y siguiente"}
              </Button>
            </div>
          )}
        </>
      )}
    </dialog>
  );
}

function Choice({
  checked,
  disabled = false,
  suggested = false,
  title,
  detail,
  reason,
  onChoose,
}: {
  checked: boolean;
  disabled?: boolean;
  suggested?: boolean;
  title: string;
  detail?: string;
  reason: string;
  onChoose: () => void;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm",
        checked ? "border-2 border-terracota bg-terracota-light/40 p-[11px]" : "border-borde hover:bg-crema-light",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input type="radio" name="pieza-destino" checked={checked} disabled={disabled} onChange={onChoose} className="mt-1 size-4 accent-terracota" />
      <span className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-2 text-base font-extrabold text-tinta">
          {title}
          {suggested && <span className="rounded-full bg-gemini-violeta/15 px-2 text-xs font-extrabold text-gemini-violeta-texto">Sugerida por Gemini</span>}
        </span>
        {detail && <span className="text-tinta">{detail}</span>}
        <span className="text-gris-texto">{reason}</span>
      </span>
    </label>
  );
}

type PiecePreviewData = NonNullable<ImportRow["preview"]>;

const NOT_RECORDED = "Sin registrar";

function previewText(value: string | null | undefined): string {
  return value && value.trim() ? value : NOT_RECORDED;
}

/**
 * «Así quedaría la ficha» (change `importacion-vista-previa-ficha`): la fila como la mostraría la
 * ficha de la pieza nueva, con los mismos grupos y los nombres de los términos y de la ubicación.
 */
export function PiecePreview({ preview }: { preview: PiecePreviewData }) {
  const codes = (preview.codes ?? []).map((code) => (code.type ? `${code.type} ${code.value}` : code.value)).join(" · ");
  const measures = (preview.dimensions ?? [])
    .map((item) => {
      const entry = item as { dimension?: string; value?: number; unit?: string };
      return entry.dimension ? `${entry.dimension.charAt(0).toUpperCase()}${entry.dimension.slice(1)} ${String(entry.value ?? "").replace(".", ",")} ${entry.unit ?? ""}`.trim() : null;
    })
    .filter(Boolean)
    .join(" · ");
  const location = preview.location ?? (preview.location_text ? `«${preview.location_text}»: no existe en el museo` : null);
  const unmatched = preview.unmatched_terms ?? {};
  // A value of the file that is not in the list is shown with its text (not «Sin registrar»), in
  // amber: the person sees it came in the file and has to be added to the list.
  const withUnmatched = (value: string | null | undefined, vocabulary: string): string | null | undefined => {
    const texts = unmatched[vocabulary] ?? [];
    if (texts.length === 0) return value;
    const note = `${texts.map((text) => `«${text}»`).join(", ")}: no está en la lista`;
    return value && value.trim() ? `${value} · ${note}` : note;
  };
  const warned = new Set<string>();
  if (!preview.location && preview.location_text) warned.add("Ubicación");
  for (const [label, vocabulary] of [
    ["Tipo de bien", "OBJECT_TYPE"],
    ["Categoría", "CATEGORY"],
    ["Forma de adquisición", "ACQUISITION_METHOD"],
    ["Materiales", "MATERIAL"],
    ["Estado de conservación", "CONSERVATION_STATUS"],
  ] as const) {
    if ((unmatched[vocabulary] ?? []).length > 0) warned.add(label);
  }
  const groups: { title: string; items: [string, string | null | undefined][] }[] = [
    {
      title: "Identificación",
      items: [
        ["Denominación", preview.denomination],
        ["Colección", preview.collection],
        ["Códigos", codes],
        ["Régimen de tenencia", preview.tenure_regime],
        ["Tipo de bien", withUnmatched(preview.object_type, "OBJECT_TYPE")],
        ["Categoría", withUnmatched(preview.category, "CATEGORY")],
      ],
    },
    { title: "Descripción", items: [["Descripción", preview.description]] },
    {
      title: "Procedencia y época",
      items: [
        ["Procedencia", preview.provenance],
        ["Época (texto original)", preview.epoch_original_text],
        ["Autor", preview.author],
        ["Forma de adquisición", withUnmatched(preview.acquisition_method, "ACQUISITION_METHOD")],
        ["Fecha de ingreso", preview.entry_date],
      ],
    },
    {
      title: "Medidas y materiales",
      items: [
        ["Materiales", withUnmatched((preview.materials ?? []).join(", "), "MATERIAL")],
        ["Medidas (texto original)", preview.dimensions_text],
        ["Medidas detalladas", measures],
      ],
    },
    { title: "Conservación", items: [["Estado de conservación", withUnmatched(preview.conservation_status, "CONSERVATION_STATUS")]] },
    { title: "Ubicación", items: [["Ubicación", location]] },
    { title: "Observaciones", items: [["Observaciones", preview.notes]] },
  ];
  return (
    <div className="flex flex-col divide-y divide-borde">
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="py-3 first:pt-0">
          <h3 className="mb-2 text-sm font-extrabold text-terracota">{group.title}</h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {group.items.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-sm text-gris-texto">{label}</dt>
                <dd className={cn("text-base break-words", warned.has(label) ? "font-semibold text-ambar-texto" : value && value.trim() ? "font-semibold text-tinta" : "text-gris-texto")}>{previewText(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
