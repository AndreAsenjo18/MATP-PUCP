"use client";

/**
 * «Así quedarían las piezas» (change `importacion-mapeo-asistido`; RF-022, RF-023, RNF-010, RN-009).
 *
 * La vista con la que se abre «Ajustar columnas»: una fila por dato del catálogo con la columna del
 * archivo de la que sale, quién la propuso (formato, nombre, Gemini o usted) y los valores de las
 * primeras filas. Lo dudoso se marca con el motivo de la IA. Cambiar la columna de un dato es elegir
 * entre las columnas del archivo, con sus ejemplos. Nada se aplica hasta «Se ve bien: validar».
 * Las reglas están en `lib/data/mapping-review.ts`; el editor por columna sigue en «Ver todas las
 * columnas».
 */
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { GeminiBadge } from "@/components/ui/GeminiBadge";
import { cn } from "@/lib/cn";
import type { ColumnOrigin, EditorDraft } from "@/lib/data/mapping-editor";
import {
  assignColumn,
  columnChoices,
  confirmTarget,
  reviewBlocker,
  reviewRows,
  reviewSummary,
  unusedColumns,
  type ReviewRow,
  type SampleRow,
} from "@/lib/data/mapping-review";

export type AiMappingState = "off" | "loading" | "ready" | "unavailable";

const ORIGIN_LABELS: Record<ColumnOrigin, string> = { template: "Formato", auto: "Por el nombre", ai: "Gemini", user: "Usted" };

export function ImportMappingReview({
  draft,
  sampleRows,
  vocabularies = {},
  ai,
  busy,
  error,
  onChange,
  onApply,
  onAdvanced,
  onBack,
}: {
  draft: EditorDraft;
  sampleRows: readonly SampleRow[];
  /** Código de vocabulario → nombre, para los destinos de términos. */
  vocabularies?: Record<string, string>;
  ai: AiMappingState;
  busy: boolean;
  error?: string | null;
  onChange: (draft: EditorDraft) => void;
  onApply: () => void;
  onAdvanced: () => void;
  onBack: () => void;
}) {
  const rows = reviewRows(draft, sampleRows, vocabularies);
  const summary = reviewSummary(rows);
  const unused = unusedColumns(draft);
  const blocker = reviewBlocker(draft);
  const [tried, setTried] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const reading = ai === "loading";
  const sampleCount = Math.max(1, Math.min(3, sampleRows.length));

  return (
    <Card as="section" className="flex flex-col gap-4" aria-labelledby="mapeo-revision-titulo">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="mapeo-revision-titulo" className="text-xl font-extrabold text-tinta">
          {reading ? "Gemini está leyendo las columnas…" : "Así quedarían las piezas"}
        </h2>
        {ai !== "off" && <GeminiBadge />}
        <p className="ml-auto text-base text-gris-texto" aria-live="polite">
          <b className="text-tinta">
            {summary.found} de {summary.total}
          </b>{" "}
          datos encontrados
          {summary.doubts > 0 && (
            <>
              {" · "}
              <b className="text-ambar-texto">{summary.doubts}</b> por confirmar
            </>
          )}
        </p>
      </div>
      {ai === "unavailable" && <p className="text-base text-gris-texto">Gemini no respondió: revise las columnas propuestas por el formato y por el nombre de cada columna.</p>}

      <div className="overflow-x-auto rounded-2xl border border-borde">
        <table className="w-full min-w-[56rem] border-collapse text-left text-base">
          <caption className="sr-only">De qué columna del archivo sale cada dato del catálogo, con los valores de las primeras filas</caption>
          <thead className="bg-crema-light text-sm text-gris-texto">
            <tr>
              <th scope="col" className="w-56 px-4 py-2.5 font-semibold">
                Dato del catálogo
              </th>
              <th scope="col" className="w-64 px-4 py-2.5 font-semibold">
                Viene de la columna
              </th>
              {Array.from({ length: sampleCount }, (_, index) => (
                <th key={index} scope="col" className="px-4 py-2.5 font-semibold">
                  Fila {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <FieldRow
                key={row.target}
                row={row}
                draft={draft}
                sampleRows={sampleRows}
                sampleCount={sampleCount}
                vocabularies={vocabularies}
                reading={reading}
                missing={tried && row.required === true && row.columns.length === 0}
                open={open === row.target}
                onOpen={(value) => setOpen(value ? row.target : null)}
                onChange={onChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {unused.length > 0 && (
        <details className="text-base text-gris-texto">
          <summary className="cursor-pointer">
            <b className="text-tinta">Quedan sin usar {unused.length === 1 ? "1 columna" : `${unused.length} columnas`}</b>: se guardan en el registro de origen de cada fila.
          </summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unused.map((source) => (
              <li key={source} className="rounded-full bg-crema px-3 py-1 text-sm font-semibold text-tinta">
                {source}
              </li>
            ))}
          </ul>
        </details>
      )}

      {tried && blocker && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {blocker}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-carmin-bg p-3 text-base text-carmin-texto">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-4">
        <Button variant="secondary" disabled={busy} onClick={onBack}>
          Volver
        </Button>
        <Button variant="neutral" disabled={busy} onClick={onAdvanced}>
          Ver todas las columnas
        </Button>
        <span className="ml-auto text-base text-gris-texto">{summary.doubts > 0 ? `Revise ${summary.doubts === 1 ? "el dato marcado" : `los ${summary.doubts} datos marcados`} en ámbar.` : null}</span>
        <Button
          variant="create"
          icon={Check}
          disabled={busy || reading}
          onClick={() => {
            setTried(true);
            if (!blocker) onApply();
          }}
        >
          {busy ? "Validando…" : "Se ve bien: validar"}
        </Button>
      </div>
    </Card>
  );
}

function FieldRow({
  row,
  draft,
  sampleRows,
  sampleCount,
  vocabularies,
  reading,
  missing,
  open,
  onOpen,
  onChange,
}: {
  row: ReviewRow;
  draft: EditorDraft;
  sampleRows: readonly SampleRow[];
  sampleCount: number;
  vocabularies: Record<string, string>;
  reading: boolean;
  missing: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  onChange: (draft: EditorDraft) => void;
}) {
  const doubtId = useId();
  const origin = row.columns[0]?.origin ?? null;
  return (
    <tr className={cn("border-t border-borde align-top", row.doubt && "bg-ambar-bg/50", missing && "bg-carmin-bg/60")}>
      <th scope="row" className="px-4 py-2.5 text-left font-bold text-tinta">
        {row.label}
        {row.required && (
          <span className="text-carmin-texto" aria-label=" (obligatorio)">
            {" "}
            *
          </span>
        )}
        {row.doubt && (
          <span id={doubtId} className="mt-0.5 block text-sm font-semibold text-ambar-texto">
            {row.doubt}
          </span>
        )}
        {missing && <span className="mt-0.5 block text-sm font-semibold text-carmin-texto">Indique de qué columna sale.</span>}
      </th>
      <td className="px-4 py-2">
        {reading && row.columns.length === 0 ? (
          <span className="block h-9 w-44 animate-pulse rounded-full bg-crema motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <div className="relative flex flex-wrap items-center gap-2">
            <ColumnPicker
              row={row}
              origin={origin}
              draft={draft}
              sampleRows={sampleRows}
              vocabularies={vocabularies}
              describedBy={row.doubt ? doubtId : undefined}
              open={open}
              onOpen={onOpen}
              onPick={(source) => {
                onChange(assignColumn(draft, row.target, source));
                onOpen(false);
              }}
            />
            {row.doubt && (
              <Button size="sm" variant="outline" icon={Check} onClick={() => onChange(confirmTarget(draft, row.target))}>
                Es correcta
              </Button>
            )}
          </div>
        )}
      </td>
      {Array.from({ length: sampleCount }, (_, index) => {
        const value = row.values[index] ?? null;
        return (
          <td key={index} className={cn("max-w-56 truncate px-4 py-2.5", value ? "text-tinta" : "text-gris-texto")} title={value ?? undefined}>
            {reading && row.columns.length === 0 ? "" : (value ?? (row.columns.length === 0 && row.target === "tenure_regime" ? "Se elige al validar" : "—"))}
          </td>
        );
      })}
    </tr>
  );
}

function ColumnPicker({
  row,
  origin,
  draft,
  sampleRows,
  vocabularies,
  describedBy,
  open,
  onOpen,
  onPick,
}: {
  row: ReviewRow;
  origin: ColumnOrigin | null;
  draft: EditorDraft;
  sampleRows: readonly SampleRow[];
  vocabularies: Record<string, string>;
  describedBy?: string;
  open: boolean;
  onOpen: (open: boolean) => void;
  onPick: (source: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = columnChoices(draft, sampleRows, query, vocabularies);
  const chosen = new Set(row.columns.map((column) => column.source));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        onOpen(false);
        trigger.current?.focus();
        return;
      }
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) onOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, onOpen]);

  const label = row.columns.length === 0 ? "Ninguna columna" : row.columns.map((column) => column.source).join(" + ");
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-describedby={describedBy}
        aria-label={`${row.label}: ${label}. Cambiar columna`}
        onClick={() => {
          setQuery("");
          onOpen(!open);
        }}
        className={cn(
          "inline-flex min-h-10 max-w-60 items-center gap-2 rounded-full border bg-white py-1 pr-2.5 pl-3.5 text-sm font-semibold text-tinta focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terracota",
          row.columns.length === 0 ? "border-dashed border-borde text-gris-texto" : row.doubt ? "border-ambar-alerta" : "border-borde",
        )}
      >
        <span className="truncate">{label}</span>
        {origin && row.columns.length > 0 && (
          <span className={cn("shrink-0 rounded-full px-2 text-xs font-extrabold", origin === "ai" ? "bg-gemini-violeta/15 text-gemini-violeta-texto" : origin === "user" ? "bg-verde-bg text-verde-exito" : "bg-crema text-gris-texto")}>
            {ORIGIN_LABELS[origin]}
          </span>
        )}
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-gris-texto" />
      </button>
      {open && (
        <div ref={panel} id={panelId} role="dialog" aria-label={`¿De qué columna sale ${row.label.toLowerCase()}?`} className="absolute top-full left-0 z-20 mt-2 flex w-[26rem] flex-col gap-2 rounded-2xl border border-borde bg-white p-3 shadow-lg">
          <p className="px-1 text-base font-extrabold text-tinta">¿De qué columna sale {row.label.toLowerCase()}?</p>
          <label className="flex min-h-10 items-center gap-2 rounded-full border border-borde px-3.5 text-base text-gris-texto focus-within:outline-3 focus-within:outline-terracota">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Buscar entre las columnas del archivo</span>
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar entre las ${draft.columns.length} columnas`} className="min-w-0 flex-1 bg-transparent text-tinta outline-none" />
          </label>
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {choices.map((choice) => (
              <li key={choice.source}>
                <button
                  type="button"
                  aria-pressed={chosen.has(choice.source)}
                  onClick={() => onPick(choice.source)}
                  className={cn("flex w-full flex-col rounded-xl px-2.5 py-2 text-left hover:bg-crema-light focus-visible:outline-3 focus-visible:outline-terracota", chosen.has(choice.source) && "bg-terracota-light")}
                >
                  <span className="flex items-center gap-2 text-base font-bold text-tinta">
                    {choice.source}
                    {choice.current && !chosen.has(choice.source) && <span className="text-xs font-semibold text-gris-texto">hoy: {choice.current}</span>}
                  </span>
                  <span className="truncate text-sm text-gris-texto">{choice.examples}</span>
                </button>
              </li>
            ))}
            {choices.length === 0 && <li className="px-2.5 py-2 text-base text-gris-texto">Ninguna columna coincide.</li>}
          </ul>
          <button type="button" onClick={() => onPick(null)} className="rounded-xl px-2.5 py-2 text-left text-base font-semibold text-gris-texto hover:bg-crema-light focus-visible:outline-3 focus-visible:outline-terracota">
            No usar ninguna columna
          </button>
        </div>
      )}
    </>
  );
}
